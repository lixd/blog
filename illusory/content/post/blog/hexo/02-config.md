---
title: "基于Hexo搭建个人博客(二)---主题优化篇"
description: "博客主题相关配置"
date: 2018-11-03 22:00:00
draft: false
categories: ["Blog"]
tags: ["Hexo"]
---

本章主要包含了博客主题优化相关内容，第三方服务和插件的配置与使用。如：炫酷头像动态背景、链接变色、鼠标点击效果、站点字数、访客数统计等。

<!--more-->

### 0. 选择主题

你可以点击这里选择你喜欢的[Themes](https://hexo.io/themes/),里面有大量美观的主题 

我这里用的是简约著称的`Next`主题.

- 下载主题
  - 使用`git`命令下载该主题到本地.
  - `git clone https://github.com/theme-next/hexo-theme-next themes/next`  
  - clone成功后,你的Themes文件夹下就会有next主题文件了.
- Hexo配置文件:
  - 都叫`_config.yml `
  - 一份位于站点根目录下，主要包含 Hexo 本身的配置,称为 `站点配置文件`
  - 另一份位于主题目录下主要用于配置主题相关的选项,称为`主题配置文件`
- 开启主题
  - `站点配置文件`进行修改: 将`theme: landscape`修改为 `theme: next` 

### 1. 侧边栏头像设置

新版next注意引入了该功能,直接在`主题配置文件`修改即可,如下:

```yml
# Sidebar Avatar 头像
avatar:
  url: /images/avatar.gif
  # 圆形头像
  rounded: true
  # 透明度 0~1之间
  opacity: 1
  # 头像旋转
  rotated: true
```

### 2. 设置个人社交图标链接

直接在`主题配置文件`修改即可,如下:

```yml
# Social Links. 社交链接 前面为链接地址 后面是图标 
social:
  GitHub: https://github.com/illusorycloud || github
  E-Mail: mailto:xueduan.li@gmail.com || envelope
  #Weibo: https://weibo.com/yourname || weibo
  #Google: https://plus.google.com/yourname || google
  #Twitter: https://twitter.com/yourname || twitter
  #FB Page: https://www.facebook.com/yourname || facebook
  #VK Group: https://vk.com/yourname || vk
  #StackOverflow: https://stackoverflow.com/yourname || stack-overflow
  #YouTube: https://youtube.com/yourname || youtube
  #Instagram: https://instagram.com/yourname || instagram
  #Skype: skype:yourname?call|chat || skype
# 图标配置 
social_icons:
  #是否显示图标
  enable: true
  #是否只显示图标
  icons_only: false
  #是否开启图标变化(就是刷新后会变颜色)
  transition: false
```

### 3. 添加菜单项

1.先在`主题配置文件`修改

```yml
menu:
  home: / || home
  about: /about/ || user
  tags: /tags/ || tags
  categories: /categories/ || th
  archives: /archives/ || archive
  AAAAA: /BBBBB/ || CCC
其中AAA 为菜单项的名字,BBB是路径,CCC是菜单项显示的图标 
```

 `next` 使用的是 [Font Awesome](http://fontawesome.io/) 提供的图标 ,在这里可以选择自己喜欢的图标.

2.生成上述路径的文件

`git`命令行输入

`hexo new page BBB` --其中BBB替换为具体的名字,会在`站点目录\source`下新增一个BBB文件夹,文件夹中有一个`index.md`文件，需要在文件头中增加一句`type: XXX`,例如`type: categories`。这样就会在这个页面显示所有的分类了。

3.修改主题文件下的对应语言的配置文件,这里是中文就修改`zh-CN.yml`

```yml
menu:
  home: 首页
  archives: 归档
  AAAA : XXXX
AAA为上边的菜单项名字,XXX为中文的名字
```

### 4. 添加RSS

- 1.安装插件

  - 首先在Git中运行`npm install --save hexo-generator-feed`命令,安装插件,插件会放在

    `node_modules`文件夹里面.

- 2.修改`站点配置文件`

  - 安装好插件后,打开站点配置文件_config.yml`,在末尾加入以下代码:

```yml
# Extensions
## Plugins: http://hexo.io/plugins/
plugins: hexo-generate-feed
```

- 3.修改`主题配置文件`
  - 打开主题配置文件`_config.yml`,找到`rss` 添加配置:`rss: /atom.xml` 

### 5. 设置酷炫动态背景

next主题提供了两种背景可以选择.

- 第一种背景（我是用的这种）

新版本的next主题的话直接在主题配置文件中,找到`canvas-nest` 修改为`canvas-nest: true`,

```yml
# Canvas-nest
# Dependencies: https://github.com/theme-next/theme-next-canvas-nest
canvas_nest:
  enable: true
  onmobile: true # display on mobile or not
  color: '0,0,255' # RGB values, use ',' to separate
  opacity: 0.5 # the opacity of line: 0~1
  zIndex: -1 # z-index property of the background
  count: 99 # the number of lines
```

进入theme/next目录

 执行命令`git clone https://github.com/theme-next/theme-next-canvas-nest source/lib/canvas-nest `

- 第二种背景

```yml
# JavaScript 3D library.
# Dependencies: https://github.com/theme-next/theme-next-three
# three_waves
three_waves: false
# canvas_lines
canvas_lines: false
# canvas_sphere
canvas_sphere: false
```

也是需要下载依赖 

1. 进入theme/next目录
2. 执行命令：`git clone https://github.com/theme-next/theme-next-three source/lib/three`

**4个背景中只能开启一种背景,不然会出错**

### 6. 设置网站logo

把你的图片放在`themes/next/source/images`里 

打开`主题配置文件`_config.yml ,找到字段`favicon:`  都修改为对应路径

```yml
favicon:
  small: /images/favicon-16x16-next.png
  medium: /images/favicon-32x32-next.png
  apple_touch_icon: /images/apple-touch-icon-next.png
  safari_pinned_tab: /images/logo.svg
```

### 7. 实现点击出现桃心效果

`themes/next/source/js/src`里面 新建一个love.js,

复制下面的代码进去

```javascript
!function(e,t,a){function n(){c(".heart{width: 10px;height: 10px;position: fixed;background: #f00;transform: rotate(45deg);-webkit-transform: rotate(45deg);-moz-transform: rotate(45deg);}.heart:after,.heart:before{content: '';width: inherit;height: inherit;background: inherit;border-radius: 50%;-webkit-border-radius: 50%;-moz-border-radius: 50%;position: fixed;}.heart:after{top: -5px;}.heart:before{left: -5px;}"),o(),r()}function r(){for(var e=0;e<d.length;e++)d[e].alpha<=0?(t.body.removeChild(d[e].el),d.splice(e,1)):(d[e].y--,d[e].scale+=.004,d[e].alpha-=.013,d[e].el.style.cssText="left:"+d[e].x+"px;top:"+d[e].y+"px;opacity:"+d[e].alpha+";transform:scale("+d[e].scale+","+d[e].scale+") rotate(45deg);background:"+d[e].color+";z-index:99999");requestAnimationFrame(r)}function o(){var t="function"==typeof e.onclick&&e.onclick;e.onclick=function(e){t&&t(),i(e)}}function i(e){var a=t.createElement("div");a.className="heart",d.push({el:a,x:e.clientX-5,y:e.clientY-5,scale:1,alpha:1,color:s()}),t.body.appendChild(a)}function c(e){var a=t.createElement("style");a.type="text/css";try{a.appendChild(t.createTextNode(e))}catch(t){a.styleSheet.cssText=e}t.getElementsByTagName("head")[0].appendChild(a)}function s(){return"rgb("+~~(255*Math.random())+","+~~(255*Math.random())+","+~~(255*Math.random())+")"}var d=[];e.requestAnimationFrame=function(){return e.requestAnimationFrame||e.webkitRequestAnimationFrame||e.mozRequestAnimationFrame||e.oRequestAnimationFrame||e.msRequestAnimationFrame||function(e){setTimeout(e,1e3/60)}}(),n()}(window,document);

```

然后打开`\themes\next\layout\_layout.swig`文件,在末尾 添加以下代码： 

```html
<!-- 页面点击小红心 -->
<script type="text/javascript" src="/js/src/love.js"></script>
```

### 8. 修改文章内链接文本样式

鼠标移动到连接上变颜色

修改文件 `themes\next\source\css\_common\components\post\post.styl`，在末尾添加如下css样式，：

```css
// 文章内链接文本样式
.post-body p a{
  color: #0593d3;
  border-bottom: none;
  border-bottom: 1px solid #0593d3;
  &:hover {
    color: #fc6423;
    border-bottom: none;
    border-bottom: 1px solid #fc6423;
  }
}
```

### 9. 设置顶部滚动加载条

打开`next\layout\_partials\head`文件，在文件末尾添加以下代码: 

```html
<script src="//cdn.bootcss.com/pace/1.0.2/pace.min.js"></script>
<link href="//cdn.bootcss.com/pace/1.0.2/themes/pink/pace-theme-flash.css" rel="stylesheet">
<style>
    .pace .pace-progress {
        background: #1E92FB; /*进度条颜色*/
        height: 3px;
    }
    .pace .pace-progress-inner {
         box-shadow: 0 0 10px #1E92FB, 0 0 5px     #1E92FB; /*阴影颜色*/
    }
    .pace .pace-activity {
        border-top-color: #1E92FB;    /*上边框颜色*/
        border-left-color: #1E92FB;    /*左边框颜色*/
    }
</style>
```

### 10. 在每篇文章末尾统一添加“本文结束”标记

在路径 `\themes\next\layout\_macro` 中新建 `page-end-tag.swig` 文件,并添加以下内容： 

```html
<!--文字可以自己修改-->
<div>
    {% if not is_index %}
        <div style="text-align:center;color: #A2CD5A;font-size:15px;">------------------本文到此结束<i class="fa fa-paw"></i>感谢您的阅读------------------</div>
    {% endif %}
</div>
```

接着打开`\themes\next\layout\_macro\post.swig`文件，在`post-body` 之后， `post-footer` 之前添加下面的代码 

```html
<div>
  {% if not is_index %}
    {% include 'page-end-tag.swig' %}
  {% endif %}
</div>
```

然后打开主题配置文件（`_config.yml`),在末尾添加： 

```yml
# 文章末尾添加“本文结束”标记
page_end_tag:
  enabled: true
```

### 11. 静态资源压缩

Hexo自动生成的html中有很多空白的地方,会影响加载速度,所以最好还是压缩一下.

这里使用`hexo-neat`插件来压缩。

- 安装插件

  - `npm install hexo-neat --save`

- 在`站点配置文件`添加配置

  - ```yml
    # hexo-neat
    # 博文压缩
    neat_enable: true
    # 压缩html
    neat_html:
      enable: true
      exclude:
      
    # 压缩css  跳过min.css
    neat_css:
      enable: true
      exclude:
        - '**/*.min.css'
        
    # 压缩js 跳过min.js
    neat_js:
      enable: true
      mangle: true
      output:
      compress:
      exclude:
        - '**/*.min.js'
        - '**/jquery.fancybox.pack.js'
        - '**/index.js'  
        - '**/love.js'
    # 压缩博文配置结束
    ```

- 3.使用 

  - 以后再执行`hexo g`命令时就会自动压缩了

### 12. 主页文章添加阴影效果

打开`\themes\next\source\css\_custom\custom.styl`,向里面加入： 

```js
// 主页文章添加阴影效果
 .post {
   margin-top: 60px;
   margin-bottom: 60px;
   padding: 25px;
   -webkit-box-shadow: 0 0 5px rgba(202, 203, 203, .5);
   -moz-box-shadow: 0 0 5px rgba(202, 203, 204, .5);
  }
```

### 13. 修改文章底部的的标签样式

打开模板文件`/themes/next/layout/_macro/post.swig`，找到`rel="tag">#`字段， 将`# 换成<i class="fa fa-tag"></i>`,其中tag是你选择标签图标的名字,也是可以自定义的 

```html
<a href="{{ url_for(tag.path) }}" rel="tag"> <i class="fa fa-tag"></i> {{ tag.name }}</a>
```

### 14. 实现文章字数统计和预计阅读时间 

1.在站点根目录下使用`GitBash`命令安装 `hexo-wordcoun`t插件:

```java
npm install hexo-symbols-count-time --save
```

2.在全局配置文件`_config.yml`中激活插件:

```yml
symbols_count_time:
    symbols: true
    time: true
    total_symbols: true
    total_time: true
```

3.在主题的配置文件`_config.yml`中进行如下配置:

```yml
#字数统计
symbols_count_time:
  separated_meta: true
  item_text_post: true
  item_text_total: true
  awl: 4
  wpm: 275
```

到此,我们就实现了文章字数统计和预估时间的显示功能

### 15. 在文章底部增加版权信息

修改`主题配置文件`,找到`creative_commons`字段

```yml
# Creative Commons 4.0 International License.
# https://creativecommons.org/share-your-work/licensing-types-examples
# Available: by | by-nc | by-nc-nd | by-nc-sa | by-nd | by-sa | zero
creative_commons:
  #选择一个License
  license: by-nc-sa
  #是否在侧边栏显示
  sidebar: false  
  #是否在文章末尾显示
  post: true   
```

### 16. 文章置顶

打开文件：`node_modules/hexo-generator-index/lib/generator.js`,将原来的代码用下面的代码替换掉

```js
'use strict';
var pagination = require('hexo-pagination');
module.exports = function(locals){
  var config = this.config;
  var posts = locals.posts;
    posts.data = posts.data.sort(function(a, b) {
        if(a.top && b.top) { // 两篇文章top都有定义
            if(a.top == b.top) return b.date - a.date; // 若top值一样则按照文章日期降序排
            else return b.top - a.top; // 否则按照top值降序排
        }
        else if(a.top && !b.top) { // 以下是只有一篇文章top有定义，那么将有top的排在前面（这里用异或操作居然不行233）
            return -1;
        }
        else if(!a.top && b.top) {
            return 1;
        }
        else return b.date - a.date; // 都没定义按照文章日期降序排
    });
  var paginationDir = config.pagination_dir || 'page';
  return pagination('', posts, {
    perPage: config.index_generator.per_page,
    layout: ['index', 'archive'],
    format: paginationDir + '/%d/',
    data: {
      __index: true
    }
  });
};
```

写文章的时候,在标题加上top值,数值越大排在越前面.

```md
tag: hexo 
copyright: true
password: xxx
top: 150
```

### 17. 在网站底部加上访问量

**Next主题配置这个就比较方便了**

打开`主题配置文件`，找到如下配置：

```yml
busuanzi_count:
  enable: true
  total_visitors: true
  total_visitors_icon: user
  total_views: true
  total_views_icon: eye
  post_views: true
  post_views_icon: eye
```

将`enable`的值由`false`改为`true`，便可以看到页脚出现访问量.

另外本地预览时访客数异常是正常的,部署至云端后就不会出现这样的问题.

### 18. 网站搜索功能

1.安装插件

​	站点目录下执行命令`npm install hexo-generator-searchdb --save`

2.修改`站点配置文件` 

```yml
search:
  path: search.xml
  field: post
  format: html
  limit: 10000
```

3.修改`主题配置文件`

```yml
# Local search
# Dependencies: https://github.com/theme-next/hexo-generator-searchdb
local_search:
  enable: enable
  # if auto, trigger search by changing input
  # if manual, trigger search by pressing enter key or search button
  trigger: auto
  # show top n results per article, show all results by setting to -1
  top_n_per_article: 1
  # unescape html strings to the readable one
  unescape: false
```

重新开启服务后即可看到效果。

### TODO开启留言评论功能

//TODO 待更新

### 参考

[Hexo官方文档](https://hexo.io/zh-cn/docs/)

[Next官方文档](http://theme-next.iissnan.com/)







