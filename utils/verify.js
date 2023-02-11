const { run } = require("hardhat");

async function verify(address, args) {
    console.log("Verifying Contract...");

    try {
        await run("verify:verify", {
            address: address,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified");
        } else {
            console.log(e);
        }
    }
}
