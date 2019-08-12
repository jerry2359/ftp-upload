/**
 * 用于操控远程ftp的模块
 */
const path = require('path')
const Client = require('ftp')
const glob = require('glob')
const inquirer = require('inquirer')
const chalk = require('chalk')
// const ora = require('ora')
const getNowFormatDate = require('./date-format')
const ProgressBar = require('./progress-bar')
// 存储多个链接实例
let clients = []
// 保存远程创建的目录
// key值是目录路径
// 避免重复检查
const cacheDirectory = {}

// 初始化一个进度条长度为 25 的 ProgressBar 实例
const pb = new ProgressBar('Uploading', 25)

// 创建多个ftp链接
exports.createClients = function (threads) {
  clients = []
  // 实例化多个client
  for (let i = 0; i < threads; i++) {
    clients.push(new Client())
  }
  return clients
}

// 检查指定的远程路径下的目录是否存在
// 不存在则创建
const mkdir = function (c, file, remoteDestPath) {
  return new Promise(resolve => {
    c.mkdir(remoteDestPath, true, function (err) {
      resolve(file, remoteDestPath)
    })
    // 从保存中检查目录是否已经创建
    /*if (cacheDirectory[remoteDestPath]) {
      resolve(file, remoteDestPath)
    } else {
      // 检查并创建目录
      c.mkdir(remoteDestPath, true, function (err) {
        //if (err) throw err;
        resolve(file, remoteDestPath)
        cacheDirectory[remoteDestPath] = remoteDestPath
      })
    }*/
  })
}

// 根据当前文件名称来判断是否在匹配规则里
// 返回匹配规则数组或undefined
const searchByRules = (file, rules) => rules.filter(rule => rule.test.test(file))[0]

// console.log( glob.sync(path.resolve(__dirname, '../../../dist/**/*.!(html|htm)')) )

// 上传多个文件
// remoteDestPath: 文件要存放的远程目录
exports.uploadFiles = function (opts, remoteDestPath) {
  return new Promise(resolve => {
    // 使用glob选择指定的文件进行上传操作
    const files = glob.sync(path.resolve(opts.localPath, opts.glob))
    let fileNames = {}
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
      // 存储file的相对路径，这里是为了美观的在命令行显示简短的上传文件路径
      // 相对路径如：dist/assets/images/banner.jpg
      const relativeFile = file.replace(path.join(opts.localPath, '../'), '')
      fileNames[relativeFile] = relativeFile
      // fileNames.push(relativeFile)
      // 更新上传进度条
      const updateProgress = () => {
        num++
        // 更新进度条
        pb.render({ completed: num, total: fileLength, fileNames: Object.keys(fileNames) })
        // 将本地文件从存储中清除出去
        delete fileNames[relativeFile]
        // fileNames.splice(fileNames.indexOf(relativeFile), 1)
        // 递归继续上传文件
        uploading(c)
      }
      // 上传文件
      const uploadFile = file => {
        // console.log(remoteDestFilePath)
        mkdir(c, file, remoteDestFilePath).then((file, remoteDestPath) => {
          c.put(file, remoteDestFile, function (err) {
            if (err) {
              // console.log(err)
              // 文件上传失败时，重新上传
              uploadFile(file)
            } else {
              updateProgress()
            }
          })
        })
      }
      // 根据上传方式处理上传文件
      const handleUploadType = (file, uploadType) => {
        if (uploadType === 'skip') {
          c.list(remoteDestFile, (err, list) => {
            if (!err && list.length) {
              // 存在远程文件，跳过上传
              updateProgress()
            } else {
              // 不存在远程文件，执行上传文件
              uploadFile(file)
            }
          })
        } else {
          // 强制覆盖远程文件
          uploadFile(file)
        }
      }

      // 在1.1.2版本后，使用该算法
      // 上传文件时，根据匹配规则`rules`和默认上传方式`uploadType`来判断当前文件是否强制覆盖远程文件或跳过上传步骤
      // 匹配到规则时，将忽略默认上传方式
      const rule = searchByRules(file, opts.rules)
      handleUploadType(file, rule ? rule.use : opts.uploadType)

      // 创建文件夹
      /*mkdir(c, file, remoteDestFilePath).then((file, remoteDestPath) => {

        // 上传前是否已清除远程文件
        // 在1.1.2版本后已放弃
        /!*if (!opts.clearRemote) {
          // 判断远程文件是否存在
          // 存在则跳过上传
          c.list(remoteDestFile, (err, list) => {
            if (!err) {
              // 存在远程文件，跳过上传
              updateProgress()
            } else {
              // 不存在远程文件，执行上传文件
              uploadFile()
            }
          })
        } else {
          uploadFile()
        }*!/
      })*/
    }
    const uploading = (c) => {
      if (files.length) {
        // 上传中...
        let file = files.shift()
        uploadSingle(c, file)
      } else {
        // 更新进度条
        pb.render({ completed: num, total: fileLength, fileNames: Object.keys(fileNames) })
        // 结束链接
        c.end()
        // 销毁链接
        c.destroy()
        // 上传完成
        !Object.keys(fileNames).length && resolve()
      }
    }
    // 开启同时上传多个文件
    for (let i = 0; i < opts.threads; i++) {
      uploading(clients[i])
    }
  })
}

// 远程链接准备完毕时开始执行上传操作
exports.ready = function (opts, callBack) {
  // 获取远程目录
  // 如：/test/first/2019-02-24/526352
  let random = Math.ceil(Math.random() * 1000000)
  let formatDate = getNowFormatDate()
  // 处理remotePath，替换[date]
  let remoteDestPath = opts.remotePath.replace('[date]', formatDate)
  const handleRemote = (answers) => {
    let c = clients[0]
    // 拼凑目录路径
    if (answers) {
      remoteDestPath = remoteDestPath.replace('[random]', answers.directory)
    } else if (opts.autoRemotePath) {
      remoteDestPath = remoteDestPath.replace('[random]', random)
    }
    // 开始上传文件
    console.log('')
    // 判断是否自动覆盖已有目录
    if (opts.autoOverwirte) {
      callBack && callBack(remoteDestPath)
    } else {
      c.list(remoteDestPath, (err, list) => {
        // 检查远程目录是否存在
        if (!err && list.length) {
          inquirer.prompt([{
            type: 'confirm',
            message: 'The remote directory already exists. Do you want to continue?',
            name: 'ok'
          }]).then(function (answers) {
            if (answers.ok) {
              callBack && callBack(remoteDestPath)
            } else {
              runExit()
            }
          })
        } else {
          callBack && callBack(remoteDestPath)
        }
      })
    }

    function runExit() {
      clients.forEach(c => {
        c.end()
        c.destroy()
      })
    }

    // 以下代码是处理在上传之前是否想清除已有远程目录和文件
    // 在1.1.2版本后已放弃
    /*
    if (!opts.clearRemote) {
      callBack && callBack(remoteDestPath)
      return
    }
    // 清除远程目录已有文件夹和文件
    c.list(remoteDestPath, (err, list) => {
      // 检查远程目录是否存在
      if (!err) {
        // 清除已有目录里的文件
        const clearFiles = () => {
          // 先清除远程文件，再执行上传
          const spinner = ora('Clearing remote files...')
          spinner.start()
          c.rmdir(remoteDestPath, true, err => {
            if (err) throw err
            spinner.stop()
            callBack && callBack(remoteDestPath)
          })
        }
        // 再判断是否自动覆盖已有目录
        if (opts.autoOverwirte) {
          clearFiles()
        } else {
          inquirer.prompt([{
            type: 'confirm',
            message: 'The remote directory already exists. Do you want to continue?',
            name: 'ok'
          }]).then(function (answers) {
            if (answers.ok) {
              clearFiles()
            } else {
              runExit()
            }
          })
        }
      } else {
        callBack && callBack(remoteDestPath)
      }
    })
    function runExit() {
      clients.forEach(c => {
        c.end()
      })
    }
    */
  }

  if (!opts.autoRemotePath && remoteDestPath.indexOf('[random]') >= 0) {
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
