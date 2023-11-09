---
title: "MySQL教程(六)---JOIN 语句执行流程"
description: "MySQL的 JOIN 语句执行流程详解"
date: 2020-03-30 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要记录了 MySQL 中的 JOIN 语句具体执行流程,同时分析了 ON 与 WHERE 条件的区别。

<!--more-->

## 1. 执行流程

一个完整的 SQL 语句中会被拆分成多个子句，子句的执行过程中会产生虚拟表（VT），经过各种条件后生成的最后一张虚拟表就是返回的结果。

以下是 JOIN 查询的通用结构：

```mysql
SELECT <row_list>   
	FROM <left_table>     
		<inner|left|right> JOIN <right_table>       
			ON <join condition>         
				WHERE <where_condition>
```

它的执行顺序如下：

> SQL 语句里第一个被执行的总是 FROM 子句

- **1）FROM**：执行 FROM 子句对两张表进行笛卡尔积操作，
  - 对左右两张表执行笛卡尔积，产生第一张表 vt1。行数为 n*m（ n 为左表的行数，m 为右表的行数)
- **2）ON**: 执行 ON 子句过滤掉不满足条件的行
  - 根据 ON 的条件逐行筛选 vt1，将结果插入 vt2 中
- **3）JOIN**:添加外部行
  - 如果是 LEFT JOIN，则先遍历一遍**左表**的每一行，其中不在 vt2 的行会被添加到 vt2，该行的剩余字段将被填充为**NULL**，形成 vt3；IGHT JOIN同理。但如果指定的是 **INNER JOIN**，则不会添加外部行，上述插入过程被忽略，vt3 就是 vt2。
- **4）WHERE**: 条件过滤
  - 根据 WHERE 条件对 vt3 进行条件过滤产生 vt4
- **5）SELECT**: 查询指定字段
  - 取出 vt4 的指定字段形成 vt5



## 2. 例子

创建一个用户信息表：

```javascript
CREATE TABLE `user_info` (
  `userid` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  UNIQUE `userid` (`userid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

再创建一个用户余额表：

```javascript
CREATE TABLE `user_account` (
  `userid` int(11) NOT NULL,
  `money` bigint(20) NOT NULL,
 UNIQUE `userid` (`userid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

随便导入一些数据：

```mysql
insert into user_info values(1001,'x'),(1002,'y'),(1003,'z'),(1004,'a'),(1005,'b'),(1006,'c'),(1007,'d'),(1008,'e');

insert into user_account values(1001,22),(1002,30),(1003,8),(1009,11);
```

一共 8 个用户有用户名，4 个用户的账户有余额。

**取出 userid 为 1003 的用户姓名和余额，SQL如下**：

```mysql
SELECT i.name, a.money 
  FROM user_info as i 
    LEFT JOIN user_account as a 
      ON i.userid = a.userid 
        WHERE a.userid = 1003;
```

**第一步：执行 FROM 子句对两张表进行笛卡尔积操作**

笛卡尔积操作后会返回两张表中所有行的组合，左表 userinfo 有 8 行，右表 useraccount 有 4 行，生成的虚拟表vt1 就是 8*4=32 行：

```mysql
mysql> SELECT * FROM user_info as i LEFT JOIN user_account as a ON 1;
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1009 |    11 |
|   1001 | x    |   1003 |     8 |
|   1001 | x    |   1002 |    30 |
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1009 |    11 |
|   1002 | y    |   1003 |     8 |
|   1002 | y    |   1002 |    30 |
|   1002 | y    |   1001 |    22 |
|   1003 | z    |   1009 |    11 |
|   1003 | z    |   1003 |     8 |
|   1003 | z    |   1002 |    30 |
|   1003 | z    |   1001 |    22 |
|   1004 | a    |   1009 |    11 |
|   1004 | a    |   1003 |     8 |
|   1004 | a    |   1002 |    30 |
|   1004 | a    |   1001 |    22 |
|   1005 | b    |   1009 |    11 |
|   1005 | b    |   1003 |     8 |
|   1005 | b    |   1002 |    30 |
|   1005 | b    |   1001 |    22 |
|   1006 | c    |   1009 |    11 |
|   1006 | c    |   1003 |     8 |
|   1006 | c    |   1002 |    30 |
|   1006 | c    |   1001 |    22 |
|   1007 | d    |   1009 |    11 |
|   1007 | d    |   1003 |     8 |
|   1007 | d    |   1002 |    30 |
|   1007 | d    |   1001 |    22 |
|   1008 | e    |   1009 |    11 |
|   1008 | e    |   1003 |     8 |
|   1008 | e    |   1002 |    30 |
|   1008 | e    |   1001 |    22 |
+--------+------+--------+-------+
32 rows in set (0.00 sec)
```

**第二步：执行 ON子句过滤掉不满足条件的行**

`ON i.userid = a.userid` 过滤之后 vt2 如下：

```mysql
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
```

**第三步：JOIN 添加外部行**

**LEFT JOIN**会将左表未出现在 vt2 的行插入进 vt2，每一行的剩余字段将被填充为NULL，**RIGHT JOIN**同理。

本例中用的是**LEFT JOIN**，所以会将左表**user_info**剩下的行都添上 生成表 vt3：

```javascript
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
|   1004 | a    |   NULL |  NULL |
|   1005 | b    |   NULL |  NULL |
|   1006 | c    |   NULL |  NULL |
|   1007 | d    |   NULL |  NULL |
|   1008 | e    |   NULL |  NULL |
+--------+------+--------+-------+
```

**第四步：WHERE条件过滤**

WHERE a.userid = 1003 生成表 vt4：

```mysql
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
```

**第五步：SELECT**

SELECT i.name, a.money 生成 vt5：

```mysql
+------+-------+
| name | money |
+------+-------+
| z    |     8 |
+------+-------+
```

虚拟表 vt5 作为最终结果返回给客户端。

介绍完联表的过程之后，我们看看常用**JOIN**的区别。

## 3. 几种JOIN 区别

- **INNER JOIN...ON...**: 返回 左右表互相匹配的所有行（因为只执行上文的第二步ON过滤，不执行第三步 添加外部行）
- **LEFT JOIN...ON...**: 返回左表的所有行，若某些行在右表里没有相对应的匹配行，则将右表的列在新表中置为NULL
- **RIGHT JOIN...ON...**: 返回右表的所有行，若某些行在左表里没有相对应的匹配行，则将左表的列在新表中置为NULL

### 1. INNER JOIN

拿上文的第三步**添加外部行**来举例，若**LEFT JOIN**替换成**INNER JOIN**，则会跳过这一步，生成的表 vt3 与 vt2 一模一样：

```javascript
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
```

### 2. RIGHT JOIN

若**LEFT JOIN**替换成**RIGHT JOIN**，则生成的表 vt3 如下：

```mysql
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
|   NULL | NULL |   1009 |    11 |
+--------+------+--------+-------+
```

**因为 useraccount（右表）里存在 userid = 1009 这一行，而 userinfo（左表）里却找不到这一行的记录，所以会在第三步插入以下一行：**

```mysql
|   NULL | NULL |   1009 |    11 |
```

### 3. FULL JOIN

上文引用的文章中提到了标准SQL定义的**FULL JOIN**，这在[mysql](https://cloud.tencent.com/product/cdb?from=10680)里是不支持的，不过我们可以通过**LEFT JOIN + UNION + RIGHT JOIN** 来实现**FULL JOIN**：

```mysql
SELECT * 
  FROM user_info as i 
    RIGHT JOIN user_account as a 
      ON a.userid=i.userid
union 
SELECT * 
  FROM user_info as i 
    LEFT JOIN user_account as a 
      ON a.userid=i.userid;
```

他会返回如下结果：

```mysql
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
|   NULL | NULL |   1009 |    11 |
|   1004 | a    |   NULL |  NULL |
|   1005 | b    |   NULL |  NULL |
|   1006 | c    |   NULL |  NULL |
|   1007 | d    |   NULL |  NULL |
|   1008 | e    |   NULL |  NULL |
+--------+------+--------+-------+
```

ps：其实我们从语义上就能看出**LEFT JOIN**和**RIGHT JOIN**没什么差别，两者的结果差异取决于左右表的放置顺序，以下内容摘自mysql官方文档：

> RIGHT JOIN works analogously to LEFT JOIN. To keep code portable across databases, it is **recommended that you use LEFT JOIN instead of RIGHT JOIN.**

所以当你纠结使用LEFT JOIN还是RIGHT JOIN时，**尽可能只使用LEFT JOIN**吧。

## 4. ON和WHERE的区别

上文把 JOIN 的执行顺序了解清楚之后，ON 和 WHERE 的区别也就很好理解了。

举例说明：

```mysql
SELECT * 
  FROM user_info as i
    LEFT JOIN user_account as a
      ON i.userid = a.userid and i.userid = 1003;
SELECT * 
  FROM user_info as i
    LEFT JOIN user_account as a
      ON i.userid = a.userid where i.userid = 1003;
```

第一种情况**LEFT JOIN**在执行完第二步ON子句后，筛选出满足**i.userid = a.userid and i.userid = 1003** 的行，生成表 vt2，然后执行第三步 JOIN 子句，将外部行添加进虚拟表生成 vt3 即最终结果：

```mysql
vt2:
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
vt3:
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   NULL |  NULL |
|   1002 | y    |   NULL |  NULL |
|   1003 | z    |   1003 |     8 |
|   1004 | a    |   NULL |  NULL |
|   1005 | b    |   NULL |  NULL |
|   1006 | c    |   NULL |  NULL |
|   1007 | d    |   NULL |  NULL |
|   1008 | e    |   NULL |  NULL |
+--------+------+--------+-------+
```

而第二种情况**LEFT JOIN**在执行完第二步 ON 子句后，筛选出满足**i.userid = a.userid**的行，生成表 vt2；再执行第三步 JOIN 子句添加外部行生成表 vt3；然后执行第四步 WHERE 子句，再对 vt3 表进行过滤生成 vt4，得的最终结果：

```mysql
vt2:
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
vt3:
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1001 | x    |   1001 |    22 |
|   1002 | y    |   1002 |    30 |
|   1003 | z    |   1003 |     8 |
|   1004 | a    |   NULL |  NULL |
|   1005 | b    |   NULL |  NULL |
|   1006 | c    |   NULL |  NULL |
|   1007 | d    |   NULL |  NULL |
|   1008 | e    |   NULL |  NULL |
+--------+------+--------+-------+
vt4:
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
```

如果将上例的**LEFT JOIN**替换成**INNER JOIN**，不论将条件过滤放到**ON**还是**WHERE**里，结果都是一样的，因为**INNER JOIN不会执行第三步添加外部行**。

```mysql
SELECT * 
  FROM user_info as i
    INNER JOIN user_account as a
      ON i.userid = a.userid and i.userid = 1003;
SELECT * 
  FROM user_info as i
    INNER JOIN user_account as a
      ON i.userid = a.userid where i.userid = 1003;
```

返回结果都是：

```mysql
+--------+------+--------+-------+
| userid | name | userid | money |
+--------+------+--------+-------+
|   1003 | z    |   1003 |     8 |
+--------+------+--------+-------+
```

只要记住联表语句执行过程之后，应对各种 JOIN 语句应该都比较轻松了。

## 5. 参考

`https://dev.mysql.com/doc/refman/8.0/en/join.html`

`https://mp.weixin.qq.com/s/LfbSmwwDy5QkxXsicjMjLA`

`https://www.codeproject.com/Articles/33052/Visual-Representation-of-SQL-Joins`

