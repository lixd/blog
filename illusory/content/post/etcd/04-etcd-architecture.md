---
title: "etcd教程(四)---etcd架构及其实现简单分析"
description: "etcd简单分析及其与zookeeper的区别"
date: 2020-02-10
draft: false
categories: ["etcd"]
tags: ["etcd"]
---

本文主要对`etcd`进行了简单的分析，同时和`zookeeper`进行了简单的对比。

<!--more-->

## 1. etcd架构

### 1. 概述

etcd 基于 **Raft 协议**，通过复制日志文件的方式来保证数据的**强一致性**。

**客户端应用写一个 key 时，首先会存储到 etcd Leader 上，然后再通过 Raft 协议复制到 etcd 集群的所有成员中，以此维护各成员（节点）状态的一致性与实现可靠性。**

虽然 etcd 是一个强一致性的系统，但也支持从非 Leader 节点读取数据以提高性能，而且写操作仍然需要 Leader 支持，所以当发生网络分时，写操作仍可能失败。

**etcd 具有一定的容错能力**，假设集群中共有N个节点，即便集群中( n-1) /2个节点发生了故障，只要剩下的( n+1) /2 个节点达成一致， 也能操作成功,因此，它能够有效地应对网络分区和机器故障带来的数据丢失风险。

**etcd 默认数据一更新就落盘持久化，数据持久化存储使用 WAL (write ahead log） ，预写式日志。**

格式 WAL 记录了数据变化的全过程，在 etcd 中所有数据在提交之前都要先写入 WAL 中； etcd Snapshot （快照）文件则存储了某一时刻 etcd 的所有数据，默认设置为每 10 000 条记录做一次快照，经过快照后WAL 文件即可删除。

### 2. 四要素

etc 在设计的时候重点考虑了如下的四个要素：

**1. 简单**

* 支持RESTful风格的HTTP+JSON的API
* v3版本增加了对gRPC的支持 同时也提供rest gateway进行转化
* Go语言编写，跨平台，部署和维护简单
* 使用Raft算法保证强一致性，Raft算法可理解性好

**2. 安全**

支持TLS客户端安全认证

**3. 性能**

单实例(V3)支持每秒10KQps

**4. 可靠**

使用 Raft 算法充分保证了分布式系统数据的强一致性 etcd 集群是一个分布式系统，由多个节点相互通信构成整体的对外服务，每个节点都存储了完整的数据，并且通过 Raft 协议保证了每个节点维护的数据都是一致的。



etcd可以扮演两大角色：

* 持久化的键值存储系统
* 分布式系统数据一致性服务提供者

### 3. 架构模块

etcd(Server)大体上可以分为`网络层(http(s) server)`、`Raft模块`、`复制状态机(RSM)`和`存储模块`,具体如下：

![etcd模块](https://github.com/lixd/blog/raw/master/images/etcd/etcd-server-architecture.png)



* **网络层**:提供网络数据读写功能，监听服务端口，完成集群节点之间数据通信，收发客户端数据。

* **Raft模块**：Raft强一致性算法的具体实现。

* **存储模块**：涉及KV存储、WAL文件、Snapshot管理等，用户处理etcd支持的各类功能的事务，包括数据索引 节点状态变更、监控与反馈、事件处理与执行 ，是 etcd 对用户提供的大多数 API 功能的具体实现。

* **复制状态机**：这是一个抽象的模块，状态机的数据维护在内存中，定期持久化到磁盘，每次写请求都会持久化到 WAL 文件，并根据写请求的内容修改状态机数据。

### 4. 执行流程

通常，一个用户的请求发送过来，会经由 HTTP ( S) Server 转发给存储模块进行具体的事务处理,如果涉及节点状态的更新，则交给 Raft 模块进行仲裁和日志的记录，然后再同步给别的 etcd 节点，只有当半数以上的节点确认了该节点状态的修改之后，才会进行数据的持久化。



etcd 集群的各个节点之间需要通过网络来传递数据，具体表现为如下几个方面：

* 1) Leader Follower 发送心跳包， Follower Leader 回复消息
* 2) Leader Follower 发送日志追加信息
* 3) Leader Follower 发送 Snapshot 数据
* 4) Candidate 节点发起选举，向其他节点发起投票请求
* 5) Follower 将收到的写操作转发给 Leader



## 2. etcd数据通道

在etcd 的实现中， 根据不同的用途，定义了各种不同的消息类型些不同的消息，最终都将通过 `protocol buffer` 格式进行编码。

大消息如传输 Snapshot 的数据 就比较大，甚至会超过1GB ，而小消息则如 Leader Follower 节点之间的心跳消息可能只有几十 KB。

etcd 在实现中，对这些消息采取了分类处理的方式，它抽象出了两种类型的消息传输通道，即 `Stream`类型通道和 `Pipeline` 类型通道。

* Stream: 用于处理`数据量较少`的消息,例如心跳、日志追加消息等。点到点之间维护一个HTTP长连接。
* Pipeline:用于处理`数据量大`的消息，如Snapshot。不维护长连接。

> Snapshot这种数据量大的消息必须和心跳分开传，否则会阻塞心跳消息。
>
> Pipeline也能用于传小消息前提是Stream不能用了。



## 3. 模块间交互

**1. 网络层与Raft模块交互**

etcd 通过 Raft 模块中抽象的 RaftNode 拥有一个消息盒子，RaftNode 将各种类型的消息都放入消息盒子中，由专门的 go routine 将消息盒子里的消息写入管道（Go 语言的 Channel ），而管道的另外一端就链接在网络层的不同类型的传输通道上，同样也有专门的 go routine 在等待(select)消息的到达。

> 网络层与Raft模块之间通过Go语言的Channel来完成数据通信。



**2.Server与Client交互**

etcd server 在启动之初 ，会监听服务端口，待服务端口收到客户端的请求之后，就会解析出消息体，然后通过管道传给 Raft 模块，当 Raft 模块按照Raft 协议完成操作时，会回复该请求(或者请求超时关闭了)。

**3.Server之间的交互**

etcd server 之间通过 peer 端口(初始化时可以手动指定)使用 HTTP 进行通信。 etcd server peer端口主要用来协调 Raft 的相关消息，包括各种提议的协商。



## 4. etcd实现

### 1. 名字由来

`etcd`它是`etc`和`distributed`的结合体。

> 在类`unix`系统中`/etc`目录是用于存放配置文件的，二`distributed`则是分布式的意思。

那么`etcd`的意思就很明显了：`大型分布式系统的配置中心`。

### 2. raft协议

- 每次写入都是在一个事务（tx）中完成的。
- 一个事务（tx）可以包含若干个写操作。
- etcd集群有一个leader，写请求都会提交给它。
- leader先将数据保存成日志形式，并定时的将日志发往其他节点保存。
- 当超过1/2节点成功保存了日志，则leader会将tx最终提交（也是一条日志）。
- 一旦leader提交tx，则会在下一次心跳时将提交记录发送给其他节点，其他节点也会提交。
- leader宕机后，剩余节点协商找到拥有最大已提交tx ID（必须是被超过半数的节点已提交的）的节点作为新leader。

>  具体Raft协议可参考[大神制作的Raft协议动画](http://thesecretlivesofdata.com/raft/)

### 3. mvcc多版本

- 每个tx事务有唯一事务ID，在etcd中叫做mainID，全局递增不重复。
- 一个tx可以包含多个修改操作（put和delete），每一个操作叫做一个revision(修订)，共享同一个mainID。
- 一个tx内连续的多个修改操作会被从0递增编号，这个编号叫做subID。
- 每个revision由（mainID，subID）唯一标识。

### 4. 索引+存储

内存索引+磁盘存储value

在多版本中，每一次操作行为都被单独记录下来，保存到bbolt中。

在bbolt中，每个revision将作为key，即将序列化后的(revision.main+revision.sub)作为key;

在bbolt中存储的value是这样一个json序列化后的结构，包括key创建时的revision（对应某一代generation的created），本次更新版本，sub ID（Version ver），Lease ID（租约ID）如下：

```go
	kv := mvccpb.KeyValue{
		Key:            key,
		Value:          value,
		CreateRevision: c,
		ModRevision:    rev,
		Version:        ver,
		Lease:          int64(leaseID),
	}
```



因此，我们先通过内存btree在keyIndex.generations[0].revs中找到最后一条revision，即可去bbolt中读取对应的数据。

相应的，etcd支持按key前缀查询，其实也就是遍历btree的同时根据revision去bbolt中获取用户的value。 

```go
type keyIndex struct {
	key         []byte
	modified    revision // 最后一次修改对应的revision信息。
	generations []generation //记录多版本信息
}

// mvcc多版本
type generation struct {
	ver     int64
	created revision // 引起本次key创建的revision信息
	revs    []revision
}

type revision struct {
	main int64

	sub int64
}
```

内存索引(btree)中存放keyIndex，磁盘中存放对应的多版本数据(序列化后的(revision.main+revision.sub)作为key)

用户查询时去内存中(btree)中根据key找到对应的keyIndex,在keyIndex中找到最后一次revision信息 然后根据（revision.main+revision.sub）作为key去磁盘查询具体数据。



由于会存储下每个版本的数据，所以多次修改后会产生大量数据，可以使用compact 压缩清理掉太久的数据。compact(n)表示压缩掉revision.main <= n的所有历史版本



多版本总结来说：**内存btree维护的是用户key => keyIndex的映射，keyIndex内维护多版本的revision信息，而revision可以映射到磁盘bbolt中的用户value**。

### 5. watch

etcd的事件通知机制是基于mvcc多版本实现的。

客户端可以提供一个要监听的revision.main作为watch的起始ID，只要etcd当前的全局自增事务ID > watch起始ID，etcd就会将MVCC在bbolt中存储的所有历史revision数据，逐一顺序的推送给客户端。

`zookeeper`只会提示数据有更新，由用户主动拉取最新数据，中间多版本数据无法知道。

etcd会推送每一次修改的数据给用户。



实际是etcd根据mainID去磁盘查数据，磁盘中数据以revision.main+revision.sub为key(bbolt 数据库中的key)，所以就会依次遍历出所有的版本数据。同时判断遍历到的value中的key(etcd中的key)是不是用户watch的，是则推送给用户。



这里每次都会遍历数据库性能可能会很差，实际使用时一般用户只会关注最新的revision，不会去关注旧数据。

同时也不是每个watch都会去遍历一次数据库，将多个watch作为一个watchGroup，一次遍历可以处理多个watch，判断到value中的key属于watchGroup中的某个watch关注的则返回，从而有效减少遍历次数。

## 5. etcd与zookeeper比较

### 1. CAP原则

**zookeeper和etcd都是顺序一致性的（满足CAP的CP）**，意味着无论你访问任意节点，都将获得最终一致的数据视图。这里最终一致比较重要，因为zookeeper使用的`paxos`和etcd使用的`raft`都是`quorum机制(大多数同意原则)`，所以部分节点可能因为任何原因延迟收到更新，但数据将最终一致，高度可靠。

### 2. 逻辑结构

**zookeeper从逻辑上来看是一种目录结构，而etcd从逻辑上来看就是一个k-v结构**。

> 但etcd的key可以是`任意字符串`同时在存储上实现了`key有序排列`。

所以仍旧可以模拟出父子目录关系，例如：key=/a/b/c、/a/b、/a

**结论：etcd本质上是一个有序的k-v存储。**

### 3. 临时节点

在实现服务发现时，我们一般都会用到zookeeper的临时节点。当客户端掉线一段时间，对应的zookeeper session会过期，那么对应的临时节点就会被自动删除。

在etcd中对应的是`lease租约机制`，通过该机制实现了key的自动删除。

可以在set key的同时携带lease ID，当lease过期后所有关联的key都将被自动删除。

### 4. 事件模型

在我们用zookeeper实现服务发现时，我们一般会`getChildrenAndWatch`来获取一个目录下的所有在线节点，这个API会先获取当前的孩子列表并同时原子注册了一个观察器。

每当zookeeper发现孩子有变动的时候，就会发送一个通知事件给客户端（同时关闭观察器），此时我们会再次调用getChildrenAndWatch再次获取最新的孩子列表并重新注册观察器。

简单的来说，zookeeper提供了一个原子API，它先获取当前状态，同时注册一个观察器，当后续变化发生时会发送一次通知到客户端：获取并观察->收到变化事件->获取并观察->收到变化事件->….，如此往复。

zookeeper的事件模型非常可靠，不会出现发生了更新而客户端不知道的情况，但是特点也很明显：

- 事件不包含数据，仅仅是通知变化。
- 多次连续的更新，通知会合并成一个；即，客户端收到通知再次拉取数据，会跳过中间的多个版本，只拿到最新数据。

这些特点并不是缺点，因为一般应用只关注最新状态，并不关注中间的连续变化。

相反etcd的事件是包含数据的，并且通常情况下连续的更新不会被合并通知，而是逐条通知到客户端。



## 6. 参考

`《云原生分布式存储基石:etcd深入解析》`

`https://yuerblog.cc/2017/12/10/principle-about-etcd-v3/`

`http://www.wangjialong.cc/2017/09/27/etcd&zookeeper/#more`

`https://www.cnblogs.com/jasontec/p/9651789.html`

`http://jolestar.com/etcd-architecture/`

