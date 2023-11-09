---
title: "Go语言测试 gotest"
description: "go test 使用指南"
date: 2020-07-25 22:00:00
draft: false
tags: ["Golang"]
categories: ["Golang"]
---

本来主要为 Go 语言中的测试工具 go test 使用指南，最后顺便测试了一下几种字符串拼接方式的性能差距。

<!--more-->

## 1. 概述

Go 语言中的测试依赖 go test 命令。编写测试代码和编写普通的 Go 代码过程是类似的，并不需要学习新的语法、规则或工具。

go tes t命令是一个按照一定约定和组织的测试代码的驱动程序。在包目录内，所有以**`_test.go`**为后缀名的源代码文件都是 go test 测试的一部分，不会被 go build 编译到最终的可执行文件中。

在`*_test.go`文件中有三种类型的函数，单元测试函数、基准测试函数和示例函数。

| 类型     | 格式                  | 作用                           |
| -------- | --------------------- | ------------------------------ |
| 测试函数 | 函数名前缀为Test      | 测试程序的一些逻辑行为是否正确 |
| 基准函数 | 函数名前缀为Benchmark | 测试函数的性能                 |
| 示例函数 | 函数名前缀为Example   | 为文档提供示例文档             |

**测试文件以`_test.go`结尾**，且放在同一位置，例如

```shell
  test
      |
       —— calc.go
      |
       —— calc_test.go
```

## 2. go test

`go test` 是 Go 语言自带的测试工具，其中包含的是两类，`单元测试`和`性能测试`。



### 1. 运行模式

根据输入参数不同， go test 有两种运行模式。

#### 1. 本地目录模式

在**没有包参数**（例如 `go test` 或 `go test -v` ）调用时发生。

在此模式下， `go test` 编译当前目录中找到的包和测试，然后运行测试二进制文件。在这种模式下，**caching 是禁用的**。

在包测试完成后，go test 打印一个概要行，显示测试状态、包名和运行时间。

#### 2. 包列表模式

在**使用显式包参数**调用 `go test` 时发生（例如 `go test math` ， `go test ./...` 甚至是 `go test .` ）。

在此模式下，go 测试编译并测试在命令上列出的每个包。如果一个包测试通过， `go test` 只打印最终的 ok 总结行。如果一个包测试失败， `go test` 将输出完整的测试输出。如果使用 `-bench` 或 `-v` 标志，则 `go test` 会输出完整的输出，甚至是通过包测试，以显示所请求的基准测试结果或详细日志记录。



### 2. 参数解读

通过 go help test 可以看到 go test 的使用说明：

#### 1. 语法 

```go
go test [-c] [-i] [build flags] [packages] [flags for test binary]
```



#### 2. 变量

go test 的变量列表如下：

- test.short : 一个快速测试的标记，在测试用例中可以使用 testing.Short() 来绕开一些测试
- test.outputdir : 输出目录
- test.coverprofile : 测试覆盖率参数，指定输出文件
- test.run : 指定正则来运行某个/某些测试用例
- test.memprofile : 内存分析参数，指定输出文件
- test.memprofilerate : 内存分析参数，内存分析的抽样率
- test.cpuprofile : cpu分析输出参数，为空则不做cpu分析
- test.blockprofile : 阻塞事件的分析参数，指定输出文件
- test.blockprofilerate : 阻塞事件的分析参数，指定抽样频率
- test.timeout : 超时时间
- test.cpu : 指定cpu数量
- test.parallel : 指定运行测试用例的并行数



#### 3. 参数

参数解读：

关于build flags，调用go help build，这些是编译运行过程中需要使用到的参数，一般设置为空

关于packages，调用go help packages，这些是关于包的管理，一般设置为空

关于flags for test binary，调用go help testflag，这些是go test过程中经常使用到的参数

* -c : 编译 go tes t成为可执行的二进制文件，但是不运行测试。

* -i : 安装测试包依赖的package，但是不运行测试。

* **-v**: 是否输出全部的单元测试用例（不管成功或者失败），默认没有加上，所以只输出失败的单元测试用例。
* **-run**=pattern: 只跑哪些单元测试用例
* **-bench**=patten: 只跑那些性能测试用例
* **-benchmem** : 是否在性能测试的时候输出内存情况
* **-benchtime t **: 性能测试运行的时间，默认是1s
* -cpuprofile cpu.out : 是否输出cpu性能分析文件
* -cover: 测试覆盖率
* -coverprofile=file ：输出测试覆盖率到文件
* -memprofile mem.out : 是否输出内存性能分析文件
* -blockprofile block.out : 是否输出内部goroutine阻塞的性能分析文件
* -memprofilerate n : 内存性能分析的时候有一个分配了多少的时候才打点记录的问题。

这个参数就是设置打点的内存分配间隔，也就是profile中一个sample代表的内存大小。默认是设置为512 * 1024的。如果你将它设置为1，则每分配一个内存块就会在profile中有个打点，那么生成的profile的sample就会非常多。如果你设置为0，那就是不做打点了。

你可以通过设置memprofilerate=1和GOGC=off来关闭内存回收，并且对每个内存块的分配进行观察。

* -blockprofilerate n: 基本同上，控制的是goroutine阻塞时候打点的纳秒数。默认不设置就相当于-test.blockprofilerate=1，每一纳秒都打点记录一下

* -parallel n : 性能测试的程序并行cpu数，默认等于GOMAXPROCS。

* -timeout t : 如果测试用例运行时间超过t，则抛出panic

* -cpu 1,2,4 : 程序运行在哪些CPU上面，使用二进制的1所在位代表，和nginx的nginx_worker_cpu_affinity是一个道理

* -short : 将那些运行时间较长的测试用例运行时间缩短



## 3. 类型

### 1. 单元测试

* 1）文件名必须以xx_test.go命名
* 2）方法必须是Test[^a-z]开头
* 3）方法参数必须 t *testing.T
* 4）使用go test 执行单元测试

### 2. 性能测试

基准测试的基本格式如下：

```go
func BenchmarkName(b *testing.B){
    // ...
}
```

基准测试以 Benchmark 为前缀，需要一个`*testing.B`类型的参数b，基准测试必须要执行b.N次，这样的测试才有对照性，b.N的值是系统根据实际情况去调整的，从而保证测试的稳定性。

基准测试并不会默认执行，需要增加`-bench`参数。

### 3. 示例函数

被 go test 特殊对待的第三种函数就是示例函数，它们的函数名以Example为前缀。它们既没有参数也没有返回值。标准格式如下：

```go
func ExampleName() {
    // ...
}
```



```go
func ExampleFib() {
	fmt.Println(Fib(1))
	//	Output:1
}
```

go test 会将打印的内容与 下面的注释`Output`对比，相同则通过。

### 4. 其他函数

#### 1. TestMain

如果测试文件包含函数:`func TestMain(m *testing.M)`那么生成的测试会先调用 TestMain(m)，然后再运行具体测试。

#### 2. 子测试

`t.Run()`开启子测试。

```go
		t.Run(tt.name, func(t *testing.T) {
			if got := Fib(tt.args.n); got != tt.want {
				t.Errorf("Fib() = %v, want %v", got, tt.want)
			}
		})
```



## 4. 例子

一个简单的递归求斐波那契数列方法

```go
func Fib(n int) int {
	if n < 2 {
		return n
	}
	return Fib(n-1) + Fib(n-2)
}
```

### 1. 单元测试

```go
func TestFib(t *testing.T) {
	type args struct {
		n int
	}
	tests := []struct {
		name string
		args args
		want int
	}{
		{"0", args{0}, 0},
		{"1", args{1}, 1},
		{"2", args{2}, 1},
		{"3", args{3}, 2},
		{"4", args{4}, 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Fib(tt.args.n); got != tt.want {
				t.Errorf("Fib() = %v, want %v", got, tt.want)
			}
		})
	}
}
```

以表格的形式组织参数，后续增加新的参数也非常方便。

运行测试

> linux 下为 -run=. windows 下需要写成-run="." 才行

```shell
# 正确 测试通过
$ go test -run=.
PASS
ok      hello/test/bench        0.002s
# 测试失败 出现错误
$ go test -run=.
--- FAIL: TestFib (0.00s)
    --- FAIL: TestFib/4 (0.00s)
        fib_test.go:23: Fib() = 3, want 33
FAIL
exit status 1
FAIL    hello/test/bench        0.002s
```



### 2. 性能测试

```go
func BenchmarkFib(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Fib(10)
	}
}
```

运行

```shell
$ go test -bench=.
goos: linux
goarch: amd64
pkg: hello/test/bench
BenchmarkFib-6           3946929               301 ns/op
PASS
ok      hello/test/bench        1.502s
```



对比测试，看一下不同的值跑的时间相差多少

```go
func benchmarkFib(b *testing.B, n int) {
	for i := 0; i < b.N; i++ {
		Fib(n)
	}
}
func BenchmarkFib1(b *testing.B)  { benchmarkFib(b, 1) }
func BenchmarkFib2(b *testing.B)  { benchmarkFib(b, 2) }
func BenchmarkFib3(b *testing.B)  { benchmarkFib(b, 3) }
func BenchmarkFib10(b *testing.B) { benchmarkFib(b, 10) }
func BenchmarkFib20(b *testing.B) { benchmarkFib(b, 20) }
func BenchmarkFib40(b *testing.B) { benchmarkFib(b, 40) }
```

结果如下

```shell
$ go test -bench=.
goos: linux
goarch: amd64
pkg: hello/test/bench
BenchmarkFib1-6         707485189                1.71 ns/op
BenchmarkFib2-6         218838684                4.84 ns/op
BenchmarkFib3-6         149152461                7.95 ns/op
BenchmarkFib10-6         4022001               305 ns/op
BenchmarkFib20-6           31034             39250 ns/op
BenchmarkFib40-6               2         601045684 ns/op
PASS
ok      hello/test/bench        10.483s
lixd@17x:~/17x/projects/hello/test/bench$ 

```

### 3. 示例函数

示例，一方面是文档的效果，是关于某个功能的使用例子；另一方面，可以被当做测试运行。

通常，示例代码会放在单独的示例文件中，命名为 `example_test.go`。

```go
func ExampleFib() {
	fmt.Println(Fib(1))
	//	Output:1
}
```

运行结果如下

```go
=== RUN   ExampleFib
--- PASS: ExampleFib (0.00s)
PASS
```

### 4. 字符串拼接

最后来测一下字符串拼接的几种方法

```go

const numbers = 100

func BenchmarkSprintf(b *testing.B) {
	b.ResetTimer()
	for idx := 0; idx < b.N; idx++ {
		var s string
		for i := 0; i < numbers; i++ {
			s = fmt.Sprintf("%v%v", s, i)
		}
	}
	b.StopTimer()
}

func BenchmarkStringBuilder(b *testing.B) {
	b.ResetTimer()
	for idx := 0; idx < b.N; idx++ {
		var builder strings.Builder
		for i := 0; i < numbers; i++ {
			builder.WriteString(strconv.Itoa(i))

		}
		_ = builder.String()
	}
	b.StopTimer()
}

func BenchmarkBytesBuf(b *testing.B) {
	b.ResetTimer()
	for idx := 0; idx < b.N; idx++ {
		var buf bytes.Buffer
		for i := 0; i < numbers; i++ {
			buf.WriteString(strconv.Itoa(i))
		}
		_ = buf.String()
	}
	b.StopTimer()
}

func BenchmarkStringAdd(b *testing.B) {
	b.ResetTimer()
	for idx := 0; idx < b.N; idx++ {
		var s string
		for i := 0; i < numbers; i++ {
			s += strconv.Itoa(i)
		}

	}
	b.StopTimer()
}
```

结果

```shell
# n = 2 字符串较少的时候
$ go test -bench=. -benchmem
goos: linux
goarch: amd64
pkg: hello/test/str
BenchmarkSprintf-6               5333647               226 ns/op              32 B/op          3 allocs/op
BenchmarkStringBuilder-6        40148308                32.4 ns/op             8 B/op          1 allocs/op
BenchmarkBytesBuf-6             20827609                55.7 ns/op            64 B/op          1 allocs/op
BenchmarkStringAdd-6            30649676                39.2 ns/op             2 B/op          1 allocs/op
PASS
ok      hello/test/str  5.241s


# n = 100 字符串比较多的时候
$ go test -bench=. -benchmem
goos: linux
goarch: amd64
pkg: hello/test/str
BenchmarkSprintf-6                 63482             19152 ns/op           12179 B/op        297 allocs/op
BenchmarkStringBuilder-6         1299618               887 ns/op             504 B/op          6 allocs/op
BenchmarkBytesBuf-6              1000000              1111 ns/op             688 B/op          4 allocs/op
BenchmarkStringAdd-6              166837              6042 ns/op            9776 B/op         99 allocs/op
PASS
ok      hello/test/str  5.718s
```



**结论**

* 字符串少的时候，直接相加和 bytes.Buffer、strings.Builder 相差不大，但是 strings.Sprintf  也特别慢
* 字符串多的时候，bytes.Buffer、strings.Builder  相差不大，另外两个就已经很慢了

> bytes.Buffer、strings.Builder 使用缓存，不会频繁分配内存，所以快
>
> strings.Sprintf  和 add 两个会分配大量内存所以就很慢， string 是只读的，所以每次会创建一个新的 string

**一般推荐使用 strings.Builder ，如果字符串很少则可以直接相加也差距不大， 不管什么情况都最好不要使用 strings.Sprintf**

## 5. 参考

`https://golang.org/pkg/testing/`

`https://www.calhoun.io/how-to-test-with-go/`

`https://books.studygolang.com/The-Golang-Standard-Library-by-Example/chapter09/09.1.html`

`https://medium.com/rungo/unit-testing-made-easy-in-go-25077669318`