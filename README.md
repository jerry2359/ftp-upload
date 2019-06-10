# 使用nodejs ftp模块上传多个文件

## 安装
```bash
npm i -D ftp-upload
```

## 使用方法
```js
const path = require('path')
const FtpUpload = require('ftp-upload')

const ftpUpload = new FtpUpload({
  // 指定一个远程域名，生成测试连接时会用到
  remoteDomain: 'http://www.test.com',
  // 指定一个远程目录
  // 注：必须以 / 开头
  // 支持两种模式：
  // 1、普通模式，上传的文件将直接存放到该路径下。
  //    如：'/test/first'
  // 2、字符串匹配模式，该模式会将[date]和[random]替换成当前日期和随机数。
  //    当字符串中有[random]时，会询问是否手动输入一个值替换随机数
  //    如：'/test/[date]' 或 '/test/[date]/[random]'
  remotePath: '/test/first',
  // autoRemotePath: true, // 跳过询问远程目录，默认false
  // autoOverwirte: true, // 跳过询问覆盖已有目录，默认false
  // 支持同时上传多个文件，建议2~3个
  threads: 3,
  // 指定一个本地目录
  // 这里必须是一个绝对路径
  localPath: path.resolve(__dirname, 'dist'),
  // ftp登录的账号密码等信息
  host: '36.120.77.38',
  port: 21,
  user: 'Your user name',
  password: 'Your password',
  // 上传完成的回调
  /*success: function (res) {
    console.log(res)
  }*/
})

// 初始化准备工作
ftpUpload.init().on('ready', function (res) {
  // 处理一些逻辑...
  // ...
  setTimeout(() => {
    // 开始上传文件
    this.start(res.remoteDestPath)
  }, 3000)
})

// 文件上传成功
ftpUpload.on('success', function (res) {
  console.log(res)
})
```
