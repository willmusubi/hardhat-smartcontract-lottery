const { ethers, network } = require("hardhat");
const fs = require("fs");

const {
    frontEndAddressFile,
    frontEndAbiFile,
} = require("../helper-hardhat-config");

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating frontend...");
        await updateContractAddresses();
        await updateAbi();
        console.log("Frontend Updated!");
    }
};

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery");
    fs.writeFileSync(
        frontEndAbiFile,
        lottery.interface.format(ethers.utils.FormatTypes.json)
    );
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery");
    const chainId = network.config.chainId.toString();
    const contractAddresses = JSON.parse(
        fs.readFileSync(frontEndAddressFile, "utf8")
    );
    const currentAddress = lottery.address;
    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId].includes(currentAddress)) {
            contractAddresses[chainId].push(currentAddress);
        }
    } else {
        contractAddresses[chainId] = [currentAddress];
    }
    fs.writeFileSync(frontEndAddressFile, JSON.stringify(contractAddresses));
}

module.exports.tags = ["all", "frontend"];
