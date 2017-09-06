'use strict'

var winston = require('winston')
const winstonCommon = require('winston/lib/winston/common')

winston.add(winston.transports.File, {
  filename: 'WinstonLog.txt',
  maxsize: '3000000', // 3 Mb rotation
  json: false,
  handleExceptions: true
})

// oweride to work with VS Code https://github.com/Microsoft/vscode/issues/19750
winston.transports.Console.prototype.log = function (level, message, meta, callback) {
  const output = winstonCommon.log(Object.assign({}, this, {
    level,
    message,
    meta
  }))

  console[level in console ? level : 'log'](output)

  setImmediate(callback, null, true)
}

function info (message) {
  winston.info(message)
}

function warning (message) {
  winston.warn(message)
}

function error (message) {
  winston.error(message)
}

module.exports = {
  info: info,
  warning: warning,
  error: error
}
