
var conf = require('../config');
var Web3 = require('web3');
var leftPad = require('left-pad');
var fs = require('fs');
var winston = require('winston');
var dateFormat = require('dateformat');

// set the provider you want from Web3.providers
var web3 = new Web3(new Web3.providers.HttpProvider(conf.httpProvider.remote));

var compiledContracts;

module.exports = {

    web3: web3,

    waitForTransactionToBePublished: waitForTransactionToBePublished,
    watchTransaction: watchTransaction,

    matchFromAddress: matchFromAddress,
    lotteryFromAddress: lotteryFromAddress,

    equalAddresses: equalAddresses,

    sha3uint256: function(n, salt) {
        return web3.sha3(leftPad(web3.toHex(n).slice(2).toString(16), 64, 0) + leftPad(web3.toHex(salt).slice(2).toString(16), 64, 0), { encoding: 'hex' });
    },

    compiledContracts: function() {
        return  compiledContracts?
                compiledContracts:
                compiledContracts=compile()
    },

    logger: function (name) {
        var logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({
                    timestamp: function() {
                        return dateFormat(Date.now(), "isoTime");
                    },
                    formatter: function(options) {
                        return "["+name+"] "+options.timestamp() +' - '+ options.level +' '+ (options.message ? options.message : '') +
                            (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
                    }
                })
            ]
        });

        logger.level = conf.logLevel;
        logger.cli();
        return logger;
    }
};


/**
 * The function waits until the given {@code tx} is published (i.e. not pending),
 * then it executes the given {@code callback}.
 * @param tx
 * @param callback
 */
function waitForTransactionToBePublished(tx, callback, silent) {
    if (!silent)
        console.log("...waiting to publish tx: https://testnet.etherscan.io/tx/"+tx);

    if (!silent) {
        var interval = setInterval(function(){
            console.log("...waiting to publish tx: "+tx);
        }, 10000);
    }


    (function loop() {
        if ( web3.eth.getTransactionReceipt(tx) == null ) {
            setTimeout(function() {
                    loop(tx, callback);
                }
                , conf.utils.poolingWait
            );
        }
        else {
            clearInterval(interval);
            if (!silent)
                console.log("tx published: "+tx);
            if (callback)
                callback(web3.eth.getTransactionReceipt(tx))
        }

    })();

}

function equalAddresses(a, b) {
    return a.toUpperCase() == b.toUpperCase();
}

function compile() {
    console.log("Compiling contract online...");
    var rawContract = fs.readFileSync(__dirname+"/../lottery/solidity/Lottery.sol", "utf8");
    var result = web3.eth.compile.solidity(rawContract);

    if (!result)
        throw "Something went wrong during the compilation";

    return result;
}

function matchFromAddress (addr) {

    if (!module.exports.compiledContracts()["Match"])
        throw "Match contract not found!";

    var matchContract = web3.eth.contract(compiledContracts["Match"].info.abiDefinition);
    return matchContract.at(addr);
}

function lotteryFromAddress (addr) {

    if (!module.exports.compiledContracts()["Lottery"])
        throw "Lottery contract not found!";

    var lotteryContract = web3.eth.contract(compiledContracts["Lottery"].info.abiDefinition);
    return lotteryContract.at(addr);
}

function watchTransaction(tx, callback) {
    var filter = web3.eth.filter('latest');     // create a filter to listen for incoming blocks

    filter.watch(function (error, blockhash) {
        if (!error) {
            var block = web3.eth.getBlock(blockhash);   // for each new block, search for the given transaction
            if (block.transactions.includes(tx)) {
                filter.stopWatching();
                if (callback) callback();
            }
        }
        else {
            console.log("[ERROR] error receiving latest block: "+err)
        }
    });
}