---
title: "Redis教程(五)---搭建Redis集群"
description: "redis集群模式搭建过程"
date: 2019-02-27 22:00:00
draft: true
tags: ["Redis"]
categories: ["Redis"]
---

本文主要记录了Redis集群搭建与使用的详细过程。

<!--more-->


> 最少要3台机器才能形成集群，同时每个主需要配一个从，即最好6台机器。不过这里也没这么多机器
> 小霸王电脑也开不了6个虚拟机 所以就在一台机器上开6个Redis做个伪集群，真实情况下也差不多是这样配置的

## 1. 创建文件夹

先创建一个文件夹`redis-cluster`，然后在这个文件夹里分别创建6个文件夹当成6台机器，`redis7001`、`redis7002`、`redis7003`、`redis7004`、`redis7005`、`redis7006`、假装是6台服务器.....

```shelll
[root@localhost etc]# mkdir -p /usr/local/redis-cluster
[root@localhost etc]# cd /usr/local/redis-cluster/
[root@localhost redis-cluster]# mkdir 7001 && mkdir 7002 && mkdir 7003 && mkdir 7004 && mkdir 7005 && mkdir 7006 
```

## 2. 修改配置文件

然后把`redis.conf`配置文件分别复制到这6个文件夹

```shell
# 先复制一份 等修改好后再复制到其他地方
[root@localhost redis-5.0.3]# cp redis.conf /usr/local/redis-cluster/7001
```

然后修改配置文件`redis.conf`,主要修改下面这几个地方：

```shell
# 开启后台启动
1.daemonize yes 
# 端口号改为对应的700*
2.port 7001 
# 绑定IP 改为当前机器的IP
3.bind 192.168.5.191 
# 数据存储目录 每台机器必须指向不同的位置 改为对应的700*
4.dir /usr/local/redis-cluster/7001 
# 开启集群模式
5.cluster-enabled yes 
# 这里最好和port对应700*
6.cluster-config-file nodes-7001.conf 
# 超时时间可以自己调整
7.cluster-node-timeout 5000 
# 开启AOF持久化
8.appendonly yes 
```

修改完成后再分别负责到另外5台机器。**复制后记得把需要修改的地方修改一下，port、dir、cluster-config-file**

## 3. 环境准备

到这里6个文件夹的redis.conf配置文件都修改好了，
由于Redis集群需要Ruby命令，所以需要安装Ruby。

```shell
[root@localhost 7006]# yum install ruby
[root@localhost 7006]# yum install rubygems
#redis和Ruby的接口
[root@localhost 7006]# gem install redis    
```

### 问题

可能最后一步出现问题，提示如下：

```java
redis requires Ruby version >= 2.2.2
```

CentOS 默认支持ruby是2.0版本导，redis需要大于2.2.2的版本。

### 解决

通过rvm安装最新的ruby即可，具体如下;

```shell
# 安装curl curl是Linux下的文件传输工具
[root@localhost 7006]# yum install curl
# 安装rvm RVM是一个命令行工具，可以提供一个便捷的多版本Ruby环境的管理和切换。
[root@localhost 7006]# gpg2 --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
[root@localhost 7006]# \curl -sSL https://get.rvm.io | bash -s stable
# 查看一下rvm安装上没有
[root@localhost 7006]# find / -name rvm -print
#如果出现下面这样的就说明安装上了
　　　　 /usr/local/rvm
　　 　　/usr/local/rvm/src/rvm
　　 　　/usr/local/rvm/src/rvm/bin/rvm
　　 　　/usr/local/rvm/src/rvm/lib/rvm
　　 　　/usr/local/rvm/src/rvm/scripts/rvm
　　 　　/usr/local/rvm/bin/rvm
　　 　　/usr/local/rvm/lib/rvm
　　 　　/usr/local/rvm/scripts/rvm
# 使rvm配置文件生效　 　　
[root@localhost 7006]# source /usr/local/rvm/scripts/rvm
# 查看rvm库中已知的ruby版本
[root@localhost 7006]# rvm list known
# 大概会向这样 当前最新的时2.6
# MRI Rubies
[ruby-]1.8.6[-p420]
[ruby-]1.8.7[-head] # security released on head
[ruby-]1.9.1[-p431]
[ruby-]1.9.2[-p330]
[ruby-]1.9.3[-p551]
[ruby-]2.0.0[-p648]
[ruby-]2.1[.10]
[ruby-]2.2[.10]
[ruby-]2.3[.8]
[ruby-]2.4[.5]
[ruby-]2.5[.3]
[ruby-]2.6[.0]
ruby-head

#安装ruby2.6.0  这里需要等一会 下载之后还要等编译完...
[root@localhost 7006]# rvm install 2.6.0
#使用ruby2.6.0
[root@localhost 7006]# rvm use 2.6.0
#设置ruby默认版本
[root@localhost 7006]# rvm use 2.6.0 --default
#查看ruby版本 
[root@localhost 7006]# ruby --version
# 继续安装Redis
[root@localhost 7006]# gem install redis   

```

## 4. 启动Redis

分别启动6个Redis

```shell
# 分别启动6个Redis
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7001/redis.conf
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7002/redis.conf
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7003/redis.conf
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7004/redis.conf
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7005/redis.conf
[root@localhost 7006]# /usr/local/redis/bin/redis-server /usr/local/redis-cluster/7006/redis.conf

#查看一下启动成功没
[root@localhost redis-cluster]# ps aux|grep redis
root      16205  0.1  0.2 159512  2604 ?        Ssl  14:08   0:16 /usr/local/redis/bin/redis-server 0.0.0.0:6379
root      35225  0.2  0.2 153880  2836 ?        Ssl  16:22   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7001 [cluster]
root      35388  0.2  0.2 153880  2836 ?        Ssl  16:24   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7002 [cluster]
root      35398  0.1  0.2 153880  2832 ?        Ssl  16:24   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7003 [cluster]
root      35407  0.1  0.2 153880  2836 ?        Ssl  16:25   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7004 [cluster]
root      35415  0.1  0.2 153880  2836 ?        Ssl  16:25   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7005 [cluster]
root      35424  0.1  0.2 153880  2832 ?        Ssl  16:25   0:00 /usr/local/redis/bin/redis-server 192.168.5.154:7006 [cluster]
root      35468  0.0  0.0 112708   976 pts/1    R+   16:25   0:00 grep --color=auto redis
# ok的
```

## 5. 创建集群

#### 5.0之前的方式

进入redis安装目录`/usr/local/redis-5.0.3/src`找到`redis-trib.rb`脚本,这就是redis集群相关操作的脚本，是ruby写的.
执行命令创建集群

```shell
# 解释： 
# ./redis-trib.rb 即redis集群操作脚本 
# create 即创建集群
# --replicas  即配置 后面一长串都是集群配置
# 1  这个1是redis主从比例 主机三台 从机三台 主/--> 3/3 即 1
# 后面的6台机器中 会根据配置的比例把前面的几台(这里是3台)做为主，后面的做为从
# 然后主节点中的第一个对应的一定是从节点中的第一个 依次排下去这里就是7001 对应7004
[root@localhost src]# ./redis-trib.rb create --replicas 1 192.168.5.154:7001 192.168.5.154:7002 
 192.168.5.154:7003 192.168.5.154:7004 192.168.5.154:7005 192.168.5.154:7006
 
```

#### 5.0之后的方式

Redis 5.0 版本，放弃了Ruby的集群方式，改为使用C语言编写的 redis-cli的方式，使集群的构建方式复杂度大大降低。
命令如下：

```shell
# 参数的含义和上面也是一样的
#create 即创建集群
# --replicas  即配置 后面一长串都是集群配置
# 1  这个1是redis主从比例 主机三台 从机三台 主/--> 3/3 即 1
# 后面的6台机器中 会根据配置的比例把前面的几台(这里是3台)做为主，后面的做为从
# 然后主节点中的第一个对应的一定是从节点中的第一个 依次排下去这里就是7001 对应7004

[root@localhost src]# redis-cli --cluster create 192.168.5.154:7001 192.168.5.154:7002 
192.168.5.154:7003 192.168.5.154:7004 192.168.5.154:7005 192.168.5.154:7006 --cluster-replicas 1
# 接下来会询问是否设置 输入yes即可
Can I set the above configuration? (type 'yes' to accept): yes
>>> Performing Cluster Check (using node 192.168.5.154:7001)
M: 092694ff8d9a2fef0df632af1650653b6756efd5 192.168.5.154:7001
   slots:[0-5460] (5461 slots) master
   1 additional replica(s)
S: 1c465b386313dbe47fbdea93775a9ef249b8e5ae 192.168.5.154:7004
   slots: (0 slots) slave
   replicates 092694ff8d9a2fef0df632af1650653b6756efd5
M: 1c3f76d0f78d378f6413a66b7df0092b3f5be7ea 192.168.5.154:7002
   slots:[5461-10922] (5462 slots) master
   1 additional replica(s)
S: 80694351fa024c34316ffc443a3e25a5e99132cf 192.168.5.154:7005
   slots: (0 slots) slave
   replicates 1c3f76d0f78d378f6413a66b7df0092b3f5be7ea
S: 35eeed488e23f852520df69cdac3dfcb0001c7cf 192.168.5.154:7006
   slots: (0 slots) slave
   replicates 74fde96cb2cd794f0c15d26366641ce9afc34946
M: 74fde96cb2cd794f0c15d26366641ce9afc34946 192.168.5.154:7003
   slots:[10923-16383] (5461 slots) master

# 到这里集群就搭建好了 其中 slots:[0-5460] (5461 slots) 表示槽 
# 可以发现只有master有 slave没有 因为slave是不支持写的 只能读
```

## 6. 测试

到此为止，集群已经搭建成功，进行验证。
连接随便一个客户端

```shell
# -c 表示集群模式 -h 主机名 -p 端口号
[root@localhost bin]# /usr/local/redis/bin/reids-cli -c -h 192.168.5.154 -p 7001
```

**检测**
`cluster nodes`查看集群信息

```shell
[root@localhost bin]# /usr/local/redis/bin/redis-cli -c -h 192.168.5.154 -p 7001
192.168.5.154:7001> cluster nodes
1c465b386313dbe47fbdea93775a9ef249b8e5ae 192.168.5.154:7004@17004 slave 092694ff8d9a2fef0df632af1650653b6756efd5 0 1551948999244 4 connected
092694ff8d9a2fef0df632af1650653b6756efd5 192.168.5.154:7001@17001 myself,master - 0 1551948997000 1 connected 0-5460
1c3f76d0f78d378f6413a66b7df0092b3f5be7ea 192.168.5.154:7002@17002 master - 0 1551948997000 2 connected 5461-10922
80694351fa024c34316ffc443a3e25a5e99132cf 192.168.5.154:7005@17005 slave 1c3f76d0f78d378f6413a66b7df0092b3f5be7ea 0 1551948998236 5 connected
35eeed488e23f852520df69cdac3dfcb0001c7cf 192.168.5.154:7006@17006 slave 74fde96cb2cd794f0c15d26366641ce9afc34946 0 1551948997226 6 connected
74fde96cb2cd794f0c15d26366641ce9afc34946 192.168.5.154:7003@17003 master - 0 1551948999000 3 connected 10923-16383

```

**添加数据测试一下**

```shell
# 集群模式下 数据会随机或者平均分到几个主机中 这里在7001存的数据进入了第5798个槽中 即7002主机
192.168.5.154:7001> set name illusory
-> Redirected to slot [5798] located at 192.168.5.154:7002
OK
```

然后7002查询，在添加前查询时没有数据的 等7001存数据后 再次查询就能查到了

```shell
[root@localhost ~]# /usr/local/redis/bin/redis-cli -c -h 192.168.5.154 -p 7002
192.168.5.154:7002> keys *
(empty list or set)
192.168.5.154:7002> keys *
1) "name"
192.168.5.154:7002> 
```

注：集群模式只需要配置一次，以后启动后就自动为集群模式了。

## 7. 集群常用命令

redis5提供了一些操作集群的工具，在redis安装目录下
`/usr/local/redis-5.0.3/utils/create-cluster/create-cluster` 是个shell脚本文件。
使用前需要修改脚本中的一些信息

```shell
[root@localhost create-cluster]# vim create-cluster
#!/bin/bash

# Settings
#这个端口改为比自己的第一个节点小1
# 会默认自增1形成7001~7006 六个节点
PORT=7000
# 超时时间
TIMEOUT=2000
# 节点数 也需要改为相对应的
NODES=6
# 主从比例也是
REPLICAS=1


```

- 启动集群：` /root/local/redis-5.0.3/utils/create-cluster/create-cluster start`
- 关闭集群：` /root/local/redis-5.0.3/utils/create-cluster/create-cluster stop`

附上一个启动集群的脚本

```shell
#!/bin/sh
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7001/redis.conf
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7002/redis.conf
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7003/redis.conf
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7004/redis.conf
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7005/redis.conf
/usr/local/redis/bin/redis-server  /usr/local/redis-cluster/7006/redis.conf

/usr/local/redis/bin/redis-cli --cluster create 192.168.5.154:7001 192.168.5.154:7002 
192.168.5.154:7003 192.168.5.154:7004 192.168.5.154:7005 192.168.5.154:7006 --cluster-replicas 1
```

更多集群相关命令
`/usr/local/redis/bin/redis-cli --cluster help`

```shell
Cluster Manager Commands:
  create         host1:port1 ... hostN:portN
                 --cluster-replicas <arg>
  check          host:port
                 --cluster-search-multiple-owners
  info           host:port
  fix            host:port
                 --cluster-search-multiple-owners
  reshard        host:port
                 --cluster-from <arg>
                 --cluster-to <arg>
                 --cluster-slots <arg>
                 --cluster-yes
                 --cluster-timeout <arg>
                 --cluster-pipeline <arg>
                 --cluster-replace
  rebalance      host:port
                 --cluster-weight <node1=w1...nodeN=wN>
                 --cluster-use-empty-masters
                 --cluster-timeout <arg>
                 --cluster-simulate
                 --cluster-pipeline <arg>
                 --cluster-threshold <arg>
                 --cluster-replace
  add-node       new_host:new_port existing_host:existing_port
                 --cluster-slave
                 --cluster-master-id <arg>
  del-node       host:port node_id
  call           host:port command arg arg .. arg
  set-timeout    host:port milliseconds
  import         host:port
                 --cluster-from <arg>
                 --cluster-copy
                 --cluster-replace
  help           

For check, fix, reshard, del-node, set-timeout you can specify the host and port of any working node in the cluster.

```

## 8. 参考

`https://www.jianshu.com/p/72443fef9554`

`http://www.runoob.com/redis/redis-hashes.html`

