---
title: "SSM系列(二)---Spring 常用注解分析"
description: "Spring 常用注解与配置记录"
date: 2018-10-05 22:00:00
draft: false
categories: ["Java"]
tags: ["Spring"]
---

本文主要对 Spring 框架中经常用到的注解与配置进行了说明。

<!--more-->

> 更多文章欢迎访问我的个人博客-->[幻境云图](https://www.lixueduan.com/)

## 1. Bean相关的注解

与SpringBean相关的注解有以下四大类：

* **@Controller** ：标注一个控制器组件类 `Controller层`
* **@Service**：标注一个业务逻辑组件类 `Service层`
* **@Repository** ：标注一个 DAO 组件类 `DAO层`
* **@Component** ：标注一个普通的 Spring Bean 类 前面三个都不是但又想交给Spring管理就用这个

## 2. @Autowired与@Resource区别

### 2.1 相同点

`@Resource`的作用相当于`@Autowired`，均可标注在`字段`或属性的`setter方法`上。

### 2.2 不同点

#### 1. 提供方 

`@Autowired` 是 `Spring` 提供的注解；

`@Resource`是`J2EE`提供的注解，javax.annotation 包下的注解，来自于JSR-250，需要JDK1.6及以上。

#### 2. 注入方式 
`@Autowired`只按照`Type` 注入；

`@Resource` 默认按Name自动注入，也提供按照Type 注入；

#### 3. 属性
`@Autowired`注解可用于为类的属性、构造器、方法进行注值。

默认情况下，其依赖的对象必须存在(bean可用)，如果需要改变这种默认方式，可以设置其 required 属性为false。
`@Autowired`注解`默认`按照`类型`装配，如果容器中包含多个同一类型的Bean，那么启动容器时会报找不到指定类型bean的异常，解决办法是结合 **@Qualifier** 注解进行限定，指定注入的bean名称。

`@Resource`有两个中重要的属性：`name`和`type`。

name 属性指定 byName，如果没有指定 name 属性:

当注解标注在字段上，即默认取字段的名称作为 bean 名称寻找依赖对象，
当注解标注在属性的setter方法上，即默认取属性名作为bean名称寻找依赖对象。
`@Resource`如果没有指定name属性，并且按照默认的名称仍然找不到依赖对象时， @Resource注解会回退到按类型装配。但一旦指定了name属性，就只能按名称装配了。

#### 4. 其他

`@Autowired`注解进行装配容易抛出异常，特别是装配的 bean 类型有多个的时候,解决的办法是增加 @Qualifier 注解进行限定。

`@Resource`注解的使用性更为灵活，可指定名称，也可以指定类型；

## 3. context:annotation-config与context:component-scan

### 3.1 context:annotation-config

我们一般在含有 Spring 的项目中，可能会看到配置项中包含这个配置节点

```xml
<context:annotation-config>
```

这条配置会向 Spring 容器中注册以下4个 BeanPostProcessor 

* AutowiredAnnotationBeanPostProcessor

* CommonAnnotationBeanPostProcessor

* PersistenceAnnotationBeanPostProcessor

* RequiredAnnotationBeanPostProcessor

**注册这4个 BeanPostProcessor 的作用，就是为了你的系统能够识别相应的注解**。

如果想使用 `@Resource` 、`@PostConstruct`、`@PreDestroy`等注解就必须声明`CommonAnnotationBeanPostProcessor`。 
如果想使用` @PersistenceContext`注解，就必须声明`PersistenceAnnotationBeanPostProcessor`的Bean。 
如果想使用 @Autowired注解，那么就必须声明` AutowiredAnnotationBeanPostProcessor `的 Bean。
如果想使用 `@Required`的注解，就必须声明`RequiredAnnotationBeanPostProcesso`r的Bean。

**所以如果不加一句`context:annotation-config`那么上面的这些注解就无法识别**。

### 3.2 context:component-scan

`context:component-scan`包括了`context:annotation-config`的功能，即注册 BeanPostProcessor 使系统能够识别上面的注解。

**同时还会自动扫描所配置的包下的 bean**。即 扫描包下面有`@Controller`、`@Service`、`@Repository`、`@Component`这四个注解的类，自动放入 Spring 容器。

所以一般写context:component-scan就行了。

### 3. 实例演示

就拿前面的 student 和 book 举例
实体类这样写,使用注解进行属性注入

```java
public class Student {
    @Value(value = "illusory")
    private String name;
    @Value(value = "23")
    private int age;
    @Autowired
    private Book book;
}
public class Book {
    @Value(value = "defaultType")
    private String type;
    @Value(value = "defaultName")
    private String name;
}
```

配置文件就不用写各种 property 属性注入了。

```xml
<property name="name" value="illusory"></property>
```

使用`@Autowired`后也不用配置引用对象了。

```xml
<property name="book" ref="book"></property>
```

但是还是需要在 xml配置 bean 的基本信息

```xml
  <bean id="student" class="spring.Student"></bean>
  <bean id="book" class="spring.Book"></bean>
   <context:annotation-config />
```


如果在实体类加上`@Component`注解

```java
@Component(value = "student")
public class Student {
    @Value(value = "illusory")
    private String name;
    @Value(value = "23")
    private int age;
    @Autowired
    private Book book;
}
```

就不用在xml中配置bean了,只需要在xml中配置

```xml
<context:component-scan base-package="spring"/>
```


系统可以识别到前面的注解，同时还会自动扫描包下的 bean。

这样xml中只要要一行就搞定了。

## 4. 自定义初始化与销毁方法

init-method destroy-method属性对应的注解

- @PostConstruct注解，在对象创建后调用
- @PreDestroy注解，在对象销毁前调用

```java
    @PostConstruct
    public void init() {
        System.out.println("init");
    }

    @PreDestroy
    public void destory() {
        System.out.println("destory");
    }
```



## 5. @Component和@Configuration 作为配置类的区别

### 5.1 概述

`@Component`和`@Configuration`都可以作为配置类,但还是有一定差别的。

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component  //看这里！！！
public @interface Configuration {
    String value() default "";
```

**Spring 中新的 Java 配置支持的核心就是 @Configuration 注解的类**。

这些类主要包括 @Bean 注解的方法来为 Spring 的 IoC 容器管理的对象定义实例，配置和初始化逻辑。

使用 @Configuration 来注解类表示类可以被 Spring 的 IoC 容器所使用，作为 bean 定义的资源。

```java
@Configuration
public class AppConfig {
    @Bean
    public MyService myService() {
        return new MyServiceImpl();
    }
}
```

这和 Spring 的 XML 文件中的非常类似

```xml
<beans>
    <bean id="myService" class="com.acme.services.MyServiceImpl"/>
</beans>
```

### 5.2 实例演示

```java
@Configuration
public static class Config {

    @Bean
    public SimpleBean simpleBean() {
        return new SimpleBean();
    }

    @Bean
    public SimpleBeanConsumer simpleBeanConsumer() {
        return new SimpleBeanConsumer(simpleBean());
    }
}

@Component
public static class Config {

    @Bean
    public SimpleBean simpleBean() {
        return new SimpleBean();
    }

    @Bean
    public SimpleBeanConsumer simpleBeanConsumer() {
        return new SimpleBeanConsumer(simpleBean());
    }
}
```

第一个代码正常工作，正如预期的那样，SimpleBeanConsumer 将会得到一个单例 SimpleBean 的链接。
第二个配置是完全错误的，虽然 Spring 会创建一个 SimpleBean 的单例bean，但是 SimpleBeanConsumer 将获得另一个SimpleBean实例（也就是相当于直接调用new SimpleBean() ，
这个bean是不归Spring管理的）。

### 5.3 原因

使用 `@Configuration` 所有标记为` @Bean`的方法将被包装成一个 `CGLIB包装器`，它的工作方式就好像是这个方法的第一个调用，那么原始方法的主体将被执行，最终的对象将在 Spring上下文中注册。所有进一步的调用只返回从上下文检索的 bean。

```java
public void enhanceConfigurationClasses(ConfigurableListableBeanFactory beanFactory) {
        Map<String, AbstractBeanDefinition> configBeanDefs = new LinkedHashMap<String, AbstractBeanDefinition>();
        for (String beanName : beanFactory.getBeanDefinitionNames()) {
            BeanDefinition beanDef = beanFactory.getBeanDefinition(beanName);
            //判断是否被@Configuration标注
            if (ConfigurationClassUtils.isFullConfigurationClass(beanDef)) {
                if (!(beanDef instanceof AbstractBeanDefinition)) {
                    throw new BeanDefinitionStoreException("Cannot enhance @Configuration bean definition '" +
                            beanName + "' since it is not stored in an AbstractBeanDefinition subclass");
                }
                else if (logger.isWarnEnabled() && beanFactory.containsSingleton(beanName)) {
                    logger.warn("Cannot enhance @Configuration bean definition '" + beanName +
                            "' since its singleton instance has been created too early. The typical cause " +
                            "is a non-static @Bean method with a BeanDefinitionRegistryPostProcessor " +
                            "return type: Consider declaring such methods as 'static'.");
                }
                configBeanDefs.put(beanName, (AbstractBeanDefinition) beanDef);
            }
        }
        if (configBeanDefs.isEmpty()) {
            // nothing to enhance -> return immediately
            return;
        }
        ConfigurationClassEnhancer enhancer = new ConfigurationClassEnhancer();
        for (Map.Entry<String, AbstractBeanDefinition> entry : configBeanDefs.entrySet()) {
            AbstractBeanDefinition beanDef = entry.getValue();
            // If a @Configuration class gets proxied, always proxy the target class
            beanDef.setAttribute(AutoProxyUtils.PRESERVE_TARGET_CLASS_ATTRIBUTE, Boolean.TRUE);
            try {
                // Set enhanced subclass of the user-specified bean class
                Class<?> configClass = beanDef.resolveBeanClass(this.beanClassLoader);
                //生成代理的class
                Class<?> enhancedClass = enhancer.enhance(configClass, this.beanClassLoader);
                if (configClass != enhancedClass) {
                    if (logger.isDebugEnabled()) {
                        logger.debug(String.format("Replacing bean definition '%s' existing class '%s' with " +
                                "enhanced class '%s'", entry.getKey(), configClass.getName(), enhancedClass.getName()));
                    }
                    //替换class，将原来的替换为CGLIB代理的class
                    beanDef.setBeanClass(enhancedClass);
                }
            }
            catch (Throwable ex) {
                throw new IllegalStateException("Cannot load configuration class: " + beanDef.getBeanClassName(), ex);
            }
        }
    }
```

`isFullConfigurationClass`代码如下：

```java
//是否为配置类
public static boolean isConfigurationCandidate(AnnotationMetadata metadata) {
return (isFullConfigurationCandidate(metadata) || isLiteConfigurationCandidate(metadata));
}

//是否为完整配置类
public static boolean isFullConfigurationCandidate(AnnotationMetadata metadata) {
return metadata.isAnnotated(Configuration.class.getName());
}
//是否为精简配置类
public static boolean isLiteConfigurationCandidate(AnnotationMetadata metadata) {
    // Do not consider an interface or an annotation...
    if (metadata.isInterface()) {
        return false;
    }

    // Any of the typical annotations found?
    for (String indicator : candidateIndicators) {
        if (metadata.isAnnotated(indicator)) {
            return true;
        }
    }

    // Finally, let's look for @Bean methods...
    try {
        return metadata.hasAnnotatedMethods(Bean.class.getName());
    }
    catch (Throwable ex) {
        if (logger.isDebugEnabled()) {
            logger.debug("Failed to introspect @Bean methods on class [" + metadata.getClassName() + "]: " + ex);
        }
        return false;
    }
}
//精简配置类包含的注解
static {
    candidateIndicators.add(Component.class.getName());
    candidateIndicators.add(ComponentScan.class.getName());
    candidateIndicators.add(Import.class.getName());
    candidateIndicators.add(ImportResource.class.getName());
}
```

## 6. 参考

`https://blog.csdn.net/long476964/article/details/80626930`

`https://www.jianshu.com/p/89f55286cf21`