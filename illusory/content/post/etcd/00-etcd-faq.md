---
title: "etcd教程(零)---etcd使用过程中遇到的问题"
description: "主要记录了etcd的使用过程中遇到的问题及其解决方案"
date: 2019-09-01
draft: false
categories: ["etcd"]
tags: ["etcd"]

---

本文主要记录了etcd的使用过程中遇到的问题及其解决方案。

<!--more-->



## 1. 空间不足

### 1.1 问题描述

使用的时候报错，提示空间不足

> 但是看了下没存多少数据呀...

```shell
Server register error: etcdserver: mvcc: database space exceeded
```

### 1.2 原因分析

前几章说了etcd采用的是MVCC来进行多版本并发控制，会存储数据的每一次变化，如果不进行压缩(删除)则空间会越变越大。

> 1条数据修改了1W次就相当于存了1W条记录。

### 1.3 解决方案

etcd 默认不会自动 compact，需要设置启动参数，或者通过命令进行compact，如果变更频繁建议设置，否则会导致空间和内存的浪费以及错误。

**etcd v3 的默认的 backend quota 2GB**，如果不 compact，boltdb 文件大小超过这个限制后，就会报错：”Error: etcdserver: mvcc: database space exceeded”，导致数据无法写入。

命令如下：

1) 获取当前etcd数据的修订版本(revision)

```sh
rev=$(ETCDCTL_API=3 etcdctl –endpoints=:2379 endpoint status –write-out=”json” | egrep -o ‘”revision”:[0-9]*’ | egrep -o ‘[0-9]*’)
```

2) 整合压缩旧版本数据

```sh
ETCDCTL_API=3 etcdctl compact $rev
```

3) 执行碎片整理

```sh
ETCDCTL_API=3 etcdctl defrag
```

4) 解除告警

```sh
ETCDCTL_API=3 etcdctl alarm disarm
```

5) 备份以及查看备份数据信息

```sh
ETCDCTL_API=3 etcdctl snapshot save backup.db
ETCDCTL_API=3 etcdctl snapshot status backup.db
```


