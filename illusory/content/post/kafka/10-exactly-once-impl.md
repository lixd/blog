---
title: "Kafka(Go)教程(十)---Kafka 是如何实现精确一次（exactly once）语义的？"
description: "Kafka是如何实现精确一次（exactly once）语义的？"
date: 2021-09-03 22:00:00
draft: false
categories: ["Kafka"]
tags: ["Kafka"]
---

本文主要讲述了Kafka 消息交付可靠性保障以及精确处理一次语义的实现，具体包括幂等生产者和事务生产者。

<!--more-->

> Kakfa 相关代码见 [Github][Github]

## 1. 概述

所谓的消息交付可靠性保障，是指 Kafka 对 Producer 和 Consumer 要处理的消息提供什么样的承诺。常见的承诺有以下三种：

* 最多一次（at most once）：消息可能会丢失，但绝不会被重复发送。
* 至少一次（at least once）：消息不会丢失，但有可能被重复发送。
* 精确一次（exactly once）：消息不会丢失，也不会被重复发送。

目前，Kafka **默认提供**的交付可靠性保障是第二种，即`至少一次`。

这样虽然不出丢失消息，但是会导致消息**重复发送**。

Kafka 也可以提供最多一次交付保障，只需要让 Producer 禁止重试即可。

这样一来肯定不会重复发送，但是可能会丢失消息。

> 无论是至少一次还是最多一次，都不如精确一次来得有吸引力。大部分用户还是希望消息只会被交付一次，这样的话，消息既不会丢失，也不会被重复处理。

**Kafka 分别通过 幂等性（Idempotence）和事务（Transaction）这两种机制实现了 精确一次（exactly once）语义。**



## 2. 幂等性（Idempotence）

`幂等`这个词原是数学领域中的概念，指的是某些操作或函数能够被执行多次，但每次得到的结果都是不变的。

**幂等性最大的优势在于我们可以安全地重试任何幂等性操作，反正它们也不会破坏我们的系统状态。**

在 Kafka 中，Producer 默认不是幂等性的，但我们可以创建幂等性 Producer。它其实是 0.11.0.0 版本引入的新功能。指定 Producer 幂等性的方法很简单，仅需要设置一个参数即可，即 `props.put(“enable.idempotence”, ture)`，或 `props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG， true)`。



enable.idempotence 被设置成 true 后，Producer 自动升级成幂等性 Producer，其他所有的代码逻辑都不需要改变。Kafka 自动帮你做消息的重复去重。

底层具体的原理很简单，就是经典的用`空间去换时间`的优化思路，即**在 Broker 端多保存一些字段。当 Producer 发送了具有相同字段值的消息后，Broker 能够自动知晓这些消息已经重复了，于是可以在后台默默地把它们“丢弃”掉**。

> 当然，实际的实现原理并没有这么简单，但你大致可以这么理解。



Kafka 为了实现幂等性，它在底层设计架构中引入了 ProducerID 和 SequenceNumber。

Producer 需要做的只有两件事：

- 1）初始化时像向 Broker 申请一个 ProducerID
- 2）为每条消息绑定一个 SequenceNumber

Kafka Broker 收到消息后会以 ProducerID 为单位存储 SequenceNumber，也就是说即时 Producer 重复发送了， Broker 端也会将其过滤掉。



实现比较简单，同样的限制也比较大：

* **首先，它只能保证单分区上的幂等性**。即一个幂等性 Producer 能够保证某个主题的一个分区上不出现重复消息，它无法实现多个分区的幂等性。
  - 因为 SequenceNumber 是以 Topic + Partition 为单位单调递增的，如果一条消息被发送到了多个分区必然会分配到不同的 SequenceNumber ,导致重复问题。
* **其次，它只能实现单会话上的幂等性**。不能实现跨会话的幂等性。当你重启 Producer 进程之后，这种幂等性保证就丧失了。
  - 重启 Producer 后会分配一个新的 ProducerID，相当于之前保存的 SequenceNumber 就丢失了。



## 3. 事务（Transaction）

Kafka 的事务概念类似于我们熟知的数据库提供的事务。

Kafka 自 0.11 版本开始也提供了对事务的支持，目前主要是在 read committed 隔离级别上做事情。它能保证多条消息原子性地写入到目标分区，同时也能保证 Consumer 只能看到事务成功提交的消息。



事务型 Producer 能够保证将消息原子性地写入到多个分区中。这批消息要么全部写入成功，要么全部失败。另外，事务型 Producer 也不惧进程的重启。Producer 重启回来后，Kafka 依然保证它们发送消息的精确一次处理。

设置事务型 Producer 的方法也很简单，满足两个要求即可：

* 和幂等性 Producer 一样，开启 enable.idempotence = true。
* 设置 Producer 端参数 transactional. id。最好为其设置一个有意义的名字。

此外，你还需要在 Producer 代码中做一些调整，如这段代码所示：

```java

producer.initTransactions();
try {
            producer.beginTransaction();
            producer.send(record1);
            producer.send(record2);
            producer.commitTransaction();
} catch (KafkaException e) {
            producer.abortTransaction();
}
```

和普通 Producer 代码相比，事务型 Producer 的显著特点是调用了一些事务 API，如 initTransaction、beginTransaction、commitTransaction 和 abortTransaction，它们分别对应事务的初始化、事务开始、事务提交以及事务终止。



这段代码能够保证 Record1 和 Record2 被当作一个事务统一提交到 Kafka，要么它们全部提交成功，要么全部写入失败。

实际上即使写入失败，Kafka 也会把它们写入到底层的日志中，也就是说 Consumer 还是会看到这些消息。因此在 Consumer 端，读取事务型 Producer 发送的消息也是需要一些变更的。修改起来也很简单，设置 isolation.level 参数的值即可。当前这个参数有两个取值：



* read_uncommitted：这是默认值，表明 Consumer 能够读取到 Kafka 写入的任何消息，不论事务型 Producer 提交事务还是终止事务，其写入的消息都可以读取。
  * 很显然，如果你用了事务型 Producer，那么对应的 Consumer 就不要使用这个值。
* read_committed：表明 Consumer 只会读取事务型 Producer 成功提交事务写入的消息。
  * 当然了，它也能看到非事务型 Producer 写入的所有消息。





## 4. Go 客户端

> Go 客户端 sarama 暂时并没有实现 事务功能。



### 幂等性 Producer

sarama 中使用幂等性 Producer 设置和 Java 客户端也差不多：

```go
	config := sarama.NewConfig()
	config.Producer.Idempotent = true                // 1.开启幂等性
	config.Producer.RequiredAcks = sarama.WaitForAll // 开启幂等性后 acks 必须设置为 -1 即所有 isr 列表中的 broker 都ack后才ok
	config.Net.MaxOpenRequests = 1                   // 并发请求数也只能为1
	// 上述的几个额外配置完全可以由 sarama 内置,或者直接提供一个方法即可，全部需要调用者手动配置感觉体验不是很好
```

除了开启 Idempotent 之外还必须配置其他几个配置项，具体条件如下：

```go
	if c.Producer.Idempotent {
		if !c.Version.IsAtLeast(V0_11_0_0) {
			return ConfigurationError("Idempotent producer requires Version >= V0_11_0_0")
		}
		if c.Producer.Retry.Max == 0 {
			return ConfigurationError("Idempotent producer requires Producer.Retry.Max >= 1")
		}
		if c.Producer.RequiredAcks != WaitForAll {
			return ConfigurationError("Idempotent producer requires Producer.RequiredAcks to be WaitForAll")
		}
		if c.Net.MaxOpenRequests > 1 {
			return ConfigurationError("Idempotent producer requires Net.MaxOpenRequests to be 1")
		}
	}
```

* Kafka 版本必须大于 V0_11_0_0。

* Retry 次数必须大于0 ，不然发送失败后不能 Retry 就保证不了 Exactly Once 了。
  * 默认值为3，不需要手动设置。

* Acks 必须为 -1，即所有 ISR 中的 Broker 都返回才算成功。

* 最后并发请求数必须为1，不能并发请求。



Producer 完整代码如下：

```go
func Producer(topic string, limit int) {
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	config.Producer.Return.Errors = true
	config.Producer.Idempotent = true                // 开启幂等性
	config.Producer.RequiredAcks = sarama.WaitForAll // 开启幂等性后 acks 必须设置为 -1 即所有 isr 列表中的 broker 都ack后才ok
	config.Net.MaxOpenRequests = 1                   // 开启幂等性后 并发请求数也只能为1
	// 上述的几个额外配置完全可以由 sarama 内置,或者直接提供一个方法即可，全部需要调用者手动配置感觉体验不是很好
	producer, err := sarama.NewSyncProducer([]string{conf.HOST}, config)
	if err != nil {
		log.Fatal("NewSyncProducer err:", err)
	}
	defer producer.Close()
	for i := 0; i < limit; i++ {
		str := strconv.Itoa(int(time.Now().UnixNano()))
		msg := &sarama.ProducerMessage{Topic: topic, Key: sarama.StringEncoder(str), Value: sarama.StringEncoder(str)}
		partition, offset, err := producer.SendMessage(msg)
		if err != nil {
			log.Println("SendMessage err: ", err)
			return
		}
		log.Printf("[Producer] partitionid: %d; offset:%d, value: %s\n", partition, offset, str)
	}
}
```



> 注意：幂等性 Producer 保证的是同一条消息不会因为 Kafka 的原因发送多次，并不是说会过滤掉重复消息。一直发送相同内容的消息，依旧会正常发送成功。
>
> 即：Producer 中的去重并不依赖根据消息内容。



### 源码分析

通过源码简单分析一下 samara 中的 幂等性 Producer 是如何实现的。

> 大致原理：发送消息后会在 Producer 中记录一个字段用于去重。

具体 Producer 逻辑在上文[Kafka(Go)教程(六)---sarama 客户端 producer 源码分析](https://www.lixueduan.com/post/kafka/06-sarama-producer/)有详细介绍，这里也按照这个顺序进行分析。



####  newAsyncProducer

首先在创建 Producer 的时候会调用`newTransactionManager`创建一个`TransactionManager`,这个就是用于保证 幂等性的。

```go
func newAsyncProducer(client Client) (AsyncProducer, error) {

	txnmgr, err := newTransactionManager(client.Config(), client)
	if err != nil {
		return nil, err
	}

	p := &asyncProducer{
		client:     client,
		conf:       client.Config(),
		errors:     make(chan *ProducerError),
		input:      make(chan *ProducerMessage),
		successes:  make(chan *ProducerMessage),
		retries:    make(chan *ProducerMessage),
		brokers:    make(map[*Broker]*brokerProducer),
		brokerRefs: make(map[*brokerProducer]int),
		txnmgr:     txnmgr,
	}
	return p, nil
}
```

transactionManager 结构如下：

```go
type transactionManager struct {
	producerID      int64
	producerEpoch   int16
	sequenceNumbers map[string]int32
	mutex           sync.Mutex
}
```

其中 `producerID`+`producerEpoch`用于区分 Producer，**`sequenceNumbers`则是用于消息去重**。



进入`newTransactionManager`看下具体实现：

```go
func newTransactionManager(conf *Config, client Client) (*transactionManager, error) {
	txnmgr := &transactionManager{
		producerID:    noProducerID,
		producerEpoch: noProducerEpoch,
	}
	// 如果开启了 幂等性 特殊处理
	if conf.Producer.Idempotent {
		initProducerIDResponse, err := client.InitProducerID()
		if err != nil {
			return nil, err
		}
		txnmgr.producerID = initProducerIDResponse.ProducerID
		txnmgr.producerEpoch = initProducerIDResponse.ProducerEpoch
		txnmgr.sequenceNumbers = make(map[string]int32)
		txnmgr.mutex = sync.Mutex{}

		Logger.Printf("Obtained a ProducerId: %d and ProducerEpoch: %d\n", txnmgr.producerID, txnmgr.producerEpoch)
	}

	return txnmgr, nil
}
```

可以看到 如果开启了 幂等性 则会调用`client.InitProducerID()`像 Kafka  Broker 发送请求，申请一个 ProducerID，用以区分不同 Producer。

> 具体生成规则由 Kafka Broker端实现。



#### dispatch

```go
func (pp *partitionProducer) dispatch() {
    	// msg.retries == 0 保证了每条消息只会生成一次序号
		if pp.parent.conf.Producer.Idempotent && msg.retries == 0 && msg.flags == 0 {
			msg.sequenceNumber, msg.producerEpoch = pp.parent.txnmgr.getAndIncrementSequenceNumber(msg.Topic, msg.Partition)
			msg.hasSequence = true
		}

		pp.brokerProducer.input <- msg
	}
}
```

```go
func (t *transactionManager) getAndIncrementSequenceNumber(topic string, partition int32) (int32, int16) {
	key := fmt.Sprintf("%s-%d", topic, partition) // 序号是以分区为单位的 这也是为什么只能保证指定分区下的 ExactlyOnce
	t.mutex.Lock() // 加锁保证并发安全
	defer t.mutex.Unlock()
	sequence := t.sequenceNumbers[key]
	t.sequenceNumbers[key] = sequence + 1 // seq 是递增的
	return sequence, t.producerEpoch
}
```

>  fmt.Sprintf 拼接字符串效率特别低，不建议使用。

在把消息交给 brokerProducer 之前给消息分配了一个 `sequenceNumber`,**通过这个序号来保证了同一条消息只会发送一次，以实现  Exactly Once 语义**。



#### add

最后到了 brokerProducer 的 add 方法，堆积消息批量发送。

```go
func (ps *produceSet) add(msg *ProducerMessage) error {

	var size int

	set := partitions[msg.Partition]
	if set == nil {
		if ps.parent.conf.Version.IsAtLeast(V0_11_0_0) {
			batch := &RecordBatch{
				FirstTimestamp:   timestamp,
				Version:          2,
				Codec:            ps.parent.conf.Producer.Compression,
				CompressionLevel: ps.parent.conf.Producer.CompressionLevel,
				ProducerID:       ps.producerID,
				ProducerEpoch:    ps.producerEpoch,
			}
            // 如果是幂等性 Producer 则在这里把消息的 seq 赋值给 batch.FirstSequence
            // 由于只有 set == nil 时才会执行该逻辑 所以 batch.FirstSequence 只会被第一条消息赋值
			if ps.parent.conf.Producer.Idempotent {
				batch.FirstSequence = msg.sequenceNumber
			}
			set = &partitionSet{recordsToSend: newDefaultRecords(batch)}
			size = recordBatchOverhead
		} else {
			set = &partitionSet{recordsToSend: newLegacyRecords(new(MessageSet))}
		}
		partitions[msg.Partition] = set
	}

	if ps.parent.conf.Version.IsAtLeast(V0_11_0_0) {
        // 最后判断当前消息的 sequenceNumber 是否小于 batch 的 FirstSequence 这里的 set.recordsToSend.RecordBatch 就是上面的 batch
       	// 所以正常情况下 msg.sequenceNumber 应该是大于等于 FirstSequence 的
		if ps.parent.conf.Producer.Idempotent && msg.sequenceNumber < set.recordsToSend.RecordBatch.FirstSequence {
			return errors.New("assertion failed: message out of sequence added to a batch")
		}
	}


	return nil
}

```

在初始化 Set 时将当前 msg 的 seq 赋值给了 Set，而 Seq 是单调递增的，所以后续 msg 的 seq 应该都大于 Set 的 FirstSequence。



#### 小结

Producer 逻辑基本分析完了，和前面分析的一样，Producer 需要做的只有两件事：

* 1）初始化时像向 Broker 申请一个 ProducerID
* 2）为每条消息绑定一个 SequenceNumber

具体重复消息过滤其实是由 Kafka 实现的。



## 5. 小结

> Kakfa 相关代码见 [Github][Github]



幂等性 Producer 和事务型 Producer 都是 Kafka 社区力图为 Kafka 实现精确一次处理语义所提供的工具，只是它们的作用范围是不同的。

* 幂等性 Producer 只能保证单分区、单会话上的消息幂等性；
* 而事务能够保证跨分区、跨会话间的幂等性。

从交付语义上来看，自然是事务型 Producer 能做的更多。天下没有免费的午餐。**比起幂等性 Producer，事务型 Producer 的性能要更差**，在实际使用过程中，我们需要仔细评估引入事务的开销，切不可无脑地启用事务。



> 最后还是建议实际使用时在 Consumer 端也要进行去重，防止重复消费，这样比较稳妥。



## 6. 参考

`https://github.com/Shopify/sarama`

`https://www.cnblogs.com/smartloli/p/11922639.html`

`《Kafka 核心技术与实战》`





[Github]:https://github.com/lixd/kafka-go-example

