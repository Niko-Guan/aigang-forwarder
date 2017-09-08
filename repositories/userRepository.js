'use strict'
const mysql = require('mysql2/promise')
const config = require('config')
const logger = require(__base + '\\utils\\logger.js')

const dbConfig = config.get('MySql.dbConfig')

async function getUserAccount (email) {
  let accountAddress
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [rows, fields] = await conn.execute(
      'SELECT Account FROM dbo.users WHERE UserEmail = ?',
      [email]
    )

    if (rows[0]) {
      accountAddress = rows[0].Account
    }
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }

  return accountAddress
}

async function saveAccount (account, email, password, referralEmail) {
  try {
    const conn = await mysql.createConnection(dbConfig)
    var currendDate = (new Date()).toISOString();
    var values = [
      [account, email, referralEmail, password, currendDate, currendDate]
    ]

    const [results, err] = await conn.query(
      'INSERT INTO dbo.users(Account, UserEmail, ReferralEmail, Password, Created, Modified) VALUES ?',
      [values]
    )
    return results
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

async function updateAccount (account, email) {
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [results, err] = await conn.query(
      'UPDATE dbo.users SET Account = ?, Modified = NOW() WHERE UserEmail = ?',
      [account, email]
    )
    return results
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

module.exports = {
  getUserAccountAddress: getUserAccount,
  saveAccount: saveAccount,
  updateAccount: updateAccount
}
