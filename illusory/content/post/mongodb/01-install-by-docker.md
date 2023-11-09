---
title: "MongoDB教程(一)---基于Docker安装MongoDB"
description: "MongoDB安装与可视化工具选择"
date: 2019-05-02 22:00:00
draft: false
tags: ["MongoDB"]
categories: ["MongoDB"]
---

本文主要记录了如何通过`Docker`方便快捷的安装`MongoDB`数据库。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. 概述

MongoDB 是一个基于分布式文件存储的数据库。由 C++ 语言编写。旨在为 WEB 应用提供可扩展的高性能数据存储解决方案。

MongoDB 是一个介于关系数据库和非关系数据库之间的产品，是非关系数据库当中功能最丰富，最像关系数据库的。

## 2. 安装

### 2.1 拉取镜像

```shell
docker pull mongo
```

### 2.2 准备环境

```shell
/usr/local/docker/mongodb/data //数据
/usr/local/docker/mongodb/backup //备份
/usr/local/docker/mongodb/conf  //配置文件
```

准备3个文件夹用来存放相应数据。

### 2.3 配置文件

`mongodb.conf`配置文件如下，建立好配置文件放到前面建好的目录中。

```shell
# mongodb.conf
logappend=true
# bind_ip=127.0.0.1
port=27017 
fork=false
noprealloc=true
# 是否开启身份认证
auth=false
```

### 2.4 启动容器

```shell
docker run --name mongodb -v \
/usr/local/docker/mongodb/data:/data/db -v \
/usr/local/docker/mongodb/backup:/data/backup -v \
/usr/local/docker/mongodb/conf:/data/configdb -p \27017:27017 -d mongo \
-f /data/configdb/mongodb.conf \
--auth
# 命令说明
容器命名mongodb，
数据库数据文件挂载到/usr/local/docker/mongodb/data
备份文件挂载到/usr/local/docker/mongodb/backup
启动的配置文件目录挂载到容器的/usr/local/docker/mongodb/conf
--auth开启身份验证。
-f /data/configdb/mongodb.conf 以配置文件启动 
# mongod启动命令是在容器内执行的，因此使用的配置文件路径是相对于容器的内部路径。
```

## 3. 添加用户

使用`MongoDB`之前需要先创建用户。

### 3.1 进入容器

```shell
docker exec -it mongodb bash
```

执行该命令进入到刚才启动的容器中。

### 3.2 进入 MongoDB

```shell
mongo
```

执行该命令进入到`MongoDB`客户端。

### 3.3 创建用户

```shell
# 进入 admin 的数据库
use admin
# 创建管理员用户
db.createUser(
   {
     user: "admin",
     pwd: "123456",
     roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
   }
 )
 # 创建有可读写权限的用户. 对于一个特定的数据库, 比如'demo'
 db.createUser({
     user: 'test',
     pwd: '123456',
     roles: [{role: "readWrite", db: "demo"}]
 })
```

## 4. 使用

到此为止`MongoDB`就安装完成了，可以远程连接了。连接之前先关闭`Linux`防火墙。

### 4.1 可视化工具

可视化工具暂时用的`Robo3T`,官网：`https://robomongo.org/`

### 4.2 连接

使用前面创建的用户就可以远程连接到`MongoDB`了.

其中管理员用户是用来管理用户的。

每个用户只能访问指定的db。

比如上面的`test`账号只能访问`demo`这个db。

```shell
url:192.168.1.1:27017
username:test
password:123456
```

## 5. 参考

`https://www.runoob.com/mongodb/mongodb-tutorial.html`

