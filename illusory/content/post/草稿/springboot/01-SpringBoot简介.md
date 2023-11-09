---
title: "SpringBoot入门系列(一)---第一个SpringBoot项目"
description: "为什么会出现SpringBoot?有什么优缺点"
date: 2019-03-08 22:00:00
draft: true
tags: ["Java"]
categories: ["SpringBoot"]
---

本文主要讲述了Spring框架的变化，从Spring1.0到Spring5.0，从xml配置到注解，到现在的SpringBoot，最后记录了如何创建第一个SpringBoot项目。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. Spring 简史

### Spring 1.x 时代

在 Spring1.x 时代，都是通过 xml 文件配置 bean，随着项目的不断扩大，需要将 xml 配置分放到不同的配置文件中，需要频繁的在 java 类和 xml 配置文件中切换。

### Spring 2.x 时代

随着 JDK 1.5 带来的注解支持，Spring2.x 可以使用注解对 Bean 进行申明和注入，大大的减少了 xml 配置文件，同时也大大简化了项目的开发。

那么，问题来了，究竟是应该使用 xml 还是注解呢？

最佳实践：

- 应用的基本配置用 xml，比如：数据源、资源文件等
- 业务开发用注解，比如：Service 中注入 bean 等

### Spring 3.x 时代

从 Spring3.x 开始提供了 Java 配置方式，使用 Java 配置方式可以更好的理解你配置的 Bean，现在我们就处于这个时代，并且 Spring4.x 和 Spring boot 都推荐使用 java 配置的方式。

### Spring 5.x 时代

Spring5.x 是 Java 界首个支持响应式的 Web 框架，是 Spring 的一个重要版本，距离 Spring4.x 差不多四年。在此期间，大多数增强都是在 SpringBoot 项目中完成的，其最大的亮点就是提供了完整的端到端响应式编程的支持（新增 Spring WebFlux 模块）。

Spring WebFlux 同时支持使用旧的 Spring MVC 注解声明 `Reactive Controller`。和传统的 `MVC Controller` 不同，`Reactive Controller` 操作的是 **非阻塞** 的 `ServerHttpRequest` 和 `ServerHttpResponse`，而不再是 Spring MVC 里的 HttpServletRequest 和 HttpServletResponse。

至此也代表着 Java 正式迎来了`响应式异步编程`的时代。

## 2. Spring Boot

### 2.1 简介

Spring Boot 可以称之为 **新一代 JavaEE 开发标准**；随着动态语言的流行 (Ruby、Groovy、Scala、Node.js)，Java 的开发显得格外的笨重：繁多的配置、低下的开发效率、复杂的部署流程以及第三方技术集成难度大。

在上述环境下，Spring Boot 应运而生。它使用 **“习惯优于配置”** （项目中存在大量的配置，此外还内置了一个习惯性的配置，让你无需手动进行配置）的理念让你的项目快速的运行起来。使用 Spring Boot 很容易创建一个独立运行（运行 Jar，内嵌 Servlet 容器）准生产级别的基于 Spring 框架的项目，使用 Spring Boot 你可以不用或者只需很少的 Spring 配置。

### 2.2 优点

- 快速构建项目
- 对主流开发框架的无配置集成
- 项目可独立运行，无需外部依赖 Servlet 容器
- 提供运行时的应用监控
- 极大地提高了开发、部署效率
- 与云计算的天然集成

### 2.3  缺点

- 版本迭代速度很快，一些模块改动很大
- 由于不用自己做配置，报错时很难定位
- 网上现成的解决方案比较少

## 3. 第一个SpringBoot项目

这里我们使用 Intellij IDEA 来新建一个 Spring Boot 项目。

### 3.1 创建项目

- 1. 打开 IDEA -> New Project -> Spring Initializr

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-1.png)

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-2.png)

- 2.填写项目信息

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-3.png)

- 3.选择 Spring Boot 版本及 Web 开发所需的依赖

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-4.png)

- 4.保存项目到指定目录

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-5.png)

### 3.2 工程目录结构

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-6.png)

一个标准的maven项目。

`HelloSpringApplication`作为SpringBoot启动类。

`resources/static`目录存放静态资源文件

`resources/templates`目录存放html页面。

`application.properties`为SpringBoot配置文件

#### Application.class

```java
package com.illusory.hello.spring.boot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HelloSpringBootApplication {

    public static void main(String[] args) {
        SpringApplication.run(HelloSpringBootApplication.class, args);
    }

}
```

启动类非常简单，其中`@SpringBootApplication`注解表明这是SpringBoot启动类。

#### pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <!--注意这里继承了父项目spring-boot-starter-parent-->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.1.4.RELEASE</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>
    <groupId>com.illusory</groupId>
    <artifactId>hello-spring-boot</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>hello-spring-boot</name>
    <description>Demo project for Spring Boot</description>

    <properties>
        <java.version>1.8</java.version>
    </properties>

    <dependencies>
        <!--两个依赖spring-boot-starter-web和test-->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

</project>

```

可以看到项目中有两个依赖`spring-boot-starter-web`和`spring-boot-starter-test`。

其中test是都会有的，然后web则是前面勾选的模块。

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-7.png)

可以看到已经依赖了Spring各大组件，同时还依赖了一个Tomcat,所以SpringBoot项目是可以独立运行的，因为内置了Tomcat。

## 4. 功能演示

```java
package com.illusory.hello.spring.boot;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 12:36
 */
@Controller
public class HelloController {
    @ResponseBody
    @RequestMapping(value = "/hello", method = RequestMethod.GET)
    public String hello() {
        return "hello spring boot!";
    }
}

```

启动 `HelloSpringBootApplication` 的 `main()` 方法，浏览器访问 `http://localhost:8080/hello `可以看到：

```text
hello spring boot!
```

## 5. 神奇之处

- 没有配置 web.xml
- 没有配置 application.xml，Spring Boot 帮你配置了
- 没有配置 application-mvc.xml，Spring Boot 帮你配置了
- 没有配置 Tomcat，Spring Boot 内嵌了 Tomcat 容器

## 6. 自动配置原理

Spring Boot的启动类上有一个`@SpringBootApplication`注解，这个注解是Spring Boot项目必不可少的注解。

```java
//SpringBootApplication.class
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(
    excludeFilters = {@Filter(
    type = FilterType.CUSTOM,
    classes = {TypeExcludeFilter.class}
), @Filter(
    type = FilterType.CUSTOM,
    classes = {AutoConfigurationExcludeFilter.class}
)}
)
public @interface SpringBootApplication {
    @AliasFor(
        annotation = EnableAutoConfiguration.class
    )
    Class<?>[] exclude() default {};

    @AliasFor(
        annotation = EnableAutoConfiguration.class
    )
    String[] excludeName() default {};

    @AliasFor(
        annotation = ComponentScan.class,
        attribute = "basePackages"
    )
    String[] scanBasePackages() default {};

    @AliasFor(
        annotation = ComponentScan.class,
        attribute = "basePackageClasses"
    )
    Class<?>[] scanBasePackageClasses() default {};
}

```

可以看到这是个复合注解，其中有一个是`@EnableAutoConfiguration`,开启自动配置，说明SpringBoot配置肯定和这个有关。

```java
//EnableAutoConfiguration.class
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage
@Import({AutoConfigurationImportSelector.class})
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";

    Class<?>[] exclude() default {};

    String[] excludeName() default {};
}

```

这个注解也是一个派生注解，其中的关键功能由`@Import({AutoConfigurationImportSelector.class})`提供，其导入的AutoConfigurationImportSelector的selectImports()方法通过SpringFactoriesLoader.loadFactoryNames()扫描所有具有META-INF/spring.factories的jar包。spring-boot-autoconfigure-x.x.x.x.jar里就有一个这样的spring.factories文件。

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-8.png)

最终`@EnableAutoConfiguration`注解通过`@SpringBootApplication`被间接的标记在了Spring Boot的启动类上。在`SpringApplication.run(...)`的内部就会执行`selectImports()`方法，找到所有JavaConfig自动配置类的全限定名对应的class，然后将所有自动配置类加载到Spring容器中。

Spring Boot关于自动配置的源码在spring-boot-autoconfigure-x.x.x.x.jar中：

![](https://github.com/lixd/blog/raw/master/images/java/springboot/first-spring-boot-9.png)

可以看到SpringBoot提供了很多的默认配置，在我们没有手动配置时就会使用提供的默认配置。SpringBoot提倡的`约定大于配置`。

## 参考

`《Spring boot实战》`

`https://blog.csdn.net/u014745069/article/details/83820511`



