// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  IAIS1.sol — AIS-1 Interface
//  AIS-1: Agent Identity Standard v0.1
//  github.com/kadikoy/ais-1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @title IAIS1
 * @notice Interface for the AIS-1 Agent Identity Standard
 * @dev Any contract implementing AIS-1 must implement this interface.
 *      The interface is intentionally minimal — implementations may add
 *      additional functions but must not remove or modify these.
 */
interface IAIS1 {

    struct AgentCard {
        string  agentDid;
        string  agentName;
        string  agentType;
        string  capabilities;
        string  modelFramework;
        uint256 deploymentDate;
        string  chainAddresses;
        uint8   amlStatus;
        string  metadataUri;
    }

    struct SponsorCard {
        string  sponsorDid;
        string  legalName;
        string  entityType;
        string  jurisdiction;
        string  registrationNo;
        uint8   kycStatus;
        string  sponsorVc;
        string  issuerId;
    }

    struct Bond {
        uint256 bondId;
        bytes32 bondHash;
        uint256 issuedAt;
        string  issuedBy;
        uint8   tier;
        string  jurisdiction;
        string  hcsTopicId;
        uint256 hcsSequence;
        uint8   status;
        uint256 expiry;
    }

    event BondIssued(uint256 indexed bondId, string agentDid, string sponsorDid, uint8 tier, string issuedBy, string hcsTopicId);
    event BondRevoked(uint256 indexed bondId, address indexed revokedBy, string reason, uint256 timestamp);
    event BondSuspended(uint256 indexed bondId, address indexed suspendedBy, string reason, uint256 timestamp);
    event BondReinstated(uint256 indexed bondId, address indexed reinstatedBy, uint256 timestamp);
    event AmlStatusUpdated(uint256 indexed bondId, uint8 oldStatus, uint8 newStatus, address indexed updatedBy);
    event KycStatusUpdated(uint256 indexed bondId, uint8 oldStatus, uint8 newStatus, address indexed updatedBy);
    event RecoveryInitiated(uint256 indexed bondId, address indexed newSponsorAddress, uint256 timestamp);

    function issueBond(AgentCard calldata agent, SponsorCard calldata sponsor, uint8 tier, string calldata hcsTopicId) external returns (uint256 bondId);
    function revokeBond(uint256 bondId, string calldata reason) external;
    function suspendBond(uint256 bondId, string calldata reason) external;
    function reinstateBond(uint256 bondId) external;
    function updateAmlStatus(uint256 bondId, uint8 newStatus) external;
    function updateKycStatus(uint256 bondId, uint8 newStatus) external;
    function initiateRecovery(uint256 bondId, address newSponsorAddress) external;
    function getBond(uint256 bondId) external view returns (AgentCard memory, SponsorCard memory, Bond memory);
    function getBondByAgentDid(string calldata agentDid) external view returns (uint256 bondId);
    function getBondsBySponsorDid(string calldata sponsorDid) external view returns (uint256[] memory bondIds);
    function verifyBond(uint256 bondId) external view returns (bool valid, uint8 tier, string memory sponsorDid, uint8 amlStatus);
}
