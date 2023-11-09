---
title: "Linux下的网络配置"
description: "linux如何配置网络，让虚拟机能够连上外网，如何让虚拟机和主机联通"
date: 2019-01-14 22:00:00
draft: false
categories: ["Linux"]
tags: ["Linux"]
---

本章主要讲了linux如何配置网络，让虚拟机能够连上外网，如何让虚拟机和主机联通，同时介绍了ssh客户端工具连接虚拟机。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. Xshell

在安装好虚拟机后就可以正常使用了。但是在正常工作中不可能真的在服务器上操作，一般都是通过ssh客户端工具连接服务器进行操作。

这里用到的客户端工具是`Xshell`,通过该工具连上服务器后就可以在自己的电脑上操作了。而且还可以开多个窗口，比较方便。

![xshell](https://github.com/lixd/blog/raw/master/images/linux/network-set/xshell-use.png)

这里新建连接时需要输入要连接的服务器的IP和端口号，账户和密码，端口号默认是22，一般不用改。

## 2. 网络配置

### 2.1 桥接模式和NAT模式

按照上面的方法就可以连上虚拟机了，但是现在虚拟机的IP是自动获取的，**每次重启后都IP都会变**，这肯定不行呀，所以我们需要为虚拟机设置**静态IP**.

由于我们这里使用的是NAT模式。这个模式下虚拟机可以上网，但是无法和主机联通。

**桥接模式和NAT模式的区别：**

桥接模式下虚拟机可以看做一台真正的独立的电脑，所以桥接模式下需要为虚拟机分配独立的IP，在家里到时无所谓，在公司的话由于IP和电脑绑定的，所以需要网络管理人员给你的虚拟机分配一个IP才行。

NAT模式下，虚拟机会动态获取IP,虽然有自己的IP但是最终上网还是通过主机上网的。所以NAT模式下不用分配独立的IP,但是**NAT模式下主机和虚拟机无法联通。**

**为了主机和虚拟机联通，我们必须让主机和虚拟机在同一个网段下。**

**为了主机和虚拟机联通，我们必须让主机和虚拟机在同一个网段下。**

**为了主机和虚拟机联通，我们必须让主机和虚拟机在同一个网段下。**

### 2.2 设置静态IP

在设置静态IP前我们需要知道主机的IP.

windows下命令行输入 `ipconfig` 即可获取到本机IP.

![ipconfig]( https://github.com/lixd/blog/raw/master/images/linux/network-set/ip-query.png ip-query.png)

然后通过VMware软件对网络进行配置。

![vmware]( https://github.com/lixd/blog/raw/master/images/linux/network-set/ip-query.png ip-set-way.png)

![static ip]( https://github.com/lixd/blog/raw/master/images/linux/network-set/ip-query.png vm-ip-set.png)

接着在虚拟机中配置具体网络信息。

### 2.3 网络配置

#### 2.3.1 网卡配置

网络配置文件在`/etc/sysconfig/network-scripts/ifcfg-ens33`目录下，一般是叫`ifcfg-ens33`

编辑配置文件 命令：`vi /etc/sysconfig/network-scripts/ifcfg-ens33`

配置如下 ：

其中ip地址必须和主机在同一网段下，网关就是上边的那个网关。DNS可填可不填。

```xml
BOOTPROTO="static"  # 手动分配ip
ONBOOT="yes"  # 该网卡是否随网络服务启动
IPADDR="192.168.1.111"  # 该网卡ip地址就是你要配置的固定IP
GATEWAY="192.168.1.2"   # 网关
NETMASK="255.255.255.0"   # 子网掩码 固定值
DNS1="8.8.8.8"    # DNS，8.8.8.8为Google提供的免费DNS服务器的IP地址
DNS2="192.168.1.2" 
```

#### 2.3.2 网络配置

命令：`vi /etc/sysconfig/network` 添加以下内容

```xml
NETWORKING=yes # 网络是否工作，此处一定不能为no
NETWORKING_IPV6=no
HOSTNAME=localhost.localdomain
GATEWAY=192.168.1.2
```

#### 2.3.3 配置公共DNS服务

`vi /etc/resolv.conf`

```xml
search localdomain
nameserver 8.8.8.8
nameserver 192.168.1.2
```

#### 2.3.4 关闭防火墙

```java
systemctl stop firewalld # 临时关闭防火墙
systemctl disable firewalld # 禁止开机启动
```

#### 2.3.5 重启网络服务

`service network restart`

到此为止网络配置就完成了，现在虚拟机的IP重启后不会变了，也可以连上外网了，还可以和主机联通了。