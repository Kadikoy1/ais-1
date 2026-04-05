// SPDX-License-Identifier: CC0-1.0
// AIS-1: Agent Identity Standard v0.2
// Kadikoy Limited, Bermuda — 2026
//
// v0.2 Changes from v0.1:
// - Added agentClass field to AgentCard: "ala" | "soa"
// - Added parentDid field to AgentCard: empty if ALA, parent DID if SOA
// - Renamed hcsTopicId to timestampServiceRef — now optional, technology-neutral
// - Added getSubordinates() and isSOA() query functions
// - BondIssued event extended with agentClass and parentDid
// - Bond No. 1 (PayAgent, 0x52d0E17b80d19470E0d97Ea6b62bf35d867FDcb3)
//   grandfathered as ALA under v0.1

pragma solidity ^0.8.20;

interface IAIS1 {

    struct AgentCard {
        string agentDid;
        string agentName;
        string agentType;        // "autonomous"|"semi-autonomous"|"supervised"
        string agentClass;       // NEW v0.2: "ala"|"soa"
        string parentDid;        // NEW v0.2: "" if ALA; parent agent DID if SOA
        string capabilities;     // JSON array
        string modelFramework;
        uint256 deploymentDate;
        string chainAddresses;   // JSON array of {chain, address}
        uint8 amlStatus;         // 0=unverified 1=cleared 2=suspended
        string metadataUri;
    }

    struct SponsorCard {
        string sponsorDid;
        string legalName;
        string entityType;       // "individual"|"company"|"dao"|"trust"
        string jurisdiction;     // ISO 3166-1 alpha-2
        string registrationNo;
        uint8 kycStatus;         // 0=unverified 1=verified 2=enhanced
        string issuerId;
    }

    struct Bond {
        uint256 bondId;
        bytes32 bondHash;
        uint256 issuedAt;
        string issuedBy;
        uint8 tier;              // 0=basic 1=verified 2=sovereign
        string jurisdiction;
        string timestampServiceRef; // RENAMED v0.2 (was hcsTopicId) — OPTIONAL
        // Supported formats:
        // "hcs:0.0.xxxxxxx"       Hedera Consensus Service
        // "rfc3161:{authority}"   RFC 3161 Trusted Timestamping
        // "ots:{digest}"          OpenTimestamps (Bitcoin anchored)
        // "custom:{uri}"          Any auditable immutable log
        // ""                      No secondary timestamp (valid for all tiers)
        uint8 status;            // 0=active 1=suspended 2=revoked
        uint256 expiry;          // 0=perpetual
    }

    event BondIssued(
        uint256 indexed bondId,
        string agentDid,
        string sponsorDid,
        uint8 tier,
        string agentClass,       // NEW v0.2
        string parentDid         // NEW v0.2
    );
    event BondRevoked(uint256 indexed bondId, address revokedBy, string reason);
    event BondSuspended(uint256 indexed bondId, address suspendedBy, string reason);
    event AmlStatusUpdated(uint256 indexed bondId, uint8 newStatus);

    function issueBond(
        AgentCard calldata agent,
        SponsorCard calldata sponsor,
        uint8 tier,
        string calldata timestampServiceRef
    ) external returns (uint256 bondId);

    function revokeBond(uint256 bondId, string calldata reason) external;
    function suspendBond(uint256 bondId, string calldata reason) external;
    function reinstateBond(uint256 bondId) external;
    function updateAmlStatus(uint256 bondId, uint8 status) external;

    function getBond(uint256 bondId) external view
        returns (AgentCard memory, SponsorCard memory, Bond memory);

    function getBondByAgentDid(string calldata agentDid) external view
        returns (uint256 bondId);

    function verifyBond(uint256 bondId) external view
        returns (bool valid, uint8 tier, string memory sponsorDid,
                 string memory agentClass, string memory parentDid);

    // NEW v0.2 — SOA queries
    function getSubordinates(string calldata parentAgentDid) external view
        returns (uint256[] memory bondIds);

    function isSOA(uint256 bondId) external view
        returns (bool soa, string memory parentDid);
}
