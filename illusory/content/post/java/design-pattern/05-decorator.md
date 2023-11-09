---
title: "Java常用设计模式(五)---装饰者模式"
description: "装饰者模式实现及优缺点分析"
date: 2018-12-01 22:00:00
draft: false
tags: ["设计模式"]
categories: ["Java"]
---

本文主要介绍了Java23种设计模式中的装饰者模式，并结合实例描述了装饰者模式的具体实现和优缺点分析。

<!--more-->



## 1. 简介

>  在不必改变原类文件和使用继承的情况下，动态地扩展一个对象的功能。
>
> 它是通过创建一个包装对象，也就是装饰来包裹真实的对象。是继承关系的一个替代方案。

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/decorator.png)

**装饰模式由4种角色组成：**
（1）抽象构件（Component）角色：给出一个抽象接口，以规范准备接收附加职责的对象。
（2）具体构件（Concrete Component）角色：定义一个将要接收附加职责的类。
（3）装饰（Decorator）角色：持有一个构件（Component）对象的实例，并实现一个与抽象构件接口一致的接口，从外类来扩展Component类的功能，但对于Component类来说，是无需知道Decorato的存在的。
（4）具体装饰（Concrete Decorator）角色：负责给构件对象添加上附加的职责。

## 2. 具体实现

```java
/**
 * 抽象构件角色
 * 人类
 *
 * @author illusoryCloud
 */
public interface Human {
    void run();
}

/**
 * 具体构件角色
 * 男人
 *
 * @author illusoryCloud
 */
public class Man implements Human {
    @Override
    public void run() {
        System.out.println("男人跑得很快");
    }
}
/**
 * 抽象装饰角色
 *
 * @author illusoryCloud
 */
public class Decorator implements Human {
    /**
     * 持有一个具体构件的引用
     */
    private Human human;

    public Decorator(Human human) {
        this.human = human;
    }

    @Override
    public void run() {
        human.run();
    }
}

/**
 * 具体装饰角色
 * 飞人
 *
 * @author illusoryCloud
 */
public class FlyMan extends Decorator {
    public FlyMan(Human human) {
        super(human);
    }

    @Override
    public void run() {
        super.run();
        this.fly();
    }

    /**
     * 扩展功能
     */
    private void fly() {
        System.out.println("变成飞人了，跑得更快了~");
    }
}

/**
 * 具体装饰角色
 * 强壮的男人
 *
 * @author illusoryCloud
 */
public class StrongMan extends Decorator {

    public StrongMan(Human human) {
        super(human);
    }

    @Override
    public void run() {
        super.run();
        this.strong();
    }

    public void strong() {
        System.out.println("变得强壮了，耐力提升了~");
    }
}
/**
 * 装饰者模式 测试类
 *
 * @author illusoryCloud
 */
public class DecoratorTest {
    @Test
    public void decoratorTest() {
        //普通对象
        Human man = new Man();
        man.run();
        System.out.println("--------------------");
        //装饰后的对象
        Human flyMan = new FlyMan(man);
        flyMan.run();
        System.out.println("--------------------");
        //装饰后的对象
        Human strongMan = new StrongMan(man);
        strongMan.run();
        System.out.println("--------------------");
        //装饰后的对象再次装饰
        Human strongFlyMan = new StrongMan(flyMan);
        strongFlyMan.run();

    }

}

  //输出
男人在跑
--------------------
男人在跑
变成飞人了，速度加快了~
--------------------
男人在跑
变得强壮了，耐力提升了~
--------------------
男人在跑
变成飞人了，速度加快了~
变得强壮了，耐力提升了~
```

## 3. 总结

**优点**

* 1.**装饰者模式可以提供比继承更多的灵活性**。装饰器模式允许系统动态决定贴上一个需要的装饰，或者除掉一个不需要的装饰。继承关系是不同，继承关系是静态的，它在系统运行前就决定了。

* 2.通过使用不同的具体装饰器以及这些装饰类的排列组合，设计师可以创造出很多不同的行为组合。

**缺点**

由于使用装饰器模式，可以比使用继承关系需要较少数目的类。使用较少的类，当然使设计比较易于进行。但是另一方面，由于使用装饰器模式会产生比使用继承关系更多的对象，更多的对象会使得查错变得困难，特别是这些对象看上去都很像。

**装饰者模式和代理模式对比**

**装饰者模式主要对功能进行扩展，代理模式主要是添加一些无关业务的功能，比如日志，验证等。**

**使用代理模式,代理和真实对象之间的关系在编译时就已经确定了,而装饰器者能够在运行时递归的被构造**.(代理模式会在代理类中创建真实处理类的一个实例,所以可以确定代理和真实对象的关系,而装饰器模式是将原始对象作为一个参数传给装饰器类)

**装饰模式：以对客户端透明的方式扩展对象的功能，是继承关系的一个替代方案；**
**代理模式：给一个对象提供一个代理对象，并有代理对象来控制对原有对象的引用；**

## 4. 装饰者模式在Java中的应用

装饰器模式在Java体系中的经典应用是Java I/O

**抽象构件角色**:`InputStream`

**具体构建角色**:`ByteArrayInputStream`、`FileInputStream`、`ObjectInputStream`、`PipedInputStream`等

**装饰角色**；`FilterInputStream` -->实现了`InputStream`内的所有抽象方法并且持有一个`InputStream`的引用

**具体装饰角色**:`InflaterInputStream`、`BufferedInputStream`、`DataInputStream`等

## 5. 参考

`https://www.cnblogs.com/xrq730/p/4908940.html`



