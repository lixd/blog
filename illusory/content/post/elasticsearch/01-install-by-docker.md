---
title: "Elasticsearch教程(一)--使用docker-compose快速搭建 elasticsearch"
description: "elasticsearch 开发环境搭建"
date: 2020-03-20 22:00:00
draft: false
tags: ["elasticsearch"]
categories: ["elasticsearch"] 
---

本文主要记录了 Elasticsearch、Kibana 的安装部署流程，及其目录简单介绍。同时也记录了 Elasticsearch 分词器的安装即介绍等。

<!--more-->

## 1. 概述

**Elasticsearch** 是一个分布式的**开源搜索和分析引擎**，在 Apache Lucene 的基础上开发而成。以其简单的 REST 风格 API、分布式特性、速度和可扩展性而闻名，是 Elastic Stack 的核心组件

> ELK 中的 E

**Kibana**是一个针对 Elasticsearch 的**开源分析及可视化平台**，用来搜索、查看交互存储在Elasticsearch 索引中的数据。使用 Kibana，可以通过各种图表进行高级数据分析及展示。

> ELK 中的 K

Logstash TODO

## 2. Docker 安装

使用 docker-compose 一键安装

> docker-compose 安装 [看这里](https://www.lixueduan.com/categories/Docker/)

### 0. 环境准备

调整用户 mmap 计数,否则启动时可能会出现内存不足的情况

```shell
# 查看当前限制
$ sysctl vm.max_map_count
vm.max_map_count = 65530
```

临时修改 - 不需要重启

```shell
[root@iZ2zeahgpvp1oasog26r2tZ vm]# sysctl -w vm.max_map_count=262144
vm.max_map_count = 262144
```

永久修改 - 需要重启

```shell
vi /etc/sysctl.cof
# 增加 如下内容
vm.max_map_count = 262144
```

同时需要提前创建相关目录,大概结构是这样的

```shell
es/
  /data
  /logs
  /plugins
   --es.yml
   --cerebro.yml
   --kibana.yml
```

手动创建一个 docker 网络

```shell
$ docker network create elk
```

同时需要创建对应目录并授予访问权限。

### 1. Elasticsearch

```yml
# es.yml
version: '3.2'
services:
  elasticsearch:
    image: elasticsearch:7.8.0
    container_name: elk-es
    restart: always
    environment:
      # 开启内存锁定
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      # 指定单节点启动
      - discovery.type=single-node
    ulimits:
      # 取消内存相关限制  用于开启内存锁定
      memlock:
        soft: -1
        hard: -1
    volumes:
      - ./data:/usr/share/elasticsearch/data
      - ./logs:/usr/share/elasticsearch/logs
      - ./plugins:/usr/share/elasticsearch/plugins
    ports:
      - 9200:9200

networks:
  default:
    external:
      name: elk
```

启动命令

```shell
$ docker-compose -f es.yml up
```



### 2. cerebro

cerebro 是一个简单的 ES 集群监控工具

```yml
# cerebro.yml
version: '3.2'
services:
  cerebro:
    image: lmenezes/cerebro:0.9.2
    container_name: cerebro
    restart: always
    ports:
      - "9000:9000"
    command:
      - -Dhosts.0.host=http://elk-es:9200

networks:
  default:
    external:
      name: elk
```

```shell
$ docker-compose -f cerebro .yml up
```



### 3. Kibana

```yml
# kibana.yml
version: '3.2'
services:
  kibana:
    image: kibana:7.8.0
    container_name: elk-kibana
    restart: always
    environment:
      ELASTICSEARCH_HOSTS: http://elk-es:9200
      I18N_LOCALE: zh-CN
    ports:
      - 5601:5601

networks:
  default:
    external:
      name: elk
```

```shell
$ docker-compose -f kibana.yml up
```

## 3. 分词器

### 1. 安装

分词器安装很简单，一条命令搞定

```shell
./elasticsearch-plugin install {分词器的下载地址}
```

比如安装 ik 分词器

```shell
./elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v7.8.0/elasticsearch-analysis-ik-7.8.0.zip
```

常用分词器列表

* ​	IK 分词器 `https://github.com/medcl/elasticsearch-analysis-ik`
* 拼音分词器 `https://github.com/medcl/elasticsearch-analysis-pinyin`



**分词器版本需要和elasticsearch版本对应，并且安装完插件后需重启Es，才能生效**

**分词器版本需要和elasticsearch版本对应，并且安装完插件后需重启Es，才能生效**

**分词器版本需要和elasticsearch版本对应，并且安装完插件后需重启Es，才能生效**

插件安装其实就是下载 zip 包然后解压到 plugins 目录下。

Docker 安装的话可以通过 Volume 的方式放在宿主机，或者进入容器用命令行安装也是一样的。

> 比如前面创建的 plugins 目录就是存放分词器的，Elasticsearch 启动时会自动加载 该目录下的分词器。

### 2. 测试 

在 Kibana 中通过 Dev Tools 可以方便的执行各种操作。

```shell
#ik_max_word 会将文本做最细粒度的拆分
#ik_smart 会做最粗粒度的拆分
#pinyin 拼音
POST _analyze
{
  "analyzer": "ik_max_word",
  "text": ["剑桥分析公司多位高管对卧底记者说，他们确保了唐纳德·特朗普在总统大选中获胜"]
} 
```

