---
title: "Kafka(Go)教程(十二)---Kafka 中的高水位和 Leader Epoch 机制"
description: "Kafka 中的高水位（High Watermark）和 Leader Epoch 机制"
date: 2021-09-30 22:00:00
draft: false
categories: ["Kafka"]
tags: ["Kafka"]
---

本文解释了 Kafka 中的高水位和 Leader Epoch 机制。

<!--more-->

## 1. 概述

> Kafka 系列相关代码见 [Github][Github]

高水位（High Watermark）是 Kafka 中非常重要的概念，而 Leader Epoch 是社区在 0.11 版本中新推出的，主要是为了弥补高水位机制的一些缺陷。



## 2. 高水位（High Watermark）

水位一词多用于流式处理领域，比如，Spark Streaming 或 Flink 框架中都有水位的概念。教科书中关于水位的经典定义通常是这样的：

> 在时刻 T，任意创建时间（Event Time）为 T’，且 T’≤T 的所有事件都已经到达或被观测到，那么 T 就被定义为水位。

具体如下图所示：

![Steaming-Pipeline][Steaming-Pipeline]

图中标注“Completed”的蓝色部分代表已完成的工作，标注“In-Flight”的红色部分代表正在进行中的工作，两者的边界就是水位线。



在 Kafka 的世界中，水位的概念有一点不同，**它是用消息位移来表征的**。

> 另外 Kafka 中只有高水位没有低水位的说法，所以下文主要围绕 高水位展开。



### 高水位的作用

在 Kafka 中，高水位的作用主要有 2 个。

* 1）定义消息可见性，即用来标识分区下的哪些消息是可以被消费者消费的。
* 2）帮助 Kafka 完成副本同步。

![HW][HW]

我们假设这是某个分区 Leader 副本的高水位图。首先，请你注意图中的“已提交消息”和“未提交消息”。

**在分区高水位以下的消息被认为是已提交消息，反之就是未提交消息。消费者只能消费已提交消息**，即图中位移小于 8 的所有消息。

> 注意，这里我们不讨论 Kafka 事务，因为事务机制会影响消费者所能看到的消息的范围，它不只是简单依赖高水位来判断。它依靠一个名为 LSO（Log Stable Offset）的位移值来判断事务型消费者的可见性。

图中还有一个日志末端位移的概念，即 Log End Offset，简写是 **LEO**。它表示副本写入下一条消息的位移值。

> 注意，数字 15 所在的方框是虚线，这就说明，这个副本当前只有 15 条消息，位移值是从 0 到 14，下一条新消息的位移是 15



**高水位和 LEO 是副本对象的两个重要属性。**Kafka 所有副本都有对应的高水位和 LEO 值，而不仅仅是 Leader 副本。只不过 Leader 副本比较特殊，Kafka 使用 Leader 副本的高水位来定义所在分区的高水位。换句话说，**分区的高水位就是其 Leader 副本的高水位**。



### 高水位更新机制

实际上，除了保存一组高水位值和 LEO 值=之外，在 Leader 副本所在的 Broker 上，还保存了其他 Follower 副本（也称为远程副本）的 LEO 值。

![Other-LEO][Other-LEO]

在这张图中，我们可以看到，Broker 0 上保存了某分区的 Leader 副本和所有 Follower 副本的 LEO 值，而 Broker 1 上仅仅保存了该分区的某个 Follower 副本。

*为什么要在 Broker 0 上保存这些远程副本呢？*

其实，它们的主要作用是，**帮助 Leader 副本确定其高水位，也就是分区高水位**。

更新机制如下表：

| 更新对象                      | 更新时机                                                     |
| ----------------------------- | ------------------------------------------------------------ |
| Broker 1 上的 Follow 副本 LEO | Follower 副本从 Leader 副本拉取消息，写入到本地磁盘后，会更新其 LEO 值。 |
| Broker 0 上Leader 副本 LEO    | Leader副本接收到生产者发送的消息，写入到本地磁盘后，会更新其LEO值。 |
| Broker 0 上远程副本 LEO       | Follower副本从eader副本拉取消息时，会告诉L eader副本从哪个位移处开始拉取。L eader副本会使用这个位移值来更新远程副本的L EO。 |
| Broker 1 上Follower副本高水位 | Follower副本成功更新完LEO之后，会比较其LEO值与Leader副本发来的高水位值，并用两者的较小值去更新它自己的高水位。 |
| Broker 0上Leader副本高水位    | 主要有两个更新时机: 一个是Leader副本更新其LEO之后;另一个是更新完远程副本LEO之后。具体的算法是:取 Leader副本和所有与Leader同步的远程副本LEO中的最小值 |



**Leader 副本**

处理生产者请求的逻辑如下：

* 1）写入消息到本地磁盘。
* 2）更新分区高水位值。
  * 获取 Leader 副本所在 Broker 端保存的所有远程副本 LEO 值（LEO-1，LEO-2，……，LEO-n）。
  * 获取 Leader 副本高水位值：currentHW。
  * 更新 currentHW = max{currentHW, min（LEO-1, LEO-2, ……，LEO-n）}。

处理 Follower 副本拉取消息的逻辑如下：

* 1）读取磁盘（或页缓存）中的消息数据。
* 2）使用 Follower 副本发送请求中的位移值更新远程副本 LEO 值。
* 3）更新分区高水位值（具体步骤与处理生产者请求的步骤相同）。



**Follower 副本**

从 Leader 拉取消息的处理逻辑如下：

* 1）写入消息到本地磁盘。
* 2）更新 LEO 值。
* 3）更新高水位值。
  * 获取 Leader 发送的高水位值：currentHW。
  * 获取步骤 2 中更新过的 LEO 值：currentLEO。
  * 更新高水位为 min(currentHW, currentLEO)。



### 副本同步机制解析

首先是初始状态。下面这张图中的 remote LEO 就是刚才的远程副本的 LEO 值。在初始状态时，所有值都是 0。

![Sync-1][Sync-1]



当生产者给主题分区发送一条消息后，状态变更为：

![Sync-2][Sync-2]

此时，Leader 副本成功将消息写入了本地磁盘，故 LEO 值被更新为 1。

Follower 再次尝试从 Leader 拉取消息。和之前不同的是，这次有消息可以拉取了，因此状态进一步变更为：

![Sync-3][Sync-3]

这时，Follower 副本也成功地更新 LEO 为 1。此时，Leader 和 Follower 副本的 LEO 都是 1，但各自的高水位依然是 0，还没有被更新。它们需要在下一轮的拉取中被更新，如下图所示：

![Sync-4][Sync-4]

在新一轮的拉取请求中，由于位移值是 0 的消息已经拉取成功，因此 Follower 副本这次请求拉取的是位移值 =1 的消息。Leader 副本接收到此请求后，更新远程副本 LEO 为 1，然后更新 Leader 高水位为 1。做完这些之后，它会将当前已更新过的高水位值 1 发送给 Follower 副本。Follower 副本接收到以后，也将自己的高水位值更新成 1。至此，一次完整的消息同步周期就结束了。事实上，Kafka 就是利用这样的机制，实现了 Leader 和 Follower 副本之间的同步。



### 消息丢失问题

从刚才的分析中，我们知道，Follower 副本的高水位更新需要一轮额外的拉取请求才能实现。如果把上面那个例子扩展到多个 Follower 副本，情况可能更糟，也许需要多轮拉取请求。也就是说，**Leader 副本高水位更新和 Follower 副本高水位更新在时间上是存在错配的**。这种错配是很多“数据丢失”或“数据不一致”问题的根源。

![Msg-Lost][Msg-Lost]

开始时，副本 A 和副本 B 都处于正常状态，A 是 Leader 副本。某个使用了默认 acks 设置的生产者程序向 A 发送了两条消息，A 全部写入成功，此时 Kafka 会通知生产者说两条消息全部发送成功。

现在我们假设 Leader 和 Follower 都写入了这两条消息，而且 Leader 副本的高水位也已经更新了，但 Follower 副本高水位还未更新——这是可能出现的。还记得吧，Follower 端高水位的更新与 Leader 端有时间错配。倘若此时副本 B 所在的 Broker 宕机，当它重启回来后，副本 B 会执行日志截断操作，将 LEO 值调整为之前的高水位值，也就是 1。这就是说，位移值为 1 的那条消息被副本 B 从磁盘中删除，此时副本 B 的底层磁盘文件中只保存有 1 条消息，即位移值为 0 的那条消息。

当执行完截断操作后，副本 B 开始从 A 拉取消息，执行正常的消息同步。如果就在这个节骨眼上，副本 A 所在的 Broker 宕机了，那么 Kafka 就别无选择，只能让副本 B 成为新的 Leader，此时，当 A 回来后，需要执行相同的日志截断操作，即将高水位调整为与 B 相同的值，也就是 1。这样操作之后，位移值为 1 的那条消息就从这两个副本中被永远地抹掉了。



## 3. Leader Epoch 机制

社区在 0.11 版本正式引入了 Leader Epoch 概念，来规避因高水位更新错配导致的各种不一致问题。

所谓 Leader Epoch，我们大致可以认为是 Leader 版本。它由两部分数据组成。

* 1）Epoch。一个单调增加的版本号。每当副本领导权发生变更时，都会增加该版本号。小版本号的 Leader 被认为是过期 Leader，不能再行使 Leader 权力。
* 2）起始位移（Start Offset）。Leader 副本在该 Epoch 值上写入的首条消息的位移。

![LEO][LEO]

场景和之前大致是类似的，只不过引用 Leader Epoch 机制后，Follower 副本 B 重启回来后，需要向 A 发送一个特殊的请求去获取 Leader 的 LEO 值。在这个例子中，该值为 2。当获知到 Leader LEO=2 后，B 发现该 LEO 值不比它自己的 LEO 值小，而且缓存中也没有保存任何起始位移值 > 2 的 Epoch 条目，因此 B 无需执行任何日志截断操作。这是对高水位机制的一个明显改进，即副本是否执行日志截断不再依赖于高水位进行判断。

现在，副本 A 宕机了，B 成为 Leader。同样地，当 A 重启回来后，执行与 B 相同的逻辑判断，发现也不用执行日志截断，至此位移值为 1 的那条消息在两个副本中均得到保留。后面当生产者程序向 B 写入新消息时，副本 B 所在的 Broker 缓存中，会生成新的 Leader Epoch 条目：[Epoch=1, Offset=2]。之后，副本 B 会使用这个条目帮助判断后续是否执行日志截断操作。

这样，通过 Leader Epoch 机制，Kafka 完美地规避了这种数据丢失场景。





## 4. 小结

本文主要介绍了 Kafka 的高水位机制以及 Leader Epoch 机制。

高水位的作用：

* 1）定义消息可见性
  * 在分区高水位以下的消息被认为是已提交消息，反之就是未提交消息。消费者只能消费已提交消息。
* 2）帮助 Kafka 完成副本同步



高水位在界定 Kafka 消息对外可见性以及实现副本机制等方面起到了非常重要的作用，但其设计上的缺陷给 Kafka 留下了很多数据丢失或数据不一致的潜在风险。

为此，社区引入了 Leader Epoch 机制，尝试规避掉这类风险。

Leader Epoch，我们大致可以认为是Leader版本。它由两部分数据组成：

* 1）Epoch,一个单调增加的版本号。每当副本领导权发生变更时，都会增加该
  版本号。
* 2）起始位移Leader副本在该Epoch值上写入的首条消息的位移。





> Kafka 系列相关代码见 [Github][Github]



## 5. 参考

`《Kafka 核心技术与实战》`

`《Apache Kafka实战》`

`https://www.cnblogs.com/youngchaolin/p/12641463.html`

`https://juejin.cn/post/6979110739416088607`



[Github]:https://github.com/lixd/kafka-go-example



[Steaming-Pipeline]:https://github.com/lixd/blog/raw/master/images/kafka/hw/Steaming-Pipeline.webp
[HW]:https://github.com/lixd/blog/raw/master/images/kafka/hw/Kafka-Leader%E5%89%AF%E6%9C%AC%E7%9A%84%E9%AB%98%E6%B0%B4%E4%BD%8D%E5%9B%BE.webp
[Other-LEO]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E4%BF%9D%E5%AD%98%E5%85%B6%E4%BB%96%E5%89%AF%E6%9C%ACLEO%E5%80%BC.webp
[Sync-1]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E5%89%AF%E6%9C%AC%E5%90%8C%E6%AD%A51.webp
[Sync-2]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E5%89%AF%E6%9C%AC%E5%90%8C%E6%AD%A52.webp
[Sync-3]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E5%89%AF%E6%9C%AC%E5%90%8C%E6%AD%A53.webp
[Sync-4]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E5%89%AF%E6%9C%AC%E5%90%8C%E6%AD%A54.webp
[Msg-Lost]:https://github.com/lixd/blog/raw/master/images/kafka/hw/%E6%B6%88%E6%81%AF%E4%B8%A2%E5%A4%B1.webp
[LEO]:https://github.com/lixd/blog/raw/master/images/kafka/hw/Leader%20Epoch%E9%98%B2%E6%AD%A2%E6%B6%88%E6%81%AF%E4%B8%A2%E5%A4%B1.webp

