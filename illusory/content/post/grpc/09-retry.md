---
title: "gRPC(Go)教程(九)---配置retry自动重试"
description: "gRPC 中的retry自动重试配置"
date: 2021-02-06 22:00:00
draft: false
tags: ["gRPC"]
categories: ["gRPC"]
---

本文主要记录了如何使用 gRPC 中的 自动重试功能。

<!--more-->



## 1. 概述

> gRPC 系列相关代码见 [Github][Github]

gRPC 中已经内置了 retry 功能，可以直接使用，不需要我们手动来实现，非常方便。



## 2. Demo

### Server

为了测试 retry 功能，服务端做了一点调整。

记录客户端的请求次数，只有满足条件的那一次（这里就是请求次数模4等于0的那一次）才返回成功，其他时候都返回失败。

```go
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/lixd/grpc-go-example/features/proto/echo"
)

var port = flag.Int("port", 50052, "port number")

type failingServer struct {
	pb.UnimplementedEchoServer
	mu sync.Mutex

	reqCounter uint
	reqModulo  uint
}

// maybeFailRequest 手动模拟请求失败 一共请求n次，前n-1次都返回失败，最后一次返回成功。
func (s *failingServer) maybeFailRequest() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reqCounter++
	if (s.reqModulo > 0) && (s.reqCounter%s.reqModulo == 0) {
		return nil
	}

	return status.Errorf(codes.Unavailable, "maybeFailRequest: failing it")
}

func (s *failingServer) UnaryEcho(ctx context.Context, req *pb.EchoRequest) (*pb.EchoResponse, error) {
	if err := s.maybeFailRequest(); err != nil {
		log.Println("request failed count:", s.reqCounter)
		return nil, err
	}

	log.Println("request succeeded count:", s.reqCounter)
	return &pb.EchoResponse{Message: req.Message}, nil
}

func main() {
	flag.Parse()

	address := fmt.Sprintf(":%v", *port)
	lis, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	fmt.Println("listen on address", address)

	s := grpc.NewServer()

	// 指定第4次请求才返回成功，用于测试 gRPC 的 retry 功能。
	failingservice := &failingServer{
		reqModulo: 4,
	}

	pb.RegisterEchoServer(s, failingservice)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
```



### Client

客户端则是建立连接的时候通过`grpc.WithDefaultServiceConfig()`配置好 retry 功能。

```go
package main

import (
	"context"
	"flag"
	"log"
	"time"

	pb "github.com/lixd/grpc-go-example/features/proto/echo"
	"google.golang.org/grpc"
)

var (
	addr = flag.String("addr", "localhost:50052", "the address to connect to")
	// 更多配置信息查看官方文档： https://github.com/grpc/grpc/blob/master/doc/service_config.md
	// service这里语法为<package>.<service> package就是proto文件中指定的package，service也是proto文件中指定的 Service Name。
	// method 可以不指定 即当前service下的所以方法都使用该配置。
	retryPolicy = `{
		"methodConfig": [{
		  "name": [{"service": "echo.Echo","method":"UnaryEcho"}],
		  "retryPolicy": {
			  "MaxAttempts": 4,
			  "InitialBackoff": ".01s",
			  "MaxBackoff": ".01s",
			  "BackoffMultiplier": 1.0,
			  "RetryableStatusCodes": [ "UNAVAILABLE" ]
		  }
		}]}`
)

func main() {
	flag.Parse()
	conn, err := grpc.Dial(*addr, grpc.WithInsecure(), grpc.WithDefaultServiceConfig(retryPolicy))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Printf("failed to close connection: %s", e)
		}
	}()

	c := pb.NewEchoClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	reply, err := c.UnaryEcho(ctx, &pb.EchoRequest{Message: "Try and Success"})
	if err != nil {
		log.Fatalf("UnaryEcho error: %v", err)
	}
	log.Printf("UnaryEcho reply: %v", reply)
}
```

> 配置信息具体含义这里先不解释，在后续章节有详细说明。



### Run

先启动服务端

```sh
lixd@17x:~/17x/projects/grpc-go-example/features/retry/server$ go run main.go 
listen on address :50052
2021/02/17 17:35:29 request failed count: 1
```

在启动客户端

```sh
lixd@17x:~/17x/projects/grpc-go-example/features/retry/client$ go run main.go 
2021/02/17 17:35:29 UnaryEcho error: rpc error: code = Unavailable desc = maybeFailRequest: failing it
exit status 1
```



emmm 并没有重试。。。

### 开启重试

查看文档后发现是需要**设置环境变量（GRPC_GO_RETRY=on）**。

> 因为是客户端的重试功能，所以是在客户端设置环境变量，服务端则不需要。

```sh
lixd@17x$ export GRPC_GO_RETRY=on
lixd@17x$ echo $GRPC_GO_RETRY
on
```

然后重新启动服务端和客户端

```sh
lixd@17x:~/17x/projects/grpc-go-example/features/retry/server$ go run main.go 
listen on address :50052
2021/02/17 17:37:55 request failed count: 1
2021/02/17 17:37:55 request failed count: 2
2021/02/17 17:37:55 request failed count: 3
2021/02/17 17:37:55 request succeeded count: 4
```

```sh
lixd@17x:~/17x/projects/grpc-go-example/features/retry/client$ go run main.go 
2021/02/17 17:37:55 UnaryEcho reply: message:"Try and Success"
```

现在重试功能就生效了。

前3次都失败了，且返回错误码是客户端重试策略中指定的`UNAVAILABLE`,所以都进行了重试，直到第4次成功了就不在重试了。

> 当然，第4次已经是最大尝试次数了，就算失败也不会重试了。



## 3. 配置

Service Config 是以 JSON 格式配置的，具体文档见 [service_config.md](https://github.com/grpc/grpc/blob/master/doc/service_config.md)。



### service_config.proto

当前支持的配置信息由 [service_config.proto](https://github.com/grpc/grpc-proto/blob/master/grpc/service_config/service_config.proto) 文件定义，详细信息可以参考该文件，这里贴一部分仅供参考：

```protobuf
// Configuration for a method.
message MethodConfig {
  // The names of the methods to which this configuration applies.
  // - MethodConfig without names (empty list) will be skipped.
  // - Each name entry must be unique across the entire ServiceConfig.
  // - If the 'method' field is empty, this MethodConfig specifies the defaults
  //   for all methods for the specified service.
  // - If the 'service' field is empty, the 'method' field must be empty, and
  //   this MethodConfig specifies the default for all methods (it's the default
  //   config).
  //
  // When determining which MethodConfig to use for a given RPC, the most
  // specific match wins. For example, let's say that the service config
  // contains the following MethodConfig entries:
  //
  // method_config { name { } ... }
  // method_config { name { service: "MyService" } ... }
  // method_config { name { service: "MyService" method: "Foo" } ... }
  //
  // MyService/Foo will use the third entry, because it exactly matches the
  // service and method name. MyService/Bar will use the second entry, because
  // it provides the default for all methods of MyService. AnotherService/Baz
  // will use the first entry, because it doesn't match the other two.
  //
  // In JSON representation, value "", value `null`, and not present are the
  // same. The following are the same Name:
  // - { "service": "s" }
  // - { "service": "s", "method": null }
  // - { "service": "s", "method": "" }
  message Name {
    string service = 1;  // Required. Includes proto package name.
    string method = 2;
  }
  repeated Name name = 1;

  // Whether RPCs sent to this method should wait until the connection is
  // ready by default. If false, the RPC will abort immediately if there is
  // a transient failure connecting to the server. Otherwise, gRPC will
  // attempt to connect until the deadline is exceeded.
  //
  // The value specified via the gRPC client API will override the value
  // set here. However, note that setting the value in the client API will
  // also affect transient errors encountered during name resolution, which
  // cannot be caught by the value here, since the service config is
  // obtained by the gRPC client via name resolution.
  google.protobuf.BoolValue wait_for_ready = 2;

  // The default timeout in seconds for RPCs sent to this method. This can be
  // overridden in code. If no reply is received in the specified amount of
  // time, the request is aborted and a DEADLINE_EXCEEDED error status
  // is returned to the caller.
  //
  // The actual deadline used will be the minimum of the value specified here
  // and the value set by the application via the gRPC client API.  If either
  // one is not set, then the other will be used.  If neither is set, then the
  // request has no deadline.
  google.protobuf.Duration timeout = 3;

  // The maximum allowed payload size for an individual request or object in a
  // stream (client->server) in bytes. The size which is measured is the
  // serialized payload after per-message compression (but before stream
  // compression) in bytes. This applies both to streaming and non-streaming
  // requests.
  //
  // The actual value used is the minimum of the value specified here and the
  // value set by the application via the gRPC client API.  If either one is
  // not set, then the other will be used.  If neither is set, then the
  // built-in default is used.
  //
  // If a client attempts to send an object larger than this value, it will not
  // be sent and the client will see a ClientError.
  // Note that 0 is a valid value, meaning that the request message
  // must be empty.
  google.protobuf.UInt32Value max_request_message_bytes = 4;

  // The maximum allowed payload size for an individual response or object in a
  // stream (server->client) in bytes. The size which is measured is the
  // serialized payload after per-message compression (but before stream
  // compression) in bytes. This applies both to streaming and non-streaming
  // requests.
  //
  // The actual value used is the minimum of the value specified here and the
  // value set by the application via the gRPC client API.  If either one is
  // not set, then the other will be used.  If neither is set, then the
  // built-in default is used.
  //
  // If a server attempts to send an object larger than this value, it will not
  // be sent, and a ServerError will be sent to the client instead.
  // Note that 0 is a valid value, meaning that the response message
  // must be empty.
  google.protobuf.UInt32Value max_response_message_bytes = 5;

  // The retry policy for outgoing RPCs.
  message RetryPolicy {
    // The maximum number of RPC attempts, including the original attempt.
    //
    // This field is required and must be greater than 1.
    // Any value greater than 5 will be treated as if it were 5.
    uint32 max_attempts = 1;

    // Exponential backoff parameters. The initial retry attempt will occur at
    // random(0, initial_backoff). In general, the nth attempt will occur at
    // random(0,
    //   min(initial_backoff*backoff_multiplier**(n-1), max_backoff)).
    // Required. Must be greater than zero.
    google.protobuf.Duration initial_backoff = 2;
    // Required. Must be greater than zero.
    google.protobuf.Duration max_backoff = 3;
    float backoff_multiplier = 4;  // Required. Must be greater than zero.

    // The set of status codes which may be retried.
    //
    // This field is required and must be non-empty.
    repeated google.rpc.Code retryable_status_codes = 5;
  }
    // The hedging policy for outgoing RPCs. Hedged RPCs may execute more than
  // once on the server, so only idempotent methods should specify a hedging
  // policy.
  message HedgingPolicy {
    // The hedging policy will send up to max_requests RPCs.
    // This number represents the total number of all attempts, including
    // the original attempt.
    //
    // This field is required and must be greater than 1.
    // Any value greater than 5 will be treated as if it were 5.
    uint32 max_attempts = 1;

    // The first RPC will be sent immediately, but the max_requests-1 subsequent
    // hedged RPCs will be sent at intervals of every hedging_delay. Set this
    // to 0 to immediately send all max_requests RPCs.
    google.protobuf.Duration hedging_delay = 2;

    // The set of status codes which indicate other hedged RPCs may still
    // succeed. If a non-fatal status code is returned by the server, hedged
    // RPCs will continue. Otherwise, outstanding requests will be canceled and
    // the error returned to the client application layer.
    //
    // This field is optional.
    repeated google.rpc.Code non_fatal_status_codes = 3;
  }

  // Only one of retry_policy or hedging_policy may be set. If neither is set,
  // RPCs will not be retried or hedged.
  oneof retry_or_hedging_policy {
    RetryPolicy retry_policy = 6;
    HedgingPolicy hedging_policy = 7;
  }
}
```

注释写的还是很详细的，转换成 JSON 如下：

```json
{
		"methodConfig": [{
		  "name": [{"service": "echo.Echo","method":"UnaryEcho"}],
          "wait_for_ready": false,
          "timeout": 1000ms,
          "max_request_message_bytes": 1024,
          "max_response_message_bytes": 1024,
		  "retryPolicy": {
			  "maxAttempts": 4,
			  "initialBackoff": ".01s",
			  "maxBackoff": ".01s",
			  "backoffMultiplier": 1.0,
			  "retryableStatusCodes": [ "UNAVAILABLE" ]
		  },
		  "hedgingPolicy":{
              "maxAttempts":4,
              "hedgingDelay":"0.1s",
              "nonFatalStatusCodes": [ "" ]
          }}]
}
```



首先是 Name，通过 service + method 指定当前配置要应用到哪些服务和方法。

```json
"name": [{"service": "echo.Echo","method":"UnaryEcho"}],
```

然后后续几个都不是重点：

```json
          "wait_for_ready": false,
          "timeout": 1000ms,
          "max_request_message_bytes": 1024,
          "max_response_message_bytes": 1024,
```

重点是下面这两个配置,重试策略和对冲策略：

```json
		  "retryPolicy": {
			  "maxAttempts": 4,
			  "initialBackoff": ".01s",
			  "maxBackoff": ".01s",
			  "backoffMultiplier": 1.0,
			  "retryableStatusCodes": [ "UNAVAILABLE" ]
		  },
		  "hedgingPolicy":{
              "maxAttempts":4,
              "hedgingDelay":"0.1s",
              "nonFatalStatusCodes": [ "UNAVAILABLE" ]
          }
```

gRPC 的重试策略有两种分别是 `重试(retryPolicy)`和`对冲(hedging)`，一个RPC方法只能配置一种重试策略。

**对冲是指在不等待响应的情况主动发送单次调用的多个请求**，如果一个方法使用对冲策略，那么首先会像正常的 RPC 调用一样发送第一次请求，如果 hedgingDelay 时间内没有响应，那么直接发送第二次请求，以此类推，直到发送了 maxAttempts 次。

> 对冲在超过指定时间没有响应就会直接发起请求，而重试则必须要服务端响应后才会发起请求。

注意： **使用对冲的时候，请求可能会访问到不同的后端(如果设置了负载均衡)，那么就要求方法在多次执行下是安全，并且符合预期的**



### retry config

demo 中的配置信息如下：

```go
{
		"methodConfig": [{
		  "name": [{"service": "echo.Echo","method":"UnaryEcho"}],
		  "retryPolicy": {
			  "MaxAttempts": 4,
			  "InitialBackoff": ".01s",
			  "MaxBackoff": ".01s",
			  "BackoffMultiplier": 1.0,
			  "RetryableStatusCodes": [ "UNAVAILABLE" ]
		  }}]
}
```

* name 指定下面的配置信息作用的 RPC 服务或方法
  * service：通过服务名匹配，语法为`<package>.<service> `package就是proto文件中指定的package，service也是proto文件中指定的 Service Name。
  * method：匹配具体某个方法，proto文件中定义的方法名。

主要关注 retryPolicy，重试策略

* MaxAttempts：最大尝试次数
* InitialBackoff：默认退避时间
* MaxBackoff：最大退避时间
* BackoffMultiplier：退避时间增加倍率
* RetryableStatusCodes：服务端返回什么错误码才重试

重试机制一般会搭配退避算法一起使用。

> 即假设第一次请求失败后，等1秒（随便取的一个数）再次请求，又失败后就等2秒在请求，一直重试直达超过指定重试次数或者等待时间就不在重试。

如果不使用退避算法，失败后就一直重试只会增加服务器的压力。如果是因为服务器压力大，导致的请求失败，那么根据退避算法等待一定时间后再次请求可能就能成功。反之直接请求可能会因为压力过大导致服务崩溃。

- 第一次重试间隔是 `random(0, initialBackoff)`
- 第 n 次的重试间隔为 `random(0, min( initialBackoff*backoffMultiplier**(n-1) , maxBackoff))`



## 4. 小结

gRPC 中内置了 retry 功能，使用比较简单。

* 1）客户端建立连接时通过`grpc.WithDefaultServiceConfig(retryPolicy)`指定重试策略
* 2）环境变量中开启重试:`export GRPC_GO_RETRY=on`





[Github]: https://github.com/lixd/grpc-go-example