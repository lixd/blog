---
title: "Redis教程(五)---Redis 数据结构"
description: "Redis数据类型及其底层实现"
date: 2020-11-15 22:00:00
draft: true
tags: ["Redis"]
categories: ["Redis"]
---

Redis 为什么快？一方面是因为它是内存数据库，所有操作都在内存上完成自然很快。另一方面就要归功于它的数据结构。

<!--more-->

## 1. 概述

Redis 基本数据类型

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

![Redis 数据类型与底层数据结构对应关系][Redis 数据类型与底层数据结构对应关系]



可以看到除了 String 之外，其他数据类型都有两个底层数据结构实现，这是因为 Redis 为了节省内存，会根据数据量大小来选择不同的数据结构。

> String 也会根据数据长度使用不同的编码方式。

## 2. 简单说明

### 1. 整数数组

数组优点是通过下标访问元素快 ，只需要 O(1) 时间复杂度,但是增删元素时却需要移动前或后的所有元素，需要 O(n) 时间复杂度。

### 2. 双向链表

链表和数组恰好相反。

链表增删元素快，只需要修改节点指针即可，O(1) 时间复杂度。链表只能通过遍历来访问指定元素，需要 O(n) 时间复杂度。

### 3. 跳表

有序链表只能逐一查找元素，导致操作起来非常缓慢，于是就出现了跳表。

**跳表在链表的基础上，增加了多级索引**，通过索引位置的几个跳转，实现数据的快速定位。

> 空间换时间

经过优化后访问从链表的 O(n) 时间复杂度提升到了 O(logn)，增删也因为需要维护多级索引，从 O(1) 降低到了 O(logn)。



### 4. 哈希表

哈希表读写都可以通过哈希值直接找到对应元素，只需要O(1) 时间复杂度。但是哈希表最大问题是无法进行范围查询。



### 5. 压缩列表

相比之下压缩列表是比较少见的一一种数据结构，具体实现如下：

表头有三个字段 zlbytes、zltail 和 zllen，分别表示列表长度、列表尾的偏移量和列表中的 entry 个数,表尾还有一个 zlend，表示列表结束。

![压缩列表][压缩列表]

可以看到各个元素都紧凑的挨在一起，内存利用率极高。

定位第一个或最后一个元素，只需要通过表头的 3 个字段即可找到，O(1) 时间复杂度，其他元素则只能遍历整个列表，O(n) 时间复杂度。



## 3. 详解

### 1. 简单动态字符串

Redis 没有直接使用 C 语言传统的字符串表示， 而是自己构建了一种名为简单动态字符串（`simple dynamic string，SDS`）的抽象类型， 并将 SDS 用作 Redis 的默认字符串表示。

```c
struct sdshdr {
    
    // 记录 buf 数组中已使用字节的数量
    // 等于 SDS 所保存字符串的长度
    int len;
    
    // 记录 buf 数组中未使用字节的数量
    int free;
    
    // 字节数组，用于保存字符串
    char buf[];
    
};
```

SDS 遵循 C 字符串以空字符结尾的惯例， 保存空字符的 `1` 字节空间不计算在 SDS 的 `len` 属性里面， 并且为空字符分配额外的 `1` 字节空间， 以及添加空字符到字符串末尾等操作都是由 SDS 函数自动完成的， 所以这个空字符对于 SDS 的使用者来说是完全透明的。

> 遵循空字符结尾这一惯例的好处是， SDS 可以直接重用一部分 C 字符串函数库里面的函数。

Redis 只会使用 C 字符串作为字面量， 在大多数情况下， Redis 使用 SDS （Simple Dynamic String，简单动态字符串）作为字符串表示。

比起 C 字符串， SDS 具有以下优点：
1. 常数复杂度获取字符串长度。
2. 杜绝缓冲区溢出。
3. 减少修改字符串长度时所需的内存重分配次数。
4. 二进制安全。
5. 兼容部分 C 字符串函数。

| C 字符串                                             | SDS                                                  |
| ---------------------------------------------------- | ---------------------------------------------------- |
| 获取字符串长度的复杂度为 O(N)                        | 获取字符串长度的复杂度为O(1)                         |
| API 是不安全的，可能会造成缓冲区溢出。               | API 是安全的，不会造成缓冲区溢出。                   |
| 修改字符串长度 `N` 次必然需要执行 `N` 次内存重分配。 | 修改字符串长度 `N` 次最多需要执行 `N` 次内存重分配。 |
| 只能保存文本数据。                                   | 可以保存文本或者二进制数据。                         |
| 可以使用所有 `string.h` 库中的函数。                 | 可以使用一部分 `string.h` 库中的函数。               |



## 2. 链表

```c
typedef struct listNode {
    
    // 前置节点
    struct listNode *prev;
    
    // 后置节点
    struct listNode *next;
    
    // 节点的值
    void *value;
    
} listNode;
```

```c
typedef struct list {
    
    // 表头节点
    listNode *head;
    
    // 表尾节点
    listNode *tail;
    
    // 链表所包含的节点数量
    unsigned long len;
    
    // 节点值复制函数
    void *(*dup)(void *ptr);
    
    // 节点值释放函数
    void (*free)(void *ptr);
    
    // 节点值对比函数
    int (*match)(void *ptr, void *key);
    
} list;
```

`list` 结构为链表提供了表头指针 `head` 、表尾指针 `tail` ， 以及链表长度计数器 `len` ， 而 `dup` 、 `free` 和 `match` 成员则是用于实现多态链表所需的类型特定函数：

- `dup` 函数用于复制链表节点所保存的值；
- `free` 函数用于释放链表节点所保存的值；
- `match` 函数则用于对比链表节点所保存的值和另一个输入值是否相等。

Redis 的链表实现的特性可以总结如下：

- 双端： 链表节点带有 `prev` 和 `next` 指针， 获取某个节点的前置节点和后置节点的复杂度都是 O(1)。
- 无环： 表头节点的 `prev` 指针和表尾节点的 `next` 指针都指向 `NULL` ， 对链表的访问以 `NULL` 为终点。
- 带表头指针和表尾指针： 通过 `list` 结构的 `head` 指针和 `tail` 指针， 程序获取链表的表头节点和表尾节点的复杂度为 O(1) 。
- 带链表长度计数器： 程序使用 `list` 结构的 `len` 属性来对 `list` 持有的链表节点进行计数， 程序获取链表中节点数量的复杂度为 O(1)。
- 多态： 链表节点使用 `void*` 指针来保存节点值， 并且可以通过 `list` 结构的 `dup` 、 `free` 、 `match` 三个属性为节点值设置类型特定函数， 所以链表可以用于保存各种不同类型的值。





- 链表被广泛用于实现 Redis 的各种功能， 比如列表键， 发布与订阅， 慢查询， 监视器， 等等。
- 每个链表节点由一个 `listNode` 结构来表示， 每个节点都有一个指向前置节点和后置节点的指针， 所以 Redis 的链表实现是双端链表。
- 每个链表使用一个 `list` 结构来表示， 这个结构带有表头节点指针、表尾节点指针、以及链表长度等信息。
- 因为链表表头节点的前置节点和表尾节点的后置节点都指向 `NULL` ， 所以 Redis 的链表实现是无环链表。
- 通过为链表设置不同的类型特定函数， Redis 的链表可以用于保存各种不同类型的值。



## 3. 字典

Redis 的字典使用哈希表作为底层实现， 一个哈希表里面可以有多个哈希表节点， 而每个哈希表节点就保存了字典中的一个键值对。

Redis 字典所使用的哈希表由 `dict.h/dictht` 结构定义

```c
typedef struct dictht {
    // 哈希表数组
    dictEntry **table;

    // 哈希表大小
    unsigned long size;

    // 哈希表大小掩码，用于计算索引值
    // 总是等于 size - 1
    unsigned long sizemask;

    // 该哈希表已有节点的数量
    unsigned long used;

} dictht;
```

`table` 属性是一个数组， 数组中的每个元素都是一个指向 `dict.h/dictEntry` 结构的指针， 每个 `dictEntry` 结构保存着一个键值对。

`size` 属性记录了哈希表的大小， 也即是 `table` 数组的大小， 而 `used` 属性则记录了哈希表目前已有节点（键值对）的数量。

`sizemask` 属性的值总是等于 `size - 1` ， 这个属性和哈希值一起决定一个键应该被放到 `table` 数组的哪个索引上面。



哈希表节点使用 `dictEntry` 结构表示， 每个 `dictEntry` 结构都保存着一个键值对：

```c
typedef struct dictEntry {

    // 键
    void *key;

    // 值
    union {
        void *val;
        uint64_t u64;
        int64_t s64;
    } v;

    // 指向下个哈希表节点，形成链表
    struct dictEntry *next;

} dictEntry;
```

`key` 属性保存着键值对中的键， 而 `v` 属性则保存着键值对中的值， 其中键值对的值可以是一个指针， 或者是一个 `uint64_t` 整数， 又或者是一个 `int64_t` 整数。

`next` 属性是指向另一个哈希表节点的指针， 这个指针可以将多个哈希值相同的键值对连接在一次， 以此来解决键冲突（collision）的问题。

举个例子， 图 4-2 就展示了如何通过 `next` 指针， 将两个索引值相同的键 `k1` 和 `k0` 连接在一起。



Redis 中的字典由 `dict.h/dict` 结构表示：

```c
typedef struct dict {

    // 类型特定函数
    dictType *type;

    // 私有数据
    void *privdata;

    // 哈希表
    dictht ht[2];

    // rehash 索引
    // 当 rehash 不在进行时，值为 -1
    int rehashidx; /* rehashing not in progress if rehashidx == -1 */

} dict;
```

`type` 属性和 `privdata` 属性是针对不同类型的键值对， 为创建多态字典而设置的：

- `type` 属性是一个指向 `dictType` 结构的指针， 每个 `dictType` 结构保存了一簇用于操作特定类型键值对的函数， Redis 会为用途不同的字典设置不同的类型特定函数。
- 而 `privdata` 属性则保存了需要传给那些类型特定函数的可选参数。

```C
typedef struct dictType {

    // 计算哈希值的函数
    unsigned int (*hashFunction)(const void *key);

    // 复制键的函数
    void *(*keyDup)(void *privdata, const void *key);

    // 复制值的函数
    void *(*valDup)(void *privdata, const void *obj);

    // 对比键的函数
    int (*keyCompare)(void *privdata, const void *key1, const void *key2);

    // 销毁键的函数
    void (*keyDestructor)(void *privdata, void *key);

    // 销毁值的函数
    void (*valDestructor)(void *privdata, void *obj);

} dictType;
```

`ht` 属性是一个包含两个项的数组， 数组中的每个项都是一个 `dictht` 哈希表， 一般情况下， 字典只使用 `ht[0]` 哈希表， `ht[1]` 哈希表只会在对 `ht[0]` 哈希表进行 rehash 时使用。

除了 `ht[1]` 之外， 另一个和 rehash 有关的属性就是 `rehashidx` ： 它记录了 rehash 目前的进度， 如果目前没有在进行 rehash ， 那么它的值为 `-1` 。



## 4. 跳跃表

- 跳跃表是有序集合的底层实现之一， 除此之外它在 Redis 中没有其他应用。
- Redis 的跳跃表实现由 `zskiplist` 和 `zskiplistNode` 两个结构组成， 其中 `zskiplist` 用于保存跳跃表信息（比如表头节点、表尾节点、长度）， 而 `zskiplistNode` 则用于表示跳跃表节点。
- 每个跳跃表节点的层高都是 `1` 至 `32` 之间的随机数。
- 在同一个跳跃表中， 多个节点可以包含相同的分值， 但每个节点的成员对象必须是唯一的。
- 跳跃表中的节点按照分值大小进行排序， 当分值相同时， 节点按照成员对象的大小进行排序。



跳跃表

```c
typedef struct zskiplist {
    // 表头节点和表尾节点
    structz skiplistNode *header, *tail;
    // 表中节点的数量
    unsigned long length;
    // 表中层数最大的节点的层数
    int level;
} zskiplist;
```

跳跃表节点

```c
typedef struct zskiplistNode {

    // 后退指针
    struct zskiplistNode *backward;

    // 分值
    double score;

    // 成员对象
    robj *obj;

    // 层
    struct zskiplistLevel {

        // 前进指针
        struct zskiplistNode *forward;

        // 跨度
        unsigned int span;

    } level[];

} zskiplistNode;
```



## 5. 整数集合

整数集合（intset）是 Redis 用于保存整数值的集合抽象数据结构， 它可以保存类型为 `int16_t` 、 `int32_t` 或者 `int64_t` 的整数值， 并且保证集合中不会出现重复元素。

```c
typedef struct intset {

    // 编码方式
    uint32_t encoding;

    // 集合包含的元素数量
    uint32_t length;

    // 保存元素的数组
    int8_t contents[];

} intset;
```

- contents数组存储的是集合中的每个元素，他的类型是int8_t，但存储数据的实际类型取决于编码方式encoding
- encoding编码方式有三种INTSET_ENC_INT16、INTSET_ENC_INT32、INTSET_ENC_INT64分别对应的是int16_t、int32_t、int64_t类型
- length记录整数集合的元素数量，即contents数组的长度

**整数集合的升级操作**

整数集合中原来保存的是小类型（如：int16_t）的整数，当插入比其类型大（如：int_64_t）的整数时，会把整合集合里的元素的数据类型都转换成大的类型，这个过程称为升级

升级整数集合并添加新元素步骤如下：

（1）根据新元素的类型，扩展整数集合的底层数据的空间大小，并为新元素分配空间。

（2）将现有的所有元素的类型转换成与新元素相同的类型，保持原有数据有序性不变的情况下，把转换后的元素放在正确的位置上。

（3）将新元素添加到数组里。

新元素引发升级，所以新元素要么比所有元素都大，要么比所有元素都小。

* 当小于所有元素时，新元素放在底层数组的最开头

- 当大于所有元素时，新元素放在底层数据的最末尾

**升级操作的好处**

- 提升整数的灵活性，可以任意的向集合中放入3中不同类型的整数，而不用担心类型错误。
- 节约内存，整数集合中只有大类型出现的时候才会进行升级操作。

整数集合不支持降级操作



## 6. 压缩列表

压缩列表（ziplist）是列表键和哈希键的底层实现之一。

当一个列表键只包含少量列表项， 并且每个列表项要么就是小整数值， 要么就是长度比较短的字符串， 那么 Redis 就会使用压缩列表来做列表键的底层实现。

压缩列表是 Redis 为了节约内存而开发的， 由一系列特殊编码的连续内存块组成的顺序型（sequential）数据结构。

一个压缩列表可以包含任意多个节点（entry）， 每个节点可以保存一个字节数组或者一个整数值。

压缩列表各个组成部分的详细说明

| 属性      | 类型       | 长度     | 用途                                                         |
| --------- | ---------- | -------- | ------------------------------------------------------------ |
| `zlbytes` | `uint32_t` | `4` 字节 | 记录整个压缩列表占用的内存字节数：在对压缩列表进行内存重分配， 或者计算 `zlend` 的位置时使用。 |
| `zltail`  | `uint32_t` | `4` 字节 | 记录压缩列表表尾节点距离压缩列表的起始地址有多少字节： 通过这个偏移量，程序无须遍历整个压缩列表就可以确定表尾节点的地址。 |
| `zllen`   | `uint16_t` | `2` 字节 | 记录了压缩列表包含的节点数量： 当这个属性的值小于 `UINT16_MAX` （`65535`）时， 这个属性的值就是压缩列表包含节点的数量； 当这个值等于 `UINT16_MAX` 时， 节点的真实数量需要遍历整个压缩列表才能计算得出。 |
| `entryX`  | 列表节点   | 不定     | 压缩列表包含的各个节点，节点的长度由节点保存的内容决定。     |
| `zlend`   | `uint8_t`  | `1` 字节 | 特殊值 `0xFF` （十进制 `255` ），用于标记压缩列表的末端。    |

- 列表 `zlbytes` 属性的值为 `0x50` （十进制 `80`）， 表示压缩列表的总长为 `80` 字节。
- 列表 `zltail` 属性的值为 `0x3c` （十进制 `60`）， 这表示如果我们有一个指向压缩列表起始地址的指针 `p` ， 那么只要用指针 `p` 加上偏移量 `60` ， 就可以计算出表尾节点 `entry3` 的地址。
- 列表 `zllen` 属性的值为 `0x3` （十进制 `3`）， 表示压缩列表包含三个节点。

```sh
zbnytes zltail zllen entry1 entry2 entry3 zlend
 0x50	0x3c 	0x03 					
 P									p+60
```

**压缩列表节点**

每个压缩列表含有若干个节点，而每个节点都由三部分构成，previous_entry_length、encoding、content

```sh
|previous_entry_length|encoding|content|
```

- previous_entry_length 存储的是前一个节点的长度，由于压缩列表内存块连续，使用此属性值可以计算前一个节点的地址，压缩列表就是使用这一原理进行遍历。
- previous_entry_length 如果前一节点长度小于254字节，那么previous_entry_length属性本身长度为1字节，存储的指就是前一节点的长度；如果大于254个字节，那么previous_entry_length属性本身长度为5个字节，前一个字节为0xFE(十进制254)，之后四个字节存储前一节点的长度。
- encoding 记录本节点的content属性所保存数据的类型及长度，其本身长度为一字节、两字节或五字节，值得最高位为00、01或10的是字节数组的编码，最高位以11开头的是整数编码。
- content 保存节点的值，可以是一个字节数组或者整数。

**连锁更新**

当对压缩列表进行添加节点或删除节点时有可能会引发连锁更新，由于每个节点的 previous_entry_length 存在两种长度1字节或5字节，当所有节点previous_entry_length都为1个字节时，有新节点的长度大于254个字节，那么新的节点的后一个节点的previous_entry_length原来为1个字节，无法保存新节点的长度，这是就需要进行空间扩展previous_entry_length属性由原来的1个字节增加4个字节变为5个字节，如果增加后原节点的长度超过了254个字节则后续节点也要空间扩展，以此类推，最极端的情况是一直扩展到最后一个节点完成；这种现象称为连锁更新。在日常应用中全部连锁更新的情况属于非常极端的，不常出现。

## 7. 对象

Redis 并没有直接使用这些数据结构来实现键值对数据库， 而是基于这些数据结构创建了一个对象系统。

```c
typedef struct redisObject {

    // 对象数据类型 字符串、列表、哈希等等
    unsigned type:4;

    // 编码方式
    unsigned encoding:4;

    // 指向底层实现数据结构的指针
    void *ptr;

    // ...

} robj;
```



## 4. 参考资料

`《Redis设计与实现》`

`Redis核心技术实战`

[Redis 数据类型与底层数据结构对应关系]:https://raw.githubusercontent.com/lixd/blog/master/images/redis/underlying-datastructure.png

[压缩列表]:https://raw.githubusercontent.com/lixd/blog/master/images/redis/ziplist.png

