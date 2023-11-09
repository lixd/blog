---
title: "Linux下安装RabbitMQ"
description: "通过解压方式在Linux下安装RabbitMQ和Erlang和安装过程中的一些问题"
date: 2019-01-21 22:00:00
draft: false
categories: ["Linux"]
tags: ["Linux"]
---

本章主要讲了如何通过解压方式在Linux下安装RabbitMQ和Erlang，超级详细的安装过程，和安装过程中遇到的一些问题。

<!-- more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

软件统一放在`/usr/software`下 解压后放在单独的文件夹下`/usr/locac/opt/rabbitmq`,`/usr/local/opt/erlang`

# RabbitMQ

## 0. 环境准备

### 1.版本问题

Erlang和RabbitMQ版本必须对应才行，不然可能会出错。

**官网信息如下 RabbitMQ Erlang Version Requirements**

Erlang/OTP versions **older than 20.3 are not supported** by RabbitMQ versions released in 2019.

RabbitMQ **versions prior to 3.7.7 do not support Erlang/OTP 21** or newer.

RabbitMQ version3.7.7--3.7.10 需要的Erlang版本最低为20.3.X,最高为21.X

| RabbitMQ version   | Minimum required Erlang/OTP | Maximum supported Erlang/OTP |
| ------------------ | --------------------------- | ---------------------------- |
| **3.7.7---3.7.10** | **20.3.X**                  | **21.X**                     |
| **3.7.0--3.7.6**   | **19.3**                    | **20.3.X**                   |

具体信息在这里`http://www.rabbitmq.com/which-erlang.html`

这里选择的版本是 `Erlang:21.2`,`RabbitMQ3.7.10`,`Linux:CentOS 7`

### 2. 依赖下载

安装`rabbitmq`需要下载以下依赖，这里可以提前下载上。

`# yum -y install make gcc gcc-c++ kernel-devel m4 ncurses-devel openssl-devel`

`# yum install xmlto -y`

## 1. Erlang安装

### 1.1 下载

安装RabbitMQ之前需要先安装Erlang.

下载地址：`http://www.erlang.org/downloads`

文件`otp_src_21.2.tar.gz`

### 1.2 解压

将压缩包上传到虚拟机中，我是放在/usr/software目录下的

`# tar xvf otp_src_21.2.tar.gz`  解压文件

复制一份到/usr/local/opt/erlang-software

`# cp otp_src_21.2  /usr/local/opt/erlang-software -r`

创建erlang安装目录： /usr/local/opt/erlang  

### 1.3 编译

进入到/usr/local/opt/erlang-software目录下

`# cd /usr/local/opt/erlang-software`

配置安装路径编译代码：`# ./configure --prefix=/usr/local/opt/erlang`

`# make && make install` 执行编译

### 1.4 环境变量配置

配置Erlang环境变量,`# vi /etc/profile` 添加以下内容

```xml
export PATH=$PATH:/usr/local/opt/erlang/bin
```

 `# source /etc/profile `使得文件生效

### 1.5 验证

验证erlang是否安装成功：`# erl` 进入如下界面就说明 配置好了

```xml
[root@localhost bin]# erl
Erlang/OTP 21 [erts-10.2] [source] [64-bit] [smp:1:1] [ds:1:1:10] [async-threads:1]

Eshell V10.2  (abort with ^G)
1> 
`
```

## 2. RabbitMQ安装

### 2.1 下载 

官网：`http://www.rabbitmq.com/releases/rabbitmq-server`

这里下载3.7.10 :`http://www.rabbitmq.com/install-generic-unix.html`

文件：`rabbitmq-server-generic-unix-3.7.10.tar.xz`

### 2.2 解压

文件是xz格式的，解压后得到tar格式文件。

`# xz -d rabbitmq-server-generic-unix-3.7.10.tar.xz`

`# tar -xvf rabbitmq-server-generic-unix-3.7.10.tar`

复制到/usr/local/opt/rabbitmq目录下`# cp -r rabbitmq_server-3.7.10/ /usr/local/opt/rabbitmq`

### 2.3 环境变量配置

配置rabbitmq环境变量,`# vi /etc/profile` 添加以下内容

`export PATH=$PATH:/usr/local/opt/rabbitmq/sbin`

环境变量生效：`source /etc/profile`

### 2.4 使用

进入/usr/local/opt/rabbitmq/sbin目录

启动服务：`# ./rabbitmq-server -detached`

查看服务状态：`# ./rabbitmqctl status`

关闭服务：`# ./rabbitmqctl stop `

### 2.5 配置网页插件

首先创建目录，否则可能报错：`# mkdir /etc/rabbitmq `

启用插件：`# ./rabbitmq-plugins enable rabbitmq_management`

启动mq：`# ./rabbitmq-server -detached`

配置linux 端口： 15672 网页管理，  5672 AMQP端口

然后访问`http://192.168.5.154:15672/`

这里是需要登录了。

rabbitmq默认会创建guest账号，只能用于localhost登录页面管理员，需要自己创建账号。

### 2.6 添加账户

查看mq用户：`# rabbitmqctl list_users  `

查看用户权限：`# rabbitmqctl list_user_permissions guest`

新增用户： `# rabbitmqctl add_user root root`  用户名root,密码root

赋予管理员权限：

`rabbitmqctl set_user_tags root administrator `

`rabbitmqctl set_permissions -p "/" root ".*" ".*" ".*" `



## 3. 问题

1.启动报错

```java
[root@localhost sbin]# ./rabbitmq-server start

BOOT FAILED
===========
=INFO REPORT==== 21-Jan-2019::20:49:29.302765 ===
Error description:
   noproc
   
Log files (may contain more information):
   /usr/local/opt/rabbitmq/var/log/rabbitmq/rabbit@localhost.log
   /usr/local/opt/rabbitmq/var/log/rabbitmq/rabbit@localhost-sasl.log

Stack trace:
   [{gen,do_for_proc,2,[{file,"gen.erl"},{line,228}]},
    {gen_event,rpc,2,[{file,"gen_event.erl"},{line,239}]},
    {rabbit,ensure_working_log_handlers,0,
            [{file,"src/rabbit.erl"},{line,856}]},
    {rabbit,'-boot/0-fun-0-',0,[{file,"src/rabbit.erl"},{line,288}]},
    {rabbit,start_it,1,[{file,"src/rabbit.erl"},{line,424}]},
    {init,start_em,1,[]},
    {init,do_boot,3,[]}]

{"init terminating in do_boot",noproc}
init terminating in do_boot (noproc)

Crash dump is being written to: erl_crash.dump...done
```

这个问题网上查了一下，有的说是权限问题，也有说是erlang和rabbitmq版本对应不上，暂时没解决。

以解决，确实是版本问题，erlang版本和rabbitmq的版本对应不上，最前面单独写了这个关于版本的问题。