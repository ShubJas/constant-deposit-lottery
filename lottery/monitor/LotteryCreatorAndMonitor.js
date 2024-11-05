module.exports = LotteryCreator;

const conf = require('../../config');
const utils = require('../../utils/index');
const fs = require('fs');
const path = require('path');
const async = require('async');

const web3 = utils.web3;
const eth = web3.eth;
const personal = web3.personal;

/**
 *
 * @param levels
 * @param deposit
 * @constructor
 */
function LotteryCreator(levels, deposit) {
    this.levels = levels;
    this.deposit = deposit;

    if (this.levels < 1) {
        throw new Error("Level must be >= 1");
    }

    // Load ABI and bytecode from the Truffle build files
    const contractPath = path.resolve(__dirname, '../../build/contracts/Lottery.json');
    const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    
    this.abi = contractData.abi;
    this.bytecode = contractData.bytecode;
}

LotteryCreator.prototype.create = function() {
    const _this = this;
    this.advertiseLottery(function (lottery) {
        _this.lotteryInstance = lottery;

        // Set up event watchers
        _this.registrationEvent = lottery.RegistrationEvent();
        _this.registrationDoneEvent = lottery.RegistrationDoneEvent();
        _this.allRefundedEvent = lottery.AllRefundedEvent();
        _this.levelIncreasedEvent = lottery.LevelIncreasedEvent();
        _this.lotteryWinnerEvent = lottery.LotteryWinnerEvent();
        _this.matchWinnerEvent = lottery.MatchWinnerEvent();

        // Event handlers
        _this.registrationEvent.watch((err, res) => _this.handleRegistrationEvent(err, res));
        _this.registrationDoneEvent.watch((err, res) => _this.handleRegistrationDoneEvent(err, res));
        _this.allRefundedEvent.watch((err, res) => _this.handleAllRefundedEvent(err, res));
        _this.levelIncreasedEvent.watch((err, res) => _this.handleLevelIncreasedEvent(err, res));
        _this.lotteryWinnerEvent.watch((err, res) => _this.handleLotteryWinnerEvent(err, res));
        _this.matchWinnerEvent.watch((err, res) => _this.handleMatchWinnerEvent(err, res));
    });
};

LotteryCreator.prototype.advertiseLottery = function(callback) {
    console.log("Advertising lottery...");
    personal.unlockAccount(
        conf.advertiser.address,
        conf.advertiser.password
    );

    /*
     * Create the contract
     */
    const lotteryContract = web3.eth.contract(this.abi); // Use loaded ABI
    lotteryContract.new(
        this.levels,
        this.deposit,
        {
            from: conf.advertiser.address,
            data: this.bytecode, // Use loaded bytecode
            gas: conf.gas,
            gasPrice: conf.gasPrice
        },
        function (error, lottery) {
            if (!error) {
                // The callback will fire twice: once with transactionHash, then with address
                if (lottery.address) {
                    console.log('Contract mined! https://testnet.etherscan.io/address/' + lottery.address);
                    console.log('Lottery address: ' + lottery.address);
                    console.log("\n-- Registration --");
                    if (callback) callback(lottery);
                } else {
                    console.log("Lottery advertised at https://testnet.etherscan.io/tx/" + lottery.transactionHash);
                    console.log("Lottery advertised at tx: " + lottery.transactionHash);
                }
            } else {
                console.error("Error deploying contract:", error);
            }
        }
    );
};

LotteryCreator.prototype.handleRegistrationEvent = function(error, result) {
    if (!error) {
        const addr = result.args._addr;
        const userid = result.args._userid;
        const secrets = result.args._secrets;

        console.log("Lottery address: " + result.address);
        console.log("Player address:  " + addr);
        console.log("User ID:         " + userid);
        console.log("Secrets:         " + secrets);
        console.log();
    } else {
        console.log("-> Error handling the registration event.");
    }
};

LotteryCreator.prototype.handleRegistrationDoneEvent = function(err, result) {
    if (!err && utils.equalAddresses(result.address, this.lotteryInstance.address)) {
        console.log("Registration Completed");
    } else {
        console.log("-> Error handling the registration done event.");
    }
};

LotteryCreator.prototype.handleAllRefundedEvent = function(err, result) {
    if (!err) {
        console.log("\nREFUND: All participants were refunded. Lottery balance is " + eth.getBalance(this.lotteryInstance.address));
        this.cleanWatchers();
    } else {
        console.log("-> Error handling the all refunded event.");
    }
};

LotteryCreator.prototype.handleLevelIncreasedEvent = function(err, result) {
    if (!err) {
        const level = utils.lotteryFromAddress(result.address).level() - 1;
        console.log("\nLevel " + level + " is completed");
    } else {
        console.log("-> Error handling the level increased event.");
    }
};

LotteryCreator.prototype.handleMatchWinnerEvent = function(err, result) {
    if (!err) {
        const level = result.args._level;
        const matchId = result.args._matchId;
        const userId = result.args._userid;

        console.log("Level " + level + " - Match " + matchId + " - Winner: " + userId);
    } else {
        console.log("-> Error handling the match winner event.");
    }
};

LotteryCreator.prototype.handleLotteryWinnerEvent = function(err, result) {
    if (!err) {
        const userId = result.args._userid;
        const winner = utils.lotteryFromAddress(result.address).lotteryWinner();
        console.log("\n*****************************************************************");
        console.log("*                                                               *");
        console.log("* The winner is: " + userId + " - " + winner + " *");
        console.log("*                                                               *");
        console.log("*****************************************************************");
        this.cleanWatchers();
    } else {
        console.log("-> Error handling the lottery winner event.");
    }
};

LotteryCreator.prototype.cleanWatchers = function() {
    this.lotteryWinnerEvent.stopWatching();
    this.matchWinnerEvent.stopWatching();
    this.levelIncreasedEvent.stopWatching();
    this.registrationEvent.stopWatching();
    this.registrationDoneEvent.stopWatching();
    this.allRefundedEvent.stopWatching();
};
