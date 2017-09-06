'use strict'
const config = require('config')
const request = require('request-promise-native')
const logger = require(__base + '\\utils\\logger.js')

async function giveCredit (referralEmail) {
  let requestData = {
    'branch_key': config.get('Branch.branchKey'),
    'branch_secret': config.get('Branch.branchSecret'),
    'identity': referralEmail,
    'amount': '1' }

  let options = {
    method: 'POST',
    uri: config.get('Branch.uri'),
    resolveWithFullResponse: true,
    json: requestData
  }

  try {
    let response = await request(options)
    if (response.statusCode === 200) {
      logger.info('Refferals was added to: ' + referralEmail + '\r\n Response: ' + JSON.stringify(response.body))
      return true
    } else {
      logger.warning('Refferals not added: ' + referralEmail + '\r\n Status: ' + response.statusCode + '\r\n Response: ' + JSON.stringify(response.body))
    }
  } catch (error) {
    logger.Error('RefferalEmail: ' + referralEmail + '\r\n Error: ' + error.error)
    return false
  }
}

module.exports = {
  giveCredit: giveCredit
}
