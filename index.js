const path = require('path')
const Client = require('ftp')
const glob = require('glob')
const chalk = require('chalk')
const inquirer = require('inquirer')
const ProgressBar = require('./lib/progress-bar')

module.exports = function (opts) {
  // 实例化一个client
  const c = new Client()
  // 初始化一个进度条长度为 50 的 ProgressBar 实例
  const pb = new ProgressBar('Uploading', 25);

  // 指定一个远程域名，生成测试连接时会用到
  //const remoteDomain = 'http://testing.agenda-bj.com'
  // 指定一个远程目录
  // 注：必须以 / 开头
  //const remotePath = '/test/first'
  // 指定一个本地目录
  //const localPath = './dist'

  // 验证参数数据格式
  // remotePath必须以 / 开头
  if (opts.remotePath.substr(0, 1) !== '/') {
    throw `The argument remotePath must start with /`
  }
  // 如果remotePath是 / 则替换为空
  // 这里是为了最终拼凑域名连接用
  if (opts.remotePath === '/') {
    opts.remotePath = ''
  }

  // 保存远程创建的目录
  // key值是目录路径
  // 避免重复检查
  const cacheDirectory = {}

  //获取当前时间，格式YYYY-MM-DD
  function getNowFormatDate() {
    let date = new Date();
    let seperator1 = "-";
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let strDate = date.getDate();
    if (month >= 1 && month <= 9) {
      month = "0" + month;
    }
    if (strDate >= 0 && strDate <= 9) {
      strDate = "0" + strDate;
    }
    return year + seperator1 + month + seperator1 + strDate;
  }

  // 检查指定的远程路径下的目录是否存在
  // 不存在则创建
  function mkdir(remoteDestPath) {
    return new Promise(resolve => {
      // 从保存中检查目录是否已经创建
      if (cacheDirectory[remoteDestPath]) {
        resolve(remoteDestPath)
      } else {
        // 检查并创建目录
        c.mkdir(remoteDestPath, false, function (err) {
          //if (err) throw err;
          cacheDirectory[remoteDestPath] = remoteDestPath
          resolve(remoteDestPath)
        })
      }
    })
  }

  // 上传多个文件
  // remoteDestPath: 文件要存放的远程目录
  function uploadFiles(remoteDestPath) {
    return new Promise(resolve => {
      const files = glob.sync(`${opts.localPath}/**/*.*`)
      let fileLength = files.length
      let num = 0 // 每次一个文件上传完毕就累加
      const uploading = function () {
        if (files.length) {
          // 上传中...
          let file = files.shift()
          // 将路径中的 \ 转换成 /
          let prettyLocalPath = opts.localPath.replace(/\\/g, '/')
          // 映射本地文件成远程文件
          let remoteDestFile = file.replace(prettyLocalPath, remoteDestPath)
          // 映射本地文件目录成远程文件目录
          let remoteDestFilePath = path.dirname(file).replace(prettyLocalPath, remoteDestPath)
          // 创建文件夹
          mkdir(remoteDestFilePath).then(() => {
            // 上传文件
            c.put(file, remoteDestFile, function(err) {
              if (err) throw err;
              num ++
              // 更新进度条
              pb.render({ completed: num, total: fileLength, file })
              // 递归继续上传文件
              uploading(files)
            })
          })
        } else {
          // 上传完成
          resolve()
        }
      }
      uploading(files)
    })
  }

  c.on('ready', function() {
    console.log('Ftp connect success!')

    // 获取远程目录
    // 如：/test/first/2019-02-24/526352
    let random = Math.ceil(Math.random()*1000000)
    let remoteDestPath = `${opts.remotePath}/${getNowFormatDate()}`
    inquirer.prompt([
      {
        type: 'input',
        message: `Remote directory ${remoteDestPath}/${chalk.gray.bold(random)}:`,
        name: 'directory',
        default: random
      }
    ]).then(answers => {
      // 拼凑目录路径
      remoteDestPath += '/' + answers.directory
      // 开始上传文件
      console.log('')
      uploadFiles(remoteDestPath).then(() => {
        console.log('')
        console.log(chalk.cyan('  \nUpload complete.\n'))
        console.log(chalk.yellow(
          '  Tip: you can use this test link to open in the browser.\n' +
          '  '+ opts.remoteDomain + remoteDestPath +'\n'
        ))
        c.end()
      })
    })
  });

  // 连接远程
  c.connect({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password
  })
}
