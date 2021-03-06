---
title: "Shiro安全框架(二)---SpringBoot整合Shiro"
description: "在SpringBoot项目中整合Shiro安全框架记录"
date: 2019-03-27 22:00:00
draft: true
tags: ["Shiro"]
categories: ["Shiro"]
---

本文主要介绍了如何在SpringBoot项目中整合Shiro安全框架，包括详细步骤和具体实例代码。

<!--more-->

> **[Shiro安全框架系列文章目录](https://www.lixueduan.com/categories/Shiro/)**
>
> [Shiro安全框架(一)---什么是Shiro](https://www.lixueduan.com/posts/7dd8d38.html)
>
> [Shiro安全框架(二)---SpringBoot整合Shiro](https://www.lixueduan.com/posts/fd462737.html)
>
>  [Shiro安全框架(三)---Shiro组件详解](https://www.lixueduan.com/posts/f8844037.html)
>
> 源码下载：[GItHub](https://github.com/illusorycloud/springboot-learning)
>
> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. 添加依赖

普通项目引入方式：

```xml
       <!--shiro-->
        <dependency>
            <groupId>org.apache.shiro</groupId>
            <artifactId>shiro-spring</artifactId>
            <version>1.4.0</version>
        </dependency>
```

SpringBoot引入方式：

```xml
<dependency>
    <groupId>org.apache.shiro</groupId>
    <artifactId>shiro-spring-boot-starter</artifactId>
    <version>1.4.0</version>
</dependency>
```

## 2. 数据准备

### 2.1 Entity

一共有三个对象，User用户，Role角色，Permission权限。 将权限分配给角色，不同的角色拥有不同的权限，
然后给用户分配不同的角色，这样就达到了权限管理的效果。

> 这里用了lombok插件 编译时自动生成getter/setter等方法

```java
/**
 * @author illusory
 * 权限实体类
 */
@Data
public class Permission {
    private Integer pid;
    private String permission;
    private Set<Role> roles = new HashSet<>();
}

/**
 * @author illusory
 * 角色实体类
 */
@Data
public class Role {
    private Integer rid;
    private String rname;
    private Set<User> users = new HashSet<>();
    private Set<Permission> permissions = new HashSet<>();
}

/**
 * @author illusory
 * 用户实体类
 */
@Data
public class User {
    private Integer uid;
    private String uname;
    private String upwd;
    private String salt;
    private Set<Role> roles=new HashSet<>();
}
```

### 2.2 DataBase

这里主要涉及到五张表:`用户表`,`角色表(用户所拥有的角色)`,`权限表(角色所涉及到的权限)`,`用户-角色表(用户和角色是多对多的)`,`角色-权限表(角色和权限是多对多的)`.
表结构建立的sql语句如下:

```mysql
-- 新建一个数据库
CREATE DATABASE shiro;
USE shiro;

-- 用户表
DROP TABLE IF EXISTS USER;
CREATE TABLE USER(
id INT PRIMARY KEY AUTO_INCREMENT,
NAME VARCHAR(4),
pwd VARCHAR(8) 
);
INSERT INTO USER VALUES(NULL,'张三','qwer'),(NULL,'李四','qwer');

-- 权限表
DROP TABLE IF EXISTS permission;
CREATE TABLE permission(
id INT PRIMARY KEY AUTO_INCREMENT,
permission VARCHAR(10)
);
INSERT INTO permission VALUES(NULL,'add'),
(NULL,'delete'),
(NULL,'update'),
(NULL,'query');

-- 角色表
DROP TABLE IF EXISTS role;
CREATE TABLE role(
id INT PRIMARY KEY AUTO_INCREMENT,
NAME VARCHAR(10));
INSERT INTO role VALUES(NULL,'admin'),(NULL,'customer');

-- 权限-角色表
DROP TABLE IF EXISTS permission_role;
CREATE TABLE permission_role(
pid INT(3),
CONSTRAINT  fk_permission FOREIGN KEY(pid) REFERENCES permission(id),
rid INT(3),
CONSTRAINT  fk_role FOREIGN KEY(rid) REFERENCES role(id)
);

-- 管理员有4个权限 用户只有查询权限
INSERT INTO permission_role VALUES(1,1),(2,1),(3,1),(4,1),(4,2);

-- 用户-角色表
DROP TABLE IF EXISTS user_role;
CREATE TABLE user_role(
uid INT(3),
CONSTRAINT  fk_user FOREIGN KEY(uid) REFERENCES USER(id),
rid INT(3),
CONSTRAINT  fk_roles FOREIGN KEY(rid) REFERENCES role(id)
);
-- 张三为管理员 李四为用户
INSERT INTO user_role VALUES(1,1),(2,2);
```

## 3 Mapper

### 3.1 UserMapper.java

```java
public interface UserMapper {
    User findUserByName(String name);

    User findUserJustByName(String name);

    List<String> selectPermissionByUserId(Integer id);
}
```

### 3.2 UserMapper.xml

```xml
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.shiro.mapper.UserMapper">
    <resultMap type="User" id="userMap">
        <id property="uid" column="id" />
        <result property="uname" column="name" />
        <result property="upwd" column="pwd" />
        <collection property="roles" ofType="Role">
            <id property="rid" column="id" />
            <result property="rname" column="name" />
            <collection property="permissions" ofType="Permission">
                <id property="pid" column="id" />
                <result property="permission" column="permission" />
            </collection>
        </collection>
    </resultMap>
    <select id="findUserByName" parameterType="string" resultMap="userMap">
        SELECT u.*,r.*,p.*
        FROM USER u
                 INNER JOIN user_role ur ON ur.uid = u.id
                 INNER JOIN role r ON r.id = ur.rid
                 INNER JOIN permission_role pr ON pr.rid = r.id
                 INNER JOIN permission p ON pr.pid = p.id
        WHERE u.name = #{name};
    </select>
    <select id="selectPermissionByUserId" parameterType="integer" resultType="string">
SELECT permission FROM permission p INNER JOIN permission_role pr ON p.id=pr.pid
INNER JOIN user_role ur ON ur.rid=pr.rid
WHERE ur.uid=#{id}
    </select>
</mapper>
```

## 4. Service

### 4.1 UserService

```java
public interface UserService {
    User findUserByName(String name);

    User findUserJustByName(String name);

    List<String> selectPermissionByUserId(Integer id);
}
```

### 4.2 UserServiceImpl

```java
@Service
public class UserServiceImpl implements UserService {
    @Resource
    private UserMapper userMapper;

    @Override
    public User findUserByName(String name) {
        return userMapper.findUserByName(name);
    }

    @Override
    public User findUserJustByName(String name) {
        return userMapper.findUserJustByName(name);
    }

    @Override
    public List<String> selectPermissionByUserId(Integer id) {
        return userMapper.selectPermissionByUserId(id);
    }
}
```

## 5. Shiro配置(重点)

Shiro中唯一需要配置的就是`Realm`,完成根据用户名去数据库的查询,并且将用户信息放入`Shiro`中。

### 5.1 Realm

```java
/**
 * @author illusory
 */
public class AuthRealm extends AuthorizingRealm {
    @Autowired
    private UserServiceImpl userService;

    /**
     * 授权
     *
     * @param principalCollection
     * @return
     */
    @Override
    protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principalCollection) {
        // 1.获取principalCollection中的用户
        User user = (User) principalCollection.fromRealm(this.getClass().getName()).iterator().next();
        // 2.通过数据库查询当前userde权限
        List<String> permissions = userService.selectPermissionByUserId(user.getUid());
        SimpleAuthorizationInfo simpleAuthorizationInfo = new SimpleAuthorizationInfo();
        // 3.将权限放入shiro中.
        simpleAuthorizationInfo.addStringPermissions(permissions);
        System.out.println("-------------授权-------------");
        // 4.返回
        return simpleAuthorizationInfo;
    }

    /**
     * 完成身份认证并返回认证信息
     * 认证失败则返回空
     *
     * @param authenticationToken
     * @return
     * @throws AuthenticationException
     */
    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken authenticationToken) throws AuthenticationException {
        // 1.用户输入的token
        UsernamePasswordToken usernamePasswordToken = (UsernamePasswordToken) authenticationToken;
        String username = usernamePasswordToken.getUsername();
        User user = userService.findUserByName(username);
        System.out.println("获取到的密码" + user.getUpwd());
        // 2.返回
        return new SimpleAuthenticationInfo(user, user.getUpwd(), this.getClass().getName());
    }
}
```

### 5.2 Bean注册

#### 1. ShiroRealm

将实现好的 ShiroRealm 注册为Bean，并初始化 `WebSecurityManager`

```java
@Configuration
public class ShiroConfiguration {
    @Bean
    public Realm realm() {
        return new AuthRealm();
    }

    @Bean
    public DefaultWebSecurityManager securityManager() {
        DefaultWebSecurityManager securityManager = new DefaultWebSecurityManager();
        securityManager.setRealm(realm());
        return securityManager;
    }
}
```

#### 2. URL配置

```java
@Configuration
public class ShiroConfiguration {
    @Bean(name = "shiroFilterFactoryBean ")
    public ShiroFilterFactoryBean shiroFilterFactoryBean(@Qualifier("securityManager") SecurityManager manager) {
        ShiroFilterFactoryBean bean = new ShiroFilterFactoryBean();
        bean.setSecurityManager(manager);

        //1.定义URL拦截链
        LinkedHashMap<String, String> filterChainDefinitionMap = new LinkedHashMap<>();
        // authc:所有url都必须认证通过才可以访问; anon:所有url都都可以匿名访问
        filterChainDefinitionMap.put("/login.*", "anon");
        filterChainDefinitionMap.put("/logout*", "anon");
        filterChainDefinitionMap.put("/hello", "anon");
        filterChainDefinitionMap.put("/defaultKaptcha", "anon");
        filterChainDefinitionMap.put("/index.*", "authc");
        bean.setFilterChainDefinitionMap(filterChainDefinitionMap);

        //2.配置用于登录的url和登录成功的url
        bean.setLoginUrl("/login");
        bean.setSuccessUrl("/index");
        bean.setUnauthorizedUrl("/403");

        return bean;
    }

    //url配置
    @Bean
    public ShiroFilterChainDefinition shiroFilterChainDefinition() {
        DefaultShiroFilterChainDefinition chainDefinition = new DefaultShiroFilterChainDefinition();
        // logged in users with the 'admin' role
        chainDefinition.addPathDefinition("/admin/**", "authc, roles[admin]");

        // logged in users with the 'document:read' permission
        chainDefinition.addPathDefinition("/docs/**", "authc, perms[document:read]");

        // all other paths require a logged in user
        chainDefinition.addPathDefinition("/**", "authc");
        return chainDefinition;
    }
}
```

#### 3. 404问题

```java
@Configuration
public class ShiroConfiguration {
/**
     * 解决spring aop和注解配置一起使用的bug。如果您在使用shiro注解配置的同时，引入了spring aop的starter，
     * 会有一个奇怪的问题，导致shiro注解的请求，不能被映射，需加入这个配置
     */
    @Bean
    public static DefaultAdvisorAutoProxyCreator getDefaultAdvisorAutoProxyCreator() {
        DefaultAdvisorAutoProxyCreator defaultAdvisorAutoProxyCreator = new DefaultAdvisorAutoProxyCreator();
        /**
         * setUsePrefix(false)用于解决一个奇怪的bug。在引入spring aop的情况下。
         * 在@Controller注解的类的方法中加入@RequiresRole等shiro注解，会导致该方法无法映射请求，导致返回404。
         * 加入这项配置能解决这个bug
         */
        defaultAdvisorAutoProxyCreator.setUsePrefix(true);
        return defaultAdvisorAutoProxyCreator;
    }
}
```

## 6. 页面

### 6.1 login.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>用户登陆</title>
</head>
<body>
<form>
    用户名:<input type="text" name="uname"><br/>
    密码:<input type="password" name="upwd"><br/>
    <input type="submit" value="登陆"><br/>
</form>
</body>
</html>
```

### 6.2 index.html

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      xmlns:shiro="http://www.pollix.at/thymeleaf/shiro">
<head>
    <meta charset="UTF-8">
    <title>首页</title>
</head>
<body>
欢迎您，<span th:text="${user.uname}"></span>
<div>
    <p shiro:hasPermission="add">添加用户</p>
    <p shiro:hasPermission="delete">删除用户</p>
    <p shiro:hasPermission="update">更新用户</p>
    <p shiro:hasPermission="query">查询用户</p>
</div>
<a th:href="@{logout}">点我注销</a>
</body>
</html>
```

## 7. Controller

### 1. UserController

```java
@Controller
public class UserController {
    @RequestMapping(value = "/login")
    public String login(HttpServletRequest request, User inuser, String uname, String upwd) {
        UsernamePasswordToken usernamePasswordToken = new UsernamePasswordToken(uname, upwd);
        Subject subject = SecurityUtils.getSubject();
        try {
            //登录
            subject.login(usernamePasswordToken);
            User user = (User) subject.getPrincipal();
            request.getSession().setAttribute("user", user);
            return "index";
        } catch (AuthenticationException e) {
            return "login";
        }
    }

    @RequestMapping(value = "/logout")
    public String logout(HttpServletRequest request) {
        Subject subject = SecurityUtils.getSubject();
        // 执行注销
        if (subject.isAuthenticated()) {
            subject.logout();
        }
        request.getSession().removeAttribute("user");
        return "login";
    }
}
```

### 2. 异常处理

些常见的**登录异常**如下表，可按业务需要使用：

| 异常                          | 描述             |
| ----------------------------- | ---------------- |
| UnknownAccountException       | 找不到用户       |
| IncorrectCredentialsException | 用户名密码不正确 |
| LockedAccountException        | 用户被锁定       |
| ExcessiveAttemptsException    | 密码重试超过次数 |
| ExpiredCredentialsException   | 密钥已经过期     |

**注意** ：需要模糊处理账户或密码错误等情况。

## 8. Thymeleaf引入Shiro标签

### 8.1 引入thymeleaf-extras-shiro

在`pom.xml`中添加依赖

```xml
<dependency>
    <groupId>com.github.theborakompanioni</groupId>
    <artifactId>thymeleaf-extras-shiro</artifactId>
    <version>2.0.0</version>
</dependency>
```

### 8.2 Shiro配置文件修改

引入依赖后，需要在ShiroConfig中配置该方言标签：

```java
@Configuration
public class ShiroConfiguration {
    /**
     * Thymeleaf中使用shiro标签
     */
    @Bean
    public ShiroDialect shiroDialect() {
        return new ShiroDialect();
    }
}
```

### 8.3 使用

#### 1. html中引入

```html
<html xmlns:th="http://www.thymeleaf.org"
       xmlns:shiro="http://www.pollix.at/thymeleaf/shiro">
```

#### 2. 使用

```html
<p shiro:hasPermission="add">添加用户</p> 
```

有`add`权限时才会显示`添加用户`

#### 3. 例子

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      xmlns:shiro="http://www.pollix.at/thymeleaf/shiro">

<head>
    <meta charset="UTF-8">
    <title>首页</title>
</head>
<body>
欢迎您，<span th:text="${user.uname}"></span>
<div>
    <p shiro:hasPermission="add">添加用户</p>
    <p shiro:hasPermission="delete">删除用户</p>
    <p shiro:hasPermission="update">更新用户</p>
    <p shiro:hasPermission="query">查询用户</p>
</div>
<a th:href="@{logout}">点我注销</a>
</body>
</html>
```

## 9. 测试

运行程序后进入登录页面，登录用户`张三`可以看到

```xml
添加用户
删除用户
更新用户
查询用户
```

所有的四个操作。

登录用户`李四`只能看到

```xml
查询用户
```

说明Shiro权限控制配置成功了。

## 10. 参考

`官方文档：http://shiro.apache.org/documentation.html`

`https://mrbird.cc/Spring-Boot-Themeleaf%20Shiro%20tag.html`