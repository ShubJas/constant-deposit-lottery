/**
 * Created by nicola on 25/11/16.
 */

module.exports = LotteryParticipant;

const conf = require('../../config');
const utils = require('../../utils/index');
const Lottery = require('./../core/Lottery');

function LotteryParticipant(id, levels, lotteryAddr) {

    this.levels = levels;
    this.lotteryContract =  utils.lotteryFromAddress(lotteryAddr);
    this.playerAddr =       conf.players[id].address;
    this.alias =            conf.players[id].alias;
    this.password =         conf.players[id].password;
    this.salt =             conf.players[id].salt;

    // secrets are generated randomly
    this.plainSecrets =  [];
    for (let i=0; i<levels; i++) {
        this.plainSecrets.push(Math.ceil(Math.random()*11));
    }
}

LotteryParticipant.prototype.play = function() {

    const lottery = new Lottery(
        this.lotteryContract,
        this.playerAddr,
        this.password,
        this.plainSecrets,
        this.salt,
        this.alias
    );

    // play a match
    lottery.registerAndPlay();
};



