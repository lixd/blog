---
title: "Go语言之Context"
description: "context包结构分析及其基本使用介绍"
date: 2019-05-28 22:00:00
draft: true
tags: ["Golang"]
categories: ["Golang"]
---





# ConfigMap 存储配置文件

## 1. 概述

应用程序容器化后还是按照之前的方式使用配置文件，即直接将配置文件打包到镜像中。

> 虽然能用但是很不方便，每次修改配置文件都需要重新打包镜像。现在看起来显得很傻。

实际上，Kubernetes 的 `ConfigMap` 或 `Secret` 是非常好的配置管理机制。

启动 Pod 时将 ConfigMap 和 Secret 以数据卷或者环境变量方式加载到Pod中即可。

> Kubernetes 中的 VolumeManager 组件会自动对外部ConfigMap和Pod中的数据卷进行同步。

本次主要通过 ConfigMap + Viper 配置管理包来实现配置文件的热更新。



## 2. ConfigMap 

ConfigMap顾名思义，是用于保存配置数据的键值对，可以用来保存单个属性，也可以保存配置文件。

>热更新原理
>
>https://blog.csdn.net/nangonghen/article/details/111147525?utm_medium=distribute.pc_relevant.none-task-blog-baidujs_title-0&spm=1001.2101.3001.4242
>
>https://blog.csdn.net/qingyafan/article/details/102848860

## 3. Viper

Go 语言中的配置管理库 Viper 可以监听配置文件变化实现热更新。

> 不过只能发现是哪个文件变化，不知道具体修改内容。

最好将不同模块的配置文件分成多个文件。这样监听到对应模块配置文件变化后在调用一次对应的初始化方法即可。

同时 ConfigMap 挂载的Pod中之后，每个 Key 都会生成一个对应的文件就更加方便 Viper 监听了。



核心代码如下：

```go
func Loads(files []string) error {
	for _, file := range files {
		if runtime.GOOS == "windows" {
			file = data.Path(file)
		}
		// 初始化配置文件
		if err := initConfig(file); err != nil {
			return err
		}
		// 监控配置文件变化并热加载程序
		watchConfig()
	}
	return nil
}

// watchConfig 监控配置文件变化并热加载程序
func watchConfig() {
	viper.WatchConfig()
	viper.OnConfigChange(func(e fsnotify.Event) {
		log.Printf("Config file changed: %s", e.Name)

		prefix := utils.GetFilePrefix(e.Name)
		switch prefix {
		case conf.Elasticsearch:
			fmt.Println("elasticsearch conf changed!")
			// 配置文件更新后再次初始化
			// elasticsearch.Init()
		case conf.MongoDB:
			fmt.Println("mongo conf changed!")
		case conf.Redis:
			fmt.Println("redis conf changed!")
		case conf.Basic:
			fmt.Println("basic conf changed!")
		default:
			fmt.Println("conf changed!")
		}
	})
}

```





## 4. 例子

