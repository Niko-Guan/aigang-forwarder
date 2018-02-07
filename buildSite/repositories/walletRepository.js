'use strict'

var hashTable = require('node-hashtable');
const fs = require("fs");
var Wallet = require('ethereumjs-wallet');
var Finder = require('fs-finder');
const config = require("config");
const logger = require("../utils/logger.js");
const Web3 = require("web3");
const web3 = new Web3(
    new Web3.providers.HttpProvider(config.get("Web3.Provider.uri"))
);
var fullpathToKeyStoreFiles = config.get("Files.pathToKeystoreFiles");

function getNewAccount(email, password) {
    var privateKey = generatePrivateKey(email, password);
    var key = Buffer.from(privateKey.replace('0x', ''), 'hex');
    var wallet = Wallet.fromPrivateKey(key);
    var accountAddress = '0x' + wallet.getAddress().toString('hex');
    saveKeystoreFile(wallet.toV3String(password), accountAddress);
    return accountAddress;
}

function saveKeystoreFile(content, accountAddress) {
    logger.info("Saving keystore file of wallet: " + accountAddress);
    accountAddress = accountAddress.replace("0x", "");
    var fileName = fullpathToKeyStoreFiles + "UTC--" + new Date().toISOString() + '--' + accountAddress + '.json';
    fs.appendFileSync(fileName, content, function (err) {
        if (err) console.log('ERROR on: ' + participantInfo.join(","));
    });
    hashTable.set(accountAddress, fileName);
}

async function generateAccountKeystoreHashTable() {
    var filenames = Finder.in(fullpathToKeyStoreFiles).findFiles();
    filenames.forEach(function (name) {
        let index = name.indexOf("Z");
        if (index > 0) {
            let address = name.slice(index + 3, index + 43);
            hashTable.set(address, name);
        }
    })
}

function generatePrivateKey(email, password) {
    var passwordToHash = email + password;
    var privateKey = web3.utils.sha3(passwordToHash);
    return privateKey;
}

async function getKeystoreFile(account) {
    if (account) {
        account = account.replace('0x', '').toLowerCase();

        let keystoreFileLocation = hashTable.get(account);
        if (keystoreFileLocation) {
            try {
                var result = fs.readFileSync(keystoreFileLocation, 'utf8', function (err, result) {
                    if (err) {
                        logger.error("Failed reading file: " + err);
                        return;
                    }
                    return result;
                })
                if (result) {
                    return result;
                }
            } catch (e) {
                console.log(e);
            }
        }
        return result;
    }
}

module.exports = {
    getNewAccount: getNewAccount,
    getKeystoreFile: getKeystoreFile,
    generateAccountKeystoreHashTable: generateAccountKeystoreHashTable,
    generatePrivateKey: generatePrivateKey,
    saveKeystoreFile: saveKeystoreFile,
}