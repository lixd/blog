---
title: "SpringBoot系列(四)---Spring Boot 项目打包运行"
description: "如何在idea下打包SpringBoot项目并部署到云服务器记录"
date: 2019-03-13 22:00:00
draft: true
tags: ["Java"]
categories: ["SpringBoot"]
---

本文主要记录了如何在idea下打包SpringBoot项目并部署到云服务器，包括jar包和war包两种方式。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. 创建项目

首先简单创建一个`hello word`

代码如下：

```java
/**
 * 简单的controller
 *
 * @author illusoryCloud
 */
@RestController
public class HelloController {
    @RequestMapping(value = "/hello")
    public String showHello() {
        return "hello illusoryCloud";
    }
}

/**
 * SpringBoot启动类
 *
 * @author illusoryCloud
 */
@SpringBootApplication
public class HelloApplication {

    public static void main(String[] args) {
        SpringApplication.run(HelloApplication.class, args);
    }

}
```



## 2. 打包

### 2.1 jar包和war包区别

- SpringBoot默认支持很多模板引擎，但是JSP只能够在War中使用
- 无论是Jar还是War都能够使用嵌套容器，`java -jar`来独立运行
- 但只有war才能部署到外部容器中

### 2.2 jar包

**SpringBoot官方推荐打成jar包，服务器上有`JDK 1.8`以上环境就可以直接运行**

#### 1.修改pom.xml文件

选择打包方式为jar

```xml
    <groupId>com.illusory</groupId>
    <artifactId>hello</artifactId>
    <version>0.0.1-SNAPSHOT</version>    <!--版本号-->
    <name>hello</name>   		 <!--打出来的包的名字 hello-0.0.1-SNAPSHOT.jar-->
    <description>Demo project for Spring Boot</description>
    <packaging>jar</packaging>  		  <!--打包方式jar/war-->
```

#### 2. 打包

然后用maven打包。

![SpringBoot打包](https://github.com/lixd/blog/raw/master/images/java/springboot/project-package.png)

```java
[INFO] --- maven-jar-plugin:3.1.1:jar (default-jar) @ hello ---
[INFO] Building jar: D:\lillusory\MyProjects\hello\target\hello-0.0.1-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot-maven-plugin:2.1.3.RELEASE:repackage (repackage) @ hello ---
[INFO] Replacing main artifact with repackaged archive
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  23.922 s
[INFO] Finished at: 2019-02-22T20:35:40+08:00
[INFO] ------------------------------------------------------------------------
```

日志中可以看到打出来的包在`D:\lillusory\MyProjects\hello\target\hello-0.0.1-SNAPSHOT.jar`

#### 3. 测试

SpringBoot内置了一个Tomcat，可以直接`java -jar jarName`运行。

![](https://github.com/lixd/blog/raw/master/images/java/springboot/jar-run.png)

浏览器访问`http://localhost:8080/hello`出现`hello illusoryCloud`说明运行起来了。

这里的端口号是`application.yml`全局配置文件中配置的端口号。

### 2.3 war包

同时也可以打成war包然后用服务器上的Tomcat启动。

#### 1.修改pom.xml

```xml
    <groupId>com.illusory</groupId>
    <artifactId>hello</artifactId>
    <version>0.0.1-SNAPSHOT</version>    <!--版本号-->
    <name>hello</name>   		 <!--打出来的包的名字 hello-0.0.1-SNAPSHOT.jar-->
    <description>Demo project for Spring Boot</description>
    <packaging>war</packaging>  		  <!--打包方式jar/war-->
<!--外置tomcat启动-->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
            <scope>provided</scope>
        </dependency>

```

**maven中的`  <scope>provided</scope>`表示这个jar包在编译测试等地方是需要的，但是打包不会一起打包进去，这也避免了此类构件当部署到目标容器后产生包依赖冲突**。由于SpringBoot内置了Tomcat所以这里需要重新配置一下，防止冲突。

#### 2.改造启动类

**SpringBoot 内置的Tomcat能认识自己的启动项,而外部tomcat是不认识的**

所以需要修改启动类。即继承`SpringBootServletInitializer`类实现`configure`方法

```java
/**
 * SpringBoot启动类
 * 打成war包时需要改造 继承SpringBootServletInitializer实现configure方法
 * 打jar包则不需要
 *
 * @author illusoryCloud
 */
@SpringBootApplication
public class HelloApplication extends SpringBootServletInitializer {
    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
       //这里的HelloApplication是SpringBoot的启动类
        return builder.sources(HelloApplication.class);
    }

    public static void main(String[] args) {
        SpringApplication.run(HelloApplication.class, args);
    }

}

```

#### 3. 打包

和上面打包的方式一样的

```java
[INFO] Packaging webapp
[INFO] Assembling webapp [hello] in [D:\lillusory\MyProjects\hello\target\hello-0.0.1-SNAPSHOT]
[INFO] Processing war project
[INFO] Webapp assembled in [472 msecs]
[INFO] Building war: D:\lillusory\MyProjects\hello\target\hello-0.0.1-SNAPSHOT.war
[INFO] --- spring-boot-maven-plugin:2.1.3.RELEASE:repackage (repackage) @ hello ---
[INFO] Replacing main artifact with repackaged archive
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:00 min
[INFO] Finished at: 2019-02-22T21:10:10+08:00
[INFO] ------------------------------------------------------------------------
```

可以看到打出来的war包在`D:\lillusory\MyProjects\hello\target\hello-0.0.1-SNAPSHOT.war`

#### 4. 测试

先在电脑上测试一下(Windows环境下)

将war包复制到`Tomcat`的`webapps`文件夹下

然后找到`bin`目录下的`startup.bat`启动Tomcat，项目就会自动启动了。

浏览器访问`http://localhost:8080/hello-0.0.1-SNAPSHOT/hello` 出现`hello illusoryCloud`说明ok的。

这里`hello-0.0.1-SNAPSHOT`就是war包的名称，Tomcat启动时会自动解压war包然后启动项目。

这里的端口号和`application.yml`全局配置文件中配置的端口号没有关系，是Tomcat中配置的。

在`Tomcat\conf\server.xml`这个文件中，默认也是8080。

**问题**

我这里启动的时候出现了一个问题

`Caused by: java.lang.NoClassDefFoundError: javax/el/ELManager `

最后找到原因是**tomcat提供的`el-api.jar` 和项目里面的el-api.jar冲突**;

这时候你需要去找到自己电脑上用的el-api的版本,copy到tomcat的lib目录下,覆盖原来的jar包.

我的在`IntelliJ IDEA 2018.3\lib\rt\jasper2.1\el-api.jar`这个目录下

我看网上说是和Tomcat版本有关系，我这里是`7.0.52`

**Tomcat日志**

若是还有其他问题的话可以查看Tomcat日志。在`tomcat\logs\catalina.2019-02-22.log`这个文件中。

## 3. 部署

### 3.1 jar包

首先将文件上传到服务器上，服务器上有安装JDK8及以上的版本就可以直接运行。

[Linux下JDK的安装及配置点这里](https://www.lixueduan.com/posts/54978294.html)

#### 1. 前台运行

```shell
$ java -jar hello-0.0.1-SNAPSHOT.jar
```

但是这样运行的话是在前台运行，当前窗口关闭后就停止了,或者是运行时没法切出去执行其他任务.

#### 2. 后台运行

```shell
$ nohup java -jar hello-0.0.1-SNAPSHOT.jar >temp.txt &

//nohup 意思是不挂断运行命令,当账户退出或终端关闭时,程序仍然运行
//这种方法会把日志文件输入到你指定的文件中(temp.txt)
//在哪个目录下运行的该日志文件就会在哪个目录下，没有指定具体文件则会自动创建(nohup.out)
//& 表示后台运行
```

#### 3. 问题

执行以上命令后出现下面的提示

```shell
nohup: ignoring input and redirecting stderr to stdout
忽略输出 将错误输出重定向到标准输出
```

**原因**

`Linux`中`0`、`1`和`2`分别表示`标准输`入、`标准输出`和`标准错误信息输出`，可以用来指定需要重定向的标准输入或输出。在一般使用时，默认的是标准输出，即1。

例如：`2>temp.txt`  就是将错误信息写入temp.txt 标准输出还是显示在屏幕上。

另外，也可以实现0，1，2之间的重定向。`2>&1`：将错误信息重定向到标准输出。

Linux下还有一个特殊的文件`/dev/null`，它就像一个无底洞，所有重定向到它的信息都会消失得无影无踪。

如果想要`正常输出和错误信息都不显示`，则要把标准输出和标准错误都重定向到`/dev/null`， 例如：

 `1>/dev/null 2>/dev/null`

**解决办法**

所以最后的命令就是

```shell
  nohup java -jar hello-0.0.1-SNAPSHOT.jar >temp.txt 2>&1&
```

```shell
[root@localhost software]# nohup java -jar hello-0.0.1-SNAPSHOT.jar >temp.txt 2>&1&
[1] 22804
// 成功启动 pid为22804
```

#### 4. 测试

首先查看服务器的IP

```shell
[root@localhost software]# ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 00:0c:29:8a:48:7d brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.111/24 brd 192.168.1.255 scope global noprefixroute ens33
       valid_lft forever preferred_lft forever
    inet6 fe80::20c:29ff:fe8a:487d/64 scope link 
       valid_lft forever preferred_lft forever
3: virbr0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default qlen 1000
    link/ether 52:54:00:8e:d5:31 brd ff:ff:ff:ff:ff:ff
    inet 192.168.122.1/24 brd 192.168.122.255 scope global virbr0
       valid_lft forever preferred_lft forever
4: virbr0-nic: <BROADCAST,MULTICAST> mtu 1500 qdisc pfifo_fast master virbr0 state DOWN group default qlen 1000
    link/ether 52:54:00:8e:d5:31 brd ff:ff:ff:ff:ff:ff

```

然后浏览器访问`http://192.168.1.111:8080/hello`出现`hello illusoryCloud`说明成功了。

**记得关闭防火墙或者开放8080端口**

#### 5. 相关Linux命令

* jobs命令和 fg命令

```shell
$ jobs
//那么就会列出所有后台执行的作业，并且每个作业前面都有个编号。
[root@localhost software]# jobs
[1]+  Running    nohup java -jar hello-0.0.1-SNAPSHOT.jar > temp.txt 2>&1 &
//如果想将某个作业调回前台控制，只需要 fg + 编号即可。
$ fg 1
```

- 查看某端口占用的线程的pid

```shell
netstat -nlp |grep :8080
```

* kill

```shell
kill pid
```

### 3.2 war包

war包运行和在windows上运行其实一样的，也是**先将war包copy到Tomcat的webapps目录下，然后启动Tomcat，如果上面测试出现jar包冲突的话这里也需要替换**。

[Linux下Tomcat安装及配置点这里](https://www.lixueduan.com/posts/54978294.html)

#### 启动Tomcat

进入`Tomcat\bin`目录执行`./startup.sh`即可

```shell
[root@localhost bin]# ./startup.sh 
Using CATALINA_BASE:   /usr/local/tomcat
Using CATALINA_HOME:   /usr/local/tomcat
Using CATALINA_TMPDIR: /usr/local/tomcat/temp
Using JRE_HOME:        /usr/local/jdk8
Using CLASSPATH:       /usr/local/tomcat/bin/bootstrap.jar:/usr/local/tomcat/bin/tomcat-juli.jar
Tomcat started.
```

浏览器访问`http://192.168.1.111:8080/hello-0.0.1-SNAPSHOT/hello`出现`hello illusoryCloud`说明是没问题的。

## 4. 参考

`https://blog.csdn.net/qq_22638399/article/details/81506448`

`https://blog.csdn.net/c1481118216/article/details/53010963`

`https://blog.csdn.net/qq_14853889/article/details/80026885`