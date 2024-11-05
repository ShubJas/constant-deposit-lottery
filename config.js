var config = {};

// Use the local Ganache instance as the HTTP provider
config.httpProvider = "http://127.0.0.1:8545";

// Set gas limits and gas price
config.gas = 4700000;
config.gasPrice = 500000000000;

// Advertiser account setup
config.advertiser = {};
config.advertiser.address = "0x79CD4971ac989408B8Bbe395578E2C01363F3724"; // Update with the Ganache account address if needed
config.advertiser.password = "";  // If a password is required, add it here (Ganache usually doesn’t require one)

// Player accounts setup
config.players = [
    {
        alias : "Shuaib",
        address : "0x44d30D4CE2C78421f072b71ec3A4bA7a695b4a80",
        password : "",
        salt : 1
    },
    {
        alias: "Jaheer",
        address: "0x95b37674a1c35070e6AE63C10F6aCBaa040767C6",
        password: "",
        salt: 2
    },
    {
        alias: "Dishad",
        address: "0x75A971D0AAc8863caBD0d8bB0280030c126db61C",
        password: "",
        salt: 3
    },
    {
        alias: "Fahim",
        address: "0x64E7e01751ccF270832eD24DbF70978d50Cb261B",
        password: "",
        salt: 4
    }
];




// Export the configuration
module.exports = config;
