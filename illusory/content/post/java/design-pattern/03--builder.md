---
title: "Java常用设计模式(三)---建造者模式"
description: "建造者模式优缺点及和工厂模式的差别"
date: 2018-11-22 22:00:00
draft: false
categories: ["Java"]
tags: ["设计模式"]
---

本文主要介绍了Java23种设计模式中的`建造者模式`，并结合实例描述了建造者模式的具体实现和优缺点及建造者模式和工厂模式的差别分析等。

<!--more-->



## 1. 简介

> 建造者模式是将一个复杂的对象的构建与它的表示分离，使得同样的构建过程可以创建不同的表示。。

![](https://github.com/lixd/blog/raw/master/images/java/design-patterns/builder.jpg)

建造者模式通常包括下面几个角色：

（1） `Builder`：给出一个抽象接口，以规范产品对象的各个组成成分的建造。这个接口规定要实现复杂对象的哪些部分的创建，并不涉及具体的对象部件的创建。

（2） `ConcreteBuilder`：实现Builder接口，针对不同的商业逻辑，具体化复杂对象的各部分的创建。 在建造过程完成后，提供产品的实例。

（3）`Director`：调用具体建造者来创建复杂对象的各个部分，在指导者中不涉及具体产品的信息，只负责保证对象各部分完整创建或按某种顺序创建。

（4）`Product`：要创建的复杂对象

## 2. 实现

### 2.1 常见写法

以创建一个Person为例：

Product（要创建的对象）：

```java

package builder.first;

import java.util.Date;

/**
 * 构建的消息对象
 * 普通对象
 *
 * @author illusoryCloud
 */
public class Message {
    /**
     * 标题
     */
    private String title;
    /**
     * 内容
     */
    private String content;
    /**
     * 发送者
     */
    private String from;
    /**
     * 接收者
     */
    private String to;
    /**
     * 时间
     */
    private Date time;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public Date getTime() {
        return time;
    }

    public void setTime(Date time) {
        this.time = time;
    }

    @Override
    public String toString() {
        return "Message{" +
                "title='" + title + '\'' +
                ", content='" + content + '\'' +
                ", from='" + from + '\'' +
                ", to='" + to + '\'' +
                ", time=" + time +
                '}';
    }
}
```

Builder（给出一个抽象接口，以规范产品对象的各个组成成分的建造 ）

```java

/**
 * Builder接口 建造对象的标准
 */
public interface Builder {
    void setTitle();
    void setContent();
    void setFrom();
    void setTo();
    void setTime();
    Message build();
}

```

ConcreteBuilder（实现Builder接口，针对不同的商业逻辑，具体化复杂对象的各部分的创建）

```java
/**
 * 具体的建造对象类 实现了Builder接口
 * 可以根据不同需求有不同的实现
 *
 * @author illusoryCloud
 */
public class CommonMessageBuilder implements Builder {
    private Message message;

    public CommonMessageBuilder() {
        this.message = new Message();
    }

    @Override
    public void setTitle() {
        message.setTitle("常见的标题");
    }

    @Override
    public void setContent() {
        message.setContent("普通的内容");
    }

    @Override
    public void setFrom() {
        message.setFrom("未知的发送者");
    }

    @Override
    public void setTo() {
        message.setTo("未知的接收者");
    }

    @Override
    public void setTime() {
        message.setTime(new Date());
    }

    @Override
    public Message build() {
        return this.message;
    }
}
```



```java

/**
 * 具体的建造对象类 实现了Builder接口
 * 可以根据不同需求有不同的实现
 *
 * @author illusoryCloud
 */
public class OthersMessageBuilder implements Builder {
    private Message message;

    public OthersMessageBuilder() {
        this.message = new Message();
    }

    @Override
    public void setTitle() {
        message.setTitle("不寻常的标题");
    }

    @Override
    public void setContent() {
        message.setContent("奇怪的内容");
    }

    @Override
    public void setFrom() {
        message.setFrom("神秘的发送者");
    }

    @Override
    public void setTo() {
        message.setTo("诡异的接收者");
    }

    @Override
    public void setTime() {
        message.setTime(new Date());
    }

    @Override
    public Message build() {
        return this.message;
    }
}

```



Director（调用具体建造者来创建复杂对象的各个部分，在指导者中不涉及具体产品的信息，只负责保证对象各部分完整创建 ）

```java
/** 指导者
 *只负责保证对象各部分完整创建
 * @author illusoryCloud
 */
public class Dreator {
    /**
     *
     * @param builder 参数是只要实现了Builder接口的类都可以
     * @return
     */
    public Message createMessage(Builder builder) {
        builder.setTitle();
        builder.setContent();
        builder.setFrom();
        builder.setTo();
        builder.setTime();
        return builder.build();
    }
}

```

测试

```java
public class Test {
    @org.junit.jupiter.api.Test
    public void testBuilder() {
        Message commonMessage = new Dreator().createMessage(new CommonMessageBuilder());
        Message othersMessage = new Dreator().createMessage(new OthersMessageBuilder());
        System.out.println(commonMessage);
        System.out.println(othersMessage);
    }
}
```

### 2.2 静态内部类方式

静态内部类写法。

```java


/**
 * 构建的消息对象
 * 有个静态内部类
 *
 * @author illusoryCloud
 */
public class Message {
    /**
     * 标题
     */
    private String title;
    /**
     * 内容
     */
    private String content;
    /**
     * 发送者
     */
    private String from;
    /**
     * 接收者
     */
    private String to;
    /**
     * 时间
     */
    private Date time;


    @Override
    public String toString() {
        return "Message{" +
                "title='" + title + '\'' +
                ", content='" + content + '\'' +
                ", from='" + from + '\'' +
                ", to='" + to + '\'' +
                ", time=" + time +
                '}';
    }


    public static Builder newBuilder() {
        return new Builder();
    }

    /**
     * 静态内部类 builder
     */
    public static class Builder {
        /**
         * 设置默认值
         */
        private String title = "未命名";
        private String content = "暂无内容";
        private String from = "unknow";
        private String to = "unknow";
        private Date time = new Date();

        /**
         * 设置消息标题
         *
         * @param title 要设置的标题
         * @return 返回Builder对象 以达到链式调用
         */
        public Builder setTitle(String title) {
            this.title = title;
            return this;
        }

        public Builder setContent(String content) {
            this.content = content;
            return this;
        }

        public Builder setFrom(String from) {
            this.from = from;
            return this;
        }

        public Builder setTo(String to) {
            this.to = to;
            return this;
        }

        public Builder setTime(Date time) {
            this.time = time;
            return this;
        }

        public Message build() {
            Message message = new Message();
            message.title = title;
            message.content = content;
            message.from = from;
            message.to = to;
            message.time = time;
            return message;
        }

    }
}

```

测试类

```java
/**
 * 建造者模式 测试类
 *
 * @author illusoryCloud
 */
public class Test {
    @org.junit.jupiter.api.Test
    public void testBuilder() {
        Message build = Message.newBuilder().setTitle("这是消息标题")
                .setContent("这是消息内容")
                .setFrom("这是消息发送者")
                .setTo("这是消息接收者")
                .setTime(new Date())
                .Build();
        System.out.println(build.toString());
    }
}
```



## 3. 总结

**建造者模式优点：**

1.将对象本身与对象的创建过程解耦，使得相同的创建过程可以创建不同的对象。

2.可以更加精细地控制产品的创建过程

3.增加新的具体建造者无须修改原有类库的代码，符合开闭原则 

**与工厂模式的区别：**

工厂模式注重的是整体对象的创建方法，只为了获取对象，关注整体

建造者模式注重的是部件构建的过程，旨在通过一步一步地精确构造创建出一个复杂的对象，关注细节。建造者模式一般用来创建**更为复杂的对象**

## 4. 参考

`https://blog.csdn.net/zhuhuitao_struggle/article/details/80489572`

