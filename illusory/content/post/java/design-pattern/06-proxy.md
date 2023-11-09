---
title: "Java常用设计模式(六)---代理模式"
description: "各种代理模式的具体实现和对比及代理模式与装饰者模式区别"
date: 2018-12-05 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了Java23种设计模式中的代理模式，并结合实例描述了各种代理模式的具体实现和对比。包括：`JDK静态代理`，`JDK动态代理`，`cglib动态代理`.

<!--more-->



## 1. 简介

> **给某一对象提供一个代理对象，并由代理对象控制对原对象的引用**。

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/proxy.png)

**代理模式的结构**

有些情况下，一个客户不想或者不能够直接引用一个对象，可以通过代理对象在客户端和目标对象之间起到中介作用。代理模式中的角色有：

1、**抽象对象角色**

声明了目标对象和代理对象的共同接口，这样一来在任何可以使用目标对象的地方都可以使用代理对象

2、**目标对象角色**

定义了代理对象所代表的目标对象

3、**代理对象角色**

代理对象内部含有目标对象的引用，从而可以在任何时候操作目标对象；代理对象提供一个与目标对象相同的接口，以便可以在任何时候替代目标对象

## 2. 静态代理

```
由程序员创建或特定工具自动生成源代码，也就是在编译时就已经将接口，被代理类，代理类等确定下来。在程序运行之前，代理类的.class文件就已经生成。

代理类和被代理类必须实现同一个接口
```

```java
/**
 * 抽象对象角色
 *
 * @author illusoryCloud
 */
public interface Human {
    void work();
}

/**
 * 目标对象角色
 *
 * @author illusoryCloud
 */
public class Singer implements Human {
    @Override
    public void work() {
        System.out.println("歌手在唱歌~");
    }
}

/**
 * 代理对象角色
 *
 * @author illusoryCloud
 */
public class ProxyMan implements Human {
    /**
     * 持有目标对象的引用
     */
    private Human human;

    /**
     * 通过构造方法注入
     *
     * @param human 目标对象
     */
    public ProxyMan(Human human) {
        this.human = human;
    }

    @Override
    public void work() {
        System.out.println("经纪人为歌手安排好时间~");
        human.work();
        System.out.println("经纪人为歌手联系下一场演出~");
    }
}

      /**
 * 静态代理模式 测试类
 *
 * @author illusoryCloud
 */
public class StaticProxyTest {
    @Test
    public void staticProxyTest() {
        Human singer = new ProxyMan(new Singer());
        singer.work();
    }
}
   //输出结果
经纪人为歌手安排好时间~
歌手在唱歌~
经纪人为歌手联系下一场演出~
```

## 3. JDK动态代理

>  代理类在程序运行时创建的代理方式被成为动态代理。

### 1. 具体实现

```java
/**
 * 回调方法
 *
 * @author illusoryCloud
 */
public class MyInvocationHandler implements InvocationHandler {
    public static final String PROXY_METHOD = "work";
    /**
     * 持有一个被代理对象的引用
     */
    private Human human;

    public MyInvocationHandler(Human human) {
        this.human = human;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 判断是否是需要代理的方法
        if (PROXY_METHOD.equals(method.getName())) {
            System.out.println("经纪人为歌手安排好时间~");
            Object invoke = method.invoke(human, args);
            System.out.println("经纪人为歌手联系下一场演出~");
            return invoke;
        } else {
            return null;
        }
    }
}
/**
 * JDK动态代理 测试类
 *
 * @author illusoryCloud
 */
public class JDKProxyTest {
    @Test
    public void JDKProxyTest() {
        Singer singer = new Singer();
        //参数1：类加载器 参数2：被代理类实现的接口 参数3：回调 由自己实现
        Human human = (Human) Proxy.newProxyInstance(singer.getClass().getClassLoader()
                , singer.getClass().getInterfaces()
                , new MyInvocationHandler(singer));
        human.work();
    }
}

```

### 2. InvocationHandler

`InvocationHandler`是一个接口，官方文档解释说，每个代理的实例都有一个与之关联的 `InvocationHandler `实现类，如果代理的方法被调用，那么代理便会通知和转发给内部的 `InvocationHandler` 实现类，由它决定处理。

```java
public interface InvocationHandler {
    public Object invoke(Object proxy, Method method, Object[] args)
        throws Throwable;
}
```

接口内部只是一个 `invoke()` 方法，正是这个方法决定了怎么样处理代理传递过来的方法调用。对代理对象的增强就在这里进行。实现该接口 重写此方法 可以用匿名内部类或者直接用生成代理的那个类实现该接口。

**方法参数**

* 1.proxy 代理对象，可以使用反射获取代理对象`proxy.getClass().getName()`

* 2.method 代理对象调用的方法

* 3.args 调用的方法中的参数

**因为`Proxy `动态产生的代理会调用` InvocationHandler`实现类，所以` InvocationHandler`是实际执行者**。

 ### 3. 生成代理对象
 `   Proxy.newProxyInstance(classLoader, interfaces, dynamicInvocationHandler);`

**方法参数**

* 1.classLoader 类加载器,**告诉虚拟机用哪个字节码加载器加载内存中创建出来的字节码文件** 一般是application类加载器.(增强哪个对象就写哪个类的类加载器)
* 2.interfaces  字节码数组 **告诉虚拟机内存中正在你被创建的字节码文件中应该有哪些方法**(被代理类实现的所有接口的字节码数组 )
* 3.一个InvocationHandler对象,表示的是当我这个动态代理对象在调用方法的时候，会关联到哪一个InvocationHandler对象上,**告诉虚拟机字节码上的那些方法如何处理 （用户自定义增强操作等 写在实现InvocationHandler接口的那个类中**.

**小结：** 

* 1.通过 `Proxy.newProxyInstance(classLoader, interfaces, dynamicInvocationHandler);`生成代理对象
* 2.创建`InvocationHandler`接口实现类 重写invoke方法 实现具体的方法增强
* 3.调用对象的方法最后都是调用InvocationHandler接口的invoke方法
* 4.只能增强接口中有的方法

## 4. CGLIB动态代理

JDK代理要求被代理的类必须实现接口，有很强的局限性。

而CGLIB动态代理则没有此类强制性要求。简单的说，**CGLIB会让生成的代理类继承被代理类，并在代理类中对代理方法进行强化处理(前置处理、后置处理等)**。在CGLIB底层，其实是借助了ASM这个非常强大的Java字节码生成框架。

**cglib原理**

**通过字节码技术为一个类创建子类，并在子类中采用方法拦截的技术拦截所有父类方法的调用，顺势织入横切逻辑。由于是通过子类来代理父类，因此不能代理被final字段修饰的方法。**

>  需要引入两个jar包
>
> cglib-3.2.10.jar  //cglib包
>
> asm-7.0.jar    //底层用到的asm包

```java
/**
 * 被代理类 没有实现接口 无法使用JDK动态代理
 *
 * @author illusoryCloud
 */
public class Dancer {
    public void dance() {
        System.out.println("跳舞者翩翩起舞~");
    }
}
/**
 * @author illusoryCloud
 */
public class MyMethodInterceptor implements MethodInterceptor {
    public static final String PROXY_METHOD = "work";

    /**
     * @param o           cglib生成的代理对象
     * @param method      目标对象的方法
     * @param objects     方法入参
     * @param methodProxy 代理方法
     * @return 返回值
     * @throws Throwable 异常
     */
    @Override
    public Object intercept(Object o, Method method, Object[] objects, MethodProxy methodProxy) throws Throwable {
        System.out.println("经纪人为舞蹈演员安排好时间~");
        //注意 这里是invokeSuper  若是invoke则会循环调用最终堆栈溢出
        Object o1 = methodProxy.invokeSuper(o, objects);
        System.out.println("经纪人为舞蹈演员联系下一场演出~");
        return o1;

    }
}
/**
 * CGLib动态代理 测试类
 *
 * @author illusoryCloud
 */
public class CglibProxyTest {
    @Test
    public void cglibProxyTest(){
        Enhancer enhancer=new Enhancer();
        //设置父类 即被代理类 cglib是通过生成子类的方式来代理的
        enhancer.setSuperclass(Dancer.class);
        //设置回调
        enhancer.setCallback(new MyMethodInterceptor());
        Dancer dancer= (Dancer) enhancer.create();
        dancer.dance();
    }
}
```

## 5. 代理模式比较

| 代理方式      | 实现                                                         | 优点                                                         | 缺点                                                         | 特点                                                       |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| JDK静态代理   | 代理类与委托类实现同一接口，并且在代理类中需要硬编码接口     | 实现简单，容易理解                                           | 代理类需要硬编码接口，在实际应用中可能会导致重复编码，浪费存储空间并且效率很低 | 好像没啥特点                                               |
| JDK动态代理   | 代理类与委托类实现同一接口，主要是通过代理类实现InvocationHandler并重写invoke方法来进行动态代理的，在invoke方法中将对方法进行增强处理 | 不需要硬编码接口，代码复用率高                               | 只能够代理实现了接口的委托类                                 | 底层使用反射机制进行方法的调用                             |
| CGLIB动态代理 | 代理类将委托类作为自己的父类并为其中的非final委托方法创建两个方法，一个是与委托方法签名相同的方法，它在方法中会通过super调用委托方法；另一个是代理类独有的方法。在代理方法中，它会判断是否存在实现了MethodInterceptor接口的对象，若存在则将调用intercept方法对委托方法进行代理 | 可以在运行时对类或者是接口进行增强操作，且委托类无需实现接口 | 不能对final类以及final方法进行代理                           | 底层将方法全部存入一个数组中，通过数组索引直接进行方法调用 |

## 6. 代理模式与装饰器模式

代理模式和装饰者模式有着很多的应用，这两者具有一定的相似性，都是通过一个新的对象封装原有的对象。
二者之间的差异在于**代理模式是为了实现对象的控制，可能被代理的对象难以直接获得或者是不想暴露给客户端，而装饰者模式是继承的一种替代方案，在避免创建过多子类的情况下为被装饰者提供更多的功能**。

**装饰器模式应当为所装饰的对象提供增强功能，而代理模式对所代理对象的使用施加控制，并不提供对象本身的增强功能**。

* **代理模式**侧重于不能直接访问一个对象，只能通过代理来间接访问，比如对象在另外一台机器上，
  或者对象被持久化了，对象是受保护的。对象在另外一台机器上，其实就是rpc，感兴趣的可以看看dubbo的源码本地访问的其实就是远程对象的代理，只不过代理帮你做了访问这个对象之前和之后的很多事情，但是对使用者是透明的了。对象被持久化了，比如mybatis的mapperProxy。通过mapper文件自动生成代理类。第三种，对内核对象的访问。 
* **装饰器模式**是因为没法在编译期就确定一个对象的功能，需要运行时动态的给对象添加职责，所以只能把对象的功能拆成一一个个的小部分，动态组装，感兴趣的可以看看dubbo的源码，里面的mock，cluster，failover都是通过装饰器来实现的。因为这些功能是由使用者动态配置的。但是代理模式在编译期其实就已经确定了和代理对象的关系。    

同时这两个设计模式是为了解决不同的问题而抽象总结出来的。是可以混用的。可以在代理的基础上在加一个装饰，也可以在装饰器的基础上在加一个代理。感兴趣的去看看dubbo源码，里面就是这么实现的。

## 7. 参考

`https://www.cnblogs.com/xrq730/p/4907999.html`

`https://www.zhihu.com/question/41988550/answer/567925484`