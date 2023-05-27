require("@nomicfoundation/hardhat-toolbox");

require('dotenv').config({ path: __dirname + '/.env' });
const MAINNET_FORK_BLOCK_NUMBER = 17348155;

module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET,
        blockNumber: MAINNET_FORK_BLOCK_NUMBER
      },
    },
  }
};
