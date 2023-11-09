---
title: "Java常用设计模式(九)---模板方法模式"
description: "模板方法模式的具体实现和优缺点分析"
date: 2018-12-23 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了Java23种设计模式中的模板方法模式，并结合实例描述了模板方法模式的具体实现和优缺点分析。

<!--more-->



## 1. 简介

**模板方法模式是类的行为模式。**

>  准备一个抽象类，将部分逻辑以具体方法以及具体构造函数的形式实现，然后声明一些抽象方法来迫使子类实现剩余的逻辑。不同的子类可以以不同的方式实现这些抽象方法，从而对剩余的逻辑有不同的实现。
>
>  这就是模板方法模式的用意。

![](https://github.com/lixd/blog/raw/master/images/java/designpattern/template.png)

　　**抽象模板(Abstract Template)角色有如下责任：**

* 定义了一个或多个抽象操作，以便让子类实现。这些抽象操作叫做基本操作，它们是一个顶级逻辑的组成步骤。

* 定义并实现了一个模板方法。这个模板方法一般是一个具体方法，它给出了一个顶级逻辑的骨架，而逻辑的组成步骤在相应的抽象操作中，推迟到子类实现。顶级逻辑也有可能调用一些具体方法。

　　**具体模板(Concrete Template)角色又如下责任：**

* 实现父类所定义的一个或多个抽象方法，它们是一个顶级逻辑的组成步骤。

* 每一个抽象模板角色都可以有任意多个具体模板角色与之对应，而每一个具体模板角色都可以给出这些抽象方法（也就是顶级逻辑的组成步骤）的不同实现，从而使得顶级逻辑的实现各不相同。

## 2. 代码实现

```java
假设泡茶喝咖啡都需有四个步骤：1.烧水 2.泡茶/冲咖啡 3.倒入杯子 4.添加调味品
那么可以写一个抽象类，因为大多数饮料都可以看成这四个步骤。
然后烧水和倒入杯子这两个步骤都是相同的，那么在抽象类中可以直接实现，然后其他特殊操作则由子类具体实现。
/**
 * 模板方法模式
 * 抽象模板角色
 *
 * @author illusoryCloud
 */
public abstract class BaseCreatDrink {
    /**
     * 按顺序调用其他方法
     */
    public void doCreate() {
        boilWater();
        brew();
        pourInCup();
        if (isNeedCondiments())
        {
            addCondiments();
        }
    }

    /**
     * 烧开水
     * 通用的方法 直接实现
     */
    private void boilWater() {
        System.out.println("烧开水~");
    }

    /**
     * 特殊操作，在子类中具体实现
     */
    public abstract void brew();


    /**
     * 倒入杯中
     * 通用的方法 直接实现
     */
    private void pourInCup() {
        System.out.println("倒入杯中~");
    }

    /**
     * 添加调味品 茶里面加柠檬 咖啡中加糖等等
     * 特殊操作
     * 具体由子类实现
     */
    public abstract void addCondiments();

    /**
     * 钩子方法，决定某些算法步骤是否挂钩在算法中
     * 子类可以重写该类来改变算法或者逻辑
     */
    public boolean isNeedCondiments() {
        return true;
    }
}
/**
 * 具体模板角色
 * 纯茶
 *
 * @author illusoryCloud
 */
public class CreatTea extends BaseCreatDrink {
    @Override
    public void brew() {
        System.out.println("泡茶~");
    }

    @Override
    public void addCondiments() {
        System.out.println("加柠檬~");
    }
}
/**
 * 具体模板角色
 * 茶
 *
 * @author illusoryCloud
 */
public class CreatPureTea extends BaseCreatDrink {
    @Override
    public void brew() {
        System.out.println("泡茶~");
    }

    @Override
    public void addCondiments() {
        System.out.println("加柠檬~");
    }

    /**
     * 通过重写钩子方法来改变算法
     * 返回true则添加调味品
     * 返回false则不加
     * 默认为true
     *
     * @return isNeedCondiments
     */
    @Override
    public boolean isNeedCondiments() {
        return false;
    }
}
/**
 * 具体模板角色
 * 咖啡
 *
 * @author illusoryCloud
 */
public class CreatCoffee extends BaseCreatDrink {
    @Override
    public void brew() {
        System.out.println("冲咖啡~");
    }

    @Override
    public void addCondiments() {
        System.out.println("加糖~");
    }
}
/**
 * 模板方法模式 测试类
 *
 * @author illusoryCloud
 */
public class TemplateTest {
    @Test
    public void templateTest() {
        System.out.println("-------茶-------");
        CreatTea tea = new CreatTea();
        tea.doCreate();
        System.out.println("-------咖啡-------");
        CreatCoffee coffee = new CreatCoffee();
        coffee.doCreate();
        System.out.println("-------纯茶-------");
        CreatPureTea pureTea = new CreatPureTea();
        pureTea.doCreate();
    }
}
//输出
往锅里加的是白菜~
炒啊炒啊炒~
菜炒好了，起锅~
往锅里加的是肉~
炒啊炒啊炒~
菜炒好了，起锅~
```

## 3. 总结

**模板方法模式在Java中的应用**

最常见的就是Servlet了。

**HttpServlet担任抽象模板角色**

　　　　模板方法：由service()方法担任。

　　　　基本方法：由doPost()、doGet()等方法担任。

**MyServlet担任具体模板角色**

自定义的servlet置换掉了父类HttpServlet中七个基本方法中的其中两个，分别是doGet()和doPost()。

## 4. 参考

`https://www.cnblogs.com/qiumingcheng/p/5219664.html`

`https://www.cnblogs.com/yanlong300/p/8446261.html`