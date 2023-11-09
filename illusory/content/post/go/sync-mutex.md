---
title: "Go语言之sync.Mutex 源码分析"
description: "sync.Mutex 源码分析"
date: 2021-11-05 22:00:00
draft: false
tags: ["Golang"]
categories: ["Golang"]
---

Go 语言在 `sync` 包中提供了用于同步的一些基本原语,`sync.Mutex` 就是其中最常用的一个。

<!--more-->

> 本文基于 Go 1.17.1



## 1. 基本结构

Go 语言的 `sync.Mutex`由两个字段 `state` 和 `sema` 组成。其中 `state` 表示当前互斥锁的状态，而 `sema` 是用于控制锁状态的信号量。

```go
// sync/mutex.go 25行
type Mutex struct {
	state int32
	sema  uint32
}
```

上述两个字段加起来只占 8 字节空间的结构体表示了 Go 语言中的互斥锁。



### 状态

互斥锁的状态比较复杂，如下图所示，最低三位分别表示 `mutexLocked`、`mutexWoken` 和 `mutexStarving`，剩下的位置用来表示当前有多少个 Goroutine 在等待互斥锁的释放：

![mutex-state][mutex-state]

`int32` 中的不同位分别表示了不同的状态：

- `mutexLocked` — 表示互斥锁的锁定状态；
- `mutexWoken` — 表示从正常模式被从唤醒；
- `mutexStarving` — 当前的互斥锁进入饥饿状态；
- `waitersCount` — 当前互斥锁上等待的 Goroutine 个数

在默认情况下，互斥锁的所有状态位都是 0，即默认为未锁定状态。

> 同时也表明 Mutex 是不需要初始化的

源码中也提供了相关常量

```go
// sync/mutex.go 36
const (

    mutexLocked = 1 << iota // 1 0001 含义：用最后一位表示当前对象锁的状态，0-未锁住 1-已锁住

    mutexWoken // 2 0010 含义：用倒数第二位表示当前对象是否被唤醒 0-唤醒 1-未唤醒

    mutexStarving // 4 0100 含义：用倒数第三位表示当前对象是否为饥饿模式，0为正常模式，1为饥饿模式。

    mutexWaiterShift = iota // 3，从倒数第四位往前的bit位表示在排队等待的goroutine数

    starvationThresholdNs = 1e6 // 1ms 切换到饥饿模式的阈值

)
```



### 正常模式和饥饿模式

Mutex 有两种模式：

* 正常模式；
* 饥饿模式。

**在正常模式下**，锁的等待者会按照先进先出的顺序获取锁。但是刚被唤起的 Goroutine 与新创建的 Goroutine 竞争时，大概率会获取不到锁，为了减少这种情况的出现，一旦 Goroutine 超过 1ms 没有获取到锁，它就会将当前互斥锁切换饥饿模式，防止部分 Goroutine 被**饿死**。

> **引入饥饿模式的目的是保证互斥锁的公平性。**
>
> 说明 Mutex 是公平锁。

**在饥饿模式中**，互斥锁会直接交给等待队列最前面的 Goroutine。新的 Goroutine 在该状态下不能获取锁、也不会进入自旋状态，它们只会在队列的末尾等待。如果一个 Goroutine 获得了互斥锁并且它在队列的末尾或者它等待的时间少于 1ms，那么当前的互斥锁就会切换回正常模式。

> 与饥饿模式相比，正常模式下的互斥锁能够提供更好地性能，饥饿模式的能避免 Goroutine 由于陷入等待无法获取锁而造成的高尾延时。

这里贴一下源码中的注释

```txt
Mutex fairness.

Mutex can be in 2 modes of operations: normal and starvation.
In normal mode waiters are queued in FIFO order, but a woken up waiter
does not own the mutex and competes with new arriving goroutines over
the ownership. New arriving goroutines have an advantage -- they are
already running on CPU and there can be lots of them, so a woken up
waiter has good chances of losing. In such case it is queued at front
of the wait queue. If a waiter fails to acquire the mutex for more than 1ms,
it switches mutex to the starvation mode.

In starvation mode ownership of the mutex is directly handed off from
the unlocking goroutine to the waiter at the front of the queue.
New arriving goroutines don't try to acquire the mutex even if it appears
to be unlocked, and don't try to spin. Instead they queue themselves at
the tail of the wait queue.

If a waiter receives ownership of the mutex and sees that either
(1) it is the last waiter in the queue, or (2) it waited for less than 1 ms,
it switches mutex back to normal operation mode.

Normal mode has considerably better performance as a goroutine can acquire
a mutex several times in a row even if there are blocked waiters.
Starvation mode is important to prevent pathological cases of tail latency.
```





## 2. 加解锁过程

在`sync`包中 中定义了 Locker 接口：

```go
// sync/mutex.go 31 行
type Locker interface {
        Lock()
        Unlock()
}
```

Mutex 实现了 Locker 接口。除了互斥锁 Mutex 之外读写锁 RWMutex，也实现了 Locker 接口。



### Lock

互斥锁的加锁是靠 Mutex.Lock 方法完成的，以下代码进行了简化，省略了 race 相关代码，只保留主干部分：

```go
// sync/mutex.go 72 行
func (m *Mutex) Lock() {
	// Fast path: grab unlocked mutex.
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}
	// Slow path (outlined so that the fast path can be inlined)
	m.lockSlow()
}
```

可以看到，整个加锁过程分为 Fast path 和 Slow Path。

#### Fast path

```go
if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
    return
}
```

如果 m.state 为 0,说明当前锁为未锁定状态，将其设置为 1。

这也是最简单的部分，直接通过一个 CAS 操作，尝试获取锁。

#### Slow Path

如果互斥锁的状态不是 0 时就会进入 Slow Path。尝试通过自旋（Spinnig）等方式等待锁的释放，该方法的主体是一个非常大 for 循环，这里将它分成几个部分介绍获取锁的过程：

* 1）判断当前 Goroutine 能否进入自旋；
* 2）通过自旋等待互斥锁的释放；
* 3）计算互斥锁的最新状态；
* 4）更新互斥锁的状态并获取锁；

```go
func (m *Mutex) lockSlow() {
   var waitStartTime int64
   starving := false
   awoke := false
   iter := 0
   old := m.state
   for {
      if old&(mutexLocked|mutexStarving) == mutexLocked && runtime_canSpin(iter) {
         if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
            atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
            awoke = true
         }
         runtime_doSpin()
         iter++
         old = m.state
         continue
      }
      new := old
   
      if old&mutexStarving == 0 {
         new |= mutexLocked
      }
      if old&(mutexLocked|mutexStarving) != 0 {
         new += 1 << mutexWaiterShift
      }
      if starving && old&mutexLocked != 0 {
         new |= mutexStarving
      }
      if awoke {
         if new&mutexWoken == 0 {
            throw("sync: inconsistent mutex state")
         }
         new &^= mutexWoken
      }
      if atomic.CompareAndSwapInt32(&m.state, old, new) {
         if old&(mutexLocked|mutexStarving) == 0 {
            break // locked the mutex with CAS
         }
         queueLifo := waitStartTime != 0
         if waitStartTime == 0 {
            waitStartTime = runtime_nanotime()
         }
         runtime_SemacquireMutex(&m.sema, queueLifo, 1)
         starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
         old = m.state
         if old&mutexStarving != 0 {
            if old&(mutexLocked|mutexWoken) != 0 || old>>mutexWaiterShift == 0 {
               throw("sync: inconsistent mutex state")
            }
            delta := int32(mutexLocked - 1<<mutexWaiterShift)
            if !starving || old>>mutexWaiterShift == 1 {
               delta -= mutexStarving
            }
            atomic.AddInt32(&m.state, delta)
            break
         }
         awoke = true
         iter = 0
      } else {
         old = m.state
      }
   }
}
```



**1）判断当前 Goroutine 能否进入自旋；**

**自旋是一种多线程同步机制**，当前的进程在进入自旋的过程中会一直保持 CPU 的占用，持续检查某个条件是否为真。**在多核的 CPU 上，自旋可以避免 Goroutine 的切换**，使用恰当会对性能带来很大的增益，但是使用的不恰当就会拖慢整个程序，所以 Goroutine 进入自旋的条件非常苛刻：

* 1）互斥锁只有在普通模式才能进入自旋；
* 2）`runtime.sync_runtime_canSpin`需要返回 true
  * 运行在多 CPU 的机器上；
  * 当前 Goroutine 为了获取该锁进入自旋的次数小于四次；
  * 当前机器上至少存在一个正在运行的处理器 P 并且处理的运行队列为空；

```go
// runtime/proc.go 6364 行
func sync_runtime_canSpin(i int) bool {
	if i >= active_spin || ncpu <= 1 || gomaxprocs <= int32(sched.npidle+sched.nmspinning)+1 {
		return false
	}
	if p := getg().m.p.ptr(); !runqempty(p) {
		return false
	}
	return true
}
```

**2）通过自旋等待互斥锁的释放；**

一旦当前 Goroutine 能够进入自旋就会调用`runtime.sync_runtime_doSpin`和`runtime.procyield`执行 30 次的 `PAUSE` 指令，该指令只会占用 CPU 并消耗 CPU 时间：

```go
// runtime/proc.go 6381 行
func sync_runtime_doSpin() {
	procyield(active_spin_cnt)
}
```

```txt
// runtime/asm_386.s 574 行
TEXT runtime·procyield(SB),NOSPLIT,$0-0
	MOVL	cycles+0(FP), AX
again:
	PAUSE
	SUBL	$1, AX
	JNZ	again
	RET
```



**3）计算互斥锁的最新状态；**

 处理了自旋相关的特殊逻辑之后，互斥锁会根据上下文计算当前互斥锁最新的状态。几个不同的条件分别会更新 `state` 字段中存储的不同信息 — `mutexLocked`、`mutexStarving`、`mutexWoken` 和 `mutexWaiterShift`：

```go
new := old
if old&mutexStarving == 0 {
    new |= mutexLocked
}
if old&(mutexLocked|mutexStarving) != 0 {
    new += 1 << mutexWaiterShift
}
if starving && old&mutexLocked != 0 {
    new |= mutexStarving
}
if awoke {
    if new&mutexWoken == 0 {
        throw("sync: inconsistent mutex state")
    }
    new &^= mutexWoken
}
```

**4）更新互斥锁的状态并获取锁；**

计算了新的互斥锁状态之后，会使用 CAS 函数更新状态

```go
if atomic.CompareAndSwapInt32(&m.state, old, new) {
    if old&(mutexLocked|mutexStarving) == 0 {
        break // locked the mutex with CAS
    }
    queueLifo := waitStartTime != 0
    if waitStartTime == 0 {
        waitStartTime = runtime_nanotime()
    }
    runtime_SemacquireMutex(&m.sema, queueLifo, 1)
    starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
    old = m.state
    if old&mutexStarving != 0 {
        if old&(mutexLocked|mutexWoken) != 0 || old>>mutexWaiterShift == 0 {
            throw("sync: inconsistent mutex state")
        }
        delta := int32(mutexLocked - 1<<mutexWaiterShift)
        if !starving || old>>mutexWaiterShift == 1 {
            delta -= mutexStarving
        }
        atomic.AddInt32(&m.state, delta)
        break
    }
    awoke = true
    iter = 0
} else {
    old = m.state
}
```

如果没有通过 CAS 获得锁，会调用 `runtime.sync_runtime_SemacquireMutex` 通过信号量保证资源不会被两个 Goroutine 获取。

`runtime.sync_runtime_SemacquireMutex` 会在方法中不断尝试获取锁并陷入休眠等待信号量的释放，一旦当前 Goroutine 可以获取信号量，它就会立刻返回，`sync.Mutex.Lock`的剩余代码也会继续执行。

- 在正常模式下，这段代码会设置唤醒和饥饿标记、重置迭代次数并重新执行获取锁的循环；
- 在饥饿模式下，当前 Goroutine 会获得互斥锁，如果等待队列中只存在当前 Goroutine，互斥锁还会从饥饿模式中退出；

其中还包含了状态切换的部分逻辑:

```go
var waitStartTime int64
for{ // for 循环里尝试获取锁
    if waitStartTime == 0 { // waitStartTime 只有第一次执行时才会赋值
        waitStartTime = runtime_nanotime()
    }
    // 如果等待时间超过 1ms 则切换到饥饿模式
    starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
}
```



### Unlock

相比之下互斥锁的解锁过程就比较简单,同样分为 Fast path 和 Slow path。

```go
func (m *Mutex) Unlock() {
	// Fast path: drop lock bit.
	new := atomic.AddInt32(&m.state, -mutexLocked)
	if new != 0 {
		// Outlined slow path to allow inlining the fast path.
		// To hide unlockSlow during tracing we skip one extra frame when tracing GoUnblock.
		m.unlockSlow(new)
	}
}
```



#### Fast path

该过程会先使用`atomic.AddInt32函数快速解锁，这时会发生下面的两种情况：`

- 如果该函数返回的新状态等于 0，当前 Goroutine 就成功解锁了互斥锁；
- 如果该函数返回的新状态不等于 0，则进入 Slow path。



#### Slow path

```go
func (m *Mutex) unlockSlow(new int32) {
   if (new+mutexLocked)&mutexLocked == 0 {
      throw("sync: unlock of unlocked mutex")
   }
   if new&mutexStarving == 0 {
      old := new
      for {
         if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken|mutexStarving) != 0 {
            return
         }
         new = (old - 1<<mutexWaiterShift) | mutexWoken
         if atomic.CompareAndSwapInt32(&m.state, old, new) {
            runtime_Semrelease(&m.sema, false, 1)
            return
         }
         old = m.state
      }
   } else {
      runtime_Semrelease(&m.sema, true, 1)
   }
}
```



先校验锁状态的合法性 — 如果当前互斥锁已经被解锁过了会直接抛出异常 “sync: unlock of unlocked mutex” 中止当前程序。

```go
if (new+mutexLocked)&mutexLocked == 0 {
    throw("sync: unlock of unlocked mutex")
}
```

然后根据当前锁模式分别处理

```go
if new&mutexStarving == 0 { // 正常模式
    
}else{ // 饥饿模式
    
}
```



在正常模式下，上述代码会使用如下所示的处理过程：

- 如果互斥锁不存在等待者或者互斥锁的 `mutexLocked`、`mutexStarving`、`mutexWoken` 状态不都为 0，那么当前方法可以直接返回，不需要唤醒其他等待者；
- 如果互斥锁存在等待者，会通过`runtime_Semrelease`唤醒等待者并移交锁的所有权；

在饥饿模式下，上述代码会直接调用`runtime_Semrelease`将当前锁交给下一个正在尝试获取锁的等待者，等待者被唤醒后会得到锁，在这时互斥锁还不会退出饥饿状态；

```go
// runtime/sema.go 65行
func sync_runtime_Semrelease(addr *uint32, handoff bool, skipframes int) {
	semrelease1(addr, handoff, skipframes)
}

func semrelease1(addr *uint32, handoff bool, skipframes int) {
	root := semroot(addr)
	atomic.Xadd(addr, 1)

	if atomic.Load(&root.nwait) == 0 {
		return
	}

	// Harder case: search for a waiter and wake it.
	lockWithRank(&root.lock, lockRankRoot)
	if atomic.Load(&root.nwait) == 0 {
		unlock(&root.lock)
		return
	}
	s, t0 := root.dequeue(addr)
	if s != nil {
		atomic.Xadd(&root.nwait, -1)
	}
	unlock(&root.lock)
	if s != nil { // May be slow or even yield, so unlock first
		acquiretime := s.acquiretime
		if acquiretime != 0 {
			mutexevent(t0-acquiretime, 3+skipframes)
		}
		if s.ticket != 0 {
			throw("corrupted semaphore ticket")
		}
		if handoff && cansemacquire(addr) {
			s.ticket = 1
		}
		readyWithTime(s, 5+skipframes)
		if s.ticket == 1 && getg().m.locks == 0 {
			goyield()
		}
	}
}

```





## 3. 小结

互斥锁的**加锁过程**比较复杂，它涉及自旋、信号量以及调度等概念：

- 如果互斥锁处于初始化状态，会通过置位 `mutexLocked` 加锁；
- 如果互斥锁处于 `mutexLocked` 状态并且在普通模式下工作，会进入自旋，执行 30 次 `PAUSE` 指令消耗 CPU 时间等待锁的释放；
- 如果当前 Goroutine 等待锁的时间超过了 1ms，互斥锁就会切换到饥饿模式；
- 互斥锁在正常情况下会通过`sync_runtime_SemacquireMutex`将尝试获取锁的 Goroutine 切换至休眠状态，等待锁的持有者唤醒；
- 如果当前 Goroutine 是互斥锁上的最后一个等待的协程或者等待的时间小于 1ms，那么它会将互斥锁切换回正常模式；

互斥锁的**解锁过程**与之相比就比较简单：

* 当互斥锁已经被解锁时，调用 Mutex.Lock 会直接抛出异常；
* 当互斥锁处于饥饿模式时，将锁的所有权交给队列中的下一个等待者，等待者会负责设置 `mutexLocked` 标志位；
* 当互斥锁处于普通模式时，如果没有 Goroutine 等待锁的释放或者已经有被唤醒的 Goroutine 获得了锁，会直接返回；在其他情况下会通过`sync.runtime_Semrelease` 唤醒对应的 Goroutine；





[mutex-state]:https://github.com/lixd/blog/raw/master/images/golang/lib/sync-mutex/mutex-state.png

