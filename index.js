#!/usr/bin/env node --harmony

const co = require('co');
const prompt = require('co-prompt');
const program = require('commander');
const LotteryCreator = require('./lottery/monitor/LotteryCreatorAndMonitor');
const LotteryParticipant = require('./lottery/participant/LotteryParticipant');

program
    .command('start')
    .description('start a new lottery')
    .action(function () {
        co(function *() {
            const levels = yield prompt('levels: ');
            const deposit = yield prompt('deposit: ');
            new LotteryCreator(levels, deposit).create();
        });
    });

program
    .command('player')
    .action(function () {
        co(function *() {
            const levels = yield prompt('levels: ');
            const id = yield prompt('ID: ');
            const lotteryAddr = yield prompt('Lottery address: ');
            new LotteryParticipant(id, levels, lotteryAddr).play();
        });
    });

program.parse(process.argv);


