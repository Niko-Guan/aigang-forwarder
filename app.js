'use strict'
global.__base = __dirname + '/' // Need for node modules paths

const Web3 = require('web3')
const express = require('express')
const fs = require('fs')
const app = express()
const bodyParser = require('body-parser')
const logger = require('./utils/logger.js')
const errorCodes = require('./utils/errorCodes.js')
const emailChecker = require('./utils/emailChecker.js')
const userRepository = require('./repositories/userRepository.js')
const branchClient = require('./clients/branchClient.js')
const config = require('config')
const helmet = require('helmet')

app.use(helmet())
app.use(bodyParser.json()) // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })) // support encoded b
app.use(function (req, res, next) {
  res.setHeader('Content-Type', 'application/json')
  next()
})

const web3 = new Web3(
  new Web3.providers.HttpProvider(config.get('Web3.Provider.uri'))
)

var obj = JSON.parse(
  fs.readFileSync('./build/contracts/BatteryInsurancePolicy.json', 'utf8')
)
var abiArray = obj.abi

var contractAddress = config.get('Web3.Contracts.batteryV2')
var policyContract = web3.eth.contract(abiArray).at(contractAddress)

var adminAccount = config.get('Web3.Provider.adminAccount')
var adminPass = config.get('Web3.Provider.adminPass')
var apiKey = config.get('App.apiKey')

app.get('/time', function (req, res) {
  var currentDate = new Date()
  var result = {
    now: currentDate.toISOString(),
    tamezoneOffset: currentDate.getTimezoneOffset()
  }

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(result))
})

app.get('/test', async function (req, res) {
  //let result = await emailChecker.checkEmail('')
  // let result = await userRepository.getUserAccountAddress('a@a.lt')
  // result = await userRepository.saveAccount('0x6', 'ddetestemail', 'ddetestpsw', result)
  // let result = await branchClient.giveCredit('ps@g.com')
  // console.log('result ' + result)
  // return result
})

app.get('/balance/:address', function (req, res) {
  var balance = web3.eth.getBalance(req.params.address).toNumber()
  var balanceInEth = balance / 1000000000000000000
  res.send('' + balanceInEth)
})

app.post('/sendTestnetEthers/:address', function (req, res) {
  var account = req.params.address
  var receivedApiKey = req.body.apiKey

  if (receivedApiKey != apiKey) {
    res.status(401)
    res.send()

    return
  }

  web3.personal.unlockAccount(account, req.body.password, 4, function (
    err,
    accResult
  ) {
    if (accResult) {
      // unlocking admin account for ethers sending
      web3.personal.unlockAccount(adminAccount, adminPass, 4, function (
        err,
        adminAccResult
      ) {
        web3.eth.sendTransaction(
          {
            value: 50000000000000000,
            gas: 2000000,
            from: adminAccount,
            to: account
          },
          function (err, result) {
            if (err) {
              logger.error(err)
              res.send(false)
            } else {
              var txId = result
              res.send('' + txId)
            }
          }
        )
      })
    } else {
      logger.error(err)
      res.send(false)
    }
  })
})

// referralEmail - user email who invited
// register(apiKey, password, email)
// todo refactor password
app.post('/register', async function (req, res) {
  if (!req.body.password || !req.body.email || req.body.apiKey !== apiKey) {
    res.status(400)
    res.send(JSON.stringify({ 'errorCode' : 'INPUT_PARAMS_NOT_VALID' }))
    return
  }

  let emailIsValid = await emailChecker.checkEmail(req.body.email)

  if (!emailIsValid) {
    res.status(400)
    res.send(JSON.stringify({ errorCode :  errorCodes.emailIsNotValid }))
    return
  }

  let email = req.body.email.toLowerCase()

  let account = await userRepository.getUserAccountAddress(email)

  try {
    if (account) {
      if (account === 'empty') {
        account = await web3.personal.newAccount(req.body.password)
        await userRepository.updateAccount(
          account,
          email
        )
        res.send(account)
      } else {
        res.send(account)
      }
    } else {
      account = await web3.personal.newAccount(req.body.password)
      await userRepository.saveAccount(
        account,
        email,
        req.body.password
      )

      res.send(account)
    }
  } catch (error) {
    logger.error(error)
    res.status(500)
    res.send('' + error)
  }
})

// checkReferral(apiKey, email, referralEmail)
app.post('/checkReferral', async function (req, res) {
  if (!req.body.referralEmail || !req.body.email || req.body.apiKey !== apiKey) {
    res.status(400)
    res.send(JSON.stringify({ errorCode :  errorCodes.inputParamsNotValid }))
    return
  }

  try {
    let referralEmail = req.body.referralEmail.toLowerCase()
    let email = req.body.email.toLowerCase()

    let emailIsValid = await emailChecker.checkEmail(email)
    let refferalEmailIsValid = await emailChecker.checkEmail(referralEmail)

    if (!emailIsValid || !refferalEmailIsValid) {
      res.status(400)
      res.send(JSON.stringify({ errorCode :  errorCodes.emailIsNotValid }))
      return
    }

    let isUserRegistered = await userRepository.isUserRegistered(email)
    if (!isUserRegistered) {
      res.status(400)
      res.send(JSON.stringify({ errorCode :  errorCodes.userIsNotRegistered }))
      return
    }

    let isReferralSet = await userRepository.isReferralSet(email)
    if (isReferralSet) {
      res.status(400)
      res.send(JSON.stringify({ errorCode :  errorCodes.refferalAlreadyReceivedBonus }))
      return
    }

    await userRepository.updateReferral(email, referralEmail)
    logger.info(`Referral Updated for ${email} referral: ${referralEmail}`)

    let credit = await branchClient.giveCredit(req.body.referralEmail)
    logger.info('Credit result: ' + credit + ' for email: ' + req.body.referralEmail)

    res.send('OK')
  } catch (error) {
    logger.error(`checkReferral result: ${error} Stack: ${error.stack}`)
    res.status(500)
    res.send('' + error)
  }
})

app.post('/insurancePrice/:address', function (req, res) {
  var account = req.params.address
  var deviceBrand = req.body.deviceBrand
  var deviceYear = req.body.deviceYear
  var wearLevel = req.body.wearLevel
  var region = req.body.region

  var result = policyContract.policyPrice(
    deviceBrand,
    deviceYear,
    wearLevel,
    region
  )
  var priceInEth = result / 1000000000000000000
  res.send('' + priceInEth)
})

app.get('/maxPayout', function (req, res) {
  var account = req.params.address
  var result = policyContract.maxPayout.call()
  var payoutInEth = result / 1000000000000000000
  res.send('' + payoutInEth)
})

app.post('/insure/:address/', function (req, res) {
  var receivedApiKey = req.body.apiKey

  if (receivedApiKey != apiKey) {
    res.status(401)
    res.send()

    return
  }

  var account = req.params.address
  var itemId = req.body.itemId
  var deviceBrand = req.body.deviceBrand
  var deviceYear = req.body.deviceYear
  var wearLevel = req.body.wearLevel
  var region = req.body.region
  var policyMonthlyPayment = Math.round(
    policyContract.policyPrice(deviceBrand, deviceYear, wearLevel, region) / 12
  )
  logger.info(
    'itemId: ' + itemId +
    ' deviceBrand: ' + deviceBrand +
    ' deviceYear: ' + deviceYear +
    ' region: ' + region +
    ' policyMonthlyPayment: ' + policyMonthlyPayment +
    ' wearLevel: ' + wearLevel
  )

  web3.personal.unlockAccount(account, req.body.password, 2, function (
    err,
    result
  ) {
    if (result) {
      policyContract.insure(itemId, deviceBrand, deviceYear, wearLevel, region,
        {
          value: policyMonthlyPayment,
          gas: 300000,
          gasPrice: 30000000000,
          from: account
        },
        function (err, result) {
          if (err) {
            logger.error('Error in insure ' + err +'object: '+ JSON.stringify(err))
            res.status(400)
            res.send('1' + err)
          } else {
            var txIdinsure = result
            res.send(txIdinsure)

            let filter = web3.eth.filter('latest')

            filter.watch(function (error, result) {
              logger.info('Any Error:' + error)
              if (!error) {
                let confirmedBlock = web3.eth.getBlock(
                  web3.eth.blockNumber - 3
                )
                if (confirmedBlock.transactions.length > 0) {
                  let transaction = web3.eth.getTransaction(txIdinsure)
                  if (transaction && transaction.from === account) {
                    // ---- confirmation transaction is needed from OWNER , TODO: refactor it and move to other file

                    web3.personal.unlockAccount(
                      adminAccount,
                      adminPass,
                      2,
                      function (err, result) {
                        if (result) {
                          policyContract.confirmPolicy(
                            account,
                            {
                              gas: 200000,
                              gasPrice: 15000000000,
                              from: adminAccount
                            },
                            function (err, result) {
                              if (err) {
                                logger.error('confirmPolicy error:' + err)
                                // res.status(400);
                                // res.send('2' + err);
                              } else {
                                // res.send(txIdinsure);
                                logger.info('success confirmation')
                              }
                            }
                          )
                        } else {
                          logger.error('unlockAccount error: ' + err)
                        }
                      }
                    )

                    // -------
                  } else {
                    res.status(400)
                    res.send('4' + error)
                  }
                  filter.stopWatching()
                }
              }
            })
          }
        }
      )
    } else {
      logger.error(`Error in unlock err: ${err} result: ${result} Error Details: ${JSON.stringify(err)} return 5err`)
      res.status(400)
      res.send('5' + err)
    }
  })
})

app.get('/policyEndDate/:address', function (req, res) {
  var account = req.params.address

  var result = policyContract.getPolicyEndDateTimestamp({ from: account })
  res.send('' + result)
})

app.get('/nextPayment/:address', function (req, res) {
  var account = req.params.address

  var result = policyContract.getPolicyNextPayment({ from: account })
  res.send('' + result)
})

app.get('/claimed/:address', function (req, res) {
  var account = req.params.address

  var result = policyContract.claimed({ from: account })
  res.send('' + result)
})

// Not secure, it should come trusted authority, probably as an Oracle directly to smart contract
app.post('/claim/:address', function (req, res) {
  var receivedApiKey = req.body.apiKey

  if (receivedApiKey != apiKey) {
    res.status(401)
    res.send()

    return
  }

  var account = req.params.address
  var wearLevel = req.body.wearLevel

  web3.personal.unlockAccount(account, req.body.password, 2, function (
    err,
    result
  ) {
    if (result) {
      policyContract.claim(wearLevel, { gas: 300000, from: account }, function (
        err,
        result
      ) {
        if (err) {
          logger.error('claim error: ' + err)
          res.status(400)
          res.send('' + false)
        } else {
          var txId = result
          res.send(txId)
        }
      })
    } else {
      logger.error('claim unlock empty result: ' + result)
      res.status(400)
      res.send('' + false)
    }
  })
})

app.get('/', function (req, res) {
  res.send('Welcome to API. Specs can be found: ')
})

app.listen(process.env.PORT || 3000, function () {
  logger.info(
    'Example app listening on port 3000 and https or process.env.PORT: ' +
      process.env.PORT
  )
})
