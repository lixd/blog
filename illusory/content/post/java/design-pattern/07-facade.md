---
title: "Java常用设计模式(七)---外观模式"
description: "外观模式的实现及其在Tomcat中的使用"
date: 2018-12-17 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了Java23种设计模式中的外观模式，并结合实例描述了 模式的具体实现和性能分析测试。

<!--more-->



## 1. 简介

> 它通过引入一个外观角色来简化客户端与子系统之间的交互，为复杂的子系统调用提供一个统一的入口，降低子系统与客户端的耦合度，且客户端调用非常方便。

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/facade.jpg)

**外观模式结构**：

**SubSystem**: 子系统角色。表示一个系统的子系统或模块。

**Facade**: 外观角色，客户端通过操作外观角色从而达到控制子系统角色的目的。对于客户端来说，外观角色好比一道屏障，对客户端屏蔽了子系统的具体实现。

## 2. 具体实现

```java
/**
 * 子系统角色类
 * 电脑CPU
 *
 * @author illusoryCloud
 */
public class CPU {
    public void startUp(){
        System.out.println("cpu is  startUp...");
    }
    public void shutDown(){
        System.out.println("cpu is  shutDown...");

    }
}

/**
 * 子系统角色类
 * 电脑硬盘
 *
 * @author illusoryCloud
 */
public class Disk {
    public void startUp() {
        System.out.println("disk is  startUp...");
    }

    public void shutDown() {
        System.out.println("disk is  shutDown...");

    }
}

/**
 * 子系统角色类
 * 电脑内存
 *
 * @author illusoryCloud
 */
public class Memory {
    public void startUp() {
        System.out.println("memory is  startUp...");
    }

    public void shutDown() {
        System.out.println("memory is  shutDown...");

    }
}

/**
 * 外观角色
 * 电脑
 * 用户通过操作当前类即可达到操作所有子系统的目的
 *
 * @author illusoryCloud
 */
public class Computer {
    private CPU cpu;
    private Disk disk;
    private Memory memory;

    public Computer() {
        cpu = new CPU();
        disk = new Disk();
        memory = new Memory();
    }

    public void startUp() {
        cpu.startUp();
        disk.startUp();
        memory.startUp();
    }

    public void shutDown() {
        cpu.shutDown();
        disk.shutDown();
        memory.shutDown();
    }
}

/**
 * 外观模式 测试类
 *
 * @author illusoryCloud
 */
public class FacedeTest {
    @Test
    public void facedeTest() {
        Computer computer = new Computer();
        computer.startUp();
        System.out.println("------------------");
        computer.shutDown();
    }
}
```

## 3. 总结

**外观模式的优点**

外观模式有如下几个优点：

1、**松散耦合**

外观模式松散了客户端和子系统的耦合关系，让子系统内部的模块能更容易扩展和维护

2、**简单易用**

客户端不需要了解系统内部的实现，也不需要和众多子系统内部的模块交互，只需要和外观类交互就可以了

3、**更好地划分层次**

通过合理使用Facade，可以帮助我们更好地划分层次。有些方法是系统对内的，有些方法是对外的，把需要暴露给外部的功能集中到Facade中，这样既方便客户端使用，也很好地隐藏了内部的细节

## 4. Tomcat中的外观模式

Tomcat中有很多场景都使用到了外观模式，因为Tomcat中有很多不同的组件，每个组件需要相互通信，但又不能将自己内部数据过多地暴露给其他组件。用外观模式隔离数据是个很好的方法，比如Request上使用外观模式。

比如Servlet，doGet和doPost方法，参数类型是接口HttpServletRequest和接口HttpServletResponse，那么Tomcat中传递过来的真实类型到底是什么呢？

在真正调用Servlet前，会经过很多Tomcat方法，传递给Tomcat的request和response的真正类型是一个Facade类。

　Request类

```java
    public HttpServletRequest getRequest() {
        if (facade == null) {
            facade = new RequestFacade(this);
        }
        return facade;
    }

```

　Response类

```java
    public HttpServletResponse getResponse() {
        if (facade == null) {
            facade = new ResponseFacade(this);
        }
        return (facade);
    }
```



因为Request类中很多方法都是组件内部之间交互用的，比如setComet、setReuqestedSessionId等方法，这些方法并不对外公开，但又必须设置为public，因为还要和内部组件交互使用。最好的解决方法就是通过使用一个Facade类，屏蔽掉内部组件之间交互的方法，只提供外部程序要使用的方法。

如果不使用Facade，直接传递的是HttpServletRequest和HttpServletResponse，那么熟悉容器内部运作的开发者可以分别把ServletRequest和ServletResponse向下转型为HttpServletRequest和HttpServletResponse，这样就有安全性的问题了。

## 5. 参考

`https://www.cnblogs.com/xrq730/p/4908822.html`