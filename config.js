
var config = {};

// config.httpProvider = "http://localhost:8545";
config.httpProvider = "http://bigshow.duckdns.org:8545";
config.gas = 4700000;
config.gasPrice = 500000000000;
config.advertiser = {};
config.advertiser.address = "0x93471f8bc99114CCf0f9c1e84349c9be390b73E8";
config.advertiser.password = "";
config.players = [];
config.players[0] = {
    alias : "Alice",
    address : "0xb2eda2156386a938f4b008410a4dedbd1a51d5e9",
    password : "",
    salt : 1
};
config.players[1] = {
    alias: "Bob",
    address: "0xe2fe120d5bbc9a5af31dd6db5a22f32a055c41ed",
    password: "",
    salt: 2
};
config.players[2] = {
    alias: "Carl",
    address: "0x84df6106d39ef3c896bb37be19f9306186263f53",
    password: "",
    salt: 3
};
config.players[3] = {
    alias: "Donald",
    address: "0xcc5bdc44926d40c57dda3cef4763c808d3c4470e",
    password: "",
    salt: 4
};

module.exports = config;