/**
 * Created by nicola on 25/11/16.
 */

var utils = require('../../utils/index');
var Match = require('./../core/Match');

var playerSecret = process.argv[2];
var salt = process.argv[3];
var playerAddr = process.argv[4];
var matchAddr = process.argv[5];

/*
 * check input
 */
if (!matchAddr || !playerSecret || !playerAddr) {
    console.log("Invalid arguments!");
    printUsage();
    process.exit(-1);
}

function printUsage() {
    console.log('Usage: \n\t'+process.argv[0]+" MatchParticipant.js <match-addr> <secret> <player-addr> [<password>]");
    console.log('\n\t- if <password> is omitted, an empty password will be used\n');
}

/*
 * create a new Match with the given parameters
 */
var match = new Match(
    utils.matchFromAddress(matchAddr),
    playerAddr,
    playerSecret,
    salt
);

// playLoop a match
match.playAMatch(function () {
    console.log("Match finished.");
});