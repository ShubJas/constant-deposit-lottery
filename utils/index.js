const conf = require('../config');
const Web3 = require('web3');
const leftPad = require('left-pad');
const fs = require('fs');
const winston = require('winston');
const dateFormat = require('dateformat');
const path = require('path');
const { keccak256 } = require('js-sha3'); // Import keccak256 from js-sha3

// Set up the web3 provider
const web3 = new Web3(new Web3.providers.HttpProvider(conf.httpProvider));

let cachedCompiledContracts = null;

module.exports = {
    web3: web3,
    waitForTransactionToBePublished: waitForTransactionToBePublished,
    watchTransaction: watchTransaction,
    matchFromAddress: matchFromAddress,
    lotteryFromAddress: lotteryFromAddress,
    equalAddresses: equalAddresses,
    sha3uint256: function(n, salt) {
        const toHex = (num) => num.toString(16).padStart(64, '0');
        const data = toHex(n) + toHex(salt);
        return "0x" + keccak256(Buffer.from(data, 'hex')); // Use js-sha3's keccak256
    },
    compiledContracts: function() {
        return loadCompiledContracts();
    },
    logger: function(name) {
        return createLogger(name);
    }
};

// Function to wait until a transaction is published
function waitForTransactionToBePublished(tx, callback, silent = false) {
    if (!silent) {
        console.log(`...waiting to publish tx: https://testnet.etherscan.io/tx/${tx}`);
    }

    let interval;
    if (!silent) {
        interval = setInterval(() => {
            console.log(`...waiting to publish tx: ${tx}`);
        }, 10000);
    }

    (async function loop() {
        const receipt = await web3.eth.getTransactionReceipt(tx);
        if (receipt === null) {
            setTimeout(loop, conf.utils.poolingWait);
        } else {
            clearInterval(interval);
            if (!silent) {
                console.log(`tx published: ${tx}`);
            }
            if (callback) {
                callback(receipt);
            }
        }
    })();
}

// Function to check if two addresses are equal
function equalAddresses(a, b) {
    return a.toUpperCase() === b.toUpperCase();
}

// Load and cache compiled contract ABIs and bytecode
function loadCompiledContracts() {
    if (cachedCompiledContracts) return cachedCompiledContracts;

    try {
        console.log("Loading compiled contracts from ABI and bytecode files...");

        // Adjusted paths to align with Truffle's default output directory
        const lotteryData = JSON.parse(fs.readFileSync(path.join(__dirname, "../build/contracts/Lottery.json"), "utf8"));
        const matchData = JSON.parse(fs.readFileSync(path.join(__dirname, "../build/contracts/Match.json"), "utf8"));

        cachedCompiledContracts = {
            Lottery: {
                abi: lotteryData.abi,
                bytecode: lotteryData.bytecode,
            },
            Match: {
                abi: matchData.abi,
                bytecode: matchData.bytecode,
            }
        };

        return cachedCompiledContracts;
    } catch (err) {
        console.error("Error loading ABI or bytecode:", err);
        throw new Error("Compilation files not found or could not be read.");
    }
}

// Retrieve the Match contract instance at a specific address
function matchFromAddress(addr) {
    const contracts = loadCompiledContracts();
    if (!contracts["Match"]) {
        throw new Error("Match contract not found!");
    }
    return web3.eth.contract(contracts["Match"].abi).at(addr);  // Using .contract for older web3 versions
}

// Retrieve the Lottery contract instance at a specific address
function lotteryFromAddress(addr) {
    const contracts = loadCompiledContracts();
    if (!contracts["Lottery"]) {
        throw new Error("Lottery contract not found!");
    }
    return web3.eth.contract(contracts["Lottery"].abi).at(addr);  // Using .contract for older web3 versions
}

// Watch for transaction confirmation
function watchTransaction(tx, callback) {
    // Poll for transaction receipt every few seconds
    const interval = setInterval(async () => {
        try {
            const txReceipt = await web3.eth.getTransactionReceipt(tx);
            if (txReceipt && txReceipt.blockHash) {
                clearInterval(interval);
                if (callback) callback(txReceipt);
            }
        } catch (error) {
            console.error("Error watching transaction:", error);
            clearInterval(interval);
        }
    }, 3000); // Polling interval (3 seconds)
}


// Helper function to create a logger with Winston
function createLogger(name) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                timestamp: () => dateFormat(Date.now(), "isoTime"),
                format: winston.format.printf(({ level, message, timestamp }) => {
                    return `[${name}] ${timestamp} - ${level}: ${message}`;
                })
            })
        ],
        level: conf.logLevel
    });
}
