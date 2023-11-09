---
title: "etcd教程(十三)---watch 机制源码分析（上）"
description: "etcd watch 机制具体实现及源码分析"
date: 2022-01-21
draft: false
categories: ["etcd"]
tags: ["etcd"]
---

本文主要通过源码分析了 etcd v3 版本 watch 机制的具体实现（上篇）。

<!--more-->



## 1. 概述

> 由于本期内容比较多，分成了上下两篇。
>
> [etcd教程(十三)---watch 机制源码分析（上）](https://www.lixueduan.com/post/etcd/13-watch-analyze-1/)
>
> [etcd教程(十四)---watch 机制源码分析（下）](https://www.lixueduan.com/post/etcd/14-watch-analyze-2/)

为了避免客户端的反复轮询， etcd 提供了 watch 机制。客户端 watch 一系列 key，当这些被 watch 的 key 更新时， etcd 就会通知客户端。 



本文主要为源码分析，，若对etcd watch 机制不熟悉的朋友可以先看下 [etcd教程(五)---watch机制原理分析](https://www.lixueduan.com/post/etcd/05-watch/)。

> 以下分析基本 etcd v3.5.1 版本。



### 大致流程

整体流程如下图所示，可以分为两个部分:

* 1）创建 watcher
* 2）watch 事件推送

![etcd-v3-watch-arch][etcd-v3-watch-arch]

**1）创建 watcher**

* 发起一个 watch key 请求的时候，etcd 的 gRPCWatchServer 收到 watch 请求后，会创建一个 serverWatchStream, 它负责接收 client 的 gRPC Stream 的 create/cancel watcher 请求 (recvLoop goroutine)，并将从 MVCC 模块接收的 Watch 事件转发给 client(sendLoop goroutine)。
* 当 serverWatchStream 收到 create watcher 请求后，serverWatchStream 会调用 MVCC 模块的 WatchStream 子模块分配一个 watcher id，并将 watcher 注册到 MVCC 的 WatchableKV 模块。
* 在 etcd 启动的时候，WatchableKV 模块会运行 syncWatchersLoop 和 syncVictimsLoop goroutine，分别负责不同场景下的事件推送，它们也是 Watch 特性可靠性的核心之一。

**2）watch 事件推送**

* 当你创建完成 watcher 后，此时你执行 put hello 修改操作时，请求经过 KVServer、Raft 模块后 Apply 到状态机时，在 MVCC 的 put 事务中，它会将本次修改的后的 mvccpb.KeyValue 保存到一个 changes 数组中。
* 在 put 事务结束时，它会将 KeyValue 转换成 Event 事件，然后回调 watchableStore.notify 函数（如下精简代码所示）。notify 会匹配出监听过此 key 并处于 synced watcherGroup 中的 watcher，同时事件中的版本号要大于等于 watcher 监听的最小版本号，才能将事件发送到此 watcher 的事件 channel 中。
* serverWatchStream 的 sendLoop goroutine 监听到 channel 消息后，读出消息立即推送给 client，至此，完成一个最新修改事件推送。



根据流程图可知，watch 机制分为图中的蓝色和橙色两部分：

* 处理 WatchRequest 和发送 WatchResponse 的姑且叫做 serverWatchStream 模块。
* 处理具体 PUT 操作，并推送事件的 MVCC 模块。

> 注：etcd 中并没有serverWatchStream这么一个模块，这部分逻辑是在 server 中的，本文暂且称这部分逻辑为 serverWatchStream 模块。

下面就从这两部分进行分析



### watcher 状态划分

etcd 中根据不同场景，对问题进行了分解，将 watcher 按场景分类，实现了轻重分离、低耦合。

具体如下：

* **synced watcher**，顾名思义，表示此类 watcher 监听的数据都已经同步完毕，在等待新的变更。
  * 如果你创建的 watcher 未指定版本号 (默认 0)、或指定的版本号大于 etcd sever 当前最新的版本号 (currentRev)，那么它就会保存到 synced watcherGroup 中。

* **unsynced watcher**，表示此类 watcher 监听的数据还未同步完成，落后于当前最新数据变更，正在努力追赶。
  * 如果你创建的 watcher 指定版本号小于 etcd server 当前最新版本号，那么它就会保存到 unsynced watcherGroup 中。

* **victim watcher**：表示 watcher 存在事件堆积导致推送异常 ，需要由异步任务执行重试操作。

从以上介绍中，我们可以将可靠的事件推送机制拆分成`最新事件推送`、`异常场景重试`、`历史事件推送`三个子问题来进行分析。

watcher 状态转换关系如下图所示：

![etcd-watcher-state-change][etcd-watcher-state-change]



## 2. Server

###  概述

etcd server 启动时会注册多个 gRPC server，watch server 也是其中一个：

```go
// server/etcdserver/api/v3rpc/grpc.go 39 行
func Server(s *etcdserver.EtcdServer, tls *tls.Config, interceptor grpc.UnaryServerInterceptor, gopts ...grpc.ServerOption) *grpc.Server {
	grpcServer := grpc.NewServer(append(opts, gopts...)...)
	// 省略无关逻辑
    // 注册 WatchServer
	pb.RegisterWatchServer(grpcServer, NewWatchServer(s))

	return grpcServer
}
```

WatchServer 只用于处理 Watch 方法：

```go
type WatchServer interface {
	Watch(Watch_WatchServer) error
}
```



然后是 etcd 对外提供的 Watch 接口的定义：

```protobuf
// api/etcdserverpb/rpc.proto 66 行
service Watch {
  // Watch watches for events happening or that have happened. Both input and output
  // are streams; the input stream is for creating and canceling watchers and the output
  // stream sends events. One watch RPC can watch on multiple key ranges, streaming events
  // for several watches at once. The entire event history can be watched starting from the
  // last compaction revision.
  rpc Watch(stream WatchRequest) returns (stream WatchResponse) {
      option (google.api.http) = {
        post: "/v3/watch"
        body: "*"
    }; 
  }
}
```

etcd v3 使用的是 [gRPC-Gateway](https://github.com/grpc-ecosystem/grpc-gateway) 以同时提供 RPC 和 HTTP 服务，不了解的朋友可以看一下 [gRPC(Go)教程(七)---利用Gateway同时提供HTTP和RPC服务](https://www.lixueduan.com/post/grpc/07-grpc-gateway/)。

> 实际上 gRPC-Gateway 这个库就是因为 etcd 更新到 v3 时需要同时提供 RPC 和 HTTP 服务而诞生的。



Watch 接口的大致逻辑为：

当你通过 etcdctl 或 API 发起一个 watch key 请求的时候，etcd 的 gRPCWatchServer 收到 watch 请求后，会创建一个 serverWatchStream, 它负责接收 client 的 gRPC Stream 的 create/cancel watcher 请求 (recvLoop goroutine)，并将从 MVCC 模块接收的 Watch 事件转发给 client(sendLoop goroutine)。

> 注：并不是每次调用 watch 就会创建一个 serverWatchStream，而是每个 gRPC Stream 只会创建一个，这个创建出来的 serverWatchStream 会接管这个 gRPC Stream 上的所有 watcher。
>
> 而一个连接上又可以创建多个 gRPC Stream，这也就是为什么 etcd v3的 watch 在资源占用上比 v2 有大幅降低。

具体如下图所示：

 ![etcd-v3-watch-model][etcd-v3-watch-model]

### Watch

具体实现如下：

```go
// server/etcdserver/api/v3rpc/watch.go 152行
func (ws *watchServer) Watch(stream pb.Watch_WatchServer) (err error) {
	sws := serverWatchStream{
		lg: ws.lg,

		clusterID: ws.clusterID,
		memberID:  ws.memberID,

		maxRequestBytes: ws.maxRequestBytes,

		sg:        ws.sg,
		watchable: ws.watchable,
		ag:        ws.ag,

		gRPCStream:  stream,
		watchStream: ws.watchable.NewWatchStream(),
		// chan for sending control response like watcher created and canceled.
		ctrlStream: make(chan *pb.WatchResponse, ctrlStreamBufLen),

		progress: make(map[mvcc.WatchID]bool),
		prevKV:   make(map[mvcc.WatchID]bool),
		fragment: make(map[mvcc.WatchID]bool),

		closec: make(chan struct{}),
	}

	sws.wg.Add(1)
    // 第一个 goroutine sendLoop 
	go func() {
		sws.sendLoop()
		sws.wg.Done()
	}()

	errc := make(chan error, 1)
    // 第二个 goroutine recvLoop
	go func() {
		if rerr := sws.recvLoop(); rerr != nil {
			if isClientCtxErr(stream.Context().Err(), rerr) {
				sws.lg.Debug("failed to receive watch request from gRPC stream", zap.Error(rerr))
			} else {
				sws.lg.Warn("failed to receive watch request from gRPC stream", zap.Error(rerr))
				streamFailures.WithLabelValues("receive", "watch").Inc()
			}
			errc <- rerr
		}
	}()


	select {
	case err = <-errc:
		if err == context.Canceled {
			err = rpctypes.ErrGRPCWatchCanceled
		}
		close(sws.ctrlStream)
	case <-stream.Context().Done():
		err = stream.Context().Err()
		if err == context.Canceled {
			err = rpctypes.ErrGRPCWatchCanceled
		}
	}

	sws.close()
	return err
}
```

和流程图一致，创建 serverWatchStream 并分别启动了sendLoop 和 recvLoop。

接下来就分析这两个 Loop。



## 3. sendLoop 

sendLoop 主要负责把从 MVCC 模块接收的 Watch 事件转发给 client。

具体如下：

```go
// server/etcdserver/api/v3rpc/watch.go 355行
func (sws *serverWatchStream) sendLoop() {
	// watch ids that are currently active
	ids := make(map[mvcc.WatchID]struct{})
	// watch responses pending on a watch id creation message
	pending := make(map[mvcc.WatchID][]*pb.WatchResponse)

	interval := GetProgressReportInterval()
	progressTicker := time.NewTicker(interval)

	// 省略部分逻辑
	for {
		select {
		case wresp, ok := <-sws.watchStream.Chan():
			if !ok {
				return
			}

			evs := wresp.Events
			events := make([]*mvccpb.Event, len(evs))
			sws.mu.RLock()
			needPrevKV := sws.prevKV[wresp.WatchID]
			sws.mu.RUnlock()
			for i := range evs {
				events[i] = &evs[i]
				if needPrevKV && !IsCreateEvent(evs[i]) {
					opt := mvcc.RangeOptions{Rev: evs[i].Kv.ModRevision - 1}
					r, err := sws.watchable.Range(context.TODO(), evs[i].Kv.Key, nil, opt)
					if err == nil && len(r.KVs) != 0 {
						events[i].PrevKv = &(r.KVs[0])
					}
				}
			}

			canceled := wresp.CompactRevision != 0
			wr := &pb.WatchResponse{
				Header:          sws.newResponseHeader(wresp.Revision),
				WatchId:         int64(wresp.WatchID),
				Events:          events,
				CompactRevision: wresp.CompactRevision,
				Canceled:        canceled,
			}

			if _, okID := ids[wresp.WatchID]; !okID {
				// buffer if id not yet announced
				wrs := append(pending[wresp.WatchID], wr)
				pending[wresp.WatchID] = wrs
				continue
			}

			mvcc.ReportEventReceived(len(evs))

			sws.mu.RLock()
			fragmented, ok := sws.fragment[wresp.WatchID]
			sws.mu.RUnlock()

			var serr error
			if !fragmented && !ok {
				serr = sws.gRPCStream.Send(wr)
			} else {
				serr = sendFragments(wr, sws.maxRequestBytes, sws.gRPCStream.Send)
			}

			if serr != nil {
				if isClientCtxErr(sws.gRPCStream.Context().Err(), serr) {
					sws.lg.Debug("failed to send watch response to gRPC stream", zap.Error(serr))
				} else {
					sws.lg.Warn("failed to send watch response to gRPC stream", zap.Error(serr))
					streamFailures.WithLabelValues("send", "watch").Inc()
				}
				return
			}

			sws.mu.Lock()
			if len(evs) > 0 && sws.progress[wresp.WatchID] {
				// elide next progress update if sent a key update
				sws.progress[wresp.WatchID] = false
			}
			sws.mu.Unlock()

		case c, ok := <-sws.ctrlStream:
			if !ok {
				return
			}

			if err := sws.gRPCStream.Send(c); err != nil {
				if isClientCtxErr(sws.gRPCStream.Context().Err(), err) {
					sws.lg.Debug("failed to send watch control response to gRPC stream", zap.Error(err))
				} else {
					sws.lg.Warn("failed to send watch control response to gRPC stream", zap.Error(err))
					streamFailures.WithLabelValues("send", "watch").Inc()
				}
				return
			}

			// track id creation
			wid := mvcc.WatchID(c.WatchId)
			if c.Canceled {
				delete(ids, wid)
				continue
			}
			if c.Created {
				// flush buffered events
				ids[wid] = struct{}{}
				for _, v := range pending[wid] {
					mvcc.ReportEventReceived(len(v.Events))
					if err := sws.gRPCStream.Send(v); err != nil {
						if isClientCtxErr(sws.gRPCStream.Context().Err(), err) {
							sws.lg.Debug("failed to send pending watch response to gRPC stream", zap.Error(err))
						} else {
							sws.lg.Warn("failed to send pending watch response to gRPC stream", zap.Error(err))
							streamFailures.WithLabelValues("send", "watch").Inc()
						}
						return
					}
				}
				delete(pending, wid)
			}

		case <-progressTicker.C:
			sws.mu.Lock()
			for id, ok := range sws.progress {
				if ok {
					sws.watchStream.RequestProgress(id)
				}
				sws.progress[id] = true
			}
			sws.mu.Unlock()

		case <-sws.closec:
			return
		}
	}
}

```

代码比较多，先看个大概流程：

```go
	for {
		select {
		case wresp, ok := <-sws.watchStream.Chan():
		case c, ok := <-sws.ctrlStream:
		case <-progressTicker.C:
		case <-sws.closec:
		}
	}
```

这样就比较清晰了，for + select 的常规套路。

4个 case 中，最后一个 case 为 channel 关闭时的逻辑：

```go
		case <-sws.closec:
			return
```

channel 关闭后就直接退出循环，比较好理解。



倒数第二个 case 为一个定时器，主要用于维护 watcher 的进度（可以看做是类似心跳的东西）。

```go
		case <-progressTicker.C:
			sws.mu.Lock()
			for id, ok := range sws.progress {
				if ok {
					sws.watchStream.RequestProgress(id)
				}
				sws.progress[id] = true
			}
			sws.mu.Unlock()
```

因为如果 watch 的 key没有任何变化，那么 watcher 就不会收到任何消息，因为没有新的事件产生。因此 etcd 中 添加了 progress request，定时发送一个进度信息给 watcher，让 watcher 在没有事件产生的时候也能收到一些消息。

```go
// 如果有新的 event 产生，就把 progress 改成 fasle 以忽略掉下次进度更新消息的发送
if len(evs) > 0 && sws.progress[wresp.WatchID] {
    sws.progress[wresp.WatchID] = false
}
```

具体如下：

```go
func (s *watchableStore) progress(w *watcher) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := s.synced.watchers[w]; ok {
		w.send(WatchResponse{WatchID: w.id, Revision: s.rev()})
		// If the ch is full, this watcher is receiving events.
		// We do not need to send progress at all.
	}
}
```

可以看到，只是会把当前收到的 Revision 发送过去，并不包含任何 event。

查了下，发送这个功能差不多也是为 Kubernetes 服务的，具体见[#9855](https://github.com/etcd-io/etcd/issues/9855)和[#73585](https://github.com/kubernetes/kubernetes/issues/73585)。



第一个 case 才是 sendLoop 的核心逻辑：

```go
	for {
		select {
            // 从 chan 中取出 event 
		case wresp, ok := <-sws.watchStream.Chan():
			if !ok {
				return
			}

			evs := wresp.Events
			events := make([]*mvccpb.Event, len(evs))
			sws.mu.RLock()
			needPrevKV := sws.prevKV[wresp.WatchID]
			sws.mu.RUnlock()
			for i := range evs {
				events[i] = &evs[i]
				if needPrevKV && !IsCreateEvent(evs[i]) {
					opt := mvcc.RangeOptions{Rev: evs[i].Kv.ModRevision - 1}
					r, err := sws.watchable.Range(context.TODO(), evs[i].Kv.Key, nil, opt)
					if err == nil && len(r.KVs) != 0 {
						events[i].PrevKv = &(r.KVs[0])
					}
				}
			}

			canceled := wresp.CompactRevision != 0
			wr := &pb.WatchResponse{
				Header:          sws.newResponseHeader(wresp.Revision),
				WatchId:         int64(wresp.WatchID),
				Events:          events,
				CompactRevision: wresp.CompactRevision,
				Canceled:        canceled,
			}
			// 如果 watcherID 还没注册到 ids 列表中，就先把这个 event 缓存起来
			if _, okID := ids[wresp.WatchID]; !okID {
				// buffer if id not yet announced
				wrs := append(pending[wresp.WatchID], wr)
				pending[wresp.WatchID] = wrs
				continue
			}

			mvcc.ReportEventReceived(len(evs))

			sws.mu.RLock()
			fragmented, ok := sws.fragment[wresp.WatchID]
			sws.mu.RUnlock()

			var serr error
            // 然后发送给 client
			if !fragmented && !ok {
				serr = sws.gRPCStream.Send(wr)
			} else {
				serr = sendFragments(wr, sws.maxRequestBytes, sws.gRPCStream.Send)
			}

			if serr != nil {
				if isClientCtxErr(sws.gRPCStream.Context().Err(), serr) {
					sws.lg.Debug("failed to send watch response to gRPC stream", zap.Error(serr))
				} else {
					sws.lg.Warn("failed to send watch response to gRPC stream", zap.Error(serr))
					streamFailures.WithLabelValues("send", "watch").Inc()
				}
				return
			}

			sws.mu.Lock()
			if len(evs) > 0 && sws.progress[wresp.WatchID] {
				// elide next progress update if sent a key update
				sws.progress[wresp.WatchID] = false
			}
			sws.mu.Unlock()
```

一个大的 for 循环不断从 watchStream chan 中获取 event，并转发给 client。如果对应的 watcherID 还有注册到 ids 列表中就先将这些 event 缓存起来。

> 因为是先在 recvLoop 中创建了 watcher，然后通过消息异步将 watchID 注册到 sendLoop 的 ids 列表中的，所以可能会出现 event 产生了但是 id 还没注册的情况。

根据流程图可以知道，这个 watchStream.Chan() 是 MVCC 模块中的，当 WatchableKV 有更新时会通知 WatchStream，然后 sendLoop 取出消息并发送给 client。



第二个 case 为控制逻辑：

```go
		case c, ok := <-sws.ctrlStream:
			if !ok {
				return
			}

			if err := sws.gRPCStream.Send(c); err != nil {
				if isClientCtxErr(sws.gRPCStream.Context().Err(), err) {
					sws.lg.Debug("failed to send watch control response to gRPC stream", zap.Error(err))
				} else {
					sws.lg.Warn("failed to send watch control response to gRPC stream", zap.Error(err))
					streamFailures.WithLabelValues("send", "watch").Inc()
				}
				return
			}

			// track id creation
			wid := mvcc.WatchID(c.WatchId)
			// 如果是被取消了，就从ids中移除
			if c.Canceled {
				delete(ids, wid)
				continue
			}
			// 如果创建则把 watcherID 注册到 ids 列表中，然后把缓存的event都发送到 client
			if c.Created {
				// flush buffered events
				ids[wid] = struct{}{}
				for _, v := range pending[wid] {
					mvcc.ReportEventReceived(len(v.Events))
					if err := sws.gRPCStream.Send(v); err != nil {
						if isClientCtxErr(sws.gRPCStream.Context().Err(), err) {
							sws.lg.Debug("failed to send pending watch response to gRPC stream", zap.Error(err))
						} else {
							sws.lg.Warn("failed to send pending watch response to gRPC stream", zap.Error(err))
							streamFailures.WithLabelValues("send", "watch").Inc()
						}
						return
					}
				}
				delete(pending, wid)
			}
```

主要包括了 watcher 的 create 和 cancel。

* cancel 则是将 watcherID 从 ids 列表中移除
* create 则是将 watcherID 注册到  ids 列表中，并把之前缓存的消息（如果有的话）全部发送给 client。

这个控制逻辑消息由 recvLoop 产生，recvLoop 收到用户发送的 create 或者 cancel 请求后先调用 watchStream   的方法  create 或者 cancel watcher，然后在通过 chan 异步传递到 sendLoop 中，以维护 sendLoop 中的活跃watcherID 列表。



## 4. recvLoop

recvLoop 主要负责接收 client 的 create/cancel watcher 请求。

具体如下：

```go
// server/etcdserver/api/v3rpc/watch.go 238行
func (sws *serverWatchStream) recvLoop() error {
	for {
		req, err := sws.gRPCStream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		switch uv := req.RequestUnion.(type) {
		case *pb.WatchRequest_CreateRequest:
			if uv.CreateRequest == nil {
				break
			}

			creq := uv.CreateRequest
			if len(creq.Key) == 0 {
				creq.Key = []byte{0}
			}
			if len(creq.RangeEnd) == 0 {
				creq.RangeEnd = nil
			}
			if len(creq.RangeEnd) == 1 && creq.RangeEnd[0] == 0 {
				creq.RangeEnd = []byte{}
			}

			if !sws.isWatchPermitted(creq) {
				wr := &pb.WatchResponse{
					Header:       sws.newResponseHeader(sws.watchStream.Rev()),
					WatchId:      creq.WatchId,
					Canceled:     true,
					Created:      true,
					CancelReason: rpctypes.ErrGRPCPermissionDenied.Error(),
				}

				select {
				case sws.ctrlStream <- wr:
					continue
				case <-sws.closec:
					return nil
				}
			}

			filters := FiltersFromRequest(creq)

			wsrev := sws.watchStream.Rev()
			rev := creq.StartRevision
			if rev == 0 {
				rev = wsrev + 1
			}
			id, err := sws.watchStream.Watch(mvcc.WatchID(creq.WatchId), creq.Key, creq.RangeEnd, rev, filters...)
			if err == nil {
				sws.mu.Lock()
				if creq.ProgressNotify {
					sws.progress[id] = true
				}
				if creq.PrevKv {
					sws.prevKV[id] = true
				}
				if creq.Fragment {
					sws.fragment[id] = true
				}
				sws.mu.Unlock()
			}
			wr := &pb.WatchResponse{
				Header:   sws.newResponseHeader(wsrev),
				WatchId:  int64(id),
				Created:  true,
				Canceled: err != nil,
			}
			if err != nil {
				wr.CancelReason = err.Error()
			}
			select {
			case sws.ctrlStream <- wr:
			case <-sws.closec:
				return nil
			}

		case *pb.WatchRequest_CancelRequest:
			if uv.CancelRequest != nil {
				id := uv.CancelRequest.WatchId
				err := sws.watchStream.Cancel(mvcc.WatchID(id))
				if err == nil {
					sws.ctrlStream <- &pb.WatchResponse{
						Header:   sws.newResponseHeader(sws.watchStream.Rev()),
						WatchId:  id,
						Canceled: true,
					}
					sws.mu.Lock()
					delete(sws.progress, mvcc.WatchID(id))
					delete(sws.prevKV, mvcc.WatchID(id))
					delete(sws.fragment, mvcc.WatchID(id))
					sws.mu.Unlock()
				}
			}
		case *pb.WatchRequest_ProgressRequest:
			if uv.ProgressRequest != nil {
				sws.ctrlStream <- &pb.WatchResponse{
					Header:  sws.newResponseHeader(sws.watchStream.Rev()),
					WatchId: -1, // response is not associated with any WatchId and will be broadcast to all watch channels
				}
			}
		default:
			continue
		}
	}
}
```

同样也是先看下大致逻辑：

```go
	for {
        req, err := sws.gRPCStream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
        switch uv := req.RequestUnion.(type) {
		case *pb.WatchRequest_CreateRequest:
        case *pb.WatchRequest_CancelRequest:
		case *pb.WatchRequest_ProgressRequest:
		default:
			continue
    }
```

可以看出主要是接收 client 的请求，然后根据请求类型做不同处理。



create 请求：

```go
		case *pb.WatchRequest_CreateRequest:
			if uv.CreateRequest == nil {
				break
			}
			// 组装参数
			creq := uv.CreateRequest
			if len(creq.Key) == 0 {
				// \x00 is the smallest key
				creq.Key = []byte{0}
			}
			if len(creq.RangeEnd) == 0 {
				// force nil since watchstream.Watch distinguishes
				// between nil and []byte{} for single key / >=
				creq.RangeEnd = nil
			}
			if len(creq.RangeEnd) == 1 && creq.RangeEnd[0] == 0 {
				// support  >= key queries
				creq.RangeEnd = []byte{}
			}
			// 校验是否能够执行 watch 请求，主要是判断用户有没有操作这个key的权限
			if !sws.isWatchPermitted(creq) {
                // 如果没有权限就发送一个同时携带 Created 和 Canceled 标记的消息给前面的 sendLoop
				wr := &pb.WatchResponse{
					Header:       sws.newResponseHeader(sws.watchStream.Rev()),
					WatchId:      creq.WatchId,
					Canceled:     true,
					Created:      true,
					CancelReason: rpctypes.ErrGRPCPermissionDenied.Error(),
				}

				select {
				case sws.ctrlStream <- wr:
					continue
				case <-sws.closec:
					return nil
				}
			}
			// 若有权限则发送一个带 Created  标记的消息给前面的 sendLoop，以创建 watcher
			filters := FiltersFromRequest(creq)

			wsrev := sws.watchStream.Rev()
			rev := creq.StartRevision
			if rev == 0 {
				rev = wsrev + 1
			}
			// 创建一个 watcher，并返回其 id
			id, err := sws.watchStream.Watch(mvcc.WatchID(creq.WatchId), creq.Key, creq.RangeEnd, rev, filters...)
			if err == nil {
				sws.mu.Lock()
				if creq.ProgressNotify {
					sws.progress[id] = true
				}
				if creq.PrevKv {
					sws.prevKV[id] = true
				}
				if creq.Fragment {
					sws.fragment[id] = true
				}
				sws.mu.Unlock()
			}
			wr := &pb.WatchResponse{
				Header:   sws.newResponseHeader(wsrev),
				WatchId:  int64(id),
				Created:  true,
				Canceled: err != nil,
			}
			if err != nil {
				wr.CancelReason = err.Error()
			}
			select {
			case sws.ctrlStream <- wr:
			case <-sws.closec:
				return nil
			}
```

解析请求，组装参数和权限校验，然后调用 watchStream 的方法创建一个 watcher，并发送消息给 sendLoop 使其将 watcherID 注册到自己的 watcherID 列表中。

> 注意这里调用`sws.watchStream.Watch()`就已经创建好 watcher 了，通过消息发送到 sendLoop 只是为了将 watcherID 注册到 sendLoop 的 ids 列表中而已。
>
> 因为 sendLoop 只会把关注在自己的 ids 列表中的 watcher 



```go
// server/storage/mvcc/watcher.go 108行
func (ws *watchStream) Watch(id WatchID, key, end []byte, startRev int64, fcs ...FilterFunc) (WatchID, error) {
	if len(end) != 0 && bytes.Compare(key, end) != -1 {
		return -1, ErrEmptyWatcherRange
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()
	if ws.closed {
		return -1, ErrEmptyWatcherRange
	}

	if id == AutoWatchID {
		for ws.watchers[ws.nextID] != nil {
			ws.nextID++
		}
		id = ws.nextID
		ws.nextID++
	} else if _, ok := ws.watchers[id]; ok {
		return -1, ErrWatcherDuplicateID
	}
	// 可以看到这里直接调用了 MVCC模块中的watchable 的 watch 方法来创建 watcher 了
	w, c := ws.watchable.watch(key, end, startRev, id, ws.ch, fcs...)

	ws.cancels[id] = c
	ws.watchers[id] = w
	return id, nil
}
```

这里就已经在 MVCC 中创建了 watcher，并存到 watchStream.watchers 中。

具体 watch 实现如下：

```go
// server/storage/mvcc/watchable_store.go 106行
func (s *watchableStore) watch(key, end []byte, startRev int64, id WatchID, ch chan<- WatchResponse, fcs ...FilterFunc) (*watcher, cancelFunc) {
	wa := &watcher{
		key:    key,
		end:    end,
		minRev: startRev,
		id:     id,
		ch:     ch,
		fcs:    fcs,
	}

	s.mu.Lock()
	s.revMu.RLock()
	synced := startRev > s.store.currentRev || startRev == 0
	if synced {
		wa.minRev = s.store.currentRev + 1
		if startRev > wa.minRev {
			wa.minRev = startRev
		}
		s.synced.add(wa)
	} else {
		slowWatcherGauge.Inc()
		s.unsynced.add(wa)
	}
	s.revMu.RUnlock()
	s.mu.Unlock()

	watcherGauge.Inc()

	return wa, func() { s.cancelWatcher(wa) }
}
```



Cancel 请求：

```go
		case *pb.WatchRequest_CancelRequest:
			if uv.CancelRequest != nil {
				id := uv.CancelRequest.WatchId
				err := sws.watchStream.Cancel(mvcc.WatchID(id))
				if err == nil {
					sws.ctrlStream <- &pb.WatchResponse{
						Header:   sws.newResponseHeader(sws.watchStream.Rev()),
						WatchId:  id,
						Canceled: true,
					}
					sws.mu.Lock()
					delete(sws.progress, mvcc.WatchID(id))
					delete(sws.prevKV, mvcc.WatchID(id))
					delete(sws.fragment, mvcc.WatchID(id))
					sws.mu.Unlock()
				}
			}
```

cancel 请求则比较简单， 先调用 watchStream.Cancel() 把 watcher cancel 掉，然后从 serverWatchStream 的几个 map 中移除掉对应数据，并发送一个带 Canceled 标记的消息给 sendLoop 以同步watcherID列表。

具体 watchStream.Cancel 实现如下：

```go
func (ws *watchStream) Cancel(id WatchID) error {
	ws.mu.Lock()
	cancel, ok := ws.cancels[id]
	w := ws.watchers[id]
	ok = ok && !ws.closed
	ws.mu.Unlock()

	if !ok {
		return ErrWatcherNotExist
	}
	cancel()

	ws.mu.Lock()
	if ww := ws.watchers[id]; ww == w {
		delete(ws.cancels, id)
		delete(ws.watchers, id)
	}
	ws.mu.Unlock()

	return nil
}
```

同样是，从列表中把对应的 id 移除。



progress 请求：

```go
		case *pb.WatchRequest_ProgressRequest:
			if uv.ProgressRequest != nil {
				sws.ctrlStream <- &pb.WatchResponse{
					Header:  sws.newResponseHeader(sws.watchStream.Rev()),
					WatchId: -1, // response is not associated with any WatchId and will be broadcast to all watch channels
				}
			}
```

这里就只是更新进度，不带任何标记，只是借助 sendLoop 发送一个进度消息发送给 client。



## 5. 小结

**sendLoop** 主要接收两种消息：

* 1） watchStream 推送的 event 消息，sendLoop 收到后并转发给 client
* 2）recvLoop 发来的 control 消息，包括watcher的create或者cancel，用以维护活跃 watcher 列表



**recvLoop** 则负责接收 client 的请求：

*  1）接收 client 的create/cancel watcher 消息，并调用 watchStream 的对应方法 create/cancel watcher
* 2）最后通过 ctlStream 和 sendLoop 进行通信，以维护 sendLoop 中的活跃 watchID 列表。

> 至此上篇结束，剩下的部分在下篇 [etcd教程(十四)---watch 机制源码分析（下）](https://www.lixueduan.com/post/etcd/14-watch-analyze-2/)。




[etcd-v3-watch-model]:https://github.com/lixd/blog/raw/master/images/etcd/watch/etcd-v3-watch-model.webp
[etcd-v3-watch-arch]:https://github.com/lixd/blog/raw/master/images/etcd/watch/etcd-v3-watch-arch.webp
[etcd-watcher-state-change]:https://github.com/lixd/blog/raw/master/images/etcd/watch/watcher%20%E7%8A%B6%E6%80%81%E8%BD%AC%E6%8D%A2%E5%85%B3%E7%B3%BB%E5%9B%BE.png