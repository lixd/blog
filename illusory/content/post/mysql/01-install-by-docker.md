---
title: "MySQL教程(一)---通过docker 一键搭建 MySQL 开发环境"
description: "通过docker compose 一键搭建 MySQL 开发环境"
date: 2019-03-05 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要记录了如何通过 docker compose 一键搭建一个 MySQL 开发环境。

<!--more-->

## 1. 环境准备

首先需要安装 docker 即 docker-compose。

[具体安装步骤看这里](https://www.lixueduan.com)



然后准备一下目录结构

```shell
mysql/
	--/data
	--docker-compose.yml
```

其中 data 目录用于存放 MySQL 数据。



## 2. docker-compose.yml

docker-compose.yml 具体内容如下：

```yml
version: '3.1'
services:
  db:
   	# 默认会拉最新的镜像
    image: mysql:latest
    restart: always
    environment:
    	# 指定 root 账户密码 开发环境就随便设置了一个
      MYSQL_ROOT_PASSWORD: 123456
    command:
      --default-authentication-plugin=mysql_native_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_general_ci
      --explicit_defaults_for_timestamp=true
      --lower_case_table_names=1
    ports:
      - 3306:3306
    volumes:
      - ./data:/var/lib/mysql
```

默认安装的 MySQL 最新版本,需要其他版本的话请自行修改镜像。

[更多`docker-compose.yml`点击这里](https://github.com/lixd/ymls)

## 3. 启动

真·一键启动

```shell
# -d 参数指定后台启动 也可以不加
docker-compose up -d
```

