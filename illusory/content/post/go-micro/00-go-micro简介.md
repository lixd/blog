---
title: "Go-Micro框架入门教程(一)---框架结构"
description: "go语言微服务框架 go-micro框架简单分析"
date: 2019-05-22 22:00:00
draft: false
tags: ["Go",Micro]
categories: ["Go-Micro"]
---

Go语言微服务系列文章，使用golang实现微服务，这里选用的是`go-micro`框架,本文主要是对该框架的一个架构简单介绍。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. 概述

`go-micro`是`go语言`下的一个很好的微服务框架。

* 1.服务间传输格式为`protobuf`，效率上没的说，非常的快，也很安全。
* 2.go-micro的`服务注册`和`发现`是多种多样的。我个人比较喜欢`etcdv3`的服务服务发现和注册。
* 3.主要的功能都有相应的接口，只要实现相应的接口，就可以根据自己的需要订制插件。

## 2. 通信流程

 go-micro的通信流程大至如下

![服务注册与发现](https://github.com/lixd/blog/raw/master/images/golang/go-micro/service-discover.png)

`Server`端需要向`Register`注册自己的存在或消亡，这样Client才能知道自己的状态。

同时Server监听`客户端的调用`和`Brocker`推送过来的信息进行处理。

`Client`端从`Register`中得到`Server`的信息，然后每次调用都根据算法选择一个的`Server`进行通信，当然通信是要经过编码/解码，选择传输协议等一系列过程的。

## 3. 框架结构

 go-micro 之所以可以高度订制和他的框架结构是分不开的，go-micro 由`8个`关键的 `interface`组成，每一个interface 都可以根据自己的需求重新实现，这8个主要的inteface也构成了go-micro的框架结构。 

![整体架构](https://github.com/lixd/blog/raw/master/images/golang/go-micro/go-micro-8-interface.png)

### 1.Transort

**服务之间通信的接口**。

也就是服务发送和接收的最终实现方式，是由这些接口定制的

```go
type Socket interface {
    Recv(*Message) error
    Send(*Message) error
    Close() error
}
 
type Client interface {
    Socket
}
 
type Listener interface {
    Addr() string
    Close() error
    Accept(func(Socket)) error
}
 
type Transport interface {
    Dial(addr string, opts ...DialOption) (Client, error)
    Listen(addr string, opts ...ListenOption) (Listener, error)
    String() string
}
```

Transport 的Listen方法是一般是Server端进行调用的，他监听一个端口，等待客户端调用。

Transport 的Dial就是客户端进行连接服务的方法。他返回一个Client接口，这个接口返回一个Client接口，这个Client嵌入了Socket接口，这个接口的方法就是具体发送和接收通信的信息。

是go-micro默认的同步通信机制是`http传输`。当然还有很多其他的插件：`grpc`,nats,tcp,udp,rabbitmq,都是目前已经实现了的方式。

### 2. Codec

有了传输方式，下面要解决的就是传输编码和解码问题，go-micro有很多种编码解码方式，默认的实现方式是`protobuf`,当然也有其他的实现方式，json、protobuf、jsonrpc、mercury等等。

```go
type Codec interface {
    ReadHeader(*Message, MessageType) error
    ReadBody(interface{}) error
    Write(*Message, interface{}) error
    Close() error
    String() string
}
 
type Message struct {
    Id     uint64
    Type   MessageType
    Target string
    Method string
    Error  string
    Header map[string]string
}
```

   Codec接口的Write方法就是编码过程，两个Read是解码过程。

### 3. Registry

服务的注册和发现，目前实现的consul,mdns, etcd,`etcdv3`,zookeeper,kubernetes.等

```go
type Registry interface {
    Register(*Service, ...RegisterOption) error
    Deregister(*Service) error
    GetService(string) ([]*Service, error)
    ListServices() ([]*Service, error)
    Watch(...WatchOption) (Watcher, error)
    String() string
    Options() Options
}
```

简单来说`就是Service 进行Register，来进行注册，Client 使用watch方法进行监控，当有服务加入或者删除时这个方法会被触发，以提醒客户端更新Service信息`。

 默认的是服务注册和发现是`consul`， 我个人比较喜欢`etcdv3集群`。大家可以根据自己的喜好选择。

### 4. Selector

 以Registry为基础，Selector 是**客户端级别的负载均衡**，当有客户端向服务发送请求时， selector根据不同的算法从Registery中的主机列表，得到可用的Service节点，进行通信。目前实现的有`循环算法`和`随机算法`，默认的是随机算法

```go
type Selector interface {
    Init(opts ...Option) error
    Options() Options
    // Select returns a function which should return the next node
    Select(service string, opts ...SelectOption) (Next, error)
    // Mark sets the success/error against a node
    Mark(service string, node *registry.Node, err error)
    // Reset returns state back to zero for a service
    Reset(service string)
    // Close renders the selector unusable
    Close() error
    // Name of the selector
    String() string
}
```

  默认的是实现是本地缓存，当前实现的有blacklist,label,named等方式。

### 5. Broker

Broker是消息发布和订阅的接口。很简单的一个例子，因为服务的节点是不固定的，如果有需要修改所有服务行为的需求，可以使服务订阅某个主题，当有信息发布时，所有的监听服务都会收到信息，根据你的需要做相应的行为。

```go
type Broker interface {
    Options() Options
    Address() string
    Connect() error
    Disconnect() error
    Init(...Option) error
    Publish(string, *Message, ...PublishOption) error
    Subscribe(string, Handler, ...SubscribeOption) (Subscriber, error)
    String() string
}
```

Broker默认的实现方式是`http方式`，但是这种方式不要在生产环境用。go-plugins里有很多成熟的消息队列实现方式，有kafka、nsq、rabbitmq、redis等等。

### 6. Client

 Client是**请求服务的接口**。

他封装 Transport 和 Codec 进行rpc调用，也封装了Brocker进行信息的发布。

```go
type Client interface {
    Init(...Option) error
    Options() Options
    NewMessage(topic string, msg interface{}, opts ...MessageOption) Message
    NewRequest(service, method string, req interface{}, reqOpts ...RequestOption) Request
    Call(ctx context.Context, req Request, rsp interface{}, opts ...CallOption) error
    Stream(ctx context.Context, req Request, opts ...CallOption) (Stream, error)
    Publish(ctx context.Context, msg Message, opts ...PublishOption) error
    String() string
}
```

当然他也支持双工通信 Stream 这些具体的实现方式和使用方式，默认的是`rp`c实现方式，他还有`grpc`和http方式，在go-plugins里可以找到

### 7. Server

  Server看名字大家也知道是做什么的了。监听等待rpc请求。监听broker的订阅信息，等待信息队列的推送等。

```go
type Server interface {
    Options() Options
    Init(...Option) error
    Handle(Handler) error
    NewHandler(interface{}, ...HandlerOption) Handler
    NewSubscriber(string, interface{}, ...SubscriberOption) Subscriber
    Subscribe(Subscriber) error
    Register() error
    Deregister() error
    Start() error
    Stop() error
    String() string
}
```

默认的是rpc实现方式，他还有grpc和http方式，在go-plugins里可以找到

### 8. Service

**Service是Client和Server的封装**，他包含了一系列的方法使用初始值去初始化Service和Client，使我们可以很简单的创建一个rpc服务。

```go
type Service interface {
    Init(...Option)
    Options() Options
    Client() client.Client
    Server() server.Server
    Run() error
    String() string
}
```



## 4. 参考

`https://blog.csdn.net/mi_duo/article/details/82701732`