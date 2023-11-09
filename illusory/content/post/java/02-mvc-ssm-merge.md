---
title: "MVC和三层架构及SSM框架整合"
description: "学习SSM框架时的记录"
date: 2018-08-15 22:00:00
draft: false
categories: ["Java"]
tags: ["Java"]
---

本文主要讲了MVC和三层架构的关系，和SSM框架整合教程。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1.三层架构

整体分为三层,`表现层UI`,`业务逻辑层BLL`,`数据访问层DAL`.

- 表现层  Controller  用户界面,负责与用户进行交互 
- 业务逻辑层  Service   具体的业务操作 
- 数据访问层   Dao  对数据库进行操作,为上层提供数据   

![](https://github.com/lixd/blog/raw/master/images/java/ssm/3tier.png)

为了更好的降低各层间的耦合度，在三层架构程序设计中，采用面向抽象编程。即上层对下层的调用，是通过接口实现的。而下层对上层的真正服务提供者，是下层接口的实现类。服务标准（接口）是相同的，服务提供者（实现类）可以更换。这就实现了层间的耦合。 

![](https://github.com/lixd/blog/raw/master/images/java/ssm/3tier-interface.png)



## 2.MVC

 MVC全名是Model View Controller，是`模型(model)`－`视图(view)`－`控制器(controller)`的缩写 .

- **Model（模型）** - 模型代表一个存取数据的对象或 JAVA POJO。它也可以带有逻辑，在数据变化时更新控制器。
- **View（视图）** - 视图代表模型包含的数据的可视化。
- **Controller（控制器）** - 控制器作用于模型和视图上。它控制数据流向模型对象，并在数据变化时更新视图。它使视图与模型分离开。

![](https://github.com/lixd/blog/raw/master/images/java/ssm/mvc.png)

## 3.MVC与三层架构

- 经典三层架构和MVC的关系？----->	他们是两个毫无相关的东西
  - 经典三层架构是一种分层思想，将开发模式分为了这三层
  - MVC是一种设计模式，目的是让HTML代码和业务逻辑代码分开，让代码看起来更加清晰，便于开发

![mvc和三层架构](https://github.com/illusorycloud/illusorycloud.github.io/raw/hexo/myImages/ssm/3tier-mvc.jpg)



## 4.SSM框架和三层架构

SSM即SpringMVC、Spring、Mybatis三个框架。它们在三层架构中所处的位置是不同的，即它们在三层架构中的功能各不相同，各司其职。

- SpringMVC：作为View层的实现者，完成用户的请求接收功能。SpringMVC的Controller作为整个应用的控制器，完成用户请求的转发及对用户的响应。
- MyBatis：作为 Dao层的实现者，完成对数据库的增、删、改、查功能。
- Spring：以整个应用大管家的身份出现。整个应用中所有的Bean的生命周期行为，均由Spring来管理。即整个应用中所有对象的创建、初始化、销毁，及对象间关联关系的维护，均由Spring进行管理。

 ![](https://github.com/lixd/blog/raw/master/images/java/ssm/3tier-ssm.jpg)

## 5.SSM框架配置

### 5.1 目录

- Controller 

  - springmvc.xml
    - 包扫描--controller
    - 注解驱动
    - 视图解析器
  - web.xml
    - DispatcherServlet
    - 监听器

- Service

  - applicationContext-service.xml
    - 包扫描--service
  - applicationContext-trans.xml
    - 事务管理器
    - 通知
    - 切面

- Dao

  - SqlMapConfig.xml
  - applicationContext-dao.xml
    - dataSource
    - SqlSessionFactory
    - 包扫描--mapper


### 5.2 springmvc.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:p="http://www.springframework.org/schema/p"
	xmlns:context="http://www.springframework.org/schema/context"
	xmlns:mvc="http://www.springframework.org/schema/mvc"
	xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
        http://www.springframework.org/schema/mvc http://www.springframework.org/schema/mvc/spring-mvc-4.0.xsd
        http://www.springframework.org/schema/context http://www.springframework.org/schema/context/spring-context-4.0.xsd">
	<!-- 配置Controller扫描 -->
	<context:component-scan base-package="com.lillusory.crm.controller" />
	<!-- 加载属性文件-->
	<context:property-placeholder location="classpath:crm.properties"/>

	<!-- 配置注解驱动 -->
	<mvc:annotation-driven />

	<!-- 配置视图解析器 -->
	<bean	class="org.springframework.web.servlet.view.InternalResourceViewResolver">
		<!-- 前缀 -->
		<property name="prefix" value="/WEB-INF/jsp/" />
		<!-- 后缀 -->
		<property name="suffix" value=".jsp" />
	</bean>
</beans>
```

### 5.3 applicationContext-dao

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	xmlns:context="http://www.springframework.org/schema/context" xmlns:p="http://www.springframework.org/schema/p"
	xmlns:aop="http://www.springframework.org/schema/aop" xmlns:tx="http://www.springframework.org/schema/tx"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
	http://www.springframework.org/schema/context http://www.springframework.org/schema/context/spring-context-4.0.xsd
	http://www.springframework.org/schema/aop http://www.springframework.org/schema/aop/spring-aop-4.0.xsd http://www.springframework.org/schema/tx http://www.springframework.org/schema/tx/spring-tx-4.0.xsd
	http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util-4.0.xsd">

<!-- 配置 读取properties文件 jdbc.properties -->
	<context:property-placeholder location="classpath:jdbc.properties" />

	<!-- 配置 数据源 -->
	<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
		<property name="driverClassName" value="${jdbc.driver}" />
		<property name="url" value="${jdbc.url}" />
		<property name="username" value="${jdbc.username}" />
		<property name="password" value="${jdbc.password}" />
	</bean>

	<!-- 配置SqlSessionFactory -->
	<bean class="org.mybatis.spring.SqlSessionFactoryBean">
		<!-- 设置MyBatis核心配置文件 -->
		<property name="configLocation" value="classpath:SqlMapConfig.xml" />
		<!-- 设置数据源 -->
		<property name="dataSource" ref="dataSource" />
		<property name="typeAliasesPackage" value="com.lillusory.crm.domain"></property>
	</bean>

	<!-- 配置Mapper扫描 -->
	<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
		<!-- 设置Mapper扫描包 -->
		<property name="basePackage" value="com.lillusory.crm.mapper" />
	</bean>
</beans>
```

### 5.4 applicationContext-service.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	xmlns:context="http://www.springframework.org/schema/context" xmlns:p="http://www.springframework.org/schema/p"
	xmlns:aop="http://www.springframework.org/schema/aop" xmlns:tx="http://www.springframework.org/schema/tx"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
	http://www.springframework.org/schema/context http://www.springframework.org/schema/context/spring-context-4.0.xsd
	http://www.springframework.org/schema/aop http://www.springframework.org/schema/aop/spring-aop-4.0.xsd http://www.springframework.org/schema/tx http://www.springframework.org/schema/tx/spring-tx-4.0.xsd
	http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util-4.0.xsd">
<!-- 包扫描 -->
<context:component-scan base-package="com.lillusory.crm.service"/>
</beans>
```

### 5.5 applicationContext-trans.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	xmlns:context="http://www.springframework.org/schema/context" xmlns:p="http://www.springframework.org/schema/p"
	xmlns:aop="http://www.springframework.org/schema/aop" xmlns:tx="http://www.springframework.org/schema/tx"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
	http://www.springframework.org/schema/context http://www.springframework.org/schema/context/spring-context-4.0.xsd
	http://www.springframework.org/schema/aop http://www.springframework.org/schema/aop/spring-aop-4.0.xsd http://www.springframework.org/schema/tx http://www.springframework.org/schema/tx/spring-tx-4.0.xsd
	http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util-4.0.xsd">

	<!-- 事务管理器 -->
	<bean id="transactionManager"	class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
		<!-- 数据源 -->
		<property name="dataSource" ref="dataSource" />
	</bean>

	<!-- 通知 -->
	<tx:advice id="txAdvice" transaction-manager="transactionManager">
		<tx:attributes>
			<!-- 传播行为 -->
			<tx:method name="save*" propagation="REQUIRED" />
			<tx:method name="insert*" propagation="REQUIRED" />
			<tx:method name="add*" propagation="REQUIRED" />
			<tx:method name="create*" propagation="REQUIRED" />
			<tx:method name="delete*" propagation="REQUIRED" />
			<tx:method name="update*" propagation="REQUIRED" />
			<tx:method name="find*" propagation="SUPPORTS" read-only="true" />
			<tx:method name="select*" propagation="SUPPORTS" read-only="true" />
			<tx:method name="get*" propagation="SUPPORTS" read-only="true" />
			<tx:method name="query*" propagation="SUPPORTS" read-only="true" />
		</tx:attributes>
	</tx:advice>

	<!-- 切面 -->
	<aop:config>
		<aop:advisor advice-ref="txAdvice"
			pointcut="execution(* com.lillusory.crm.service.*.*(..))" />
	</aop:config>
</beans>
```

### 5.6 SqlMapConfig.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE configuration PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
"http://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
<!-- 暂时什么都不用配置 -->
</configuration>
```

### 5.7 web.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://java.sun.com/xml/ns/javaee" xsi:schemaLocation="http://java.sun.com/xml/ns/javaee http://java.sun.com/xml/ns/javaee/web-app_2_5.xsd" id="WebApp_ID" version="2.5">
  <display-name>Demo-CRM</display-name>
  <welcome-file-list>
    <welcome-file>index.html</welcome-file>
    <welcome-file>index.htm</welcome-file>
    <welcome-file>index.jsp</welcome-file>
    <welcome-file>default.html</welcome-file>
    <welcome-file>default.htm</welcome-file>
    <welcome-file>default.jsp</welcome-file>
  </welcome-file-list>
  
  
  <!-- 配置spring -->
	<context-param>
		<param-name>contextConfigLocation</param-name>
		<param-value>classpath:spring/applicationContext-*.xml</param-value>
	</context-param>

	<!-- 配置监听器加载spring -->
	<listener>
		<listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
	</listener>

	<!-- 配置过滤器，解决post的乱码问题 -->
	<filter>
		<filter-name>encoding</filter-name>	<filter-class>org.springframework.web.filter.CharacterEncodingFilter</filter-class>
	</filter>
	<filter-mapping>
		<filter-name>encoding</filter-name>
		<url-pattern>/</url-pattern>
	</filter-mapping>

	<!-- 配置SpringMVC -->
	<servlet>
		<servlet-name>demo-crm</servlet-name>
		<servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
		<init-param>
			<param-name>contextConfigLocation</param-name>
			<param-value>classpath:spring/springmvc.xml</param-value>
		</init-param>
		<!-- 配置springmvc什么时候启动，参数必须为整数 -->
		<!-- 如果为0或者大于0，则springMVC随着容器启动而启动 -->
		<!-- 如果小于0，则在第一次请求进来的时候启动 -->
		<load-on-startup>1</load-on-startup>
	</servlet>
	<servlet-mapping>
		<servlet-name>demo-crm</servlet-name>
		<!-- 所有的请求都进入springMVC
		/        拦截所有除了jsp
		/* jsp也拦截 
		 -->
		<url-pattern>*.action</url-pattern>
	</servlet-mapping>
  
</web-app>
```

### 5.8其他常用配置

#### jdbc

```properties
jdbc.driver=com.mysql.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/kct?characterEncoding=utf-8
jdbc.username=root
jdbc.password=root
```

#### log4j

```properties
# Global logging configuration
log4j.rootLogger=debug, stdout
# Console output...
log4j.appender.stdout=org.apache.log4j.ConsoleAppender
log4j.appender.stdout.layout=org.apache.log4j.PatternLayout
log4j.appender.stdout.layout.ConversionPattern=%5p [%t] - %m%n
```

## 参考

`https://juejin.im/post/5929259b44d90400642194f3`

 

