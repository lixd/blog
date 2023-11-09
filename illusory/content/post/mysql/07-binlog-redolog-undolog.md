---
title: "MySQL教程(七)---redolog与binlog"
description: "MySQL redolog与binlog的简单分析"
date: 2020-04-05 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要对 MySQL 的 binlog 和 redolog 进行了详细分析，同时最后对两者进行了总结比较。

<!--more-->

## 1. 概述

MySQL 中有如下几种日志文件，分别是：

* 重做日志(redo log)
* 回滚日志(undo log)
* 二进制日志(binlog)
* 错误日志(errorlog)
* 慢查询日志(slow query log)
* 一般查询日志(general log)
* 中继日志(relay log)

其中`redolog`和`undolog` 为 InnoDB 存储引擎独有，与事务操作息息相关，`binlog`也与事务操作有一定的关系，同时对数据复制、恢复有很大帮助。

这三种日志，对理解 MySQL 中的事务操作有着重要的意义，所以有必要好好了解一下这三种日志。

## 2. redolog

### 1. 作用

**确保事务的持久性**

防止在发生故障的时间点，尚有脏页未写入磁盘导致数据丢失问题。在重启 MySQL 服务的时候，会根据 redolog 进行重做，恢复崩溃时暂未写入磁盘的数据，从而达到事务的持久性这一特性。



### 2. 内容

**redolog 是物理格式的日志，记录的是物理数据页的修改信息。**

redolog 是顺序写入 redolog file 的物理文件中去的。

当更新一条数据时，InnoDB 会找到要更新的行数据，把做了什么修改写到 redolog 中，并把这行数据更新到内存中，整个过程就算完成了。

redolog file 是固定大小的（如下图），所以为了能够一直记录它只能采用循环写入方式，`write pos`为当前记录的位置，`checkpoint`为当前可以擦除的位置，代表更新的行已经完成数据库的磁盘更改,可以覆盖掉了。

![redolog-cycle-write](https://github.com/lixd/blog/raw/master/images/mysql/redolog-cycle-write.jpg)



### 3. 磁盘文件

#### 1. 产生时间

**事务开始之后**就产生 redo log，redolog 的落盘并不是随着事务的提交才写入的，而是在事务的执行过程中，就开始**逐步**写入到 redolog文件中。

#### 2. 释放时间

当对应事务的脏页写入到磁盘之后，redolog 的使命也就完成了（落盘后就不用担心数据丢失了），redolog 中对应事务占用的空间就可以重用（被覆盖）。

#### 3. 物理文件

默认情况下，对应的物理文件位于数据库的 data 目录下的`ib_logfile1`、`ib_logfile2`。

相关参数如下：

* 1）`innodb_log_files_in_group` -- 指定文件个数（默认2）
* 2）`innodb_log_file_size` -- 指定文件大小
* 3）`innodb_mirrored_log_groups ` -- 指定日志文件副本个数，主要用于保护数据（默认1）

### 4. 刷盘时间

如果每次都写入磁盘势必会对性能造成较大影响，所以 MySQL 进行了相应优化。

对于写入 redolog 文件的操作不直接刷盘，而是先写入内存中的重做日志缓冲（redolog buffer），然后根据用户设置参数（`innodb_flush_log_at_trx_commit`）来执行刷盘逻辑。

![redolog-flush](https://github.com/lixd/blog/raw/master/images/mysql/redolog-flush.png)



**第一个**刷盘逻辑用户无法调整：在**主线程**中**每秒**会将 redolog buffer 写入磁盘，不论事务是否已经提交，也不管用户指定的什么参数。

**第二个**刷盘逻辑则由参数`innodb_flush_log_at_trx_commit`控制，可选值为0、1、2三个。

* `0`--代表当 commit  时，不进行任何操作。而是等待主线程每秒进行刷盘，从LogBuffer写入到 OS Buffer并调用fsync写入磁盘上的日志文件，

* `1`--代表在 commit 时直接将  redolog buffer 同步写到磁盘；

* `2`--代表直接写入OS Buffer，但是异步写到磁盘，即不能完全保证 commit 时肯定能落盘，只是有这个动作。

所以**为了保证事务的持久性必须将`innodb_flush_log_at_trx_commit`的值设置为1**，即每当事务提交时就必须保证事务都已经写入重做日志文件，设置为其他值都可能出现事务的丢失。

## 3. binlog

### 1. 作用

* 1）**数据复制**，比如在主从复制中，从库利用主库上的 binlog 进行重播，实现主从同步。
* 2）**数据恢复**，比如基于时间点的还原。

### 2. 内容

**binlog 是逻辑格式的日志，binlog 中存储的内容称之为事件，每一个数据库更新操作(Insert、Update、Delete，不包括Select)等都对应一个事件（event）。**
简单地说 binlog 中存储的是更新数据库的 SQL 语句，但又不完全是 SQL 语句这么简单， binlog 中同时包括了用户执行的**SQL语句(增删改)的反向 SQL 语句**。

> 比如：delete 操作在 binlog 会有 delete本身和其反向的 insert 这两条记录；update 则同时存储着update执行前后的版本的信息；insert则对应着delete和insert本身的信息。
>

因此可以基于 binlog 做到类似于 oracle 的闪回功能，其实都是依赖于 binlog 中的日志记录。



### 3. 生命周期

#### 1. 产生时间

**事务提交的时候**，会**一次性**将事务中的 SQL 语句（一个事务可能对应多个 SQL 语句）按照一定的格式记录到 binlog 中。

> 这里与 redolog 很明显的差异就是 redolog 并不一定是在事务提交的时候刷新到磁盘，**redolog**是在`事务开始`之后就**逐步写入**磁盘。因此对于事务的提交，即便是较大的事务，redolog 都是很快的。

但是对 binlog 来说，较大事务的提交可能会变得比较慢一些，这是因为 **binlog** 是在`事务提交`的时候**一次性写入**的。


#### 2. 释放时间

binlog 的默认是保持时间由参数 `expire_logs_days` 控制（默认为0，即不自动移除），也就是说对于非活动的日志文件，在**生成时间**超过 expire_logs_days 配置天数之后，会被自动删除。

#### 3. 物理文件

binlog 文件存放路径由参数 `log_bin_basename` 控制，binlog 日志文件按照指定大小，当日志文件达到指定的最大的大小之后，进行滚动更新生成新的日志文件（如：binlog.0001,binlog.0002）。

> 对于每个 binlog 文件，会通过一个统一的 index（目录）文件来组织。

相关参数如下：

* 1）`log_bin_basename` -- binlog 文件存放路径
* 2）`max_binlog_size ` -- 单个 binlog 文件最大大小（默认 1G）

#### 4. 刷盘时间

事务提交时直接刷盘。

## 4. binlog 与 redolog 的区别

binlog 的作用之一是还原数据库，这与 redolog 很类似，很多人混淆过，但是两者有本质的不同。

比较主要的三个区别如下：

* 1）实现层面不同
  * redolog 是 InnoDB 引擎特有的；
  * binlog 是 MySQL 的 Server 层实现的，所有引擎都可以使用。
* 2）内容不同
  * redo log 是物理日志，记录的是 “在某个数据页上做了什么修改”；
  * binlog 是逻辑日志，记录的是这个语句的原始逻辑，比如 “在某一行的某一列上进行什么修改”。
* 3）大小不同
  * redolog 空间是固定的，只能循环写。
  * binlog 大小无限制，是可以追加写入的，达到上限后会滚动更新。



## 5. 参考

`https://dev.mysql.com/doc/refman/8.0/en/innodb-redo-log.html`

`https://www.cnblogs.com/wy123/p/8365234.html`

`https://dev.mysql.com/doc/refman/8.0/en/server-logs.html`

`https://dev.mysql.com/doc/refman/8.0/en/mysqlbinlog.html`

`https://laijianfeng.org/2019/03/MySQL-Binlog-介绍/`

`专栏 MySQL 45讲`

