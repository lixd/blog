---
title: "etcd教程(十四)---watch 机制源码分析（下）"
description: "etcd watch 机制具体实现及源码分析"
date: 2022-01-28
draft: false
categories: ["etcd"]
tags: ["etcd"]
---

本文主要通过源码分析了 etcd v3 版本 watch 机制的具体实现（下篇）。

<!--more-->

在上一篇 [etcd教程(十三)---watch 机制源码分析（上）](https://www.lixueduan.com/post/etcd/13-watch-analyze-1/) 中分析了 watch 方法的实现，这篇主要分析 MVCC 模块中的事件产生与推送逻辑的具体实现。

还是开篇贴一下整个的流程图：

![etcd-v3-watch-arch][etcd-v3-watch-arch]

 

## 1. MVCC

在 etcd 启动的时候，WatchableKV 模块会运行 syncWatchersLoop 和 syncVictimsLoop 这两个 goroutine，分别负责不同场景下的事件推送，它们也是 Watch 特性可靠性的核心之一。

```go
// server/etcdserver/server.go 299行
func NewServer(cfg config.ServerConfig) (srv *EtcdServer, err error) {
    // 省略部分无关代码
    srv = &EtcdServer{
		readych:               make(chan struct{}),
		Cfg:                   cfg,
		// ...
		consistIndex:          b.storage.backend.ci,
		firstCommitInTerm:     notify.NewNotifier(),
		clusterVersionChanged: notify.NewNotifier(),
	}
    // 将 mvcc 中的 KV 对象赋值给了 srv
    srv.kv = mvcc.New(srv.Logger(), srv.be, srv.lessor, mvccStoreConfig)

}
```

其中的 srv.kv 字段具体类型如下：

```go
type EtcdServer struct {
    // 省略其他字段
    kv         mvcc.WatchableKV
}	
```

根据名字，应该就能猜到这个是用来做什么的了。

继续追踪下去，看 `mvcc.New` 具体实现：

```go
// server/storage/mvcc/watchable_store.go 73 行
func New(lg *zap.Logger, b backend.Backend, le lease.Lessor, cfg StoreConfig) WatchableKV {
	return newWatchableStore(lg, b, le, cfg)
}

func newWatchableStore(lg *zap.Logger, b backend.Backend, le lease.Lessor, cfg StoreConfig) *watchableStore {
	if lg == nil {
		lg = zap.NewNop()
	}
	s := &watchableStore{
		store:    NewStore(lg, b, le, cfg),
		victimc:  make(chan struct{}, 1),
		unsynced: newWatcherGroup(),
		synced:   newWatcherGroup(),
		stopc:    make(chan struct{}),
	}
	s.store.ReadView = &readView{s}
	s.store.WriteView = &writeView{s}
	if s.le != nil {
		// use this store as the deleter so revokes trigger watch events
		s.le.SetRangeDeleter(func() lease.TxnDelete { return s.Write(traceutil.TODO()) })
	}
	s.wg.Add(2)
    // 这里启动了两个 goroutine，分别是 syncWatchersLoop 和 syncVictimsLoop
	go s.syncWatchersLoop()
	go s.syncVictimsLoop()
	return s
}
```

这里启动的两个 goroutine 分别负责了历史事件推送和异常场景重试。

而最新消息推送并不是由后台任务推送，而是在执行 PUT 操作时，由 `notify` 方法同步推送。

* syncWatchersLoop：历史事件推送
* syncVictimsLoop：异常场景重试
* notify：最新事件推送

> 这也和上篇中提到的 watcher 分类对应。

后续主要对着两个 goroutine 和 notify 方法进行分析。



## 2. 事件推送实现

### watcher 分类

上一篇中说过，etcd 中根据不同场景，对问题进行了分解，将 watcher 按场景分类，实现了轻重分离、低耦合。

具体如下：

* **synced watcher**，顾名思义，表示此类 watcher 监听的数据都已经同步完毕，在等待新的变更。
  * 如果你创建的 watcher 未指定版本号 (默认 0)、或指定的版本号大于 etcd sever 当前最新的版本号 (currentRev)，那么它就会保存到 synced watcherGroup 中。

* **unsynced watcher**，表示此类 watcher 监听的数据还未同步完成，落后于当前最新数据变更，正在努力追赶。
  * 如果你创建的 watcher 指定版本号小于 etcd server 当前最新版本号，那么它就会保存到 unsynced watcherGroup 中。

* **victim watcher**：表示 watcher 存在事件堆积导致推送异常 ，需要由异步任务执行重试操作。

从以上介绍中，我们可以将可靠的事件推送机制拆分成`最新事件推送`、`异常场景重试`、`历史事件推送`三个子问题来进行分析。

watcher 状态转换关系如下图所示：

![etcd-watcher-state-change][etcd-watcher-state-change]



### notify 方法

notify 主要实现 **最新事件推送**。

当你创建完成 watcher 后，执行 put hello 修改操作时，如流程图所示，请求会经过 KVServer、Raft 模块后最终Apply 到状态机，在 MVCC 的 put 事务中，它会将本次修改的后的 mvccpb.KeyValue 保存到一个 changes 数组中。

在 put 事务结束时，如下面的代码所示，它会将 KeyValue 转换成 Event 事件，然后回调 watchableStore.notify 函数（流程 5）。

notify 会匹配出监听过此 key 并处于 synced watcherGroup 中的 watcher，同时事件中的版本号要大于等于 watcher 监听的最小版本号，才能将事件发送到此 watcher 的事件 channel 中。

> 注意：为了保证事件顺序，这里只有在 synced watcherGroup 中的 watcher 才会执行立即推送，否则就只能等异常推送历史消息了。
>
> 如果在 notify 中直接从 blotdb 中把对应 watcher 的所有 event 都查询出来进行推送，也可以保证先后顺序，但是这样太慢了，会影响到接口的响应时间。因此还是丢到了异步逻辑中。

serverWatchStream 的 sendLoop goroutine 监听到 channel 消息后，读出消息立即推送给 client（流程 6 和 7），至此，完成一个最新修改事件推送。



tx.Put 方法实现如下：

```go
func (tw *storeTxnWrite) put(key, value []byte, leaseID lease.LeaseID) {
	// 省略其他逻辑
	tw.s.kvindex.Put(key, idxRev)
	tw.changes = append(tw.changes, kv) // 将本次修改的后的 mvccpb.KeyValue 保存到一个 changes 数组中。
}
```

可以看到，每次修改后，都会使用将修改后的 mvccpb.KeyValue 追加到 changes 数组中。

而 put 事务结束时会调用 End 方法（类似于 commit），具体实现如下：

```go
// server/storage/mvcc/watchable_store_txn.go 22 行
func (tw *watchableStoreTxnWrite) End() {
	changes := tw.Changes()
	if len(changes) == 0 {
		tw.TxnWrite.End()
		return
	}

	rev := tw.Rev() + 1
	evs := make([]mvccpb.Event, len(changes))
    // 将本次事务中的 cahnges 转换成 event
	for i, change := range changes {
		evs[i].Kv = &changes[i]
		if change.CreateRevision == 0 {
			evs[i].Type = mvccpb.DELETE
			evs[i].Kv.ModRevision = rev
		} else {
			evs[i].Type = mvccpb.PUT
		}
	}

	tw.s.mu.Lock()
	tw.s.notify(rev, evs) // 调用 notify 方法，通知 watchStream
	tw.TxnWrite.End()
	tw.s.mu.Unlock()
}
```

在 end 方法中，将本次事务中的 changes 转换成 event，然后调用 notify 方法通知 watchStream。

具体 notify 方法实现如下：

```go
// server/storage/mvcc/watchable_store_txn.go 434 行
func (s *watchableStore) notify(rev int64, evs []mvccpb.Event) {
	victim := make(watcherBatch)
    // event 事件进行批量化处理，根据watcher进行分类
    // 然后遍历，一个一个推送
	for w, eb := range newWatcherBatch(&s.synced, evs) {
		if eb.revs != 1 {
			s.store.lg.Panic(
				"unexpected multiple revisions in watch notification",
				zap.Int("number-of-revisions", eb.revs),
			)
		}
		if w.send(WatchResponse{WatchID: w.id, Events: eb.evs, Revision: rev}) {
			pendingEventsGauge.Add(float64(len(eb.evs)))
		} else {
            // 如果推送失败了就加入到 victim 列表中。
			// move slow watcher to victims
			w.minRev = rev + 1
			w.victim = true
			victim[w] = eb
			s.synced.delete(w)
			slowWatcherGauge.Inc()
		}
	}
	s.addVictim(victim)
}
```

先进行批量化处理，然后遍历调用 send 方法，将 event 发送出去。具体 send 方法实现如下：

```go
func (w *watcher) send(wr WatchResponse) bool {
	progressEvent := len(wr.Events) == 0
    // 首先是根据 filter 方法，过滤掉不关心的 event
	if len(w.fcs) != 0 {
		ne := make([]mvccpb.Event, 0, len(wr.Events))
		for i := range wr.Events {
			filtered := false
			for _, filter := range w.fcs {
				if filter(wr.Events[i]) {
					filtered = true
					break
				}
			}
			if !filtered {
				ne = append(ne, wr.Events[i])
			}
		}
		wr.Events = ne
	}

	if !progressEvent && len(wr.Events) == 0 {
		return true
	}
    // 然后发送出去
	select {
	case w.ch <- wr:
		return true
	default:
		return false
	}
}
```

实际上这里的 watcher 就是前面 recvLoop 中收到 create 请求时创建的 watcher，具体如下：

```go
func (ws *watchStream) Watch(id WatchID, key, end []byte, startRev int64, fcs ...FilterFunc) (WatchID, error) {
    // 上文中的 watcher 就是这里创建的，而 watcher.ch 实际就是 watchStream.ch
	w, c := ws.watchable.watch(key, end, startRev, id, ws.ch, fcs...)
}
```

因此实际上最终 event 被发送到了  watchStream.ch。

然后 sendLoop 不断从  watchStream.ch 中取出 event 并发送给 client。

到此，整个流程就算是串起来了。



notify 中如果发送失败后会将 watcher 添加到 victimGroup 中。这里的发送失败主要是由于 ch 阻塞，导致没发出去，也就是图中的**事件堆积**。

也就是下面的 select 中走了 default path。

```go
	select {
	case w.ch <- wr:
		return true
	default:
		return false
	}
```



### syncWatchersLoop

syncWatchersLoop 主要负责**历史事件推送**。

notify 只会处理在 synced watcherGroup 中的 watcher ，如果不在则无法立即接收到 event。

notify  只用于推送最新事件，如果 watcher 还有旧 event 没有推送，而直接推送最新 event 势必无法保证 event 的先后顺序，因此 notify 中只处理了 synced watcherGroup 中的 watcher 。

为了保证效率，notify 也没有从 blotdb 中把对应 watcher 的所有 event 都查询出来再进行推送。

而 syncWatchersLoop 就是负责处理 unsynced 中的 watcher，将这些 watcher 的历史 event 全部推送给 sendLoop，然后将其移动到  synced watcherGroup，以便下次 notify 时就能直接处理。



具体实现如下：

```go
// server/storage/mvcc/watchable_store.go 211行
func (s *watchableStore) syncWatchersLoop() {
	defer s.wg.Done()

	for {
		s.mu.RLock()
		st := time.Now()
		lastUnsyncedWatchers := s.unsynced.size()
		s.mu.RUnlock()

		unsyncedWatchers := 0
		if lastUnsyncedWatchers > 0 {
			unsyncedWatchers = s.syncWatchers()
		}
		syncDuration := time.Since(st)

		waitDuration := 100 * time.Millisecond
		// more work pending?
		if unsyncedWatchers != 0 && lastUnsyncedWatchers > unsyncedWatchers {
			// be fair to other store operations by yielding time taken
			waitDuration = syncDuration
		}

		select {
		case <-time.After(waitDuration):
		case <-s.stopc:
			return
		}
	}
}
```

每过 100ms 就会对 unsynced watcher 进行一次同步。

具体同步逻辑在`s.syncWatchers()`方法中：

```go
// server/storage/mvcc/watchable_store.go 326行
func (s *watchableStore) syncWatchers() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.unsynced.size() == 0 {
		return 0
	}

	s.store.revMu.RLock()
	defer s.store.revMu.RUnlock()

	curRev := s.store.currentRev
	compactionRev := s.store.compactMainRev

	wg, minRev := s.unsynced.choose(maxWatchersPerSync, curRev, compactionRev)
	minBytes, maxBytes := newRevBytes(), newRevBytes()
	revToBytes(revision{main: minRev}, minBytes)
	revToBytes(revision{main: curRev + 1}, maxBytes)

	tx := s.store.b.ReadTx()
	tx.RLock()
	revs, vs := tx.UnsafeRange(schema.Key, minBytes, maxBytes, 0)
	evs := kvsToEvents(s.store.lg, wg, revs, vs)

	tx.RUnlock()

	victims := make(watcherBatch)
	wb := newWatcherBatch(wg, evs)
	for w := range wg.watchers {
		w.minRev = curRev + 1

		eb, ok := wb[w]
		if !ok {
			s.synced.add(w)
			s.unsynced.delete(w)
			continue
		}

		if eb.moreRev != 0 {
			w.minRev = eb.moreRev
		}

		if w.send(WatchResponse{WatchID: w.id, Events: eb.evs, Revision: curRev}) {
			pendingEventsGauge.Add(float64(len(eb.evs)))
		} else {
			w.victim = true
		}

		if w.victim {
			victims[w] = eb
		} else {
			if eb.moreRev != 0 {
				// stay unsynced; more to read
				continue
			}
			s.synced.add(w)
		}
		s.unsynced.delete(w)
	}
	s.addVictim(victims)

	vsz := 0
	for _, v := range s.victims {
		vsz += len(v)
	}
	slowWatcherGauge.Set(float64(s.unsynced.size() + vsz))

	return s.unsynced.size()
}
```

大致逻辑：

* 1）从 unsynced watcher group 中选取一组 watcher
* 2）遍历这组 watcher 得到 minimum revision，并移除掉已经被压缩的 watcher
* 3）根据第二步中查询到的 minimum revision 查询 键值对并发送这些事件给 watchers
* 4）最后对这组 watcher 进行判断，若同步完成了就将其从 unsynced watcher group 中移动到 synced watcher  group 中



每次都会从所有的 unsynced watcher group 中选出一批 Watcher 进行批处理(组成watchGroup)，在这批 Watcher 中将观察到的`最小`的 `revision.mainID` 作为 bbolt 的遍历`起始位置`。 

> 如果为每个Watcher 单独遍历 bbolt 并从中挑选出属于自己关注的 key ，那么性能就太差了。通过一次性遍历，处理多个 Watcher ，显然可以有效减少遍历的次数。

遍历 bblot 时会反序列化每个 mvccpb.KeyValue 结构， 判断其中的 key 是否属于 watch Group 关注的 key ，而这是由 kvsToEvents 函数完成的：

```go
// server/storage/mvcc/watchable_store.go 410行
func kvsToEvents(lg *zap.Logger, wg *watcherGroup, revs, vals [][]byte) (evs []mvccpb.Event) {
	for i, v := range vals {
		var kv mvccpb.KeyValue
		if err := kv.Unmarshal(v); err != nil {
			lg.Panic("failed to unmarshal mvccpb.KeyValue", zap.Error(err))
		}
		// 如果没有watcher关心这个key就直接返回
		if !wg.contains(string(kv.Key)) {
			continue
		}
		// 判断本次事件类型，默认初始化为 PUT
		ty := mvccpb.PUT
        // 如果有 Tombstone 标记（即key被标记删除了）就改为 DELETE 事件
		if isTombstone(revs[i]) {
			ty = mvccpb.DELETE
			// patch in mod revision so watchers won't skip
			kv.ModRevision = bytesToRev(revs[i]).main
		}
		evs = append(evs, mvccpb.Event{Kv: &kv, Type: ty})
	}
	return evs
}
```

unsynced watcher group 若同步完成后追上了最新的 revision 就将其移动到 synced watcher group 。



### syncVictimsLoop

syncVictimsLoop 主要负责**异常场景重试**。

具体如下：

```go
// server/storage/mvcc/watchable_store.go 243行
func (s *watchableStore) syncVictimsLoop() {
	defer s.wg.Done()

	for {
		for s.moveVictims() != 0 {
			// try to update all victim watchers
		}
		s.mu.RLock()
		isEmpty := len(s.victims) == 0
		s.mu.RUnlock()

		var tickc <-chan time.Time
		if !isEmpty {
			tickc = time.After(10 * time.Millisecond)
		}

		select {
		case <-tickc:
		case <-s.victimc:
		case <-s.stopc:
			return
		}
	}
}
```

每过 10ms 或者收到通知信息就进行一次循环，尝试处理因消息堆积发送异常而加入到 victimc 列表中的 watcher。 尝试再次把这些 watcher 相关 event 推送出去以清空 victimc 列表。

具体逻辑在`s.moveVictims()`方法中：

```go
// server/storage/mvcc/watchable_store.go 269行
func (s *watchableStore) moveVictims() (moved int) {
	s.mu.Lock()
    // 这里先把原victims用临时变量存一下
	victims := s.victims
    // 然后清空原victims
	s.victims = nil
	s.mu.Unlock()

	var newVictim watcherBatch
    // 直接就是一个遍历发送
	for _, wb := range victims {
		// try to send responses again
		for w, eb := range wb {
			// watcher has observed the store up to, but not including, w.minRev
			rev := w.minRev - 1
			if w.send(WatchResponse{WatchID: w.id, Events: eb.evs, Revision: rev}) {
				pendingEventsGauge.Add(float64(len(eb.evs)))
			} else {
                // 还是发送失败就临时加入到 newVictim 列表
				if newVictim == nil {
					newVictim = make(watcherBatch)
				}
				newVictim[w] = eb
				continue
			}
			moved++
		}

		// assign completed victim watchers to unsync/sync
		s.mu.Lock()
		s.store.revMu.RLock()
		curRev := s.store.currentRev
		for w, eb := range wb {
			if newVictim != nil && newVictim[w] != nil {
				// couldn't send watch response; stays victim
				continue
			}
			w.victim = false
			if eb.moreRev != 0 {
				w.minRev = eb.moreRev
			}
			// 根据 reversion 进行判断，如果追上了就添加到 syncedGroup 
            // 没追上就添加到 unsyncedGroup
			if w.minRev <= curRev {
				s.unsynced.add(w)
			} else {
				slowWatcherGauge.Dec()
				s.synced.add(w)
			}
		}
		s.store.revMu.RUnlock()
		s.mu.Unlock()
	}
    // 最后再把本次发送失败的追加到 s.victims 列表中
	if len(newVictim) > 0 {
		s.mu.Lock()
		s.victims = append(s.victims, newVictim)
		s.mu.Unlock()
	}

	return moved
}

```

逻辑比较简单，就是一个遍历尝试发送，然后把发送失败的再添加 victims。

推送成功后根据 revision 进行判断，该将 watcher 添加到哪个 group：

* 如果追上了最新 revision 就添加到 syncedGroup 
*  没追上就添加到 unsyncedGroup



### 小结

执行 put 事务操作时，利用 changes 数组记录下本次事务中修改的所有 KeyValue，最终提交事务时根据 changes 数组，生成对应的 event，然后通过 chan 发送到 sendLoop 中，最终 sendLoop 取出消息并转发给 client。

* 1）若 watcher 有事件堆积，则加入到 victimGroup，由 syncVictimsLoop 负责进行异步推送。
* 2）而 usyncedGroup 则由 syncWatchersLoop 负责进行异步推送。
* 3）推送失败则加入 victimGroup，推送成功后若追上最新 revision 则加入 syncedGroup，否则加入 unsyncedGroup。



## 3. Interval Tree

etcd 为了实现高效的事件匹配，使用了 map 来存储单个 key 和 watcher 的对应关系。

 而对于监听 key 范围、key 前缀的 watcher 则使用了 区间树来存储。

![etcd-watcher-interval-tree][etcd-watcher-interval-tree]



当收到创建 watcher 请求的时候，它会把 watcher 监听的 key 范围插入到上面的区间树中，区间的值保存了监听同样 key 范围的 watcher 集合 /watcherSet。

当产生一个事件时，etcd 首先需要从 map 查找是否有 watcher 监听了单 key，其次它还需要从区间树找出与此 key 相交的所有区间，然后从区间的值获取监听的 watcher 集合。

区间树支持快速查找一个 key 是否在某个区间内，时间复杂度 O(LogN)，因此 etcd 基于 map 和区间树实现了 watcher 与事件快速匹配，具备良好的扩展性。



etcd 中的相关实现如下：

```go
// pkg/adt/interval_tree.go 185行
type IntervalTree interface {
	// Insert adds a node with the given interval into the tree.
	Insert(ivl Interval, val interface{})
	// Delete removes the node with the given interval from the tree, returning
	// true if a node is in fact removed.
	Delete(ivl Interval) bool
	// Len gives the number of elements in the tree.
	Len() int
	// Height is the number of levels in the tree; one node has height 1.
	Height() int
	// MaxHeight is the expected maximum tree height given the number of nodes.
	MaxHeight() int
	// Visit calls a visitor function on every tree node intersecting the given interval.
	// It will visit each interval [x, y) in ascending order sorted on x.
	Visit(ivl Interval, ivv IntervalVisitor)
	// Find gets the IntervalValue for the node matching the given interval
	Find(ivl Interval) *IntervalValue
	// Intersects returns true if there is some tree node intersecting the given interval.
	Intersects(iv Interval) bool
	// Contains returns true if the interval tree's keys cover the entire given interval.
	Contains(ivl Interval) bool
	// Stab returns a slice with all elements in the tree intersecting the interval.
	Stab(iv Interval) []*IntervalValue
	// Union merges a given interval tree into the receiver.
	Union(inIvt IntervalTree, ivl Interval)
}
```

具体实现这里就不分析了，是基于红黑树实现了。



## 4. 总结



Watch 特性主要分为 serverWatchStream 和 MVCC 两部分。

**serverWatchStream**

serverWatchStream 中包括 sendLoop 和 recvLoop 两个处理循环。

sendLoop 主要接收两种消息。

* 1） watchStream 推送的 event 消息，sendLoop 收到后并转发给 client
* 2）recvLoop 发来的 control 消息，包括watcher的create或者cancel，用以维护活跃 watcher 列表



**recvLoop** 则负责接收 client 的请求：

*  1）接收 client 的create/cancel watcher 消息，并调用 watchStream 的对应方法 create/cancel watcher
* 2）最后通过 ctlStream 和 sendLoop 进行通信，以维护 sendLoop 中的活跃 watchID 列表。



**MVCC模块**

MVCC中的核心模块则是 watchableStore，**它通过将 watcher 划分为 synced/unsynced/victim 三类，将问题进行了分解**，并通过多个后台异步循环 goroutine 负责不同场景下的事件推送，提供了各类异常等场景下的 Watch 事件重试机制，尽力确保变更事件不丢失、按逻辑时钟版本号顺序推送给 client。



**具体流程**

* 1）在 MVCC 的 put 事务中，它会将本次修改的后的 mvccpb.KeyValue 保存到一个 changes 数组中。

* 2）在 put 事务结束时调用的 End 方法中，它会将 KeyValue 转换成 Event 事件，然后调用 watchableStore.notify 函数。

* 3）notify 会匹配出监听过此 key 并处于 synced watcherGroup 中的 watcher，同时事件中的版本号要大于等于 watcher 监听的最小版本号，才能将事件发送到此 watcher 的事件 channel 中。

* 4）serverWatchStream 的 sendLoop goroutine 监听到 channel 消息后，读出消息立即推送给 client，至此，完成一个最新修改事件推送。



**watcher 状态转换**

拆分了 3 种不同的 watcherGroup 以执行不同场景下的事件推送。

为了保证效率和事件顺序，notify 中只处理 syncedGroup。

* 当出现事件堆积，导致 notify 中推送失败时，会从 syncedGroup 中移动到  victimGroup。

* syncVictimLoop 则重试 victimGroup 中的 watcher，发送成功后根据 revision 判断添加到哪个 group：

  * 已经追上最新的 revision 则添加到 syncedGroup 

  * 否则添加到 usyncedGroup

* syncWatchersLoop 则定时推送 usyncedGroup 中的 watcher，推送完成后若追上最新 revision 则将其移动到 syncedGroup 。



**高效匹配**

etcd 基于 map 和区间树数实现了 watcher 与事件快速匹配，保障了大规模场景下的 Watch 机制性能和读写稳定性。



最后再贴一下流程图，相信到这里的话，应该能够看懂了。

![etcd-v3-watch-arch][etcd-v3-watch-arch]

[etcd-v3-watch-arch]:https://github.com/lixd/blog/raw/master/images/etcd/watch/etcd-v3-watch-arch.webp
[etcd-watcher-state-change]:https://github.com/lixd/blog/raw/master/images/etcd/watch/watcher%20%E7%8A%B6%E6%80%81%E8%BD%AC%E6%8D%A2%E5%85%B3%E7%B3%BB%E5%9B%BE.png
[etcd-watcher-interval-tree]:https://github.com/lixd/blog/raw/master/images/etcd/watch/etcd-watcher-interval-tree.png