---
title: "Java设计模式(二)---工厂模式"
description: "工厂模式的实现与使用场景分析"
date: 2018-11-18 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本章主要介绍了设计模式中的工厂模式，并结合实例描述了工厂模式的具体实现和使用场景。包括：`普通工厂模式`、`工厂方法模式`、`抽象工厂模式`等。

<!--more-->

## 1. 简介

工厂模式可以分为普通工厂模、工厂方法模式和抽象工厂模式。

**简单工厂模式**：建立一个工厂类，根据传入的参数对实现了同一接口的一些类进行实例的创建。如果传入的字符串错误就不能正确创建对象。

**工厂方法模式**：是对普通工厂方法模式的改进，提供多个工厂方法，分别创建对象。

**抽象工厂模式**：创建多个工厂类，这样一旦需要增加新的功能，直接增加新的工厂类就可以了，不需要修改之前的代码。

**工厂模式优点：**

(1) `解耦 `：把对象的创建和使用的过程分开

(2)`减少重复代码`: 若创建对象的过程很复杂，有一定的代码量，且很多地方都要用到，那么就会有很多重复代码。

(3) `降低维护成本` ：创建过程都由工厂统一管理，发生业务逻辑变化，只需要在工厂里修改即可。

**适用场景**

（1）需要创建的对象较少。

（2）客户端不关心对象的创建过程。

## 2. 简单工厂模式

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/easy-factory.png)

```java
/**
 * 抽象产品类 水果
 */
public interface Fruit {
    void show();
}

/**
 * 具体产品类
 * 苹果  实现了水果接口
 * @author illusoryCloud
 */
public class Apple implements Fruit {
    @Override
    public void show() {
        System.out.println("This is Apple");
    }
}
/**
 * 具体产品类
 * 橘子 实现了水果接口
 * @author illusoryCloud
 */
public class Orange implements Fruit {
    @Override
    public void show() {
        System.out.println("This is Orange");
    }
}
/**
 * 工厂类   水果工厂
 * 负责生产各种产品
 *
 * @author illusoryCloud
 */
public class FruitFactory {
    public static final String FRUIT_APPLE = "Apple";
    public static final String FRUIT_ORANGE = "Orange";

    public static Fruit creatFruit(String fruit) {
        if (FRUIT_APPLE.equals(fruit)) {
            return new Apple();
        } else if (FRUIT_ORANGE.equals(fruit)) {
            return new Orange();
        } else {
            System.out.println("error unknown fruit ~");
            return null;
        }
    }
}



/**
 * 简单工厂模式 测试
 *
 * @author illusoryCloud
 *
 */
public class EasyFactoryTest {
    @Test
    public void testEasyFactory() {
        Fruit apple = FruitFactory.creatFruit(FruitFactory.FRUIT_APPLE);
        if (apple != null) {
            apple.show();
        }
        Fruit orange = FruitFactory.creatFruit(FruitFactory.FRUIT_ORANGE);
        if (orange != null) {
            orange.show();
        }
    }
}
```



## 3. 工厂方法模式

简单工厂模式中，如果创建对象时传入的字符串出现错误则不能正确创建产品。工厂方法模式为每种产品创建一个工厂，则不会出现这样的问题。

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/factory-method.png)

```java
/**
 *  抽象产品工厂类
 * @author illusoryCloud
 */
public interface FruitFactory {
    Fruit create();
}
/**
 * 具体产品工厂 实现接口
 * 苹果工厂
 * @author illusoryCloud
 */
public class AppleFactory implements FruitFactory {
    @Override
    public Fruit create() {
        return new Apple();
    }
}
/**
 * 具体产品工厂 实现接口
 * 苹果工厂
 * @author illusoryCloud
 */
public class AppleFactory implements FruitFactory {
    @Override
    public Fruit create() {
        return new Apple();
    }
}
/**
 * 工厂方法模式 测试类
 *
 * @author illusoryCloud
 */
public class FactoryMethodTest {
    @Test
    public void factoryMethodTest() {
        Fruit apple = new AppleFactory().create();
        apple.show();
        Fruit orange = new OrangeFactory().create();
        orange.show();
    }
}
```

## 4. 抽象工厂模式

网上找的一个类图：

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/abstract-factory.jpg)

> 工厂方法模式有一个问题就是，类的创建依赖工厂类，也就是说，如果想要拓展程序，必须对工厂类进行修改，这违背了闭包原则，所以，从设计角度考虑，有一定的问题，如何解决？就用到抽象工厂模式，创建多个工厂类，这样一旦需要增加新的功能，直接增加新的工厂类就可以了，不需要修改之前的代码。

```java
/**
 * 抽象产品类 果汁
 *
 * @author illusoryCloud
 */
public interface Juice {
    void show();
}
/**
 * 具体产品类
 * 苹果汁
 *
 * @author illusoryCloud
 */
public class AppleJuice implements Juice {
    @Override
    public void show() {
        System.out.println("AppleJuice");
    }
}

/**
 * 具体产品类
 * 橘子汁
 *
 * @author illusoryCloud
 */
public class OrangeJuice implements Juice {
    @Override
    public void show() {
        System.out.println("OrangeJuice");
    }
}

/**
 * 抽象工厂类
 *
 * @author illusoryCloud
 */
public interface AbstractFactory {
    /**
     * 创建水果
     *
     * @return 水果
     */
    Fruit createFruit();

    /**
     * 创建果汁
     *
     * @return 果汁
     */
    Juice createJuice();
}

/**
 * 具体工厂类
 * 苹果工厂 生产苹果和苹果汁
 *
 * @author illusoryCloud
 */
public class AppleFactory implements AbstractFactory {
    @Override
    public Fruit createFruit() {
        return new Apple();
    }

    @Override
    public Juice createJuice() {
        return new AppleJuice();
    }
}

/**
 * 具体工厂类
 * 橘子工厂 生产橘子和橘子汁
 *
 * @author illusoryCloud
 */
public class OrangeFactory implements AbstractFactory {
    @Override
    public Fruit createFruit() {
        return new Orange();
    }

    @Override
    public Juice createJuice() {
        return new OrangeJuice();
    }
}

/**
 * 抽象工厂模式 测试类
 *
 * @author illusoryCloud
 */
public class AbstractFactoryTest {
    @Test
    public void abstractFactoryTest() {
        //苹果产品簇
        AbstractFactory appleFactory = new AppleFactory();
        Fruit apple = appleFactory.createFruit();
        Juice appleJuice = appleFactory.createJuice();
        //橘子产品簇
        AbstractFactory orangeFactory = new OrangeFactory();
        Fruit orange = orangeFactory.createFruit();
        Juice orangeJuice = orangeFactory.createJuice();

        apple.show();
        appleJuice.show();
        orange.show();
        orangeJuice.show();
    }

}
```

**优点**：当一个产品族中的多个对象被设计成一起工作时，它能保证客户端始终只使用同一个产品族中的对象。

**缺点**：产品族扩展非常困难，要增加一个系列的某一产品，既要在抽象的 工厂里加代码，又要在具体的工厂里面加代码。要增加一个新的系列时比较简单。

例如上面例子中在苹果系列增加一个苹果派就很困难得修改苹果工厂和抽象工厂，但是若增加一个菠萝系列就很简单，只需要添加一个菠萝工厂就行了。

## 5. 总结

**工厂模式的优点？为什么要使用工厂模式**

- 工厂都是用来封装对象的具体创建过程，减少重复代码，降低对象变化时的维护成本，将对象创建过程和使用相解耦。 
- 工厂方法模式使用继承，抽象工厂使用对象组合；两者利用抽象的原则，将具体的实例化过程延迟到子类。 
- 工厂利用的最重要和基本的原则——依赖抽象，不要依赖具体类。

**应用场景**

简单工厂：适合创建同一级别的不同对象。

工厂方法：为每种产品提供一个工厂类，通过不同的工厂实例来创建不同的产品。

抽象工厂模式：一个对象族（或是一组没有任何关系的对象）都有相同的约束，则可以使用抽象工厂模式。

**工厂模式在Java中的应用**

`简单工厂模式`

JDK中的简单工厂模式有很多应用，比较典型的比如线程池。我们使用线程池的时候，可以使用ThreadPoolExecutor，根据自己的喜好传入corePoolSize、maximumPoolSize、keepAliveTimem、unit、workQueue、threadFactory、handler这几个参数，new出一个指定的ThreadPoolExecutor出来。

`工厂方法模式`

```java
public interface ThreadFactory {

    /**
     * Constructs a new {@code Thread}.  Implementations may also initialize
     * priority, name, daemon status, {@code ThreadGroup}, etc.
     *
     * @param r a runnable to be executed by new thread instance
     * @return constructed thread, or {@code null} if the request to
     *         create a thread is rejected
     */
    Thread newThread(Runnable r);
}
```

这是一个生产线程的接口,具体的线程工厂可以implements这个接口并实现newThread(Runnable r)方法，来生产具体线程工厂想要生产的线程。

## 6. 参考

`https://blog.csdn.net/d1562901685/article/details/77623237`

`https://www.cnblogs.com/xrq730/p/4905578.html`

