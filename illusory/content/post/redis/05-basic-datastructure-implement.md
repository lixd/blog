---
title: "Redis教程(五)---Redis 数据类型"
description: "Redis数据类型及其底层数据结构"
date: 2020-12-05 22:00:00
draft: false
tags: ["Redis"]
categories: ["Redis"]
---

Redis 为什么快？一方面是因为它是内存数据库，所有操作都在内存上完成自然很快。另一方面就要归功于它的数据结构。

<!--more-->

## 1. 概述

Redis 包含 5 大基本数据类型

1. String（字符串）
2. List（列表）
3. Hash （哈希）
4. Set（集合）
5. Sorted Set（有序集合）

当然这些只是 Redis 键值对中值的数据类型，也就是数据的保存形式。

具体底层实现如下

1. 简单动态字符串
2. 双向链表
3. 压缩列表
4. 哈希表
5. 跳表
6. 整数数组

二者对应关系如下图所示：

![data-type-structure][data-type-structure]



可以看到除了 String 之外，其他数据类型都有两个底层数据结构实现，这是因为 Redis 为了**节省内存**，会根据数据量大小来选择不同的数据结构。

> String 也会根据数据长度使用不同的编码方式。

## 2. 底层数据类型

**整数数组**

数组优点是**访问快**，通过下标访问元素快 ，只需要 O(1) 时间复杂度,但是**增删慢**，增删元素时却需要移动前或后的所有元素，需要 O(n) 时间复杂度。

**双向链表**

链表和数组恰好相反。

**增删快**，只需要修改节点指针即可，O(1) 时间复杂度。**访问慢**，只能通过遍历来访问指定元素，需要 O(n) 时间复杂度。

**跳表**

有序链表只能逐一查找元素，导致操作起来非常缓慢，于是就出现了跳表。

**跳表在链表的基础上，增加了多级索引**，通过索引位置的几个跳转，实现数据的快速定位。

> 空间换时间 优化了操作的时间复杂度

经过优化后访问从链表的 O(n) 时间复杂度提升到了 O(logn)，增删也因为需要维护多级索引，从 O(1) 降低到了 O(logn)。

**哈希表**

哈希表读写都可以通过哈希值直接找到对应元素，只需要O(1) 时间复杂度。但是哈希表最大问题是**无法范围查询**。



**压缩列表**

相比之下压缩列表是比较少见的一一种数据结构，具体实现如下：

表头有三个字段 zlbytes、zltail 和 zllen，分别表示列表长度、列表尾的偏移量和列表中的 entry 个数,表尾还有一个 zlend，表示列表结束。

![ziplist][ziplist]

可以看到各个元素都紧凑的挨在一起，**内存利用率极高**。

定位第一个或最后一个元素，只需要通过表头的 3 个字段即可找到，O(1) 时间复杂度，其他元素则只能遍历整个列表，O(n) 时间复杂度。

## 3. 详解

### 1. String

在Redis内部String对象的编码可以是 `int` 、 `raw` 或者 `embstr`

**int**

如果一个字符串对象保存的是整数值， 并且这个整数值可以用 `long` 类型来表示， 那么字符串对象会将整数值保存在字符串对象结构的 `ptr`属性里面（将 `void*` 转换成 `long` ）， 并将字符串对象的编码设置为 `int` 。

![string-int][string-int]

**raw**

如果字符串的长度大于 `44` 字节， 那么字符串对象将使用一个简单动态字符串（SDS）来保存这个字符串值， 并将对象的编码设置为 `raw` 。

![string-raw][string-raw]



**embstr**

如果这个字符串值的长度小于等于 `44` 字节， 那么将使用 `embstr` 编码的方式来保存这个字符串值。

`embstr` 编码是专门用于保存短字符串的一种优化编码方式， 这种编码和 `raw` 编码一样， 都使用 `redisObject` 结构和 `sdshdr` 结构来表示字符串对象， 但 `raw` 编码会调用两次内存分配函数来分别创建 `redisObject` 结构和 `sdshdr` 结构， 而 `embstr` 编码则通过调用一次内存分配函数来分配一块连续的空间， 空间中依次包含 `redisObject` 和 `sdshdr` 两个结构，

![string-embstr][string-embstr]

> long double 类型的浮点数在 Redis 中也是作为字符串值来保存的： 如果我们要保存一个浮点数到字符串对象里面， 那么程序会先将这个浮点数转换成字符串值， 然后再保存起转换所得的字符串值。



**为什么是44字节？**

embstr 是一块连续的内存区域，由 redisObject 和 sdshdr 组成。其中 redisObject 占16个字节，当 buf 内的字符串长度是 44 时，sdshdr 的大小为 3+44+1=48，(3 为 sdshdr 的元数据，1则是 '\0' 44 为真正的数据)，加起来刚好 64。

Redis 默认使用 Jemalloc 分配内存。jemalloc 会分配 8，16，32，64 等大小的内存。embstr 最小为 16+3+1=20，分配32字节的话，只能存12字节的数据，有点小了，所以按照 64 字节来算，当字符数小于 44 时，64 字节依然够用。这个默认 44 就是这样来的。

> 3.2 版本之前是 39，sdshdr 中的 3 字节以前是8字节。`https://blog.csdn.net/XiyouLinux_Kangyijie/article/details/78045385`

### 2. Hash

在 Redis 内部 Hash 对象的编码可以是 `ziplist`和`hashtable`

数据量小的时候使用 ziplist 节省空间，数据量大的时候用 hashtable 以降低操作复杂度。

**ziplist**

`ziplist` 编码的哈希对象使用压缩列表作为底层实现， 每当2有新的键值对要加入到哈希对象时， 程序会先将保存了键的压缩列表节点推入到压缩列表表尾， 然后再将保存了值的压缩列表节点推入到压缩列表表尾， 因此：

- 保存了同一键值对的两个节点总是紧挨在一起， 保存键的节点在前， 保存值的节点在后；
- 先添加到哈希对象中的键值对会被放在压缩列表的表头方向， 而后来添加到哈希对象中的键值对会被放在压缩列表的表尾方向。



![hash-ziplist-obj][hash-ziplist-obj]


![hash-ziplist-item][hash-ziplist-item]



**hashtable**

`hashtable` 编码的哈希对象使用字典作为底层实现， 哈希对象中的每个键值对都使用一个字典键值对来保存：

- 字典的每个键都是一个字符串对象， 对象中保存了键值对的键；
- 字典的每个值都是一个字符串对象， 对象中保存了键值对的值。

![hash-hashtable][hash-hashtable]



**编码转换**

当哈希对象可以同时满足以下两个条件时， 哈希对象使用 `ziplist` 编码：

1. 哈希对象保存的所有键值对的键和值的字符串长度都小于 `64` 字节；
2. 哈希对象保存的键值对数量小于 `512` 个；

不能满足这两个条件的哈希对象需要使用 `hashtable` 编码。

>  注意：同样的上限值是可以修改的，具体请看配置文件中关于 `hash-max-ziplist-value` 选项和 `hash-max-ziplist-entries` 选项的说明。



### 3. List

在Redis内部List对象的编码可以是`ziplist`和`linkedlist`。

数据量小的时候使用 ziplist 节省空间，数据量大的时候用 linkedlist 降低操作复杂度。

**ziplist**

`ziplist` 编码的列表对象使用压缩列表作为底层实现， 每个压缩列表节点（entry）保存了一个列表元素。

![list-ziplist][list-ziplist]



**linkedlist**

 `linkedlist` 编码的列表对象使用双端链表作为底层实现， 每个双端链表节点（node）都保存了一个字符串对象， 而每个字符串对象都保存了一个列表元素。

![list-linkedlist][list-linkedlist]



**编码转换**

当列表对象可以同时满足以下两个条件时， 列表对象使用 `ziplist` 编码：

1. 列表对象保存的所有字符串元素的长度都小于 `64` 字节；
2. 列表对象保存的元素数量小于 `512` 个；

不能满足这两个条件的列表对象需要使用 `linkedlist` 编码。

> 注意：同样的上限值是可以修改的， 具体请看配置文件中关于 `list-max-ziplist-value` 选项和 `list-max-ziplist-entries` 选项的说明。



### 4. Set

在Redis内部Set对象的编码可以是`intset(整数集合)`和`hashtable(字典)`。

**intset**

`intset` 编码的集合对象使用整数集合作为底层实现， 集合对象包含的所有元素都被保存在整数集合里面。

![intset][intset]

**hashtable**

`hashtable` 编码的集合对象使用字典作为底层实现， 字典的每个键都是一个字符串对象， 每个字符串对象包含了一个集合元素， 而字典的值则全部被设置为 `NULL`



![hashtable][hashtable]

**编码转换**

当集合对象可以同时满足以下两个条件时， 对象使用 `intset` 编码：

1. 集合对象保存的所有元素都是整数值；
2. 集合对象保存的元素数量不超过 `512` 个；

不能满足这两个条件的集合对象需要使用 `hashtable` 编码。

>注意:第二个条件的上限值是可以修改的， 具体请看配置文件中关于 `set-max-intset-entries` 选项的说明。



### 5. ZSet

在 Redis 内部 Set 对象的编码可以是`ziplist`或者`skiplist`。

其中`skiplist`编码由`skiplist`和`hashtable`一起实现。

**ziplist**

`ziplist` 编码的有序集合对象使用压缩列表作为底层实现， 每个集合元素使用两个紧挨在一起的压缩列表节点来保存， 第一个节点保存元素的成员（member）， 而第二个元素则保存元素的分值（score）。

压缩列表内的集合元素按分值从小到大进行排序， 分值较小的元素被放置在靠近表头的方向， 而分值较大的元素则被放置在靠近表尾的方向。

![ziplist-obj][ziplist-obj]


![ziplist-item][ziplist-item]

**skiplist**

`skiplist` 编码的有序集合对象使用 `zset` 结构作为底层实现， 一个 `zset` 结构同时包含一个字典和一个跳跃表

```c
typedef struct zset {

    zskiplist *zsl;

    dict *dict;

} zset;
```

`zset` 结构中的 `zsl` 跳跃表按分值从小到大保存了所有集合元素， 每个跳跃表节点都保存了一个集合元素： 跳跃表节点的 `object` 属性保存了元素的成员， 而跳跃表节点的 `score` 属性则保存了元素的分值。

**通过这个跳跃表， 程序可以对有序集合进行范围型操作**， 比如 ZRANK 、ZRANGE 等命令就是基于跳跃表 API 来实现的。

除此之外， `zset` 结构中的 `dict` 字典为有序集合创建了一个从成员到分值的映射， 字典中的每个键值对都保存了一个集合元素： 字典的键保存了元素的成员， 而字典的值则保存了元素的分值。

 **通过这个字典， 程序可以用 O(1) 复杂度查找给定成员的分值**， ZSCORE 命令就是根据这一特性实现的

两种数据结构都会通过指针来共享相同元素的成员和分值， 所以同时使用跳跃表和字典来保存集合元素不会产生任何重复成员或者分值， 也不会因此而浪费额外的内存。

 `skiplist` 编码的有序集合对象会是下图(8-16)所示的样子

![skiplist-obj][skiplist-obj]

 而对象所使用的 `zset` 结构将会是图 8-17 所示的样子。

![skiplist-item][skiplist-item]

**为什么 skiplist 编码要用两种数据结构来实现?**

虽然只用字典或者跳跃表也可以实现，但是会丢失掉另一个数据结构的特性。

假设只有字典,那么只需范围操作时需要对数据进行排序处理，至少需要 O(NlogN) 复杂度和 O(N) 的空间。

如果只有跳跃表则根据 key 获取 score 这一操作复杂度将从 O(1) 提升到 O(logN)。

所以最终选择了字典和跳跃表一起实现。



**编码转换**

当有序集合对象可以同时满足以下两个条件时， 对象使用 `ziplist` 编码：

1. 有序集合保存的元素数量小于 `128` 个；
2. 有序集合保存的所有元素成员的长度都小于 `64` 字节；

不能满足以上两个条件的有序集合对象将使用 `skiplist` 编码。

> 注意：同样的上限值是可以修改的，具体请看配置文件中关于 `zset-max-ziplist-entries` 选项和 `zset-max-ziplist-value` 选项的说明。

## 4. 小结

### 1. 操作复杂度

**1.单元素操作是基础**

* 指每一种集合类型对单个数据实现的增删改查操作
* 这些操作的**复杂度由集合采用的数据结构决定**

**2.范围操作非常耗时**

* 指集合类型中的遍历操作，可以返回集合中的所有数据
* 这类操作的复杂度一般是 O(N)，比较耗时，我们应该尽量避免
* 建议使用SCAN系列命令，实现了渐进式遍历，每次只返回有限数量的数据，避免阻塞Redis

**3.统计操作通常高效**

* 指集合类型对集合中所有元素个数的记录
* 例如 LLEN 和 SCARD。这类操作复杂度只有 O(1)
* 这是因为当集合类型采用压缩列表、双向链表、整数数组这些数据结构时，这些结构中专门记录了元素的个数统计

**4.例外情况只有几个**

* 指某些数据结构的特殊记录
* 例如压缩列表和双向链表都会记录表头和表尾的偏移量
* 这样一来，对于 List 类型的 LPOP、RPOP、LPUSH、RPUSH 这四个操作来说，它们是在列表的头尾增删元素，这就可以通过偏移量直接定位，复杂度只有O(1)



### 2. Redis为什么快

1. String、Hash 和 Set使用哈希表实现，复杂度 O(1)

2. SortedSet 也使用跳表进行优化，复杂度 O(logn)

3. List采用压缩列表加双向链表则比较慢 O(n)  复杂度,但是 Push、Pop 等对表头尾元素的操作效率很高，所以需要因地制宜的使用 List,将它主要用于 FIFO 队列场景，而不是作为一个可以随机读写的集合。



## 5. 参考

`《Redis 设计与实现》`

`Redis 核心技术实战`



[data-type-structure]: https://github.com/lixd/blog/raw/master/images/redis/data-structure/data-type-structure.png
[ziplist]: https://github.com/lixd/blog/raw/master/images/redis/data-structure/ziplist.png

[string-int]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/string-int.png
[string-raw]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/string-raw.png
[string-embstr]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/string-embstr.png

[hash-ziplist-obj]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/hash-ziplist-obj.png
[hash-ziplist-item]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/hash-ziplist-item.png
[hash-hashtable]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/hash-hashtable.png

[list-ziplist]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/list-ziplist.png
[list-linkedlist]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/list-linkedlist.png

[intset]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/intset.png
[hashtable]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/hashtable.png

[ziplist-obj]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/ziplist-obj.png
[ziplist-item]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/ziplist-item.png
[skiplist-obj]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/skiplist-obj.png
[skiplist-item]:https://github.com/lixd/blog/raw/master/images/redis/data-structure/skiplist-item.png
