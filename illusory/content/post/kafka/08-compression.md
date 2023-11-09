---
title: "Kafka(Go)教程(八)---生产者压缩算法详解及源码分析"
description: "Kafka 生产者压缩算法及 Go 客户端 sarama 实战和源码分析"
date: 2021-08-21 22:00:00
draft: false
categories: ["Kafka"]
tags: ["Kafka"]
---

本文主要分析了 Kafka 生产者压缩与解压逻辑以及注事事项点，最终通过 Go 客户端 sarama 演示了 压缩算法的具体使用，并通过源码分析了 Go 客户端 sarama 的具体实现。

<!--more-->

> Kakfa 相关代码见 [Github][Github]

## 1. 概述

**压缩（compression）它秉承了用时间去换空间的经典 trade-off 思想**，具体来说就是用 CPU 时间去换磁盘空间或网络 I/O 传输量，希望以较小的 CPU 开销带来更少的磁盘占用或更少的网络 I/O 传输。





## 2. 具体流程

**一句话概括为：Producer 端压缩、Broker 端保持、Consumer 端解压缩。**



### 2.1 压缩

**在 Kafka 中，压缩可能发生在两个地方：Producer 端和 Broker 端。**

Producer 程序中配置 compression.type 参数即表示启用指定类型的压缩算法。比如下面这段程序代码展示了如何构建一个开启 GZIP 的 Producer 对象：

```go
 Properties props = new Properties();
 props.put("bootstrap.servers", "localhost:9092");
 props.put("acks", "all");
 props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
 props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
 // 开启GZIP压缩
 props.put("compression.type", "gzip");
 
 Producer<String, String> producer = new KafkaProducer<>(props);
```

这里比较关键的代码行是 `props.put(“compression.type”, “gzip”)`，它表明该 Producer 的压缩算法使用的是 GZIP。这样 Producer 启动后生产的每个消息集合都是经 GZIP 压缩过的，故而能很好地节省网络传输带宽以及 Kafka Broker 端的磁盘占用。



除了在 Producer 端进行压缩外有两种例外情况就可能让 Broker 重新压缩消息：

1）Broker 端指定了和 Producer 端不同的压缩算法。

比如 Producer 使用 GZIP，而 Broker 只能接收使用 Snappy 算法压缩的消息。这种情况下 Broker 接收到 GZIP 压缩消息后，只能解压缩然后使用 Snappy 重新压缩一遍。

>  Broker 端也有一个参数叫 compression.type  ，默认情况下为 Producer，表示 Broker 端会“尊重” Producer 端使用的压缩算法。
>
> 如果设置了不同的 compression.type 值，可能会发生预料之外的压缩 / 解压缩操作，通常表现为 Broker 端 CPU 使用率飙升。



2）Broker 端发生了消息格式转换。

**Kafka 的消息层次分为两层：消息集合（message set）以及消息（message）**。一个消息集合中包含若干条日志项（record item），而日志项才是真正封装消息的地方。Kafka 底层的消息日志由一系列消息集合日志项组成。Kafka 通常不会直接操作具体的一条条消息，它总是在消息集合这个层面上进行写入操作。

目前 Kafka 共有两大类消息格式，社区分别称之为 V1 版本和 V2 版本。V2 版本是 Kafka 0.11.0.0 中正式引入的。

V2 版本优化点：

* 1）在 V1 版本中，每条消息都需要执行 CRC 校验，比较浪费 CPU ，在 V2 版本中，消息的 CRC 校验工作就被移到了消息集合这一层。

* 2）V1 版本中保存压缩消息的方法是把多条消息进行压缩然后保存到外层消息的消息体字段中；而 V2 版本的做法是对整个消息集合进行压缩。显然后者应该比前者有更好的压缩效果。



在一个生产环境中，Kafka 集群中同时保存多种版本的消息格式非常常见。**为了兼容老版本的格式，Broker 端会对新版本消息执行向老版本格式的转换。这个过程中会涉及消息的解压缩和重新压缩**。一般情况下这种消息格式转换对性能是有很大影响的，**除了这里的压缩之外，它还让 Kafka 丧失了引以为豪的 Zero Copy 特性**。

> Zero Copy 的前提就是应用程序不需要对数据进行处理。



### 2.2 解压

**通常来说解压缩发生在 Consumer 程序中**，也就是说 Producer 发送压缩消息到 Broker 后，Broker 照单全收并原样保存起来。当 Consumer 程序请求这部分消息时，Broker 依然原样发送出去，当消息到达 Consumer 端后，由 Consumer 自行解压缩还原成之前的消息。

**为了让 Consumer 知道使用哪种压缩算法，Kafka 会将启用了哪种压缩算法封装进消息集合中**，这样当 Consumer 读取到消息集合时，它自然就知道了这些消息使用的是哪种压缩算法。



Broker 端也会进行解压缩。每个压缩过的消息集合在 Broker 端写入时都要发生解压缩操作，**目的就是为了对消息执行各种验证**。而且这种校验是非常重要的，也不能直接去掉。

> 这种解压缩对 Broker 端性能是有一定影响的，特别是对 CPU 的使用率而言。



## 3. 压缩算法

先比较一下各个压缩算法的优劣，这样我们才能有针对性地配置适合我们业务的压缩策略。

看一个压缩算法的优劣，有两个重要的指标：一个指标是压缩比，另一个指标就是压缩 / 解压缩吞吐量。

下面这张表是 [Facebook Zstandard](https://github.com/facebook/zstd/)提供的一份压缩算法 benchmark 比较结果：

| Compressor name         | Ratio | Compression | Decompress. |
| ----------------------- | ----- | ----------- | ----------- |
| **zstd 1.4.5 -1**       | 2.884 | 500 MB/s    | 1660 MB/s   |
| zlib 1.2.11 -1          | 2.743 | 90 MB/s     | 400 MB/s    |
| brotli 1.0.7 -0         | 2.703 | 400 MB/s    | 450 MB/s    |
| **zstd 1.4.5 --fast=1** | 2.434 | 570 MB/s    | 2200 MB/s   |
| **zstd 1.4.5 --fast=3** | 2.312 | 640 MB/s    | 2300 MB/s   |
| quicklz 1.5.0 -1        | 2.238 | 560 MB/s    | 710 MB/s    |
| **zstd 1.4.5 --fast=5** | 2.178 | 700 MB/s    | 2420 MB/s   |
| lzo1x 2.10 -1           | 2.106 | 690 MB/s    | 820 MB/s    |
| lz4 1.9.2               | 2.101 | 740 MB/s    | 4530 MB/s   |
| **zstd 1.4.5 --fast=7** | 2.096 | 750 MB/s    | 2480 MB/s   |
| lzf 3.6 -1              | 2.077 | 410 MB/s    | 860 MB/s    |
| snappy 1.1.8            | 2.073 | 560 MB/s    | 1790 MB/s   |

从表中我们可以发现 zstd 算法有着最高的压缩比，而在吞吐量上的表现只能说中规中矩。反观 LZ4 算法，它在吞吐量方面则是毫无疑问的执牛耳者。



在实际使用中，GZIP、Snappy、LZ4 甚至是 zstd 的表现各有千秋。但对于 Kafka 而言，它们的性能测试结果却出奇得一致，即：

* 在吞吐量方面：LZ4 > Snappy > zstd 和 GZIP；
* 而在压缩比方面，zstd > LZ4 > GZIP > Snappy。

* 具体到物理资源，使用 Snappy 算法占用的网络带宽最多，zstd 最少，这是合理的，毕竟 zstd 就是要提供超高的压缩比；
* 在 CPU 使用率方面，各个算法表现得差不多，只是在压缩时 Snappy 算法使用的 CPU 较多一些，而在解压缩时 GZIP 算法则可能使用更多的 CPU。



## 4. Go 压缩实战

不同语言客户端的 解压和压缩可能会有差异，但是大致流程应该不会变化。

### 4.1 Demo

Go 里面使用压缩也是在 Producer 端通过 config 进行配置,相关配置如下：

```go
type Config struct{
    Producer struct {
        Compression CompressionCodec
		CompressionLevel int
    }
}
type CompressionCodec int8
```

通过`Config.Producer.Compression`指定压缩算法，通过`Config.Producer.CompressionLevel`指定压缩等级。

压缩算法是通过枚举值指定的，内置算法列表如下：

```go
const (
	// CompressionNone no compression
	CompressionNone CompressionCodec = iota
	// CompressionGZIP compression using GZIP
	CompressionGZIP
	// CompressionSnappy compression using snappy
	CompressionSnappy
	// CompressionLZ4 compression using LZ4
	CompressionLZ4
	// CompressionZSTD compression using ZSTD
	CompressionZSTD
)
```

> 具体使用哪种算法还要根据 Kafka 版本决定，不同 Kafka 版本的这些算法的支持不一样。



完整代码如下：

```go

var defaultMsg = strings.Repeat("Golang", 1000)

func Producer(topic string, limit int) {
	config := sarama.NewConfig()
	// config.Producer.Compression = sarama.CompressionGZIP
	// config.Producer.CompressionLevel = gzip.BestCompression
	config.Producer.Return.Successes = true
	config.Producer.Return.Errors = true // 这个默认值就是 true 可以不用手动 赋值

	producer, err := sarama.NewSyncProducer([]string{kafka.HOST}, config)
	if err != nil {
		log.Fatal("NewSyncProducer err:", err)
	}
	defer producer.Close()
	for i := 0; i < limit; i++ {
		msg := &sarama.ProducerMessage{Topic: topic, Key: nil, Value: sarama.StringEncoder(defaultMsg)}
		partition, offset, err := producer.SendMessage(msg)
		if err != nil {
			log.Println("SendMessage err: ", err)
			return
		}
		log.Printf("[Producer] partitionid: %d; offset:%d\n", partition, offset)
	}
}
```





发送了 1000 条消息测试一下压缩效果：

> 每条消息为 6000 byte，1000 条差不多 6M

压缩前：

```sh
I have no name!@cd04519bf1df:/bitnami/kafka/data/compression-0$ ls -lhS
total 6.0M
-rw-r--r-- 1 1001 root  10M Aug 22 02:32 00000000000000000000.index
-rw-r--r-- 1 1001 root  10M Aug 22 02:32 00000000000000000000.timeindex
-rw-r--r-- 1 1001 root 6.0M Aug 22 02:32 00000000000000000000.log
-rw-r--r-- 1 1001 root    8 Aug 22 02:28 leader-epoch-checkpoint
```

果然是 6 M 和预期一致。

压缩后：

```sh
I have no name!@cd04519bf1df:/bitnami/kafka/data/compression-0$ ls -lhS
total 140K
-rw-r--r-- 1 1001 root  10M Aug 22 02:34 00000000000000000000.index
-rw-r--r-- 1 1001 root  10M Aug 22 02:34 00000000000000000000.timeindex
-rw-r--r-- 1 1001 root 125K Aug 22 02:34 00000000000000000000.log
-rw-r--r-- 1 1001 root    8 Aug 22 02:33 leader-epoch-checkpoint
```

125 K，说明压缩是生效的。

> 这么高的压缩比是因为发送的内容全是重复字符串导致的，使用真实数据应该没这么高压缩比。





### 4.2 源码分析

在之前文章[Kafka(Go)教程(六)---sarama 客户端 producer 源码分析](https://www.lixueduan.com/post/kafka/06-sarama-producer/) 中分析了 Producer 的具体流程，其中消息会经过 TopicProducer、PartitionProducer 最终通过 BrokerProudcer 到达 Kafka。

由于压缩是发生在 Producer 的，所以肯定是在最终通过 BrokerProudcer 到达 Kafka 之前就需要进行压缩，有了大致方向于是开始翻源码。



最终在 BrokerProudcer  的 buildRequest 方法中找到了答案：

> 为了便于阅读，省略了无关代码



#### buildRequest

在发生到 Kafka 之前对消息进行一次格式化。

```go
// produce_set.go 132 行
func (ps *produceSet) buildRequest() *ProduceRequest {
	req := &ProduceRequest{
		RequiredAcks: ps.parent.conf.Producer.RequiredAcks,
		Timeout:      int32(ps.parent.conf.Producer.Timeout / time.Millisecond),
	}

	for topic, partitionSets := range ps.msgs {
		for partition, set := range partitionSets {
			if ps.parent.conf.Producer.Compression == CompressionNone {
				req.AddSet(topic, partition, set.recordsToSend.MsgSet)
			} else {
				payload, err := encode(set.recordsToSend.MsgSet, ps.parent.conf.MetricRegistry)
				if err != nil {
					Logger.Println(err) // if this happens, it's basically our fault.
					panic(err)
				}
				compMsg := &Message{
					Codec:            ps.parent.conf.Producer.Compression,
					CompressionLevel: ps.parent.conf.Producer.CompressionLevel,
					Key:              nil,
					Value:            payload,
					Set:              set.recordsToSend.MsgSet, // Provide the underlying message set for accurate metrics
				}
			}
		}
	}

	return req
}
```

核心逻辑如下：

```go
if ps.parent.conf.Producer.Compression == CompressionNone {
	req.AddSet(topic, partition, set.recordsToSend.MsgSet)
} else {
	payload, err := encode(set.recordsToSend.MsgSet, ps.parent.conf.MetricRegistry)
}
```

前面提到过是按照 消息集合 为单位进行压缩的，这里的 MsgSet 就是那个消息集合。

然后为了 Consumer 能知道如何解压，把压缩算法和压缩等级信息附加在了消息上：

```go
compMsg := &Message{
    Codec:            ps.parent.conf.Producer.Compression,
    CompressionLevel: ps.parent.conf.Producer.CompressionLevel,
    Key:              nil,
    Value:            payload,
    Set:              set.recordsToSend.MsgSet, // Provide the underlying message set for accurate metrics
}
```

如果不需要压缩则直接添加到 Set，如果否则就调用`encode`方法，合理猜测，压缩逻辑就在 encode 里面，继续追踪下去：



#### encode


```go
// encoder_decoder.go 21 行
func encode(e encoder, metricRegistry metrics.Registry) ([]byte, error) {
	var prepEnc prepEncoder
	var realEnc realEncoder

	err := e.encode(&prepEnc)
	if err != nil {
		return nil, err
	}

	if prepEnc.length < 0 || prepEnc.length > int(MaxRequestSize) {
		return nil, PacketEncodingError{fmt.Sprintf("invalid request size (%d)", prepEnc.length)}
	}

	realEnc.raw = make([]byte, prepEnc.length)
	realEnc.registry = metricRegistry
	err = e.encode(&realEnc)
	if err != nil {
		return nil, err
	}

	return realEnc.raw, nil
}
```

可以看到这里面有`prepEncoder`和`realEncoder` 两个 encoder，其中 prepEncoder 只是走了一遍 encode 流程并没有真执行 encode：

```go
type prepEncoder struct {
	stack  []pushEncoder
	length int
}

// primitives

func (pe *prepEncoder) putInt8(in int8) {
	pe.length++
}

func (pe *prepEncoder) putInt16(in int16) {
	pe.length += 2
}

func (pe *prepEncoder) putInt32(in int32) {
	pe.length += 4
}

func (pe *prepEncoder) putInt64(in int64) {
	pe.length += 8
}
```

主要是为了获取 length 进行下面这个校验：

```go
	if prepEnc.length < 0 || prepEnc.length > int(MaxRequestSize) {
		return nil, PacketEncodingError{fmt.Sprintf("invalid request size (%d)", prepEnc.length)}
	}
```

所以真正逻辑肯定在 realEncoder 里，继续跟进。

> 最后发现全是 interface 不是很好追踪，对于这种情况就需要面向实现跟进，比如之前是 MsgSet 调用的 encode 方法，这里就直接找到 MsgSet 的相关实现。



```go
type MessageSet struct {
	PartialTrailingMessage bool // whether the set on the wire contained an incomplete trailing MessageBlock
	OverflowMessage        bool // whether the set on the wire contained an overflow message
	Messages               []*MessageBlock
}

func (ms *MessageSet) encode(pe packetEncoder) error {
	for i := range ms.Messages {
		err := ms.Messages[i].encode(pe)
		if err != nil {
			return err
		}
	}
	return nil
}
```

又调用了`ms.Messages[i].encode(pe)`，Messages 切片里存的是 MessageBlock，所以继续跟进 MessageBlock：

```go
type MessageBlock struct {
	Offset int64
	Msg    *Message
}

func (msb *MessageBlock) encode(pe packetEncoder) error {
	pe.putInt64(msb.Offset)
	pe.push(&lengthField{})
	err := msb.Msg.encode(pe)
	if err != nil {
		return err
	}
	return pe.pop()
}
```

又调用了`msb.Msg.encode(pe)`，继续跟进 Message：

```go
func (m *Message) encode(pe packetEncoder) error {

	var payload []byte
	payload, err = compress(m.Codec, m.CompressionLevel, m.Value)
    if err != nil {
        return err
    }
    m.compressedCache = payload
    // Keep in mind the compressed payload size for metric gathering
    m.compressedSize = len(payload)

	if err = pe.putBytes(payload); err != nil {
		return err
	}

	return pe.pop()
}
```



#### compress

终于找到了`compress(m.Codec, m.CompressionLevel, m.Value)`，具体实现：

```go
func compress(cc CompressionCodec, level int, data []byte) ([]byte, error) {
	switch cc {
	case CompressionNone:
		return data, nil
	case CompressionGZIP:
		var (
			err    error
			buf    bytes.Buffer
			writer *gzip.Writer
		)

		switch level {
		case CompressionLevelDefault:
			writer = gzipWriterPool.Get().(*gzip.Writer)
			defer gzipWriterPool.Put(writer)
			writer.Reset(&buf)
		case 1:
			writer = gzipWriterPoolForCompressionLevel1.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel1.Put(writer)
			writer.Reset(&buf)
		case 2:
			writer = gzipWriterPoolForCompressionLevel2.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel2.Put(writer)
			writer.Reset(&buf)
		case 3:
			writer = gzipWriterPoolForCompressionLevel3.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel3.Put(writer)
			writer.Reset(&buf)
		case 4:
			writer = gzipWriterPoolForCompressionLevel4.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel4.Put(writer)
			writer.Reset(&buf)
		case 5:
			writer = gzipWriterPoolForCompressionLevel5.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel5.Put(writer)
			writer.Reset(&buf)
		case 6:
			writer = gzipWriterPoolForCompressionLevel6.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel6.Put(writer)
			writer.Reset(&buf)
		case 7:
			writer = gzipWriterPoolForCompressionLevel7.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel7.Put(writer)
			writer.Reset(&buf)
		case 8:
			writer = gzipWriterPoolForCompressionLevel8.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel8.Put(writer)
			writer.Reset(&buf)
		case 9:
			writer = gzipWriterPoolForCompressionLevel9.Get().(*gzip.Writer)
			defer gzipWriterPoolForCompressionLevel9.Put(writer)
			writer.Reset(&buf)
		default:
			writer, err = gzip.NewWriterLevel(&buf, level)
			if err != nil {
				return nil, err
			}
		}
		if _, err := writer.Write(data); err != nil {
			return nil, err
		}
		if err := writer.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	case CompressionSnappy:
		return snappy.Encode(data), nil
	case CompressionLZ4:
		writer := lz4WriterPool.Get().(*lz4.Writer)
		defer lz4WriterPool.Put(writer)

		var buf bytes.Buffer
		writer.Reset(&buf)

		if _, err := writer.Write(data); err != nil {
			return nil, err
		}
		if err := writer.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	case CompressionZSTD:
		return zstdCompress(nil, data)
	default:
		return nil, PacketEncodingError{fmt.Sprintf("unsupported compression codec (%d)", cc)}
	}
}
```

就是一个简单的 switch 语句，根据指定的压缩算法和压缩等级选择具体实现，可以看到 压缩等级只有 GZIP 才需要设置。

> gzip 这里的实现感觉有点辣眼睛，虽然使用了 sync.pool 防止频繁创建 writer 对象是一个优化手段，但是因为压缩等级不同所以为每个压缩等级都创建了一个 pool 感觉不够优雅，可能是这样性能上会好一些，毕竟少一层封装。



到此  sarama 的压缩逻辑已经分析完了，还是比较简单的。**其中用到了 sync.pool 临时对象池，进行 writer 对象复用避免了创建大量临时对象，以提升性能。**

> consumer 解压也是差不多的逻辑这里就不分析了。



作者能力实在是有限，文中很有可能会有一些错误的理解。所以当你发现了一些违和的地方，也请不吝指教，谢谢你！

再次感谢你能看到这里！



### 4.3 小结

sarama 实现和官方逻辑大体一致：

* 1）producer 中配置压缩算法和压缩等级
* 2）发送消息前按照 MsgSet 为单位进行压缩，并将 压缩算法和压缩等级 附加到消息中便于 consumer 解压。
* 3）consumer 根据消息中附加的 压缩算法和压缩等级进行解压





## 5. 小结

> Kakfa 相关代码见 [Github][Github]



具体流程：

Producer 端压缩、Broker 端保持、Consumer 端解压缩。

特殊情况：

* 1）Broker 端指定了和 Producer 端不同的压缩算法。
* 2）Broker 端发生了消息格式转换。

以上两种情况 Broker 端都需要解压后在重新压缩。除此之外 Broker 端为了进行消息校验，也需要进行一次解压。



压缩算法：

* 在吞吐量方面：LZ4 > Snappy > zstd 和 GZIP；
* 而在压缩比方面，zstd > LZ4 > GZIP > Snappy。



使用建议：

由于压缩&解压需要消耗 CPU，所以建议在以下情况才开启：

* 1）Producer 、Consumer CPU 充足
* 2）带宽资源有限

如果 CPU 资源有很多富余，而带宽受限，这种情况强烈建议开启 zstd 压缩，这样能极大地节省网络资源消耗。



Go 优化：

使用 sync.pool 复用对象，避免创建大量临时对象。



## 6. 参考

`https://github.com/Shopify/sarama`

`《Kafka 核心技术与实战》`

`https://github.com/facebook/zstd/`





[Github]:https://github.com/lixd/kafka-go-example

