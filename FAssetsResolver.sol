// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";

/// @title FAssetsResolver
/// @notice Resolves the live FXRP AssetManager address via Flare's official
///         ContractRegistry, exactly as Flare's own developer docs specify -
///         the address is never hardcoded, since it can change between
///         deployments. See: https://dev.flare.network/fassets/developer-guides/fassets-asset-manager-address-contracts-registry
///
/// @dev This contract intentionally only wraps read functions with simple,
///      unambiguous return types (address, uint256). The full FAssets minting
///      flow (reserveCollateral -> XRP payment on XRPL -> FDC proof ->
///      executeMinting) involves an off-chain XRP Ledger payment and a proof
///      issued by Flare's Data Connector, which requires a verifier API key
///      only Flare can issue - so that last leg cannot be completed from a
///      browser demo alone. `reserveCollateral` itself, however, is a real,
///      fully on-chain, unrestricted first step - and the frontend calls it
///      directly against the resolved AssetManager address.
contract FAssetsResolver {
    /// @notice Returns the current, live FXRP AssetManager address.
    function getAssetManagerAddress() external view returns (address) {
        return address(ContractRegistry.getAssetManagerFXRP());
    }

    /// @notice Returns just the total number of available (mintable-against) agents.
    /// @dev Calls getAvailableAgentsList(0, 0) - an empty slice - so only the
    ///      cheap `_totalLength` return value is used; no agent array is decoded here.
    function getAvailableAgentCount() external view returns (uint256 totalLength) {
        IAssetManager am = ContractRegistry.getAssetManagerFXRP();
        (, totalLength) = am.getAvailableAgentsList(0, 0);
    }

    /// @notice Returns the native-token (C2FLR) fee required to reserve collateral
    ///         for minting the given number of lots - a real, live, on-chain fee.
    function getCollateralReservationFee(uint256 lots) external view returns (uint256) {
        IAssetManager am = ContractRegistry.getAssetManagerFXRP();
        return am.collateralReservationFee(lots);
    }
}
