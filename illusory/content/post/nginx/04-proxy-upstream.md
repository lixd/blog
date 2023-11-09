---
title: "Nginx教程(四)---反向代理与负载均衡"
description: "Nginx反向代理和负载均衡配置与使用"
date: 2019-02-17 22:00:00
draft: false
categories: ["Nginx"]
tags: ["Nginx"]
---

本章主要通过实例简单介绍了Nginx反向代理和负载均衡功能。

<!-- more-->



## 1. 反向代理(proxy)

### 1.1 简介

**如果您的内容服务器具有必须保持安全的敏感信息，如信用卡号数据库，可在防火墙外部设置一个`代理服务器`作为`内容服务器的替身`**。

当外部客户机尝试访问内容服务器时，会将其送到代理服务器。实际内容位于内容服务器上，在防火墙内部受到安全保护。代理服务器位于防火墙外部，在客户机看来就像是内容服务器。

 这样，代理服务器就在安全数据库和可能的恶意攻击之间提供了又一道屏障。与有权访问整个数据库的情况相对比，就算是侥幸攻击成功，作恶者充其量也仅限于访问单个事务中所涉及的信息。未经授权的用户无法访问到真正的内容服务器，因为防火墙通路只允许代理服务器有权进行访问。

**就是客户端先访问Nginx服务器，Nginx收到请求后再去请求内容服务器,这样中间多了一个Nginx服务器中转，会更加安全**。

### 1.2 配置

#### 1. 修改配置文件

首先需要修改`Nginx服务器`配置文件``nginx.conf`。

配置文件大概是这样的，在`server`中添加一个`location`用于中转。

```nginx
http{
    keepalive_timeout  65;
    server{
        listen 80; //端口号
        server_name localhost; //域名
        location \ {
            root html; //网站根目录
            index index.html; //网站首页
        }  
        access_log  logs/host.access.log  main; //访问日志
        error page 500 error.html; //错误页面
        #这里就是代理 通过正则表达式来匹配
        #后缀以.jsp结尾的请求都会跳转到 http://192.168.5.154:8080;
        location ~ \.jsp$ {
            proxy_pass   http://192.168.5.154:8080;
        }  
    }
}
```

#### 2. 开启内容服务器

然后在`192.168.5.154`的`8080`端口开启了一个``tomcat`,当做是真正的内容服务器，在tomcat默认的`index.jsp`中添加了一句显示IP地址的。

```jsp
<!--测试Nginx反向代理新增-->
remote ip:<%=request.getRemoteAddr()%>
```

### 1.3 测试

然后开始访问：

首先直接访问内容服务器(Tomcat)：`192.168.5.154:8080`

```java
remote ip:192.168.5.199 
```

然后访问Nginx通过代理来访问内容服务器：`192.168.5.154/index.jsp`

```java
remote ip:192.168.5.154
```

显示远程	IP是192.168.5.154，这个刚好就是Nginx服务器的IP；

反向代理成功。

### 1.4 问题

前面设置后反向代理已经成功了,但是这样设置后，每次访问内容服务器都显示的是Nginx服务器的IP,内容服务器无法获取用户的真实IP，所以还需要进行一点修改。

#### 1. 修改

```nginx
http{
    keepalive_timeout  65;
    server{
        listen 80; //端口号
        server_name localhost; //域名
        location \ {
            root html; //网站根目录
            index index.html; //网站首页
        }  
        access_log  logs/host.access.log  main; //访问日志
        error page 500 error.html; //错误页面
        #这里就是代理 通过正则表达式来匹配
        #后缀以.jsp结尾的请求都会跳转到 http://192.168.5.154:8080;
        location ~ \.jsp$ {
            #在请求头中添加上真实的IP 
            #具体格式为 proxy_set_header 属性名 数据
            proxy_set_header X-real-ip $remote_addr
            proxy_pass   http://192.168.5.154:8080;
        }  
    }
}
```

`proxy_set_header X-real-ip $remote_addr` :Nginx服务器是知道客户端真实IP的，所以为了让内容服务器知道真实IP，只需要将真实IP添加到请求头中就可以了。

其中`X-real-ip` 是自定义的，内容服务器取数据时也使用这个`X-real-ip`

`$remote_addr` 则是获取远程客户端IP。

#### 2. 测试：

修改jsp，添加了一句代码。

```jsp
                <!--测试Nginx反向代理新增-->
 			   <!--获取请求头中的真实IP-->
                Real remote ip:<%=request.getHeader("X-real-ip")%> <br />
                remote ip/Nginx ip:<%=request.getRemoteAddr()%>
```

然后开始访问：

首先直接访问内容服务器(Tomcat)：`192.168.5.154:8080`

```java
Real remote ip:null 
remote ip/Nginx ip:192.168.5.199 
```

然后访问Nginx通过代理来访问内容服务器：`192.168.5.154/index.jsp`

```java
Real remote ip:192.168.5.199 
remote ip/Nginx ip:192.168.5.154
```

成功获取到真实IP，问题解决。

## 2. 负载均衡(upstream)

### 2.1 简介

**可以在一个组织内使用多个代理服务器来平衡各 Web 服务器间的网络负载**。

对于客户机发往真正服务器的请求，代理服务器起着中间调停者的作用。客户机每次都使用同一个 URL，但请求所采取的路由每次都可能经过不同的代理服务器。

**同样是客户端先访问Nginx服务器，然后Nginx服务器再根据负载均衡算法将请求分发到不同的内容服务器上**。

### 2.2 配置

同意需要修改`Nginx服务器`配置文件``nginx.conf`。

配置文件大概是这样的，在`server`中添加一个`location`用于中转。

```nginx
http{
    keepalive_timeout  65;
    #upstream 负载均衡 与server同级
    #tomcat_server 负载均衡名字 自定义的 
    #要用在下面location反向代理处 
    #poxy_pass   http://tomcat_server;
    upstream tomcat_server{
        #weight权重 max_fails 最大失败次数 超过后就认为该节点down掉了 fail_timeout 超时时间
        #192.168.5.154:8080 IP地址或者域名都可以
        server 192.168.5.154:8080 weight=1 max_fails=2 fail_timeout=30s;
        server 192.168.5.155:8080 weight=1 max_fails=2 fail_timeout=30s;
    }
    
    
    server{
        listen 80; //端口号
        server_name localhost; //域名
        location \ {
            root html; //网站根目录
            index index.html; //网站首页
        }  
        access_log  logs/host.access.log  main; //访问日志
        error page 500 error.html; //错误页面
        #proxy_pass 反向代理 通过正则表达式来匹配
        #后缀以.jsp结尾的请求都会跳转到 http://192.168.5.154:8080;
        #proxy_set_header 将真实IP添加到请求头中 传递到内容服务器
        location ~ \.jsp$ {
            proxy_set_header X-real-ip $remote_addr
            #proxy_pass   http://192.168.5.154:8080;
            #反向代理这里不光可以写IP 还可以写上面配置的负载均衡
            proxy_pass   http://tomcat_server;
        }  
    }
}
```

### 2.3 测试

开启两个tomcat，一个是`192.168.5.154`,一个是``192.168.5.155`.

然后浏览器访问nginx服务器：`192.168.5.154/index.jsp`；

会随机跳转到两个tomcat服务器中的一个就说明负载均衡配置成功了。

## 3. 参考

`http://www.runoob.com/linux/nginx-install-setup.html`

`https://www.cnblogs.com/javahr/p/8318728.html`