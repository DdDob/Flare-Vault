// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title InheritanceVault
/// @notice A "digital dead man's switch." An owner names a beneficiary and
///         checks in periodically to prove they're still active. If they
///         stop checking in past their chosen interval, the named
///         beneficiary can claim the vault - unlocking whatever
///         instructions/message the owner attached.
///
/// @dev Privacy note: `instructionsHash` is a commitment (e.g. keccak256 of
///      an AES-GCM-encrypted message blob), not the message itself. The
///      actual encrypted blob is generated and stored client-side (see the
///      app's "Inheritance Vault" tab, which uses the browser's native
///      Web Crypto API for real AES-256-GCM encryption) and shared with the
///      beneficiary out-of-band. Only its hash lives on-chain, so a claim
///      can be checked against it without ever exposing the message
///      publicly. Routing the encryption itself through a Flare Confidential
///      Compute enclave - so no party, including the app - ever handles the
///      plaintext key - is the intended end state; this contract is the
///      real, working "public ledger" half of that design today.
contract InheritanceVault {
    struct Vault {
        address owner;
        address beneficiary;
        bytes32 instructionsHash;
        uint64 lastCheckIn;
        uint64 checkInIntervalSeconds;
        bool claimed;
        bool exists;
    }

    mapping(address => Vault) private vaults;

    event VaultCreated(address indexed owner, address indexed beneficiary, uint64 checkInIntervalSeconds, bytes32 instructionsHash);
    event CheckedIn(address indexed owner, uint64 timestamp);
    event BeneficiaryUpdated(address indexed owner, address indexed newBeneficiary);
    event VaultClaimed(address indexed owner, address indexed beneficiary, uint64 timestamp);

    /// @notice Create (or overwrite) your vault.
    /// @param beneficiary Who can claim this vault if you stop checking in.
    /// @param checkInIntervalSeconds How long you can go without checking in before it unlocks. Minimum 1 hour.
    /// @param instructionsHash keccak256 of your encrypted message/instructions blob (computed client-side).
    function createVault(address beneficiary, uint64 checkInIntervalSeconds, bytes32 instructionsHash) external {
        require(beneficiary != address(0), "Beneficiary required");
        require(beneficiary != msg.sender, "Beneficiary must differ from owner");
        require(checkInIntervalSeconds >= 1 hours, "Interval too short (min 1 hour)");
        vaults[msg.sender] = Vault({
            owner: msg.sender,
            beneficiary: beneficiary,
            instructionsHash: instructionsHash,
            lastCheckIn: uint64(block.timestamp),
            checkInIntervalSeconds: checkInIntervalSeconds,
            claimed: false,
            exists: true
        });
        emit VaultCreated(msg.sender, beneficiary, checkInIntervalSeconds, instructionsHash);
    }

    /// @notice Prove you're still active. Resets the countdown.
    function checkIn() external {
        Vault storage v = vaults[msg.sender];
        require(v.exists, "No vault");
        require(!v.claimed, "Already claimed");
        v.lastCheckIn = uint64(block.timestamp);
        emit CheckedIn(msg.sender, v.lastCheckIn);
    }

    /// @notice Change who your beneficiary is, any time before a claim.
    function updateBeneficiary(address newBeneficiary) external {
        Vault storage v = vaults[msg.sender];
        require(v.exists, "No vault");
        require(!v.claimed, "Already claimed");
        require(newBeneficiary != address(0), "Beneficiary required");
        require(newBeneficiary != msg.sender, "Beneficiary must differ from owner");
        v.beneficiary = newBeneficiary;
        emit BeneficiaryUpdated(msg.sender, newBeneficiary);
    }

    /// @notice True once an owner has gone silent past their chosen interval.
    function isExpired(address owner) public view returns (bool) {
        Vault memory v = vaults[owner];
        if (!v.exists || v.claimed) return false;
        return block.timestamp > uint256(v.lastCheckIn) + uint256(v.checkInIntervalSeconds);
    }

    /// @notice Seconds remaining before the vault becomes claimable. 0 if already expired or no vault.
    function timeRemaining(address owner) external view returns (uint256) {
        Vault memory v = vaults[owner];
        if (!v.exists || v.claimed) return 0;
        uint256 deadline = uint256(v.lastCheckIn) + uint256(v.checkInIntervalSeconds);
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    /// @notice The named beneficiary claims the vault once it has expired.
    function claim(address owner) external {
        Vault storage v = vaults[owner];
        require(v.exists, "No vault");
        require(!v.claimed, "Already claimed");
        require(msg.sender == v.beneficiary, "Not the named beneficiary");
        require(isExpired(owner), "Owner has checked in recently - not yet claimable");
        v.claimed = true;
        emit VaultClaimed(owner, v.beneficiary, uint64(block.timestamp));
    }

    /// @notice Read a vault's full public state.
    function getVault(address owner) external view returns (
        address beneficiary,
        bytes32 instructionsHash,
        uint64 lastCheckIn,
        uint64 checkInIntervalSeconds,
        bool claimed,
        bool exists
    ) {
        Vault memory v = vaults[owner];
        return (v.beneficiary, v.instructionsHash, v.lastCheckIn, v.checkInIntervalSeconds, v.claimed, v.exists);
    }
}
