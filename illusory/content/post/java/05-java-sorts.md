---
title: "几种常见排序算法的Java实现"
description: "常见排序算法的Java实现"
date: 2019-01-20 22:00:00
draft: false
categories: ["Java"]
tags: ["Java"]
---

本文主要记录了几种常见的排序算法的Java实现，如`冒泡排序`、`快速排序`、`直接插入排序`、`希尔排序`、`选择排序`等等。
<!--more-->

## 1. 冒泡排序

将序列中所有元素两两比较，将最大的放在最后面。

将剩余序列中所有元素两两比较，将最大的放在最后面。

重复第二步，直到只剩下一个数。

```java
    /**
     * 冒泡排序：两两比较，大者交换位置,则每一轮循环结束后最大的数就会移动到最后.
     * 时间复杂度为O(n²) 空间复杂度为O(1)
     */
    private static void bubbleSort(int[] arr) {
        //外层循环length-1次
        for (int i = 0; i < arr.length-1; i++) { 
            //外层每循环一次最后都会排好一个数
            //所以内层循环length-1-i次
            for (int j = 0; j < arr.length - 1 - i; j++) {  
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }
```

## 2. 快速排序

快速排序（Quicksort）是对冒泡排序的一种改进，借用了分治的思想，由C. A. R. Hoare在1962年提出。它的基本思想是：通过一趟排序将要排序的数据分割成独立的两部分，其中一部分的所有数据都比另外一部分的所有数据都要小，然后再按此方法对这两部分数据分别进行快速排序，整个排序过程可以递归进行，以此达到整个数据变成有序序列.

**具体步骤**

快速排序使用分治策略来把一个序列（list）分为两个子序列（sub-lists）。

- ①. 从数列中挑出一个元素，称为”基准”（pivot）。
- ②. 重新排序数列，所有比基准值小的元素摆放在基准前面，所有比基准值大的元素摆在基准后面（相同的数可以到任一边）。在这个分区结束之后，该基准就处于数列的中间位置。这个称为分区（partition）操作。
- ③. 递归地（recursively）把小于基准值元素的子数列和大于基准值元素的子数列排序。

递归到最底部时，数列的大小是零或一，也就是已经排序好了。这个算法一定会结束，因为在每次的迭代（iteration）中，它至少会把一个元素摆到它最后的位置去。

```java
  /**
     * 快速排序
     * 时间复杂度为O(nlogn) 空间复杂度为O(1)
     */
    public static void quickSort(int[] arr, int start, int end) {
        if (start < end) {
            int baseNum = arr[start];//选基准值
            int midNum;//记录中间值
            int left = start;//左指针
            int right = end;//右指针
            while(left<right){
                while ((arr[left] < baseNum) && left < end) {
                    left++;
                }
                while ((arr[right] > baseNum) && right > start) {
                    right--;
                }
                if (left <= right) {
                    midNum = arr[left];
                    arr[left] = arr[right];
                    arr[right] = midNum;
                    left++;
                    right--;
                }
            }
            if (start < right) {
                quickSort(arr, start, right);
            }
            if (end > left) {
                quickSort(arr, left, end);
            }
        }
    }
```

## 3. 直接插入排序

直接插入排序（Straight Insertion Sorting）的基本思想：将数组中的所有元素依次跟前面已经排好的元素相比较，如果选择的元素比已排序的元素小，则交换，直到全部元素都比较过为止。 

首先设定插入次数，即循环次数，for(int i=1;i<length;i++)，1个数的那次不用插入。

设定插入数和得到已经排好序列的最后一个数的位数。insertNum和j=i-1。

从最后一个数开始向前循环，如果插入数小于当前数，就将当前数向后移动一位。

将当前数放置到空着的位置，即j+1。

```java
    /**
     * 直接插入排序
     * 时间复杂度O(n²) 空间复杂度O(1)
     */
    public static void straightInsertion(int[] arr) {
        int current;//要插入的数
        for (int i = 1; i < arr.length; i++) {  //从1开始 第一次一个数不需要排序
            current = arr[i];
            int j = i - 1;//序列元素个数
            while (j >= 0 && arr[j] > current) {//从后往前循环，将大于当前插入数的向后移动
                arr[j + 1] = arr[j];//元素向后移动
                j--;
            }
            arr[j + 1] = current;//找到位置，插入当前元素
        }
    }
```

## 4. 希尔排序

是插入排序的一种高速而稳定的改进版本。

希尔排序是先将整个待排序的记录序列分割成为若干子序列分别进行直接插入排序，待整个序列中的记录“基本有序”时，再对全体记录进行依次直接插入排序。

```java
    /**
     * 希尔排序
     * 时间复杂度O(n²) 空间复杂度O(1)
     */
    public static void shellSort(int[] arr) {
        int gap = arr.length / 2;
        for (; gap > 0; gap = gap / 2) {
            //不断缩小gap，直到1为止
            for (int j = 0; (j + gap) < arr.length; j++) { 
                //使用当前gap进行组内插入排序
                for (int k = 0; (k + gap) < arr.length; k += gap) { 
                    if (arr[k] > arr[k + gap]) { 
                        //交换操作
                        int temp = arr[k];
                        arr[k] = arr[k + gap];
                        arr[k + gap] = temp;
                    }
                }
            }
        }
    }
```

## 5. 选择排序

遍历整个序列，将最小的数放在最前面。

遍历剩下的序列，将最小的数放在最前面。

重复第二步，直到只剩下一个数。

```java
    /**
     * 选择排序
     * 时间复杂度O(n²) 空间复杂度O(1)
     */
    public static void selectSort(int[] arr) {
        for (int i = 0; i < arr.length; i++) { //循环次数
            int min = arr[i];//等会用来放最小值
            int index = i;//用来放最小值的索引
            for (int j = i + 1; j < arr.length; j++) { //找到最小值
                if (arr[j] < min) {
                    min = arr[j];
                    index = j;
                }
            }
            //内层循环结束后进行交换
            arr[index] = arr[i];//当前值放到最小值所在位置
            arr[i] = min;//当前位置放最小值
        }
    }
```

## 6. 堆排序

对简单选择排序的优化。

将序列构建成大顶堆。

将根节点与最后一个节点交换，然后断开最后一个节点。

重复第一、二步，直到所有节点断开。

```java
public  void heapSort(int[] a){
           int len=a.length;
           //循环建堆  
           for(int i=0;i<len-1;i++){
               //建堆  
               buildMaxHeap(a,len-1-i);
               //交换堆顶和最后一个元素  
               swap(a,0,len-1-i);
           }
       }
        //交换方法
       private  void swap(int[] data, int i, int j) {
           int tmp=data[i];
           data[i]=data[j];
           data[j]=tmp;
       }
       //对data数组从0到lastIndex建大顶堆  
       private void buildMaxHeap(int[] data, int lastIndex) {
           //从lastIndex处节点（最后一个节点）的父节点开始  
           for(int i=(lastIndex-1)/2;i>=0;i--){
               //k保存正在判断的节点  
               int k=i;
               //如果当前k节点的子节点存在  
               while(k*2+1<=lastIndex){
                   //k节点的左子节点的索引  
                   int biggerIndex=2*k+1;
                   //如果biggerIndex小于lastIndex，即biggerIndex+1代表的k节点的右子节点存在  
                   if(biggerIndex<lastIndex){
                       //若果右子节点的值较大  
                       if(data[biggerIndex]<data[biggerIndex+1]){
                           //biggerIndex总是记录较大子节点的索引  
                           biggerIndex++;
                       }
                   }
                   //如果k节点的值小于其较大的子节点的值  
                   if(data[k]<data[biggerIndex]){
                       //交换他们  
                       swap(data,k,biggerIndex);
                       //将biggerIndex赋予k，开始while循环的下一次循环，重新保证k节点的值大于其左右子节点的值  
                       k=biggerIndex;
                   }else{
                       break;
                   }
               }
           }
       }
```

## 7. 归并排序

速度仅次于快速排序，内存少的时候使用，可以进行并行计算的时候使用。

选择相邻两个数组成一个有序序列。

选择相邻的两个有序序列组成一个有序序列。

重复第二步，直到全部组成一个有序序列。

```java
public  void mergeSort(int[] a, int left, int right) {  
           int t = 1;// 每组元素个数  
           int size = right - left + 1;  
           while (t < size) {  
               int s = t;// 本次循环每组元素个数  
               t = 2 * s;  
               int i = left;  
               while (i + (t - 1) < size) {  
                   merge(a, i, i + (s - 1), i + (t - 1));  
                   i += t;  
               }  
               if (i + (s - 1) < right)  
                   merge(a, i, i + (s - 1), right);  
           }  
        }  
       
        private static void merge(int[] data, int p, int q, int r) {  
           int[] B = new int[data.length];  
           int s = p;  
           int t = q + 1;  
           int k = p;  
           while (s <= q && t <= r) {  
               if (data[s] <= data[t]) {  
                   B[k] = data[s];  
                   s++;  
               } else {  
                   B[k] = data[t];  
                   t++;  
               }  
               k++;  
           }  
           if (s == q + 1)  
               B[k++] = data[t++];  
           else  
               B[k++] = data[s++];  
           for (int i = p; i <= r; i++)  
               data[i] = B[i];  
        }
```

## 8. 基数排序

用于大量数，很长的数进行排序时。

将所有的数的个位数取出，按照个位数进行排序，构成一个序列。

将新构成的所有的数的十位数取出，按照十位数进行排序，构成一个序列。

```java
public void baseSort(int[] a) {
               //首先确定排序的趟数;    
               int max = a[0];
               for (int i = 1; i < a.length; i++) {
                   if (a[i] > max) {
                       max = a[i];
                   }
               }
               int time = 0;
               //判断位数;    
               while (max > 0) {
                   max /= 10;
                   time++;
               }
               //建立10个队列;    
               List<ArrayList<Integer>> queue = new ArrayList<ArrayList<Integer>>();
               for (int i = 0; i < 10; i++) {
                   ArrayList<Integer> queue1 = new ArrayList<Integer>();
                   queue.add(queue1);
               }
               //进行time次分配和收集;    
               for (int i = 0; i < time; i++) {
                   //分配数组元素;    
                   for (int j = 0; j < a.length; j++) {
                       //得到数字的第time+1位数;  
                       int x = a[j] % (int) Math.pow(10, i + 1) / (int) Math.pow(10, i);
                       ArrayList<Integer> queue2 = queue.get(x);
                       queue2.add(a[j]);
                       queue.set(x, queue2);
                   }
                   int count = 0;//元素计数器;    
                   //收集队列元素;    
                   for (int k = 0; k < 10; k++) {
                       while (queue.get(k).size() > 0) {
                           ArrayList<Integer> queue3 = queue.get(k);
                           a[count] = queue3.get(0);
                           queue3.remove(0);
                           count++;
                       }
                   }
               }
        }
```

## 9. 总结

| 排序法    | 平均时间 | 最小时间 | 最大时间    | 稳定度 | 额外空间 | 备注                          |
| --------- | -------- | -------- | ----------- | ------ | -------- | ----------------------------- |
| 冒泡排序  | O(n2)    | O(n)     | O(n2)       | 稳定   | O(1)     | n小时较好                     |
| 选择排序  | O(n2)    | O(n2)    | O(n2)       | 不稳定 | O(1)     | n小时较好                     |
| 插入排序  | O(n2)    | O(n)     | O(n2)       | 稳定   | O(1)     | 大部分已排序时较好            |
| 基数排序  | O(logRB) | O(n)     | O(logRB)    | 稳定   | O(n)     | B是真数(0-9)，R是基数(个十百) |
| Shell排序 | O(nlogn) | -        | O(ns) 1<s<2 | 不稳定 | O(1)     | s是所选分组                   |
| 快速排序  | O(nlogn) | O(n2)    | O(n2)       | 不稳定 | O(logn)  | n大时较好                     |
| 归并排序  | O(nlogn) | O(nlogn) | O(nlogn)    | 稳定   | O(n)     | 要求稳定性时较好              |
| 堆排序    | O(nlogn) | O(nlogn) | O(nlogn)    | 不稳定 | O(1)     | n大时较好                     |

## 10. 参考

`https://www.cnblogs.com/shixiangwan/p/6724292.html`