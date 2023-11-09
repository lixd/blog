---
title: "MySQL教程(三)---SQL标准中JOIN语句差异及MySQL中的JOIN实现"
description: "SQL92与SQL99 标准中 JOIN 语句的差异点和 MySQL 中 JOIN 语句的具体实现"
date: 2020-03-15 22:00:00
draft: false
tags: ["MySQL"]
categories: ["MySQL"]
---

本文主要记录了 SQL92 标准与 SQL99 标准中 JOIN 语句的一些差异情况。

<!--more-->



## 1. 概述

SQL有两个主要的标准，分别是SQL92和SQL99。92和99代表了标准提出的时间，SQL92就是92年提出的标准规范。当然除了SQL92和SQL99以外，还存在SQL-86、SQL-89、SQL:2003、SQL:2008、SQL:2011和SQL:2016等其他的标准。

实际上最重要的SQL标准就是SQL92和SQL99。一般来说SQL92的形式更简单，但是写的SQL语句会比较长，可读性较差。而SQL99相比于SQL92来说，语法更加复杂，但`可读性`更强。

> 推荐使用 SQL99 标准



## 2. SQL92 和 SQL99 差异点

SQL92 和 SQL99 在 JOIN 连接 写法上的一些区别。

### 1. CROSS JOIN

```mysql
# SQL92
SELECT * FROM player, team
# SQL99
SELECT * FROM player CROSS JOIN team
```

多表连接

```mysql
# SQL92
SELECT * FROM t1,t2,t3
# SQL99
SELECT * FROM t1 CROSS JOIN t2 CROSS JOIN t3
```



### 2. NATURAL JOIN

`NATURAL JOIN`译作`自然连接`  SQL99 中新增的，和 SQL92 中的等值连接差不多。

```mysql
# SQL92
player_id, a.team_id, player_name, height, team_name FROM player as a, team as b WHERE a.team_id = b.team_id
# SQL99
SELECT player_id, team_id, player_name, height, team_name FROM player NATURAL JOIN team 
```

实际上，在 SQL99 中用 NATURAL JOIN 替代了 `WHERE player.team_id = team.team_id`。



### 3. ON 条件

同样是 SQL99 中新增的。

SQL92 中多表连接直接使用`,`逗号进行连接，条件也直接使用`WHERE`。

```mysql
SELECT * FROM A,B WHERE xxx
```

```mysql
SELECT p.player_name, p.height, h.height_level
FROM player AS p, height_grades AS h
WHERE p.height BETWEEN h.height_lowest AND h.height_highest
```

SQL99 中则使用 JOIN 表示连接, ON 表示条件。

```mysql
SELECT * FROM A JOIN B ON xxx
```

```mysql
SELECT p.player_name, p.height, h.height_level
FROM player as p JOIN height_grades as h
ON height BETWEEN h.height_lowest AND h.height_highest
```



### 4. USING连接

> USING 就是等值连接的一种简化形式,SQL99 中新增的。

当我们进行连接的时候，可以用 USING 指定数据表里的同名字段进行等值连接。

```mysql
SELECT player_id, team_id, player_name, height, team_name FROM player JOIN team USING(team_id)
```

同时使用`JOIN USING`可以简化`JOIN ON`的等值连接，它与下面的 SQL 查询结果是相同的:

```mysql
SELECT player_id, player.team_id, player_name, height, team_name FROM player JOIN team ON player.team_id = team.team_id
```




### 5. SELF JOIN

> 自连接的原理在 SQL92 和 SQL99 中都是一样的，只是表述方式不同。

```mysql
# SQL92 
SELECT b.player_name, b.height FROM player as a , player as b WHERE a.player_name = '布雷克-格里芬' and a.height < b.height
# SQL99
SELECT b.player_name, b.height FROM player as a JOIN player as b ON a.player_name = '布雷克-格里芬' and a.height < b.height
```

### 6. 小结

在 SQL92 中进行查询时，会把所有需要连接的表都放到 FROM 之后，然后在 WHERE 中写明连接的条件。比如：

```mysql
SELECT ...
FROM table1 t1, table2 t2, ...
WHERE ...
```



而 SQL99 在这方面更灵活，它不需要一次性把所有需要连接的表都放到 FROM 之后，而是采用 JOIN 的方式，每次连接一张表，可以多次使用 JOIN 进行连接。

另外，我建议多表连接使用 SQL99 标准，因为层次性更强，可读性更强，比如：

```mysql
SELECT ...
FROM table1
    JOIN table2 ON ...
        JOIN table3 ON ...
```

SQL99 采用的这种嵌套结构非常清爽，即使再多的表进行连接也都清晰可见。如果你采用 SQL92，可读性就会大打折扣。

最后一点就是，SQL99 在 SQL92 的基础上提供了一些特殊语法，比如`NATURAL JOIN`和`JOIN USING`。它们在实际中是比较常用的，省略了 ON 后面的等值条件判断，让 SQL 语句更加简洁。



## 3. MySQL 中的 JOIN 差异

### 1. LEFT JOIN

At the parser stage, queries with right outer join operations are converted to equivalent queries containing only left join operations. In the general case, the conversion is performed such that this right join:

```mysql
(T1, ...) RIGHT JOIN (T2, ...) ON P(T1, ..., T2, ...)
```

Becomes this equivalent left join:

```mysql
(T2, ...) LEFT JOIN (T1, ...) ON P(T1, ..., T2, ...)
```

**在 MySQL 的执行引擎 SQL解析阶段，都会将 right join 转换为 left join**

**解释**

因为Mysql只实现了`nested-loop`算法，该算法的核心就是外表驱动内表

```mysql
for each row in t1 matching range {
  for each row in t2 matching reference key {
    for each row in t3 {
      if row satisfies join conditions, send to client
    }
  }
}
```

由此可知，它必须要保证外表先被访问。

### 2. INNER JOIN

All inner join expressions of the form T1 INNER JOIN T2 ON P(T1,T2) are replaced by the list T1,T2,  and P(T1,T2) being joined as a conjunct to the WHERE condition (or to the join condition of the embedding join, if there is any)

INNER JOIN

```mysql
FROM (T1, ...) INNER JOIN (T2, ...) ON P(T1, ..., T2, ...)
```

转换为如下：

```mysql
FROM (T1, ..., T2, ...) WHERE P(T1, ..., T2, ...)
```

**相当于将 INNER JOIN 转换成了  CROSS JOIN**

由于在 MySQL 中`JOIN`、`CROSS JOIN`、`INNER JOIN`是等效的,所以这样转换是没有问题的。

> In MySQL, `JOIN`, `CROSS JOIN`, and `INNER JOIN` are syntactic equivalents (they can replace each other). In standard SQL, they are not equivalent. `INNER JOIN` is used with an `ON` clause, `CROSS JOIN` is used otherwise.
>
> 官网文档: https://dev.mysql.com/doc/refman/8.0/en/join.html

### 3. LEFT JOIN to INNER JOIN

Mysql引擎在一些特殊情况下，会将left join转换为inner join。

```mysql
SELECT * 
FROM T1 
	LEFT JOIN T2 ON P1(T1,T2)
WHERE P(T1,T2) AND R(T2)
```

这里涉及到两个问题：

* 1.为什么要做这样的转换？
* 2.什么条件下才可以做转换？



首先，做转换的目的是为了提高查询效率。在上面的示例中，where条件中的R(T2)原本可以极大地过滤不满足条件的记录，但由于nested loop算法的限制，只能先查T1，再用T1驱动T2。当然，不是所有的left join都能转换为inner join，这就涉及到第2个问题。如果你深知left join和inner join的区别就很好理解第二个问题的答案（不知道两者区别的请自行百度）：

left join是以T1表为基础，让T2表来匹配，对于没有被匹配的T1的记录，其T2表中相应字段的值全为null。也就是说，left join连表的结果集包含了T1中的所有行记录。与之不同的是，inner join只返回T1表和T2表能匹配上的记录。也就是说，相比left join，inner join少返回了没有被T2匹配上的T1中的记录。那么，如果where中的查询条件能保证返回的结果中一定不包含不能被T2匹配的T1中的记录，那就可以保证left join的查询结果和inner join的查询结果是一样的，在这种情况下，就可以将left join转换为inner join。

我们再回过头来看官网中的例子：

```mysql
T2.B IS NOT NULL
T2.B > 3
T2.C <= T1.C
T2.B < 2 OR T2.C > 1
```



如果上面的R(T2)是上面的任意一条，就能保证inner join的结果集中一定没有不能被T2匹配的T1中的记录。以T2.B > 3为例，对于不能被T2匹配的T1中的结果集，其T2中的所有字段都是null，显然不满足T2.B > 3。

相反，以下R(T2)显然不能满足条件，原因请自行分析：

```mysql
T2.B IS NULL
T1.B < 3 OR T2.B IS NOT NULL
T1.B < 3 OR T2.B > 3
```




## 4. 参考

`https://blog.csdn.net/Saintyyu/article/details/100170320`

`https://dev.mysql.com/doc/refman/8.0/en/join.html`

极客专栏--<SQL知识必会>