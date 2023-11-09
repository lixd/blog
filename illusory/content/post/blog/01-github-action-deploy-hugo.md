---
title: "基于 Github Action 自动构建 Hugo 博客"
description: "基于 Github Action 自动构建 Hugo 博客"
date: 2022-06-11 22:00:00
draft: false
categories: ["Blog"]
tags: [Hugo]
---

本文主要记录了如何配置  Github Action 实现 Hugo 博客自动部署。

<!--more-->

[GitHub Actions 快速入门](https://docs.github.com/cn/actions/quickstart)

[hugo quick-start](https://gohugo.io/getting-started/quick-start/)



## 1. 概述

Hugo 都是静态博客，即最终生成的是静态页面，而所谓部署就是把这些静态文件放到 web 服务器(比如 Nginx、Caddy) 的对应目录就行了。

因此整个 Github Action 只需要做两件事：

* 1）编译，生成静态文件
* 2）部署，把静态文件移动到合适的位置
  * 比如放到某个云服务器上
  * 或者放到 Github Pages

然后我们再通过 git push 来触发 Github Action  就可以了。



## 2. 具体实现

### 添加 Github Action

需要在仓库根目录下创建 `.github/workflow` 这个二级目录，然后在 workflow 下以 yml  形式配置 Github Action。

>  具体可以参考 [这个仓库](https://github.com/lixd/lixd.github.io)



需要指定 action 触发条件，这里就设置为 push 触发，具体如下：

```YAML
on:
  push:
    branches:
      - main  # Set a branch to deploy
  pull_request:
```

以上表示在 **main**分支收到 push 事件时执行该 action。

> 如果是之前创建的仓库，可能需要改成 **master** 分支。



另外我们可以直接在 [marketplace](https://github.com/marketplace?type=actions) 找别人配置好的 action 来使用，就更加方便了，以下是本教程用到的 action

* [actions/checkout](https://github.com/marketplace/actions/checkout)
* [hugo-setup](https://github.com/marketplace/actions/hugo-setup)
* [github-pages-action](https://github.com/marketplace/actions/github-pages-action)
* [rsync](https://github.com/marketplace/actions/rsync-deployments-action)

我们要做的就是把这些单独的 action 进行组合，以实现自动部署。



### 发布到 Github Pages

静态博客可以直接用 Github Pages，比较简单，缺点就是国内访问会比较慢，甚至于直接打不开。

action 文件如下

```yaml
name: GitHub Pages

on:
  push:
    branches:
      - main  # Set a branch to deploy
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-20.04
    concurrency:
      group: ${{ github.workflow }}-${{ github.ref }}
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: '0.100.2'
          # 是否启用 hugo extend
          extended: true

      - name: Build
        run: hugo --minify

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        if: ${{ github.ref == 'refs/heads/main' }}
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

整个 Action 一个包含 4 个步骤：

* 1）拉取代码
* 2）准备 hugo 环境
* 3）使用 hugo 编译生成静态文件
* 4）把生成的静态文件发布到 Github Pages

其他都不需要改，唯一需要注意的是 Hugo 的版本以及是否启用 hugo 扩展。

> 建议改成和自己当前使用的版本，否则可能会出现兼容性问题。

```yaml
      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: '0.100.2'
          extended: true
```



### 发布到云服务器

发布到云服务器和发布到 Github Pages 差不多，只有最后 deploy 这个步骤不一样。

发布到云服务器有很多种实现方式：

* 1）直接 scp 拷贝到对应目录
* 2）rsync 同步

这里用的是 rsync 方式，需要在服务器上安装 rsync。这里用的是 centos7，自带了 rsync, 只是没有启动，只需要启动就好，其他系统应该也默认安装了。

```bash
systemctl enable rsyncd --now
```



action 文件如下

```yaml
name: Custom Server

on:
  push:
    branches:
      - main  # Set a branch to deploy
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-20.04
    concurrency:
      group: ${{ github.workflow }}-${{ github.ref }}
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: '0.100.2'
          extended: true

      - name: Build
        run: hugo --minify

      - name: Deploy
        uses: burnett01/rsync-deployments@5.2
        with:
          switches: -avzr --delete
          path: ./public
          remote_path: /var/www/html/ # 需要先手动在远程主机创建该目录，否则会执行失败
          remote_host: ${{ secrets.DEPLOY_HOST }} # 远程主机 IP
          remote_port: ${{ secrets.DEPLOY_PORT }} # ssh 端口，默认为 22
          remote_user: ${{ secrets.DEPLOY_USER }} # ssh user
          remote_key: ${{ secrets.DEPLOY_KEY }} # ssh 私钥
```

为了安全起见，敏感数据都通过 secrets 方式引用，需要在对应仓库中创建这些 secret。

![][github-secret-config]



## 3. 测试

随便修改点内容，执行提交

```bash
echo hello > tmp.txt
git add . 
git commit -m "test action"
```

然后打开 github action 页面查看，可以看到已经在执行了

![][github-actions]

点开可以查看执行日志

![][github-action-detail]



到此，整个配置就完成了，具体细节可以参考 [这个仓库](https://github.com/lixd/lixd.github.io)



[github-secret-config]:https://github.com/lixd/blog/raw/master/images/blogutil/github-secret-config.png

[github-actions]:https://github.com/lixd/blog/raw/master/images/blogutil/github-actions.png

[github-action-detail]:https://github.com/lixd/blog/raw/master/images/blogutil/github-action-detail.png
