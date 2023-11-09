---
title: "Java设计模式(一)---单例模式"
description: "各种单例模式的实现与分析"
date: 2018-11-15 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了设计模式的六大原则，并结合实例描述了各种单例模式的具体实现和性能分析测试。包括：`饿汉式`、`静态内部类`、`懒汉式`、`双重校验锁`、`枚举`等。

<!--more-->



## 1. 设计模式的六大原则

**1、开闭原则（Open Close Principle）**

> 开闭原则就是说对扩展开放，对修改关闭。在程序需要进行拓展的时候，不能去修改原有的代码，实现一个热插拔的效果。

**2、里氏代换原则（Liskov Substitution Principle）**

> 其官方描述比较抽象，可自行百度。实际上可以这样理解：
>
> （1）子类的能力必须大于等于父类，即父类可以使用的方法，子类都可以使用。
>
> （2）返回值也是同样的道理。假设一个父类方法返回一个List，子类返回一个ArrayList，这当然可以。如果父类方法返回一个ArrayList，子类返回一个List，就说不通了。这里子类返回值的能力是比父类小的。
>
> （3）还有抛出异常的情况。任何子类方法可以声明抛出父类方法声明异常的子类。而不能声明抛出父类没有声明的异常。

**3、依赖倒转原则（Dependence Inversion Principle）**

> 这个是开闭原则的基础，具体内容：面向接口编程，依赖于抽象而不依赖于具体。

**4、接口隔离原则（Interface Segregation Principle）**

> 这个原则的意思是：使用多个隔离的接口，比使用单个接口要好。还是一个降低类之间的耦合度的意思，从这儿我们看出，其实设计模式就是一个软件的设计思想，从大型软件架构出发，为了升级和维护方便。所以上文中多次出现：降低依赖，降低耦合。

**5、迪米特法则（最少知道原则）（Demeter Principle）**

> 为什么叫最少知道原则，就是说：一个实体应当尽量少的与其他实体之间发生相互作用，使得系统功能模块相对独立。

**6、合成复用原则（Composite Reuse Principle）**

> 原则是尽量使用合成/聚合的方式，而不是使用继承。

Java 中一般认为有 23 种设计模式，总体来说设计模式分为三大类：

`创建型模式`，共五种：工厂方法模式、抽象工厂模式、单例模式、建造者模式、原型模式。

`结构型模式`，共七种：适配器模式、装饰器模式、代理模式、外观模式、桥接模式、组合模式、享元模式。

`行为型模式`，共十一种：策略模式、模板方法模式、观察者模式、迭代子模式、责任链模式、命令模式、备忘录

模式、状态模式、访问者模式、中介者模式、解释器模式。

比较常用的有：工厂方法模式、抽象工厂模式、单例模式、建造者模式、适配器模式、代理模式、享元模式、策略模式、观察者模式。

## 2. 单例模式

### 2.1 单例模式介绍

**作用**：保证一个类仅有一个实例，并提供一个访问它的全局访问点。

**主要解决**：一个全局使用的类频繁地创建与销毁。

**优点**： 1、在内存里只有一个实例，减少了内存的开销，尤其是频繁的创建和销毁实例。 2、避免对资源的多重占用（比如写文件操作）。

**缺点**：没有接口，不能继承，与单一职责原则冲突，一个类应该只关心内部逻辑，而不关心外面怎么样来实例化。

**应用场景：** 1.配置文件访问类，不用每次使用时都new一个 2.数据库连接池 保证项目中只有一个连接池存在。

### 2.2 单例模式实现

#### 1. 饿汉式

```java
/**
 *  饿汉式
 * @author illusoryCloud
 */
public class FirstSingleton {
    /**
     * 类变量在类准备阶段就初始化了然后放在<clinit>构造方法中
     * 一旦外部调用了静态方法，那么就会初始化完成。
     * 一个类的<clinit>只会执行一次 保证多线程情况下不会创建多个实例
     */
    private static final FirstSingleton INSTANCE =new FirstSingleton();

    /**
     *
     * 构造函数私有化
     */
    private FirstSingleton(){}

    /**
     *  提供公共方法以获取实例对象
     * @return instance 实例对象
     */
    public static FirstSingleton getInstance(){
        return INSTANCE ;
    }
}
```

这种方式实现的单例：类加载时就创建实例。由`classloder`保证了线程安全。

#### 2. 静态内部类

```java
/**
 * 静态内部类方式
 *
 * @author illusoryCloud
 */
public class SecondSingleton {

    private static class SingletonHolder {
        /**
         * 静态变量类加载时才会被创建 且只会创建一次
         */
        private static final SecondSingleton INSTANCE = new SecondSingleton();
    }

    private SecondSingleton() {
    }

    public static SecondSingleton getInstance() {
        return SingletonHolder.INSTANCE;
    }
}
```

这种方式实现的单例：实现了`lazy loading` 使用时才创建实例，由`classloder`保证了线程安全。

**饿汉式/静态内部类是如何保证线程安全的：**

在《深入理解JAVA虚拟机》中，有这么一句话:

>  虚拟机会保证一个类的`<clinit>()`方法在多线程环境中被正确地加锁、同步，如果多个线程同时去初始化一个类，那么只会有一个线程去执行这个类的`<clinit>()`方法，其他线程都需要阻塞等待，直到活动线程执行`<clinit>()`方法完毕。

#### 3. 懒汉式

```java
/**
 * 懒汉式
 *
 * @author illusoryCloud
 */
public class ThirdSingleton {

    private static ThirdSingleton instance;

    private ThirdSingleton() {
    }

    /**
     * synchronized 保证线程安全 但效率低
     *
     * @return instance单例对象
     */
    public static synchronized ThirdSingleton getInstance() {
        if (instance == null) {
            instance = new ThirdSingleton();
        }
        return instance;
    }

}
```

这种方式实现的单例：实现了`lazy loading` 使用时才创建实例。`synchronized`保证了线程安全，但效率低。

#### 4. 双重校验锁

```java
/**
 * 双重校验锁式
 *
 * @author illusoryCloud
 */
public class FourSingleton {
    /**
     * volatile关键字禁止指令重排序
     * 保证多线程下不会获取到未完全初始化的实例
     * 详细请阅读：https://www.lixueduan.com/posts/e7cef119.html
     */
    private static volatile FourSingleton instance;

    private FourSingleton() {
    }

    /**
     * 双重if校验 缩小synchronized代码块范围
     * 若instance不为空 就可直接return
     *
     * @return instance 实例对象
     */
    public static FourSingleton getInstance() {
        if (instance == null) {
            synchronized (FourSingleton.class) {
                if (instance == null) {
                    //非原子操作
                    instance = new FourSingleton();
                }
            }
        }
        return instance;
    }
}
```

这种方式实现的单例：实现了`lazy loading` 使用时才创建实例。`synchronized`保证了线程安全，`volatile`禁止指令重排序保证了多线程获取时不为空，但要JDK1.5以上才行。详细信息请阅读[volatile关键字在单例模式(双重校验锁)中的作用](https://www.lixueduan.com/posts/e7cef119.html)

#### 5. 枚举

```java
/**
 * 枚举式
 * 序列化及反序列化安全
 * @author illusoryCloud
 */
public enum FiveSingleton {
    //定义一个枚举的元素，它就是 singleton 的一个实例
    INSTANCE;
    public void doSomeThing(FiveSingleton instance) {
        System.out.println("枚举方式实现单例");
    }

}
public class Test {

	public static void main(String[] args) {
		Singleton singleton = Singleton.INSTANCE;
		singleton.doSomeThing();//output:枚举方法实现单例

	}
}
```

这种方式也是《Effective Java 》以及《Java与模式》的作者推荐的方式。

`静态内部类`和`双重校验锁`已经这么优秀了为什么还要有第五种`枚举式`呢？

**因为前面4种都存在一个序列化和反序列化时的安全问题。将单例对象序列化后，在反序列化时会重新创建一个单例对象，违背了单例模式的初衷**。而枚举式单例则没有这个问题，具体信息查看：[枚举式单例模式与序列化](https://www.lixueduan.com)

## 3. 性能测试

五种单例实现方式，在100个线程下，每个线程访问1千万次实例的用时.

| Tables | 实现方式   | 用时(毫秒) |
| ------ | ---------- | ---------- |
| 1      | 饿汉式     | 13         |
| 2      | 懒汉式     | 10778      |
| 3      | 双重检查   | 15         |
| 4      | 静态内部类 | 14         |
| 5      | 枚举       | 12         |

(*注意:由于不同电脑之间的性能差异，测试的结果可能不同)

根据不同场合选择具体的实现方式，一般情况下我是使用的**静态内部类**或者**DCL双重校验锁**方式。

## 4. 总结

**为什么要使用单例模式？什么场景适合使用单例模式?单例模式有什么好处**

* 1.单例模式能够保证一个类仅有唯一的实例，避免创建多个实例。并提供一个全局访问点，优化和共享资源访问。
* 2.当一个对象需要频繁创建和销毁时使用单例模式能节省系统资源。

**应用场景：**

* 1.配置文件访问类，不用每次使用时都new一个

*  2.数据库连接池 保证项目中只有一个连接池存在。

**单例模式的缺点：**

* 单例模式一般没有接口，扩展很困难，若要扩展只能修改代码。

**单例模式在Java中的应用**

```java
public class Runtime {
    private static Runtime currentRuntime = new Runtime();

    /**
     * Returns the runtime object associated with the current Java application.
     * Most of the methods of class <code>Runtime</code> are instance 
     * methods and must be invoked with respect to the current runtime object. 
     * 
     * @return  the <code>Runtime</code> object associated with the current
     *          Java application.
     */
    public static Runtime getRuntime() { 
    return currentRuntime;
    }

    /** Don't let anyone else instantiate this class */
    private Runtime() {}

    ...
}
```

## 5. 参考

`http://www.cs.umd.edu/~pugh/java/memoryModel/DoubleCheckedLocking.html`

`https://blog.csdn.net/qq_22706515/article/details/74202814`