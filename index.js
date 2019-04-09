const ora = require('ora')
const client = require('./lib/client')

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
