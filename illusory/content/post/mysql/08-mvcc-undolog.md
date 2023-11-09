---
title: "MySQL教程(八)---MVCC与undolog"
description: "MySQL MVCC与undolog简要分析"
date: 2020-04-10 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要对 MySQL 的 MVCC 和 undolog 做了简要分析。包括 undolog 是如何做到回滚的，MVCC 一致性读又是如何实现的等等。

<!--more-->

## 1. undolog

MySQL 中 undolog 是 MVCC 技术实现的重要组成部分，一致性读功能也需要用到 undolog。当然，更重要的一点就是用于回滚。如事务执行失败后，通过 undolog 进行回滚恢复到之前的状态。

### 1. 内容

undolog 是一个链表结构。

每次对数据进行 INSERT、UPDATE（DELETE） 时，都会将**旧数据**存储到 undolog 中。然后在数据行中修改字段`DB_ROLL_PTR` 指向对应的 undolog，以便在需要时查询到之前的数据。

> 可以认为当delete一条记录时，undo log中会记录一条对应的insert记录，反之亦然，当update一条记录时，它记录一条对应相反的update记录。

### 2. 存储

InnoDB 存储引擎对 undolog 的管理采用段的方式。

undolog records 存储于 undolog  segment 中，undolog segment 又存储在 rollback segment 中，rollback segment 则存放在 undo tablespace 中（MySQL5.6之前是在 system tablespace）。

> 如果是 临时表的 undolog 则会存放在  global temporary tablespace 中。

另外，undo log也会产生 redo log，因为 undo log 也需要实现持久性保护。

> 对于 INSERT 操作的 undolog，在事务提交后就可以删除了。因为这是第一个版本所以并不需要存储旧数据。
>
> 而对于 UPDATE（DELETE） 操作则提交后也不能删除（可能其他事务的一致性读还在用这个 undolog），需要存储直到没有与之关联的快照事务时才能删除。
>
> 其中 DELETE 操作会先打上删除标记，然后由 purge 线程来删除。

### 3. 并发事务数限制

同时还有很重要的一点就是，**一个 undolog segment 只能同时被一个事务使用**。也就是说 InnoDB 存储引擎的并发事务数还会受到 undolog segment 数量限制。

那么  undolog segment 数量到底有多少呢？

公式如下：

```mysql
(innodb_page_size / 16) * innodb_rollback_segments * number of undo tablespaces
```

* 1）**undo tablespace**

 undo tablespace 默认是 2（MySQL8.0）,可以通过如下语法进行增删

```mysql
# 增加 名字比较是 xxx.ibu
CREATE UNDO TABLESPACE tablespace_name ADD DATAFILE 'file_name.ibu';
# 删除（需要先设置为不活跃状态）
ALTER UNDO TABLESPACE tablespace_name SET INACTIVE;
DROP UNDO TABLESPACE tablespace_name;
```

* 2）**rollback segment**

rollback segment 由参数`innodb_rollback_segments` 设置，每个 undo tablespace 最大支持 128 个 rollback segment。

* 3）**undolog segment**

undolog segment  个数则由 InnoDB PageSize 决定，具体为 `pagesize / 16`,所以默认 pagesize 16K 能存储 1024 个undolog segment 。

> 需要注意的是，执行 INSERT 操作会占用一个 undolog segment，如果同时还执行 UPDATE（UPDATE、DELETE）则还会占用一个。



## 2. MVCC

Multi-Version Concurrency Control 多版本并发控制。MVCC 是一种并发控制的方法，一般在数据库管理系统中，实现对数据库的并发访问；在编程语言中实现事务内存。

> 通过存储多版本数据来减少并发控制中锁的使用，以提升性能，适合读多写少的场景。

MySQL 中的 MVCC 是 InnoDB 存储引擎实现的。通过 MVCC 技术，InnoDB 存储引擎可以同时执行对同一记录的读操作和写操作，而不需要等写操作释放锁，极大增加并发性。

### 1. 实现

InnoDB 存储引擎在数据的每一行中都增加了 3 个**隐藏字段**用于存储必要数据。

* 1）`DB_TRX_ID`  -- 6 字节，记录最后`插入`或`更新`该行时的 事务 Id（`删除`操作在内部被看做 `更新`，内部只是更新了该记录的删除标志位）。
* 2）`DB_ROLL_PTR`  --7字节，回滚指针，指向对应的 undolog ，用于撤销操作
* 3）`DB_ROW_ID`  --6字节，主键Id，如果建表时显式指定了主键则不会出现该行。

### 2. 回滚

对应 InnoDB 存储引擎来说用户操作只有以下两种情况：

* 1）**INSERT**--插入一行数据，该行数据 `DB_TRX_ID` 的值就是插入这条数据的事务Id，`DB_ROLL_PTR`此时还是空的。
* 2）**UPDATE**--修改（删除）该行数据，`DB_TRX_ID`  则更新为当前事务Id，同时把修改之前的数据（只记录有更新的字段）写入到 undolog，`DB_ROLL_PTR`则指向 undolog 对应位置。

回滚时通过字段`DB_ROLL_PTR`找到 undolog 中记录的旧数据回滚即可。

### 3. 一致性读

**undolog 中记录了这么多个版本，查询时到底查哪个版本？**

在 InnoDB 中，开启一个新事务的时候，会创建一个` read_view（读视图）`，由**查询时所有活跃（即未提交）事务的Id数组**（将其中最小的记作 min_id）和**当前已创建的最大事务Id**（记作max_id）组成。

> 需要注意的是：最大事务Id并不是活跃事务中Id最大的那个。
>
> read_view是针对全表的，session级别的。例如在查询A表时会生成一个read_view，然后在同一个session中查询B表会使用前面生成的readview，不会针对B表生成新的。

假设当前事务Id为 trx_id ，版本链比较规则如下：

* 1）如果（trx_id<min_id）-- 表示这个版本事务已提交，数据可见
* 2）如果（min_id<=trx_id<=max_id）
  * 情况1：若 trx_id 不在数组中，表示这个版本是有已经提交的事务生成的（后续解释），数据可见。
  * 情况2：如果trx_id不在id数组中，说明是由还未提交的事务生成的，数据不可见
* 3）如果（max_id<trx_id）-- 表示这个版本是由将来（这里的将来是相对于当前事务来说的）启动的事务生成的，数据肯定不可见。

对于情况二解释如下：

MySQL 中的事务 Id 是自增的数字，所以数字大小可以判断事务的开始先后，但是不能判断提交先后。所以情况二中如果不在活跃事务列表说明这个事务虽然是后创建的但是已经先提交了。

**所以查询时就根据这个规则，顺着版本链，把不可见的过滤掉，出现的第一个可见数据就是结果。**

具体源码看这里

> `https://github.com/facebook/mysql-5.6/blob/42a5444d52f264682c7805bf8117dd884095c476/storage/innobase/include/read0read.h#L125`



## 3. 小结

* 1）InnoDB 存储引擎中，每次修改记录都会在 undolog 中存储旧数据。
* 2）MySQL 真正数据表中只存最新版本记录，同时除了第一次插入的时候，其他情况 roll_ptr 都会有值。
* 3）历史版本数据都在 undolog 中，所以可以根据 roll_ptr 字段在 undolog 中找到多个版本数据。
* 4）当 undolog 不会被用到时会被移除。

## 4. 参考

`https://dev.mysql.com/doc/refman/8.0/en/innodb-multi-versioning.html`

`https://dev.mysql.com/doc/refman/8.0/en/innodb-undo-tablespaces.html`

`http://blog.sina.com.cn/s/blog_4673e603010111ty.html`

`https://blog.csdn.net/Waves___/article/details/105295060`