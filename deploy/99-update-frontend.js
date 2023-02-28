const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONT_END_ADDRESSES_FILE =
    "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating frontend...");
        updateContractAddresses();
        updateAbi();
    }
};

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery");
    fs.writeFileSync(
        FRONT_END_ABI_FILE,
        lottery.interface.format(ethers.utils.FormatTypes.json)
    );
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery");
    const chainId = network.config.chainId.toString();
    const contractAddresses = JSON.parse(
        fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8")
    );
    const currentAddress = lottery.address;
    if (
        chainId in contractAddresses &&
        !contractAddresses[chainId].includes(currentAddress)
    ) {
        contractAddresses[chainId].push(currentAddress);
    } else {
        contractAddresses[chainId] = currentAddress;
    }
    fs.writeFileSync(
        FRONT_END_ADDRESSES_FILE,
        JSON.stringify(contractAddresses)
    );
}

module.exports.tags = ["all", "frontend"];
