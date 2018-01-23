"use strict";
global.__base = __dirname + "/"; // Need for node modules paths

const Web3 = require("web3");
const express = require("express");
const fs = require("fs");
const app = express();
const bodyParser = require("body-parser");
const logger = require("./utils/logger.js");
const errorCodes = require("./utils/errorCodes.js");
const emailChecker = require("./utils/emailChecker.js");
const userRepository = require("./repositories/userRepository.js");
const branchClient = require("./clients/branchClient.js");
const config = require("config");
const helmet = require("helmet");

process.on("uncaughtException", function(err) {
  console.error(
    `${new Date().toUTCString()} uncaughtException: ${err.message} ${err.stack} process exit 1`
  );
  logger.error(
    `19 uncaughtException: ${err.message} ${err.stack} process exit 1`
  );
  // process.exit(1)
});

process.on("unhandledRejection", function(err) {
  console.error(
    `${new Date().toUTCString()} unhandledRejection: ${err.message} ${err.stack} process exit 1`
  );
  logger.error(
    `25 unhandledRejection: ${err.message} ${err.stack} process exit 1`
  );
  // process.exit(1)
});

app.use(logger.connectLogger());
app.use(helmet());
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded b
app.use(function(req, res, next) {
  res.setHeader("Content-Type", "application/json");
  next();
});

const web3 = new Web3(
  new Web3.providers.HttpProvider(config.get("Web3.Provider.uri"))
);

var obj = JSON.parse(
  fs.readFileSync("./build/contracts/BatteryInsurancePolicy.json", "utf8")
);
var abiArray = obj.abi;

var contractAddress = config.get("Web3.Contracts.batteryV2");
var policyContract = web3.eth.contract(abiArray).at(contractAddress);

var adminAccount = config.get("Web3.Provider.adminAccount");
var adminPass = config.get("Web3.Provider.adminPass");
var apiKey = config.get("App.apiKey");

app.get("/favicon.ico", function(req, res) {
  res.status(204);
});

app.get("/time", function(req, res) {
  var currentDate = new Date();
  var result = {
    now: currentDate.toISOString(),
    tamezoneOffset: currentDate.getTimezoneOffset()
  };

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(result));
});

// app.get("/test", async function(req, res) {
//  // throw new Error("ters");
//   // let result = await emailChecker.checkEmail('')
//   // let result = await userRepository.getUserAccountAddress('a@a.lt')
//   // result = await userRepository.saveAccount('0x6', 'ddetestemail', 'ddetestpsw', result)
//   // let result = await branchClient.getBranchIdentity('')
//   // console.log('result ' + result)
//   // return result
// });

app.get("/balance/:address", function(req, res) {
  var balance = web3.eth.getBalance(req.params.address).toNumber();
  var balanceInEth = balance / 1000000000000000000;
  res.send("" + balanceInEth);
});

app.post("/sendTestnetEthers/:address", function(req, res) {
  var account = req.params.address;
  var receivedApiKey = req.body.apiKey;

  if (receivedApiKey != apiKey) {
    res.status(401);
    res.send();

    return;
  }

  web3.personal.unlockAccount(account, req.body.password, 4, function(
    err,
    accResult
  ) {
    if (accResult) {
      // unlocking admin account for ethers sending
      web3.personal.unlockAccount(adminAccount, adminPass, 4, function(
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
          function(err, result) {
            if (err) {
              logger.error("87 " + err);
              res.send(false);
            } else {
              var txId = result;
              res.send("" + txId);
            }
          }
        );
      });
    } else {
      logger.error("107 " + err);
      res.send(false);
    }
  });
});

// referralEmail - user email who invited
// register(apiKey, password, email)
// todo refactor password
app.post("/register", async function(req, res) {
  if (!req.body.password || !req.body.email || req.body.apiKey !== apiKey) {
    logger.warning(
      `Request not valid: psw: ${req.body.password} email: ${req.body
        .email} api: ${req.body.apiKey}`
    );
    res.status(400);
    res.send(JSON.stringify({ errorCode: errorCodes.inputParamsNotValid }));
    return;
  }

  let emailIsValid = await emailChecker.checkEmail(req.body.email);

  if (!emailIsValid) {
    logger.warning(`Email is not Valid: email: ${req.body.email}`);
    res.status(400);
    res.send(JSON.stringify({ errorCode: errorCodes.emailIsNotValid }));
    return;
  }

  let email = req.body.email.toLowerCase();

  try {
    let account = await userRepository.getUserAccountAddress(email);

    if (account) {
      if (account === "empty") {
        account = await web3.personal.newAccount(req.body.password);
        await userRepository.updateAccount(account, email, req.body.password);
        res.send(account);
      } else {
        res.send(account);
      }
    } else {
      account = await web3.personal.newAccount(req.body.password);
      await userRepository.saveAccount(account, email, req.body.password);

      res.send(account);
    }
  } catch (error) {
    logger.error("156 " + error);
    res.status(500);
    res.send("" + error);
  }
});

// checkReferral(apiKey, email, referralIdentity)
app.post("/checkReferral", async function(req, res) {
  res.send("OK");
});

app.post("/insurancePrice/:address", function(req, res) {
  var deviceBrand = req.body.deviceBrand;
  var deviceYear = req.body.deviceYear;
  var wearLevel = req.body.wearLevel;
  var region = req.body.region;

  var result = policyContract.policyPrice(
    deviceBrand,
    deviceYear,
    wearLevel,
    region
  );
  var priceInEth = result / 1000000000000000000;
  res.send("" + priceInEth);
});

app.get("/maxPayout", function(req, res) {
  var account = req.params.address;
  var result = policyContract.maxPayout.call();
  var payoutInEth = result / 1000000000000000000;
  res.send("" + payoutInEth);
});

app.post("/insure/:address/", function(req, res) {
  var receivedApiKey = req.body.apiKey;

  if (receivedApiKey !== apiKey) {
    logger.warning(
      `Provided apiKey = ${receivedApiKey} is not valid. Return 401`
    );
    res.status(401);
    res.send();
    return;
  }
  var account = req.params.address;

  logger.infoInsure(
    "address: " + account + ", request: " + JSON.stringify(req.body)
  );

  var itemId = req.body.itemId;
  var deviceBrand = req.body.deviceBrand;
  var deviceYear = req.body.deviceYear;
  var wearLevel = req.body.wearLevel;
  var region = req.body.region;
  var policyMonthlyPayment = Math.round(
    policyContract.policyPrice(deviceBrand, deviceYear, wearLevel, region) / 12
  );

  web3.personal.unlockAccount(account, req.body.password, 20, function(
    err,
    result
  ) {
    if (err) {
      logger.error("323 " + err);
      res.status(400);
      res.send("1" + err);
      return;
    }

    if (result) {
      policyContract.insure(itemId, deviceBrand, deviceYear, wearLevel, region,
        {
          value: policyMonthlyPayment,
          gas: 300000,
          gasPrice: 30000000000,
          from: account
        },
        function(err, result) {
          if (err) {
            logger.error("294 " + err);
            res.status(400);
            res.send("1" + err);
            return;
          } else {
            var txIdinsure = result;
            res.send(txIdinsure);

            let filter = web3.eth.filter("latest");
            filter.watch(function(error, result) {
              if (error) {
                logger.error("316 error in filter watch " + error);
                res.status(400);
                res.send("1" + error);
                return;
              }

              let confirmedBlock = web3.eth.getBlock(web3.eth.blockNumber - 3);
              if (confirmedBlock.transactions.length > 0) {
                let transaction = web3.eth.getTransaction(txIdinsure);

                if (transaction && transaction.from === account) {
                  // ---- confirmation transaction is needed from OWNER , TODO: refactor it and move to other file

                  web3.personal.unlockAccount(
                    adminAccount,
                    adminPass,
                    2,
                    function(err, result) {
                      if (result) {
                        policyContract.confirmPolicy(
                          account,
                          {
                            gas: 200000,
                            gasPrice: 15000000000,
                            from: adminAccount
                          },
                          function(err, result) {
                            if (err) {
                              logger.error("328 " + err);
                              // res.status(400);
                              // res.send('2' + err);
                            } else {
                              // res.send(txIdinsure);
                              logger.info("success confirmation");
                            }
                          }
                        );
                      } else {
                        logger.error("338 " + err);
                      }
                    }
                  );

                } else {
                  logger.warning("353 return 400: transaction.from != account");
                  res.status(400);
                  res.send("4" + "ransaction.from != account");
                }
                filter.stopWatching();
              }
            });
          }
        }
      );
    } else {
      logger.warning("364 return 400 result: " + result);
      res.status(400);
      res.send("5" + result);
    }
  });
});

app.get("/policyEndDate/:address", function(req, res) {
  var account = req.params.address;

  var result = policyContract.getPolicyEndDateTimestamp({ from: account });
  res.send("" + result);
});

app.get("/nextPayment/:address", function(req, res) {
  var account = req.params.address;

  var result = policyContract.getPolicyNextPayment({ from: account });
  res.send("" + result);
});

app.get("/claimed/:address", function(req, res) {
  var account = req.params.address;

  var result = policyContract.claimed({ from: account });
  res.send("" + result);
});

// Not secure, it should come trusted authority, probably as an Oracle directly to smart contract
app.post("/claim/:address", function(req, res) {
  var receivedApiKey = req.body.apiKey;

  if (receivedApiKey != apiKey) {
    logger.error("437 not valid " + receivedApiKey);
    res.status(401);
    res.send();

    return;
  }

  var account = req.params.address;

  logger.infoClaim(
    "address: " + account + ", request: " + JSON.stringify(req.body)
  );

  var wearLevel = req.body.wearLevel;

  web3.personal.unlockAccount(account, req.body.password, 2, function(err, result) {
    if (err) {
      logger.error("421 " + err);
      res.status(400);
      res.send("" + false);
      return;
    }

    if (result) {
      policyContract.claim(wearLevel, { gas: 400000, from: account }, function(
        err,
        result
      ) {
        if (err) {
          logger.error("407" + err);
          res.status(400);
          res.send("" + false);
          return;
        } else {
          var txId = result;
          res.send(txId);
          return;
        }
      });
    } else {
      logger.error("444 result is undefined " + result);
      res.status(400);
      res.send("" + false);
    }
  });
});

app.get("/", function(req, res) {
  res.send("Welcome to API. Specs can be found: ");
});

app.listen(process.env.PORT || 3000, function() {
  logger.info(
    "Example app listening on port 3000 and https or process.env.PORT: " +
      process.env.PORT
  );
});
