---
title: "Nginx教程(二)---配置文件详解"
description: "Nginx服务器的常用配置文件介绍"
date: 2019-02-14 22:00:00
draft: false
categories: ["Nginx"]
tags: ["Nginx"]
---

本章主要对Nginx服务器的常用配置文件，包括虚拟主机配置，location配置级语法等。

<!-- more-->



## 1. 虚拟主机配置

在前面启动Nignx后，Nginx目录下会多出几个文件夹

```nginx
/usr/local/nginx
			--conf	配置文件
			--html  网页文件
			--logs  日志文件
			--sbin  主要二进制文件

			--client_body_temp
			--fastcgi_temp
			--proxy_temp
			--scgi_temp
			--uwsgi_temp
```

不过这些`temp`文件夹都不是重点。

### 1.1 配置文件

这里讲解一下`conf`里的配置文件，有很多配置文件，重点看` nginx.conf`.

```nginx
/usr/local/nginx/conf
		-- fastcgi.conf
		-- fastcgi.conf.default
 		-- fastcgi_params
		-- fastcgi_params.default
		-- koi-utf
 		-- koi-win
 		-- mime.types
 		-- mime.types.default
 		-- nginx.conf  # 重点关心这个
 		-- nginx.conf.default
		-- scgi_params
		-- scgi_params.default
 		-- uwsgi_params
		-- uwsgi_params.default
 		--win-utf
```

### 1.2 nginx.conf

看一下默认的`nginx.conf`

```nginx
[root@localhost conf]# vim nginx.conf
//默认配置如下：

#可以指定用户 不过无所谓
#user  nobody;   

#nginx工作进程,一般设置为和cpu核数一样
worker_processes  1; 

#错误日志存放目录 
#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#进程pid存放位置
#pid        logs/nginx.pid;


events {
    # 单个CPU最大连接数
    worker_connections  1024;
}

# http 这里重点
http {
    #文件扩展名与类型映射表
    include       mime.types;
    
    #默认文件类型
    default_type  application/octet-stream;
    
	#设置日志模式
    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    #access_log  logs/access.log  main;
    
  	#开启高效传输模式  
    sendfile        on;
    
    # 激活tcp_nopush参数可以允许把httpresponse header和文件的开始放在一个文件里发布
    # 积极的作用是减少网络报文段的数量
    #tcp_nopush     on;
    
	#连接超时时间，单位是秒
    #keepalive_timeout  0;
    keepalive_timeout  65;
    
    #开启gzip压缩功能
    #gzip  on;
    
	#基于域名的虚拟主机
    server {
        #监听端口
        listen       80;
        #域名
        server_name  localhost;
        #字符集
	    #charset koi8-r;
         
	    #nginx访问日志 这里的main就是上面配置的那个log_format  main 
        #access_log  logs/host.access.log  main;
        
	    #location 标签
        #这里的/表示匹配根目录下的/目录
        location / {
            #站点根目录，即网站程序存放目录
		   #就是上面的四个文件夹中的html文件夹
            root   html;
            #首页排序 默认找index.html 没有在找index.htm
            index  index.html index.htm;
        }
	    # 错误页面
        #error_page  404              /404.html;

        # redirect server error pages to the static page /50x.html
        #错误页面 错误码为500 502 503 504时 重定向到50x.html
        error_page   500 502 503 504  /50x.html;
	    #location 标签
        #这里的表示匹配根目录下的/50x.html
        location = /50x.html {
            root   html;
        }

        # proxy the PHP scripts to Apache listening on 127.0.0.1:80
        #
        #location ~ \.php$ {
        #    proxy_pass   http://127.0.0.1;
        #}

        # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000
        #
        #location ~ \.php$ {
        #    root           html;
        #    fastcgi_pass   127.0.0.1:9000;
        #    fastcgi_index  index.php;
        #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
        #    include        fastcgi_params;
        #}

        # deny access to .htaccess files, if Apache's document root
  # concurs with nginx's one
        #
        #location ~ /\.ht {
        #    deny  all;
        #}
    }

```

### 1.3 基本配置

上面的配置文件好像挺长的，其实最重要的就那么几个。

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
    }
}
```

## 2. location

### 2.1 简介

`nginx.conf`大概内容如下：

```shell
http{
    keepalive_timeout  65;
    server{
        listen 80; #端口号
        server_name localhost; #域名
        location \ {
            root html; #网站根目录
            index index.html; #网站首页
        }  
        access_log  logs/host.access.log  main; #访问日志
        error page 500 error.html; #错误页面
    }
}
```

其中`server`代表虚拟主机，一个虚拟主机可以配置多个`location`

`location`表示uri方法定位

基本语法如下：

- 1.location=pattern{} 静准匹配
- 2.location pattern{} 一般匹配
- 3.location~pattern{} 正则匹配

**Nginx可以对数据进行压缩，对一些图片、css、js、html等文件进行缓存，从而实现动静分离等待优化功能**。

**动态的就去访问tomcat服务器，静态的就直接访问Nginx服务器**。

**基本语法**：

```nginx
location [=|~|~*|^~|@] /uri/ {
    ....
}
```

〖=〗 表示精确匹配，如果找到，立即停止搜索并立即处理此请求。
〖~ 〗 表示区分大小写匹配
〖~*〗 表示不区分大小写匹配
〖^~ 〗 表示只匹配字符串,不查询正则表达式。

〖@〗 指定一个命名的location，一般只用于内部重定向请求。

### 2.2 正则表达式

1.语法格式：

```nginx
location [=|~|~*|^~|@]   /uri/ {
    .....
}
```

1.依据不同的前缀`=`，`^~`,`~ `，`~*` ”和`不带任何前缀`(因为[ ] 表示可选，可以不要的)表达不同的含义。
 简单的说尽管location 的/uri/ 配置一样，但前缀不一样，表达的是不同的指令含义。
**注意：查询字符串不在URI范围内。例如：/films.htm?fid=123 的URI 是/films.htm**。

2.对这些不同前缀，分下类，就2 大类：

*  **正则location** : `~ `和`~*`前缀表示正则location ，`~ `区分大小写，`~* `不区分大小写。
* **普通location** : `=`，`^~ `和`@ `和  ` 无任何前缀`, 都属于普通location 。

**详细说明**：

* **~**  : 区分大小写匹配

* **~*** : 不区分大小写匹配

* **!~** :  区分大小写不匹配
* **!~*** : 不区分大小写不匹配

* **^** : 以什么开头的匹配

* **$** : 以什么结尾的匹配
* ***** : 代表任意字符

## 3. 参考

`http://www.runoob.com/linux/nginx-install-setup.html`