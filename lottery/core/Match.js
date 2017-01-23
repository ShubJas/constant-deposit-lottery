/**
 * Created by nicola on 24/11/16.
 */

module.exports = Match;

var conf = require('../../config');
var utils = require('../../utils/index');

/**
 * Constructor of a Match
 *
 * @param matchContract
 *      a contract instance obtained through the web3 API. The contract must be mined.
 * @param playerAddr
 *      the address of a player involved in the match
 * @param secret
 *      the plain secret to reveal
 * @param salt
 *      the salt used to encrypt the secret
 * @param password
 *      the password to unlock the player account (if omitted, an empty password is used)
 * @param alias
 *      player alias for logging purpose only
 * @constructor
 */
function Match (matchContract, playerAddr, secret, salt, password, alias) {
    if (!matchContract || !playerAddr || !secret || !salt)
        throw "invalid parameters";

    this.match = matchContract;
    this.playerAddr = playerAddr;
    this.secret = secret;
    this.salt = salt;
    this.password = password? password: "";

    var xPlayer = this.match.x();
    var yPlayer = this.match.y();
    if (    // check if the given address is involved in the match
            !utils.equalAddresses(playerAddr, xPlayer) &&
            !utils.equalAddresses(playerAddr, yPlayer)) {
        throw "the given address does not seem to be involved in the match ("+xPlayer+","+yPlayer+")";
    }

    this.amITheFirst = utils.equalAddresses(xPlayer, playerAddr);
    this.alias = alias? alias : (this.amITheFirst? "X": "Y");

    this.STATE_X_REVEAL = this.match.STATE_X_REVEAL().toString();
    this.STATE_Y_REVEAL = this.match.STATE_Y_REVEAL().toString();
    this.STATE_WINNER = this.match.STATE_WINNER().toString();
}

/**
 * Return the current state of a Match.
 * It can be
 * - this.STATE_X_REVEAL: the first participant must reveal its secret
 * - this.STATE_Y_REVEAL: the second participant must reveal its secret
 * - this.STATE_WINNER: both participant revealed their secrets and the winner was chosen
 */
Match.prototype.currentState = function() { return this.match.state().toString(); };

/**
 * Play a match. It starts two parallel loops in order to:
 * - invoke the timeout if the other participant does not reveal its secret
 * - reveal the secret when our turn starts
 * Invoke the (optional) callback at the end of the match.
 *
 * @param callback
 */
Match.prototype.playAMatch = function(callback) {

    var _this = this;

    this.log("starting match");
    this.timeoutLoop();
    this.playLoop(function(){
        _this.stopTimeout();
        if (callback) callback();
    });
};

/**
 * Loop until the timeout action is allowed, or an external event stop the loop.
 */
Match.prototype.timeoutLoop = function() {

    var _this = this;
    _this.intervalTimeoutLoop = setInterval(function () {
        var tx = _this.timeout();
        if (tx) {
            utils.watchTransaction(tx, function () {
                clearInterval(_this.intervalTimeoutLoop);
            });
        }
    }, 60000);
};

/**
 * Loop querying for the current state and behave accordingly.
 * Invoke the callback at the end of the loop.
 *
 * @param callback
 */
Match.prototype.playLoop = function(callback) {

    var _this = this;

    switch (_this.currentState()) {
        case _this.STATE_X_REVEAL:
            if (_this.amITheFirst){
                _this.log("it's my turn");
                _this.revealSecretSync(function(){  // the state is now updated to STATE_Y_REVEAL
                    setTimeout(function(){_this.playLoop(callback)}, 5000);       // recursive call
                });
            }
            else {
                _this.log("it's not my turn, I'll retry later..");
                setTimeout(function(){_this.playLoop(callback)}, 30000);
            }
            break;

        case _this.STATE_Y_REVEAL:
            if (_this.amITheFirst){
                _this.log("I already played, I'm waiting for the winner..");
                setTimeout(function(){_this.playLoop(callback)}, 30000);
            }
            else {
                _this.log("it's my turn");
                _this.revealSecretSync(function(){  // the state is now updated to STATE_WINNER
                    setTimeout(function(){_this.playLoop(callback)}, 5000);       // recursive call
                });
            }
            break;

        case _this.STATE_WINNER:
            var winner = _this.match.winner();
            var timeout = _this.match.timeout();

            if (utils.equalAddresses(winner, _this.playerAddr))
                this.log("I WIN :)");
            else
                this.log("I LOSE :(");

            this.log("timeout: " + timeout);

            if (callback) callback();
            break;

        default: throw "unexpected state";
    }
};

/**
 * Reveal your secret and invoke the callback when the transaction is published
 * or if the secret cannot be revealed.
 *
 * @param callback
 */
Match.prototype.revealSecretSync = function(callback) {
    var _this = this;
    var tx = this.revealSecret();

    if (tx) {
        utils.watchTransaction(tx, function () {
            _this.log("tx published, secret revealed");
            callback();
        });
    }
    else {
        this.log("the secret cannot be reveled");
        callback();
    }
};

/**
 * Invoke the contract to reveal the secret.
 *
 * @returns {String|Boolean} a string of the transaction id, false otherwise
 */
Match.prototype.revealSecret = function() {

    var data = this.amITheFirst? this.match.revealX.getData(this.secret, this.salt) : this.match.revealY.getData(this.secret, this.salt);

    var txParam = {
        from: this.playerAddr,
        to: this.match.address,
        gas: conf.gas,
        data: data,
        gasPrice: conf.gasPrice
    };

    var enabled = utils.web3.eth.estimateGas(txParam)<conf.gas;

    if (enabled) {
        utils.web3.personal.unlockAccount(txParam.from, this.password);
        this.log("revealing secret");
        return utils.web3.eth.sendTransaction(txParam);
    }
    else {
        this.log("reveal is not enabled yet (it will run out-of-gas)");
        return false;
    }
};

/**
 * Invoke timeout function of the contract.
 *
 * @returns {String|Boolean} a string of the transaction id, false otherwise
 */
Match.prototype.timeout = function() {

    var data = this.amITheFirst? this.match.timeoutY.getData() : this.match.timeoutX.getData();

    var txParam = {
        from: this.playerAddr,
        to: this.match.address,
        gas: conf.gas,
        data: data,
        gasPrice: conf.gasPrice
    };

    var enabled = utils.web3.eth.estimateGas(txParam)<conf.gas;

    if (enabled) {
        utils.web3.personal.unlockAccount(txParam.from, this.password);
        this.log("executing Timeout");
        return utils.web3.eth.sendTransaction(txParam);
    }
    else {
        this.log("timeout is not enabled yet (it will run out-of-gas)");
        return false;
    }
};

/*
 * Log facility
 */
Match.prototype.log = function(str) {
    console.log("["+this.alias+"] "+str);
};

/*
 * Stop the timeout loop
 */
Match.prototype.stopTimeout = function() {
    this.log("stopping timeout loop");
    clearInterval(this.intervalTimeoutLoop);
};
