/**
 * Created by nicola on 29/12/16.
 */

module.exports = Lottery;

const conf = require('../../config');
const utils = require('../../utils/index');
const Match = require('./Match');

/**
 * Constructor of a lottery
 *
 * @param lotteryContract
 *      a contract instance obtained through the web3 API. The contract must be mined.
 * @param playerAddr
 *      the address of a player involved in the match
 * @param plainSecrets
 *      an array of the plain secrets to reveal (one for each level)
 * @param salt
 *      the salt used to encrypt the secret
 * @param password
 *      the password to unlock the player account (if omitted, an empty password is used)
 * @param alias
 *      player alias for logging purpose only
 * @constructor
 */
function Lottery(lotteryContract, playerAddr, password, plainSecrets, salt, alias) {

    if (!lotteryContract || !playerAddr || !plainSecrets || !salt)
        throw "invalid parameters";

    this.lottery = lotteryContract;
    this.playerAddr = playerAddr;
    this.plainSecrets = plainSecrets;
    this.salt = salt;
    this.password = password? password: "";
    this.id = alias? alias: String.fromCharCode((Lottery.instances++)+65).toUpperCase();

    this.DEPOSIT = this.lottery.DEPOSIT();
    this.STATE_INIT = this.lottery.STATE_INIT().toString();
    this.STATE_START = this.lottery.STATE_START().toString();

    this.STATE_ABORT = this.lottery.STATE_ABORT().toString();
    this.N = this.lottery.N().toString();
    this.L = this.lottery.L().toString();

    if (plainSecrets.length!=this.L)
        throw "invalid parameters: you must specify "+this.L+" secrets";

    console.log();
    console.log("--------------- Lottery parameters ---------------");
    console.log("N (expected participants): "+this.N);
    console.log("L (total levels):          "+this.L);
    console.log("d (deposit):               "+this.DEPOSIT);

    console.log();
    console.log("--------------- Participant info ---------------");
    console.log("address: "+playerAddr);
    console.log("plain secrets: "+plainSecrets);
    console.log("salt: "+salt);
    console.log("balance: "+utils.web3.eth.getBalance(playerAddr));

    this.registrationDoneEvent = this.lottery.RegistrationDoneEvent();
    this.registrationAbortEvent = this.lottery.RegistrationAbortEvent();
}


Lottery.instances = 0;

/**
 * Return the current state of a Lottery.
 * It can be
 * - this.STATE_INIT: the registration phase. Players register to the lottery sending a deposit and an array of secrets
 * - this.STATE_START: the lottery phase. Players play their matches until reaching the top level
 * - this.STATE_ABORT: the registration phase was aborted by some participant, after a timeout
 */
Lottery.prototype.currentState = function() { return this.lottery.state().toString(); };

/**
 * Return the current level: 0 <= l <= L
 */
Lottery.prototype.currentLevel = function() { return this.lottery.level().toString(); };

/**
 * Register the player by sending the deposit and its encrypted secrets.
 */
Lottery.prototype.registerAndPlay = function() {
    var _this = this;

    console.log();
    console.log("--------------- Registration ---------------");

    /*
     * Check the state of the lottery contract
     */
    var currentState = this.currentState();

    if (currentState!=this.STATE_INIT) {
        this.log("Invalid state: "+currentState);
        return;
    }

    /*
     * encrypt the secrets for the registration
     */
    this.log("encrypting secrets");
    var secrets = [];
    for (var i=0; i<this.plainSecrets.length; i++) {
        var s = this.plainSecrets[i];
        secrets.push(utils.sha3uint256(s, this.salt));
    }

    /*
     * registration
     */
    this.log("registration");
    var tx = this.registerParticipant(secrets);
    utils.watchTransaction(tx, function () {
        _this.log("registration done");
    });

    this.registrationDoneEvent.watch(function(err,result){
        _this.log("all the participants registered to the lottery");
        _this.stopTimeout();
        _this.play();
    });

    this.registrationAbortEvent.watch(function(err,result){
        _this.handleRegistrationAbortEvent(err,result);
    });

    // start the timeout loop after a while
    setTimeout(function(){
        _this.timeoutRegistrationLoop();
    }, 60*1000);
};

/**
 * Play all the matches.
 * It queries the lottery to get the next match to be played. If a match is lost,
 * the play finished immediately, otherwise continue until the level L is reached.
 */
Lottery.prototype.play = function() {
    var _this = this;
    var currentLevel = _this.currentLevel();

    if  (currentLevel == _this.L) {
        /*
         * The lottery is ended
         */
        _this.log("I WIN THE LOTTERY! :)");
        _this.cleanWatchers();
    }
    else {
        /*
         * Play the match at the current level
         */
        var matchAddress = _this.lottery.getMatch({from:_this.playerAddr});
        var matchContract = utils.matchFromAddress(matchAddress);
        var matchWinner = matchContract.winner();

        if (utils.web3.toBigNumber(matchWinner)!=0) {
            _this.log("match already played, wait for the lottery to go forward");
            setTimeout(function(){_this.play()}, 30000);
        }
        else {
            console.log("--------------- LEVEL "+currentLevel+" ---------------");

            _this.log("playing the match: "+matchAddress);
            _this.log("secret: "+_this.plainSecrets[currentLevel]);

            var match = new Match(
                matchContract,
                _this.playerAddr,
                _this.plainSecrets[currentLevel],
                _this.salt,
                _this.password,
                _this.id
            );

            match.playAMatch(function () {

                var matchWinner = matchContract.winner();
                if (matchWinner==_this.playerAddr) {
                    _this.log("you won the match, set the winner");
                    var tx = _this.goForward(); // once the match is finished, set the winner if you are the winner

                    utils.watchTransaction(tx, function () {
                        _this.log("loop for the next match");
                        _this.play();
                    });
                }
                else {
                    _this.log("you lost the match, terminate");
                    _this.cleanWatchers();
                }
            });

        }
    }
};

/**
 * Start a loop trying to call the timeout function of the contract.
 * If the timeout is enabled, the registration is taking too long and
 * the participant can ask its deposit back.
 */
Lottery.prototype.timeoutRegistrationLoop = function() {
    var _this = this;

    _this.intervalRegistrationTimeoutLoop = setInterval(function () {

        if (_this.currentState()!=_this.STATE_INIT) {
            clearInterval(_this.intervalRegistrationTimeoutLoop);
        }

        var tx = _this.timeoutRegistration();
        if (tx) {
            utils.watchTransaction(tx, function () {
                clearInterval(_this.intervalTimeoutLoop);
            });
        }
    }, 60000);
};

/**
* Invoke the registration's timeout function of the contract.
*
* @returns {String|Boolean} a string of the transaction id, false otherwise
*/
Lottery.prototype.timeoutRegistration = function() {

    var data = this.lottery.timeoutRegistration.getData();

    var txParam = {
        from: this.playerAddr,
        to: this.lottery.address,
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
        this.log("registration timeout is not enabled yet (it will run out-of-gas)");
        return false;
    }
};

/**
 * Invoke the register function of the contract.
 *
 * @returns {String|Boolean} a string of the transaction id, false otherwise
 */
Lottery.prototype.registerParticipant = function(secrets) {

    var data = this.lottery.register.getData(secrets);

    var txParam = {
        from: this.playerAddr,
        to: this.lottery.address,
        value: this.DEPOSIT,
        gas: conf.gas,
        data: data,
        gasPrice: conf.gasPrice
    };

    var enabled = utils.web3.eth.estimateGas(txParam)<conf.gas;

    if (enabled) {
        utils.web3.personal.unlockAccount(txParam.from, this.password);
        return utils.web3.eth.sendTransaction(txParam);
    }
    else {
        this.log("registration is not enabled (it will run out-of-gas)");
        return false;
    }
};

/**
 * Invoke the refund function of the contract.
 *
 * @returns {String|Boolean} a string of the transaction id, false otherwise
 */
Lottery.prototype.refund = function() {

    var data = this.lottery.refund.getData();

    var txParam = {
        from: this.playerAddr,
        to: this.lottery.address,
        gas: conf.gas,
        data: data,
        gasPrice: conf.gasPrice
    };

    var enabled = utils.web3.eth.estimateGas(txParam)<conf.gas;

    if (enabled) {
        utils.web3.personal.unlockAccount(txParam.from, this.password);
        return utils.web3.eth.sendTransaction(txParam);
    }
    else {
        this.log("refund is not enabled (it will run out-of-gas)");
        return false;
    }
};

/**
 * Invoke the goForward function of the contract.
 *
 * @returns {String|Boolean} a string of the transaction id, false otherwise
 */
Lottery.prototype.goForward = function() {

    var data = this.lottery.goForward.getData();

    var txParam = {
        from: this.playerAddr,
        to: this.lottery.address,
        gas: conf.gas,
        data: data,
        gasPrice: conf.gasPrice
    };

    var enabled = utils.web3.eth.estimateGas(txParam)<conf.gas;

    if (enabled) {
        utils.web3.personal.unlockAccount(txParam.from, this.password);
        return utils.web3.eth.sendTransaction(txParam);
    }
    else {
        this.log("goForward is not enabled (it will run out-of-gas)");
        return false;
    }
};

/**
 * Handle the RegistrationAbortEvent. The event is triggered when a participant
 * invoke the timeout function.
 *
 * @param err
 * @param result
 */
Lottery.prototype.handleRegistrationAbortEvent = function(err,result) {
    if (!err && utils.equalAddresses(result.address, this.lottery.address)) {
        this.log("registration's timeout expired");
        this.stopTimeout();
        this.log("calling refund. Balance: "+utils.web3.eth.getBalance(this.playerAddr));

        var tx = this.refund();
        var _this = this;

        if (tx)
            utils.watchTransaction(tx, function() {
                _this.log("refund done. Balance: "+utils.web3.eth.getBalance(_this.playerAddr));
            });

        this.cleanWatchers();
    }
    else
        this.log("-> Error handling the event.");
};

/**
 * Log facility
 */
Lottery.prototype.log = function(str) {
    console.log("["+this.id+"] "+str);
};

/**
 * Stop the timeout loop
 */
Lottery.prototype.stopTimeout = function() {
    this.log("stopping timeout loop");
    clearInterval(this.intervalTimeoutLoop);
};

/**
 * Stop the watchers to handle events
 */
Lottery.prototype.cleanWatchers = function() {
    this.registrationDoneEvent.stopWatching();
    this.registrationAbortEvent.stopWatching();
};