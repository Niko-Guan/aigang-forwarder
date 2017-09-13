'use strict'
const mysql = require('mysql2/promise')
const config = require('config')
const logger = require(__base + '\\utils\\logger.js')

const dbConfig = config.get('MySql.dbConfig')

async function getUserAccount (email) {
  let accountAddress
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [
      rows,
      fields
    ] = await conn.execute(
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

async function saveAccount (account, email, password) {
  try {
    const conn = await mysql.createConnection(dbConfig)
    var currendDate = new Date().toISOString()
    var values = [
      [account, email, password, currendDate, currendDate]
    ]

    const [
      results,
      err
    ] = await conn.query(
      'INSERT INTO dbo.users(Account, UserEmail, Password, Created, Modified) VALUES ?',
      [values]
    )
    return results
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

async function updateAccount (account, email, password) {
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [results, err] = await conn.query(
      'UPDATE dbo.users SET Account = ?, Password = ?, Modified = NOW() WHERE UserEmail = ?',
      [account, password, email]
    )
    return results
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

async function updateReferral (email, referralEmail) {
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [
      results,
      err
    ] = await conn.query(
      'UPDATE dbo.users SET ReferralEmail = ?, Modified = NOW() WHERE UserEmail = ?',
      [referralEmail, email]
    )
    return results
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

async function isReferralSet (userEmail) {
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [rows, fields] = await conn.execute(
      'SELECT ReferralEmail FROM dbo.users WHERE UserEmail = ?',
      [userEmail]
    )

    if (rows[0]) {
      let referral = rows[0].ReferralEmail
      if (referral) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

async function isUserRegistered (referralEmail) {
  try {
    const conn = await mysql.createConnection(dbConfig)

    const [rows, fields] = await conn.execute(
      'SELECT UserEmail FROM dbo.users WHERE UserEmail = ?',
      [referralEmail]
    )

    if (rows[0]) {
      let user = rows[0].UserEmail
      if (user) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Repository Error: ' + error.stack)
    throw error
  }
}

module.exports = {
  getUserAccountAddress: getUserAccount,
  isReferralSet: isReferralSet,
  isUserRegistered: isUserRegistered,
  saveAccount: saveAccount,
  updateAccount: updateAccount,
  updateReferral: updateReferral
}
