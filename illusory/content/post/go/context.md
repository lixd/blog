---
title: "Go语言之 Context 实战与源码分析"
description: "context包结构分析及其基本使用介绍"
date: 2021-10-22 22:00:00
draft: false
tags: ["Golang"]
categories: ["Golang"]
---

本文主要简单介绍了Go语言(golang)中的`context`包。给出了context 的基本用法和使用建议，并从源码层面对其底层结构和具体实现原理进行分析。

<!--more-->

## 1. 概述

> 以下分析基于 Go 1.17.1



### 1.1 什么是 Context

上下文 `context.Context`在Go 语言中用来设置截止日期、同步信号，传递请求相关值的结构体。上下文与 Goroutine 有比较密切的关系，是 Go 语言中独特的设计，在其他编程语言中我们很少见到类似的概念。

主要用于**超时控制**和多Goroutine间的**数据传递**。

> 注：这里的数据传递主要指全局数据，如 链路追踪里的 traceId 之类的数据，并不是普通的参数传递(也**非常不推荐用来传递参数**)。



### 1.2 设计原理

因为`context.Context`主要作用就是进行超时控制，然后外部程序监听到超时后就可以停止执行任务，取消 Goroutine。

> 网上有很多用 Context 来取消 Goroutine 的字眼，初学者(比如笔者)可能误会，以为 Context 可以直接取消 Goroutine。

**实际，Context 只是完成了一个信号的传递，具体的取消逻辑需要由程序自己监听这个信号，然后手动处理。**



Go 语言中的 Context 通过构建一颗 **Context 树**，从而将没有层级的 Goroutine 关联起来。如下图所示：

![context-tree][context-tree]

> 所有 Context 都依赖于 BackgroundCtx 或者 TODOCtx，其实这二者都是一个 emptyCtx，只是语义上不一样。



**在超时或者手动取消的时候信号都会从最顶层的 Goroutine 一层一层传递到最下层**。这样该 Context 关联的所有 Goroutine 都能收到信号，然后进入自定义的退出逻辑。

![context-cancel][context-cancel]

> 比如这里手动取消了 ctxB1，然后 ctxB1 的两个子ctx(C1和C2)也会收到取消信号，这样3个Goroutine都能收到取消信号进行退出了。



### 1.3 使用场景

最常见的就是 后台 HTTP/RPC Server。

在 Go 的 server 里，通常每来一个请求都会启动若干个 goroutine 同时工作：有些去数据库拿数据，有些调用下游接口获取相关数据,具体如下图：

![req-step][req-step]



而客户端一般不会无限制的等待，都会被请求设定超时时间，比如100ms。

比如这里GoroutineA消耗80ms，GoroutineB3消耗30ms，已经超时了，那么后续的GoroutineCDEF都没必要执行了，客户端已经超时返回了，服务端就算计算出结果也没有任何意义了。

所以这里就可以使用 Context 来在多个 Goroutine 之间进行超时信号传递。

同时引入超时控制后有两个好处：

* 1）客户端可以快速返回，提升用户体验
* 2）服务端可以减少无效的计算



## 2. Demo 演示

> 相关代码见 [Github][Github]

### 2.1 WithCancel

返回一个可以手动取消的 Context，可以手动调用 cancel() 方法以取消该 context。

```go
// 启动一个 worker goroutine 一直产生随机数，知道找到满足条件的数时，手动调用 cancel 取消 ctx，让 worker goroutine 退出
func main() {
	rand.Seed(time.Now().UnixNano())
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*100)
	// defer cancel() // 一般推荐 defer 中调用cancel()
	ret := make(chan int)
	go RandWithCancel(ctx, ret)
	for r := range ret {
		// 当找到满足条件的数时就退出
		if r ==20 {
			fmt.Println("find r:", r)
			break
		}
	}
	cancel()                // 这里测试就手动调用cancel() 取消context
	time.Sleep(time.Second) // sleep 等待 worker goroutine 退出
}

func RandWithCancel(ctx context.Context, ret chan int) {
	defer close(ret)
	timer := time.NewTimer(time.Millisecond)
	for {
		select {
		case <-ctx.Done():
			fmt.Println("ctx cancel")
			timer.Stop()
			return
		case <-timer.C:
			r := rand.Intn(100)
			ret <- r
			timer.Reset(time.Millisecond)
		}
	}
}
```



### 2.2 WithDeadline & WithTimeout

可以自定义超时时间，时间到了自动取消context。

其实 WithTimeout就是对 WithDeadline 的一个封装：

```go
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc) {
	return WithDeadline(parent, time.Now().Add(timeout))
}
```



```go
// 启动一个 worker goroutine 一直产生随机数，直到 ctx 超时后退出
func main() {
	rand.Seed(time.Now().UnixNano())
	// ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*100)
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(time.Millisecond*100))
	// defer cancel() // 一般推荐 defer 中调用cancel()
	ret := make(chan int)
	go RandWithTimeout(ctx, ret)
	for r := range ret {
		// 当找到满足条件的数时就退出
		if r == 20 {
			fmt.Println("find r:", r)
			break
		}
	}
	cancel()                // 这里测试就手动调用cancel() 取消context
	time.Sleep(time.Second) // sleep 等待 worker goroutine 退出
}

func RandWithTimeout(ctx context.Context, ret chan int) {
	defer close(ret)
	timer := time.NewTimer(time.Millisecond)
	for {
		select {
		case <-ctx.Done():
			fmt.Println("ctx cancel")
			timer.Stop()
			return
		case <-timer.C:
			r := rand.Intn(100)
			ret <- r
			timer.Reset(time.Millisecond)
		}
	}
}

```

在这个案例中，因为限制了超时时间，所以并不是每次都能找到满足条件的 r 值。



### 2.3 WithValue

可以传递数据的context，携带关键信息，为全链路提供线索，比如接入elk等系统，需要来一个trace_id，那WithValue就非常适合做这个事。

```go
// 通过 ctx 进行超时控制的同时，在 ctx 中存放 traceId 进行链路追踪。
func main() {
	withTimeout, cancel := context.WithTimeout(context.Background(), time.Millisecond*1)
	defer cancel()
	ctx := context.WithValue(withTimeout, "traceId", "id12345")
	r := f1(ctx)
	fmt.Println("r:", r)
}

func f1(ctx context.Context) int {
	fmt.Println("f1 traceId:", fromCtx(ctx))
	var ret = make(chan int, 1)
	go f2(ctx, ret)
	r1 := rand.Intn(10)
	fmt.Println("r1:", r1)
	select {
	case <-ctx.Done():
		return r1
	case r2 := <-ret:
		return r1 + r2
	}
}

func f2(ctx context.Context, ret chan int) {
	fmt.Println("f2 traceId:", fromCtx(ctx))
	// sleep 模拟耗时逻辑
	time.Sleep(time.Millisecond * 10)
	r2 := rand.Intn(10)
	fmt.Println("r2:", r2)
	ret <- r2
}

func fromCtx(ctx context.Context) string {
	return ctx.Value("traceId").(string)
}

```

为了进行超时控制，本就需要在多个 goroutine 之前传递 ctx，所以把 traceId 这种信息存放到 ctx 中是非常方便的。



## 3. 源码分析

Context 在 Go 1.7 版本引入标准库中，主要内容可以概括为：

* **1 个接口**
  * Context
* **4 种实现**
  * emptyCtx
  * cancelCtx
  * timerCtx
  * valueCtx
* **6 个方法**
  * Background
  * TODO
  * WithCancel
  * WithDeadline
  * WithTimeout
  * WithValue



### 1 个接口

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key interface{}) interface{}
}
```

* Deadline() ：返回一个time.Time，表示当前Context应该结束的时间，ok则表示有结束时间
* Done()：返回一个只读chan，如果可以从该 chan 中读取到数据，则说明 ctx 被取消了
* Err()：返回 Context 被取消的原因
* Value(key)：返回key对应的value，是协程安全的



同时包中也定义了提供 `cancel` 功能需要实现的接口。这个主要是后文会提到的“取消信号、超时信号”需要去实现。

```go
// A canceler is a context type that can be canceled directly. The
// implementations are *cancelCtx and *timerCtx.
type canceler interface {
	cancel(removeFromParent bool, err error)
	Done() <-chan struct{}
}

```

### 4 种实现

为了更方便的创建 Context，包里定义了 Background 来作为所有 Context 的根，它是一个 emptyCtx 的实例。



#### emptyCtx

这也是最简单的一个 ctx

```go
type emptyCtx int

func (*emptyCtx) Deadline() (deadline time.Time, ok bool) {
	return
}

func (*emptyCtx) Done() <-chan struct{} {
	return nil
}

func (*emptyCtx) Err() error {
	return nil
}

func (*emptyCtx) Value(key interface{}) interface{} {
	return nil
}
```

过空方法实现了 context.Context 接口，它没有任何功能。

Background 和 TODO 这两个方法都会返回预先初始化好的私有变量 `background` 和 `todo`，它们会在同一个 Go 程序中被复用：

```go
var (
    background = new(emptyCtx)
    todo       = new(emptyCtx) 
)

func Background() Context {
    return background
}
func TODO() Context {
	return todo
}
```

从源代码来看，context.Background 和 context.TODO和也只是互为别名，没有太大的差别，只是在使用和语义上稍有不同：

* context.Background 是上下文的默认值，所有其他的上下文都应该从它衍生出来；
* context.TODO 应该仅在不确定应该使用哪种上下文时使用；

在多数情况下，如果当前函数没有上下文作为入参，我们都会使用 context.Background 作为起始的上下文向下传递。



#### cancelCtx

这是一个带 cancel 功能的 context。

```go
type cancelCtx struct {
    // 直接嵌入了一个 Context，那么可以把 cancelCtx 看做是一个 Context
	Context

	mu       sync.Mutex            // protects following fields
	done     atomic.Value          // of chan struct{}, created lazily, closed by first cancel call
	children map[canceler]struct{} // set to nil by the first cancel call
	err      error                 // set to non-nil by the first cancel call
}
```

同时 cancelCtx 还实现了 canceler 接口，提供了 cancel 方法，可以手动取消：

```go
type canceler interface {
	cancel(removeFromParent bool, err error)
	Done() <-chan struct{}
}
```

实现了上面定义的两个方法的 Context，就表明该 Context 是可取消的。

创建 cancelCtx 的方法如下：

```go
func WithCancel(parent Context) (ctx Context, cancel CancelFunc) {
	if parent == nil {
		panic("cannot create context from nil parent")
	}
	c := newCancelCtx(parent)
	propagateCancel(parent, &c)
	return &c, func() { c.cancel(true, Canceled) }
}
func newCancelCtx(parent Context) cancelCtx {
	return cancelCtx{Context: parent}
}
```

这是一个暴露给用户的方法，传入一个父 Context（这通常是一个 `background`，作为根节点），返回新建的 context，并通过闭包的形式，返回了一个 cancel 方法。



`newCancelCtx`将传入的上下文包装成私有结构体`context.cancelCtx`。

`propagateCancel`则会构建父子上下文之间的关联，形成树结构，当父上下文被取消时，子上下文也会被取消：

```go
func propagateCancel(parent Context, child canceler) {
    // 1.如果 parent ctx 是不可取消的 ctx，则直接返回 不进行关联
	done := parent.Done()
	if done == nil {
		return // parent is never canceled
	}
    // 2.接着判断一下 父ctx 是否已经被取消
	select {
	case <-done:
        // 2.1 如果 父ctx 已经被取消了，那就没必要关联了
        // 然后这里也要顺便把子ctx给取消了，因为父ctx取消了 子ctx就应该被取消
        // 这里是因为还没有关联上，所以需要手动触发取消
		// parent is already canceled
		child.cancel(false, parent.Err())
		return
	default:
	}
    // 3. 从父 ctx 中提取出 cancelCtx 并将子ctx加入到父ctx 的 children 里面
	if p, ok := parentCancelCtx(parent); ok {
		p.mu.Lock()
        // double check 一下，确认父 ctx 是否被取消
		if p.err != nil {
            // 取消了就直接把当前这个子ctx给取消了
			// parent has already been canceled
			child.cancel(false, p.err)
		} else {
            // 否则就添加到 children 里面
			if p.children == nil {
				p.children = make(map[canceler]struct{})
			}
			p.children[child] = struct{}{}
		}
		p.mu.Unlock()
	} else {
        // 如果没有找到可取消的父 context。新启动一个协程监控父节点或子节点取消信号
		atomic.AddInt32(&goroutines, +1)
		go func() {
			select {
			case <-parent.Done():
				child.cancel(false, parent.Err())
			case <-child.Done():
			}
		}()
	}
}
```

上述函数总共与父上下文相关的三种不同的情况：

* 1）当 `parent.Done() == nil`，也就是 `parent` 不会触发取消事件时，当前函数会直接返回；
* 2）当 `child` 的继承链包含可以取消的上下文时，会判断 `parent` 是否已经触发了取消信号；
  * 如果已经被取消，`child` 会立刻被取消；
  * 如果没有被取消，`child` 会被加入 `parent` 的 `children` 列表中，等待 `parent` 释放取消信号；
* 3）当父上下文是开发者自定义的类型、实现了 context.Context 接口并在 `Done()` 方法中返回了非空的管道时；
  * 运行一个新的 Goroutine 同时监听 `parent.Done()` 和 `child.Done()` 两个 Channel；
  * 在 `parent.Done()` 关闭时调用 `child.cancel` 取消子上下文；

`propagateCancel` 的作用是在 `parent` 和 `child` 之间同步取消和结束的信号，保证在 `parent` 被取消时，`child` 也会收到对应的信号，不会出现状态不一致的情况。

```go
func parentCancelCtx(parent Context) (*cancelCtx, bool) {
	done := parent.Done()
    // 如果 done 为 nil 说明这个ctx是不可取消的
    // 如果 done == closedchan 说明这个ctx不是标准的 cancelCtx，可能是自定义的
	if  done == closedchan || done == nil {
		return nil, false
	}
    // 然后调用 value 方法从ctx中提取出 cancelCtx
	p, ok := parent.Value(&cancelCtxKey).(*cancelCtx)
	if !ok {
		return nil, false
	}
    // 最后再判断一下cancelCtx 里存的 done 和 父ctx里的done是否一致
    // 如果不一致说明parent不是一个 cancelCtx
	pdone, _ := p.done.Load().(chan struct{})
	if pdone != done {
		return nil, false
	}
	return p, true
}
```



cancelCtx 的 done 方法肯定会返回一个 `chan struct{}`

```go
func (c *cancelCtx) Done() <-chan struct{} {
	d := c.done.Load()
	if d != nil {
		return d.(chan struct{})
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	d = c.done.Load()
	if d == nil {
		d = make(chan struct{})
		c.done.Store(d)
	}
	return d.(chan struct{})
}
var closedchan = make(chan struct{})
```

然后 cancelCtx 的 Value 方法

```go
func (c *cancelCtx) Value(key interface{}) interface{} {
	if key == &cancelCtxKey {
		return c
	}
	return c.Context.Value(key)
}
```

所以这里`parent.Value(&cancelCtxKey)`返回值就是parent内部的 cancelCtx。

parentCancelCtx 其实就是判断 parent context 里面有没有一个 cancelCtx，有就返回，让子context可以“挂靠”到parent context 上，如果不是就返回false，不进行挂靠，自己新开一个 goroutine 来监听。



最后再看一下比较重要的 cancel 方法。

```go
func (c *cancelCtx) cancel(removeFromParent bool, err error) {
    // 参数校验 调用 cancel 必须传一个 err 进来，说明 cancel 的原因
	if err == nil {
		panic("context: internal error: missing cancel error")
	}
	c.mu.Lock()
	if c.err != nil {
        // 如果 err 不为空，说明已经取消过了，直接返回
		c.mu.Unlock()
		return // already canceled
	}
	c.err = err
    // 然后更新 done 的值
	d, _ := c.done.Load().(chan struct{})
	if d == nil {
        // 如果为空就直接赋值为一个已经关闭的chan
		c.done.Store(closedchan)
	} else {
        // 如果有值就把对应chan直接关闭
		close(d)
	}
    // 接下来就是循环调用 取消掉 子context
	for child := range c.children {
		// NOTE: acquiring the child's lock while holding parent's lock.
		child.cancel(false, err)
	}
	c.children = nil
	c.mu.Unlock()
    // 最后更加参数来确定是否需要将该context从父content.children 中移除
	if removeFromParent {
        // 大部分情况下该参数都为 true 因为取消子context后肯定要和父context解开关联
        // 只有当前子context还没添加到父context时，父context就被取消了，这种情况下会传false进来
		removeChild(c.Context, c)
	}
}
```



#### timerCtx

timerCtx 内部不仅通过嵌入 cancelCtx 的方式承了相关的变量和方法，还通过持有的定时器 `timer` 和截止时间 `deadline` 实现了定时取消的功能：

```go
type timerCtx struct {
	cancelCtx
	timer *time.Timer // Under cancelCtx.mu.

	deadline time.Time
}

func (c *timerCtx) Deadline() (deadline time.Time, ok bool) {
	return c.deadline, true
}

func (c *timerCtx) cancel(removeFromParent bool, err error) {
	c.cancelCtx.cancel(false, err)
	if removeFromParent {
		removeChild(c.cancelCtx.Context, c)
	}
	c.mu.Lock()
	if c.timer != nil {
		c.timer.Stop()
		c.timer = nil
	}
	c.mu.Unlock()
}
```

timerCtx.cancel 不仅调用了 cancelCtx.cancel 方法，还会停止持有的定时器减少不必要的资源浪费。

实际上对外提供了 WithTimeout 方法只是 WithDeadline 的封装：

```go
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc) {
	return WithDeadline(parent, time.Now().Add(timeout))
}


func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
	if parent == nil {
		panic("cannot create context from nil parent")
	}
	if cur, ok := parent.Deadline(); ok && cur.Before(d) {
		// The current deadline is already sooner than the new one.
             // 如果父节点 context 的 deadline 早于指定时间。直接构建一个可取消的 context。
        // 原因是一旦父节点超时，自动调用 cancel 函数，子节点也会随之取消。
        // 所以不用单独处理子节点的计时器时间到了之后，自动调用 cancel 函数
        // 毕竟如果父节点1分钟后过期，那不可能在这个父节点下创建一个两分钟后过期的子节点
		return WithCancel(parent)
	}
	c := &timerCtx{
		cancelCtx: newCancelCtx(parent),
		deadline:  d,
	}
	propagateCancel(parent, c)
	dur := time.Until(d)
	if dur <= 0 {
		c.cancel(true, DeadlineExceeded) // deadline has already passed
		return c, func() { c.cancel(false, Canceled) }
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.err == nil {
		c.timer = time.AfterFunc(dur, func() {
			c.cancel(true, DeadlineExceeded)
		})
	}
	return c, func() { c.cancel(true, Canceled) }
}
```

和 WithCancel 大致逻辑是相同的，除了多了一个 timer 来定时取消：

```go
	c.timer = time.AfterFunc(dur, func() {
			c.cancel(true, DeadlineExceeded)
		})
```

里面的一个 deadLine 判断也比较有意思：

```go
  if cur, ok := parent.Deadline(); ok && cur.Before(deadline){
        return WithCancel(parent)
    }
```

如果父节点 context 的 deadline 早于本次创建子节点的 deadline ，那就没必要给子节点创建一个 timerCtx了，因为根据 deadline 来看，父节点肯定会早与这个子节点取消，而父节点取消后，子节点也会跟着被取消，所以没必要给子节点创建 timer，直接创建一个 cancelCtx 将子节点挂到父节点上就行了，效果是一样的，还剩下一个 timer。



#### valueCtx

```go
type valueCtx struct {
	Context
	key, val interface{}
}
```

valueCtx 则是多了 key、val 两个字段来存数据。

```go
func WithValue(parent Context, key, val interface{}) Context {
	if parent == nil {
		panic("cannot create context from nil parent")
	}
	if key == nil {
		panic("nil key")
	}
	if !reflectlite.TypeOf(key).Comparable() {
		panic("key is not comparable")
	}
	return &valueCtx{parent, key, val}
}
```

直接基于 parent 构建了一个 valueCtx，比较简单。注意点是这个方法对 key 的要求是**可比较的(comparable)**，因为之后需要通过 key 取出 context 中的值，可比较是必须的。

取值的过程，实际上是一个递归查找的过程：

```go
func (c *valueCtx) Value(key interface{}) interface{} {
	if c.key == key {
		return c.val
	}
	return c.Context.Value(key)
}
```

如果 key 和当前 ctx 中存的 value 一致就直接返回，没有就去 parent 中找。最终找到根节点（一般是 emptyCtx），直接返回一个 nil。所以用 Value 方法的时候要判断结果是否为 nil。

> 因为这里要比较两个 key 是否一致，所以创建的时候必须要求 key 是 comparable。

![context-value][context-value]

类似于一个链表，其实效率是很低的，不建议用来传参数。



## 4. 使用建议

在官方博客里，对于使用 context 提出了几点建议：

1. Do not store Contexts inside a struct type; instead, pass a Context explicitly to each function that needs it. The Context should be the first parameter, typically named ctx.
2. Do not pass a nil Context, even if a function permits it. Pass context.TODO if you are unsure about which Context to use.
3. Use context Values only for request-scoped data that transits processes and APIs, not for passing optional parameters to functions.
4. The same Context may be passed to functions running in different goroutines; Contexts are safe for simultaneous use by multiple goroutines.

翻译过来就是：

1. **不要将 Context 塞到结构体里**。直接将 Context 类型作为函数的第一参数，而且一般都命名为 ctx。
2. 不要向函数传入一个 nil 的 context，如果你实在不知道传什么，标准库给你准备好了一个 context：todo。
3. 不要把本应该作为函数参数的类型塞到 context 中，context 存储的应该是一些共同的数据。例如：登陆的 session、cookie 等。
4. 同一个 context 可能会被传递到多个 goroutine，别担心，context 是并发安全的。





## 5. 参考

`https://pkg.go.dev/context`

`https://faiface.github.io/post/context-should-go-away-go2/`

`https://draveness.me/golang/docs/part3-runtime/ch06-concurrency/golang-context/`

`https://blog.csdn.net/qq_36183935/article/details/81137834`

`https://blog.csdn.net/u011957758/article/details/82948750`

`https://www.jianshu.com/p/e5df3cd0708b`

`https://zhuanlan.zhihu.com/p/68792989`





[Github]:https://github.com/lixd/i-go/tree/master/a-tutorials/lib/ctx
[context-tree]:https://github.com/lixd/blog/raw/master/images/golang/lib/context/context-tree.png
[context-cancel]:https://github.com/lixd/blog/raw/master/images/golang/lib/context/context-cancel.png
[req-step]: https://github.com/lixd/blog/raw/master/images/golang/lib/context/req-step.png
[context-value]:https://github.com/lixd/blog/raw/master/images/golang/lib/context/context-value.png

