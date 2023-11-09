---
title: "Java常用设计模式(八)---策略模式"
description: "策略模式的具体实现及其优缺点分析"
date: 2018-12-19 22:00:00
draft: false
tags: ["设计模式"]
categories: ["Java"]
---

本文主要介绍了Java23种设计模式中的策略模式，并结合实例描述了策略模式的具体实现和策略模式的优缺点分析。

<!--more-->



## 1. 简介

> **策略模式是对算法的包装**
>
> 策略模式定义了一系列的算法，并将每一个算法封装起来，而且它们还可以相互替换。策略模式让算法独立于使用它的客户而独立变化。

![](https://github.com/lixd/blog/raw/master/images/java/design-pattern/strategy.png)

　　这个模式涉及到三个角色：

　　●　　**环境(Context)角色**：持有一个Strategy的引用。

　　●　　**抽象策略(Strategy)角色**：这是一个抽象角色，通常由一个接口或抽象类实现。此角色给出所有的具体策略类所需的接口。

　　●　　**具体策略(ConcreteStrategy)角色**：包装了相关的算法或行为。

## 2. 代码实现

```java
/**
 * 策略模式 抽象策略角色
 * 定义一个两个整数间的计算方法
 *
 * @author illusoryCloud
 */
public interface Strategy {
    /**
     * 两个整数间的计算方法
     *
     * @param a
     * @param b
     * @return
     */
    int calculate(int a, int b);
}
/**
 * 策略模式 具体策略角色
 * 加法
 *
 * @author illusoryCloud
 */
public class AddStrategy implements Strategy {
    @Override
    public int calculate(int a, int b) {
        return a + b;
    }
}
/**
 * 策略模式 具体策略角色
 * 减法
 *
 * @author illusoryCloud
 */
public class SubtractionStrategy implements Strategy {
    @Override
    public int calculate(int a, int b) {
        return a - b;
    }
}
/**
 * 策略模式 具体策略角色
 * 乘法
 *
 * @author illusoryCloud
 */
public class MultiplyStrategy implements Strategy {
    @Override
    public int calculate(int a, int b) {
        return a * b;
    }
}
/**
 * 策略模式 具体策略角色
 * 除法
 *
 * @author illusoryCloud
 */
public class DivisionStrategy implements Strategy {
    @Override
    public int calculate(int a, int b) {
        if (b != 0) {
            return a / b;
        } else {
            throw new RuntimeException("除数不能为零");
        }

    }
}
/**
 * 策略模式 环境角色
 *
 * @author illusoryCloud
 */
public class Context {
    /**
     * 持有Strategy的引用
     */
    private Strategy strategy;

    public Context(Strategy strategy) {
        super();
        this.strategy = strategy;
    }


    public Strategy getStrategy() {
        return strategy;
    }

    /**
     * set方法可以完成策略更换
     */
    public void setStrategy(Strategy strategy) {
        this.strategy = strategy;
    }

    public int calculate(int a, int b) {
        return strategy.calculate(a, b);
    }
}
/**
 * 策略模式 测试类
 *
 * @author illusoryCloud
 */
public class StrategyTest {
    @Test
    public void strategyTest() {

        //加法
        Context context = new Context(new AddStrategy());
        System.out.println(context.calculate(5, 5));
        //减法
        Context context2 = new Context(new SubtractionStrategy());
        System.out.println(context2.calculate(5, 5));
        //乘法
        Context context3 = new Context(new MultiplyStrategy());
        System.out.println(context3.calculate(5, 5));
        //除法
        Context context4 = new Context(new DivisionStrategy());
        System.out.println(context4.calculate(5, 5));
    }
}
```

## 3. 总结

**策略模式的重心不是如何实现算法**（就如同工厂模式的重心不是工厂中如何产生具体子类一样），而是如何组织、调用这些算法，从而让程序结构更灵活，具有更好的维护性和扩展性。

**策略模式与状态模式**

策略模式与状态模式及其相似，但是二者有其内在的差别，策略模式将具体策略类暴露出去，调用者需要具体明白每个策略的不同之处以便正确使用。而状态模式状态的改变是由其内部条件来改变的，与外界无关，二者在思想上有本质区别。

**优点**

1.让代码更优雅，避免了多重条件if...else语句。

2.策略模式提供了管理相关算法簇的办法，恰当使用继承可以把公共代码移到父类，从而避免了代码重复。

**缺点**

1.客户端必须知道所有的策略类，并自行决定使用 哪一个策略，这意味着客户端必须理解这些算法的区别，以便选择恰当的算法

2.如果备选策略很多，对象的数据会很多

## 4. 参考

`https://www.cnblogs.com/xrq730/p/4906313.html`

