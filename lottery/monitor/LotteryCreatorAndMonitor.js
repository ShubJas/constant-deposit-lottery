
var conf = require('../../config/index');
var utils = require('../../utils/index');
var Lottery = require('./../core/Lottery');
var fs = require('fs');
var async = require('async');

var web3 = utils.web3;
var eth = web3.eth;
var personal = web3.personal;
console.log("last block number:"+ web3.eth.blockNumber);

// var playerX = "0xb2eda2156386a938f4b008410a4dedbd1a51d5e9";
// var playerY = "0xe2fe120d5bbc9a5af31dd6db5a22f32a055c41ed";
// var playerZ = "0x84df6106d39ef3c896bb37be19f9306186263f53";
// var playerT = "0xcc5bdc44926d40c57dda3cef4763c808d3c4470e";
// var secretX = 1;
// var secretY = 2;
// var secretZ = 3;
// var secretT = 4;

/**************************/

function LotteryCreator() {

    this.advertiser = conf.addresses.Nicola;
    this.deposit = 1;
    this.levels = process.argv[2];

    if (this.level<1)
        throw "level must be >= 1";

    this.contract = utils.compiledContracts()["Lottery"];
}

LotteryCreator.prototype.create = function() {
    var _this = this;
    this.adversiteLottery(function (lottery) {
        _this.lotteryInstance = lottery;

        _this.registrationEvent = lottery.RegistrationEvent();
        _this.registrationDoneEvent = lottery.RegistrationDoneEvent();
        _this.allRefundedEvent = lottery.AllRefundedEvent();
        _this.levelIncreasedEvent = lottery.LevelIncreasedEvent();
        _this.lotteryWinnerEvent = lottery.LotteryWinnerEvent();
        _this.matchWinnerEvent = lottery.MatchWinnerEvent();

        _this.registrationEvent.watch(function(err,res) {_this.handleRegistrationEvent(err,res)});
        _this.registrationDoneEvent.watch(function(err,res) {_this.handleRegistrationDoneEvent(err,res)});
        _this.allRefundedEvent.watch(function(err,res) {_this.handleAllRefundedEvent(err,res)});
        _this.levelIncreasedEvent.watch(function(err,res) {_this.handleLevelIncreasedEvent(err,res)});
        _this.lotteryWinnerEvent.watch(function(err,res) {_this.handleLotteryWinnerEvent(err,res)});
        _this.matchWinnerEvent.watch(function (err,res) {_this.handleMatchWinnerEvent(err,res)})
    });
};

LotteryCreator.prototype.adversiteLottery = function(callback) {

    console.log("Adversiting lottery..");
    personal.unlockAccount(this.advertiser, "");

    /*
     * Create the contract
     */
    var lotteryContract = web3.eth.contract(this.contract.info.abiDefinition);
    lotteryContract.new(
        this.levels,
        this.deposit,
        {
            from: this.advertiser,
            data: this.contract.code,
            gas: conf.gas,
            gasPrice: conf.gasPrice
        },
        function (error, lottery){

            if(!error) {
                // NOTE: The callback will fire twice!
                // Once the contract has the transactionHash property set and once its deployed on an address.

                // e.g. check tx hash on the first call (transaction send)
                if(lottery.address) {
                    console.log('Contract mined! https://testnet.etherscan.io/address/' + lottery.address);

                    console.log();
                    console.log("-- Registration --");
                    if(callback) callback(lottery);
                }
                else {
                    console.log("Lottery advertised at https://testnet.etherscan.io/tx/"+lottery.transactionHash);
                }
            }
        }
    )
};

LotteryCreator.prototype.handleRegistrationEvent = function(error, result) {
    if (!error) {
        var addr = result.args._addr;
        var userid = result.args._userid;
        var secrets = result.args._secrets;

        console.log("lottery addr: "+result.address);
        console.log("player addr:  "+addr);
        console.log("userid:       "+userid);
        console.log("secrets:      "+secrets);
        console.log();
    }
    else
        console.log("-> Error handling the event.")
};

LotteryCreator.prototype.handleRegistrationDoneEvent = function(err,result) {
    if (!err && utils.equalAddresses(result.address, this.lotteryInstance.address)) {
        console.log("Registration Done");
    }
    else
        this.log("-> Error handling the event.");
};

LotteryCreator.prototype.handleAllRefundedEvent = function(err,result) {
    if (!err) {
        console.log();
        console.log("REFUND: all participants were refunded. Lottery balance is "+eth.getBalance(this.lotteryInstance.address));
        this.cleanWatchers();
    }
    else
        console.log("-> Error handling the event.");
};

LotteryCreator.prototype.handleLevelIncreasedEvent = function(err,result) {
    if (!err) {
        var level = utils.lotteryFromAddress(result.address).level()-1;
        console.log();
        console.log("Level "+level+" is done");
    }
    else
        console.log("-> Error handling the event.");
};

LotteryCreator.prototype.handleMatchWinnerEvent = function(err,result) {
    if (!err) {
        var level = result.args._level;
        var matchId = result.args._matchId;
        var userId = result.args._userid;

        console.log("Level "+level+" - Match "+matchId+" - winner "+userId);
    }
    else
        console.log("-> Error handling the event.");
};

LotteryCreator.prototype.handleLotteryWinnerEvent = function(err,result) {
    if (!err) {
        var userId = result.args._userid;
        var winner = utils.lotteryFromAddress(result.address).lotteryWinner();
        console.log();
        console.log("*****************************************************************");
        console.log("*                                                               *");
        console.log("* The winner is: "+userId+" - "+winner+" *");
        console.log("*                                                               *");
        console.log("*****************************************************************");
        this.cleanWatchers();
    }
    else
        console.log("-> Error handling the event.");
};

LotteryCreator.prototype.cleanWatchers = function() {
    this.lotteryWinnerEvent.stopWatching();
    this.matchWinnerEvent.stopWatching();
    this.levelIncreasedEvent.stopWatching();
    this.registrationEvent.stopWatching();
    this.registrationDoneEvent.stopWatching();
    this.allRefundedEvent.stopWatching();
};

/****************************************/

new LotteryCreator().create();