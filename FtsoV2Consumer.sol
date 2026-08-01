// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/// @title FtsoV2Consumer
/// @notice Reads live FTSOv2 price feeds for the assets tracked by Flare Vault.
/// @dev Uses TestFtsoV2Interface (view-only, free) for local/testnet iteration.
///      Swap to FtsoV2Interface (payable, production) before mainnet deployment -
///      see the commented production path below each function.
contract FtsoV2Consumer {
    // Feed IDs - see https://dev.flare.network/ftso/feeds for the full, current list.
    bytes21 public constant FLR_USD = 0x01464c522f55534400000000000000000000000000;
    bytes21 public constant BTC_USD = 0x014254432f55534400000000000000000000000000;
    bytes21 public constant ETH_USD = 0x014554482f55534400000000000000000000000000;
    bytes21 public constant XRP_USD = 0x015852502f55534400000000000000000000000000;

    /// @notice All feeds this vault tracks, in a fixed, stable order.
    function trackedFeedIds() public pure returns (bytes21[] memory ids) {
        ids = new bytes21[](4);
        ids[0] = FLR_USD;
        ids[1] = BTC_USD;
        ids[2] = ETH_USD;
        ids[3] = XRP_USD;
    }

    /// @notice Returns the latest USD price for a single feed.
    /// @return value Integer price value (divide by 10**decimals for the float price).
    /// @return decimals Decimal precision of `value`.
    /// @return timestamp Unix timestamp the price was last updated.
    function getPrice(bytes21 feedId)
        public
        view
        returns (uint256 value, int8 decimals, uint64 timestamp)
    {
        // TESTNET / DEV: free, view-only reads.
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedById(feedId);

        // PRODUCTION (mainnet): uncomment and remove the two lines above.
        // FtsoV2Interface ftsoV2 = ContractRegistry.getFtsoV2();
        // return ftsoV2.getFeedById(feedId);
    }

    /// @notice Returns all tracked prices in one call, in the same order as trackedFeedIds().
    function getAllPrices()
        external
        view
        returns (uint256[] memory values, int8[] memory decimals, uint64 timestamp)
    {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedsById(trackedFeedIds());
    }
}
