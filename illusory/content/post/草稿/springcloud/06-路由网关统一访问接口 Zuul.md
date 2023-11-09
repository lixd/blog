---
title: "SpringCloud入门系列(六)---路由网关 Zuul"
description: "路由网管 Zuul组件"
date: 2019-03-20 22:00:00
draft: true
tags: ["SpringCloud"]
categories: ["SpringCloud"]
---

在微服务架构中，需要几个基础的服务治理组件，包括服务注册与发现、服务消费、负载均衡、熔断器、智能路由、配置管理等，由这几个基础组件相互协作，共同组建了一个简单的微服务系统。`SpringCloud`中路由网关使用的是`Zuul`。

<!--more-->

## 1. 概述

在 Spring Cloud 微服务系统中，一种常见的负载均衡方式是，客户端的请求首先经过负载均衡（Zuul、Ngnix），再到达服务网关（Zuul 集群），然后再到具体的服。服务统一注册到高可用的服务注册中心集群，服务的所有的配置文件由配置服务管理，配置服务的配置文件放在 GIT 仓库，方便开发人员随时改配置。

Zuul 的主要功能是路由转发和过滤器。路由功能是微服务的一部分，比如 `/api/user` 转发到到 User 服务，`/api/shop` 转发到到 Shop 服务。`Zuul`默认和 `Ribbon` 结合实现了负载均衡的功能。

## 2. 使用路由网关统一访问接口

### 2.1 创建路由网关项目

#### 1. pom.xml 文件如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.lixueduan</groupId>
        <artifactId>hello-spring-cloud-dependencies</artifactId>
        <version>1.0.0-SNAPSHOT</version>
        <relativePath>../hello-spring-cloud-dependencies/pom.xml</relativePath>
    </parent>

    <artifactId>hello-spring-cloud-zuul</artifactId>
    <packaging>jar</packaging>

    <name>hello-spring-cloud-zuul</name>
    <url>http://www.lixueduan.com</url>
    <inceptionYear>2019-Now</inceptionYear>

    <dependencies>
        <!-- Spring Boot Begin -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <!-- Spring Boot End -->

        <!-- Spring Cloud Begin -->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-netflix-zuul</artifactId>
        </dependency>
        <!-- Spring Cloud End -->
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <!--指向启动类 用于jar包方式运行-->  <mainClass>com.illusory.hello.spring.cloud.zuul.ZuulApplication</mainClass>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

主要是增加了 Zuul 的依赖

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-zuul</artifactId>
</dependency>
```

#### 2. Application

增加 `@EnableZuulProxy` 注解开启 Zuul 功能

```java
package com.illusory.hello.spring.cloud.zuul;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.EnableEurekaClient;
import org.springframework.cloud.netflix.zuul.EnableZuulProxy;

@SpringBootApplication
@EnableEurekaClient
@EnableZuulProxy
public class ZuulApplication {
    public static void main(String[] args) {
        SpringApplication.run(ZuulApplication.class, args);
    }
}
```

####  3. application.yml

- 设置端口号为：`8769`
- 增加 Zuul 配置

```yml
spring:
  application:
    name: hello-spring-cloud-zuul

server:
  port: 8769

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/

zuul:
  routes:
  #api-a api-b是自定义的名字
    api-a:
      path: /api/a/**
      serviceId: hello-spring-cloud-web-admin-ribbon
    api-b:
      path: /api/b/**
      serviceId: hello-spring-cloud-web-admin-feign
```

路由说明：

- 以 `/api/a` 开头的请求都转发给 `hello-spring-cloud-web-admin-ribbon` 服务
- 以 `/api/b` 开头的请求都转发给 `hello-spring-cloud-web-admin-feign` 服务

### 2.2 测试访问

依次运行`Eureka`、`Provider`、`Consumer`、`Zuul`

打开浏览器访问：`http://localhost:8769/api/a/hi?message=HelloZuul` 浏览器显示

```text
Hi，your message is :"HelloZuul" i am from port：8763
```

打开浏览器访问：`http://localhost:8769/api/b/hi?message=HelloZuul `浏览器显示

```text
Hi，your message is :"HelloZuul" i am from port：8763
```

至此说明 Zuul 的路由功能配置成功

### 2.3 配置网关路由失败时的回调

```java
package com.illusory.hello.spring.cloud.zuul.fallback;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.cloud.netflix.zuul.filters.route.FallbackProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 路由 hello-spring-cloud-web-admin-feign 失败时的回调
 */
@Component
public class WebAdminFeignFallbackProvider implements FallbackProvider {

    @Override
    public String getRoute() {
        // ServiceId，如果需要所有调用都支持回退，则 return "*" 或 return null
        return "hello-spring-cloud-web-admin-feign";
    }

    /**
     * 如果请求服务失败，则返回指定的信息给调用者
     * @param route
     * @param cause
     * @return
     */
    @Override
    public ClientHttpResponse fallbackResponse(String route, Throwable cause) {
        return new ClientHttpResponse() {
            /**
             * 网关向 api 服务请求失败了，但是消费者客户端向网关发起的请求是成功的，
             * 不应该把 api 的 404,500 等问题抛给客户端
             * 网关和 api 服务集群对于客户端来说是黑盒
             * @return
             * @throws IOException
             */
            @Override
            public HttpStatus getStatusCode() throws IOException {
                return HttpStatus.OK;
            }

            @Override
            public int getRawStatusCode() throws IOException {
                return HttpStatus.OK.value();
            }

            @Override
            public String getStatusText() throws IOException {
                return HttpStatus.OK.getReasonPhrase();
            }

            @Override
            public void close() {

            }

            @Override
            public InputStream getBody() throws IOException {
                ObjectMapper objectMapper = new ObjectMapper();
                Map<String, Object> map = new HashMap<>();
                map.put("status", 200);
                map.put("message", "无法连接，请检查您的网络");
                return new ByteArrayInputStream(objectMapper.writeValueAsString(map).getBytes("UTF-8"));
            }

            @Override
            public HttpHeaders getHeaders() {
                HttpHeaders headers = new HttpHeaders();
                // 和 getBody 中的内容编码一致
                headers.setContentType(MediaType.APPLICATION_JSON_UTF8);
                return headers;
            }
        };
    }
}
```

## 3. 使用路由网关的服务过滤功能

Zuul 不仅仅只是路由，还有很多强大的功能，例如它的服务过滤功能，比如用在安全验证方面。

### 3.1 创建服务过滤器

继承 `ZuulFilter` 类并在类上增加 `@Component` 注解就可以使用服务过滤功能了，非常简单方便

```java
package com.illusory.hello.spring.cloud.zuul.filter;

import com.netflix.zuul.ZuulFilter;
import com.netflix.zuul.context.RequestContext;
import com.netflix.zuul.exception.ZuulException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;


@Component
public class LoginFilter extends ZuulFilter {

    private static final Logger logger = LoggerFactory.getLogger(LoginFilter.class);

    /**
     * 配置过滤类型，有四种不同生命周期的过滤器类型
     * 1. pre：路由之前
     * 2. routing：路由之时
     * 3. post：路由之后
     * 4. error：发送错误调用
     * @return
     */
    @Override
    public String filterType() {
        return "pre";
    }

    /**
     * 配置过滤的顺序
     * @return
     */
    @Override
    public int filterOrder() {
        return 0;
    }

    /**
     * 配置是否需要过滤：true/需要，false/不需要
     * @return
     */
    @Override
    public boolean shouldFilter() {
        return true;
    }

    /**
     * 过滤器的具体业务代码
     * @return
     * @throws ZuulException
     */
    @Override
    public Object run() throws ZuulException {
        RequestContext context = RequestContext.getCurrentContext();
        HttpServletRequest request = context.getRequest();
        logger.info("{} >>> {}", request.getMethod(), request.getRequestURL().toString());
        String token = request.getParameter("token");
        if (token == null) {
            logger.warn("Token is empty");
            context.setSendZuulResponse(false);
            context.setResponseStatusCode(401);
            try {
                context.getResponse().getWriter().write("Token is empty");
            } catch (IOException e) {
            }
        } else {
            logger.info("OK");
        }
        return null;
    }
}
```

### 3.2 名词解释

#### 1. filterType

返回一个字符串代表过滤器的类型，在 Zuul 中定义了四种不同生命周期的过滤器类型

- pre：路由之前
- routing：路由之时
- post： 路由之后
- error：发送错误调用

#### 2. filterOrder

过滤的顺序

#### 3. shouldFilter

是否需要过滤，这里是 `true`，需要过滤

#### 4. run

过滤器的具体业务代码

### 3.3 测试过滤器

浏览器访问：`http://localhost:8769/api/a/hi?message=HelloZuul` 网页显示

```text
Token is empty
```

浏览器访问：`http://localhost:8769/api/b/hi?message=HelloZuul&token=123` 网页显示

```text
Hi，your message is :"HelloZuul" i am from port：8763
```

## 4. 小结

到此为止我们使用`Zuul`路由网关成功实现了统一访问接口和服务过滤功能。

