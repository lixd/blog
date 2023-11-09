---
title: "Kafka(Go)教程(十一)---Consumer Group & Rebalance"
description: "Kafka 消费者组和 Rebalance 及如何避免无效 Rebalance"
date: 2021-09-10 22:00:00
draft: false
categories: ["Kafka"]
tags: ["Kafka"]
---

本文主要讲述了 Kafka 的消费者组（Consumer Group）和 消费者组的 Rebalance 及如何避免无效 Rebalance。

<!--more-->

> Kakfa 相关代码见 [Github][Github]



## 1. 传统消息模型

传统消息模型一般分为消息队列模型和发布订阅模型：

* 1）消息队列模型的缺陷在于消息一旦被消费，就会从队列中被删除，而且只能被下游的一个 Consumer 消费。这种模型的伸缩性（scalability）很差，因为下游的多个 Consumer 都要“抢”这个共享消息队列的消息。

* 2）发布 / 订阅模型倒是允许消息被多个 Consumer 消费，但它的问题也是伸缩性不高，因为每个订阅者都必须要订阅主题的所有分区。这种全量订阅的方式既不灵活，也会影响消息的真实投递效果。

Kafka 的 Consumer Group 机制正好避开这两种模型的缺陷，又兼具它们的优点。

**Kafka 仅仅使用 Consumer Group 这一种机制，却同时实现了传统消息引擎系统的两大模型**：

* 如果所有实例都属于同一个 Group，那么它实现的就是消息队列模型；
* 如果所有实例分别属于不同的 Group，那么它实现的就是发布 / 订阅模型。



## 2. Consumer Group

**Consumer Group 是 Kafka 提供的可扩展且具有容错性的消费者机制。**

组内可以有多个消费者或消费者实例（Consumer Instance），它们共享一个公共的 ID，这个 ID 被称为 `Group ID`。组内的所有消费者协调在一起来消费订阅主题（Subscribed Topics）的所有分区（Partition）。当然，**每个分区只能由同一个消费者组内的一个 Consumer 实例来消费**。

* Consumer Group 下可以有一个或多个 Consumer 实例。这里的实例可以是一个单独的进程，也可以是同一进程下的线程。
  * 在实际场景中，使用进程更为常见一些。
* Group ID 是一个字符串，在一个 Kafka 集群中，它标识唯一的一个 Consumer Group。
* Consumer Group 下所有实例订阅的主题的单个分区，只能分配给组内的某个 Consumer 实例消费。
  * 这个分区当然也可以被其他的 Group 消费。

**理想情况下，Consumer 实例的数量应该等于该 Group 订阅主题的分区总数**，这样能最大限度地实现高伸缩性。

注意：Consumer Group 中的实例是以 分区 为单位进行消费的，如果实例数大于分区数就会导致有的实例无法消费到任何消息。

> 假如有 6 个分区，Consumer Group 中却有 8 个实例，那么有两个实例将不会被分配任何分区，它们永远处于空闲状态。

因此，在实际使用过程中**一般不推荐设置大于总分区数的 Consumer 实例**。



## 3. Rebalance

### Rebalance 流程

**Rebalance 本质上是一种协议，规定了一个 Consumer Group 下的所有 Consumer 如何达成一致，来分配订阅 Topic 的每个分区**。

比如某个 Group 下有 20 个 Consumer 实例，它订阅了一个具有 100 个分区的 Topic。正常情况下，Kafka 平均会为每个 Consumer 分配 5 个分区。这个分配的过程就叫 Rebalance。

那么 Consumer Group 何时进行 Rebalance 呢？Rebalance 的触发条件有 3 个。

* 1）组成员数发生变更。比如有新的 Consumer 实例加入组或者离开组，亦或是有 Consumer 实例崩溃被“踢出”组。
* 2）订阅主题数发生变更。Consumer Group 可以使用正则表达式的方式订阅主题，比如 consumer.subscribe(Pattern.compile("t.*c")) 就表明该 Group 订阅所有以字母 t 开头、字母 c 结尾的主题。在 Consumer Group 的运行过程中，你新创建了一个满足这样条件的主题，那么该 Group 就会发生 Rebalance。
* 3）订阅主题的分区数发生变更。Kafka 当前只能允许增加一个主题的分区数。当分区数增加时，就会触发订阅该主题的所有 Group 开启 Rebalance。

假设目前某个 Consumer Group 下有两个 Consumer，比如 A 和 B，当第三个成员 C 加入时，Kafka 会触发 Rebalance，并根据默认的分配策略重新为 A、B 和 C 分配分区，如下图所示：

![rebalance][rebalance]

### Rebalance 的弊端

**在 Rebalance 过程中，所有 Consumer 实例都会停止消费，等待 Rebalance 完成**。这是 Rebalance 为人诟病的一个方面。

其次，目前 Rebalance 的设计是所有 Consumer 实例共同参与，全部重新分配所有分区。

> 其实更高效的做法是尽量减少分配方案的变动。例如实例 A 之前负责消费分区 1、2、3，那么 Rebalance 之后，如果可能的话，最好还是让实例 A 继续消费分区 1、2、3，而不是被重新分配其他的分区。这样的话，实例 A 连接这些分区所在 Broker 的 TCP 连接就可以继续用，不用重新创建连接其他 Broker 的 Socket 资源。

最后，Rebalance 实在是太慢了。

> 曾经，有个国外用户的 Group 内有几百个 Consumer 实例，成功 Rebalance 一次要几个小时！这完全是不能忍受的。最悲剧的是，目前社区对此无能为力，至少现在还没有特别好的解决方案。



> 因此一些大数据框架都使用的 standalone consumer。



### 避免无效 Rebalance

要避免 Rebalance，还是要从 Rebalance 发生的时机入手：

* 1）组成员数量发生变化
* 2）订阅主题数量发生变化
* 3）订阅主题的分区数发生变化

后面两个通常都是运维的主动操作，所以它们引发的 Rebalance 大都是不可避免的。所以我们主要说说因为组成员数量变化而引发的 Rebalance 该如何避免。

如果 Consumer Group 下的 Consumer 实例数量发生变化，就一定会引发 Rebalance。这是 Rebalance 发生的最常见的原因。

除了手动启动或停止之外，Consumer 实例可能会被 Coordinator  错误地认为“已停止”从而被“踢出”Group。如果是这个原因导致的 Rebalance，我们就不能不管了。

> Coordinator  即协调者，它专门为 Consumer Group 服务，负责为 Group 执行 Rebalance 以及提供位移管理和组成员管理等。



当 Consumer Group 完成 Rebalance 之后，每个 Consumer 实例都会定期地向 Coordinator 发送心跳请求，表明它还存活着。如果某个 Consumer 实例不能及时地发送这些心跳请求，Coordinator 就会认为该 Consumer 已经“死”了，从而将其从 Group 中移除，然后开启新一轮 Rebalance。

Consumer 端有个参数，叫 **session.timeout.ms**，就是被用来表征此事的。该参数的默认值是 10 秒，即如果 Coordinator 在 10 秒之内没有收到 Group 下某 Consumer 实例的心跳，它就会认为这个 Consumer 实例已经挂了。可以这么说，session.timeout.ms 决定了 Consumer 存活性的时间间隔。

Consumer 还提供了一个允许你控制发送心跳请求频率的参数，就是 **heartbeat.interval.ms**。这个值设置得越小，Consumer 实例发送心跳请求的频率就越高。频繁地发送心跳请求会额外消耗带宽资源，但好处是能够更加快速地知晓当前是否开启 Rebalance，因为，目前 Coordinator 通知各个 Consumer 实例开启 Rebalance 的方法，就是将 REBALANCE_NEEDED 标志封装进心跳请求的响应体中。

Consumer 端还有一个参数，用于控制 Consumer 实际消费能力对 Rebalance 的影响，即 **max.poll.interval.ms** 参数。它限定了 Consumer 端应用程序两次调用 poll 方法的最大时间间隔。它的默认值是 5 分钟，表示你的 Consumer 程序如果在 5 分钟之内无法消费完 poll 方法返回的消息，那么 Consumer 会主动发起“离开组”的请求，Coordinator 也会开启新一轮 Rebalance。



**第一类非必要 Rebalance 是因为未能及时发送心跳，导致 Consumer 被“踢出”Group 而引发的**。因此，你需要仔细地设置 `session.timeout.ms` 和 `heartbeat.interval.ms` 的值。我在这里给出一些推荐数值，你可以“无脑”地应用在你的生产环境中。

* 设置 session.timeout.ms = 6s。
* 设置 heartbeat.interval.ms = 2s。
* 要保证 Consumer 实例在被判定为“dead”之前，能够发送至少 3 轮的心跳请求，即 session.timeout.ms >= 3 * heartbeat.interval.ms。

**第二类非必要 Rebalance 是 Consumer 消费时间过长导致的**。`max.poll.interval.ms` 参数值的设置显得尤为关键。如果要避免非预期的 Rebalance，你最好将该参数值设置得大一点，比你的下游最大处理时间稍长一点。



**最后 Consumer 端的因为 GC 设置不合理导致程序频发 Full GC 也可能引发非预期 Rebalance**。

小结，调整以下 4 个参数以避免无效 Rebalance：

* session.timeout.ms
* heartbeat.interval.ms
* max.poll.interval.ms
* GC 参数



## 4. Go 客户端

```go
// sarama 库中消费者组为一个接口 sarama.ConsumerGroup 所有实现该接口的类型都能当做消费者组使用。

// MyConsumerGroupHandler 实现 sarama.ConsumerGroup 接口，作为自定义ConsumerGroup
type MyConsumerGroupHandler struct {
	name  string
	count int64
}

// Setup 执行在 获得新 session 后 的第一步, 在 ConsumeClaim() 之前
func (MyConsumerGroupHandler) Setup(_ sarama.ConsumerGroupSession) error { return nil }

// Cleanup 执行在 session 结束前, 当所有 ConsumeClaim goroutines 都退出时
func (MyConsumerGroupHandler) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }

// ConsumeClaim 具体的消费逻辑
func (h MyConsumerGroupHandler) ConsumeClaim(sess sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		fmt.Printf("[consumer] name:%s topic:%q partition:%d offset:%d\n", h.name, msg.Topic, msg.Partition, msg.Offset)
		// 标记消息已被消费 内部会更新 consumer offset
		sess.MarkMessage(msg, "")
		h.count++
		if h.count%10000 == 0 {
			fmt.Printf("name:%s 消费数:%v\n", h.name, h.count)
		}
	}
	return nil
}

func ConsumerGroup(topic, group, name string) {
	config := sarama.NewConfig()
	config.Consumer.Return.Errors = true
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cg, err := sarama.NewConsumerGroup([]string{conf.HOST}, group, config)
	if err != nil {
		log.Fatal("NewConsumerGroup err: ", err)
	}
	defer cg.Close()
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		handler := MyConsumerGroupHandler{name: name}
		for {
			fmt.Println("running: ", name)
			/*
				![important]
				应该在一个无限循环中不停地调用 Consume()
				因为每次 Rebalance 后需要再次执行 Consume() 来恢复连接
				Consume 开始才发起 Join Group 请求 如果当前消费者加入后成为了 消费者组 leader,则还会进行 Rebalance 过程，从新分配
				组内每个消费组需要消费的 topic 和 partition，最后 Sync Group 后才开始消费
				具体信息见 https://github.com/lixd/kafka-go-example/issues/4
			*/
			err = cg.Consume(ctx, []string{topic}, handler)
			if err != nil {
				log.Println("Consume err: ", err)
			}
			// 如果 context 被 cancel 了，那么退出
			if ctx.Err() != nil {
				return
			}
		}
	}()
	wg.Wait()
}

```



注意点：

* 1）需要实现 sarama.ConsumerGroup 接口
* 2）具体消费逻辑在 ConsumeClaim 方法中实现，**消费完成后通过`sess.MarkMessage`标记消息已经被消费**
* 3）**需要在 for 循环中调用 Consume 方法**，因为 Rebalance 的存在会导致连接终端或者被分配到其他 Broker 上去，需要重新建立连接，具体见 [issues#4](https://github.com/lixd/kafka-go-example/issues/4)



## 5. 小结

> Kakfa 相关代码见 [Github][Github]

Consumer Group 是 Kafka 提供的可扩展且具有容错性的消费者机制。

建议消费者组中的实例数等于 Topic 的分区数。



Rebalance 弊端：

* 影响 Consumer 端 TPS
* 很慢
* 效率不高

非必要 Rebalance：

* 因为Consumer没能及时发送心跳请求，导致被踢出”Group而引发的。
* Consumer消费时间过长导致的。

减少 Rebalance 的 4个参数：

* session.timeout.ms
* heartbeat.interval.ms
* max.poll.interval.ms
* GC 参数





## 6. 参考

`https://github.com/Shopify/sarama`、

`《Kafka 核心技术与实战》`





[Github]:https://github.com/lixd/kafka-go-example

[rebalance]:https://github.com/lixd/blog/raw/master/images/kafka/kafka-rebalance.webp
