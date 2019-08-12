const ora = require('ora')
const client = require('./lib/client')
const chalk = require('chalk')

class FtpUpload {
  constructor(opts) {
    // 一些参数默认设置
    const defs = {
      // 默认上传方式：遇到文件名称一样的文件是替换还是跳过。值有"skip" 或 "overwrite"，默认"overwrite"
      uploadType: 'overwrite',
      // 根据匹配规则，执行对应上传方式
      // 注：根据规则匹配到的文件将无视默认上传方式；一个上传文件只会对应一个匹配规则，多个匹配规则时取第一个
      rules: [
        /*{
          test: /\.html?$/,
          use: 'overwrite'
        },
        {
          test: /\.(eot|svg|ttf|woff2?)$/,
          use: 'overwrite'
        }*/
      ],
      // 本地目录的glob选择器
      glob: '**/*.*'
    }
    this.opts = Object.assign(defs, opts)
    this.eventList = {}
  }

  // 初始化前期准备工作，链接ftp、清除已有目录记录（如果有）、获得远程路径
  init(callBack) {
    // 实例化多个client
    const clients = client.createClients(this.opts.threads)

    // 验证参数数据格式
    // remotePath必须以 / 开头
    if (this.opts.remotePath.substr(0, 1) !== '/') {
      throw `The argument remotePath must start with /`
    }

    // 如果remotePath是 / 则替换为空
    // 这里是为了最终拼凑域名连接用
    if (this.opts.remotePath === '/') {
      this.opts.remotePath = ''
    }

    let isInit = []
    const spinner = ora('Start connect ftp...\n')
    spinner.start()
    clients.forEach(c => {
      c.on('ready', () => {
        isInit.push(true)
        if (isInit.length !== this.opts.threads) return
        spinner.stop()
        console.log('Ftp connect success!')
        client.ready(this.opts, remoteDestPath => {
          callBack && callBack.call(this, remoteDestPath)
          this.trigger('ready', {remoteDestPath})
        })
      })

      // 连接远程
      c.connect({
        host: this.opts.host,
        port: this.opts.port,
        user: this.opts.user,
        password: this.opts.password
      })
    })

    return this
  }

  // 开始上传文件
  start(remoteDestPath) {
    client.uploadFiles(this.opts, remoteDestPath).then(() => {
      const testUrl = this.opts.remoteDomain + remoteDestPath
      console.log('')
      console.log(chalk.cyan('  \nUpload complete.\n'))
      console.log(chalk.yellow(
        '  Tip: you can use this test link to open in the browser.\n' +
        '  '+ testUrl +'\n'
      ))
      this.opts.success && this.opts.success({url: testUrl})
      this.trigger('success', {url: testUrl})
    })
    return this
  }

  // 事件注册
  on(eventName, callBack) {
    if (!this.eventList[eventName]) {
      this.eventList[eventName] = []
    }
    this.eventList[eventName].push(callBack)
    return this
  }

  // 事件触发
  trigger(eventName, opts) {
    const callBacks = this.eventList[eventName] || []
    callBacks.forEach(callBack => {
      callBack.call(this, opts)
    })
    return this
  }
}

// 当有多个ftp上传任务时，使用该方法可让ftp逐一执行任务
const ftpRunSequence = (sequences, callBack) => {
  const ftpUpload = sequences.shift()
  ftpUpload.on('success', () => {
    if (sequences.length) {
      ftpRunSequence(sequences, callBack)
    }
  })
  callBack && callBack(ftpUpload)
}

module.exports = {
  FtpUpload,
  ftpRunSequence
}
