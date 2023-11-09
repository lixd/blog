---
title: "SSM系列(一)---Spring IoC 分析"
description: "Spring IoC具体流程分析"
date: 2018-09-30 22:00:00
draft: false
categories: ["Java"]
tags: ["Spring"]
---

本文主要介绍了 Spring 框架，通过代码演示详细讲述了 Spring IoC 的具体流程。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. 概述

Spring 是一个开源容器框架，可以接管 web 层，业务层，dao 层，持久层的组件，并且可以配置各种bean,和维护 bean 与 bean 之间的关系。其核心就是控制反转(IoC),和面向切面(AOP),简单的说就是一个分层的轻量级开源框架。 

## 2. Spring 中的 IoC

* IoC：(Inverse of Control )控制反转，容器主动将资源推送给它所管理的组件，组件所做的是选择一种合理的方式接受资源。

  简单的理解：把创建对象和维护之间的关系的权利由程序中转移到Spring容器的配置文件中。

* DI : (Dependency Injection) 依赖注入，IoC 的另一种表现方式，组件以一种预先定义好的方式来接受容器注入的资源。

## 3. IoC 例子

### 3.1 xml 配置文件方式

#### 1. 准备 bean 对象

先准备两个简单的实体类 Student 和 Book，需要提供Getter/Setter 和有参数无参构造方法等。

> Spring Bean是事物处理组件类和实体类（POJO）对象的总称，Spring Bean 被Spring IoC 容器初始化，装配和管理。 

```java
/**
 * @author illusory
 * @version 1.0.0
 * @date 2019/4/18 0018
 */
public class Student {
    private String name;
    private int age;
    private Book book;
    //省略Getter/Setter和构造方法
}

/**
 * @author illusory
 * @version 1.0.0
 * @date 2019/4/18
 */
public class Book {
    private String type;
    private String name;
   //省略Getter/Setter和构造方法
}

```

#### 2. 将 Bean 类添加到 Spring IoC 容器

将 Bean 类添加到 Spring IoC 容器有三种方式。

* 一种方式是基于XML的配置文件；
* 一种方式是基于注解的配置；
* 一种方式是基于 Java 的配置。

##### 1. Spring Bean 类的配置项

Spring IoC 容器管理 Bean 时，需要了解 Bean 的类名、名称、依赖项、属性、生命周期及作用域等信息。为此，Spring IoC 提供了一系列配置项，用于 Bean 在 IoC 容器中的定义。

* ① class

该配置项是强制项，用于指定创建 Bean 实例的 Bean 类的路径。

* ② name

该配置项是强制项，用于指定 Bean 唯一的标识符，在基于 XML 的配置项中，可以使用 id和或 name 属性来指定 Bean 唯一标识符。

* ③ scope

该配置项是可选项，用于设定创建 Bean 对象的作用域。

* ④ constructor-arg

该配置项是可选项，用于指定通过构造函数注入依赖数据到 Bean。

* ⑤ properties

该配置项是可选项，用于指定通过 set 方法注入依赖数据到 Bean。

* ⑥ autowiring mode

该配置项是可选项，用于指定通过自动依赖方法注入依赖数据到 Bean。

* ⑦ lazy-initialization mode

该配置项是可选项，用于指定 IoC 容器延迟创建 Bean，在用户请求时创建 Bean，而不要在启动时就创建 Bean。

* ⑧ initialization

该配置项是可选项，用于指定 IoC 容器完成 Bean 必要的创建后，调用 Bean 类提供的回调方法对 Bean 实例进一步处理。

* ⑨ destruction

该配置项是可选项，用于指定 IoC 容器在销毁 Bean 时，调用 Bean 类提供的回调方法。

##### 2. Spring xml 配置文件

下面主要介绍基于XML的配置方式，基于注解和基于Java的配置放在后面进行讨论，放在后面讨论的原因是一些其它重要的Spring概念还需要掌握。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
    <!-- bean的配置文件 -->
    <bean id="student" class="spring.Student">
        <property name="name" value="illusory"></property>
        <property name="age" value="23"></property>
        <property name="book" ref="book"></property>
    </bean>
    <bean id="book" class="spring.Book">
        <property name="name" value="think in java"></property>
        <property name="type" value="CS"></property>
    </bean>
</beans>
```
### 3.2 注解方式

使用注解需要在xml配置文件中开启组件扫描

```xml
    <!--配置组件扫描-->
    <context:component-scan base-package="spring"/>
```

#### 1.定义 bean

定义一个 bean 实体类或组件

```java
@Component(value = "book")
public class Book {
    private String type;
    private String name;
   //省略Getter/Setter和构造方法
}
```

#### 2. 配置 bean

* 基本配置

```java
@Component(value = "book")
public class Book {
    private String type;
    private String name;
   //省略Getter/Setter和构造方法
}
```

其中`@Component(value = "book")`相当于`<bean id="book" class="spring.Book">`
**Bean实例的名称默认是Bean类的首字母小写，其他部分不变**

* 属性注入

**普通类型注入**:  `@Value(value = "illusory")`
**引用类型注入**:  `@Autowired/@Resources(name="")` 

```java
@Component(value = "student")
public class Student {
    @Value(value = "illusory")
    private String name;
    @Value(value = "23")
    private int age;
    @Autowired
    private Book book;
}

@Component(value = "book")
public class Book {
    @Value(value = "defaultType")
    private String type;
    @Value(value = "defaultName")
    private String name;
}
```

#### 3. 获取 bean

```java
    public static void main(String[] args) {
        // 根据配置文件创建 IoC 容器
        ApplicationContext ac = new ClassPathXmlApplicationContext("applicationContext.xml");
        // 从容器中获取 bean 实例
        Student student = (Student) ac.getBean("student");
        // 使用bean
        System.out.println(student.getName());
        //成功打印出 illusory
    }
```

### 3.3 测试

```java
/**
 * @author illusory
 * @version 1.0.0
 * @date 2019/4/18
 */
public class SpringTest {
    public static void main(String[] args) {
        // 根据配置文件创建 IoC 容器
        ApplicationContext ac = new ClassPathXmlApplicationContext("applicationContext.xml");
        // 从容器中获取 bean 实例 这里的名称就是配置文件中的id="student"
        Student student = (Student) ac.getBean("student");
        // 使用bean
        System.out.println(student.getName());
        //成功打印出 illusory
    }
}
```

## 4. 简要分析

### 4.1 创建Spring IoC 容器

```java
ApplicationContext ac = new ClassPathXmlApplicationContext("applicationContext .xml")
```
执行这句代码时 Spring 容器对象被创建，同时 `applicationContext .xml`中配置的 bean 就会被创建到内存中。

### 4.2 Bean注入

Bean 注入的方式有两种；

* 一种是`在XML中配置`，此时分别有`属性注入`、`构造函数注入`和`工厂方法注入`；
* 另一种则是使用`注解`的方式注入: `@Autowired`、`@Resource`、`@Required`。

#### 1. 在xml文件中配置依赖注入

* 属性注入

> 属性注入即通过setXxx()方法注入Bean的属性值或依赖对象，属性注入要求Bean提供一个默认的构造函数，并为需要注入的属性提供对应的Setter方法。Spring先调用Bean的默认构造函数实例化Bean对象，然后通过反射的方式调用Setter方法注入属性值。

由于属性注入方式具有可选择性和灵活性高的优点，因此属性注入是实际应用中最常采用的注入方式。
```xml
<bean id="book" class="spring.Book">
        <property name="name" value="think in java"></property>
        <property name="type" value="CS"></property>
</bean>
```
例子中的这个就是属性注入。

* 构造方法注入

>  使用构造函数注入的前提是 **Bean必须提供带参数的构造函数**。

```xml
    <bean id="book" class="spring.Book">
        <constructor-arg name="name" value="think in java"></constructor-arg>
        <constructor-arg name="type" value="CS"></constructor-arg>
    </bean>
```
* 工厂方法注入

> 有时候 bean 对象不能直接 new，只能通过工厂方法创建。

```java
/**
 * @author illusory
 * @version 1.0.0
 * @date 2019/4/18 0018
 */
public class BookFactory {
    //非静态方法
    public Book createBook() {
        Book book = new Book();
        book.setName("图解HTTP");
        book.setType("HTTP");
        return book;
    }

    //静态方法
    public static Book createBookStatic() {
        Book book = new Book();
        book.setName("大话数据结构");
        book.setType("数据结构");
        return book;
    }
}
```

**非静态方法**：必须实例化工厂类（factory-bean）后才能调用工厂方法

```xml
 <bean id="bookFactory" class="spring.BookFactory"></bean>
 <bean id="book" class="spring.Book" factory-bean="bookFactory" factory-method="createBook"></bean>
```
**静态方法**：不用实例化工厂类（factory-bean）后才能调用工厂方法

```xml
<bean id="book" class="spring.Book" factory-method="createBookStatic"></bean>
```
### 4.3 获取 bean 实例

接着通过从 Spring 容器中根据名字获取对应的 bean 。

```java
Student student = (Student) ac.getBean("student");
```

## 5. 小结

### 5.1 大致流程

* 1.**定义bean**：定义一个 bean 实体类或组件
* 2.**配置 bean** 
  * **基本配置** xml 配置文件中注册这个 bean
  * **属性注入** xml 配置文件中为这个 bean 注入属性 
    * **XML中配置** : `属性注入`、`构造方法注入`、`工厂方法注入 `
    * **注解方式** : `@Autowired`、`@Resource`、`@Required`

* 3.**获取 bean 实例**：根据 name(即配置文件中的 bean id) 从 Spring 容器中获取 bean 实例

### 5.2 具体代码

#### 1. 定义 bean

定义一个 bean 实体类或组件

```java
public class Book {
    private String type;
    private String name;
   //省略Getter/Setter和构造方法
}
```
#### 2. 配置 bean 
* 基本配置

```xml
    <bean id="book" class="spring.Book">
    </bean>
```
* 属性注入

```xml
    <bean id="book" class="spring.Book">
        <property name="name" value="think in java"></property>
        <property name="type" value="CS"></property>
    </bean>
```
#### 3. 获取 bean

```java
 // 根据配置文件创建 IoC 容器
        ApplicationContext ac = new ClassPathXmlApplicationContext("applicationContext.xml");
        // 从容器中获取 bean 实例
        Student student = (Student) ac.getBean("student");
```

## 6. 参考

`https://blog.csdn.net/u010648555/article/details/76299467 `
`https://www.cnblogs.com/_popc/p/3972212.html`
`https://www.cnblogs.com/wnlja/p/3907836.html`