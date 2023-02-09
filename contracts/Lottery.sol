// Objectives:
// 1. Enter the lottery (Paying some amount)
// 2. Pick a random winner(Chainlink Randomness)
// 2. Pick a random winner every x minutes -> completely automated(Chainlink Keeper)
// 3. Chainlink Oracle ->

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/**@title A sample decentralized Lottery Contract, removing all blackboxes
 * @author Guigu @willMusubi
 * @notice This contract is for creating a sample lottery.
 * @dev This implements the Chainlink VRF V2 & Chainlink Automations
 */

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Type Declarations */
    enum LotteryState {
        OPEN,
        CALCULATING
    } // uint256 0 = OPEN, uint256 1 = CALCULATING

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players; // we need to add payable to pay the winner later
    VRFCoordinatorV2Interface private i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /* Lottery Variables */
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_timeInterval;

    /* Events */
    event LotteryEnter(address indexed player);
    event WinnerRequested(uint256 indexed requestId);
    event WinnerPicked(address indexed player);

    /* Functions */
    constructor(
        address vrfCoordinatorV2, // contract, we may need to deploy a mock for this
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 timeInterval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        // vrfCoordinatorV2 does the random number verification
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        i_timeInterval = timeInterval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughETHEntered();
        }
        s_players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open. // we don't want people join we are requesting the random number
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     * We can triggert the Chainlink keepers if all the above conditions are met
     */
    function checkUpkeep(
        bytes memory /* checkData */ // our own smartcontract can also call it to validate. Also, calldata does not work with strings, so we need to make the bytes memory instead
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        // its a bytes object so we can do anything we want, even specify checkData to call other functions

        // block.timestamp - last block timestamp
        bool isOpen = s_lotteryState == LotteryState.OPEN;
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_timeInterval;
        bool hasETH = address(this).balance > 0;
        bool hasPlayers = s_players.length > 0;
        // check overall conditions to see if upKeep is needed.
        upkeepNeeded = (isOpen && timePassed && hasETH && hasPlayers);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @dev Once `checkUpkeep` is returning `true`, this function is called
     * and it kicks off a Chainlink VRF call to get a random winner.
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        // eqiavalent to performUkeep()
        // Will revert if subscription is not set and funded.
        (bool upkeepNeeded, ) = checkUpkeep(""); // calldata does not work with strings, so we need to make the bytes memory instead
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }

        s_lotteryState = LotteryState.CALCULATING; // nobody can enter when we start requesting the random number
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // GasLane: max gas you are willing to pay in wei. Sometimes the gas might skyrocketing, but it's still calling the random numbers, we can use this keyhash to avoid such situation.
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit WinnerRequested(requestId);
    }

    /* Will be called by Chainlink Keeper*/

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[winnerIndex]; // temp varaible saves gas instead of directly calling storage variable s_recentWinner
        s_recentWinner = recentWinner;
        // Resettnng Work
        s_lotteryState = LotteryState.OPEN; // It's safe to open the next round after the winner is confirmed
        s_players = new address payable[](0); // Reset the player list
        s_lastTimeStamp = block.timestamp; // Reset the timestamp
        // Check if it's successfully sending the reward to the winner.
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner); // to record the winner
    }

    // Getters
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getNumPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getNumWords() public pure returns (uint256) {
        // since the NUM_WORDS is a constant variable, it's in the bytecode and technically is not read from storage, so we can use pure instead of view.
        return NUM_WORDS;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }
}
