---
title: "基于Hexo搭建个人博客(五)---压缩篇"
description: "通过gulp工具压缩静态文件提升网站加载速度"
date: 2018-12-24 22:00:00
draft: false
categories: ["Blog"]
tags: ["Hexo"]
---

本章主要记录了如何通过`gulp`工具压缩压缩博客静态文件以加快网站加载速度。

<!--more-->

在本系列文章的第二章中也有类似静态资源压缩的教程，是用的`hexo-neat`插件，最近用着用着出现了一点点问题，无奈之下换用了`gulp`。这个工具也可以很方便的压缩静态资源。

## 1. 插件安装

首先需要安装`gulp`工具

命令：`npm install gulp`

接着安装功能模块，包括

```shell
# 清理html
gulp-htmlclean
# 压缩html
gulp-htmlmin
# 压缩css
gulp-minify-css
# 混淆js
gulp-uglify

# 一键安装
npm install gulp-htmlclean gulp-htmlmin gulp-minify-css gulp-uglify --save
```



## 2. 创建任务

在站点根目录下，新建`gulpfile.js`文件，文件内容如下:

```javascript
var gulp = require('gulp');

//Plugins模块获取
var minifycss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var htmlmin = require('gulp-htmlmin');
var htmlclean = require('gulp-htmlclean');
//压缩css
gulp.task('minify-css', function () {
return gulp.src('./public/**/*.css')
.pipe(minifycss())
.pipe(gulp.dest('./public'));
});
//压缩html
gulp.task('minify-html', function () {
return gulp.src('./public/**/*.html')
.pipe(htmlclean())
.pipe(htmlmin({
removeComments: true,
minifyJS: true,
minifyCSS: true,
minifyURLs: true,
}))

.pipe(gulp.dest('./public'))
});
//压缩js 不压缩min.js
gulp.task('minify-js', function () {
return gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
.pipe(uglify())
.pipe(gulp.dest('./public'));
});

//4.0以前的写法 
//gulp.task('default', [
  //  'minify-html', 'minify-css', 'minify-js'
//]);
//4.0以后的写法
// 执行 gulp 命令时执行的任务
gulp.task('default', gulp.parallel('minify-html', 'minify-css', 'minify-js', function() {
  // Do something after a, b, and c are finished.
}));
 
```

## 3. 使用

使用时按照以下顺序就可以了：

```shell
# 先清理文件
hexo clean
# 编译生成静态文件
hexo g
# gulp插件执行压缩任务
gulp
# 开启服务
hexo s
```

## 4. 问题

刚开始弄这个的时候也是各种百度，Google，大部分的文章也是这么写的但是，第二部的js 代码却都有问题，也不能说有问题吧，大部分都是4.0以前的写法，导致现在gulp更新到4.0之后全都无法使用了。可能在看到这篇文章之前也试了各种办法。然后每次都出现这样的问题：

```shell

assert.js:85
  throw new assert.AssertionError({
  ^
AssertionError: Task function must be specified
    at Gulp.set [as _setTask] (/home/hope/web/node_modules/undertaker/lib/set-task.js:10:3)
    at Gulp.task (/home/hope/web/node_modules/undertaker/lib/task.js:13:8)
.................
```

在看了下gulp相关资料后才发现了问题，接着把js代码稍微改了改终于能用了。不过运行的时候好像也有点问题，不过不影响使用，对这些工具还是不太了解。

```shell
[21:35:20] The following tasks did not complete: default, <anonymous>
[21:35:20] Did you forget to signal async completion?
# TODO
```