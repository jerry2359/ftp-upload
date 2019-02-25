# 使用nodejs ftp模块上传多个文件

## 安装
```bash
npm i -D ftp-upload
```

## 使用方法
```js
const path = require('path')
const ftpUpload = require('ftp-upload')
ftpUpload({
  // 指定一个远程域名，生成测试连接时会用到
  remoteDomain: 'http://www.test.com',
  // 指定一个远程目录
  // 注：必须以 / 开头
  remotePath: '/test/first',
  // 指定一个本地目录
  // 这里必须是一个绝对路径
  localPath: path.resolve(__dirname, 'dist'),
  // ftp登录的账号密码等信息
  host: '36.120.77.38',
  port: 21,
  user: 'Your user name',
  password: 'Your password'
})
```