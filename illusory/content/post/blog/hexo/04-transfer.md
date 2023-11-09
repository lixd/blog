---
title: "基于Hexo搭建个人博客(四)---管理篇"
description: "通过GitHub实现切换环境后实现快速恢复"
date: 2018-11-10 22:00:00
draft: false
categories: ["Blog"]
tags: [Hexo"]
---

本章主要记录了如何通过使用`Github`的`分支功能`解决更换电脑后博客更新不方便的问题，让你的博客能在各个电脑上灵活切换。在也不用担心换电脑后博客配置丢失等问题了。

<!--more-->

到此为止，我们已经完成了差不多所有的步骤。

* 1.搭建博客
* 2.优化主题
* 3.部署收录

**新问题：**

​	现在博客只能在自己的电脑上更新，如果换电脑了就很麻烦。配置文件主题什么的都要重新弄。所以网上找了找多台电脑同时操作的办法，我们可以利用Github的分支功能。

​	将博客文件夹下所有文件全`push`到`Github`。这样换电脑后直接`pull`就可以了。

## 1. 新建分支

* 1.在`Github`的`lillusory.github.io`（hexo仓库）上新建一个分支，例如`Hexo`，并切换到该分支.

* 2.并在该仓库`Settings->Branches->Default branch`中将默认分支设为`Hexo`.`Hexo`分支是博客的开发环境，用来写博客，保存原始文件,`master`分支用于显示，保存生产的静态文件。

* 3.新建分支后将博客目录下的所有文件上传到该分支，注意由于一个`git仓库`中不能包含其他仓库，所以需要删除掉主题文件夹中的`.git`目录。

* 4.如果按照前面的博文添加了背景，则需要删掉`站点目录\themes\next\source\lib\canvas-nest`文件夹中的`.git`目录。以后需要更新主题时，可以先克隆到本地在复制到相应目录.

## 2. 写博客

在本地对博客进行修改（添加新博文、修改样式等等）后，通过下面的流程进行管理。

* 依次执行`git add .`、`git commit -m "这里写备注"`、`git push origin 这里写分支名字`指令将改动推送到GitHub（此时当前分支应为hexo）。
* 然后才执行`hexo g -d`发布网站到master分支上。

## 3. 博客迁移

当重装电脑之后，或者想在其他电脑上修改博客，可以使用下列步骤：

* 克隆仓库
  * 使用`git clone git@github.com:illusorycloud/illusorycloud.github.io.git`拷贝仓库（默认分支为hexo）；//修改成自己的
* 安装插件 在前面克隆下的项目中安装插件
  * 执行命令`npm install hexo、npm install`、`npm install hexo-deployer-git`

## 4. 参考

[如何在多台电脑上更新博客](https://blog.csdn.net/qq_25560423/article/details/53785707)



