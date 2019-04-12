const ora = require('ora')
const client = require('./lib/client')
const chalk = require('chalk')

class FtpUpload {
  constructor(opts) {
    this.opts = opts
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

module.exports = FtpUpload

/*
module.exports = function (opts) {
  // 实例化多个client
  const clients = client.createClients(opts.threads)

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

  let isInit = []
  const spinner = ora('Start connect ftp...')
  spinner.start()
  clients.forEach(c => {
    c.on('ready', function() {
      isInit.push(true)
      if (isInit.length !== opts.threads) return
      spinner.stop()
      console.log('Ftp connect success!')
      client.ready(opts)
    })

    // 连接远程
    c.connect({
      host: opts.host,
      port: opts.port,
      user: opts.user,
      password: opts.password
    })
  })
}
*/
