---
title: "protobuf教程(一)---引入其他proto文件"
description: "proto文件中引入其他proto文件"
date: 2021-03-06 22:00:00
draft: false
tags: ["protobuf"]
categories: ["protobuf"]
---

本章主要介绍了如何在 proto 文件中引入其他 proto 文件。

<!--more-->

## 1. 概述

**Protocol buffers** 是一种语言无关、平台无关的可扩展机制或者说是**数据交换格式**，用于**序列化结构化数据**。与 XML、JSON 相比，Protocol buffers 序列化后的码流更小、速度更快、操作更简单。

> Protocol buffers are a language-neutral, platform-neutral extensible mechanism for serializing structured data.



## 2. 详解

### 基本定义

一个简单的 protobuf 文件定义如下:

```protobuf
syntax = "proto3";
option go_package = "protobuf/import;proto";
package import;

message Computer {
  string name = 1;
}
```



**syntax = "proto3";**---指定使用 proto3 语法

**option go_package = "protobuf/import;proto";**---前一个参数用于指定生成文件的位置，后一个参数指定生成的 .go 文件的 package 。具体语法如下：

```protobuf
option go_package = "{out_path};out_go_package";
```

注意：**这里指定的 out_path 并不是绝对路径，只是相对路径或者说只是路径的一部分，和 protoc 的 `--go_out` 拼接后才是完整的路径。**

> 也使用`--go_opt=paths=source_relative`直接指定 protoc 中 指定的是绝对路径，这样就不会去管 protobuf 文件中指定的路径。

**package import;**---表示当前 protobuf 文件属于 import包，这个package不是 Go 语言中的那个package。

> 这个 package 主要在导入外部 proto 文件时用到。



### 导入其他proto文件

要导入其他 proto 文件只需要使用**import**键字，具体如下：

```protobuf
import "protobuf/import/component.proto";
```

导入后则通过**被导入文件包名.结构体名**使用。

> component.proto 文件中 package 指定为 import，所以这里通过 import.CPU 和 import.Memory 语法进行引用。

完整代码如下:

```protobuf
syntax = "proto3";
option go_package = "protobuf/import;proto";
package import;
import "protobuf/import/component.proto";

message Computer {
  string name = 1;
  import.CPU cpu = 2;
  import.Memory memory = 3;
}
```

导入 compoent.proto 文件，这个也是相对路径，具体和 protoc --proto_path 组合起来才是完整路径。

> 一般指定为项目根目录的次一级目录，编译的时候直接在根目录编译。

protoc 编译的时候通过 `--proto_path` 指定在哪个目录去寻找 import 指定的文件。

> 比如指定 `--proto_path=.`即表示在当前目录下去寻找`protobuf/import/compoent.proto`这个文件。



## 3. 完整例子

目录结构如下

```sh
lixd@17x:~/17x/projects/grpc-go-example$ tree
├── protobuf
│   │ 
│   └── import
│       ├── compoent.proto
│       └── computer.proto
└── README.md
```



### component.proto

```protobuf
syntax = "proto3";
option go_package = "protobuf/import;proto";
package import;

message CPU {
  string Name = 1;
  int64 Frequency = 2;
}
message Memory {
  string Name = 1;
  int64 Cap = 2;
}
```

### computer.proto

```protobuf
syntax = "proto3";
option go_package = "protobuf/import;proto";
package import;
import "protobuf/import/component.proto";

message Computer {
  string name = 1;
  import.CPU cpu = 2;
  import.Memory memory = 3;
}
```



### protoc 编译

在`项目根路径(grpc-go-example)`下进行编译

```sh
lixd@17x:~/17x/projects/grpc-go-example$ protoc --proto_path=. --go_out=. ./protobuf/import/*.proto 
```



参数详解：

**1）--proto_path=.**

指定在当前目录( grpc-go-example)寻找 import 的文件（默认值也是当前目录）

然后 protobuf 文件中的 import 路径如下

```protobuf
import "protobuf/import/component.proto";
```

**所以最终会去找 `grpc-go-example/protobuf/import/component.proto`**。

`--proto_path`和`import`是可以互相调整的，只需要能找到就行。

> 建议protoc参数 --proto_path 指定为根目录，proto文件中的import 则从根目录次一级目录开始。



**2）--go_out=.**

指定将生成文件放在当前目录( grpc-go-example)，同时因为 proto 文件中也指定了目录为`protobuf/import`,具体如下：

```protobuf
option go_package = "protobuf/import;proto";
```

所以最终生成目录为`--go_out+go_package=  grpc-go-example/protobuf/import`。

> 可以通过参数 `--go_opt=paths=source_relative` 来指定使用绝对路径，从而忽略掉 proto 文件中的 go_package 路径，直接生成在 --go_out 指定的路径。



**3）./protobuf/import/*.proto**

指定编译 import 目录下的所有 proto 文件，由于有文件的引入所以需要一起编译才能生效。

> 当然也可以一个一个编译，只要把相关文件都编译好即可。



### Test

```go
func Print() {
	c := Computer{
		Name: "alienware",
		Cpu: &CPU{
			Name:      "intel",
			Frequency: 4096,
		},
		Memory: &Memory{
			Name: "芝奇",
			Cap:  8192,
		},
	}
	fmt.Println(c.String())
}
```



## 4. 小结

* 1）通过`import "{path}";`  命令引入；
* 2）导入后通过**被导入文件包名.结构体名**方式使用；
* 3）编译时通过`--proto_path=.` 指定寻找proto文件的目录，一起编译。

