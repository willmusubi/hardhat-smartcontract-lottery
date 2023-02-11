const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = "250000000000000000"; // 0.25 is the premium, it costs 0.25 link
const GAS_PRICE_LINK = 1e9; // Link per gas. calcuated value based on the gas price of the chain, chainlink afford expenses of for calling other external calls onchain.

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts(); // grab an account from the accounts we specified in the hardhat.config.js file.
    const chainId = network.config.chainId;

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // deploy a mock vrfcoordinator...
        /* 
        The mock's constructor takes 2 paramenters, we are going to pass these two as args
        constructor(uint96 _baseFee, uint96 _gasPriceLink) {
            BASE_FEE = _baseFee;  // which is the premium(oracle fee) on the chainlink documentation, which is on the chainlink documentation 
            GAS_PRICE_LINK = _gasPriceLink;  
        }
        */
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        });
        log("Mocks Deployed!");
        log("-------------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
