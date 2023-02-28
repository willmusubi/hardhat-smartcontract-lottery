const { ethers } = require("hardhat");

const networkConfig = {
    5: {
        name: "goerli",
        vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "9629", // get it from the Chainlink Subscription Account
        callbackGasLimit: "500000", // fake it for now
        timeInterval: "30", // 30 seconds
    },
    31337: {
        name: "hardhat",
        // No vrfCoordinatorV2 is needed because we deploy mocks for the test
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // hardhat doesn't care about it, we can just use the goerli's one instead
        callbackGasLimit: "500000", // fake it for now
        timeInterval: "30", // 30 seconds
    },
};

const developmentChains = ["hardhat", "localhost"];
const frontEndAddressFile =
    "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const frontEndAbiFile = "../nextjs-smartcontract-lottery/constants/abi.json";

module.exports = {
    networkConfig,
    developmentChains,
    frontEndAddressFile,
    frontEndAbiFile,
};
