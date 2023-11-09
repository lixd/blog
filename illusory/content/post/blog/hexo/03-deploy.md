---
title: "基于Hexo搭建个人博客(三)---部署篇"
description: "通过GitHub Pages和域名设置 让博客被搜索引擎收录"
date: 2018-11-05 12:00:00
draft: false
categories: ["Blog"]
tags: ["Hexo"]
---

本章主要记录了如何将博客部署至云端，怎么设置个性域名，怎么将自己的网站提交到百度Google。让自己的网站能够出现在各大搜索引擎的具体方法和过程，希望能对大家有帮助。  

<!--more-->

## 1. 购买个性域名

估计大家折腾了这么久也就是为 了拥有一个自己的个性站点,所以强烈建议大家为自己的博客站点配置一个独一无二的个性域名.我这里选择阿里旗下的[万网](https://wanwang.aliyun.com/?spm=5176.8142029.735711.62.f0586d3eFXYcmo)。我的域名是[www.lixueduan.com](https://www.lixueduan.com)

大家可以选择一个自己喜欢的域名。等部署完毕就可以通过域名访问自己的博客了。

**问题：**

- **GithubPages/CodingPages**

  - Github Pages是[Github](https://github.com/)免费提供给开发者的一款托管个人网站的产品。
  - Coding Pages也是[Coding](https://coding.net/)免费提供给开发者的一款托管个人网站的产品。

- **关于为什么要部署两次**

  > 虽然可以根据自定义域名来访问自己的博客了，但是百度谷歌上都搜索不到，那岂不是很难受`╮(╯▽╰)╭`。
  >
  > 所以接下来为了让自己的博客能够被搜索出来，就需要让百度谷歌收录我们的网站。在部署收录过程中发现，**`Github`屏蔽了百度的爬虫**，所以搭建上`GithubPages`的话无法提交至百度，只有Google可以收录。
  >
  > 所以为了让百度收录我们网站，就得在Coding上也搭建一个。
  >
  > 同时在搭建的过程中发现如果先搭建在Github上，然后再搭建Coding时会出现`DNS解析`冲突。所以需要：**先搭建Coding上的，再搭建Github上的，国外的访问则走`Github`，国内的访问会走`Coding`，完美**

## 2. 部署到CodingPages

### 2.1 注册coding账户 

 点击这里注册Coding](https://coding.net/)

### 2.2 创建新项目

- 注册好后创建一个项目用来部署个人博客，项目路径和项目名称最好和用户名一致
- ![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-deploy-coding1.png)

### 2.3 开启CodingPages

- ![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-deploy-coding2.png)

 点击Pages服务，然后一键开启。

部署master分支

自定义域名 可以填两个 `www.xxx.com` 和`xxx.com`

绑定自定义域名的时候需要在买域名的地方(我这里是阿里的万网)配置DNS解析

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-coding-dns.png)

```java
添加两条CNAME解析
主机记录
	一个@，一个www//@就是无前缀，xxx.com, www就是www.xxx.com
解析路线
	默认就行
记录值
	lillusory.coding.me //这里改成自己的
```

 然后可以开启Https访问。

到这里就可以通过个性域名访问啦。不过现在博客代码还没有`push`到项目里。

### 2.4 Push代码到Coding

**配置SSH key**

首先需要配置一个`SSHkey`，`Git`有`Http`协议和`Git`协议两种。我们这里使用`Git`协议就需要配置一个`SSH key`,等会部署到`Github`上也需要配置这个。

具体配置方法如下：

[Git 配置及SSH key](https://www.lixueduan.com/categories/Git/)

**修改站点配置文件**

这里只配置了Coding，可以先把Github的注释掉

```java
# Deployment 部署到云端相关配置
## Docs: https://hexo.io/docs/deployment.html
deploy:
  type: git
  repository: 
   github: git@github.com:illusorycloud/illusorycloud.github.io.git
   coding: git@git.coding.net:illusorycloud/illusorycloud.git
  branch: master
```

**地址在这里：**

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-deploy-coding3.png)

配置好后，运行`hexo g时就可以把博客部署到Coding上了，也可以通过个性域名访问了。`

## 3. 收录到百度

### 3.1 网站添加

直接百度搜索你的域名,比如我的`www.lixueduan.com` ，如果没有收录就会提示暂未收录，点击`提交网址`。

点击这个链接进入百度站长平台，登录成功后选择`用户中心-->站点管理-->添加网站 

输入自己的网站，如`www.lixueduan.com` 协议头如果开启了`https`就选`https`

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-baidu1-add.png)

### 3.2 网站验证

然后会验证这个网站是不是你的，选CNAME验证

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-baidu2-verfication.png)

然后去域名哪里添加一条解析即可。

记录类型-->`CNAME`

主机记录--->前面那一串`l3rUDBLOMX`

记录值-->后面那个`ziyuan.baidu.com`

其他的都按默认的就行了，添加后别删除，需要一直留着。

### 3.3 站点地图

接下来我们需要生成网站地图`sitemap`,使用sitemap方式向百度提交我们的网址

站点地图是一种文件，您可以通过该文件列出您网站上的网页，从而将您网站内容的组织架构告知Google和其他搜索引擎。搜索引擎网页抓取工具会读取此文件，以便更加智能地抓取您的网站。

- 先安装一下，打开你的hexo博客根目录，分别用下面两个命令来安装针对谷歌和百度的插件

```xml
npm install hexo-generator-sitemap --save  #sitemap.xml适合提交给谷歌搜素引擎
npm install hexo-generator-baidu-sitemap --save  #baidusitemap.xml适合提交百度搜索引擎
```

- 在`站点配置文件`中添加如下代码

```xml
Plugins:
- hexo-generator-baidu-sitemap
- hexo-generator-sitemap

baidusitemap:
    path: baidusitemap.xml
sitemap:
    path: sitemap.xml
```

在你的博客根目录的public下面发现生成了sitemap.xml以及baidusitemap.xml就表示成功了.

然后将博客重新部署后就可以直接访问站点地图了。如`https://www.lixueduan.com/baidusitemap.xml`

然后将这个`站点地图`提交到百度

`站点管理-->站点属性-->链接提交-->自动提交-->sitemap`

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-baidu3-sitemap.png)

完成后就算是提交成功了，百度比较慢，要好几天才能收录。

## 4. 部署到GitHub

步骤和Coding差不多的。

### 4.1 注册Github账号

[点这里注册Github账号](https://github.com/)

### 4.2 创建新仓库

也是名字必须和用户名一样，必须按照这个格式`username.github.io`，例如`lillusorycloud.github.io`

创建好仓库后找到`Setings`  往下拉，找到`Github Pages`  设置`Custom domain`填下自定义域名，如`www.lixueduan.com`.如果有`Enforce HTTPS `选项也可以勾上。

### 4.3 Push代码到Github

**配置SSH key**

首先需要配置一个`SSHkey`，`Git`有`Http`协议和`Git`协议两种。我们这里使用`Git`协议就需要配置一个`SSH key`,等会部署到`Github`上也需要配置这个。

具体配置方法：

[Git 配置及SSH key](https://www.lixueduan.com/categories/Git/)

**修改站点配置文件**

`repository`中添加一个`github`

```java
# Deployment 部署到云端相关配置
## Docs: https://hexo.io/docs/deployment.html
deploy:
  type: git
  repository: 
    github: git@github.com:illusorycloud/illusorycloud.github.io.git
    coding: git@git.coding.net:illusorycloud/illusorycloud.git
  branch: master
```

配置好后，运行`hexo g时就可以把博客同时部署到Coding和Github上了，也可以通过个性域名访问了。`

## 5. 收录到Google

和百度差不多。

### 5.1 网站添加

首先进入[Google站点平台](https://www.google.com/webmasters/#?modal_active=none)

然后添加资源，注意`http`和`https`

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-google-add.png)

### 5.2 验证所有权

然后验证所有权,选择DNS供应商

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-google-verfication1.png)



![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-google-verfication2.png)

供应商选择其他，然后选择添加CNAME记录，在域名解析中添加一条记录。也是添加后不要删除。

### 5.3 站点地图

验证后就可以添加站点地图了

![](https://github.com/lixd/blog/raw/master/images/blogutil/hexo/2018-12-28-google-sitemap.png)

提交成功后,我们的站点就已经被Google收录了.大概一天就能收录成功，比百度块一些。

## 6. 总结

本文主要讲了怎么将博客部署到`Coding`和`Github`和怎么让`百度`,`Google`收录我们的网站。

## 7.参考

[Hexo官方文档](https://hexo.io/zh-cn/docs/)

[基于Hexo的个人博客](https://www.jianshu.com/p/cc902b54d493)

[Hex博客搭建](https://blog.csdn.net/qq_35561857/article/details/81590953)

