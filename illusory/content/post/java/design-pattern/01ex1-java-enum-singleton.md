---
title: "枚举式单例模式与序列化"
description: "单例模式枚举式写法的序列化与反序列化安全问题分析"
date: 2018-11-24 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要记录了单例模式中的枚举式写法的序列化与反序列化安全问题，通过分析源码说明了为什么枚举式单例是序列化安全的。

<!--more-->

## 1. 问题

Java中单例模式大概有五种：`饿汉式`、`静态内部类`、`懒汉式`、`双重校验锁`、`枚举式`。

`静态内部类`和`双重校验锁`已经这么优秀了为什么还要有第五种`枚举式`呢？

**因为前面4种都存在一个序列化和反序列化时的安全问题。将单例对象序列化后，在反序列化时会重新创建一个单例对象，违背了单例模式的初衷**。而枚举式单例则没有这个问题。更多Java单例模式信息请阅读:[Java设计模式(一)---单例模式](https://www.lixueduan.com/posts/53093.html)。

## 2. 分析

**序列化可能会破坏单例模式，比较每次反序列化一个序列化的对象实例时都会创建一个新的实例,枚举类单例可以解决该问题**。
**枚举序列化是由jvm保证的，每一个枚举类型和定义的枚举变量在JVM中都是唯一的**，在枚举类型的序列化和反序列化上，Java做了特殊的规定：在序列化时Java仅仅是将枚举对象的`name`属性输出到结果中，反序列化的时候则是通过`java.lang.Enum`的`valueOf()`方法来根据名字查找枚举对象。同时，编译器是不允许任何对这种序列化机制的定制的并禁用了`writeObject`、`readObject`、`readObjectNoData`、`writeReplace`和`readResolve`等方法，从而保证了枚举实例的唯一性.

**Enum类的valueOf方法**:

```java
public static <T extends Enum<T>> T valueOf(Class<T> enumType,
                                              String name) {
      T result = enumType.enumConstantDirectory().get(name);
      if (result != null)
          return result;
      if (name == null)
          throw new NullPointerException("Name is null");
      throw new IllegalArgumentException(
          "No enum constant " + enumType.getCanonicalName() + "." + name);
  }
```

实际上通过调用`enumType(Class对象的引用)`的`enumConstantDirectory()`方法获取到的是一个Map集合，在该集合中存放了以枚举name为key和以枚举实例变量为value的Key&Value数据，因此通过name的值就可以获取到枚举实例.

**`enumConstantDirectory()`方法**：

```java
Map<String, T> enumConstantDirectory() {
        if (enumConstantDirectory == null) {
            //getEnumConstantsShared最终通过反射调用枚举类的values方法
            T[] universe = getEnumConstantsShared();
            if (universe == null)
                throw new IllegalArgumentException(
                    getName() + " is not an enum type");
            Map<String, T> m = new HashMap<>(2 * universe.length);
            //map存放了当前enum类的所有枚举实例变量，以name为key值
            for (T constant : universe)
                m.put(((Enum<?>)constant).name(), constant);
            enumConstantDirectory = m;
        }
        return enumConstantDirectory;
    }
    private volatile transient Map<String, T> enumConstantDirectory = null;
```

到这里我们也就可以看出枚举序列化确实不会重新创建新实例，jvm保证了每个枚举实例变量的唯一性。

**通过反射获取构造器并创建枚举 **:

```java
public static void main(String[] args) throws IllegalAccessException, InvocationTargetException, InstantiationException, NoSuchMethodException {
   Constructor<SingletonEnum> constructor=SingletonEnum.class.getDeclaredConstructor(String.class,int.class);
   constructor.setAccessible(true);
   //创建枚举
   SingletonEnum singleton=constructor.newInstance("otherInstance",9);
  }
```

执行报错 

```java
Exception in thread "main" java.lang.IllegalArgumentException: Cannot reflectively create enum objects
    at java.lang.reflect.Constructor.newInstance(Constructor.java:417)
    at zejian.SingletonEnum.main(SingletonEnum.java:38)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
    at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
    at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
    at java.lang.reflect.Method.invoke(Method.java:498)
    at com.intellij.rt.execution.application.AppMain.main(AppMain.java:144)
```

显然不能使用反射创建枚举类，这是为什么呢？在`newInstance()`方法中找找原因。

**newInstance()方法**： 

```java
public T newInstance(Object ... initargs)
        throws InstantiationException, IllegalAccessException,
               IllegalArgumentException, InvocationTargetException
    {
        if (!override) {
            if (!Reflection.quickCheckMemberAccess(clazz, modifiers)) {
                Class<?> caller = Reflection.getCallerClass();
                checkAccess(caller, clazz, null, modifiers);
            }
        }
        //这里判断Modifier.ENUM是不是枚举修饰符，如果是就抛异常
        if ((clazz.getModifiers() & Modifier.ENUM) != 0)
            throw new IllegalArgumentException("Cannot reflectively create enum objects");
        ConstructorAccessor ca = constructorAccessor;   // read volatile
        if (ca == null) {
            ca = acquireConstructorAccessor();
        }
        @SuppressWarnings("unchecked")
        T inst = (T) ca.newInstance(initargs);
        return inst;
    }
```

源码显示确实无法使用反射创建枚举实例，也就是说明了创建枚举实例只有编译器能够做到而已。

## 3. 结论

显然枚举单例模式确实是很不错的选择，因此我们推荐使用它。

不过由于使用枚举时占用的内存常常是静态变量的两倍还多，因此android官方在内存优化方面给出的建议是尽量避免在android中使用enum。

但是不管如何，关于单例，我们总是应该记住：`线程安全`，`延迟加载`，`序列化与反序列化安全`，`反射安全`是很重重要的。

## 4. 参考

`https://blog.csdn.net/javazejian/article/details/71333103#%E6%9E%9A%E4%B8%BE%E4%B8%8E%E5%8D%95%E4%BE%8B%E6%A8%A1%E5%BC%8F`