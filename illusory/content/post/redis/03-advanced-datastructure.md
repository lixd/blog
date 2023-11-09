---
title: "Redis教程(三)---redis高级数据结构"
description: "redis常用命令汇总"
date: 2020-01-15 22:00:00
draft: false
tags: ["Redis"]
categories: ["Redis"]
---

本文主要介绍Redis高级数据结构，包括Bitmap(位图)、Hyperloglog、GEO以及使用场景。

<!--more-->

## 1. Bitmap

### 1. 概述

BitMap，即位图，也就是 byte 数组，用二进制表示，只有 0 和 1 两个数字，底层使用SDS存储。

### 2. API



```sh
#对key所存储的字符串值，获取指定偏移量上的位（bit）
getbit key offset

# 对key所存储的字符串值，设置或清除指定偏移量上的位（bit） 1. 返回值为该位在setbit之前的值 2. value只能取0或1 3. offset从0开始，即使原位图只能10位，offset可以取1000
setbit key offset value

#获取位图指定范围中位值为1的个数 如果不指定start与end，则取所有
bitcount key [start end]

#做多个BitMap的and（交集）、or（并集）、not（非）、xor（异或）操作并将结果保存在destKey中
bitop op destKey key1 [key2...]

#计算位图指定范围第一个偏移量对应的的值等于targetBit的位置 1. 找不到返回-1 2. start与end没有设置，则取全部 3. targetBit只能取0或者1
bitpos key tartgetBit [start end]
```

### 3. 使用场景

有的场景用Bitmap会有奇效，比如:

**日活跃用户**

如果是日活跃用户的话只需要创建一个Bitmap即可，每个用户根据ID对应Bitmap中的一位，当某个用户满足活跃用户条件后，就在Bitmap中把标识此用户的位置为1。

假设有1000W用户，那么只需要`1000W/8/1024/1024` 差不多`1.2M`的空间，简直完美

**那周活跃用户、月活跃用户呢？**

同理，多建几个Bitmap即可。

同样的，`每日签到`、`用户在线状态`什么的也可以这么实现。

### 4. 实例

假设用来统计日活跃用户。

用户满足条件则写入缓存，假设用户ID1满足活跃条件了，那么：

```sh
#setbit key offset value 这里直接把id当做offset就更方便了
setbit key 1 value
```

周活跃用户则创建7个Bitmap，最后统计一周7天每天都活跃的用户呢?

直接把7个Bitmap进行`与`运算求交集，最后还为1的就是7天都活跃的，毕竟7个1与之后才能为1。

```sh
#bitop op destKey key1 [key2...] 大概是这样的
bitop and destKey Monday [Tuesday...]
```

如果是7天中登录过的(1天及其以上)那就是求并集，`或`运算。

### 5. bloomfilter

还可以用来实现布隆过滤(在官方提供布隆过滤之前，一般都是用的Bitmap实现)，具体逻辑如下：


* 1.根据hash算法确定key要映射到哪些bit上(一般为多个,越多冲突越小)
* 2.setbit 将对应的bit全置为1
* 3.查询时同样先hash,如果对应的映射不是都为1则说明该key一定不存在，都为1则说明可能存在。

## 2. Hyperloglog

### 1. 概述

 HyperLogLog 是用来做基数统计的算法，HyperLogLog 的优点是，在输入元素的数量或者体积非常非常大时，计算基数所需的空间总是固定 的、并且是很小的。

在 Redis 里面，每个 HyperLogLog 键只需要花费 12 KB 内存，就可以计算接近 2^64 个不同元素的基 数。这和计算基数时，元素越多耗费内存就越多的集合形成鲜明对比。

* 基数不大，数据量不大就用不上，会有点大材小用浪费空间
* 有局限性，就是只能统计基数数量，而没办法去知道具体的内容是什么
* 和bitmap相比，属于两种特定统计情况，简单来说，HyperLogLog 去重比 bitmap 方便很多
* 一般可以bitmap和hyperloglog配合使用，bitmap标识哪些用户活跃，hyperloglog计数

### 2. API

```sh
#添加指定元素到 HyperLogLog 中
#影响基数估值则返回1否则返回0
PFADD key element [element ...]

#返回给定 HyperLogLog 的基数估算值。
#白话就叫做去重值 带有 0.81% 标准错误（standard error）的近似值
PFCOUNT key [key ...]

#将多个 HyperLogLog 合并为一个 HyperLogLog
PFMERGE destkey sourcekey [sourcekey ...]
```

### 3. 使用场景

统计 APP或网页 的一个页面，每天有多少用户点击进入的次数。同一个用户的反复点击进入记为 1 次。

```sh
// 判定当前元素是否存在
直接添加PFADD 如果影响基数估值则返回1否则返回0
```

```go
func RedisHyperLogLog() {
	var (
		key    = "clickStatic"
		userId = 10010
	)
	// 删除旧测试数据
	rc.Del(key)
	for i := 10000; i < 10010; i++ {
		rc.PFAdd(key, i)
	}
	// 判定当前元素是否存在
	// PFAdd添加后对基数值产生影响则返回1 否则返回0
	res := rc.PFAdd(key, userId)
	if err := res.Err(); err != nil {
		logrus.Errorf("err :%v", )
		return
	}
	if res.Val() != 1 {
		logrus.Println("该用户已统计")
	} else {
		logrus.Println("该用户未统计")
	}
}
```



## 3. GEO

支持存储地理位置信息用来实现诸如附近位置、摇一摇这类依赖于地理位置信息的功能。

暂时没用到，一般用的也不是很多，到时候在写。

//TODO

