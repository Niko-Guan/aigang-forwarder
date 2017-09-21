'use strict'

const emailExistence = require('email-existence')
const logger = require(__base + '\\utils\\logger.js')

const { promisify } = require('util')

const checkAsync = promisify(emailExistence.check)

async function checkEmail (email) {
  let result = false

  try {
    let response = await checkAsync(email)

    if (response === true) {
      result = true
      logger.info(`emailChecker email ${email} is valid.`)
    } else {
      response = await checkAsync(email)

      if (response === true) {
        result = true
        logger.info(`emailChecker email ${email} is valid in seccond try.`)
      } else {
        logger.warning(`emailChecker email ${email} is not valid. Response: ${response}`)
      }
    }
  } catch (error) {
    logger.error('emailChecker error: ' + error + ' Stack: ' + error.stack)
  }

  return result
}

module.exports = {
  checkEmail: checkEmail
}
