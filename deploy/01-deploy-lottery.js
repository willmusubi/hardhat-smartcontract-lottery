const { network, ethers } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("1"); // 1 Ether, or 1e18 (10^18) Wei

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    // address vrfCoordinatorV2, contract, we may need to deploy a mock for this
    // uint256 entranceFee, we may require different address from different chains
    // bytes32 gasLane, choose the gaslane from the documentation
    // uint64 subscriptionId, get the id from the transaction event for the local testing, get it from UI for the network
    // uint32 callbackGasLimit, varies from network to network
    // uint256 timeInterval
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;
    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address; // the mocks we deployed
        // subscription is emmited within an event ommited from Mocking contract transaction receipt, so we need to get a receipt here
        const txResponse = await vrfCoordinatorV2Mock.createSubscription();
        const txReceipt = await txResponse.wait(1);
        subscriptionId = txReceipt.events[0].args.subId;
        // Fund the subscription, we don't need link token for local hardhat test
        await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            VRF_SUB_FUND_AMOUNT
        );
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["VRFCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
        // for the testnet, we can get subscription id directly from the UI and import it from helper-hardhat-config.js
    }
    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    timeInterval = networkConfig[chainId]["timeInterval"];

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        timeInterval,
    ];

    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
    }

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(lottery.address, args);
    }
    log("-----------------------------------------------------");
};

module.exports.tags = ["all", "lottery"];
