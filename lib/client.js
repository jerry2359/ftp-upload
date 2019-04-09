/**
 * 用于操控远程ftp的模块
 */
const path = require('path')
const Client = require('ftp')
const glob = require('glob')
const inquirer = require('inquirer')
const chalk = require('chalk')
const ora = require('ora')
const getNowFormatDate = require('./date-format')
const ProgressBar = require('./progress-bar')
// 存储多个链接实例
const clients = []
// 保存远程创建的目录
// key值是目录路径
// 避免重复检查
const cacheDirectory = {}

// 初始化一个进度条长度为 25 的 ProgressBar 实例
const pb = new ProgressBar('Uploading', 25)

// 创建多个ftp链接
exports.createClients = function (threads) {
  // 实例化多个client
  for (let i = 0; i < threads; i++) {
    clients.push(new Client())
  }
  return clients
}

// 检查指定的远程路径下的目录是否存在
// 不存在则创建
const mkdir = function (c, remoteDestPath) {
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
const uploadFiles = function (opts, remoteDestPath) {
  return new Promise(resolve => {
    const files = glob.sync(`${opts.localPath}/**/*.*`)
    let fileNames = []
    let fileLength = files.length
    let num = 0 // 每次一个文件上传完毕就累加
    const uploadSingle = (c, file) => {
      // 将路径中的 \ 转换成 /
      let prettyLocalPath = opts.localPath.replace(/\\/g, '/')
      // 映射本地文件成远程文件
      let remoteDestFile = file.replace(prettyLocalPath, remoteDestPath)
      // 映射本地文件目录成远程文件目录
      let remoteDestFilePath = path.dirname(file).replace(prettyLocalPath, remoteDestPath)
      // 将当前本地文件存储
      fileNames.push(file)
      // 创建文件夹
      mkdir(c, remoteDestFilePath).then(() => {
        // 上传文件
        c.put(file, remoteDestFile, function(err) {
          if (err) throw err;
          num ++
          // 更新进度条
          pb.render({completed: num, total: fileLength, fileNames})
          // 将本地文件从存储中清除出去
          fileNames.splice(fileNames.indexOf(file), 1)
          // 递归继续上传文件
          uploading(c)
        })
      })
    }
    const uploading = (c) => {
      if (files.length) {
        // 上传中...
        let file = files.shift()
        uploadSingle(c, file)
      } else {
        // 更新进度条
        pb.render({completed: num, total: fileLength, fileNames})
        // 结束链接
        c.end()
        // 上传完成
        !fileNames.length && resolve()
      }
    }
    // 开启同时上传多个文件
    for (let i = 0; i < opts.threads; i++) {
      uploading(clients[i])
    }
  })
}

// 远程链接准备完毕时开始执行上传操作
exports.ready = function (opts) {
  // 获取远程目录
  // 如：/test/first/2019-02-24/526352
  let random = Math.ceil(Math.random()*1000000)
  let formatDate = getNowFormatDate()
  // 处理remotePath，替换[date]
  let remoteDestPath = opts.remotePath.replace('[date]', formatDate)
  const handleRemote = (answers) => {
    let c = clients[0]
    // 拼凑目录路径
    if (answers) {
      remoteDestPath = remoteDestPath.replace('[random]', answers.directory)
    }
    // 开始上传文件
    console.log('')
    c.list(remoteDestPath, (err, list) => {
      // 检查远程目录是否存在
      if (!err) {
        inquirer.prompt([{
          type: 'confirm',
          message: 'The remote directory already exists. Do you want to continue?',
          name: 'ok'
        }]).then(function (answers) {
          if (answers.ok) {
            // 先清除远程文件，再执行上传
            const spinner = ora('Clearing remote files...')
            spinner.start()
            c.rmdir(remoteDestPath, true, err => {
              if (err) throw err
              spinner.stop()
              runUpload()
            })
          } else {
            runExit()
          }
        })
      } else {
        runUpload()
      }
    })
    function runUpload() {
      uploadFiles(opts, remoteDestPath).then(() => {
        const testUrl = opts.remoteDomain + remoteDestPath
        console.log('')
        console.log(chalk.cyan('  \nUpload complete.\n'))
        console.log(chalk.yellow(
          '  Tip: you can use this test link to open in the browser.\n' +
          '  '+ testUrl +'\n'
        ))
        opts.success && opts.success({url: testUrl})
      })
    }
    function runExit() {
      clients.forEach(c => {
        c.end()
      })
    }
  }

  if (remoteDestPath.indexOf('[random]') >= 0) {
    inquirer.prompt([
      {
        type: 'input',
        message: `Remote directory ${remoteDestPath.replace('[random]', chalk.gray.bold(random))}:`,
        name: 'directory',
        default: random
      }
    ]).then(handleRemote)
  } else {
    handleRemote()
  }
}