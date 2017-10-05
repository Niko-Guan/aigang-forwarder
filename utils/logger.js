'use strict'

var log4js = require('log4js')
var logger = log4js.getLogger()
var insureLogger = log4js.getLogger('insureLogger')
var expressLogger = log4js.getLogger('expressLogger')
var claimLogger = log4js.getLogger('claimLogger')

log4js.configure({
  appenders: {
    file: { type: 'file', filename: 'logs/logs.log', maxLogSize: 1000000, backups: 4, compress: false },
    console: { type: 'console' },
    insureLogger: { type: 'file', filename: 'logs/insure.log', maxLogSize: 500000, backups: 10, compress: false },
    claimLogger: { type: 'file', filename: 'logs/claim.log', maxLogSize: 500000, backups: 10, compress: false },
    expressLogger: { type: 'file', filename: 'logs/express.log', maxLogSize: 500000, backups: 10, compress: false }
  },
  categories: {
    default: { appenders: ['file', 'console'], level: 'debug' },
    insureLogger: { appenders: ['insureLogger'], level: 'debug' },
    expressLogger: { appenders: ['expressLogger'], level: 'debug' },
    claimLogger: { appenders: ['claimLogger'], level: 'debug' }
  }
})

function info (message) {
  logger.info(message)
}

function warning (message) {
  logger.warn(message)
}

function error (message) {
  logger.error(message)
}

function infoInsure (message) {
  insureLogger.info(message)
}

function infoClaim (message) {
  claimLogger.info(message)
}

function connectLogger () {
  return log4js.connectLogger(expressLogger, { level: 'auto' })
}

module.exports = {
  info: info,
  warning: warning,
  error: error,
  connectLogger: connectLogger,
  infoInsure: infoInsure,
  infoClaim: infoClaim
}
