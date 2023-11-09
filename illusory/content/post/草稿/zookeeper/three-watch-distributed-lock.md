---
title: "ZooKeeper入门教程(三)---Watcher与分布式锁"
description: "ZooKeeper的watch监听与ZooKeeper分布式锁的实现原理分析"
date: 2019-03-03 22:00:00
draft: true
tags: ["ZooKeeper"]
categories: ["ZooKeeper"]
---

本文讲述了ZooKeeper的watch监听与ZooKeeper分布式锁的实现原理。

<!--more-->

> **[ZooKeeper入门系列文章目录](https://www.lixueduan.com/categories/ZooKeeper/)**
>
> [ZooKeeper入门教程(一)---安装与基本使用](https://www.lixueduan.com/posts/137f5008.html)
>
> [ZooKeeper入门教程(二)---原生API与ACL权限认证](https://www.lixueduan.com/posts/3ced5d74.html)
>
> [ZooKeeper入门教程(三)---Watcher与分布式锁](https://www.lixueduan.com/posts/4975d97e.html)
>
> .....
>
> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. ZooKeeper的watch监听

### 1.1 简介

 在 ZooKeeper 中，引入了 Watcher 机制来实现这种分布式的通知功能。ZooKeeper 允许客户端向服务端注册一个 Watcher 监听，当服务器的一些特定事件触发了这个 Watcher，那么就会向指定客户端发送一个事件通知来实现分布式的通知功能。

 同样，其watcher是监听数据发送了某些变化，那就一定会有对应的事件类型, 
 和状态类型。

### 1.2  事件类型

与节点相关。

* EventType.NodeCreated 
* EventType.NodeDataChanged 
* EventType.NodeChildrenChanged 
* EventType.NodeDeleted 

### 1.3 状态类型

与客户端实例相关。

- KeeperState.Oisconnected 
- KeeperState.SyncConnected 
- KeeperState.AuthFailed 
- KeeperState.Expired

### 1.4 持续监听

ZooKeeper中有很多个节点，客户端也也可以new多个watcher，会开一个新的线程分别监听不同的节点，当监听的节点发送变化后，客户端就可以收到消息。
其中watch可以看成是一个动作，是一次性的，watch一次就只能收到一次监听，节点别修改两次也只能收到第一次的通知。

两种持续监听方案：

* 1.收到变化后将Boolean值手动赋为true，表示下一次还要监听
* 2.再new一个watcher去监听

 ### 1.5 测试代码

```java
    @Test
    public void testWatch() throws KeeperException, InterruptedException, IOException {
        Watcher watcher = new Watcher() {
            @Override
            public void process(WatchedEvent event) {
                Event.EventType type = event.getType();
                Event.KeeperState state = event.getState();
                String path = event.getPath();
                switch (state) {
                    case SyncConnected:
                        System.out.println("state: SyncConnected");
                        System.out.println("path: " + path);
                        waitZooKeeperConnOne.countDown();
                        break;
                    case Disconnected:
                        System.out.println("state: Disconnected");
                        System.out.println("path: " + path);
                        break;
                    case AuthFailed:
                        System.out.println("state: AuthFailed");
                        System.out.println("path: " + path);
                        break;
                    case Expired:
                        System.out.println("state: Expired");
                        System.out.println("path: " + path);
                        break;
                    default:
                        System.out.println("state: default");
                }
                System.out.println("------------------------");
                switch (type) {
                    case None:
                        System.out.println("type: None");
                        System.out.println("path: " + path);
                        break;
                    case NodeCreated:
                        System.out.println("type: NodeCreated");
                        System.out.println("path: " + path);
                        break;
                    case NodeDataChanged:
                        System.out.println("type: NodeDataChanged");
                        System.out.println("path: " + path);
                        break;
                    case DataWatchRemoved:
                        System.out.println("type: DataWatchRemoved");
                        System.out.println("path: " + path);
                        break;
                    case ChildWatchRemoved:
                        System.out.println("type:child watch被移除");
                        System.out.println("path: " + path);
                        break;
                    case NodeChildrenChanged:
                        System.out.println("type: NodeChildrenChanged");
                        System.out.println("path: " + path);
                        break;
                    case NodeDeleted:
                        System.out.println("type: NodeDeleted");
                        System.out.println("path: " + path);
                        break;
                    default:
                        System.out.println("type: default");
                }
                System.out.println("------------------------");
            }

        };
        String childPath = "/cloud/test5";
        String childPath2 = "/cloud/test6";
        String parentPath = "/cloud";
        //创建时watch一次 1次
        ZooKeeper z = new ZooKeeper(CONN_ADDR, SESSION_TIMEOUT, watcher);
        waitZooKeeperConnOne.await();
        //这里也watch一次 2次
        z.exists(childPath, true);
        z.create(childPath, "cloud".getBytes(), ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        //watch一下父节点 即/cloud  3次
        z.getChildren(parentPath, true);
        z.create(childPath2, "cloud".getBytes(), ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        //再watch一次子节点  4次
        z.exists(childPath, true);
        z.setData(childPath, "a".getBytes(), -1);
        Thread.sleep(1000);
    }
```

### 1.5 watcher小结

ZooKeeper 的 Watcher 具有以下几个特性。

#### 1. 一次性

无论是服务端还是客户端，一旦一个 Watcher 被触发，ZooKeeper 都会将其从相应的存储中移除。因此，在 Watcher 的使用上，需要反复注册。这样的设计有效地减轻了服务端的压力。

#### 2. 客户端串行执行

客户端 Watcher 回调的过程是一个串行同步的过程，这为我们保证了顺序，同时，需要注意的一点是，一定不能因为一个 Watcher 的处理逻辑影响了整个客户端的 Watcher 回调，所以，我觉得客户端 Watcher 的实现类要另开一个线程进行处理业务逻辑，以便给其他的 Watcher 调用让出时间。

#### 3. 轻量 

WatcherEvent 是 ZooKeeper 整个 Watcher 通知机制的最小通知单元，这个数据结构中只包含三部分内容：通知状态、事件类型和节点路径。也就是说，Watcher 通知非常简单，只会告诉客户端发生了事件，而不会说明事件的具体内容。

例如针对 NodeDataChanged 事件，ZooKeeper 的Watcher 只会通知客户端指定数据节点的数据内容发生了变更，而对于原始数据以及变更后的新数据都无法从这个事件中直接获取到，而是需要客户端主动重新去获取数据——这也是 ZooKeeper 的 Watcher 机制的一个非常重要的特性。

## 2. ZooKeeper分布式锁

### 2.1 为什么需要分布式锁

并发相关的各种锁只能限制当前服务器上只能有一个用户或者线程访问加锁的资源，在单机部署环境下确实是没问题的，但是在有多台服务器的分布式环境下，并发相关的锁就不管用了，Nginx负载均衡将用户请求分到多台服务器上，每台服务器上都会有一个用户能访问到加锁的资源，这样就出现了并发问题，所以为了解决在分布式环境下的并发问题就出现了分布式锁。

### 2.2 相关概念

#### 1. 有序节点

如果创建的是有序节点，那么zookeeper在生成子节点时会根据当前的子节点数量自动添加整数序号，也就是说如果是第一个创建的子节点，那么生成的子节点为`/locker/node-0000000000`，下一个节点则为`/locker/node-0000000001`，依次类推。

#### 2. 临时节点

ZooKeeper的临时节点时本次会话有效，等客户端执行完业务代码后关闭会话，临时节点就自动删除掉了。

#### 3. 事件监听

在读取数据时，我们可以同时对节点设置事件监听，当节点数据或结构变化时，zookeeper会通知客户端。当前zookeeper有如下四种事件:

* 1.节点创建
* 2.节点删除
* 3.节点数据修改
* 4.子节点变更

就是上一篇文章中讲的watcher。

### 2.3 分布式锁

#### 1. 独占锁

对于独占锁，我们可以将资源 R1 看做是 lock 节点，操作 O1 访问资源 R1 看做创建 lock 节点，释放资源 R1 看做删除 lock 节点。这样我们就将独占锁的定义对应于具体的 Zookeeper 节点结构，通过创建 lock 节点获取锁，删除节点释放锁。

```java
root 
	-exclusive_locak
				---lock
```

详细的过程如下： 

1. 多个客户端竞争创建 lock 临时节点
2. 其中某个客户端成功创建 lock 节点，其他客户端对 lock 节点设置 watcher
3. 持有锁的客户端删除 lock 节点或该客户端崩溃，会话关闭，由 Zookeeper 删除 lock 节点
4. 其他客户端获得 lock 节点被删除的通知
5. 重复上述4个步骤，直至无客户端在等待获取锁了

#### 2. 读写锁

读写锁包含一个读锁和写锁，操作 O1 对资源 R1 加读锁，且获得了锁，其他操作可同时对资源 R1 设置读锁，进行共享读操作。如果操作 O1 对资源 R1 加写锁，且获得了锁，其他操作再对资源 R1 设置不同类型的锁都会被阻塞。总结来说，读锁具有共享性，而写锁具有排他性。 

在 Zookeeper 中，由于读写锁和独占锁的节点结构不同，读写锁的客户端不用再去竞争创建 lock 节点。所以在一开始，所有的客户端都会创建自己的锁节点。如果不出意外，所有的锁节点都能被创建成功，此时锁节点结构如图3所示。之后，客户端从 Zookeeper 端获取 /share_lock 下所有的子节点，并判断自己能否获取锁。如果客户端创建的是读锁节点，获取锁的条件（满足其中一个即可）如下：

1. 自己创建的节点序号排在所有其他子节点前面
2. 自己创建的节点前面无写锁节点

如果客户端创建的是写锁节点，由于写锁具有排他性。所以获取锁的条件要简单一些，只需确定自己创建的锁节点是否排在其他子节点前面即可。

```java
root 
	-share_lock
			---host1-R-0000000001
			---host2-R-0000000002
    		---host3-R-0000000003
```

详细的流程如下：

1. 所有客户端创建自己的锁节点
2. 从 Zookeeper 端获取 /share_lock 下所有的子节点
3. 判断自己创建的锁节点是否可以获取锁，如果可以，持有锁。否则**对自己关心的锁节点设置 watcher**
4. 持有锁的客户端删除自己的锁节点，某个客户端收到该节点被删除的通知，并获取锁
5. 重复步骤4，直至无客户端在等待获取锁了

`host2-R-0000000002` 对应的客户端 `C2` 只需监视 `host1-W-0000000001` 节点是否被删除即可。而 `host3-W-0000000003` 对应的客户端 `C3` 只需监视 `host2-R-0000000002` 节点是否被删除即可，只有 `host2-R-0000000002` 节点被删除，客户端 `C3` 才能获取锁。而 `host1-W-0000000001` 节点被删除时，产生的通知对于客户端 C3 来说是无用的，即使客户端 C3 响应了通知也没法获取锁。

这里总结一下，**不同客户端关心的锁节点是不同的。如果客户端创建的是读锁节点，那么客户端只需找出比读锁节点序号小的最后一个的写锁节点，并设置 watcher 即可。而如果是写锁节点，则更简单，客户端仅需对该节点的上一个节点设置 watcher 即可**。

### 2.4 例子

ZooKeeper可以通过依赖于临时节点实现分布式锁。
假设有两台服务器 一台8888 一台8889，都部署了同一个web程序。

此刻同时来了两个请求 一个被分到了8888服务器，一个被分到了8889服务器上。
两个请求都要去修改数据库中的User表里的ID 为666的用户的信息(例如都是把age属性+1 假设当前age为22）

**没加锁前**：
 用户A查询到age为22 ++后变成23
 用户B也查询到是22  ++后也变成23
 其中这里两个++后应该变成24的，由于没加锁出现了数据异常

**加锁后** ：
 用户A先在ZooKeeper中创建临时有序节点假设为`/locker/node-0000000009`，创建之后会`getChildren`查看`/locker`节点下的所有子节点，如果自己的编号是最小的，说明自己是最先创建的，则获取到了锁，如果不是就等待前面的节点被自动删除(即前面的用户释放了锁)。
此时用户B也来访问，也要临时有序节点，假设为`/locker/node-00000000010`，接着`getChildren`查看`/locker`节点下的所有子节点，发现自己不是最小的，那么就会等待在这里。
 最终A和B只有一个人能成功创建节点并修改数据，
A获取到锁后开始执行业务代码，那么A将age ++后变成23了 然后数据库持久化 8888中的age就是23了 8889中还是22
 接着服务器8888和8889之间执行进行数据同步 同步成功后A关闭会话，临时节点失效，锁释放了。

此时B用户创建的节点是最小的，就获取到了锁，开始执行业务代码，去修改数据 此时获取到age=23  ++后变成了24 持久化后 再次进行8888 8889服务期间进行数据同步。
 这样就不会出现数据异常。

 问题：为什么要用临时节点，创建持久化节点然后执行完后删除不行吗？
 答：临时节点性能高



## 3. 参考

`https://blog.csdn.net/qiangcuo6087/article/details/79067136`