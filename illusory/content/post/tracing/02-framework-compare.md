---
title: "分布式链路追踪教程(二)---框架选型"
description: "分布式链路追踪框架简单对比"
date: 2020-05-02
draft: false
categories: ["Tracing"]
tags: ["Tracing"]
---

本文主要对分布式链路追踪框架做了简单对比，包括 Zipkin、Jaeger等。

<!--more-->

## 1. 概述

分布式链路追踪系统其中最著名的是 Google Dapper 论文所介绍的 Dapper。源于 Google 为了解决可能由不同团队，不同语言，不同模块，部署在不同服务器，不同数据中心的所带来的软件复杂性（很难去分析，无法做定位），构建了一个的分布式跟踪系统。



## 2. 对比

分布式链路追踪有大量相关产品，具体如下：

- Twitter：Zipkin。
- Uber：Jaeger。
- Elastic Stack：Elastic APM。
- Apache：SkyWalking（国内开源爱好者吴晟开源）。
- Naver：Pinpoint（韩国公司开发）。
- 阿里：鹰眼。
- 大众点评：Cat。
- 京东：Hydra。

 

### 1. Jaeger

由Uber开源，Jaeger 目前由 Cloud Native Computing Foundation（CNCF）托管，是 CNCF 的第七个顶级项目（于 2019 年 10 月毕业）。

架构图如下

![jaeger-architecture.png](https://github.com/lixd/blog/raw/master/images/tracing/jaeger-architecture.png)

- Jaeger Client：Jaeger 客户端，是 Jaeger 针对 OpenTracing API 的特定语言实现，可用于手动或通过与 OpenTracing 集成的各种现有开源框架（例如Flask，Dropwizard，gRPC等）来检测应用程序以进行分布式跟踪。
- Jaeger Agent：Jaeger 客户端代理，在 UDP 端口上监听所接受的跨度并将其分批发送给 Collector。
- Jaeger Collector：Jaeger 收集器，顾名思义是面向 Agent，用于收集/管理链路的追踪信息。
- Jaeger Query：数据查询与前端界面展示。
- Jaeger Ingester：可从 Kafka 读取数据并写入其他的存储介质（Cassandra，Elasticsearch）



### 2. Zipkin

Zipkin由Twitter开源于2012年。

架构图如下

![zipkin-architecture.png](https://github.com/lixd/blog/raw/master/images/tracing/zipkin-architecture.png)

- Zipkin Collector：Zipkin 收集器，用于收集/管理链路的追踪信息。
- Storage：Zipkin 数据存储，支持 Cassandra、ElasticSearch 和 MySQL 等第三方存储。
- Zipkin Query Service：数据存储并建立索引后，用于查找和检索跟踪信息。
- Web UI：数据查询与前端界面展示。

### 3. 对比

可以看到 Jaeger 和 Zipkin 架构上是非常接近的。相关对比的话可以查看下面的几篇文章。

```text
https://epsagon.com/observability/zipkin-or-jaeger-the-best-open-source-tools-for-distributed-tracing/
https://logz.io/blog/zipkin-vs-jaeger/
https://thenewstack.io/jaeger-vs-zipkin-battle-of-the-open-source-tracing-tools/
https://sematext.com/blog/jaeger-vs-zipkin-opentracing-distributed-tracers/
```

Zipkin 相对成熟,开源于2012年，同时也比较简单，Java 系大部分都会选择 Zipkin。

Jaeger 则是 CNCF 旗下，对 K8s 有较好的兼容性，Go 语言系可能是个不错的选择。



## 3. 小结

大多数在初始选型时都会选择亲和性比较强的追踪系统，就像是 Jaeger 属于 Go，Zipkin、Skywalking 是 Java 系居多，三者都完全兼容 OpenTracing，只是架构上多少有些不同，且都是基于 Google Dapper 发散，因此所支持的基本功能和查询页面优雅与否很重要。

另外近两年基于 ServiceMesh 的 ”无” 侵入式链路追踪也广受欢迎，似乎是一个被看好的方向，其代表作之一 Istio 便是使用 CNCF 出身的 Jaeger，且 Jaeger 还兼容 Zipkin，在这点上 Jaeger 完胜。

## 4. 参考

`https://jishuin.proginn.com/p/763bfbd2cb0f`

`https://my.oschina.net/u/3770892/blog/3005395`

`https://juejin.im/post/6844903560732213261`



