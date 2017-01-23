
var conf = require('../../config');
var utils = require('../../utils/index');
var fs = require('fs');
var async = require('async');

var web3 = utils.web3;
var eth = web3.eth;
var personal = web3.personal;

function MatchCreator() {

    this.playerX = conf.addresses.Nicola;
    this.playerY = conf.addresses.Jansson;
    this.xSecret = 42;
    this.ySecret = 22;
    this.xSalt = 0;
    this.ySalt = 0;

    this.contract = utils.compiledContracts()["Match"];
}

MatchCreator.prototype.create = function() {
    var _this = this;
    this.adversiteMatch(function (match) {
        _this.xReveleadEvent = match.XRevealedEvent();
        _this.yReveleadEvent = match.YRevealedEvent();
        _this.winnerEvent = match.WinnerEvent();

        _this.xReveleadEvent.watch(function(err,res) {_this.handleXRevealedEvent(err,res)});
        _this.yReveleadEvent.watch(function(err,res) {_this.handleYRevealedEvent(err,res)});
        _this.winnerEvent.watch(function(err,res) {_this.handleWinnerEvent(err,res)});
    });
};

MatchCreator.prototype.adversiteMatch = function(callback) {
    console.log("Adversiting match..");
    personal.unlockAccount(
        utils.users.advertiser.address,
        utils.users.advertiser.password);

    /*
     * Parameters
     */
    var _x = this.playerX;
    var _y = this.playerY;
    var _s_x =  utils.sha3uint256(this.xSecret,this.xSalt);
    var _s_y =  utils.sha3uint256(this.ySecret,this.ySalt);
    var _timeout_x = conf.match.X_TIMEOUT;
    var _timeout_y = conf.match.Y_TIMEOUT;

    console.log("X: "+this.playerX);
    console.log("Y: "+this.playerY);
    console.log("X secret: "+this.xSecret);
    console.log("Y secret: "+this.ySecret);

    /*
     * Create the contract
     */
    var _this = this;
    var matchContract = web3.eth.contract(this.contract.info.abiDefinition);
    matchContract.new(
        _x,
        _y,
        _s_x,
        _s_y,
        _timeout_x,
        _timeout_y,
        {
            from: utils.users.advertiser.address,
            data: this.contract.code,
            gas: conf.gas,
            gasPrice: conf.gasPrice
        },
        function (error, match){

            if(!error) {
                // NOTE: The callback will fire twice!
                // Once the contract has the transactionHash property set and once its deployed on an address.
                // console.log(match)

                // e.g. check tx hash on the first call (transaction send)
                if(match.address) {
                    console.log('Contract mined! https://testnet.etherscan.io/address/' + match.address);

                    if(callback) callback(match);
                }
                else {
                    console.log("Match advertised at https://testnet.etherscan.io/tx/"+match.transactionHash);
                }
            }
        }
    )
};


MatchCreator.prototype.handleXRevealedEvent = function(error, event) {
    if (!error) {
        var n = event.args.number;
        console.log("-> X revealed its number: "+n);
        this.xReveleadEvent.stopWatching();
    }
    else
        console.log("-> Error handling the event.")
};

MatchCreator.prototype.handleYRevealedEvent = function(error, event) {
    if (!error) {
        var n = event.args.number;
        console.log("-> Y revealed its number: "+n);
        this.yReveleadEvent.stopWatching();
    }
    else
        console.log("-> Error handling the event.")
};

MatchCreator.prototype.handleWinnerEvent = function(error, event) {
    if (!error) {
        loop = false;
        var winner = event.args.winner;
        var timeout = event.args.timeout;
        console.log("-> The winner is: "+this.addrToString(winner)+" (timeout:"+timeout+")");
        this.winnerEvent.stopWatching();
    }
    else
        console.log("-> Error handling the event.")
};

MatchCreator.prototype.addrToString = function(addr) {
    if (addr.toUpperCase() == this.playerX.toUpperCase()) {
        return "X";
    }
    else if (addr.toUpperCase() == this.playerY.toUpperCase()) {
        return "Y";
    }
    else {
        return "<unknown>";
    }
};

/****************************************/

new MatchCreator().create();