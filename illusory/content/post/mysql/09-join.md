---
title: "MySQL教程(九)---MySQL几种JOIN算法"
description: "MySQL中几种JOIN算法的简单分析"
date: 2020-08-10 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要记录了 MySQL的JOIN语句的NLJ、BLJ和MySQL8.0新增的Hash Join算法，及相关优化如MRR、BKA等，最后回答了到底能不能使用JOIN，驱动表又该如何选择等问题。

<!--more-->

## 1.概述

join语句常见算法为NLJ、BNL和MySQL8.0新增的Hash Join，同时也会使用到MRR和BKA优化。

然后是两个问题

* 1）到底该不该使用join？
* 2）如果用那么驱动表又该如何选择？

## 2. join算法

### 1. Index Nested-Loop Join（NLJ）

NLJ算法跟我们写程序时的嵌套查询类似，并且可以用上**被驱动表的索引**，所以我们称之为“Index Nested-Loop Join”，简称 NLJ。

假设为如下查询语句

```mysql
# 被驱动表表t2 a列上有索引
select * from t1 straight_join t2 on (t1.a=t2.a);
```

NLJ具体执行过程如下：

* 1）从表 t1 中读入一行数据 R
* 2）从数据行 R 中，取出 a 字段到表 t2 里去查找
* 3）取出表 t2 中满足条件的行，跟 R 组成一行，作为结果集的一部分
* 4）重复执行步骤 1 到 3，直到表 t1 的末尾循环结束

如果不使用 join 又该如何手动实现呢：

* 1）执行select * from t1，查出表 t1 的所有数据
* 2）循环遍历这 100 行数据：
  * 从每一行 R 取出字段 a 的值 $R.a
  * 执行select * from t2 where a=$R.a
  * 把返回的结果和 R 构成结果集的一行。

整个过程中扫描行数一致，但是总共执行了 101 条语句，比直接 join 多了 100 次交互。除此之外，客户端还要自己拼接 SQL 语句和结果。

**到底该不该使用join？**

可以看到，在**被驱动表可以使用索引**的情况下，使用join效率比手动实现更高。

**如何选择驱动表？**

在这个 join 语句执行过程中，驱动表是走全表扫描，而被驱动表是走树搜索，所以应该让小表来做驱动表。

> 假设被驱动表行数为M，需要先走二级索引，在走主键索引，时间复杂度为2*log2M
>
> 假设驱动表的行数是 N，执行过程就要扫描驱动表 N 行，然后对于每一行，到被驱动表上匹配一次
>
> 因此整个执行过程，近似复杂度是 N + N*2*log2M
>
> 显然，N 对扫描行数的影响更大，因此应该让小表来做驱动表



### 2. Simple Nested-Loop Join

如果查询字段上没有索引，MySQL 还会用前面同样的算法吗?

如果表t1,t2分别都有10万行，无法走索引那么一共需要扫描10万*10万行。

这就是Simple Nested-Loop Join 算法，虽然看起来结果是正确的，但是效率太低了。

当然，MySQL 也没有使用这个 Simple Nested-Loop Join 算法，而是使用了另一个叫作“Block Nested-Loop Join”的算法，简称 BNL



### 3. Block Nested-Loop Join(BNL)

由于Simple Nested-Loop Join 算法实在太笨了，所以MySQL对其进行了优化，就是这里的BLJ算法。

具体流程如下：

* 1）把表 t1 的数据读入线程内存 join_buffer 中，由于我们这个语句中写的是 select *，因此是把整个表 t1 放入了内存；
* 2）扫描表 t2，把表 t2 中的每一行取出来，跟 join_buffer 中的数据做对比，满足 join 条件的，作为结果集的一部分返回

>  同样需要扫描两个表，但是比较操作是在内存中比较，速度上会快很多，性能也更好

如果表t1实在太大了，内存都放不下则会进行`分段`处理,一块一块的加载到内存中，所以叫 Block Nested-Loop Join。

* 1）扫描表 t1，顺序读取数据行放入 join_buffer 中，只放了一部分 join_buffer 就满了，继续第 2 步；
* 2）扫描表 t2，把 t2 中的每一行取出来，跟 join_buffer 中的数据做对比，满足 join 条件的，作为结果集的一部分返回
* 3）清空 join_buffer；
* 4）继续扫描表 t1，顺序读取后续的数据放入 join_buffer 中，继续执行第 2 步。



**驱动表选择？**

可以看到，驱动表被分成多少块，被驱动表就会被扫描多少次，所以还是推荐小表做驱动表，以减少被驱动表的扫描次数。

### 4. Hash join

MySQL8.0中新增了Hash join方式，不过**只能用于等值连接**。

Hash join 不需要索引的支持。大多数情况下，hash join 比之前的 BNL 算法在没有索引时的等值连接更加高效。

具体步骤：

* 1）把把驱动表相关字段存入Join Buffer，这一步和BNL套路相同。
* 2）（build）把Join Buffer中对应的字段值生成一个散列表，保存在内存中。
* 3）（probe）扫描被驱动表，对被驱动表中的相关字段进行散列并比较。

在最好的场景下，如果Join Buffer能覆盖驱动表所有相关字段，那么在查询的过程中驱动表和被驱动表都只需要扫描一次，如果散列算法够好，比较次数也只是被驱动表的记录数。

> 在MySQL8.0以后优化器会优先选择使用hash join。

## 3. 问题

### 1. 可以用join吗？

* 1）如果可以使用 NLJ 算法，也就是说可以用上被驱动表上的索引，其实是没问题的,当然了Hash join也是可以的。
* 2）如果使用 BNL 算法，扫描行数就会过多。尤其是在大表上的 join 操作，这样可能要扫描被驱动表很多次，会占用大量的系统资源。所以这种 join 尽量不要用。

> 所以你在判断要不要使用 join 语句时，就是看 explain 结果里面，Extra 字段里面有没有出现“Block Nested Loop”字样。



### 2. 如何选择驱动表？

根据前面的分析可以发现，不管是NLJ算法还是BLJ算法，都是**推荐使用小表来做驱动表**。

**那么如何确定小表呢？**

并不是表的数据量小就是小表，而是**应该是两个表按照各自的条件过滤，过滤完成之后，计算参与 join 的各个字段的总数据量，数据量小的那个表，就是“小表”**，应该作为驱动表。



## 4. join相关优化

### 1. Multi-Range Read

夺命三连

**What**

MRR是一种将查询时的随机读转为顺序读的优化手段。

**Why**

那当然是磁盘的随机读比顺序读慢嘛。

我们都知道对除Id以外字段做范围查询时先走二级索引（如果有索引），然后根据主键id去主键索引树一条条查找，这个过程也叫做回表。

主键索引是按主键顺序排的，但是按二级索引范围查询出来的结果，主键不一定是顺序排列的，大多数情况下都是乱序的。

所以对主键索引来说每次查询都是随机读。

**How**

举个栗子

优化前：

* 1）根据查询条件在二级索引树中找到主键id；
* 2）去主键索引根据id找到对应数据；
* 3）重复步骤12直到查询出所有满足条件的行；

优化后：

* 1）根据二级索引，定位到满足条件的记录，将 id 值放入 read_rnd_buffer 中 ; 
* 2）将 read_rnd_buffer 中的 id 进行递增排序；
* 3）根据排序后的 id 数组，依次到主键 id 索引中查记录，并作为结果返回；

可以看到主要就是将id暂时存在到read_rnd_buffer 中，将其排序后再去主键索引中查询。

### 2. Batched Key Access

**What**

这个 BKA 算法，其实就是对 NLJ 算法的优化，因为NLJ是先在驱动表中取一条数据然后去被驱动表中匹配的。

这样的话就用不了前面的MRR优化了。

**Why**

虽然NLJ因为可以用到被驱动表的索引，效率不错，但还是有进一步优化的空间，BKA算法则是对其的一个优化，

使得优化后的NLJ也可以用到MRR。

**How**

优化前：

从驱动表 t1，一行行地取出 a 的值，再到被驱动表 t2 去做 join。也就是说，对于表 t2 来说，每次都是匹配一个值。这时，MRR 的优势就用不上了

优化后：

先把表 t1 的数据取出来一部分，先放到一个临时内存 join_buffer中，这样就可以使用MRR进行优化了，将这部分数据排好序后再去t2中查询。

>  该算法需要手动开启，命令如下 
>
> ```mysql
> set optimizer_switch='mrr=on,mrr_cost_based=off,batched_key_access=on';
> ```



## 5. 参考

`MySQL45讲`

`https://dev.mysql.com/doc/refman/8.0/en/nested-loop-joins.html`

`https://dev.mysql.com/doc/refman/8.0/en/hash-joins.html`

`https://dev.mysql.com/doc/refman/8.0/en/mrr-optimization.html`

`https://dev.mysql.com/doc/refman/8.0/en/bnl-bka-optimization.html`

`https://blog.csdn.net/horses/article/details/102690076`