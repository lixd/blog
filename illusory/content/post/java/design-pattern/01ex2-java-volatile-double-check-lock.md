---
title: "volatile关键字在单例模式(双重校验锁)中的作用"
description: "双重校验锁式单例模式中volatile关键字起什么作用？《并发编程的艺术》笔记"
date: 2018-12-03 22:00:00
draft: false
categories: ["Java"]
tags: ["Java"]
---

本文主要讲述了Java单例模式之双重校验锁中`volatile`关键字的作用。

<!--more-->

上篇文章[Java设计模式(一)--单例模式](https://www.lixueduan.com/posts/53093.html)中讲了Java单例模式的几种写法，其中`懒汉式`和`双重校验锁`方式写法如下：

## 1. 懒汉式

```java
public class Singleton {  
    private static Singleton instance;  

    private Singleton (){}  

    public static synchronized Singleton getInstance() {  
    if (instance == null) {  
        instance = new Singleton();  
    }  
   　　 return instance;  
    }  

}
```

这种方式实现的单例：实现了`lazy loading` 使用时才创建实例。`synchronized`保证了线程安全，但效率低。

## 2. 双重校验锁

```java
public class Singleton {
    private static volatile Singleton singleton;

    private Singleton() {
    }

    public static Singleton getInstance() {
        if (singleton == null) { 
            synchronized (Singleton.class) { //1
                if (singleton == null) { //2
                    singleton = new Singleton(); //3
                }
            }
        }
        return singleton;
    }
}
```

## 3. 执行过程

双重校验锁方式的执行过程如下：

1.`线程A`进入 `getInstance()` 方法。 

2.由于 `singleton`为 `null`，`线程A`在 //1 处进入 `synchronized` 块。  

3.`线程A`被`线程B`预占。 

4.`线程B `进入 `getInstance()` 方法。 

5.由于 `singleton`仍旧为 `null`，`线程B`试图获取 //1 处的锁。然而，由于`线程A`已经持有该锁，`线程B`在 //1 处阻塞。

6.`线程B`被`线程A`预占。

7.`线程A`执行，由于在 //2 处实例仍旧为 `null`，`线程A`还创建一个 `Singleton` 对象并将其引用赋值给 `instance`。

8.`线程A`退出 `synchronized` 块并从 `getInstance()` 方法返回实例。 

9.`线程A`被`线程B`预占。

10.`线程B`获取 //1 处的锁并检查 `instance` 是否为 `null`。 

11.由于 `singleton`是非 `null` 的，并没有创建第二个 `Singleton` 对象，由`线程A`所创建的对象被返回。

## 4. 问题

双重检查锁定背后的理论是完美的。不幸地是，现实完全不同。**双重检查锁定的问题是：并不能保证它会在单处理器或多处理器计算机上顺利运行。**

**双重检查锁定失败的问题并不归咎于 JVM 中的实现 bug，而是归咎于 Java 平台内存模型。内存模型允许所谓的“无序写入”，这也是这些习语失败的一个主要原因。**

 `singleton = new Singleton();`

该语句非原子操作，实际是三个步骤。

* 1.给 singleton 分配内存；
* 2.调用 Singleton 的构造函数来初始化成员变量；
* 3.将给 singleton 对象指向分配的内存空间（此时 singleton 才不为 null ）；

虚拟机的`指令重排序`-->

执行命令时虚拟机可能会对以上3个步骤交换位置 最后可能是132这种 分配内存并修改指针后未初始化 多线程获取时可能会出现问题。

当`线程A`进入同步方法执行`singleton = new Singleton();`代码时，恰好这三个步骤重排序后为`1 3 2`，

那么`步骤3`执行后 `singleton` 已经不为 `null` ,但是未执行`步骤2`，`singleton `对象初始化不完全，此时`线程B`执行 `getInstance()` 方法，第一步判断时 `singleton` 不为null,则直接将未完全初始化的`singleton`对象返回了。

## 5. 解决

**如果一个字段被声明成volatile，Java线程内存模型确保所有线程看到这个变量的值是一致的，同时还会禁止指令重排序**

所以使用`volatile`关键字会禁止指令重排序,可以避免这种问题。使用`volatile`关键字后使得 `singleton = new Singleton();`语句一定会按照上面拆分的步骤123来执行。

## 参考

`https://blog.csdn.net/qq646040754/article/details/81327933`