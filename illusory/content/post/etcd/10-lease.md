---
title: "etcd教程(十)---lease 机制源码分析"
description: "通过源码分析 etcd lease 的原理与具体实现"
date: 2021-12-17
draft: false
categories: ["etcd"]
tags: ["etcd"]
---

本文主要记录了 etcd 中 Lease 的大致原理，包括 v2版本到v3版本的优化点，最后通过分析源码了解了具体实现。

<!--more-->

## 1. 概述

> 以下源码基于 etcd v3.5.1.



Lease 顾名思义，client 和 etcd server 之间存在一个约定，内容是 etcd server 保证在约定的有效期内（TTL），不会删除你关联到此 Lease 上的 key-value。

若你未在有效期内续租，那么 etcd server 就会删除 Lease 和其关联的 key-value。

> 可以简单理解为 key 的有效期。

Lease，是基于`主动型上报模式`提供的一种**活性检测机制**。

**Lease 整体架构**如下图所示：

![lease-arch][lease-arch]

etcd 在启动时会创建 Lessor 模块，而 Lessor 模块启动的时候，它会启动一个常驻 goroutine 以执行以下两个任务，如上图所示：

* 一个是**RevokeExpiredLease** 任务，定时检查是否有过期 Lease，发起撤销过期的 Lease 操作。
* 一个是**CheckpointScheduledLease**，定时触发更新 Lease 的剩余到期时间的操作。

```go
// server/etcdserver/server.go 299 行
func NewServer(cfg config.ServerConfig) (srv *EtcdServer, err error) {
    // ...
    // etcd server 启动时会启动 Lessor 模块
    	srv.lessor = lease.NewLessor(srv.Logger(), srv.be, srv.cluster, lease.LessorConfig{
		MinLeaseTTL:                int64(math.Ceil(minTTL.Seconds())),
		CheckpointInterval:         cfg.LeaseCheckpointInterval,
		CheckpointPersist:          cfg.LeaseCheckpointPersist,
		ExpiredLeasesRetryInterval: srv.Cfg.ReqTimeout(),
	})
    // 同时还指定了 Checkpointer 方法，如果有开启 LeaseCheckpoint 设置的话
    if srv.Cfg.EnableLeaseCheckpoint {
        // setting checkpointer enables lease checkpoint feature.
        srv.lessor.SetCheckpointer(func(ctx context.Context, cp *pb.LeaseCheckpointRequest) {
            srv.raftRequestOnce(ctx, pb.InternalRaftRequest{LeaseCheckpoint: cp})
        })
    }
    // ...
}

// server/lease/lessor.go 204 行
func NewLessor(lg *zap.Logger, b backend.Backend, cluster cluster, cfg LessorConfig) Lessor {
	return newLessor(lg, b, cluster, cfg)
}

func newLessor(lg *zap.Logger, b backend.Backend, cluster cluster, cfg LessorConfig) *lessor {
	checkpointInterval := cfg.CheckpointInterval
	expiredLeaseRetryInterval := cfg.ExpiredLeasesRetryInterval
	if checkpointInterval == 0 {
		checkpointInterval = defaultLeaseCheckpointInterval
	}
	if expiredLeaseRetryInterval == 0 {
		expiredLeaseRetryInterval = defaultExpiredleaseRetryInterval
	}
	l := &lessor{
		leaseMap:                  make(map[LeaseID]*Lease),
		itemMap:                   make(map[LeaseItem]LeaseID),
		leaseExpiredNotifier:      newLeaseExpiredNotifier(),
		leaseCheckpointHeap:       make(LeaseQueue, 0),
		b:                         b,
		minLeaseTTL:               cfg.MinLeaseTTL,
		checkpointInterval:        checkpointInterval,
		expiredLeaseRetryInterval: expiredLeaseRetryInterval,
		checkpointPersist:         cfg.CheckpointPersist,
		// expiredC is a small buffered chan to avoid unnecessary blocking.
		expiredC: make(chan []*Lease, 16),
		stopC:    make(chan struct{}),
		doneC:    make(chan struct{}),
		lg:       lg,
		cluster:  cluster,
	}
    // 从 blotdb 中加载lease数据并在内存中重建
	l.initAndRecover()
	// 这就是图中的两个常驻任务
	go l.runLoop()

	return l
}
// // server/lease/lessor.go 611 行
func (le *lessor) runLoop() {
	defer close(le.doneC)

	for {
		le.revokeExpiredLeases() // 移除已经过期的 lease
		le.checkpointScheduledLeases() // 更新lease的剩余到期时间，并将数据给follower节点

		select {
		case <-time.After(500 * time.Millisecond):
		case <-le.stopC:
			return
		}
	}
}
```



Lessor 模块提供了 Grant、Revoke、LeaseTimeToLive、LeaseKeepAlive API 给 client 使用，各接口作用如下:

* **Grant**：表示创建一个 TTL 为你指定秒数的 Lease，Lessor 会将 Lease 信息持久化存储在 boltdb 中；
* **Revoke**：表示撤销 Lease 并删除其关联的数据；
* **LeaseTimeToLive**：表示获取一个 Lease 的有效期、剩余时间；
* **LeaseKeepAlive**：表示为 Lease 续期。





## 2. key 如何关联 Lease

大致分为两步：

* 1）创建 Lease
* 2）将 key 与 lease 关联

具体流程如下：

![lease-process][lease-process]



### 2.1 创建 Lease

client 可通过 clientv3 库的 Lease API 发起 RPC 调用来创建 Lease，例如：

```sh
# 创建一个TTL为600秒的lease，etcd server返回LeaseID
$ etcdctl lease grant 600
lease 326975935f48f814 granted with TTL(600s)


# 查看lease的TTL、剩余时间
$ etcdctl lease timetolive 326975935f48f814
lease 326975935f48f814 granted with TTL(600s)， remaining(590s)
```

当 Lease server 收到 client 的创建一个有效期 600 秒的 Lease 请求后，会通过 Raft 模块完成日志同步，随后 Apply 模块通过 Lessor 模块的 Grant 接口执行日志条目内容。

首先 Lessor 的 Grant 接口会把 Lease 保存到内存的 ItemMap 数据结构中，然后它需要持久化 Lease，将 Lease 数据保存到 boltdb 的 Lease bucket 中，返回一个唯一的 LeaseID 给 client。



```go
// server/lease/lessor.go 272行
func (le *lessor) Grant(id LeaseID, ttl int64) (*Lease, error) {
	l := &Lease{
		ID:      id,
		ttl:     ttl,
		itemSet: make(map[LeaseItem]struct{}),
		revokec: make(chan struct{}),
	}

	le.mu.Lock()
	defer le.mu.Unlock()

	if _, ok := le.leaseMap[id]; ok {
		return nil, ErrLeaseExists
	}

	if l.ttl < le.minLeaseTTL {
		l.ttl = le.minLeaseTTL
	}

	if le.isPrimary() {
		l.refresh(0)
	} else {
		l.forever()
	}
    // 将新建的 lease 存入 lessor 模块中，一个 map 结构
	le.leaseMap[id] = l
    // 将 lease 持久化到 blotdb中。
	l.persistTo(le.b)

	leaseTotalTTLs.Observe(float64(l.ttl))
	leaseGranted.Inc()

	if le.isPrimary() {
		item := &LeaseWithTime{id: l.ID, time: l.expiry}
		le.leaseExpiredNotifier.RegisterOrUpdate(item)
		le.scheduleCheckpointIfNeeded(l)
	}

	return l, nil
}
```



### 2.2 将 key 与 lease 关联

KV 模块的 API 接口提供了一个"--lease"参数，你可以通过写入 key 时带上该参数，将 key node 关联到对应的 LeaseID 上。

```sh
$ etcdctl put node healthy --lease 326975935f48f818
OK
$ etcdctl get node -w=json | python -m json.tool
{
    "kvs":[
        {
            "create_revision":24，
            "key":"bm9kZQ=="，
            "Lease":3632563850270275608，
            "mod_revision":24，
            "value":"aGVhbHRoeQ=="，
            "version":1
        }
    ]
}
```

当你通过 put 等命令新增一个指定了"--lease"的 key 时，MVCC 模块它会通过 Lessor 模块的 Attach 方法，将 key 关联到 Lease 的 key 内存集合 ItemSet 中，为了保证持久化，在写入 blotdb 时会将 key 关联的 lease 信息一并写入。

```go
// server/lease/lessor.go 546行
func (le *lessor) Attach(id LeaseID, items []LeaseItem) error {
	le.mu.Lock()
	defer le.mu.Unlock()

	l := le.leaseMap[id]
	if l == nil {
		return ErrLeaseNotFound
	}

	l.mu.Lock()
	for _, it := range items {
		l.itemSet[it] = struct{}{}
		le.itemMap[it] = id
	}
	l.mu.Unlock()
	return nil
}
// 有 Attach 自然就会有 Detach
// server/lease/lessor.go 573行
func (le *lessor) Detach(id LeaseID, items []LeaseItem) error {
	le.mu.Lock()
	defer le.mu.Unlock()

	l := le.leaseMap[id]
	if l == nil {
		return ErrLeaseNotFound
	}

	l.mu.Lock()
	for _, it := range items {
		delete(l.itemSet, it)
		delete(le.itemMap, it)
	}
	l.mu.Unlock()
	return nil
}
```

其中 LeaseItem 其实就是我们提供的 key ：

```go
type LeaseItem struct {
	Key string
}
```



## 3. Lease 续期

在正常情况下，你的节点存活时，需要定期发送 KeepAlive 请求给 etcd 续期健康状态的 Lease，否则你的 Lease 和关联的数据就会被删除。

**那么如何高效的实现这个需求呢？**

续期性能受多方面影响：

* 首先是 TTL，TTL 过长会导致节点异常后，无法及时从 etcd 中删除，影响服务可用性，而过短，则要求 client 频繁发送续期请求。
* 其次是 Lease 数，如果 Lease 成千上万个，那么 etcd 可能无法支撑如此大规模的 Lease 数，导致高负载。

**v2 版本**

在早期 v2 版本中，没有 Lease 概念，TTL 属性是在 key 上面，为了保证 key 不删除，即便你的 TTL 相同，client 也需要为每个 TTL、key 创建一个 HTTP/1.x 连接，定时发送续期请求给 etcd server。

很显然，v2 老版本这种设计，因不支持连接多路复用、相同 TTL 无法复用导致性能较差，无法支撑较大规模的 Lease 场景。

**v3版本**

etcd v3 版本为了解决以上问题，提出了 Lease 特性，TTL 属性转移到了 Lease 上， 同时协议从 HTTP/1.x 优化成 gRPC 协议。

* 一方面不同 key 若 TTL 相同，可复用同一个 Lease， 显著减少了 Lease 数。

* 另一方面，通过 gRPC HTTP/2 实现了多路复用，流式传输，同一连接可支持为多个 Lease 续期，大大减少了连接数。

通过以上两个优化，实现 Lease 性能大幅提升，满足了各个业务场景诉求。



```go
// server/lease/lessor.go 391 行
func (le *lessor) Renew(id LeaseID) (int64, error) {
    // ... 省略无关代码
	// 重置 remaining TTL字段，如果存在的话，这个和 checkPoint有关
	clearRemainingTTL := le.cp != nil && l.remainingTTL > 0

	if clearRemainingTTL {
        // 可以看到，就是将 Remaining_TTL 字段设置为0了
		le.cp(context.Background(), &pb.LeaseCheckpointRequest{Checkpoints: []*pb.LeaseCheckpoint{{ID: int64(l.ID), Remaining_TTL: 0}}})
	}

	l.refresh(0) // refresh lease 的过期时间
	item := &LeaseWithTime{id: l.ID, time: l.expiry}
	le.leaseExpiredNotifier.RegisterOrUpdate(item)

	leaseRenewed.Inc()
	return l.ttl, nil
}

```



## 4. 如何高效淘汰过期 Lease

**淘汰过期 Lease 的工作由 Lessor 模块的一个异步 goroutine 负责**。它会定时从最小堆中取出已过期的 Lease，执行删除 Lease 和其关联的 key 列表数据的 RevokeExpiredLease 任务。

etcd Lessor 主循环每隔 500ms 执行一次撤销 Lease 检查（RevokeExpiredLease），每次轮询堆顶的元素，若已过期则加入到待淘汰列表，直到堆顶的 Lease 过期时间大于当前，则结束本轮轮询。

**优化前**

etcd 早期的时候，淘汰 Lease 非常暴力。etcd 会直接遍历所有 Lease，逐个检查 Lease 是否过期，过期则从 Lease 关联的 key 集合中，取出 key 列表，删除它们，时间复杂度是 O(N)。

**优化后**

目前 etcd 是基于**最小堆**来管理 Lease，实现快速淘汰过期的 Lease。

每次新增 Lease、续期的时候，它会插入、更新一个对象到最小堆中，对象含有 LeaseID 和其到期时间 unixnano，**对象之间按到期时间升序排序**。

使用堆优化后后，插入、更新、删除，它的时间复杂度是 O(Log N)，查询堆顶对象是否过期时间复杂度仅为 O(1)，性能大大提升，可支撑大规模场景下 Lease 的高效淘汰。

**获取到待过期的 LeaseID 后，Leader 是如何通知其他 Follower 节点淘汰它们呢？**

Lessor 模块会将已确认过期的 LeaseID，保存在一个名为 expiredC 的 channel 中，而 etcd server 的主循环会定期从 channel 中获取 LeaseID，发起 revoke 请求，通过 Raft Log 传递给 Follower 节点。

各个节点收到 revoke Lease 请求后，获取关联到此 Lease 上的 key 列表，从 boltdb 中删除 key，从 Lessor 的 Lease map 内存中删除此 Lease 对象，最后还需要从 boltdb 的 Lease bucket 中删除这个 Lease。



```go
// server/lease/lessor.go 628行
// 这就是之前提到的 lessor 模块的两个定时任务中的一个
func (le *lessor) revokeExpiredLeases() {
	var ls []*Lease

	// 限制每次定时任务最多只能移除多少个 lease
    // 主要是防止同时过期的 lease 太多，阻塞后续的任务
	revokeLimit := leaseRevokeRate / 2

	le.mu.RLock()
	if le.isPrimary() {
        // 找到已经过期的 lease
		ls = le.findExpiredLeases(revokeLimit)
	}
	le.mu.RUnlock()

	if len(ls) != 0 {
		select {
		case <-le.stopC:
			return
           // 然后发送到 expiredC chan 中，具体的处理逻辑由 etcd server 主循环负责
		case le.expiredC <- ls:
		default:
			// the receiver of expiredC is probably busy handling
			// other stuff
			// let's try this next time after 500ms
		}
	}
}
```





## 5.  checkpoint 机制

为了降低 Lease 特性的实现复杂度，检查 Lease 是否过期、维护最小堆、针对过期的 Lease 发起 revoke 操作，都是 Leader 节点负责的，它类似于 Lease 的仲裁者，通过以上清晰的权责划分。

那么当 Leader 因重启、crash、磁盘 IO 等异常不可用时，Follower 节点就会发起 Leader 选举，新 Leader 要完成以上职责，必须重建 Lease 过期最小堆等管理数据结构，**那么以上重建可能会触发什么问题呢**？

当你的集群发生 Leader 切换后，新的 Leader 基于 Lease map 信息，按 Lease 过期时间构建一个最小堆时，etcd 早期版本为了优化性能，并未持久化存储 Lease 剩余 TTL 信息，**因此重建的时候就会自动给所有 Lease 自动续期了**。

> 如果较频繁出现 Leader 切换，切换时间小于 Lease 的 TTL，这会导致 Lease 永远无法删除，大量 key 堆积，db 大小超过配额等异常。

为了解决这个问题，etcd 引入了检查点机制，也就是 Lessor 模块的**checkpointScheduledLease **定时任务。

* 一方面，etcd 启动的时候，Leader 节点后台会运行此异步任务，定期批量地将 Lease 剩余的 TTL 基于 Raft Log 同步给 Follower 节点，Follower 节点收到 CheckPoint 请求后，更新内存数据结构 LeaseMap 的剩余 TTL 信息。

* 另一方面，当 Leader 节点收到 KeepAlive 请求的时候，它也会通过 checkpoint 机制把此 Lease 的剩余 TTL 重置，并同步给 Follower 节点，尽量确保续期后集群各个节点的 Lease 剩余 TTL 一致性。

> 最后你要注意的是，此特性对性能有一定影响，目前仍然是试验特性。你可以通过 experimental-enable-lease-checkpoint 参数开启。



```go
// server/lease/lessor.go 826行
type Lease struct {
	ID           LeaseID
	ttl          int64 // time to live of the lease in seconds
	remainingTTL int64 // remaining time to live in seconds, if zero valued it is considered unset and the full ttl should be used
	// expiryMu protects concurrent accesses to expiry
	expiryMu sync.RWMutex
	// expiry is time when lease should expire. no expiration when expiry.IsZero() is true
	expiry time.Time

	// mu protects concurrent accesses to itemSet
	mu      sync.RWMutex
	itemSet map[LeaseItem]struct{}
	revokec chan struct{}
}
```

Lease 中的 remainingTTL 字段就是用于完成这个功能的。

在 Grant 创建 Lease 时，该字段是没有赋值的：

```go
func (le *lessor) Grant(id LeaseID, ttl int64) (*Lease, error) {
	l := &Lease{
		ID:      id,
		ttl:     ttl,
		itemSet: make(map[LeaseItem]struct{}),
		revokec: make(chan struct{}),
	}
}
```

即，新建的 Lease remainingTTL 字段都为0。

至于具体的逻辑自然是在`checkpointScheduledLease `这个定时任务中了：

```go
// server/lease/lessor.go 655 行
func (le *lessor) checkpointScheduledLeases() {
	var cps []*pb.LeaseCheckpoint

	// 和另一个定时任务一样，同样是加了限制，防止该任务消耗太多时间
	for i := 0; i < leaseCheckpointRate/2; i++ {
		le.mu.Lock()
		if le.isPrimary() {
            // 寻找需要执行 checkPoint 的 Lease，同样是限制了最大个数
			cps = le.findDueScheduledCheckpoints(maxLeaseCheckpointBatchSize)
		}
		le.mu.Unlock()

		if len(cps) != 0 {
            // cp 是一个方法，调用该方法进行 checkPoint 检查
			le.cp(context.Background(), &pb.LeaseCheckpointRequest{Checkpoints: cps})
		}
        // 上面查询时限制了最大查询数，如果最终个数少于指定值，则说明没有更多结果了，退出循环
        // 比如限制要找1000个，结果返回值也是1000个，说明后续可能还有没找到的Lease，但是如果只找到了100个，那肯定是找完了。
		if len(cps) < maxLeaseCheckpointBatchSize {
			return
		}
	}
}
```

至于是怎么找的，其实就是循环从 heap 中取出来的：

```go
func (le *lessor) findDueScheduledCheckpoints(checkpointLimit int) []*pb.LeaseCheckpoint {
	if le.cp == nil {
		return nil
	}

	now := time.Now()
	cps := []*pb.LeaseCheckpoint{}
	for le.leaseCheckpointHeap.Len() > 0 && len(cps) < checkpointLimit {
		lt := le.leaseCheckpointHeap[0]
        // 这是一个最小堆，第一个元素的time值就是最小的，如果第一个元素的checkpoint time 都没到，则说明该找的都找到了，直接返回
		if lt.time.After(now) /* lt.time: next checkpoint time */ {
			return cps
		}
		heap.Pop(&le.leaseCheckpointHeap)
		var l *Lease
		var ok bool
		if l, ok = le.leaseMap[lt.id]; !ok {
			continue
		}
        // 如果这个lease都过期了则不检测，由expireCheck任务处理
		if !now.Before(l.expiry) {
			continue
		}
		remainingTTL := int64(math.Ceil(l.expiry.Sub(now).Seconds()))
		if remainingTTL >= l.ttl {
			continue
		}
		if le.lg != nil {
			le.lg.Debug("Checkpointing lease",
				zap.Int64("leaseID", int64(lt.id)),
				zap.Int64("remainingTTL", remainingTTL),
			)
		}
		cps = append(cps, &pb.LeaseCheckpoint{ID: int64(lt.id), Remaining_TTL: remainingTTL})
	}
	return cps
}
```

继续追踪下去，看下找到只会 etcd 是如何处理的，

```go
            // cp 是一个方法，调用该方法进行 checkPoint 检查
			le.cp(context.Background(), &pb.LeaseCheckpointRequest{Checkpoints: cps})
```

如果够仔细的话，可以发送cp 字段其实是在 NewServer 方法中赋值的：

```go
// server/etcdserver/server.go 299 行
func NewServer(cfg config.ServerConfig) (srv *EtcdServer, err error) {
    // 因为该功能对性能有一定影响，目前还是试验性功能，需要通过参数指定开启
    if srv.Cfg.EnableLeaseCheckpoint {
        // setting checkpointer enables lease checkpoint feature.
        srv.lessor.SetCheckpointer(func(ctx context.Context, cp *pb.LeaseCheckpointRequest) {
            srv.raftRequestOnce(ctx, pb.InternalRaftRequest{LeaseCheckpoint: cp})
        })
    }

}
```

具体逻辑如下：

```go
// server/etcdserver/v3_server.go 593行
func (s *EtcdServer) raftRequestOnce(ctx context.Context, r pb.InternalRaftRequest) (proto.Message, error) {
	result, err := s.processInternalRaftRequestOnce(ctx, r)
	if err != nil {
		return nil, err
	}
	if result.err != nil {
		return nil, result.err
	}
	if startTime, ok := ctx.Value(traceutil.StartTimeKey).(time.Time); ok && result.trace != nil {
		applyStart := result.trace.GetStartTime()
		// The trace object is created in apply. Here reset the start time to trace
		// the raft request time by the difference between the request start time
		// and apply start time
		result.trace.SetStartTime(startTime)
		result.trace.InsertStep(0, applyStart, "process raft request")
		result.trace.LogIfLong(traceThreshold)
	}
	return result.resp, nil
}
```

再进一步：

```go
// server/etcdserver/v3_server.go 642行
func (s *EtcdServer) processInternalRaftRequestOnce(ctx context.Context, r pb.InternalRaftRequest) (*applyResult, error) {
    // 这里首先获取了本地复制状态机中的 appliedIndex 和 committedIndex
	ai := s.getAppliedIndex()
	ci := s.getCommittedIndex()
    // 如果 committedIndex 远超过 appliedIndex（目前阈值为5000）就会报错，此时不再接受新的提案。
    // ErrTooManyRequests             = errors.New("etcdserver: too many requests")
	if ci > ai+maxGapBetweenApplyAndCommitIndex {
		return nil, ErrTooManyRequests
	}

	r.Header = &pb.RequestHeader{
		ID: s.reqIDGen.Next(),
	}

	// check authinfo if it is not InternalAuthenticateRequest
	if r.Authenticate == nil {
		authInfo, err := s.AuthInfoFromCtx(ctx)
		if err != nil {
			return nil, err
		}
		if authInfo != nil {
			r.Header.Username = authInfo.Username
			r.Header.AuthRevision = authInfo.Revision
		}
	}

	data, err := r.Marshal()
	if err != nil {
		return nil, err
	}

	if len(data) > int(s.Cfg.MaxRequestBytes) {
		return nil, ErrRequestTooLarge
	}

	id := r.ID
	if id == 0 {
		id = r.Header.ID
	}
    // 注册提案Id，后续通过chan以异步的方式接受返回值
	ch := s.w.Register(id)

	cctx, cancel := context.WithTimeout(ctx, s.Cfg.ReqTimeout())
	defer cancel()

	start := time.Now()
    // 到此将这个提案提交到 raft 模块。
	err = s.r.Propose(cctx, data)
	if err != nil {
		proposalsFailed.Inc()
		s.w.Trigger(id, nil) // GC wait
		return nil, err
	}
	proposalsPending.Inc()
	defer proposalsPending.Dec()

	select {
	case x := <-ch:
		return x.(*applyResult), nil
	case <-cctx.Done():
		proposalsFailed.Inc()
		s.w.Trigger(id, nil) // GC wait
		return nil, s.parseProposeCtxErr(cctx.Err(), start)
	case <-s.done:
		return nil, ErrStopped
	}
}
```



至此 checkPoint 工作就算完成一大半了，remainingTTL 数据被提交到 Raft 模块，然后同步给 Follower，最后 Apply 到状态机。

> 这样所有的节点都拥有了 Lease 的 remainingTTL 值了。

看下崩溃恢复后，是如何处理的：

```go
func newLessor(lg *zap.Logger, b backend.Backend, cluster cluster, cfg LessorConfig) *lessor {
	l := &lessor{}
    // 从 blotdb 中加载lease数据并在内存中重建
	l.initAndRecover()
}
```

Lessor 模块启动的时候就会从 blotdb 中加载数据并重建。

```go

func (le *lessor) initAndRecover() {
	tx := le.b.BatchTx()

	tx.Lock()
	schema.UnsafeCreateLeaseBucket(tx)
	lpbs := schema.MustUnsafeGetAllLeases(tx)
	tx.Unlock()
	for _, lpb := range lpbs {
		ID := LeaseID(lpb.ID)
		if lpb.TTL < le.minLeaseTTL {
			lpb.TTL = le.minLeaseTTL
		}
		le.leaseMap[ID] = &Lease{
			ID:  ID,
			ttl: lpb.TTL,
			itemSet:      make(map[LeaseItem]struct{}),
			expiry:       forever,
			revokec:      make(chan struct{}), 
			remainingTTL: lpb.RemainingTTL, // 重建时同样带上了 RemainingTTL
		}
	}
	le.leaseExpiredNotifier.Init()
	heap.Init(&le.leaseCheckpointHeap)

	le.b.ForceCommit()
}
```

由于重建时也带上了 RemainingTTL，此时就不会向之前那样，每次重建都会默认给 Lease 续期了。

至此 etcd 的 checkPoint 功能结束，Lease 被自动续期的问题也得以解决。



## 6. 小结 

* 1）Lease 的核心是 TTL，当 Lease 的 TTL 过期时，它会自动删除其关联的 key-value 数据。
* 2）v3 版本通过引入 Lease 的概念，将 TTL 和 Key 解耦，支持多 key 共用一个 Lease 来提升性能。同时协议从 HTTP/1.x 优化成 gRPC 协议，支持多路连接复用，显著降低了 server 连接数等资源开销。
* 3）Lease 过期通过最小堆来提升效率。
* 4）通过 Checkpoint 机制想 follower 同步 Lease 信息来解决 Leader 异常情况下 TTL 自动被续期，可能导致 Lease 永不淘汰的问题而诞生。



作者能力实在是有限，文中很有可能会有一些错误的理解。所以当你发现了一些违和的地方，也请不吝指教，谢谢你！

再次感谢你能看到这里！

## 7. 参考

`https://github.com/etcd-io/etcd`

`etcd 实战课`







[lease-arch]:https://github.com/lixd/blog/raw/master/images/etcd/lease/lease-arch.png
[lease-process]:https://github.com/lixd/blog/raw/master/images/etcd/lease/lease-process.png







