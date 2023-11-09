---
title: "SpringBoot系列(三)---Spring Boot 整合 Mybatisf"
description: "SpringBoot项目中整合Mybatis框架与Druid数据库连接池记录"
date: 2019-03-11 22:00:00
draft: true
tags: ["Java"]
categories: ["SpringBoot"]
---

本文主要记录了如何在SpringBoot项目中整合Mybatis框架与Druid数据库连接池,同时超详细的记录了具体步骤与代码实现。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. Druid

Druid 是阿里巴巴开源平台上的一个项目，整个项目由数据库连接池、插件框架和 SQL 解析器组成。该项目主要是为了扩展 JDBC 的一些限制，可以让程序员实现一些特殊的需求，比如向密钥服务请求凭证、统计 SQL 信息、SQL 性能收集、SQL 注入检查、SQL 翻译等，程序员可以通过定制来实现自己需要的功能。

Druid 是目前最好的数据库连接池，在功能、性能、扩展性方面，都超过其他数据库连接池，包括 DBCP、C3P0、BoneCP、Proxool、JBoss DataSource。Druid 已经在阿里巴巴部署了超过 600 个应用，经过多年生产环境大规模部署的严苛考验。Druid 是阿里巴巴开发的号称为监控而生的数据库连接池！

### 1.1 引入依赖

在 `pom.xml` 文件中引入 `druid-spring-boot-starter` 依赖

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-starter</artifactId>
    <version>1.1.10</version>
</dependency>
```

引入数据库连接`mysql-connector-java`依赖

```xml
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <scope>runtime</scope>
</dependency>
```

### 1.2 配置 application.yml

在 `application.yml` 中配置数据库连接

```yml
spring:
  datasource:
    druid:
      url: jdbc:mysql://ip:port/dbname?useUnicode=true&characterEncoding=utf-8&useSSL=false
      username: root
      password: 123456
      initial-size: 1
      min-idle: 1
      max-active: 20
      test-on-borrow: true
      # MySQL 5.x: com.mysql.jdbc.Driver
      # MySQL 8.x: com.mysql.cj.jdbc.Driver
      driver-class-name: com.mysql.cj.jdbc.Driver
```

## 2. Mybatis

### 2.1 引入依赖

```xml
 		<dependency>
            <groupId>org.mybatis.spring.boot</groupId>
            <artifactId>mybatis-spring-boot-starter</artifactId>
            <version>1.3.2</version>
        </dependency>
```

### 2.2 配置 application.yml

```yml
mybatis:
  type-aliases-package: com.illusory.hello.spring.boot.domain
  mapper-locations: classpath:mapper/*.xml
```

## 3. 测试

### 3.1 创建数据库

```mysql
CREATE DATABASE hello;
USE hello;
CREATE TABLE users(
uid INT(5)  AUTO_INCREMENT COMMENT '用户ID',
uname VARCHAR(20) COMMENT '用户名',
uage INT(3) COMMENT '用户年龄',
PRIMARY KEY(uid)
) COMMENT='用户表';
INSERT INTO users VALUES(NULL,'zhangsan',11),(NULL,'lisi',22),(NULL,'wangwu',33);
```

### 3.2 User



```java
package com.illusory.hello.spring.boot.domain;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 13:58
 */
public class User {
    private int uid;
    private String uname;
    private int uage;
    //省略Getter/Setter
}
```

### 3.3 UserMapper

`com/illusory/hello/spirng/boot/mapper/UserMapper`

```java
package com.illusory.hello.spring.boot.mapper;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 13:58
 */
public interface UserMapper {
    List<User> queryAll();
}
```

`resources/mapper/UserMapper.xml`

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.illusory.hello.spring.boot.mapper.UserMapper">
<select id="queryAll" resultType="user">
    SELECT u.uid,u.uname,u.uage
    FROM users as u
</select>
</mapper>
```

### 3.4 Serivce

```java
package com.illusory.hello.spring.boot.service;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 14:08
 */
public interface UserService {
    List<User> queryAll();
}

```

```java
package com.illusory.hello.spring.boot.service.impl;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 14:09
 */
@Service
public class UserServiceImpl implements UserService {
    @Resource
    private UserMapper userMapper;

    @Override
    public List<User> queryAll() {
        return userMapper.queryAll();
    }
}

```

### 3.5 UserController

```java
package com.illusory.hello.spring.boot.controller;

/**
 * @author illusoryCloud
 * @version 1.0.0
 * @date 2019/3/15 14:34
 */
@Controller
public class UserController {
    @Autowired
    private UserService userService;

    @RequestMapping(value = "/users", method = RequestMethod.GET)
    public String users(Model model) {
        List<User> users = userService.queryAll();
        model.addAttribute("users", users);
        return "index";
    }
}
```

### 3.6 HTML

```html
<!DOCTYPE html SYSTEM "http://www.thymeleaf.org/dtd/xhtml1-strict-thymeleaf-spring4-4.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:th="http://www.thymeleaf.org">
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>用户列表</title>
</head>
<body>
<div th:each="user : ${users}">
    <div th:text="${user.uname}"></div>
</div>
</body>
</html>
```

### 3.7 测试

浏览器访问`localhost:8080/users`显示

```text
zhangsan
lisi
wangwu
```

到此SpringBoot整合Mybatis完成。

