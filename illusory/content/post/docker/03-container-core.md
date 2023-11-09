---
title: "Docker教程(三)---核心实现原理分析"
description: "Docker容器核心实现原理分析"
date: 2021-02-14 22:00:00
draft: false
tags: ["Docker"]
categories: ["Docker"]
---



本文主要介绍了 Docker容器的核心实现原理，包括 Namespace、Cgroups、rootfs 等。

<!--more-->

> 接触容器也很长时间了，期间也查阅了不少资料，神秘的 Docker 容器也逐渐变得不那么神秘，于是想着简单整理一下 docker 容器的核心实现原理。



## 1. 容器与进程

**进程就是程序运行起来后的计算机执行环境的总和**。

> 即：计算机内存中的数据、寄存器里的值、堆栈中的指令、被打开的文件，以及各种设备的状态信息的一个集合。

**容器技术的核心功能，就是通过约束和修改进程的动态表现，从而为其创造出一个“边界”**。

> 对于 Docker 等大多数 Linux 容器来说，**Cgroups** 技术是用来制造约束的主要手段，而 **Namespace** 技术则是用来修改进程视图的主要方法。



## 2. 隔离与限制

### 1. Namespace 

**Namespace** 技术实际上修改了应用进程看待整个计算机“视图”，即它的“视线”被操作系统做了限制，只能“看到”某些指定的内容。

在 Linux 下可以根据隔离的属性不同分为不同的 Namespace ：

* 1）PID Namespace
* 2）Mount Namespace
* 3）UTS Namespace
* 4）IPC Namespace
* 5）Network Namespace
* 6）User Namespace



**Namespace 存在的问题**

最大的问题就是隔离得不彻底。

首先，既然容器只是运行在宿主机上的一种特殊的进程，那么多个容器之间使用的就还是同一个宿主机的操作系统内核。

其次，在 Linux 内核中，有很多资源和对象是不能被 Namespace 化的，最典型的例子就是：时间。

> 容器中修改了时间，实际修改的是宿主机时间，那么宿主机上所有容器的时间都跟着变化了。



### 2. Cgroups

Linux Cgroups 就是 Linux 内核中用来为进程设置资源限制的一个重要功能。

> Linux Cgroups 的全称是 Linux Control Group。

**它最主要的作用，就是限制一个进程组能够使用的资源上限**，包括 CPU、内存、磁盘、网络带宽等等。

在 Linux 中，Cgroups 给用户暴露出来的操作接口是文件系统，即它以文件和目录的方式组织在操作系统的 /sys/fs/cgroup 路径下。

```sh
#查看 cgroups 相关文件
$ mount -t cgroup
# 结果大概是这样的
cgroup on /sys/fs/cgroup/systemd type cgroup (rw,nosuid,nodev,noexec,relatime,xattr,release_agent=/usr/lib/systemd/systemd-cgroups-agent,name=systemd)
cgroup on /sys/fs/cgroup/net_cls,net_prio type cgroup (rw,nosuid,nodev,noexec,relatime,net_prio,net_cls)
cgroup on /sys/fs/cgroup/memory type cgroup (rw,nosuid,nodev,noexec,relatime,memory)
cgroup on /sys/fs/cgroup/devices type cgroup (rw,nosuid,nodev,noexec,relatime,devices)
cgroup on /sys/fs/cgroup/cpu,cpuacct type cgroup (rw,nosuid,nodev,noexec,relatime,cpuacct,cpu)
cgroup on /sys/fs/cgroup/cpuset type cgroup (rw,nosuid,nodev,noexec,relatime,cpuset)
cgroup on /sys/fs/cgroup/perf_event type cgroup (rw,nosuid,nodev,noexec,relatime,perf_event)
cgroup on /sys/fs/cgroup/freezer type cgroup (rw,nosuid,nodev,noexec,relatime,freezer)
cgroup on /sys/fs/cgroup/blkio type cgroup (rw,nosuid,nodev,noexec,relatime,blkio)
cgroup on /sys/fs/cgroup/hugetlb type cgroup (rw,nosuid,nodev,noexec,relatime,hugetlb)
cgroup on /sys/fs/cgroup/pids type cgroup (rw,nosuid,nodev,noexec,relatime,pids)
```



可以看到，在`/sys/fs/cgroup` 下面有很多诸如 cpuset、cpu、 memory 这样的子目录，也叫子系统。也就是这台机器当前可以被 Cgroups 进行限制的资源种类。

比如，对 CPU 子系统来说，我们就可以看到如下几个配置文件，这个指令是：

```sh
ls /sys/fs/cgroup/cpu
# 目录下大概有这么一些内容
assist                 cgroup.event_control  cgroup.sane_behavior  cpuacct.stat   cpuacct.usage_percpu  cpu.cfs_quota_us  cpu.rt_runtime_us  cpu.stat  notify_on_release  system.slice
cgroup.clone_children  cgroup.procs                 cpuacct.usage  cpu.cfs_period_us     cpu.rt_period_us  cpu.shares      release_agent      tasks
```



**例子：限制CPU使用**

而这样的配置文件又如何使用呢？

你需要在对应的子系统下面创建一个目录，比如，我们现在进入 /sys/fs/cgroup/cpu 目录下：

```sh
[root@iz2ze0ephck4d0aztho5r5z cpu]# mkdir container
[root@iz2ze0ephck4d0aztho5r5z cpu]# ls container/
cgroup.clone_children  cgroup.event_control  cgroup.procs  cpuacct.stat  cpuacct.usage  cpuacct.usage_percpu  cpu.cfs_period_us  cpu.cfs_quota_us  cpu.rt_period_us  cpu.rt_runtime_us  cpu.shares  cpu.stat  notify_on_release  tasks
```

这个目录就称为一个“控制组”。你会发现，操作系统会在你新创建的 container 目录下，自动生成该子系统对应的资源限制文件。

现在，我们在后台执行这样一条脚本:

```sh
$ while : ; do : ; done &
[1] 27218
```

显然，它执行了一个死循环，可以把计算机的 CPU 吃到 100%，根据它的输出，我们可以看到这个脚本在后台运行的进程号（PID）是 27218。

查看一下CPU占用

```sh
$ top

PID USER      PR  NI    VIRT    RES    SHR S %CPU %MEM     TIME+ COMMAND    
27218 root      20   0  115680    672    152 R 99.9  0.0   2:07.07 bash                                                  
```

果然这个PID=27218的进程占用了差不多100%的CPU。

结下来我们就通过Cgroups对其进行限制，这里就用前面创建的 container这个“控制组”。

我们可以通过查看 container 目录下的文件，看到 container 控制组里的 CPU quota 还没有任何限制（即：-1），CPU period 则是默认的 100  ms（100000  us）：

```sh
$ cat /sys/fs/cgroup/cpu/container/cpu.cfs_quota_us 
-1
$ cat /sys/fs/cgroup/cpu/container/cpu.cfs_period_us 
100000
```

接下来，我们可以通过修改这些文件的内容来设置限制。比如，向 container 组里的 cfs_quota 文件写入 20 ms（20000 us）：

```sh
$ echo 20000 > /sys/fs/cgroup/cpu/container/cpu.cfs_quota_us
```

这样意味着在每 100  ms 的时间里，被该控制组限制的进程只能使用 20  ms 的 CPU 时间，也就是说这个进程只能使用到 20% 的 CPU 带宽。

接下来，我们把被限制的进程的 PID 写入 container 组里的 tasks 文件，上面的设置就会对该进程生效了：

```sh
$ echo 27218 > /sys/fs/cgroup/cpu/container/tasks 
```

使用 top 指令查看一下

```shell
$ top

PID USER      PR  NI    VIRT    RES    SHR S %CPU %MEM     TIME+ COMMAND    
27218 root      20   0  115680    672    152 R 20 0.0   2:07.07 bash                                                  
```

果然CPU被限制到了20%.

除 CPU 子系统外，Cgroups 的每一个子系统都有其独有的资源限制能力，比如：

* blkio，为块设备设定I/O 限制，一般用于磁盘等设备；
* cpuset，为进程分配单独的 CPU 核和对应的内存节点；
* memory，为进程设定内存使用的限制。

**Linux Cgroups 的设计还是比较易用的，简单粗暴地理解呢，它就是一个子系统目录加上一组资源限制文件的组合。**



而对于 Docker 等 Linux 容器项目来说，它们只需要在每个子系统下面，为每个容器创建一个控制组（即创建一个新目录），然后在启动容器进程之后，把这个进程的 PID 填写到对应控制组的 tasks 文件中就可以了。

而至于在这些控制组下面的资源文件里填上什么值，就靠用户执行 docker run 时的参数指定了，比如这样一条命令：

```shell
$ docker run -it --cpu-period=100000 --cpu-quota=20000 ubuntu /bin/bash
```

在启动这个容器后，我们可以通过查看 Cgroups 文件系统下，CPU 子系统中，“docker”这个控制组里的资源限制文件的内容来确认：

```shell
$ cat /sys/fs/cgroup/cpu/docker/5d5c9f67d/cpu.cfs_period_us 
100000
$ cat /sys/fs/cgroup/cpu/docker/5d5c9f67d/cpu.cfs_quota_us 
20000
```



**Cgroups 存在的问题**

Cgroups 对资源的限制能力也有很多不完善的地方，被提及最多的自然是 /proc 文件系统的问题。

**问题**

如果在容器里执行 top 指令，就会发现，它显示的信息居然是宿主机的 CPU 和内存数据，而不是当前容器的数据。

造成这个问题的原因就是，/proc 文件系统并不知道用户通过 Cgroups 给这个容器做了什么样的资源限制，即：/proc 文件系统不了解 Cgroups 限制的存在。

**解决方案**

使用 `lxcfs`

top 命令是从 /prof/stats 目录下获取数据，所以从道理上来讲，容器不挂载宿主机的 /prof/stats 目录就可以了。

lxcfs就是来实现这个功能的，做法是把宿主机的 /var/lib/lxcfs/proc/memoinfo 文件挂载到Docker容器的/proc/meminfo位置后。容器中进程读取相应文件内容时，LXCFS的FUSE实现会从容器对应的Cgroup中读取正确的内存限制。从而使得应用获得正确的资源约束设定。kubernetes环境下，也能用，以 ds 方式运行 lxcfs ，自动给容器注入争取的 proc 信息。



## 3. 容器镜像

### 1. 文件系统

**容器中的文件系统是什么样子的?** 

因为容器中的文件系统经过 Mount Namespace 隔离，所以应该是独立的。

其中 **Mount Namespace 修改的，是容器进程对文件系统“挂载点”的认知**。只有在“挂载”这个操作发生之后，进程的视图才会被改变。而在此之前，新创建的容器会直接继承宿主机的各个挂载点。

不难想到，我们可以在容器进程启动之前重新挂载它的整个根目录“/”。而由于 Mount Namespace 的存在，这个挂载对宿主机不可见，所以容器进程就可以在里面随便折腾了。

Linux 中**chroot**命令（change root file system）就能很方便的完成上述工作。

> 而 Mount Namespace 正是基于对 chroot 的不断改良才被发明出来的，它也是 Linux 操作系统里的第一个 Namespace。



### 2. rootfs

**而这个挂载在容器根目录上、用来为容器进程提供隔离后执行环境的文件系统，就是所谓的“容器镜像”。它还有一个更为专业的名字，叫作：rootfs（根文件系统）**。

**rootfs 只是一个操作系统所包含的文件、配置和目录，并不包括操作系统内核**。在 Linux 操作系统中，这两部分是分开存放的，操作系统只有在开机启动时才会加载指定版本的内核镜像。

所以说，rootfs 只包括了操作系统的“躯壳”，并没有包括操作系统的“灵魂”。**实际上，同一台机器上的所有容器，都共享宿主机操作系统的内核**。

> 这也是容器相比于虚拟机的主要缺陷之一：毕竟后者不仅有模拟出来的硬件机器充当沙盒，而且每个沙盒里还运行着一个完整的 Guest OS 给应用随便折腾。



不过，正是**由于 rootfs 的存在，容器才有了一个被反复宣传至今的重要特性：一致性**。由于 rootfs 里打包的不只是应用，而是**整个操作系统的文件和目录**，也就意味着，应用以及它运行所需要的所有依赖，都被封装在了一起。



### 3. 镜像层（Layer）

Docker 在镜像的设计中，引入了层（layer）的概念。也就是说，用户制作镜像的每一步操作，都会生成一个层，也就是一个增量 rootfs。

**通过引入层（layer）的概念，实现了 rootfs 的复用**。不必每次都重新创建一个 rootfs，而是基于某一层进行修改即可。

Docker 镜像层用到了一种叫作**联合文件系统（Union File System）**的能力。Union File System 也叫 UnionFS，最主要的功能是将多个不同位置的目录联合挂载（union mount）到同一个目录下。

> 例如将目录A和目录B挂载到目录C下面，这样目录C下就包含目录A和目录B的所有文件。

Docker 镜像分为多个层，然后使用 UFS 将这多个层挂载到一个目录下面，这样这个目录就包含了完整的文件了。

> UnionFS 在不同系统有各自的实现，所以Docker的不同发行版使用的也不一样，可以通过 docker info 查看。常见有 aufs（ubuntu常用）、overlay2（centos常用）



镜像只包含了静态文件，但是容器会产生实时数据，所以容器的 rootfs 在镜像的基础上增加了**可读写层和 Init 层**。

> 即容器 rootfs包括：只读层（镜像rootfs）+ init 层（容器启动时初始化修改的部分数据） + 可读写层（容器中产生的实时数据）。

**只读层（镜像rootfs）**

它是这个容器的 rootfs 最下面的几层，即**镜像中的所有层的总和**，它们的挂载方式都是只读的（ro+wh，即 readonly+whiteout）

**可读写层（容器中产生的实时数据）**

它是这个容器的 rootfs 最上面的一层，它的挂载方式为：rw，即 read write。在没有写入文件之前，这个目录是空的。

而一旦在容器里做了写操作，你修改产生的内容就会以增量的方式出现在这个层中，删除操作实现比较特殊（类似于标记删除）。

AUFS的whiteout的实现是通过在上层的可写的目录下建立对应的whiteout隐藏文件来实现的。

为了实现删除操作，aufs（UnionFS的一种实现） 会在可读写层创建一个 whiteout 文件，把只读层里的文件“遮挡”起来。

> 比如，你要删除只读层里一个名叫 foo 的文件，那么这个删除操作实际上是在可读写层创建了一个名叫.wh.foo 的文件。这样，当这两个层被联合挂载之后，foo 文件就会被.wh.foo 文件“遮挡”起来，“消失”了。

**init 层（容器启动时初始化修改的部分数据）**

它是一个以“-init”结尾的层，夹在只读层和读写层之间，Init 层是 Docker 项目单独生成的一个内部层，专门用来存放 /etc/hosts、/etc/resolv.conf 等信息。

**为什么需要init层？**

比如 hostname 这样的数据，原本是属于镜像层的一部分，要修改的话只能在可读写层进行修改，但是又不想在 docker commit 的时候把这些信息提交上去，所以使用init 层来保存这些修改。

> 可以理解为提交代码的时候一般也不会把各种配置信息一起提交上去。

> docker commit 只会提交 只读层和可读写层。



## 4. 小结

Docker 容器的实现主要使用了如下3个功能：

* 1）Linux Namespace 的隔离能力

* 2）Linux Cgroups 的限制能力

* 3）基于 rootfs 的文件系统



Docker 容器全景图如下：

![docker-overview][docker-overview]

> 图源：深入剖析Kubernetes

## 5. 参考

`https://draveness.me/docker/`

`https://en.wikipedia.org/wiki/Linux_namespaces`

`https://0xax.gitbooks.io/linux-insides/content/Cgroups/linux-cgroups-1.html`

`https://coolshell.cn/articles/17061.html`

`深入剖析Kubernetes`





[docker-overview]:https://github.com/lixd/blog/raw/master/images/docker/docker-overview.jpg

