---
title: "String字符串详解"
description: "Java字符串相关使用及优化方案"
date: 2018-08-10 22:00:00
draft: false
categories: ["Java"]
tags: ["Java"]
---

本文主要分析了 Java中的 String 字符串相关使用与优化方案，包括 String 类型相加的本质、String 字符串相关编译器优化、 StringBuilder 与 StringBuffer 选择、字符串拼接方法、基本类型转 String 类型等。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. String对象

String 对象是 Java 中重要的数据类型，在大部分情况下我们都会用到 String 对象。其实在 Java 语言中，其设计者也对 String 做了大量的优化工作，这些也是 String 对象的特点，它们就是:`不变性`，`常量池优化`和String类的`final`定义。

### 1.1 不变性

**String对象的状态在其被创建之后就不在发生变化**。为什么说这点也是 Java 设计者所做的优化，在 Java 中，有一种模式叫不变模式：在一个对象被多线程共享，而且被频繁的访问时，可以省略同步和锁的时间，从而提高性能。而 String 的不变性，可泛化为不变模式。

### 1.2 常量池优化

常量池优化指的是什么呢？那就是当两个 String 对象拥有同一个值的时候，他们都只是引用了常量池中的同一个拷贝。所以当程序中某个字符串频繁出现时，这个优化技术就可以节省大幅度的内存空间了。例如：

```java
String s1  = "123";
String s2  = "123";
String s3 = new String("123");
System.out.println(s1==s2);      //true
System.out.println(s1==s3);      //false
System.out.println(s1==s3.intern());    //true123456
```

　以上代码中，s1 和 s2 引用的是相同的地址，故而第四行打印出的结果是 true ;而 s3 虽然只与 s1,s2 相等，但是 s3 是通过 new String(“123”) 创建的，重新开辟了内存空间，因引用的地址不同，所以第5行打印出 false ; String 的 intern() 方法返回的是 String 对象在常量池中的引用，所以最后一行打印出 true。

### 1.3 final的定义

String 类以 final 进行了修饰，在系统中就不可能有 String 的子类，这一点也是出于对系统安全性的考虑。

## 2. 字符串操作中的常见优化方法

### 2.1 split()方法优化

　　通常情况下，split() 方法带给我们很大的方便，但是其性能不是很好。建议结合使用 indexOf( )和 subString()方法进行自定义拆分，这样性能会有显著的提高。　　　　

### 2.2 String常量的累加操作优化方法

示例代码:

```java
String s = "";
long sBeginTime = System.currentTimeMillis();
for (int i = 0; i < 100000; i++) {
    s+="s";
}
long sEndTime = System.currentTimeMillis();
System.out.println("s拼接100000遍s耗时: " + (sEndTime - sBeginTime) + "ms");

StringBuffer s1 = new StringBuffer();
long s1BeginTime = System.currentTimeMillis();
for (int i = 0; i < 100000; i++) {
    s1.append("s");
}
long s1EndTime = System.currentTimeMillis();
System.out.println("s1拼接100000遍s耗时: " + (s1EndTime - s1BeginTime) + "ms");

StringBuilder s2 = new StringBuilder();
long s2BeginTime = System.currentTimeMillis();
for (int i = 0; i < 100000; i++) {
    s2.append("s");
}
long s2EndTime = System.currentTimeMillis();
System.out.println("s2拼接100000遍s耗时: " + (s2EndTime - s2BeginTime) + "ms");
```

结果如下：

```java
s拼接100000遍s耗时: 3426ms
s1拼接100000遍s耗时: 3ms
s2拼接100000遍s耗时: 1ms
```

上例所示，使用+号拼接字符串，其效率明显较低，而使用 StringBuffer 和 StringBuilder 的 append() 方法进行拼接，效率是使用+号拼接方式的百倍甚至千倍，而 StringBuffer 的效率比 StringBuilder 低些，这是由于StringBuffer 实现了线程安全，效率较低也是不可避免的。

**所以在字符串的累加操作中，建议结合线程问题选择 StringBuffer 或 StringBuilder，应避免使用+号拼接字符串**。

### 2.3 基本数据类型转化为 String 类型的优化方案

示例代码:

```java
Integer num  = 0;
int loop = 10000000;  // 将结果放大10000000倍，以便于观察结果
long beginTime = System.currentTimeMillis();
for (int i = 0; i < loop; i++) {
    String s = num+"";
}
long endTime = System.currentTimeMillis();
System.out.println("+\"\"的方式耗时: " + (endTime - beginTime) + "ms");


beginTime = System.currentTimeMillis();
for (int i = 0; i < loop; i++) {
    String s = String.valueOf(num);
}
endTime = System.currentTimeMillis();
System.out.println("String.valueOf()的方式耗时: " + (endTime - beginTime) + "ms");

beginTime = System.currentTimeMillis();
for (int i = 0; i < loop; i++) {
    String s = num.toString();
}
endTime = System.currentTimeMillis();
System.out.println("toString()的方式耗时: " + (endTime - beginTime) + "ms");
1234567891011121314151617181920212223
```

　以上示例中，String.valueOf() 直接调用了底层的 Integer.toString() 方法，不过其中会先判断是否为空；+”“由StringBuilder 实现，先 new StringBuilder() 然后调用了 append() 方法，最后调用了 toString() 方法返回 String 对象；num.toString() 直接调用了 Integer.toString() 方法。

以下是结果：

```java
+""的方式耗时: 120ms
String.valueOf()的方式耗时: 31ms
toString()的方式耗时: 30ms
```

**所以效率是： num.toString() 方法最快，其次是 String.valueOf(num )，num+”“的方式最满**。

## 3. 编译器优化

```java
    /**
     * String类型优化测试
     */
    private static void StringTest() {
        String a = "hello illusory";
        String b = "hello " + "illusory";
        //true
        System.out.println(a == b);
        String c = "hello ";
        String d = "illusory";
        String e = c + d;
        //false
        System.out.println(a == e);
    }
```

Java 中的变量和基本类型的值存放于栈，而 new 出来的对象本身存放于堆内存，指向对象的引用还是放在栈内存。

```java
  String b = "hello " + "illusory";
```
两个都是字符串，是固定值 所以编译器会自动优化为 
```java
  String b = "hello illusory";
```
`a`、`b` 都指向常量池中的`hello illusory`所以 `a==b` 为 `true`

由于 String 的不可变性，对其进行操作的效率会大大降低，但对 “+”操作符,编译器也对其进行了优化
```java
        String c = "hello ";
        String d = "illusory";
        String e = c + d;
```
其中的
```java
String e = c + d
```
**当+号两边存在变量时(两边或任意一边)，在编译期是无法确定其值的，所以要等到运行期再进行处理** Java中对String 的相加其本质是 new 了 StringBuilder 对象进行 append 操作，拼接后调用 toString() 返回 String 对象。

```java
String e = new StringBuilder().append("hello ").append("illusory").toString();
```
`StringBuilder`的`toString`方法如下：

```java
    @Override
    public String toString() {
        // Create a copy, don't share the array
        return new String(value, 0, count);
    }
```

所以`e`是指向`new`出来的一个 String 对象,而`a`指向常量池中的对象，`a==e` 为 `false`

反编译后如下：
```java
D:\lillusory\Java\work_idea\java-learning\target\classes\jvm\string>javap -class
path . -v StringTest.class
Classfile /D:/lillusory/Java/work_idea/java-learning/target/classes/jvm/string/S
tringTest.class
  Last modified 2019-5-5; size 946 bytes
  MD5 checksum 2d529fca114cf155ae7c647bfc733150
  Compiled from "StringTest.java"
public class jvm.string.StringTest
  minor version: 0
  major version: 52
  flags: ACC_PUBLIC, ACC_SUPER
Constant pool:
   #1 = Methodref          #12.#35        // java/lang/Object."<init>":()V
   #2 = String             #36            // hello illusory
   #3 = String             #37            // hello
   #4 = String             #38            // illusory
   #5 = Class              #39            // java/lang/StringBuilder
   #6 = Methodref          #5.#35         // java/lang/StringBuilder."<init>":()
V
   #7 = Methodref          #5.#40         // java/lang/StringBuilder.append:(Lja
va/lang/String;)Ljava/lang/StringBuilder;
   #8 = Methodref          #5.#41         // java/lang/StringBuilder.toString:()
Ljava/lang/String;
   #9 = Fieldref           #42.#43        // java/lang/System.out:Ljava/io/Print
Stream;
  #10 = Methodref          #44.#45        // java/io/PrintStream.println:(Z)V
  #11 = Class              #46            // jvm/string/StringTest
  #12 = Class              #47            // java/lang/Object
```
可以看到确实是用到了`StringBuilder`

加上 final 有会如何呢?
```java
 /**
     * String类型优化测试
     */
    private static void StringTest() {
        String a = "hello illusory";
       
        final String c2 = "hello ";
        final String d2 = "illusory";
        String e2 = c2 + d2;
        //     true
        System.out.println(a == e2);
    }
```
由于`c2`、`d2`都加了`final`修饰 所以被当作一个常量对待
此时+号两边都是常量，在编译期就可以确定其值了 
类似于
```java
 String b = "hello " + "illusory";
```
此时都指向常量池中的`hello illusory`所以`a == e2`为`true`

如果+号两边有一个不是常量那么结果都是false
```java
 /**
     * String类型优化测试
     */
    private static void StringTest() {
        String a = "hello illusory";
       
        final String c2 = "hello ";
        String f = c2 + getName();
        //     false
        System.out.println(a == f);
    }
    
    private static String getName() {
            return "illusory";
    }
```
其中`c2`是final 被当成常量 其值是固定的
但是`getName()` 要运行时才能确定值 所以最后 f 也是 new 的一个对象 `a == f`结果为`false`

```java
 /**
     * String类型优化测试
     */
    private static void StringTest() {
        String a = "hello illusory";
        String g = a.intern();
        System.out.println(a == g);
    }
```
当调用 String.intern() 方法时，如果常量池中已经存在该字符串，则返回池中的字符串引用；否则将此字符串添加到常量池中，并返回字符串的引用。
这里`g`和`a`是都是指向常量池中的`hello illusory`，所以`a == g`为`true`

## 4. 总结

最后总结一下

1.直接字符串相加，编译器会优化。

```java
String a = "hello " + "illusory";---> String a = "hello illusory";
```

2.String 用加号拼接本质是new了StringBuilder对象进行append操作，拼接后调用toString()返回String对象

```java
 		String c = "hello ";
        String d = "illusory";
        String e = c + d;
//实现如下
String e = new StringBuilder().append("hello ").append("illusory").toString();
```

3.+号两边都在编译期能确定的也会优化

```java
 /**
     * String类型优化测试
     */
    private static void StringTest() {
        String a = "hello illusory";
       
        final String c2 = "hello ";
        final String d2 = "illusory";
        String e2 = c2 + d2;
        //     true
        System.out.println(a == e2);
    }
```

4.在字符串的累加操作中，建议结合线程问题选择 StringBuffe r或 StringBuilder，应避免使用+号拼接字符串

5.基本数据类型转化为 String 类型，效率是: num.toString() 方法最快，其次是 String.valueOf(num)，最后是num+”“的方式

## 5. 参考

`https://blog.csdn.net/SEU_Calvin/article/details/52291082`

`https://www.cnblogs.com/vincentl/p/9600093.html`

`https://www.cnblogs.com/will959/p/7537891.html`