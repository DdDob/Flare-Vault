// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Consumer} from "./FtsoV2Consumer.sol";

/// @title PortfolioVault
/// @notice Flare Vault's core contract. Each user records holdings of FTSO-tracked
///         assets (wrapped/bridged via FAssets, e.g. FXRP, or native FLR). Only the
///         owner of a position can read the underlying amounts; anyone can verify a
///         position *exists* and *was valued*, without learning what's inside it.
///
/// @dev Privacy model for the hackathon submission:
///      - On-chain: only a commitment (hash) of each user's holdings is stored, plus
///        a public "last valued at" timestamp. This is real and enforceable today.
///      - True confidential *computation* (calculating USD value from raw holdings
///        without ever revealing raw holdings to anyone, including this contract)
///        is delegated to a Flare Compute Extension (FCC/TEE) - see
///        contracts/fcc-extension/PortfolioInstructionSender.sol and
///        extension-go/ for that piece. This contract is the "public ledger" half;
///        the FCC extension is the "private compute" half.
contract PortfolioVault {
    FtsoV2Consumer public immutable priceOracle;

    struct Position {
        bytes32 holdingsCommitment; // keccak256(abi.encode(assets[], amounts[], salt))
        uint64 lastValuedAt;
        bool exists;
    }

    /// @notice user => their committed position
    mapping(address => Position) private positions;

    /// @notice user => (approved viewer => can view raw valuation result off-chain)
    mapping(address => mapping(address => bool)) public viewerApprovals;

    event PositionCommitted(address indexed user, bytes32 commitment, uint64 timestamp);
    event ViewerApprovalChanged(address indexed user, address indexed viewer, bool approved);

    constructor(address _ftsoConsumer) {
        priceOracle = FtsoV2Consumer(_ftsoConsumer);
    }

    /// @notice Commit to a new set of holdings without revealing them on-chain.
    /// @param commitment keccak256 hash of (asset feed IDs, amounts, a random salt)
    ///        computed client-side. Recompute and compare to verify later off-chain.
    function commitPosition(bytes32 commitment) external {
        positions[msg.sender] = Position({
            holdingsCommitment: commitment,
            lastValuedAt: uint64(block.timestamp),
            exists: true
        });
        emit PositionCommitted(msg.sender, commitment, uint64(block.timestamp));
    }

    /// @notice Grant or revoke another address (e.g. a judge's demo wallet, or the
    ///         FCC extension's result-signing key) permission to view your decrypted
    ///         valuation off-chain. This does not expose anything on-chain.
    function setViewerApproval(address viewer, bool approved) external {
        viewerApprovals[msg.sender][viewer] = approved;
        emit ViewerApprovalChanged(msg.sender, viewer, approved);
    }

    /// @notice Anyone can confirm a position exists and when it was last valued -
    ///         without learning any asset amounts.
    function hasPosition(address user) external view returns (bool exists, uint64 lastValuedAt) {
        Position memory p = positions[user];
        return (p.exists, p.lastValuedAt);
    }

    /// @notice Verify a locally-known set of holdings still matches the on-chain
    ///         commitment (used by the user's own frontend to confirm integrity).
    function verifyCommitment(address user, bytes32 candidateCommitment) external view returns (bool) {
        return positions[user].holdingsCommitment == candidateCommitment;
    }

    /// @notice Convenience read-through to the price oracle so the frontend only
    ///         needs one contract address for the public demo view.
    function getAllPrices()
        external
        view
        returns (uint256[] memory values, int8[] memory decimals, uint64 timestamp)
    {
        return priceOracle.getAllPrices();
    }
}
