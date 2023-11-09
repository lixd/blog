---
title: "Nginx教程(三)---日志文件切割"
description: "通过cron定时任务实现Nginx的日志文件切割"
date: 2019-02-16 22:00:00
draft: false
categories: ["Nginx"]
tags: ["Nginx"]
---

本章主要对Nginx服务器的日志文件分析，包括`日志文件切割`与`cron定时任务`语法详解。

<!-- more-->



## 1. 日志文件

再看一下Nginx目录结构

```nginx
/usr/local/nginx
			--conf	配置文件
			--html  网页文件
			--logs  日志文件
			--sbin  主要二进制文件
```

### 1.1 查看日志

前面看了`conf配置文件`，这里看下`logs日志文件`;

```nginx
/usr/local/nginx/logs
		-- access.log #访问日志
 		-- error.log  #错误日志
 		-- nginx.pid  #存放Nginx当前进程的pid
```

`nginx.pid` 存放Nginx当前进程的pid

```nginx
[root@localhost logs]# cat nginx.pid
98830
[root@localhost logs]# ps aux|grep nginx
root      98830  0.0  0.0  20552   616 ?        Ss   09:57   0:00 nginx: master process /usr/local/nginx/sbin/nginx
nobody    98831  0.0  0.1  23088  1636 ?        S    09:57   0:00 nginx: worker process
root     105254  0.0  0.0 112708   976 pts/1    R+   11:02   0:00 grep --color=auto nginx
```

`access.log` 访问日志

```nginx
[root@localhost logs]# tail -f -n 20  access.log

192.168.5.199 - - [04/Mar/2019:10:02:10 +0800] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.119 Safari/537.36"
192.168.5.199 - - [04/Mar/2019:10:02:10 +0800] "GET /favicon.ico HTTP/1.1" 404 555 "http://192.168.5.154/" "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.119 Safari/537.36"
```

### 1.2 日志分割

Nginx日志都会存在一个文件里，随着时间推移，这个日志文件会变得非常大，分析的时候很难操作，所以需要对日志文件进行分割，可以根据访问量来进行选择：如按照天分割、或者半天、小时等。

建议使用shell脚本方式进行切割日志 。

#### 1. 编写脚本

脚本如下：

```shell
#!/bin/sh
#根路径
BASE_DIR=/usr/local/nginx
#最开始的日志文件名
BASE_FILE_NAME_ACCESS=access.log
BASE_FILE_NAME_ERROR=error.log
BASE_FILE_NAME_PID=nginx.pid
#默认日志存放路径
DEFAULT_PATH=$BASE_DIR/logs
#日志备份根路径
BASE_BAK_PATH=$BASE_DIR/datalogs

BAK_PATH_ACCESS=$BASE_BAK_PATH/access
BAK_PATH_ERROR=$BASE_BAK_PATH/error

#默认日志文件路径+文件名
DEFAULT_FILE_ACCESS=$DEFAULT_PATH/$BASE_FILE_NAME_ACCESS
DEFAULT_FILE_ERROR=$DEFAULT_PATH/$BASE_FILE_NAME_ERROR
#备份时间
BAK_TIME=`/bin/date -d yesterday +%Y%m%d%H%M`
#备份文件 路径+文件名
BAK_FILE_ACCESS=$BAK_PATH_ACCESS/$BAK_TIME-$BASE_FILE_NAME_ACCESS
BAK_FILE_ERROR=$BAK_PATH_ERROR/$BAK_TIME-$BASE_FILE_NAME_ERROR
        
# 打印一下备份文件 
echo access.log备份成功：$BAK_FILE_ACCESS
echo error.log备份成功：$BAK_FILE_ERROR

#移动文件
mv $DEFAULT_FILE_ACCESS $BAK_FILE_ACCESS
mv $DEFAULT_FILE_ERROR $BAK_FILE_ERROR

#向nginx主进程发信号重新打开日志
kill -USR1 `cat $DEFAULT_PATH/$BASE_FILE_NAME_PID`

```

 其实很简单，主要步骤如下：

- 1.移动日志文件：这里已经将日志文件移动到``datalogs`目录下了，但Nginx还是会继续往这里面写日志
- 2.发送`USR1`命令：告诉Nginx把日志写到``Nginx.conf`中配置的那个文件中，这里会重新生成日志文件

具体如下：

- **第一步**:就是重命名日志文件，不用担心重命名后nginx找不到日志文件而丢失日志。在你未重新打开原名字的日志文件前(即执行第二步之前)，nginx还是会向你重命名的文件写日志，Linux是靠`文件描述符`而不是`文件名`定位文件。
- **第二步**:向nginx主进程发送`USR1信号`。nginx主进程接到信号后会从配置文件中读取日志文件名称，重新打开日志文件(以配置文件中的日志名称命名)，并以工作进程的用户作为日志文件的所有者。重新打开日志文后，nginx主进程会关闭重名的日志文件并通知工作进程使用新打开的日志文件。(就不会继续写到前面备份的那个文件中了)工作进程立刻打开新的日志文件并关闭重名名的日志文件。然后你就可以处理旧的日志文件了。

#### 2. 赋权

```nginx
[root@localhost sbin]# chmod 777 log.sh 
```

将`log.sh`脚本设置为可执行文件

#### 3. 执行

设置一个定时任务用于周期性的执行该脚本

`cron`是一个linux下的定时执行工具，可以在无需人工干预的情况下运行作业。

```shell
service crond start   //启动服务

service crond stop    //关闭服务

service crond restart  //重启服务

service crond reload  //重新载入配置

service crond status  //查看服务状态 
```

**设置定时任务**：

```nginx
[root@localhost datalogs]# crontab -e

*/1 * * * * sh /usr/local/nginx/sbin/log.sh
```

`*/1 * * * *`： 为定时时间 这里为了测试 是设置的每分钟执行一次；

`0 2 * * * ` :每天凌晨两点执行

`sh` ：为任务类型 这里是一个sh脚本

`/usr/local/nginx/sbin/log.sh` ：为脚本路径

#### 4. Nginx信号量

Nginx支持以下几种信号选项：

* **TERM，INT** :  快速关闭
* **QUIT** ：从容关闭（优雅的关闭进程,即等请求结束后再关闭)
* **HUP** ：平滑重启，重新加载配置文件 （平滑重启，修改配置文件之后不用重启服务器。直接kill -PUT 进程号即可）
* **USR1** ：重新读取日志文件，在切割日志时用途较大（停止写入老日志文件，打开新日志文件，之所以这样是因为老日志文件就算修改的文件名，由于inode的原因，nginx还会一直往老的日志文件写入数据） 
* **USR2** ：平滑升级可执行程序  ，nginx升级时候用                           　　　　 
* **WINCH** ：从容关闭工作进程 

## 2.cron表达式

### 2.1 基本语法

　cron表达式代表一个时间的集合，使用6个空格分隔的字段表示：

| 字段名            | 是否必须 | 允许的值        | 允许的特定字符 |
| ----------------- | -------- | --------------- | -------------- |
| 秒(Seconds)       | 是       | 0-59            | * / , -        |
| 分(Minute)        | 是       | 0-59            | * / , -        |
| 时(Hours)         | 是       | 0-23            | * / , -        |
| 日(Day of month)  | 是       | 1-31            | * / , - ?      |
| 月(Month)         | 是       | 1-12 或 JAN-DEC | * / , -        |
| 星期(Day of week) | 否       | 0-6 或 SUM-SAT  | * / , - ?      |

注：月(Month)和星期(Day of week)字段的值不区分大小写，如：SUN、Sun 和 sun 是一样的。 

**星期字段没提供相当于`*`**

**一般只需要写5位就行了。即 `分 时 日 月 周`**

```java
 # ┌───────────── min (0 - 59)
 # │ ┌────────────── hour (0 - 23)
 # │ │ ┌─────────────── day of month (1 - 31)
 # │ │ │ ┌──────────────── month (1 - 12)
 # │ │ │ │ ┌───────────────── day of week (0 - 6) (0 to 6 are Sunday to
 # │ │ │ │ │                  Saturday, or use names; 7 is also Sunday)
 # │ │ │ │ │
 # │ │ │ │ │
 # * * * * *  command to execute
```

### 2.2 特定字符

- **星号(*)**:表示 cron 表达式能匹配该字段的所有值。如在第2个字段使用星号(hour)，表示每小时
- **斜线(/)**:表示增长间隔，如第1个字段(minutes) 值是 `3/1`，表示每小时的第3分钟开始执行一次，之后每隔1分钟执行一次（1,2,3,4....59都执行一次）
- **逗号(,)**:用于枚举值，如第6个字段值是 MON,WED,FRI，表示 星期一、三、五 执行。
- **连字号(-)**:表示一个范围，如第3个字段的值为 9-17 表示 9am 到 5pm 之间每个小时（包括9和17）
- **问号(?)**:只用于 日(Day of month) 和 星期(Day of week)，表示不指定值，可以用于代替 *

## 3. 参考

`https://www.cnblogs.com/crazylqy/p/6891929.html`

`http://www.runoob.com/linux/nginx-install-setup.html`