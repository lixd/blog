---
title: "SpringCloud入门系列(五)---服务熔断 Hystrix"
description: "服务熔断和Hystrix 组件"
date: 2019-03-19 22:00:00
draft: true
tags: ["SpringCloud"]
categories: ["SpringCloud"]
---

在微服务架构中，根据业务来拆分成一个个的服务，服务与服务之间可以通过 `RPC` 相互调用,为了实现服务的高可用业界提出了熔断器模型。

<!--more-->


## 1. 概述

在微服务架构中，根据业务来拆分成一个个的服务，服务与服务之间可以通过 `RPC` 相互调用，在 Spring Cloud 中可以用 `RestTemplate + Ribbon` 和 `Feign` 来调用。为了保证其高可用，单个服务通常会集群部署。由于网络原因或者自身的原因，服务并不能保证 100% 可用，如果单个服务出现问题，调用这个服务就会出现线程阻塞，此时若有大量的请求涌入，`Servlet` 容器的线程资源会被消耗完毕，导致服务瘫痪。服务与服务之间的依赖性，故障会传播，会对整个微服务系统造成灾难性的严重后果，这就是服务故障的 **“雪崩”** 效应。

为了解决这个问题，业界提出了熔断器模型。

Netflix 开源了 Hystrix 组件，实现了熔断器模式，Spring Cloud 对这一组件进行了整合。

较底层的服务如果出现故障，会导致连锁故障。当对特定的服务的调用的不可用达到一个阀值（Hystrix 是 **5 秒 20 次**） 熔断器将会被打开。

熔断器打开后，为了避免连锁故障，通过 `fallback` 方法可以直接返回一个固定值,提示访问出错。

## 2. Ribbon 中使用熔断器

对`hello-spring-cloud-web-admin-ribbon`项目进行修改。

### 2.1 pom.xml

在 pom.xml 中增加依赖

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-hystrix</artifactId>
</dependency>
```

### 2.2 Application 

在 Application 中增加 `@EnableHystrix` 注解

```java
package com.illusory.hello.spring.cloud.web.admin.ribbon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.netflix.hystrix.EnableHystrix;

@SpringBootApplication
@EnableDiscoveryClient
@EnableHystrix
public class WebAdminRibbonApplication {
    public static void main(String[] args) {
        SpringApplication.run(WebAdminRibbonApplication.class, args);
    }
}
```

### 2.3 Service 

在 Service 中增加 `@HystrixCommand` 注解

在 Ribbon 调用方法上增加 `@HystrixCommand` 注解并指定 `fallbackMethod` 熔断方法

```java
package com.illusory.hello.spring.cloud.web.admin.ribbon.service;

import com.netflix.hystrix.contrib.javanica.annotation.HystrixCommand;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AdminService {

    @Autowired
    private RestTemplate restTemplate;

    @HystrixCommand(fallbackMethod = "hiError")
    public String sayHi(String message) {
        return restTemplate.getForObject("http://HELLO-SPRING-CLOUD-SERVICE-ADMIN/hi?message=" + message, String.class);
    }

    public String hiError(String message) {
        return "Hi，your message is :\"" + message + "\" but request error.";
    }
}
```

### 2.4 测试熔断器

此时我们关闭服务提供者，再次请求 `http://localhost:8764/hi?message=HelloRibbon` 浏览器会显示：

```text
Hi，your message is :"HelloRibbon" but request error.
```

## 3. Feign 中使用熔断器

对`hello-spring-cloud-web-admin-feign`项目进行修改。

### 3.1 application.yml

application.yml中开启熔断

Feign 是自带熔断器的，但默认是关闭的。需要在配置文件中配置打开它，在配置文件增加以下代码：

```tml
feign:
  hystrix:
    enabled: true
```

### 3.2 Service 

在 Service 中增加 `fallback` 指定类

```java
package com.illusory.hello.spring.cloud.web.admin.feign.service;

import com.illusory.hello.spring.cloud.web.admin.feign.service.hystrix.AdminServiceHystrix;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(value = "hello-spring-cloud-service-admin", fallback = AdminServiceHystrix.class)
public interface AdminService {

    @RequestMapping(value = "hi", method = RequestMethod.GET)
    public String sayHi(@RequestParam(value = "message") String message);
}
```

### 3.3 AdminServiceHystrix

创建熔断器类并实现对应的 Feign 接口

```java
package com.illusory.hello.spring.cloud.web.admin.feign.service.hystrix;

import com.funtl.hello.spring.cloud.web.admin.feign.service.AdminService;
import org.springframework.stereotype.Component;

@Component
public class AdminServiceHystrix implements AdminService {

    @Override
    public String sayHi(String message) {
        return "Hi，your message is :\"" + message + "\" but request error.";
    }
}
```

### 3.4 测试熔断器

此时我们关闭服务提供者，再次请求 `http://localhost:8765/hi?message=HelloFeign` 浏览器会显示：

```text
Hi，your message is :"HelloFeign" but request error.
```

到这里服务熔断搭建成功。

## 4. 开启熔断仪表盘

分别对对`hello-spring-cloud-web-admin-feign`和对`hello-spring-cloud-web-admin-ribbon`项目进行修改，增加熔断仪表盘功能。

### 4.1 pom.xml

在 `pom.xml` 中增加依赖

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-hystrix-dashboard</artifactId>
</dependency>
```

### 4.2 Application

在 Application 中增加 `@EnableHystrixDashboard` 注解

```java
@SpringBootApplication
@EnableDiscoveryClient
@EnableHystrix
@EnableHystrixDashboard
public class WebAdminRibbonApplication {
    public static void main(String[] args) {
        SpringApplication.run(WebAdminRibbonApplication.class, args);
    }
}
```

### 4.3 HystrixDashboardConfiguration

创建 `hystrix.stream` 的 Servlet 配置

Spring Boot 2.x 版本开启 Hystrix Dashboard 与 Spring Boot 1.x 的方式略有不同，需要增加一个 `HystrixMetricsStreamServlet` 的配置，代码如下：

```java
package com.illusory.hello.spring.cloud.web.admin.ribbon.config;

import com.netflix.hystrix.contrib.metrics.eventstream.HystrixMetricsStreamServlet;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HystrixDashboardConfiguration {

    @Bean
    public ServletRegistrationBean getServlet() {
        HystrixMetricsStreamServlet streamServlet = new HystrixMetricsStreamServlet();
        ServletRegistrationBean registrationBean = new ServletRegistrationBean(streamServlet);
        registrationBean.setLoadOnStartup(1);
        registrationBean.addUrlMappings("/hystrix.stream");
        registrationBean.setName("HystrixMetricsStreamServlet");
        return registrationBean;
    }
}
```

### 4.4 测试 Hystrix Dashboard

浏览器端访问` http://localhost:8764/hystrix`

## 附：Hystrix 说明

### `fallback` 触发条件

| 名字                 | 描述                               | 触发fallback |
| -------------------- | ---------------------------------- | ------------ |
| EMIT                 | 值传递                             | NO           |
| SUCCESS              | 执行完成，没有错误                 | NO           |
| FAILURE              | 执行抛出异常                       | YES          |
| TIMEOUT              | 执行开始，但没有在允许的时间内完成 | YES          |
| BAD_REQUEST          | 执行抛出HystrixBadRequestException | NO           |
| SHORT_CIRCUITED      | 断路器打开，不尝试执行             | YES          |
| THREAD_POOL_REJECTED | 线程池拒绝，不尝试执行             | YES          |
| SEMAPHORE_REJECTED   | 信号量拒绝，不尝试执行             | YES          |

### `fallback` 抛出异常

| 名字              | 描述                           | 抛异常 |
| ----------------- | ------------------------------ | ------ |
| FALLBACK_EMIT     | Fallback值传递                 | NO     |
| FALLBACK_SUCCESS  | Fallback执行完成，没有错误     | NO     |
| FALLBACK_FAILURE  | Fallback执行抛出出错           | YES    |
| FALLBACK_REJECTED | Fallback信号量拒绝，不尝试执行 | YES    |
| FALLBACK_MISSING  | 没有Fallback实例               | YES    |

### Hystrix 常用配置信息

**超时时间（默认1000ms，单位：ms）**

- `hystrix.command.default.execution.isolation.thread.timeoutInMilliseconds`：在调用方配置，被该调用方的所有方法的超时时间都是该值，优先级低于下边的指定配置
- `hystrix.command.HystrixCommandKey.execution.isolation.thread.timeoutInMilliseconds`：在调用方配置，被该调用方的指定方法（HystrixCommandKey 方法名）的超时时间是该值

**线程池核心线程数**

- `hystrix.threadpool.default.coreSize`：默认为 10

**Queue**

- `hystrix.threadpool.default.maxQueueSize`：最大排队长度。默认 -1，使用 `SynchronousQueue`。其他值则使用 `LinkedBlockingQueue`。如果要从 -1 换成其他值则需重启，即该值不能动态调整，若要动态调整，需要使用到下边这个配置
- `hystrix.threadpool.default.queueSizeRejectionThreshold`：排队线程数量阈值，默认为 5，达到时拒绝，如果配置了该选项，队列的大小是该队列

**注意：** 如果 `maxQueueSize=-1` 的话，则该选项不起作用

**断路器**

- `hystrix.command.default.circuitBreaker.requestVolumeThreshold`：当在配置时间窗口内达到此数量的失败后，进行短路。默认 20 个（10s 内请求失败数量达到 20 个，断路器开）
- `hystrix.command.default.circuitBreaker.sleepWindowInMilliseconds`：短路多久以后开始尝试是否恢复，默认 5s
- `hystrix.command.default.circuitBreaker.errorThresholdPercentage`：出错百分比阈值，当达到此阈值后，开始短路。默认 50%

**fallback**

- `hystrix.command.default.fallback.isolation.semaphore.maxConcurrentRequests`：调用线程允许请求 `HystrixCommand.GetFallback()` 的最大数量，默认 10。超出时将会有异常抛出，注意：该项配置对于 THREAD 隔离模式也起作用

## 5. 小结

本章节中我们对`Ribbon`和`Feign`两个服务消费者项目进行了改造,添加`Hystrix`组件完成了服务熔断功能，接着添加`Hystrix DashBoard`组件实现了服务熔断仪表盘功能，方便监控服务熔断相关信息。