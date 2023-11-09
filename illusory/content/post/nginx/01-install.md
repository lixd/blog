---
title: "Nginx教程(一)---安装与配置"
description: "Nginx安装及其与Apache简单对比"
date: 2019-02-13 22:00:00
draft: false
categories: ["Nginx"]
tags: ["Nginx"]
---

本章主要对Nginx服务器进行了介绍，同时对Nginx与Apache之间做出了对比，最后记录了如何在Linux下通过解压方式安装Nginx，也对Nginx基本使用做出了说明。

<!-- more-->



## 1. Nginx简介

Nginx是一款轻量级的Web服务器/反向代理服务器及电子邮件（IMAP/POP3）代理服务器。其特点是**占有内存少，并发能力强**，事实上nginx的并发能力确实在同类型的网页服务器中表现较好。 

### 1.1 Nginx模块架构

Nginx 由内核和模块组成。Nginx 的模块从结构上分为`核心模块`、`基础模块`和`第三方模块`。

* **核心模块**：HTTP 模块、 EVENT 模块和 MAIL 模块
* **基础模块**： HTTP Access 模块、HTTP FastCGI 模块、HTTP Proxy 模块和 HTTP Rewrite模块
* **第三方模块**：HTTP Upstream Request Hash 模块、 Notice 模块和 HTTP Access Key模块 

### 1.2 Nignx与Appache

`Nginx`的高并发得益于其采用了`epoll`模型，与传统的服务器程序架构不同`epoll` 是`linux内核2.6`以后才出现的。

**`Nginx`采用`epoll`模型，异步非阻塞，而`Apache`采用的是`select 模型` **。

* **Select模型**：select 选择句柄的时候是遍历所有句柄，也就是说句柄有事件响应时，select 需要遍历所有句柄才能获取到哪些句柄有事件通知，因此效率是非常低。
* **epoll 模型**：epoll对于句柄事件的选择不是遍历的，是事件响应的，就是句柄上事件来就马上选择出来，不需要遍历整个句柄链表，因此效率非常高。

## 2. 安装

注：这里用的是`CentOS 7`

### 2.1 安装包下载

官网：`http://nginx.org/en/download.html` 这里下载的时`nginx-1.15.9.tar.gz`

上传到服务器上，这里放在了`usr/software`目录下

### 2.2 环境准备

**安装编译源码所需要的工具和库**:

```linux
# yum install gcc gcc-c++ ncurses-devel perl 
```

**安装HTTP rewrite module模块**: 

```shell
# yum install pcre pcre-devel
```

**安装HTTP zlib模块**: 

```shell
# yum install zlib gzip zlib-devel
```

### 2.3 编译安装

**解压**：

```shell
[root@localhost software]# tar -zxvf nginx-1.15.9.tar.gz -C /usr/local
//解压到/usr/local目录下
```

**配置**:

进行configure配置，检查是否报错。

```shell
[root@localhost nginx-1.15.9]# ./configure --prefix=/usr/local/nginx

//出现下面的配置摘要就算配置ok
Configuration summary
  + using system PCRE library
  + OpenSSL library is not used
  + using system zlib library

  nginx path prefix: "/usr/local/nginx"
  nginx binary file: "/usr/local/nginx/sbin/nginx"
  .....
  nginx http uwsgi temporary files: "uwsgi_temp"
  nginx http scgi temporary files: "scgi_temp"
```

**编译安装**:

```shell
[root@localhost nginx-1.15.9]# make&&make install
//出现下面的提示就算编译安装ok
make[1]: Leaving directory `/usr/local/nginx-1.15.9'
```

编译安装后多了一个`Nginx`文件夹,在`/usr/local/nginx` 内部又分为四个目录

```shell
/usr/local/nginx
			--conf	配置文件
			--html  网页文件
			--logs  日志文件
			--sbin  主要二进制文件
```

**查看Nginx版本:**

```shell
[root@localhost nginx]# /usr/local/nginx/sbin/nginx -v
nginx version: nginx/1.15.9
//这里是Nginx 1.15.9
```

到这里`Nginx`安装就结束了。

## 3. 基本操作

### 3.1 启动

```shell
[root@localhost sbin]# /usr/local/nginx/sbin/nginx
//这里如果没有报错就说明启动成功了
```

查看

```shell
[root@localhost sbin]# ps aux|grep nginx
root      98830  0.0  0.0  20552   616 ?        Ss   09:57   0:00 nginx: master process /usr/local/nginx/sbin/nginx
nobody    98831  0.0  0.1  23088  1392 ?        S    09:57   0:00 nginx: worker process
root      98839  0.0  0.0 112708   976 pts/1    R+   09:57   0:00 grep --color=auto nginx
```

可以看到Nginx有两个进程，一个`master进程`一个`worker进程`.

同时浏览器已经可以访问了:直接访问IP地址即可`http://192.168.5.154/`

显示如下：

```txt
Welcome to nginx!
If you see this page, the nginx web server is successfully installed and working. Further configuration is required.

For online documentation and support please refer to nginx.org.
Commercial support is available at nginx.com.

Thank you for using nginx.
```

说明`Nginx`确实已经启动了。

### 3.2 常用命令

```shell
# 重新载入配置文件
[root@localhost sbin]# /usr/local/nginx/sbin/nginx -s reload   
# 重新打开日志文件
[root@localhost sbin]# /usr/local/nginx/sbin/nginx -s reopen
# 停止
[root@localhost sbin]# /usr/local/nginx/sbin/nginx -s stop     
```

## 4. 参考

`http://www.runoob.com/linux/nginx-install-setup.html`

