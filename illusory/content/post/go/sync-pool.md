---
title: "Go语言之 sync.pool 源码分析"
description: "sync.pool 库源码分析及其使用场景介绍"
date: 2021-10-15 22:00:00
draft: false
tags: ["Golang"]
categories: ["Golang"]
---

本文主要介绍了Go语言(golang)中的`sync.pool`包。给出了 sync.pool 的基本用法，以及各大框架中的使用案例。并从源码层面对其底层结构和具体实现原理进行分析。

<!--more-->

> 以下分析基于 Go 1.17.1

## 1. 概述

### 大致理念

`sync.Pool` 是 sync 包下的一个组件，可以作为保存临时取还对象的一个“池子”，可以缓存暂时不用的对象，下次需要时直接使用（无需重新分配）。

> 因为频繁的内存分配和回收会对性能产生影响，通过复用临时对象就可以避免改问题。



下面是 2018 年的时候，《Go 夜读》上关于 `sync.Pool` 的分享，关于适用场景：

> 当多个 goroutine 都需要创建同⼀个对象的时候，如果 goroutine 数过多，导致对象的创建数⽬剧增，进⽽导致 GC 压⼒增大。形成 “并发⼤－占⽤内存⼤－GC 缓慢－处理并发能⼒降低－并发更⼤”这样的恶性循环。
> 在这个时候，需要有⼀个对象池，每个 goroutine 不再⾃⼰单独创建对象，⽽是从对象池中获取出⼀个对象（如果池中已经有的话）。

因此关键思想就是对象的复用，避免重复创建、销毁，下面我们来看看如何使用。

所以，sync.pool 的作用一句话描述就是，**复用临时对象，以避免频繁的内存分配和回收，从而减少 GC 压力**。



### 基本使用

首先，`sync.Pool` 是协程安全的，这对于使用者来说是极其方便的。使用前，设置好对象的 `New` 函数，用于在 `Pool` 里没有缓存的对象时，创建一个。之后，在程序的任何地方、任何时候仅通过 `Get()`、`Put()` 方法就可以取、还对象了。

以下为基本使用 demo：

> 完整代码见 [Github][Github]

```go
package main

import (
	"fmt"
	"sync"
)

type Gopher struct {
	Name   string
	Remark [1024]byte
}

func (s *Gopher) Reset() {
	s.Name = ""
	s.Remark = [1024]byte{}
}

var gopherPool = sync.Pool{
	New: func() interface{} {
		return new(Gopher)
	},
}

func main() {
	g := gopherPool.Get().(*Gopher)
	fmt.Println("首次从 pool 里获取：", g.Name)

	g.Name = "first"
	fmt.Printf("设置 p.Name = %s\n", g.Name)
	gopherPool.Put(g)

	fmt.Println("Pool 里已有一个对象：&{first}，调用 Get: ", gopherPool.Get().(*Gopher).Name)
	fmt.Println("Pool 没有对象了，调用 Get: ", gopherPool.Get().(*Gopher).Name)
}
```

运行结果：

```sh
首次从 pool 里获取： 
设置 p.Name = first
Pool 里已有一个对象：&{first}，调用 Get:  first
Pool 没有对象了，调用 Get:  
```

首先，需要初始化 `Pool`，唯一需要的就是设置好 `New` 函数。当调用 Get 方法时，如果池子里缓存了对象，就直接返回缓存的对象。如果没有存货，则调用 New 函数创建一个新的对象。

另外，我们发现 Get 方法取出来的对象和上次 Put 进去的对象实际上是同一个，Pool 没有做任何“清空”的处理。但我们不应当对此有任何假设，因为在实际的并发使用场景中，无法保证这种顺序，**最好的做法是在 Put 前，将对象清空**。



**Benchmark**

```go
var defaultGopher, _ = json.Marshal(Gopher{Name: "17x"})

func BenchmarkUnmarshal(b *testing.B) {
	var g *Gopher
	for n := 0; n < b.N; n++ {
		g = new(Gopher)
		json.Unmarshal(defaultGopher, g)
	}
}

func BenchmarkUnmarshalWithPool(b *testing.B) {
	var g *Gopher
	for n := 0; n < b.N; n++ {
		g = gopherPool.Get().(*Gopher)
		json.Unmarshal(defaultGopher, g)
		g.Reset() // 重置后在放进去
		gopherPool.Put(g)
	}
}

```

运行结果：

```sh
BenchmarkUnmarshal-6                9518            124806 ns/op            1280 B/op          6 allocs/op
BenchmarkUnmarshalWithPool-6       10000            124350 ns/op             128 B/op          5 allocs/op
```

功能比较简单，其中 json 反序列化占用了大量时间，因此两种方式最终的执行时间几乎没什么变化。但是内存占用差了一个数量级，使用了 `sync.Pool` 后，内存占用仅为未使用的 128/1280=1/10，对 GC 的影响就很大了。



### 使用案例

#### fmt 包

这部分主要看 `fmt.Printf` 如何使用：

```go
func Printf(format string, a ...interface{}) (n int, err error) {
	return Fprintf(os.Stdout, format, a...)
}
```

继续看 `Fprintf`：

```go
func Fprintf(w io.Writer, format string, a ...interface{}) (n int, err error) {
	p := newPrinter()
	p.doPrintf(format, a)
	n, err = w.Write(p.buf)
	p.free()
	return
}
```

`Fprintf` 函数的参数是一个 `io.Writer`，`Printf` 传的是 `os.Stdout`，相当于直接输出到标准输出。这里的 `newPrinter` 用的就是 Pool：

```go
var ppFree = sync.Pool{
	New: func() interface{} { return new(pp) },
}

func newPrinter() *pp {
	p := ppFree.Get().(*pp)
	p.panicking = false
	p.erroring = false
	p.wrapErrs = false
	p.fmt.init(&p.buf)
	return p
}
```

回到 `Fprintf` 函数，拿到 pp 指针后，会做一些 format 的操作，并且将 p.buf 里面的内容写入 w。最后，调用 free 函数，将 pp 指针归还到 Pool 中：

```go
func (p *pp) free() {
	if cap(p.buf) > 64<<10 {
		return
	}

	p.buf = p.buf[:0]
	p.arg = nil
	p.value = reflect.Value{}
	p.wrappedErr = nil
	ppFree.Put(p)
}
```

归还到 Pool 前还进行了**字段清零**，这样，通过 Get 拿到缓存的对象时，就可以安全地使用了。



####  gin 框架

gin 框架会给每个请求分配一个 Context 用以进行追踪，这就是典型的 sync.pool 使用场景：

```go
func New() *Engine {
	engine := &Engine{
		
	}
	engine.pool.New = func() interface{} {
		return engine.allocateContext()
	}
	return engine
}

func (engine *Engine) allocateContext() *Context {
	return &Context{engine: engine}
}
```



```go
func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	c := engine.pool.Get().(*Context)
	c.writermem.reset(w)
	c.Request = req
	c.reset()

	engine.handleHTTPRequest(c)

	engine.pool.Put(c)
}
```

从 pool 中获取 Context 对象，用完后又还回去，注意 还回去之前这里也调用了 reset() 方法进行**字段清空**。



### 正确姿势

根据以上几个案例，可以看出正确使用姿势就是：

* 1）设置 New 方法
* 2）使用时直接 Get
* 3）使用完成后先进行**字段清空**,然后在 Put 回去。

> 一定要进行 Reset，不然会出现意想不到的问题。分享一个[类似的坑](https://github.com/lixd/daily-notes/blob/master/Golang/FAQ/mongodb%E9%87%87%E5%9D%91.md)



## 2. 源码分析

> 一下分析基于 Go 1.17.1

### Pool 结构体

```go
type Pool struct {
	noCopy noCopy

	local     unsafe.Pointer // local fixed-size per-P pool, actual type is [P]poolLocal
	localSize uintptr        // size of the local array

	victim     unsafe.Pointer // local from previous cycle
	victimSize uintptr        // size of victims array

	New func() interface{}
}
```

字段详解：

* `noCopy`对象，实现了`sync.Locker`接口，使得内嵌了 noCopy 的对象在进行 go vet 静态检查的时候，可以检查出是否被复制。
  * 具体见 [Go issues 8005](https://github.com/golang/go/issues/8005)
  * 说明 Pool 对象也是不允许复制的。

* `local` 字段存储指向 `[P]poolLocal` 数组（严格来说，它是一个切片）的指针。`localSize` 则表示 local 数组的大小。
  * 访问时，根据 P 的 id 去访问对应下标的 `local[pid]`
  * 通过这样的设计，多个 goroutine 使用同一个 Pool 时，减少了竞争，提升了性能。
  * 有点类似于降低锁粒度，分段锁的思想。

* `victim` 和 `victimSize` 则会在在一轮 GC 到来时，分别“接管” local 和 localSize。
  *  victim cache 是一种提高缓存性能的硬件技术;
  * `victim` 的机制用于减少 GC 后冷启动导致的性能抖动，让分配对象更平滑;
  * `sync.Pool` 引入的意图在于降低 GC 压力的同时提高命中率。

* `New`就是我们指定的新建对象的方法。



> [Victim Cache](https://en.wikipedia.org/wiki/Victim_cache) 是一种提高缓存性能的硬件技术，主要用于提升缓存命令率。
>
> 所谓受害者缓存（Victim Cache），是一个与直接匹配或低相联缓存并用的、容量很小的全相联缓存。当一个数据块被逐出缓存时，并不直接丢弃，而是暂先进入受害者缓存。如果受害者缓存已满，就替换掉其中一项。当进行缓存标签匹配时，在与索引指向标签匹配的同时，并行查看受害者缓存，如果在受害者缓存发现匹配，就将其此数据块与缓存中的不匹配数据块做交换，同时返回给处理器。



#### local

local 具体结构如下：

```go
type poolLocal struct {
	poolLocalInternal
    // 将 poolLocal 补齐至128字节(即两个cache line)的倍数，防止 false sharing,
    // 伪共享，仅占位用，防止在 cache line 上分配多个 poolLocalInternal
	pad [128 - unsafe.Sizeof(poolLocalInternal{})%128]byte
}
type poolLocalInternal struct {
	private interface{} // Can be used only by the respective P.
	shared  poolChain   // Local P can pushHead/popHead; any P can popTail.
}
```

`poolLocalInternal`对象 中包含一个 `private` 和 `shared`。其中 private 只有当前 p 能用，shared 则是其他 p 都可以用。



#### cpu cache & false sharing

**cpu cache**

现代 cpu 中，cache 都划分成以 cache line (cache block) 为单位，在 x86_64 体系下一般都是 64 字节，cache line 是操作的最小单元。
程序即使只想读内存中的 1 个字节数据，也要同时把附近 63 节字加载到 cache 中，如果读取超个 64 字节，那么就要加载到多个 cache line 中。

这样，访问后续 63 字节数据时就可以直接从 cache line 中读取，性能有很大提升。

**[false sharing](https://en.wikipedia.org/wiki/False_sharing)**

> 伪共享的非标准定义为：缓存系统中是以缓存行（cache line）为单位存储的，当多线程修改互相独立的变量时，如果这些变量共享同一个缓存行，就会令整个 cache line 失效，无意中影响彼此的性能，这就是伪共享。

简单来说，如果没有 pad 字段，那么当需要访问 0 号索引的 poolLocal 时，CPU 同时会把 0 号和 1 号索引同时加载到 cpu cache。在只修改 0 号索引的情况下，会让 1 号索引的 poolLocal 失效。这样，当其他线程想要读取 1 号索引时，发生 cache miss，还得重新再加载，对性能有损。增加一个 `pad`，补齐缓存行，让相关的字段能独立地加载到缓存行就不会出现 `false sharding` 了。



#### poolChain

`poolChain` 是一个双端队列的实现

```go
type poolChain struct {

   head *poolChainElt

   tail *poolChainElt
}

type poolChainElt struct {
	poolDequeue

	next, prev *poolChainElt
}

type poolDequeue struct {

	headTail uint64

	vals []eface
}
```

`poolDequeue` 被实现为单生产者、多消费者的固定大小的无锁（atomic 实现） Ring 式队列（底层存储使用数组，使用两个指针标记 head、tail）。生产者可以从 head 插入、head 删除，而消费者仅可从 tail 删除。
`headTail` 指向队列的头和尾，通过位运算将 head 和 tail 存入 headTail 变量中。



我们用一幅图来完整地描述 Pool 结构体：

![pool-structure][pool-structure]

> 图源：[码农桃花源](https://zhuanlan.zhihu.com/p/133638023)



### 大致流程

分析完 Pool 结构体之后，先提前说明一下大致的流程，后续分析时便于理解。

**存储**

为每个 P 开辟了一个 Local 用于数据，降低竞争。

Local 中包含 private 和 shared。

* private ：只有当前 P 能使用
* shared：所有 P 共享，当 private 没有时优先去当前 P 的 local.shared 中取，如果还没有就去其他 P 中  local.shared 中窃取一个来用。

**Get**

优先从当前P 的 local.private 中取，没有则从当前 P 的 local.shared 中取，还没有则去其他 P 中  local.shared 中窃取一个。

**Put**

优先存放到当前 P 的 local.private，local.private 已经有值了就往 shared 中放。



### Get

```go
func (p *Pool) Get() interface{} {
	// ...
	l, pid := p.pin()
	x := l.private
	l.private = nil
	if x == nil {
		x, _ = l.shared.popHead()
		if x == nil {
			x = p.getSlow(pid)
		}
	}
	runtime_procUnpin()
	// ...
	if x == nil && p.New != nil {
		x = p.New()
	}
	return x
}
```

流程如下：

1. 首先，调用 `p.pin()` 函数将当前的 goroutine 和 P 绑定，禁止被抢占，返回当前 P 对应的 poolLocal，以及 pid。
2. 然后直接取 l.private，赋值给 x，并置 l.private 为 nil。
3. 判断 x 是否为空，若为空，则尝试从 l.shared 的头部 pop 一个对象出来，同时赋值给 x。
4. 如果 x 仍然为空，则调用 getSlow 尝试从其他 P 的 shared 双端队列尾部“偷”一个对象出来。
5. Pool 的相关操作做完了，调用 `runtime_procUnpin()` 解除禁止抢占。
6. 最后如果还是没有取到缓存的对象，那就直接调用预先设置好的 New 函数，创建一个出来。



#### pin

首先，调用 `p.pin()` 函数将当前的 goroutine 和 P 绑定，禁止被抢占，返回当前 P 对应的 poolLocal，以及 pid。

```go
func (p *Pool) pin() (*poolLocal, int) {
   // pin 具体逻辑由 runtime_procPin 实现
   pid :=  runtime_procPin()
   // 原子操作取出 p.localSize 和 p.local
   s := runtime_LoadAcquintptr(&p.localSize) // load-acquire
   l := p.local                              // load-consume
   // 因为是把 pid 做下标从 pool.local 中取得 p 对应的 local 的，
   // 所以如果 pid 小于 pool.local size 的时候才有可能取到对应的 local
   if uintptr(pid) < s {
      return indexLocal(l, pid), pid
   }
   // 正常情况下会一直满足该条件，
   // 只有刚开始  pool.local 还没创建或者动态调整了 P 的数量这两种情况
   // 会进入到下面的逻辑 去创建 pool.local
   return p.pinSlow()
}
```



#### pinSlow

pinSlow 主要是完成 pool.local 的创建。

```go
func (p *Pool) pinSlow() (*poolLocal, int) {
    // 这里先取消绑定，然后加锁，最后有绑定上
	runtime_procUnpin()
	allPoolsMu.Lock()
	defer allPoolsMu.Unlock()
	pid := runtime_procPin()
	// doubleCheck 因为在执行上述命令过程中 pinSlow 可能已经被其他的线程调用，因此这时候需要再次对 pid 进行检查
	s := p.localSize
	l := p.local
	if uintptr(pid) < s {
		return indexLocal(l, pid), pid
	}
	if p.local == nil {
		allPools = append(allPools, p)
	}
	// 根据当前 P 的数量创建 pool.local并更新pool.localSize
	size := runtime.GOMAXPROCS(0)
	local := make([]poolLocal, size)
	atomic.StorePointer(&p.local, unsafe.Pointer(&local[0])) // store-release
	runtime_StoreReluintptr(&p.localSize, uintptr(size))     // store-release
    // 最后根据 pid 返回当前 P 对应的 local
	return &local[pid], pid
}
```



#### popHead

然后回到 Get 方法

```go
x := l.private
	l.private = nil
	if x == nil {
		x, _ = l.shared.popHead()
		if x == nil {
			x = p.getSlow(pid)
		}
	}
```

优先从 local.private 中取，如果没有就调用`poolChain.popHead()`去 local.shared 中取一个。

```go
func (c *poolChain) popHead() (interface{}, bool) {
	d := c.head
	for d != nil {
		if val, ok := d.popHead(); ok {
			return val, ok
		}
		d = loadPoolChainElt(&d.prev)
	}
	return nil, false
}
```

`popHead` 函数只会被 producer 调用。首先拿到头节点：c.head，如果头节点不为空的话，尝试调用头节点的 `poolDequeue.popHead` 方法。

```go
func (d *poolDequeue) popHead() (interface{}, bool) {
	var slot *eface
	for {
		ptrs := atomic.LoadUint64(&d.headTail)
		head, tail := d.unpack(ptrs)
        // 收尾相连则说明队列是空的
		if tail == head {
			return nil, false
		}

		// head 位置是队头的前一个位置，所以此处要先退一位。
        // 在读出 slot 的 value 之前就把 head 值减 1，取消对这个 slot 的控制
		head--
		ptrs2 := d.pack(head, tail)
        // 通过 CAS 操作更新头部的位置 这样当前头部第一个元素就算是被移除了
		if atomic.CompareAndSwapUint64(&d.headTail, ptrs, ptrs2) {
			slot = &d.vals[head&uint32(len(d.vals)-1)]
			break
		}
	}
    // 类型转换与 nil 判断
	val := *(*interface{})(unsafe.Pointer(slot))
	if val == dequeueNil(nil) {
		val = nil
	}
    // 然后把这个 slot 置空，因为现在这个 slot 已经是队列的 head 了，置空便于前一个 head 被回收。
	*slot = eface{}
	return val, true
}
```

此函数会删掉并且返回 `queue` 的头节点。但如果 `queue` 为空的话，返回 false。这里的 `queue` 存储的实际上就是 Pool 里缓存的对象。

整个函数的核心是一个无限循环，这是 Go 中常用的无锁化编程形式。

首先调用 unpack 函数分离出 head 和 tail 指针，如果 head 和 tail 相等，即首尾相等，那么这个队列就是空的，直接就返回 nil，false。

否则，将 head 指针后移一位，即 head 值减 1，然后调用 pack 打包 head 和 tail 指针。使用 CAS 更新 headTail 的值，并且把 vals 相应索引处的元素赋值给 slot。

> 因为 `vals` 长度实际是只能是 2 的 n 次幂，因此 `len(d.vals)-1` 实际上得到的值的低 n 位是全 1，它再与 head 进行与运算，实际就是取 head 低 n 位的值作为下标。

得到相应 slot 的元素后，经过类型转换并判断是否是 `dequeueNil`，如果是，说明没取到缓存的对象，返回 nil。

```go
type dequeueNil *struct{}
```

最后，返回 val 之前，将 slot “归零”，移除和上一个 head 的关联，便于回收上一个 Head。

```go
*slot = eface{}
```



结束后回到 `poolChain.popHead()`，如果调用 `poolDequeue.popHead()` 拿到了缓存的对象，就直接返回。否则，将 `d` 重新指向 `d.prev`，继续尝试获取缓存的对象。



#### getSlow

如果在 shared 里没有获取到缓存对象，则继续调用 `Pool.getSlow()`，尝试从其他 P 的 poolLocal 偷取：

```go
func (p *Pool) getSlow(pid int) interface{} {
	
	size := runtime_LoadAcquintptr(&p.localSize) // load-acquire
	locals := p.local                            // load-consume
    // 尝试从其他 p 中窃取一个对象
	for i := 0; i < int(size); i++ {
        // (pid+i+1)%int(size) 保证每次都可以从 当前pid+1 这个位置开始尝试窃取。
		l := indexLocal(locals, (pid+i+1)%int(size))
        // 如果能取到就直接返回
		if x, _ := l.shared.popTail(); x != nil {
			return x
		}
	}

    // 尝试从其他 P 的 poolLocal 窃取失败后，再尝试从victim cache中取对象
    // 这样可以使 victim 中的对象更容易被回收。
	size = atomic.LoadUintptr(&p.victimSize)
	if uintptr(pid) >= size {
		return nil
	}
	locals = p.victim
	l := indexLocal(locals, pid)
	if x := l.private; x != nil {
		l.private = nil
		return x
	}
	for i := 0; i < int(size); i++ {
		l := indexLocal(locals, (pid+i)%int(size))
		if x, _ := l.shared.popTail(); x != nil {
			return x
		}
	}

    // 清空 victim cache。下次就不用再从这里找了
	atomic.StoreUintptr(&p.victimSize, 0)

	return nil
}
```

从索引为 pid+1 的 poolLocal 处开始，尝试调用 `shared.popTail()` 获取缓存对象。如果没有拿到，则从 victim 里找，和 poolLocal 的逻辑类似。

最后，实在没找到，就把 victimSize 置 0，防止后来的“人”再到 victim 里找。

在 Get 函数的最后，经过这一番操作还是没找到缓存的对象，就调用 New 函数创建一个新的对象。



#### popTail

最后，还剩一个 popTail 函数：

```go
func (c *poolChain) popTail() (interface{}, bool) {
    // tail 指针为空直接返回 这里的 tail 是一个双端队列
	d := loadPoolChainElt(&c.tail)
	if d == nil {
		return nil, false
	}

	for {
		// It's important that we load the next pointer
		// *before* popping the tail. In general, d may be
		// transiently empty, but if next is non-nil before
		// the pop and the pop fails, then d is permanently
		// empty, which is the only condition under which it's
		// safe to drop d from the chain.
        // 在 for 循环的一开始，就把 d.next 加载到了 d2。因为 d 可能会短暂为空，但如果 d2 在 pop 或者 pop fails 之前就不为空的话，说明 d 就会永久为空了。在这种情况下，可以安全地将 d 这个结点“甩掉”。
		d2 := loadPoolChainElt(&d.next)

		if val, ok := d.popTail(); ok {
			return val, ok
		}

		if d2 == nil {
			// This is the only dequeue. It's empty right
			// now, but could be pushed to in the future.
			return nil, false
		}

		// 同样的通过 CAS 来更新 tail 的值为 d2
		if atomic.CompareAndSwapPointer((*unsafe.Pointer)(unsafe.Pointer(&c.tail)), unsafe.Pointer(d), unsafe.Pointer(d2)) {
			storePoolChainElt(&d2.prev, nil)
		}
        // 最后将d2赋值给d便于进行下一轮循环。
		d = d2
	}
}

```

在 for 循环的一开始，就把 d.next 加载到了 d2。因为 d 可能会短暂为空，但如果 d2 在 pop 或者 pop fails 之前就不为空的话，说明 d 就会永久为空了。在这种情况下，可以安全地将 d 这个结点“甩掉”。

最后，将 c.tail 更新为 d2，可以防止下次 popTail 的时候查看一个空的 dequeue；而将 d2.prev 设置为 nil，可以防止下次 popHead 时查看一个空的 dequeue。

我们再看一下核心的 `poolDequeue.popTail`：



```go
func (d *poolDequeue) popTail() (interface{}, bool) {
	var slot *eface
	for {
		ptrs := atomic.LoadUint64(&d.headTail)
		head, tail := d.unpack(ptrs)
        // 同样的 head=tail 说明队列为空
		if tail == head {
			return nil, false
		}

		// 同样是 CAS 更新 headTail 以移除 tail 元素
		ptrs2 := d.pack(head, tail+1)
		if atomic.CompareAndSwapUint64(&d.headTail, ptrs, ptrs2) {
			// Success.
			slot = &d.vals[tail&uint32(len(d.vals)-1)]
			break
		}
	}

	// 类型转换和 nil 判断
	val := *(*interface{})(unsafe.Pointer(slot))
	if val == dequeueNil(nil) {
		val = nil
	}

    // 最后也是将这个 slot 置空
    // 先清空 val 再清空 typ 操作顺序和 pushHead 正好相反
	slot.val = nil
	atomic.StorePointer(&slot.typ, nil)


	return val, true
}
```

整体逻辑和 popHead 差不多。



#### 小结

首先从 当前 p 对应的 local.private 上取，没有就从 local.shared 里取，还没有就去其他 p 的 local.shared 里取，都没有就 new 一个返回。



### Put

```go
func (p *Pool) Put(x interface{}) {
	if x == nil {
		return
	}
	// ...
	l, _ := p.pin()
	if l.private == nil {
		l.private = x
		x = nil
	}
	if x != nil {
		l.shared.pushHead(x)
	}
	runtime_procUnpin()
	// ...
}
```

流程也比较简单：

1. 先绑定 g 和 P，然后尝试将 x 赋值给 private 字段。
2. 如果失败，就调用 `pushHead` 方法尝试将其放入 shared 字段所维护的双端队列中。



#### pushHead

p.pin() 和之前是一样的，就不分析了，主要看一下 pushHead()

```go
func (c *poolChain) pushHead(val interface{}) {
	d := c.head
	if d == nil {
		// 第一次写入，队列为空则进行初始化 默认长度为8
		const initSize = 8 // Must be a power of 2
		d = new(poolChainElt)
		d.vals = make([]eface, initSize)
		c.head = d
		storePoolChainElt(&c.tail, d)
	}
	// 存储元素 存储成功直接返回
	if d.pushHead(val) {
		return
	}

	// The current dequeue is full. Allocate a new one of twice
	// the size.
    // 存储失败说明队列满了 进行扩容
	newSize := len(d.vals) * 2
	if newSize >= dequeueLimit { // 限制一下，不能无限扩容
		newSize = dequeueLimit
	}
	// 扩容逻辑也比较简单，就是首尾相连，构成链表
	d2 := &poolChainElt{prev: d}
	d2.vals = make([]eface, newSize)
	c.head = d2
	storePoolChainElt(&d.next, d2)
	d2.pushHead(val)
}
```

如果 `c.head` 为空，就要创建一个 poolChainElt，作为首结点，当然也是尾节点。它管理的双端队列的长度，初始为 8，放满之后，再创建一个 poolChainElt 节点时，双端队列的长度就要翻倍。当然，有一个最大长度限制（2^30）：

```go
const dequeueBits = 32

const dequeueLimit = (1 << dequeueBits) / 4
```

调用 `poolDequeue.pushHead` 尝试将对象放到 poolDeque 里去：

```go
func (d *poolDequeue) pushHead(val interface{}) bool {
	ptrs := atomic.LoadUint64(&d.headTail)
	head, tail := d.unpack(ptrs)
    // 首先判断队列是否已满： 也就是将尾部指针加上 d.vals 的长度，再取低 31 位，看它是否和 head 相等
	if (tail+uint32(len(d.vals)))&(1<<dequeueBits-1) == head {
		return false
	}
	slot := &d.vals[head&uint32(len(d.vals)-1)]

	// Check if the head slot has been released by popTail.
	typ := atomic.LoadPointer(&slot.typ)
	if typ != nil {
		// Another goroutine is still cleaning up the tail, so
		// the queue is actually still full.
		return false
	}

	// slot占位，将val存入vals中
	if val == nil {
		val = dequeueNil(nil)
	}
	*(*interface{})(unsafe.Pointer(slot)) = val

	// head 增加 1
	atomic.AddUint64(&d.headTail, 1<<dequeueBits)
	return true
}
```



首先判断队列是否已满：

```go
	if (tail+uint32(len(d.vals)))&(1<<dequeueBits-1) == head {
		return false
	}
```

队列没满，通过 head 指针找到即将填充的 slot 位置：取 head 指针的低 31 位。

```go
	slot := &d.vals[head&uint32(len(d.vals)-1)]

	// Check if the head slot has been released by popTail.
	typ := atomic.LoadPointer(&slot.typ)
	if typ != nil {
		// Another goroutine is still cleaning up the tail, so
		// the queue is actually still full.
		return false
	}
```

这里还判断了当前 slot 是否正在被 popTail 释放，popTail 相关语句如下：

```go
    // 最后也是将这个 slot 置空
    // 先清空 val 再清空 typ 操作顺序和 pushHead 正好相反
	slot.val = nil
	atomic.StorePointer(&slot.typ, nil)
```

所以如果 slot.typ==nil 就说明这个 slot 正在被 popTail 释放，说明队列其实还是满的，直接返回 false，走后续的扩容逻辑。

最后，将 val 赋值到 slot，并将 head 指针值加 1。

```go
// slot占位，将val存入vals中
*(*interface{})(unsafe.Pointer(slot)) = val
```

> 这里的实现比较巧妙，slot 是 eface 类型，即空接口，将 slot 转为 interface{} 类型，这样 val 能以 interface{} 赋值给 slot 让 slot.typ 和 slot.val 指向其内存块，于是 slot.typ 和 slot.val 均不为空。



#### pack/unpack

最后我们再来看一下 pack 和 unpack 函数，它们实际上是一组绑定、解绑 head 和 tail 指针的两个函数。

```go
func (d *poolDequeue) pack(head, tail uint32) uint64 {
	const mask = 1<<dequeueBits - 1
	return (uint64(head) << dequeueBits) |
		uint64(tail&mask)
}
```

`mask` 的低 31 位为全 1，其他位为 0，它和 tail 相与，就是只看 tail 的低 31 位。而 head 向左移 32 位之后，低 32 位为全 0。最后把两部分“或”起来，head 和 tail 就“绑定”在一起了。

```go
func (d *poolDequeue) unpack(ptrs uint64) (head, tail uint32) {
	const mask = 1<<dequeueBits - 1
	head = uint32((ptrs >> dequeueBits) & mask)
	tail = uint32(ptrs & mask)
	return
}
```

unpack 则是相反的逻辑，取出 head 指针的方法就是将 ptrs 右移 32 位，再与 mask 相与，同样只看 head 的低 31 位。而 tail 实际上更简单，直接将 ptrs 与 mask 相与就可以了。



#### 小结

Put 和 Get 类似，首先尝试将放到当前 p 的 local.private 上，已经有了就放到 local.shared。



### GC

对于 Pool 而言，并不能无限扩展，否则对象占用内存太多了，会引起内存溢出。

sync.pool 选择了在 GC 时进行清理。

在 pool.go 文件的 init 函数里，注册了 GC 发生时，如何清理 Pool 的函数：

```go
// sync/pool.go
func init() {
	runtime_registerPoolCleanup(poolCleanup)
}
```

编译器在编译时将其注册到运行时：

```go
// src/runtime/mgc.go
 
 
// Hooks for other packages
 
 
var poolcleanup func()
 
 
// 利用编译器标志将 sync 包中的清理注册到运行时
//go:linkname sync_runtime_registerPoolCleanup sync.runtime_registerPoolCleanup
func sync_runtime_registerPoolCleanup(f func()) {
  poolcleanup = f
}
```



具体的 poolCleanup() 函数如下：

```go
func poolCleanup() {
	for _, p := range oldPools {
		p.victim = nil
		p.victimSize = 0
	}


	for _, p := range allPools {
		p.victim = p.local
		p.victimSize = p.localSize
		p.local = nil
		p.localSize = 0
	}

	oldPools, allPools = allPools, nil
}
```

整体看起来，比较简洁。主要是将 local 和 victim 作交换，这样也就不致于让 GC 把所有的 Pool 都清空了，有 victim 在“兜底”。

1. 初始状态下，oldPools 和 allPools 均为 nil。
2. 第 1 次调用 Get，由于 p.local 为 nil，将会在 pinSlow 中创建 p.local，然后将 p 放入 allPools，此时 allPools 长度为 1，oldPools 为 nil。
3. 对象使用完毕，第 1 次调用 Put 放回对象。
4. 第 1 次GC STW 阶段，allPools 中所有 p.local 将值赋值给 victim 并置为 nil。allPools 赋值给 oldPools，最后 allPools 为 nil，oldPools 长度为 1。
5. 第 2 次调用 Get，由于 p.local 为 nil，此时会从 p.victim 里面尝试取对象。
6. 对象使用完毕，第 2 次调用 Put 放回对象，但由于 p.local 为 nil，重新创建 p.local，并将对象放回，此时 allPools 长度为 1，oldPools 长度为 1。
7. 第 2 次 GC STW 阶段，oldPools 中所有 p.victim 置 nil，前一次的 cache 在本次 GC 时被回收，allPools 所有 p.local 将值赋值给 victim 并置为nil，最后 allPools 为 nil，oldPools 长度为 1。

简单来说就是清理时，先清理 oldPools 的 local.victim,然后把 allPools 中的 local 赋值给 victim，最后再把 allPools 赋值给 oldPools，把 allPools 置空。

> GC 时只会清理 oldPools，allPools 只会先把数据转移到 victim，然后把 allPools 变成 oldPools，如果从 oldPools 中读取出来的数据进行 Put 也会直接放到 allPools 中，相当于要两次 GC 都没有被访问到并且Put回来才会被移除。



## 3. 小结

* 1）关键思想是对象的复用，避免重复创建、销毁。将暂时不用的对象缓存起来，待下次需要的时候直接使用，不用再次经过内存分配，复用对象的内存，减轻 GC 的压力。
* 2）`sync.Pool` 是协程安全的，使用起来非常方便。设置好 New 函数后，调用 Get 获取，调用 Put 归还对象。
* 3）不要对 Get 得到的对象有任何假设，更好的做法是归还对象时，将对象“清空”。
* 4）Pool 里对象的生命周期受 GC 影响，不适合于做连接池，因为连接池需要自己管理对象的生命周期。



一些设计思想或者相关知识点：

* lock free：无锁编程是很多编程语言里逃离不了的话题。`sync.Pool`的无锁是在`poolDequeue`和`poolChain`层面实现的。
* 原子操作代替锁：`poolDequeue`对一些关键变量采用了CAS操作，比如`poolDequeue.headTail`，既可完整保证并发又能降低相比锁而言的开销。
* cacheline  false sharing 问题

* noCopy 禁止复制
* 分段锁，降低锁粒度
* victim cache
* 常见优化手段：复用





## 4. 参考

`https://golang.org/src/sync/pool.go`

`https://en.wikipedia.org/wiki/False_sharing`

`https://en.wikipedia.org/wiki/Victim_cache`

`https://zhuanlan.zhihu.com/p/110140126`

`https://medium.com/swlh/go-the-idea-behind-sync-pool-32da5089df72`

`https://zhuanlan.zhihu.com/p/133638023`

`https://www.jianshu.com/p/dc4b5562aad2`

`https://colobu.com/2019/10/08/how-is-sync-Pool-improved-in-Go-1-13/`



[Github]:https://github.com/lixd/i-go/blob/master/a-tutorials/lib/sync_pool/main.go
[pool-structure]:https://github.com/lixd/blog/raw/master/images/golang/lib/sync-pool/pool-structure.png
