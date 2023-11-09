---
title: "etcd教程(十五)---leader选取源码分析"
description: "etcd raft 算法实现之leader选取源码分析"
date: 2022-03-05
draft: false
categories: ["etcd"]
tags: ["etcd"]
---

本文主要通过源码分析了 etcd 中 leader选举的具体实现。

<!--more-->

raft 是针对 paxos 的简化版本，拆解为三个**核心问题**：

* 1）Leader 选举；
* 2）日志复制；
* 3）正确性保证；

这里简单回顾以下 Leader 选举的逻辑。

> 更多 raft 信息可以参考这两篇文章
>
> [Raft 算法概述](https://www.lixueduan.com/post/distributed/raft/)
>
> [etcd教程(九)---Raft 算法具体实现](https://www.lixueduan.com/post/etcd/09-raft/)



  在 raft 中，一个节点任一时刻都会处于以下三个状态之一：

* Leader
  * leader 处理所有来自客户端的请求(如果客户端访问 follower，会把请求重定向到 leader)
* Follower 
  * follower 是消极的，他们不会主动发出请求而仅仅对来自 leader 和 candidate 的请求作出回应。
* Candidate
  * Candidate 状态用来选举出一个 leader。

在正常情况下会只有一个 leader，其他节点都是 follower。

**Raft 使用心跳机制来触发 leader 选举**，具体状态转换流程如图：

![leader-election][leader-election]

可以看到：

* 所有节点启动时都是follower状态；
* 在一段时间内如果没有收到来自 leader 的心跳，从 follower 切换到 candidate，且 term+1并发起选举；
* 如果收到 majority 的投票（含自己的一票）则切换到 leader 状态；
* 如果发现其他节点 term 比自己更新，则主动切换到 follower。

> 以下分析记录 etcd v3.5.1
>
> 为了便于阅读，省略了无关代码，只保留主干部分。

接下来就看下 etcd 中是怎么实现的吧。



## 1. 节点初始化

```go
// raft/raft.go 318行
func newRaft(c *Config) *raft {
	r := &raft{
		id:                        c.ID,
		lead:                      None,
		isLearner:                 false,
		raftLog:                   raftlog,
		maxMsgSize:                c.MaxSizePerMsg,
		maxUncommittedSize:        c.MaxUncommittedEntriesSize,
		prs:                       tracker.MakeProgressTracker(c.MaxInflightMsgs),
		electionTimeout:           c.ElectionTick,
		heartbeatTimeout:          c.HeartbeatTick,
		logger:                    c.Logger,
		checkQuorum:               c.CheckQuorum,
		preVote:                   c.PreVote,
		readOnly:                  newReadOnly(c.ReadOnlyOption),
		disableProposalForwarding: c.DisableProposalForwarding,
	}

    if !IsEmptyHardState(hs) {
		r.loadState(hs)
	}
    
	r.becomeFollower(r.Term, None)
	return r
}
```

首先根据配置文件，构造一个 raft 对象，然后如果有持久化数据的话就同步一下。

重点是`r.becomeFollower(r.Term, None)`,说明节点启动的时候默认都是 follower 。

追踪下去，看下做了些什么：

```go
// raft/raft.go 686行
func (r *raft) becomeFollower(term uint64, lead uint64) {
    // 这是一个func，主要是状态机的处理逻辑
	r.step = stepFollower
	r.reset(term)
    // 这就是 选举相关的逻辑
	r.tick = r.tickElection
	r.lead = lead
	r.state = StateFollower
}
```



## 2. 超时后开启选举

`tickElection`主要是判断是否能够开始选举Leader,实际是由外部驱动的：

```go
// raft/raft.go 645行
func (r *raft) tickElection() {
    // 每次计数加一
    r.electionElapsed++
    // 如果条件允许(并不是所有节点都可以参与Leader选举的)，并且已经超时，那么就开始选举
    if r.promotable() && r.pastElectionTimeout() {
        r.Step(pb.Message{From: r.id, Type: pb.MsgHup})
    }
}
// raft/raft.go 1714行
func (r *raft) pastElectionTimeout() bool {
 // 超时时间到了就可以开始去选举Leader了
 return r.electionElapsed >= r.randomizedElectionTimeout
}
// raft/raft.go 1718行
func (r *raft) resetRandomizedElectionTimeout() {
    // 再固定的超时时间上增加一个随机值，避免出现所有节点同时超时的情况
 r.randomizedElectionTimeout = r.electionTimeout + globalRand.Intn(r.electionTimeout)
}
```

超时时间居然并不是用时间来处理，而是每次+1。

> 超时时间用计数来实现这个有点巧妙，可以避免当前机器突然卡了以下然后导致超时的问题。
>
> 用计时的话：机器卡了一下，然后卡回来可能就超时了
>
> 用计数的话：机器卡的时候计数就不会加了，卡回来也不会超时。

实际上由于该方法是外部调用的，所以外部比如每毫秒调用一次，那么实际上超时时间单位就是 ms 了。

> 同时还通过一个简单的随机算法，使得每个节点的超时时间不一致，巧妙地避免出现所有节点同时超时，然后又同时发起选举，最后都把票投给自己，导致一直选不出 Leader 的情况。
>
> 时间错开后，第一个节点超时发起选举后，其他节点还没超时，此时有很大概率就直接选出 Leader（如果发起选取的节点满足其他条件的话）。



## 3. 选举处理逻辑

```go
// raft/raft.go 847行
func (r *raft) Step(m pb.Message) error {
  switch m.Type {
        case pb.MsgHup:
            if r.preVote { // 如果开启了预选机制，则进入预选流程
                r.hup(campaignPreElection)
            } else { // 否则直接进入选举流程
                r.hup(campaignElection)
            }        
    }
}
```

**preVote**也是 etcd 中新增的功能，主要用于避免无效选举，以提升集群的稳定性。

> 因为有的节点注定不会成为 Leader，真的进行选举也是白给，所以先预选一下，在预选阶段就拦截掉部分无效选举。



```go
// raft/raft.go 760行
func (r *raft) hup(t CampaignType) {
	if r.state == StateLeader { // 已经是 Leader 就不能再发起选举了
		return
	}

	if !r.promotable() { // 不满足参与 Leader 选举的条件也是不让选
		return
	}
    // 如果还有配置修改没有应用，也不能选
	ents, err := r.raftLog.slice(r.raftLog.applied+1, r.raftLog.committed+1, noLimit)
	if n := numOfPendingConf(ents); n != 0 && r.raftLog.committed > r.raftLog.applied {
		return
	}
    // 到此，正式开始选举
	r.campaign(t)
}

```



```go
// raft/raft.go 785行
func (r *raft) campaign(t CampaignType) {
	var term uint64
	var voteMsg pb.MessageType
    // 根据始预选还是分别处理
	if t == campaignPreElection {
		r.becomePreCandidate() // 切换到 PreCandidate 状态
		voteMsg = pb.MsgPreVote
		term = r.Term + 1
	} else {
		r.becomeCandidate() // 切换到 Candidate 状态
		voteMsg = pb.MsgVote
		term = r.Term
	}
    
	if _, _, res := r.poll(r.id, voteRespMsgType(voteMsg), true); res == quorum.VoteWon {
		// We won the election after voting for ourselves (which must mean that
		// this is a single-node cluster). Advance to the next state.
		if t == campaignPreElection {
			r.campaign(campaignElection)
		} else {
			r.becomeLeader()
		}
		return
	}
     // 向所有节点发送消息
	var ids []uint64
	{
		idMap := r.prs.Voters.IDs()
		ids = make([]uint64, 0, len(idMap))
		for id := range idMap {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	}
   
	for _, id := range ids {
		if id == r.id { // 本节点除外
			continue
		}
			r.id, r.raftLog.lastTerm(), r.raftLog.lastIndex(), voteMsg, id, r.Term)

		var ctx []byte
		if t == campaignTransfer {
			ctx = []byte(t)
		}
		r.send(pb.Message{Term: term, To: id, Type: voteMsg, Index: r.raftLog.lastIndex(), LogTerm: r.raftLog.lastTerm(), Context: ctx})
	}
}
```

主要做了两件事：

* 切换到 Candidate 状态
* 发送投票消息给其他节点



## 4. 预选逻辑

这里的预选逻辑额外拿出来分析以下，raft paper 中没有，是 etcd 中的一个优化。

```go
if t == campaignPreElection {
    r.becomePreCandidate()
    voteMsg = pb.MsgPreVote
    term = r.Term + 1
} else {
    r.becomeCandidate()
    voteMsg = pb.MsgVote
    term = r.Term
}
```

首先看一下 `r.becomePreCandidate()`和`r.becomeCandidate()`有什么区别：

```go
// raft/raft.go 695行
func (r *raft) becomeCandidate() {
	r.step = stepCandidate
	r.reset(r.Term + 1)
	r.tick = r.tickElection
	r.Vote = r.id
	r.state = StateCandidate

}
// raft/raft.go 708行
func (r *raft) becomePreCandidate() {
	r.step = stepCandidate
	r.prs.ResetVotes()
	r.tick = r.tickElection
	r.lead = None
	r.state = StatePreCandidate
}
```

重点是，follower 切换成为 candidate 调用了 `r.reset(r.Term + 1)`，把 term +1 了。

而在预选中切换成 PreCandidate 则没有，只是在发送消息的时候，PreCandidate 把消息中的 term +1 而已。

> 因为预选可能不会通过，如果该节点无法联系上系统中的大多数节点那么这次状态切换会导致 term 毫无意义的增大，所以没有增加。





## 5. 投票结果处理

```go
// raft/raft.go 1376行
func stepCandidate(r *raft, m pb.Message) error {
    // 同样是预选和正选状态判定
	var myVoteRespType pb.MessageType
	if r.state == StatePreCandidate {
		myVoteRespType = pb.MsgPreVoteResp
	} else {
		myVoteRespType = pb.MsgVoteResp
	}
    // 处理投票结构
	switch m.Type {
	case myVoteRespType:
		gr, rj, res := r.poll(m.From, m.Type, !m.Reject)
		switch res {
            // 获取到了过半的选票
		case quorum.VoteWon:
            // 如果是预选那么此时就可以开始正式选举
			if r.state == StatePreCandidate {
				r.campaign(campaignElection)
			} else {
                // 如果是正选那么选举成功，切换成 leader
				r.becomeLeader()
				r.bcastAppend()
			}
		case quorum.VoteLost:
			// 如果失败了，不管是预选还是正选都切换成 follower
			r.becomeFollower(r.Term, None)
		}
	}
	return nil
}
```

投票结果有三种：

* VoteWon：成功，如果是预选那么此时就可以开始正式选举，如果是正选就成为 leader 了
* VoteLost：失败，不管是预选还是正选都切换成 follower
* VotePending：其实还有一种情况，即同意或者拒绝的票数都没到阈值，还需要进一步等待后续投票。不过Switch中没有写出来，即匹配不到上面的任何一种情况时就啥也不做。



成为 Leader 后还调用了`r.bcastAppend()`方法，发送了一条广播日志。

>  如果没有有效日志，那么也会广播一条空的 Message，具体原因在后面。

这个在 Raft Paper 中是有提到的，主要在 **State Machine Safety**这一条中。

如果一条日志成功复制到大多数节点上，leader 就知道可以 commit 了。如果leader 在 commit 之前崩溃了，新的 leader 将会尝试完成复制这条日志。然而一个 leader 不可能立刻推导出之前 term 的 entry 已经 commit 了。所以 Raft 算法做了以下限制：

某个 leader 选举成功之后，不会直接提交前任 leader 时期的日志，而是通过提交当前任期的日志的时候“顺手”把之前的日志也提交了，具体怎么实现了，在 log matching 部分有详细介绍。

> 为了避免 leader 在整个任期中都没有收到客户端请求，导致日志一直没有被提交的情况，leader 会在在任期开始的时候发立即尝试复制、提交一条空的 log。



## 6. Leader 心跳

Follower 检测到心跳超时后就会开始选举 Leader，Leader 自然需要不断的给 Follower 发送心跳以保证自己的 Leader 地位。

```go
// raft/raft.go 724行
func (r *raft) becomeLeader() {
    // 成为 Leader 后设置了另一个 tick
    r.tick = r.tickHeartbeat
    // ...
}
```



```go
// raft/raft.go 657行
func (r *raft) tickHeartbeat() {
	r.heartbeatElapsed++ // 可以看到同样是用的计数来代表时间
	r.electionElapsed++


	if r.state != StateLeader {
		return
	}
	// 如果超了就给 Follower 发一个心跳消息过去
	if r.heartbeatElapsed >= r.heartbeatTimeout {
		r.heartbeatElapsed = 0
		if err := r.Step(pb.Message{From: r.id, Type: pb.MsgBeat}); err != nil {
		}
	}
}
```



```go
// raft/raft.go 847行
func (r *raft) Step(m pb.Message) error {
	switch m.Type {
	default:
		err := r.step(r, m)
		if err != nil {
			return err
		}
	}
	return nil
}
```

实际上这个类型，啥也匹配不到，最终会进入 Default 逻辑，调用 step 方法。



Leader 的 step 方法如下：

```go
// raft/raft.go 991行
func stepLeader(r *raft, m pb.Message) error {
	switch m.Type {
	case pb.MsgBeat:
		r.bcastHeartbeat()
		return nil
}
```

广播发送心跳：

```go
// raft/raft.go 525行
func (r *raft) bcastHeartbeat() {
	lastCtx := r.readOnly.lastPendingRequestCtx()
	if len(lastCtx) == 0 {
		r.bcastHeartbeatWithCtx(nil)
	} else {
		r.bcastHeartbeatWithCtx([]byte(lastCtx))
	}
}
```

此时去看下 Follower 收到心跳后会做什么呢：

```go
// raft/raft.go 1421行
func stepFollower(r *raft, m pb.Message) error {
	switch m.Type {
	case pb.MsgHeartbeat:
		r.electionElapsed = 0 // 直接把计数清0
		r.lead = m.From
		r.handleHeartbeat(m)  // 然后回复心跳消息
}
// raft/raft.go 1513行
func (r *raft) handleHeartbeat(m pb.Message) {
	r.raftLog.commitTo(m.Commit)
	r.send(pb.Message{To: m.From, Type: pb.MsgHeartbeatResp, Context: m.Context})
}
```

处理很简单，就是重置 electionElapsed 然后再回复一个心跳响应消息。

根据前面 Follower 的逻辑中，每次调用 tick 时，electionElapsed 会+1，如果超过阈值就会发起选举。

然后 Leader 心跳消息时会直接将 electionElapsed 重置，所以如果 Leader 正常运行，Follower 永远不会触发选举。

 

根据上述逻辑可以知道：Leader 的 tick 发送间隔要小于 Follower 的 tick 间隔，不然 Follower 都检测到超时了，Leader 还不发送心跳消息过去，整个集群就无法正常运行了。





## 7. 小结

1）选举流程

* Follower tick 超时
* 产生 MsgHup 
* 广播 MsgVote 消息
* 接收 MsgVoteResp
  * VoteWin：切换到 Leader
  * VoteLost：切换会 Follower

2）心跳流程

* Leader tick 超时
* 产生 MsgBeat
* 广播 MsgHeartbeat 消息 
* Follower 清零 tick 计数



etcd 中新增了**预选**功能，主要用于避免无效的选举对集群稳定性产生影响。

通过将各个节点**超时时间随机化**，来避免同时开启选举，然后瓜分选票，最终一直无法选出 Leader 的情况。

通过计数方式实现超时，也比较巧妙。



[leader-election]:https://github.com/lixd/blog/raw/master/images/distributed/raft/leder-election.png
