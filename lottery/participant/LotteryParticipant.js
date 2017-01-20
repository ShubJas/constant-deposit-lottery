/**
 * Created by nicola on 25/11/16.
 */

var utils = require('../../utils/index');
var Lottery = require('./../core/Lottery');


var p = process.argv[2];
var levels = process.argv[3];
var lotteryAddr = process.argv[4];

var playerAddr;
var alias;
var plainSecrets = [];
var salt = 42;

for (var i=0; i<levels; i++) {
    plainSecrets.push(Math.ceil(Math.random()*11));
}

switch (p) {
    case "0":
        playerAddr = "0xb2eda2156386a938f4b008410a4dedbd1a51d5e9";
        alias = "Alice";
        break;

    case "1":
        playerAddr = "0xe2fe120d5bbc9a5af31dd6db5a22f32a055c41ed";
        alias = "Bob";
        break;

    case "2":
        playerAddr = "0x84df6106d39ef3c896bb37be19f9306186263f53";
        alias = "Carl";
        break;

    case "3":
        playerAddr = "0xcc5bdc44926d40c57dda3cef4763c808d3c4470e";
        alias = "Donald";
        break;
}

/*
 * check input
 */
if (!lotteryAddr || !plainSecrets || !playerAddr) {
    console.log("Invalid arguments!");
    process.exit(-1);
}

var lottery = new Lottery(
    utils.lotteryFromAddress(lotteryAddr),
    playerAddr,
    "",
    plainSecrets,
    salt,
    alias
);

// playLoop a match
lottery.register();
