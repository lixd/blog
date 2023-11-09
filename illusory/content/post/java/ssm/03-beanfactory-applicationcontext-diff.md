---
title: "SSM系列(三)---BeanFactory 与 ApplicationContext"
description: "Spring 框架中 BeanFactory 与 ApplicationContext 的区别"
date: 2018-10-10 22:00:00
draft: false
categories: ["Java"]
tags: ["Spring"]
---

本文主要介绍了 Spring 框架中 BeanFactory 与 ApplicationContext 的区别。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1.  BeanFactory

### 1.1 概述

BeanFactory 是 Spring 的“心脏”。它就是 Spring IoC 容器的真面目。Spring 使用 BeanFactory 来实例化、配置和管理 Bean。

BeanFactory：是IOC容器的核心接口， 它定义了IOC的基本功能，我们看到它主要定义了getBean方法。getBean方法是IOC容器获取bean对象和引发依赖注入的起点。方法的功能是返回特定的名称的Bean。

BeanFactory 是初始化 Bean 和调用它们生命周期方法的“吃苦耐劳者”。注意，BeanFactory 只能管理单例（Singleton）Bean 的生命周期。它不能管理原型(prototype,非单例)Bean 的生命周期。这是因为原型 Bean 实例被创建之后便被传给了客户端,容器失去了对它们的引用。

### 1.2 源码分析

BeanFactory 源码如下：

```java
package org.springframework.beans.factory;

public interface BeanFactory {

    /**
     * 用来引用一个实例，或把它和工厂产生的Bean区分开，就是说，如果一个FactoryBean的名字为a，那么，&a会得到那个Factory
     */
    String FACTORY_BEAN_PREFIX = "&";

    /*
     * 四个不同形式的getBean方法，获取实例
     */
    Object getBean(String name) throws BeansException;

    <T> T getBean(String name, Class<T> requiredType) throws BeansException;

    <T> T getBean(Class<T> requiredType) throws BeansException;

    Object getBean(String name, Object... args) throws BeansException;

    boolean containsBean(String name); // 是否存在

    boolean isSingleton(String name) throws NoSuchBeanDefinitionException;// 是否为单实例

    boolean isPrototype(String name) throws NoSuchBeanDefinitionException;// 是否为原型（多实例）

    boolean isTypeMatch(String name, Class<?> targetType)
            throws NoSuchBeanDefinitionException;// 名称、类型是否匹配

    Class<?> getType(String name) throws NoSuchBeanDefinitionException; // 获取类型

    String[] getAliases(String name);// 根据实例的名字获取实例的别名

}
```

### 1.3 方法列表

* 4个获取实例的方法。getBean的重载方法。

* 4个判断的方法。判断是否存在，是否为单例、原型，名称类型是否匹配。

* 1个获取类型的方法、1个获取别名的方法。根据名称获取类型、根据名称获取别名。

这10个方法，很明显，这是一个典型的工厂模式的工厂接口。

### 1.4 实例演示

在 Spring 3.2 之前的版本中，BeanFactory最常见的实现类为XmlBeanFactory(已废弃)，建议使用 XmlBeanDefinitionReader 与 DefaultListableBeanFactory。可以从classpath或文件系统等获取资源。

拿前面的 Book 举例

```java
public class Book {
    private String type;
    private String name;
   //省略Getter/Setter和构造方法
}
```

xml 配置文件

```xml
 <bean id="book" class="spring.Book">
        <property name="name" value="think in java"></property>
        <property name="type" value="CS"></property>
    </bean>
```

使用 DefaultListableBeanFactory 与 XmlBeanDefinitionReader 来启动 IoC 容器

```java
public static void main(String[] args) {
	 esourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
	 Resource resource = resolver.getResource("classpath:beans.xml");
	 System.out.println("getURL:" + resource.getURL());
    　DefaultListableBeanFactory factory = new DefaultListableBeanFactory();
	 XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(factory);
	 reader.loadBeanDefinitions(resource);
　　　　//ApplicationContext factory=new ClassPathXmlApplicationContext("applicationContext.xml"); 
            
       Book book = factory.getBean("book",Book.class);
       System.out.println("boook对象已经初始化完成");
       System.out.println(book.getName());
}
```

### 1.5 小结

* XmlBeanFactory通过Resource装载Spring配置信息冰启动IoC容器，然后就可以通过factory.getBean从IoC容器中获取Bean了。
* **通过BeanFactory启动IoC容器时，并不会初始化配置文件中定义的Bean，初始化动作发生在第一个调用时**。
* 对于单实例（singleton）的Bean来说，BeanFactory会缓存Bean实例，所以第二次使用getBean时直接从IoC容器缓存中获取Bean。

## 2. ApplicationContext

ApplicationContext由BeanFactory派生而来，提供了更多面向实际应用的功能。在BeanFactory中，很多功能需要以编程的方式实现，而在ApplicationContext中则可以通过配置实现。

BeanFactorty接口提供了配置框架及基本功能，但是无法支持spring的aop功能和web应用。而ApplicationContext接口作为BeanFactory的派生，因而提供BeanFactory所有的功能。而且ApplicationContext还在功能上做了扩展，相较于BeanFactorty，ApplicationContext还提供了以下的功能： 

（1）MessageSource, 提供国际化的消息访问 
（2）资源访问，如URL和文件 
（3）事件传播特性，即支持aop特性
（4）载入多个（有继承关系）上下文 ，使得每一个上下文都专注于一个特定的层次，比如应用的web层 

ApplicationContext：是IOC容器另一个重要接口， 它继承了BeanFactory的基本功能， 同时也继承了容器的高级功能，如：MessageSource（国际化资源接口）、ResourceLoader（资源加载接口）、ApplicationEventPublisher（应用事件发布接口）等。

## 3. 二者区别

### 3.1 bean 加载时机

`BeanFactroy` 采用的是`延迟加载`形式来注入 Bean 的，即只有在使用到某个Bean时(调用getBean())，才对该Bean进行加载实例化，这样，我们就不能发现一些存在的Spring的配置问题。
`ApplicationContext`则相反，它是在`容器启动时`，一次性`创建`了所有的Bean。这样，在容器启动时，我们就可以发现Spring中存在的配置错误。 

### 3.2 Bean 注册

BeanFactory 和 ApplicationContext 都支持 BeanPostProcessor、BeanFactoryPostProcessor 的使用。

但两者之间的区别是：BeanFactory需要手动注册，而ApplicationContext则是自动注册。

Applicationcontext比 beanFactory 加入了一些更好使用的功能。而且 beanFactory 的许多功能需要通过编程实现而 Applicationcontext 可以通过配置实现。

比如后处理 bean，ApplicationContext 直接配置在配置文件即可而 BeanFactory 这要在代码中显示的写出来才可以被容器识别。

### 3.3 使用场景

BeanFactory 主要是面对与 Spring 框架的基础设施，面对 Spring 自己。

ApplicationContext 主要面对与 Spring 使用的开发者。

基本都会使用 ApplicationContext 并非 BeanFactory 。

## 4. 总结

* 1.BeanFactory 负责读取 bean 配置文档，管理 bean 的加载，实例化，维护 bean 之间的依赖关系，负责bean 的声明周期。
* 2.ApplicationContext 除了提供上述 BeanFactory 所能提供的功能之外，还提供了更完整的框架功能：
  * a. 国际化支持(MessageSource)
  * b. 资源访问(ResourceLoader)
  * c.载入多个（有继承关系）上下文 ，使得每一个上下文都专注于一个特定的层次，比如应用的web层 
  * d.消息发送、响应机制（ApplicationEventPublisher）
  * e.AOP（拦截器）

## 5. 参考

`https://www.cnblogs.com/xiaoxi/p/5846416.html`

`https://www.jianshu.com/p/2808f7c4a24f`