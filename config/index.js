/*
 * configuration module
 */

module.exports = {

    logLevel: "info",

    gas: 4700000,
    gasPrice: 500000000000,

    httpProvider: {
        local: "http://localhost:8545",
        remote: "http://bigshow.duckdns.org:8545"
    },

    addresses: {
        Nicola: "0x93471f8bc99114CCf0f9c1e84349c9be390b73E8",
        Jansson: "0x836b9a551dE259e19a9d28da4feE87fec4254256"
    },

    match: {
        X_TIMEOUT: 5 * 60,
        Y_TIMEOUT: 5 * 60
    }
}