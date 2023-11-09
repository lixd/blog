---
title: "Kafka(Go)教程(九)---如何避免消息丢失?"
description: "Kafka 如何避免消息丢失"
date: 2021-08-27 22:00:00
draft: false
categories: ["Kafka"]
tags: ["Kafka"]
---

本文主要从 Producer、Broker、Consumer 等 3 个方面分析了 Kafka 应该如何配置才能避免消息丢失。

<!--more-->

> Kakfa 相关代码见 [Github][Github]

## 1. 概述

在使用 MQ 的时候最大的问题就是消息丢失，常见的丢失情况如下：

* 1）Producer 端丢失
* 2）Broker 端丢失
* 3）Consumer 端丢失

一条消息从生产到消费一共要经过以下 3 个流程：

* 1）Producer 发送到 Broker
* 2）Broker 保存消息(持久化)
* 3）Consumer 消费消息

3 个步骤分别对应了上述的 3 种消息丢失场景。

接下来以 Kafka 为例分析该如何避免这些问题。



## 2. Kafka 消息持久化保障

**一句话概括，Kafka 只对“已提交”的消息（committed message）做有限度的持久化保证。**

> 其他 MQ 也类似。



第一个核心要素是**已提交的消息**。

什么是已提交的消息？当 Kafka 的若干个 Broker 成功地接收到一条消息并写入到日志文件后，它们会告诉生产者程序这条消息已成功提交。此时，这条消息在 Kafka 看来就正式变为“已提交”消息了。

那为什么是若干个 Broker 呢？这取决于你对“已提交”的定义。你可以选择只要有一个 Broker 成功保存该消息就算是已提交，也可以是令所有 Broker 都成功保存该消息才算是已提交。不论哪种情况，Kafka 只对已提交的消息做持久化保证这件事情是不变的。

第二个核心要素就是**有限度的持久化保证**。

也就是说 Kafka 不可能保证在任何情况下都做到不丢失消息。

> 举个极端点的例子，如果地球都不存在了，Kafka 还能保存任何消息吗？显然不能！

有限度其实就是说 Kafka 不丢消息是有前提条件的。假如你的消息保存在 N 个 Kafka Broker 上，那么这个前提条件就是这 N 个 Broker 中至少有 1 个存活。只要这个条件成立，Kafka 就能保证你的这条消息永远不会丢失。



## 3. 具体场景分析

### 3.1 Producer 端丢失

Producer 端丢消息更多是因为**消息根本没有提交到 Kafka**。

目前 Kafka Producer 是异步发送消息的，也就是说如果你调用的是 producer.send(msg) 这个 API，那么它通常会立即返回，但此时你不能认为消息发送已成功完成。

> 这种发送方式有个有趣的名字，叫“fire and forget”，翻译一下就是“发射后不管”。如果出现消息丢失，我们是无法知晓的。这个发送方式挺不靠谱,**非常不建议使用**。

导致消息没有发送成功的因素也有很多：

* 1）例如网络抖动，导致消息压根就没有发送到 Broker 端；
* 2）或者消息本身不合格导致 Broker 拒绝接收（比如消息太大了，超过了 Broker 的承受能力）等。

Kafka 不认为消息是已提交的，因此也就没有 Kafka 丢失消息这一说了。

解决方案也很简单：**Producer 永远要使用带有回调通知的发送 API，也就是说不要使用 producer.send(msg)，而要使用 producer.send(msg, callback)**。

通过回调，一旦出现消息提交失败的情况，你就可以有针对性地进行处理。

举例来说：

* 如果是因为那些瞬时错误，那么仅仅让 Producer 重试就可以了；
* 如果是消息不合格造成的，那么可以调整消息格式后再次发送。

总之，处理发送失败的责任在 Producer 端而非 Broker 端。



### 3.2 Broker 端丢失

Broker 丢失消息是由 Kafka 自身原因造成的。Kafka 为了提高吞吐量和性能，采用**异步批量的刷盘策略**，也就是按照一定的消息量和间隔时间进行刷盘。

> Broker 端丢失消息才真的是因为 Kafka 造成的。

Kafka 收到消息后会先存储在也缓存中(Page Cache)中，之后由操作系统根据自己的策略进行刷盘或者通过 fsync 命令强制刷盘。如果系统挂掉，在 PageCache 中的数据就会丢失。

**Kafka没有提供同步刷盘的方式，也就是说单个 Broker 丢失消息是必定会出现的。**

为了解决单个 broker 数据丢失问题，Kafka 通过 producer 和 broker 协同处理单个 broker 丢失参数的情况：

* **acks=0**，producer 不等待 broker 的响应，效率最高，但是消息很可能会丢。
* **acks=1**，leader broker 收到消息后，不等待其他 follower 的响应，即返回 ack。也可以理解为 ack 数为1。
  * 此时，如果 follower 还没有收到 leader 同步的消息 leader 就挂了，那么消息会丢失。
* **acks=-1(-1等效于all)**，leader broker 收到消息后，挂起，等待所有 ISR 列表中的 follower 返回结果后，再返回 ack。
  * 这种配置下，如果 Leader 刚收到消息就断电，producer 可以知道消息没有被发送成功，将会重新发送。
  * 如果在 follower 收到数据以后，成功返回 ack，leader 断电，数据将存在于原来的 follower 中。在重新选举以后，新的leader 会持有该部分数据。

在配置为 all 或者 -1 的时候，只要 Producer 收到 Broker 的响应就可以理解为消息已经持久化了。

> 虽然可能只是刚写入了 PageCache，但是刷盘也就是迟早的事，除非刚好刷盘之前多个 Broker 同时挂了，那确实是没办法了。



建议根据实际情况设置：

* 如果要严格保证消息不丢失，请设置为 all 或 -1；
* 如果允许存在丢失，建议设置为 1；
* 一般不建议设为 0，除非无所谓消息丢不丢失。



### 3.3 Consumer 端丢失

**Consumer 端丢失数据主要体现在 Consumer 端要消费的消息不见了。**

出现该情况的唯一原因就是：**Consumer 没有正确消费消息，就把位移提交了，导致 Kafka 认为该消息已经被消费了，从而导致消息丢失**。

> 可以看出这其实也不是 Kafka 的问题，毕竟 Kafka 也不知道究竟消费没有，只能以 Consumer 提交的位移为依据。



场景1：获取到消息后直接提交位移了，然后再处理消息。

这样在提交位移后，处理完消息前，如果程序挂掉，这部分消息就算是丢失了。

场景2：多线程并发消费消息，且开启了自动提交，导致消费完成之前程序就自动提交了位移，如果程序挂掉也会出现消息丢失。



解决方案也很简单：**确定消费完成后才提交消息，如果是多线程异步处理消费消息，Consumer 程序不要开启自动提交位移，而是要应用程序手动提交位移**。





## 4. 最佳实践

以下为一些常见的 Kafka 无消息丢失的配置：

**避免 Producer 端丢失**

* 1）不要使用 producer.send(msg)，而要使用 producer.send(msg, callback)。记住，一定要使用带有回调通知的 send 方法。
* 2）设置 retries 为一个较大的值。这里的 retries 同样是 Producer 的参数，对应前面提到的 Producer 自动重试。当出现网络的瞬时抖动时，消息发送可能会失败，此时配置了 retries > 0 的 Producer 能够自动重试消息发送，避免消息丢失。



**避免 Broker 端丢失**

* 3）设置 acks = all。acks 是 Producer 的一个参数，代表了你对“已提交”消息的定义。如果设置成 all，则表明所有副本 Broker 都要接收到消息，该消息才算是“已提交”。这是最高等级的“已提交”定义。
* 4）设置 unclean.leader.election.enable = false。这是 Broker 端的参数，它控制的是哪些 Broker 有资格竞选分区的 Leader。如果一个 Broker 落后原先的 Leader 太多，那么它一旦成为新的 Leader，必然会造成消息的丢失。故一般都要将该参数设置成 false，即不允许这种情况的发生。
* 5）设置 replication.factor >= 3。这也是 Broker 端的参数。其实这里想表述的是，最好将消息多保存几份，毕竟目前防止消息丢失的主要机制就是冗余。
* 6）设置 min.insync.replicas > 1。这依然是 Broker 端参数，控制的是消息至少要被写入到多少个副本才算是“已提交”。设置成大于 1 可以提升消息持久性。在实际环境中千万不要使用默认值 1。
* 7）确保 replication.factor > min.insync.replicas。如果两者相等，那么只要有一个副本挂机，整个分区就无法正常工作了。我们不仅要改善消息的持久性，防止数据丢失，还要在不降低可用性的基础上完成。推荐设置成 replication.factor = min.insync.replicas + 1。



**避免 Consumer 端丢失**

* 8）确保消息消费完成再提交。Consumer 端有个参数 enable.auto.commit，最好把它设置成 false，并采用手动提交位移的方式。就像前面说的，这对于单 Consumer 多线程处理的场景而言是至关重要的。



## 5. 小结

> Kakfa 相关代码见 [Github][Github]

消息生命周期中的 3 个地方都可能会出现消息丢失情况：

* 1）Producer 端：通过回调确保消息成功发送到  Kafka 了
* 2）Broker 端：通过多 Broker 以及 Producer 端设置 acks=all 降低消息丢失概率
* 3）Consumer 端：一定要在消息处理完成后再提交位移



需要应用程序和 Kafka 一起配合才能保证消息不丢失。



## 6. 参考

`https://kafka.apache.org/documentation/#configuration`

`《Kafka 核心技术与实战》`





[Github]:https://github.com/lixd/kafka-go-example

