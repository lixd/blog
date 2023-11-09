---
title: "基于Hexo搭建个人博客(一)---基础篇"
description: "使用hexo搭建个人博客系列一 环境安装和本地运行"
date: 2018-11-01 22:00:00
draft: false
categories: ["Blog"]
tags: ["Hexo"]
---

本文主要记录了如何搭建自己的博客。基于Hexo框架在本地搭建自己博客的全过程，包括了环境准备到Hexo初始化，再到服务的开启等。

<!--more-->

## 1. 环境准备

- Git  [Git下载地址](https://git-scm.com/downloads)
- Node.js  [Node.js下载地址](https://nodejs.org/en/)

小白式安装，一直下一步就ok了。

都安装好后就可以开始安装Hexo啦.

## 2. 安装Hexo

- 1.新建一个文件夹,用于安装Hexo,以后这个就是放博客文件的.
- 2.在此文件夹右键,`Git Bash Here`,打开Git
- 3.安装Hexo  命令`npm install -g hexo`
- 4.初始化Hexo  命令`hexo init`
- 5.安装组件  命令`npm install`

到此为止,Hexo就算是安装完成了。

## 3. 开启服务

- 1.`hexo generate`或者简写`hexo g`  编译,生成静态文件,就是生成一个个html文件.

- 2.开启服务`hexo server`或者`hexo s`   成功开启后就可以在本地访问了。 http://localhost:4000
  - 假如页面一直无法跳转，那么可能端口被占用了。此时我们ctrl+c停止服务器，`hexo server -p 端口号`来改变端口号  
  - 如`hexo server -p 5000`  将端口号换为`5000`,默认是`4000`
- 3.常用命令 
  - `hexo clean`  清除缓存文件  
  - `hexo deploy`或者`hexo d`  部署网站到云端,这个后面再讲。

## 4. 参考

[Hexo官方文档](https://hexo.io/zh-cn/docs/)