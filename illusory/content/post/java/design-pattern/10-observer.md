---
title: "Java常用设计模式(十)---观察者模式"
description: "观察者模式的具体实现及其在JDK中的应用"
date: 2018-12-25 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了Java23种设计模式中的观察者模式，并结合实例描述了观察者模式的具体实现和优缺点分析。

<!--more-->



## 1. 简介

> 让多个观察者对象同时监听某一个主题对象，这个主题对象在状态上发生变化时，会通知所有观察者对象，使他们能够自动更新自己。
> 在对象之间定义了一对多的依赖，这样一来，当一个对象改变状态，依赖它的对象会收到通知并自动更新。其实就是发布订阅模式，发布者发布信息，订阅者获取信息，订阅了就能收到信息，没订阅就收不到信息。

![](https://github.com/lixd/blog/raw/master/images/java/design-pattern/observer.jpeg)

**该模式包含四个角色**

- **抽象被观察者角色**：也就是一个抽象主题，它把所有对观察者对象的引用保存在一个集合中，每个主题都可以有任意数量的观察者。抽象主题提供一个接口，可以增加和删除观察者角色。一般用一个抽象类和接口来实现。
- **抽象观察者角色**：为所有的具体观察者定义一个接口，在得到主题通知时更新自己。
- **具体被观察者角色**：也就是一个具体的主题，在集体主题的内部状态改变时，所有登记过的观察者发出通知。
- **具体观察者角色**：实现抽象观察者角色所需要的更新接口，一边使本身的状态与制图的状态相协调。

## 2. 代码实现

```java
/**
 * 抽象观察者角色
 * 定义了一个update()方法，当被观察者调用notifyObservers()方法时，观察者的update()方法会被回调。
 *
 * @author illusoryCloud
 */
public interface Observer {
    /**
     * 更新消息 由被观察者调用
     *
     * @param o       被观察者 即消息来源
     * @param message 收到的消息
     */
    void update(Observable o, Message message);
}
/**
 * 抽象被观察者接口
 * 声明了添加、删除、通知观察者方法
 *
 * @author illusoryCloud
 */
public class Observable {
    /**
     * 被观察者是否有变化
     * 在通知观察者时做判断 若没有发生变化则不通知
     */
    private boolean changed = false;
    /**
     * Vector集合 线程安全的
     * 用于存放已注册的观察者
     */
    private Vector<Observer> obs;

    public Observable() {
        obs = new Vector<>();
    }

    /**
     * 注册观察者
     *
     * @param o 需要注册的观察者
     */
    public synchronized void addObserver(Observer o) {
        if (o == null) {
            throw new NullPointerException();
        }
        if (!obs.contains(o)) {
            obs.addElement(o);
        }
    }

    /**
     * 移除观察者
     *
     * @param o 被移除的观察者
     */
    public synchronized void deleteObserver(java.util.Observer o) {
        obs.removeElement(o);
    }

    /**
     * 发通知
     */
    public void notifyObservers() {
        notifyObservers(null);
    }

    /**
     * 循环遍历 通知注册的所有的观察者
     *
     * @param message 发送的消息
     */
    public void notifyObservers(Message message) {
        Object[] arrLocal;

        synchronized (this) {
            //判断若没有变化则直接返回
            if (!changed) {
                return;
            }
            arrLocal = obs.toArray();
            clearChanged();
        }

        for (int i = arrLocal.length - 1; i >= 0; i--) {
            ((Observer) arrLocal[i]).update(this, message);
        }
    }

    /**
     * 移除所有观察者
     */
    public synchronized void deleteObservers() {
        obs.removeAllElements();
    }

    /**
     * set clear has 设置 清除 获取
     * 观察者状态是否变化 true/false
     */
    protected synchronized void setChanged() {
        changed = true;
    }

    protected synchronized void clearChanged() {
        changed = false;
    }

    public synchronized boolean hasChanged() {
        return changed;
    }

    /**
     * 已注册观察者的个数
     *
     * @return count
     */
    public synchronized int countObservers() {
        return obs.size();
    }

}
/**
 * 具体观察者角色
 * 实现update方法
 *
 * @author illusoryCloud
 */
public class Client implements Observer {
    private String clientName;
    private int id;

    public Client(String clientName, int id) {
        this.clientName = clientName;
        this.id = id;
    }


    @Override
    public void update(Observable o, Message message) {
        System.out.println(id + "号" + clientName + "收到<" + ((Server)o).getName() + ">推送的消息：" + message.toString());
    }
}
/**
 * 具体被观察者角色
 *
 * @author illusoryCloud
 */
public class Server extends Observable {

    /**
     * 被观察者name 用于区分多个被观察者
     */
    private String name;

    public Server(String name) {
        this.name = name;
    }

    @Override
    public void notifyObservers(Message message) {
        //发送消息
        super.notifyObservers(message);
        //发送后取消change标志
        clearChanged();
    }
    public String getName(){
        return this.name;
    }
}
/**
 * 观察者模式 测试类
 *
 * @author illusoryCloud
 */
public class ObserverTest {
    @Test
    void observerTest() {
        //发送的消息对象
        Message message = null;
        //1个被观察者
        Server s1 = new Server("幻境");
        Server s2 = new Server("云图");
        //4个观察者
        Client c1 = new Client("大佬", 1);
        Client c2 = new Client("萌新", 2);
        Client c3 = new Client("菜鸟", 3);
        Client c4 = new Client("咸鱼", 4);
        //将4个观察者分别注册到两个被观察者上
        s1.addObserver(c1);
        s1.addObserver(c2);
        s2.addObserver(c3);
        s2.addObserver(c4);
        message = Message.newBuilder().setTitle("欢迎")
                .setContent("欢迎关注 <幻境云图>")
                .build();
        //消息变化后 将被观察者设置为已变化状态
        s1.setChanged();
        s2.setChanged();
        //发送消息
        s1.notifyObservers(message);
        s2.notifyObservers(message);
        //再次发送消息无效 因为change=false
        s1.notifyObservers(message);
        s2.notifyObservers(message);
    }
}
//输出
2号萌新收到<幻境>推送的消息：Message{title='欢迎', content='欢迎关注 <幻境云图>'}
1号大佬收到<幻境>推送的消息：Message{title='欢迎', content='欢迎关注 <幻境云图>'}
4号咸鱼收到<云图>推送的消息：Message{title='欢迎', content='欢迎关注 <幻境云图>'}
3号菜鸟收到<云图>推送的消息：Message{title='欢迎', content='欢迎关注 <幻境云图>'}
```

## 3. 总结

**优点：**

1.降低重复代码，使得代码更清晰、更易读、更易扩展

2.解耦，使得代码可维护性更好，修改代码的时候可以尽量少改地方

**应用场景：**

1.对一个对象状态的更新需要其他对象同步更新

2.对象仅需要将自己的更新通知给其他对象而不需要知道其他对象的细节，如消息推送.

**观察者模式在Java中的应用及解读**

JDK是有直接支持观察者模式的，就是`java.util.Observer`这个接口：

```java
public interface Observer {
    /**
     * This method is called whenever the observed object is changed. An
     * application calls an <tt>Observable</tt> object's
     * <code>notifyObservers</code> method to have all the object's
     * observers notified of the change.
     *
     * @param   o     the observable object.
     * @param   arg   an argument passed to the <code>notifyObservers</code>
     *                 method.
     */
    void update(Observable o, Object arg);
}
```

这就是观察者的接口，定义的观察者只需要实现这个接口就可以了。update()方法，被观察者对象的状态发生变化时，被观察者的notifyObservers()方法就会调用这个方法：

```java
public class Observable {
    private boolean changed = false;
    private Vector<Observer> obs;

    public Observable() {
        obs = new Vector<>();
    }
    public synchronized void addObserver(Observer o) {
        if (o == null)
            throw new NullPointerException();
        if (!obs.contains(o)) {
            obs.addElement(o);
        }
    }

    public synchronized void deleteObserver(Observer o) {
        obs.removeElement(o);
    }
    public void notifyObservers() {
        notifyObservers(null);
    }
    public void notifyObservers(Object arg) {
 
        Object[] arrLocal;

        synchronized (this) {
            if (!changed)
                return;
            arrLocal = obs.toArray();
            clearChanged();
        }

        for (int i = arrLocal.length-1; i>=0; i--)
            ((Observer)arrLocal[i]).update(this, arg);
    }

    public synchronized void deleteObservers() {
        obs.removeAllElements();
    }
    protected synchronized void setChanged() {
        changed = true;
    }

    protected synchronized void clearChanged() {
        changed = false;
    }
    public synchronized boolean hasChanged() {
        return changed;
    }
    public synchronized int countObservers() {
        return obs.size();
    }
}

```

这是被观察者的父类，也就是主题对象，用的`Vector`集合,方法也加了`synchronized`关键字，是多线程安全的。

## 4. 参考

`https://www.cnblogs.com/xrq730/p/4908686.html`