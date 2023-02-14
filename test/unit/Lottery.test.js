const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          // contracs we need to deploy
          let lottery,
              vrfCoordinatorV2Mock,
              lotteryEntranceFee,
              deployer,
              timeInterval;
          const chainId = network.config.chainId;
          // deploy the contracts
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              lottery = await ethers.getContract("Lottery", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              lotteryEntranceFee = await lottery.getEntranceFee();
              timeInterval = await lottery.getTimeInterval();
          });
          // test constructor
          describe("constructor", function () {
              // ideally 1 describe() includes 1 it()
              it("Initializes the lottery correctly", async function () {
                  const lotteryState = await lottery.getLotteryState();
                  assert.equal(lotteryState.toString(), "0"); // When the lottery get initialized, it should be Open, which is 0 as Enum
                  assert.equal(
                      timeInterval.toString(),
                      networkConfig[chainId]["timeInterval"]
                  );
              });
          });

          describe("enterLottery", function () {
              it("Fails if you don't send minimum required ETH", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughETHEntered"
                  );
              });

              it("Adds the player entered to players array", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  const playerEntered = await lottery.getPlayer(0);
                  assert.equal(playerEntered, deployer);
              });
              // Test Events
              it("emits the event when player entered", async function () {
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.emit(lottery, "LotteryEnter");
              });

              // Since lottery closed status only happens when performs performUpkeep(), and it's triggered by receiving true signal upkeepNeeded from the checkUpkeep(). So we can pretends to be Chainlink Network and return true from checkUpkeep.
              it("Fails if the lottry is not open", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  // increase the time to make sure the checkUpkeep() return true
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []); // mine 1 block
                  // So isOpen && timePassed && hasETH && hasPlayers conditions are met, the checkUpkeep() can be pretendly triggered
                  await lottery.performUpkeep([]);
                  // Now, the status of lottery should be CALCUALTING now and it should revert
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWith("Lottery__NotOpen");
              });
          });

          // make sure if conditons isOpen && timePassed && hasETH && hasPlayers is not met, the upKeepNeeded should be false
          // We don't want to actually send a transaction, so we don't call raffle.checkUpkeep([]) directly, instead, we simulate the transaction call static.
          describe("checkUpkeep", function () {
              it("returns false if the contract has no balance", async function () {
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(
                      []
                  );
                  assert(!upkeepNeeded);
              });

              it("returns false if the contract is not open", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  // increase the time to make sure the checkUpkeep() return true
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []); // mine 1 block
                  await lottery.performUpkeep([]);
                  //  await lottery.performUpkeep("0x"); Also can use this line to send a blank bytes object.

                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(
                      []
                  );
                  assert.equal(
                      (await lottery.getLotteryState()).toString(),
                      "1"
                  );
                  assert(!upkeepNeeded);
              });
              it("returns false if time hasn't passed the time interval", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() - 5,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(
                      []
                  );
                  assert(!upkeepNeeded);
              });
              it("returns true if all conditions are met isOpen && timePassed && hasETH && hasPlayers", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(
                      []
                  );
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("reverts if upKeepNeeded returned by checkUpkeep is false", async function () {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      "Lottery__UpkeepNeeded"
                  );
              });

              it("performs if upKeepNeeded returned by checkUpkeep is true", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const tx = await lottery.performUpkeep([]);
                  assert(tx);
              });

              it("updates the lottery state, emits the events, call the vrfCoordinator", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);

                  const txReponse = await lottery.performUpkeep([]);
                  await expect(txReponse).to.emit(lottery, "WinnerRequested");
                  const txReceipt = await txReponse.wait(1);
                  const requestId = txReceipt.events[1].args.requestId; // requestRandomWords will also emit an event, and it will be at the place of 0. So it's events at index 0 here.
                  const lotteryState = await lottery.getLotteryState();
                  assert(requestId.toNumber() > 0);
                  assert(lotteryState.toString() == "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      timeInterval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  // which means the reuqestId is ready. After we check the VRFCoordinatorV2Mock code,
                  // if the requestId is invalid, it will revert("nonexistent request")
                  // consumer address is the lottery address

                  // function fulfillRandomWordsWithOverride(
                  //     uint256 _requestId,
                  //     address _consumer,
                  //     uint256[] memory _words
                  //   ) public {
                  //     uint256 startGas = gasleft();
                  //     if (s_requests[_requestId].subId == 0) {
                  //       revert("nonexistent request");
                  //     }
                  // ...

                  // fuzz testing might be used, we just keep the process simple here.
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          0,
                          lottery.address
                      )
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          1,
                          lottery.address
                      )
                  ).to.be.revertedWith("nonexistent request");
              });
              // Massive Promise Testing
              it("picks a winner, resets, and sends money", async () => {
                  // Set up additional players and let them participate in the lottery
                  const additionalPlayers = 5;
                  const startIndex = 2; // deployer: 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startIndex;
                      i < startIndex + additionalPlayers;
                      i++
                  ) {
                      console.log(`account ${i}, ${accounts[i].address}`);
                      const accountConnectedLottery = await lottery.connect(
                          accounts[i]
                      );
                      await accountConnectedLottery.enterLottery({
                          value: lotteryEntranceFee,
                      });
                  }

                  // 1. checkUpkeep() @chainlinkAutomation returns upkeepNeeded
                  // 2. upkeepNeeded is true, triggers performUpkeep() @chainlinkAutomation
                  // 3. performUpkeep() @chainlinkAutomation will triger call requestRandomWords() @chainlinkVRF
                  // 4. vrfCoordinator will trigger the fulfillRandomWords() @chainlinkVRF

                  // We have to wait the fulfillRandomWords() to be called on the testnet,
                  // We don't have to wait for the process in the hardhat local chain.
                  // But we still need to simulate the calling process by setting up a listener
                  // it's crucial for staging test.
                  // We need to set up the listener at the beginning, so it starts waiting until its Promise get resovled or rejceted.
                  const startTimeStamp = await lottery.getLatestTimeStamp();
                  await new Promise(async (resolve, reject) => {
                      // Set up the listener.
                      lottery.once("WinnerPicked", async () => {
                          // once the WinnerPicked is emmited from the below parts
                          console.log("Found the Event");
                          try {
                              const recentWinner =
                                  await lottery.getRecentWinner();
                              console.log(`Found the Winner ${recentWinner}`); // We can find the winner, then we can use it to get winnerStartBalance for testing
                              const lotteryState =
                                  await lottery.getLotteryState();
                              const endTimeStamp =
                                  await lottery.getLatestTimeStamp();
                              const numPlayers = await lottery.getNumPlayers();
                              const winnerEndBalance =
                                  await ethers.provider.getBalance(
                                      recentWinner
                                  );
                              assert.equal(
                                  lotteryState.toString(),
                                  "0",
                                  "Lottery state is not reset"
                              ); // it will be reset to OPEN status
                              assert.equal(
                                  numPlayers.toString(),
                                  "0",
                                  "Player list is not reset"
                              );
                              assert(
                                  endTimeStamp > startTimeStamp + timeInterval,
                                  "Timestamp has issues"
                              );
                              assert.equal(
                                  winnerEndBalance.toString(),
                                  winnerStartBalance.add(
                                      lotteryEntranceFee
                                          .mul(additionalPlayers)
                                          .add(lotteryEntranceFee)
                                          .toString()
                                  )
                              );
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      // For the staging test, we won't have any of the code below since the chainlink will operate instead of mocking form us.
                      // We just need to listen the event on the real test network
                      const txResponse = await lottery.performUpkeep([]); // mocking the chainlinkAutomation
                      const txReceipt = await txResponse.wait(1);
                      const winnerStartBalance = await accounts[6].getBalance(); // we know the winner ahead by printing the winner and the accounts in for loop after run once. It execute right before we update the winner balance.
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          // mocking the vrfCoordinator, this will emit the event that our promise listens
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      );
                  });
              });
          });
      });
