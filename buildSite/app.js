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
const walletRepository = require("./repositories/walletRepository.js");
const branchClient = require("./clients/branchClient.js");
const config = require("config");
const helmet = require("helmet");
var Tx = require('ethereumjs-tx');
var Wallet = require('ethereumjs-wallet');
var fullpath = __dirname + "/../keystore files/";



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
var gasPrice = '5';
const GAS_PRICE = web3.utils.toWei(gasPrice, 'gwei');
const GAS_LIMIT = '6700000';


var obj = JSON.parse(
  fs.readFileSync("./build/contracts/BatteryInsurancePolicy.json", "utf8")
);
var abiArray = obj.abi;

var contractAddress = config.get("Web3.Contracts.batteryV2");
var policyContract = new web3.eth.Contract(abiArray, contractAddress);

var adminAccount = config.get("Web3.Provider.adminAccount");
var adminPass = config.get("Web3.Provider.adminPass");
var adminPrivateKey = Buffer.from(config.get("Web3.Provider.adminPrivateKey"), 'hex');
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

app.get("/balance/:address",async function(req, res) {
  var balance = await web3.eth.getBalance(req.params.address).then(function(res){ return Number(res);});
  var balanceInEth = balance / 1000000000000000000;
  res.send("" + balanceInEth);
});

app.post("/sendTestnetEthers/:address", async function(req, res) {
  var account = req.params.address;
  var receivedApiKey = req.body.apiKey;

  if (receivedApiKey != apiKey) {
    res.status(401);
    res.send();

    return;
  }

  var nonce = await web3.eth.getTransactionCount(adminAccount)
  var rawTx = {
      from: adminAccount,
      nonce: web3.utils.toHex(nonce),
      gasPrice:  web3.utils.toHex(GAS_PRICE),
      gasLimit:   web3.utils.toHex(21000),
      to: account,
      value: 50000000000000000
    }
    var tx = new Tx(rawTx);
    tx.sign(adminPrivateKey);
    var serializedTx = tx.serialize();
    try {
      web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
              .on('transactionHash', function(hash, err) {
                if(err) {
                  logger.error("Failed to send transaction: " + err)
                }
                if(hash) {
                  logger.info("Transaction sent to: " + account +" TxHas: " + hash);
                }
              });
    }
    catch(e) {
      logger.error("107 "+ e);
      res.send(false);
    }
    res.send(true);
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

  let email = req.body.email.toLowerCase();

  try {
    let account = await userRepository.getUserAccountAddress(email);

    if (account) {
      if (account === "empty") {
        account = walletRepository.getNewAccount(email, req.body.password);
        await userRepository.updateAccount(account, email, req.body.password);
        res.send(account)
      } else {
        res.send(account)
      }
    } else {
      account = walletRepository.getNewAccount(email, req.body.password);
      await userRepository.saveAccount(account, email, req.body.password);

      res.send(account)
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

app.post("/insurancePrice/:address", async function(req, res) {
  var deviceBrand = req.body.deviceBrand;
  var deviceYear = req.body.deviceYear;
  var wearLevel = req.body.wearLevel;
  var region = req.body.region;
  var result = await policyContract.methods.policyPrice(
    deviceBrand,
    deviceYear,
    wearLevel,
    region
  ).call();
  var priceInEth = result / 1000000000000000000;
  res.send(""+priceInEth);
});

app.get("/maxPayout", async function(req, res) {
  var account = req.params.address;
  var result = await policyContract.methods.maxPayout().call();
  var payoutInEth = result / 1000000000000000000;
  res.send("" + payoutInEth);
});

app.post("/insure/:address/", async function(req, res) {
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
    var userAccountPassword = req.body.password;
    var policyMonthlyPayment = Math.round(
      await policyContract.methods.policyPrice(deviceBrand, deviceYear, wearLevel, region).call() / 12
    );

    var email = await userRepository.getUserEmail(account);

    var accountKeystoreInfo = await walletRepository.getKeystoreFile(account);

    if (!accountKeystoreInfo) {
      logger.error("250 No keystore file was found of account: " + account);
      res.status(400);
      res.send("250 Can not find account: " + account);
      return;
    }

    var nonce = await web3.eth.getTransactionCount(account);
    var encodedData = policyContract.methods.insure(itemId, deviceBrand, deviceYear, wearLevel, region).encodeABI();
    var userWallet = Wallet.fromV3(accountKeystoreInfo, userAccountPassword);
   
    var rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice:  web3.utils.toHex('50000000'),
        gasLimit:   web3.utils.toHex('500000'),
        to: contractAddress,
        data: encodedData,
        value: policyMonthlyPayment
    }
    var tx = new Tx(rawTx);
    tx.sign(userWallet.getPrivateKey());
    var serializedTx = tx.serialize();
    await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('transactionHash', function(txHash, error){
      if(error) {
        logger.error("276 failed to send transaction to insure contract" + error);
        res.status(400);
        res.send("1" + err);
        return;
      }

      logger.info("Insure transaction was sent from account: " + account + " TRANSACTION HASH NUMBER: " + txHash);
      approvePolicy(account);
      res.send(txHash);
    });
});

app.get("/policyEndDate/:address", async function(req, res) {
  var account = req.params.address;

  var result = await policyContract.methods.getPolicyEndDateTimestamp().call({from: account});
  res.send("" + result);
});

app.get("/nextPayment/:address", async function(req, res) {
  var account = req.params.address;

  var result = await policyContract.methods.getPolicyNextPayment().call({ from: account });
  res.send("" + result);
});

app.get("/claimed/:address", async function(req, res) {
  var account = req.params.address;

  var result = await policyContract.methods.claimed().call({ from: account });
  res.send("" + result);
});

// Not secure, it should come trusted authority, probably as an Oracle directly to smart contract

app.post("/claim/:address", async function(req, res) {
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
  var userAccountPassword = req.body.password;
  var email = await userRepository.getUserEmail(account);
  
  var accountKeystoreInfo = await walletRepository.getKeystoreFile(account);

  if (!accountKeystoreInfo) {
    logger.error("331 No keystore file was found of account: " + account);
    res.status(400);
    res.send("331 Can not find account: " + account);
    return;
  }
  
  var nonce = await web3.eth.getTransactionCount(account);
  var encodedData = policyContract.methods.claim(wearLevel).encodeABI();
  var userWallet = Wallet.fromV3(accountKeystoreInfo, userAccountPassword);

  var rawTx = {
    nonce: web3.utils.toHex(nonce),
    gasPrice:  web3.utils.toHex('5000000000'),
    gasLimit:   web3.utils.toHex('500000'),
    to: contractAddress,
    data: encodedData
  }
  var tx = new Tx(rawTx);
  tx.sign(userWallet.getPrivateKey());
  var serializedTx = tx.serialize();
  
  await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('transactionHash', function(txHash, error){
    if(error) {
      logger.error("355 failed to send transaction to insure contract" + error);
      res.status(400);
      res.send("355 " + err);
      return;
    }
    logger.info("Claim transaction was sent from account: " + account + " TRANSACTION HASH NUMBER: " + txHash);
    res.send(txHash);
    return;
  });
});

app.get("/", function(req, res) {
  res.send("Welcome to API. Specs can be found: ");
});

app.listen(process.env.PORT || 3000, async function() {
  logger.info(
    "Example app listening on port 3000 and https or process.env.PORT: " +
      process.env.PORT
  );
  await walletRepository.generateAccountKeystoreHashTable();
});

async function approvePolicy(account) {
  var data = policyContract.methods.confirmPolicy(account).encodeABI();
  var nonce = await web3.eth.getTransactionCount(adminAccount);
  var rawTx = {
    nonce: web3.utils.toHex(nonce),
    gasPrice:  web3.utils.toHex('50000000'),
    gasLimit:   web3.utils.toHex('500000'),
    to: contractAddress,
    data: data
  }
  var transaction = new Tx(rawTx);
  transaction.sign(adminPrivateKey);
  var serTx = transaction.serialize();
  await web3.eth.sendSignedTransaction('0x' + serTx.toString('hex')).on('transactionHash', function(txHash, error){
    if(error) {
      logger.error("400 failed to send approve insurance policy" + error);
      return;
    }
    logger.info("Confirmation transaction was successfully applied. TRANSACTION HASH NUMBER: " + txHash);
  });
}
