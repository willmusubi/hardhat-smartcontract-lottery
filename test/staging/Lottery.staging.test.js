const { developmentChains } = require("../../helper-hardhat-config");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, lotteryEntranceFee, deployer;
          // don't need mock any more for staging test
          // don't need to use fixtures because we suppose we have run the deploy scripts and deployed the contract

          // deploy the contracts
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              lottery = await ethers.getContract("Lottery", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  console.log("Setting up test...");
                  const startTimeStamp = await lottery.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event found.");
                          try {
                              // add asserts after lottery winner picked
                              const recentWinner =
                                  await lottery.getRecentWinner();
                              console.log(`Found the Winner ${recentWinner}`); // We can find the winner, then we can use it to get winnerStartBalance for testing
                              const lotteryState =
                                  await lottery.getLotteryState();
                              const endTimeStamp =
                                  await lottery.getLatestTimeStamp();
                              const numPlayers = await lottery.getNumPlayers();
                              const winnerEndBalance =
                                  await accounts[0].getBalance();

                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address
                              );
                              assert.equal(lotteryState.toString(), "0");
                              assert.equal(numPlayers.toString(), "0");
                              assert(endTimeStamp > startTimeStamp);
                              assert.equal(
                                  winnerEndBalance.toString(),
                                  winnerStartBalance.add(
                                      lotteryEntranceFee.toString()
                                  )
                              );
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      // Enter the Lottery after Listener set up
                      console.log("Entering Lottery...");
                      const txResponse = await lottery.enterLottery({
                          value: lotteryEntranceFee,
                      });
                      await txResponse.wait(1);
                      console.log("Waiting for Winner Picked Up");
                      const winnerStartBalance = await accounts[0].getBalance();

                      // This code won't complete until our listener has finished listening
                  });
              });
          });
      });
