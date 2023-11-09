---
title: "Kubernetes教程(九)---Volume 实现原理"
description: "k8s volume 的实现原理，挂载流程等"
date: 2022-06-02
draft: false
categories: ["Kubernetes"]
tags: ["Kubernetes"]
---

本文主要记录了 k8s volume 的实现原理,包括远程卷的 Attach、Mount 过程，CRI Mount Volume 实现以及 PV、PVC、StorageClass 持久化存储体系运作流程。

<!--more-->

## 1. 背景

容器中文件是在磁盘上临时存放的，容器重启后就会丢失，为了解决这个问题引入了 Volume 的概念。

> k8s 中的 volume 和 docker 中的 volume 类似，只不过管理上更加系统化。

k8s 中的 **Volume** 属于 Pod 内部共享资源存储，生命周期和 Pod 相同，与 Container 无关，即使 Pod 上的容器停止或者重启，Volume 不会受到影响，但是如果 Pod 终止，那么这个 Volume 的生命周期也将结束。

这样的存储无法满足有状态服务的需求，于是推出了 **Persistent Volume**，故名思义，持久卷是能将数据进行持久化存储的一种资源对象。它是独立于Pod的一种资源，是一种网络存储，它的生命周期和 Pod 无关。云原生的时代，持久卷的种类也包括很多，iSCSI，RBD，NFS，以及CSI, CephFS, OpenSDS, Glusterfs, Cinder 等网络存储。

>  可以看出，在kubernetes 中支持的持久卷基本上都是网络存储，只是支持的类型不同。

k8s 中支持多种类型的卷(持久卷)，比如：

* 本地的普通卷
  * emptyDir
  * hostpath

* 本地持久化卷
  * local
* 远程文件系统或者块存储
  * nfs
  * rbd
* 一些特殊卷
  * configMap
  * secret



## 2. 挂载流程

整个挂载流程需要 kube-controller-manager、 kubelet 以及 cri 共同完成，一个完整的流程大致可分为以下 两个步骤：

* 1）远程存储挂载至宿主机
  * 1）Attach
    * 由 controller 执行，将远程块存储作为一个远程磁盘挂载到宿主机
  * 2）Mount
    * 由 kubelet 执行，将远程磁盘格式化并挂载到 Volume 对应的宿主机目录
    * 一般是在 /var/lib/kubelet 目录下

* 2）将宿主机目录挂载至 Pod 中
  * 由 CRI 执行，将宿主机上的目录挂载到 Pod 中

第一步是在准备 volume（宿主机目录），第二步才是真正的挂载操作。

> 根据 volume 类型的不同，准备工作也不完全一样，比如 NFS 本身就是文件系统就可以省略 Attach，而 hostpath 本身就是挂载到宿主机目录，甚至连 Mount 这一步都不需要，完全不需要准备工作，CRI 直接挂载即可。



### 1. 远程存储挂载至宿主机

> 只有远程存储才会需要执行该步骤，对应到 k8s 的 api 就是只有使用 PV 的时候才会有这个流程。

该步骤分为两个阶段：

* 阶段一：Attach，挂载磁盘
* 阶段二：Mount，格式化磁盘并 mount 至宿主机目录

最终准备好的 volume 都会放在这个目录下：

```bash
/var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>
```



#### Attach

Attach 阶段由 AttachDetachController + external-attacher 完成。

> 一般缩写为 ADController，是 VolumeController 的一部分，所以也是  kube-controller-manager 的一部分。

AttachDetachController 不断地检查每一个 Pod 对应的 PV 和这个 Pod 所在宿主机之间挂载情况。从而决定，是否需要对这个 PV 进行 Attach（或者 Dettach）操作，为虚拟机挂载远程磁盘。Kubernetes 提供的可用参数是 nodeName，即宿主机的名字。

> 实际上只是创建了一个 VolumeAttachment 对象。

external-attacher 组件观察到由上一步 AttachDetachController 创建的 VolumeAttachment 对象，如果其 .spec.Attacher 中的 Driver name 指定的是自己同一 Pod 内的 CSI Plugin，则调用 CSI Plugin 的ControllerPublish 接口进行 Volume Attach。

对于 Google Cloud 的 Persistent Disk（GCE 提供的远程磁盘服务），那么该阶段就是调用 Goolge Cloud 的 API，将它所提供的 Persistent Disk 挂载到 Pod 所在的宿主机上。

这相当于执行：

```bash
$ gcloud compute instances attach-disk <虚拟机名字> --disk <远程磁盘名字>
```

> 其实就是调用云厂商提供的 API 会虚拟机加一个磁盘。



#### Mount

Mount 阶段由 VolumeManagerReconciler 完成。

> 由于需要在具体的 node 上执行，因此这是 kubelet 组件的一部分。

kubelet 通过 VolumeManager 启动 reconcile loop，当观察到有新的使用 PersistentVolumeSource 为 CSI 的 PV 的 Pod 调度到本节点上，于是调用 reconcile 函数进行 Attach/Detach/Mount/Unmount 相关逻辑处理。

将磁盘设备格式化并挂载到 Volume 宿主机目录。Kubernetes 提供的可用参数是 dir，即 Volume 的宿主机目录。



对于块存储来说相当于执行以下命令：

```bash
# 通过 lsblk 命令获取磁盘设备 ID
$ sudo lsblk
# 格式化成 ext4 格式
$ sudo mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard /dev/<磁盘设备ID>
# 挂载到挂载点
$ sudo mkdir -p /var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>
mount /dev/<磁盘设备ID> /var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>
```

对于 NFS 来说，相当于执行以下命令：

> 因为已经是文件系统，所以可以省去格式化那一步

```bash
$ mount -t nfs <NFS服务器地址>:/ /var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字> 
```



### 2. CRI 将 Volume 挂载到 Pod 中

挑选 CRI 中比较熟悉的 docker 来分析，从 docker 挂载卷出发研究 k8s 中的卷挂载流程。



如果想要在容器中挂载宿主机目录的话，就要带上`-v`参数，以下面这条命令为例：

```bash
docker run -v /home:/test ...
```

它的具体的实现过程如下：

1. 创建容器进程并开启 Mount namespace

   ```c
   int pid = clone(main_function, stack_size, CLONE_NEWNS | SIGCHLD, NULL); 
   ```

2. 将宿主机目录挂载到容器进程的目录中来

   ```c
   mount("/home", "/test", "", MS_BIND, NULL)
   ```

   > 此时虽然开启了 mount namespace，只代表主机和容器之间 mount 点隔离开了，容器仍然可以看到主机的文件系统目录。
   >
   > 通过 **bind mount** 将宿主机目录挂载到容器目录。

3. 调用 `pivot_root` 或 `chroot`，改变容器进程的根目录。至此，容器再也看不到宿主机的文件系统目录了。



出去 namespace 和 rootfs 相关的逻辑，挂载卷的核心逻辑其实就是调用 linux 的 **bind mount** api，将宿主机的目录挂载到容器中的目录上。

> 具体实现见之前写的一个 [简易的 docker](https://github.com/lixd/mydocker)



### 3. 小结

volume 挂载流程如下图所示：

![volume][volume]

* 1）用户创建 Pod，指定使用某个 PVC
* 2）AttachDetachController watch 到有 Pod 创建，且 Pod 指定的 PVC 对应的 PV 还没有执行 Attach，那么就执行 Attach 操作，实际为创建一个 VolumeAttachment 对象
* 3）external-attacher sidecar watch 到有 VolumeAttachment 创建，就调用 CSI Plugin 的ControllerPublish  接口完成 Attach 步骤
* 4）kubelet 通过 VolumeManager 启动 reconcile loop，当观察到有新的使用 PersistentVolumeSource 为CSI 的 PV 的 Pod 调度到本节点上，于是调用 reconcile 函数进行 Mount/Unmount 相关逻辑处理。
* 5）volume 准备完成后，调用 CRI 接口创建 Pod，将 volume 通过 Mounts 参数传递过去，最终由 CRI 将 volume 对应的宿主机目录挂载到 Pod 中



> 先挖个坑， CSI Plugin 相关的后续在分析,先简单贴个图

![csi-arch][csi-arch]



## 3. PV & PVC & StorageClass

k8s 中的 PV & PVC & StorageClass 等概念就是用于描述这套持久化存储体系的。

* PV ：持久化存储数据卷
* PVC：PV 使用请求
* StorageClass：PV 的创建模板

### 1. 背景

在 PV & PVC 出现之前，k8s 其实也是支持持久化存储的。

比如要使用一个 hostpath 类型的 volume，pod yaml 只需要这么写：

```yaml
apiVersion: v1
kind: Pod
metadata:
   name: busybox
spec:
  containers:
   - name : busybox
     image: registry.fjhb.cn/busybox
     imagePullPolicy: IfNotPresent
     command:
      - sleep
      - "3600"
     volumeMounts:
      - mountPath: /busybox-data
        name: data
  volumes:
   - hostPath:
      path: /tmp
     name: data
```



而如果我们要用 Ceph RDB 类型的 Volume，那么 Pod yaml 文件就可以这样写：

```bash
apiVersion: v1
kind: Pod
metadata:
  name: rbd
spec:
  containers:
    - image: kubernetes/pause
      name: rbd-rw
      volumeMounts:
      - name: rbdpd
        mountPath: /mnt/rbd
  volumes:
    - name: rbdpd
      rbd:
        monitors:
        - '10.16.154.78:6789'
        - '10.16.154.82:6789'
        - '10.16.154.83:6789'
        pool: kube
        image: foo
        fsType: ext4
        readOnly: true
        user: admin
        keyring: /etc/ceph/keyring
        imageformat: "2"
        imagefeatures: "layering"
```

这样越算是用上持久化存储了，但是这样有很大的弊端：

* 其一，如果不懂得 Ceph RBD 的使用方法，那么这个 Pod 里 Volumes 字段，你十有八九也完全看不懂。
* 其二，这个 Ceph RBD 对应的存储服务器的地址、用户名、授权文件的位置，也都被轻易地暴露给了全公司的所有开发人员，这是一个典型的信息被“过度暴露”的例子。



**k8s 为了降低了用户声明和使用持久化 Volume 的门槛，引入了 PV 和 PVC API 对象。**



### 2. 相关概念

#### PV 

PV 描述的是持久化存储数据卷。

假设我们在远程存储服务那边创建一块空间，用于作为某个 Pod 的 Volume，比如：NFS 下的某个目录或者某个 Ceph RDB 服务。

PV 对象就是用于代表持久化存储数据卷的。

假设现在我准备了一个 NFS 用来做持久化存储，为了让 k8s 知道这个东西，我需要创建一个 PV 对象:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs
spec:
  storageClassName: manual
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: 10.244.1.4
    path: "/"
```

其中指明了 nfs 的 server 和 path 等信息，有了这部分信息就可以使用这个 NFS 服务了。

> 由于需要关联到专业的存储知识，一般由运维人员创建。

#### PVC

PVC  描述的是对持久化存储数据卷的需求，作为一个开发人员，可能不懂存储，因此创建 PV 需要的这些字段不知道怎么填。

为了减轻使用负担，k8s 推出 PV 的同时还推出了 PVC，一个 pvc demo 如下：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: manual
  resources:
    requests:
      storage: 1Gi
```

内容非常简单，只需要指定需要的访问模式以及需要的存储空间大小即可，完全不用管专业的存储知识。

> 使用简单，不需要存储知识，一般由开发人员自己创建。

#### StorageClass

StorageClass 其中的一个作用是关联 PV 和 PVC，只有 StorageClass 相同的 PV 和 PVC 才会被绑定在一起。

另一个作用则是充当 PV 的模板，用于实现动态创建 PV，也就是 k8s 中的 **Dynamic Provisioning** 机制。

将 PV 和 PVC 分开后使用上确实简单了，但是由于二者分别由不同用户创建，很可能出现创建了 PVC 找不到相匹配的 PV 的情况，毕竟运维人员也不知道需要那些类型的 PV。

> 一般是运维人员发现问题后再去收到创建出对应的 PV。

为了解决这个问题， k8s 又推出了 StorageClass 以及 **Dynamic Provisioning** 机制。

根据 PVC 以及 StorageClass 自动创建 PV，极大降低了运维人员的工作量。 

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-sc
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
parameters:
  archiveOnDelete: "false"
reclaimPolicy: "Delete"
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner-nfs-sc
```

> 注意：光有 StorageClass 是没法自动创建出 PV 的，还需要一个配套的 provisioner组件才行。



### 3. 运作流程

PV & PVC & StorageClass 下的存储体系具体运作流程如下：

#### 1. 创建 StorageClass & provisioner

首先由运维人员创建对应 StorageClass 并在 K8S 集群中运行配套的 provisioner 组件。

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-sc
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
parameters:
  archiveOnDelete: "false"
reclaimPolicy: "Delete"
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner-nfs-sc
```

StorageClass 中的 provisioner 指明了要使用的 provisioner，然后以 deployment 方式部署对应的 provisioner：

> 当然这里还需要 RBAC 权限等配置，比较多先省略了,完整配置见 [nfs-subdir-external-provisioner](https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner-nfs-sc
  labels:
    app: nfs-client-provisioner-nfs-sc
  namespace: kube-system
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner-nfs-sc
  template:
    metadata:
      labels:
        app: nfs-client-provisioner-nfs-sc
    spec:
      serviceAccountName: nfs-client-provisioner
      tolerations:
      - key: "node-role.kubernetes.io/master"
        operator: "Exists"
        effect: "NoSchedule"
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: node-role.kubernetes.io/master
                operator: In
                values:
                - ""
      containers:
        - name: nfs-client-provisioner
          image: caas4/nfs-subdir-external-provisioner:v4.0.2
          volumeMounts:
            - name: nfs-client-root
              mountPath: /persistentvolumes
          env:
            - name: PROVISIONER_NAME
              value: k8s-sigs.io/nfs-subdir-external-provisioner-nfs-sc
            - name: NFS_SERVER
              value: 172.20.151.105
            - name: NFS_PATH
              value: /tmp/nfs/data
      volumes:
        - name: nfs-client-root
          nfs:
            server: 172.20.151.105
            path: /tmp/nfs/data
```

其中以环境变量的方式指明了 PROVISIONER_NAME 为 `k8s-sigs.io/nfs-subdir-external-provisioner-nfs-sc`，以及 NFS 的相关参数。

StorageClass 中的 `provisioner: k8s-sigs.io/nfs-subdir-external-provisioner-nfs-sc` 和这里的 PROVISIONER_NAME  是对应的，因此可以找到对应的 provisioner。



#### 2. 创建 PVC

然后开发人员创建需要的 PVC，比如

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: test-claim
spec:
  storageClassName: nfs-sc
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Mi
```

需要注意的一点是 storageClassName 必须和前面创建的 StorageClass 对应。

PVC 创建之后就轮到 **PersistentVolumeController** 登场了。

PersistentVolumeController 会根据 PVC 寻找对应的 PV 来进行绑定，没有的话自然无法绑定。

这时候我们前面创建的 provisioner 就起作用了，他会 watch pvc 对象，比如这里我们创建了  PVC，provisioner 就会收到相应事件，然后根据 PVC 中的 storageClassName 找到对应 StorageClass，然后根据 StorageClass中的 provisioner 字段找到对应 provisioner，发现是自己处理的，就 调用 **CSI Plugin** 的接口 CreateVolume 创建出 volume，然后在 k8s 里创建对应的 PV 来指代这个 volume。

> CSI Plugin CreateVolume 接口则由具体厂商实现，比如 阿里云实现的 CreateVolume  可能就是在阿里云上创建了一块云盘。

最后 PV 创建之后，PersistentVolumeController 就将二者进行绑定。



#### 3. 创建 Pod

PVC 和 PV 绑定之后就可以使用了，创建一个 Pod 来使用这个 PVC：

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: test-pod
spec:
  containers:
  - name: test-pod
    image: busybox:stable
    command:
      - "/bin/sh"
    args:
      - "-c"
      - "touch /mnt/SUCCESS && exit 0 || exit 1"
    volumeMounts:
      - name: nfs-pvc
        mountPath: "/mnt"
  restartPolicy: "Never"
  volumes:
    - name: nfs-pvc
      persistentVolumeClaim:
        claimName: test-claim
```

这里就是通过 claimName 来指定要使用的 PVC。

Pod 创建之后 k8s 就可以根据 claimName 找到对应 PVC，然后 PVC 绑定的时候会把 PV 的名字填到 spec.volumeName 字段上，因此这里又可以找到对应的 PV，然后就进入到第二节中的挂载流程了。



#### 4. 小结

至此，k8s 的这套持久化存储体系运作流程就算是完成了。流程如下图所示：

![dynamic-provisioning][dynamic-provisioning]

* 1）管理员预先创建好 StorageClass 和 Provisioner
* 2）用户创建 PVC
* 3）根据 PVC 中的 StorageClass 最终找到 Provisioner
* 4）Provisioner 创建 PV
* 5）PersistentVolumeController 绑定 PVC 和 PV
* 6）创建 Pod 时指定 PVC，随后进入第二节的持久卷挂载流程



## 4. 参考

[persistent-volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

[storage-classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)

[CSI Spec](https://github.com/container-storage-interface/spec/blob/ad238e5cad5a27188fcdae1ff3ace3f612638ca5/spec.md)



[csi-arch]:https://github.com/lixd/blog/raw/master/images/kubernetes/csi/csi-arch.png
[volume]:https://github.com/lixd/blog/raw/master/images/kubernetes/csi/volume.png
[dynamic-provisioning]:https://github.com/lixd/blog/raw/master/images/kubernetes/csi/dynamic-provisioning.png

