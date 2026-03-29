// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  AIS-1: Agent Identity Standard v0.1
//  Kadikoy Limited, Bermuda — 2026
//  github.com/kadikoy/ais-1
//  ais1@aiagentservices.net
//
//  CC0 — No rights reserved. Free to implement without restriction.
//
//  Implements: ERC-721 (base) + ERC-8002 (soulbound with recovery)
//  Canonical log: Hedera Consensus Service (HCS)
// ─────────────────────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title IAIS1 — AIS-1 Interface
 * @notice Interface for the Agent Identity Standard bonded identity pair
 */
interface IAIS1 {

    // ── STRUCTS ──────────────────────────────────────────────────────────────

    struct AgentCard {
        string  agentDid;           // did:ais1:{chain}:{address}
        string  agentName;          // Human-readable name
        string  agentType;          // "autonomous" | "semi-autonomous" | "supervised"
        string  capabilities;       // JSON array: ["payments","browsing","code_execution",...]
        string  modelFramework;     // e.g. "claude-3-opus/langchain"
        uint256 deploymentDate;     // Unix timestamp of first deployment
        string  chainAddresses;     // JSON array of {chain, address} objects
        uint8   amlStatus;          // 0=unverified 1=cleared 2=suspended
        string  metadataUri;        // IPFS URI for extended off-chain metadata
    }

    struct SponsorCard {
        string  sponsorDid;         // did:ais1:sponsor:{address}
        string  legalName;          // Full legal name
        string  entityType;         // "individual" | "company" | "dao" | "trust" | "foundation"
        string  jurisdiction;       // ISO 3166-1 alpha-2 (e.g. "BM" for Bermuda)
        string  registrationNo;     // Company registration number (if applicable)
        uint8   kycStatus;          // 0=unverified 1=verified 2=enhanced
        string  sponsorVc;          // W3C Verifiable Credential URI (e.g. ROC certificate of incorporation)
        string  issuerId;           // DID of authorised issuer that verified this card
    }

    struct Bond {
        uint256 bondId;
        bytes32 bondHash;           // keccak256(agentDid ++ sponsorDid ++ issuedAt ++ tier)
        uint256 issuedAt;           // Unix timestamp
        string  issuedBy;           // DID of issuing entity
        uint8   tier;               // 0=Basic 1=Verified 2=Sovereign
        string  jurisdiction;       // Jurisdiction of issuance
        string  hcsTopicId;         // Hedera Consensus Service topic ID
        uint256 hcsSequence;        // HCS sequence number of issuance event
        uint8   status;             // 0=active 1=suspended 2=revoked
        uint256 expiry;             // Unix timestamp; 0 = perpetual
    }

    // ── EVENTS ────────────────────────────────────────────────────────────────

    event BondIssued(
        uint256 indexed bondId,
        string  agentDid,
        string  sponsorDid,
        uint8   tier,
        string  issuedBy,
        string  hcsTopicId
    );

    event BondRevoked(
        uint256 indexed bondId,
        address indexed revokedBy,
        string  reason,
        uint256 timestamp
    );

    event BondSuspended(
        uint256 indexed bondId,
        address indexed suspendedBy,
        string  reason,
        uint256 timestamp
    );

    event BondReinstated(
        uint256 indexed bondId,
        address indexed reinstatedBy,
        uint256 timestamp
    );

    event AmlStatusUpdated(
        uint256 indexed bondId,
        uint8   oldStatus,
        uint8   newStatus,
        address indexed updatedBy
    );

    event KycStatusUpdated(
        uint256 indexed bondId,
        uint8   oldStatus,
        uint8   newStatus,
        address indexed updatedBy
    );

    event RecoveryInitiated(
        uint256 indexed bondId,
        address indexed newSponsorAddress,
        uint256 timestamp
    );

    // ── FUNCTIONS ─────────────────────────────────────────────────────────────

    /**
     * @notice Issue a new AIS-1 bond (Agent Passport)
     * @dev Basic tier: callable by anyone. Verified/Sovereign: requires ISSUER_ROLE
     * @param agent     AgentCard struct with agent identity attributes
     * @param sponsor   SponsorCard struct with sponsor identity attributes
     * @param tier      0=Basic 1=Verified 2=Sovereign
     * @param hcsTopicId  Hedera HCS topic ID for this bond's canonical log
     * @return bondId   The ID of the newly issued bond
     */
    function issueBond(
        AgentCard  calldata agent,
        SponsorCard calldata sponsor,
        uint8      tier,
        string     calldata hcsTopicId
    ) external returns (uint256 bondId);

    /**
     * @notice Revoke a bond permanently — cannot be undone
     * @dev Only callable by sponsor address or ISSUER_ROLE
     */
    function revokeBond(uint256 bondId, string calldata reason) external;

    /**
     * @notice Suspend a bond (reversible — use for investigations)
     * @dev Only callable by ISSUER_ROLE
     */
    function suspendBond(uint256 bondId, string calldata reason) external;

    /**
     * @notice Reinstate a suspended bond
     * @dev Only callable by ISSUER_ROLE
     */
    function reinstateBond(uint256 bondId) external;

    /**
     * @notice Update AML status of an agent (ERC-8002 compliance)
     * @dev Only callable by ISSUER_ROLE
     */
    function updateAmlStatus(uint256 bondId, uint8 newStatus) external;

    /**
     * @notice Update KYC status of a sponsor
     * @dev Only callable by ISSUER_ROLE
     */
    function updateKycStatus(uint256 bondId, uint8 newStatus) external;

    /**
     * @notice Initiate recovery — transfer bond to new sponsor address
     * @dev ERC-8002 recovery mechanism. Only callable by current sponsor + ISSUER_ROLE
     */
    function initiateRecovery(uint256 bondId, address newSponsorAddress) external;

    /**
     * @notice Retrieve the full bond record
     */
    function getBond(uint256 bondId) external view
        returns (AgentCard memory, SponsorCard memory, Bond memory);

    /**
     * @notice Look up bond ID by agent DID
     */
    function getBondByAgentDid(string calldata agentDid) external view
        returns (uint256 bondId);

    /**
     * @notice Look up all bond IDs for a sponsor DID
     */
    function getBondsBySponsorDid(string calldata sponsorDid) external view
        returns (uint256[] memory bondIds);

    /**
     * @notice Verify a bond — the primary AML/compliance check
     * @dev Called by counterparties before transacting with an agent
     * @return valid        true if bond is active and not revoked/suspended
     * @return tier         0=Basic 1=Verified 2=Sovereign
     * @return sponsorDid   DID of the accountable sponsor
     * @return amlStatus    0=unverified 1=cleared 2=suspended
     */
    function verifyBond(uint256 bondId) external view
        returns (
            bool   valid,
            uint8  tier,
            string memory sponsorDid,
            uint8  amlStatus
        );
}


/**
 * @title AIS1
 * @notice Reference implementation of the AIS-1 Agent Identity Standard
 * @dev Soulbound (non-transferable) bonded identity pair: agent + sponsor
 *      Extends ERC-721 with ERC-8002 soulbound + recovery mechanics
 */
contract AIS1 is ERC721, AccessControl, Pausable, ReentrancyGuard, IAIS1 {

    using Counters for Counters.Counter;

    // ── ROLES ─────────────────────────────────────────────────────────────────
    bytes32 public constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");

    // ── STATE ─────────────────────────────────────────────────────────────────
    Counters.Counter private _bondIds;

    // bondId => AgentCard
    mapping(uint256 => AgentCard)   private _agentCards;
    // bondId => SponsorCard
    mapping(uint256 => SponsorCard) private _sponsorCards;
    // bondId => Bond
    mapping(uint256 => Bond)        private _bonds;

    // agentDid => bondId (for lookup)
    mapping(string => uint256)      private _didToBond;
    // sponsorDid => bondId[] (a sponsor may have multiple agents)
    mapping(string => uint256[])    private _sponsorBonds;

    // bondId => sponsor wallet address (for recovery and revocation)
    mapping(uint256 => address)     private _sponsorAddress;

    // ── CONSTRUCTOR ───────────────────────────────────────────────────────────
    constructor() ERC721("AIS-1 Agent Passport", "AIS1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    // ── SOULBOUND: DISABLE TRANSFERS (ERC-8002) ───────────────────────────────

    /**
     * @dev Bonds are non-transferable. Override all ERC-721 transfer functions.
     *      Recovery is handled separately via initiateRecovery().
     */
    function transferFrom(address, address, uint256) public pure override {
        revert("AIS-1: bonds are non-transferable. Use initiateRecovery() for sponsor changes.");
    }

    function safeTransferFrom(address, address, uint256) public pure override {
        revert("AIS-1: bonds are non-transferable. Use initiateRecovery() for sponsor changes.");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("AIS-1: bonds are non-transferable. Use initiateRecovery() for sponsor changes.");
    }

    function approve(address, uint256) public pure override {
        revert("AIS-1: bonds are non-transferable.");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("AIS-1: bonds are non-transferable.");
    }

    // ── ISSUE BOND ────────────────────────────────────────────────────────────

    function issueBond(
        AgentCard  calldata agent,
        SponsorCard calldata sponsor,
        uint8      tier,
        string     calldata hcsTopicId
    ) external override nonReentrant whenNotPaused returns (uint256 bondId) {

        // Verified and Sovereign tiers require ISSUER_ROLE
        if (tier >= 1) {
            require(hasRole(ISSUER_ROLE, msg.sender), "AIS-1: Verified/Sovereign issuance requires ISSUER_ROLE");
        }

        require(tier <= 2, "AIS-1: Invalid tier");
        require(bytes(agent.agentDid).length > 0, "AIS-1: agentDid required");
        require(bytes(sponsor.sponsorDid).length > 0, "AIS-1: sponsorDid required");
        require(_didToBond[agent.agentDid] == 0, "AIS-1: agentDid already has a bond");

        _bondIds.increment();
        bondId = _bondIds.current();

        // Compute bond hash
        bytes32 bondHash = keccak256(abi.encodePacked(
            agent.agentDid,
            sponsor.sponsorDid,
            block.timestamp,
            tier
        ));

        // Store cards
        _agentCards[bondId]   = agent;
        _sponsorCards[bondId] = sponsor;

        // Store bond metadata
        _bonds[bondId] = Bond({
            bondId:      bondId,
            bondHash:    bondHash,
            issuedAt:    block.timestamp,
            issuedBy:    sponsor.issuerId,
            tier:        tier,
            jurisdiction: sponsor.jurisdiction,
            hcsTopicId:  hcsTopicId,
            hcsSequence: 0, // updated off-chain after HCS confirmation
            status:      0, // active
            expiry:      0  // perpetual
        });

        // Index for lookups
        _didToBond[agent.agentDid] = bondId;
        _sponsorBonds[sponsor.sponsorDid].push(bondId);
        _sponsorAddress[bondId] = msg.sender;

        // Mint ERC-721 token to sponsor address
        _safeMint(msg.sender, bondId);

        emit BondIssued(
            bondId,
            agent.agentDid,
            sponsor.sponsorDid,
            tier,
            sponsor.issuerId,
            hcsTopicId
        );

        return bondId;
    }

    // ── REVOKE ────────────────────────────────────────────────────────────────

    function revokeBond(uint256 bondId, string calldata reason)
        external override
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(
            _sponsorAddress[bondId] == msg.sender || hasRole(ISSUER_ROLE, msg.sender),
            "AIS-1: Only sponsor or issuer can revoke"
        );
        require(_bonds[bondId].status != 2, "AIS-1: Bond already revoked");

        _bonds[bondId].status = 2; // revoked — permanent

        emit BondRevoked(bondId, msg.sender, reason, block.timestamp);
    }

    // ── SUSPEND / REINSTATE ───────────────────────────────────────────────────

    function suspendBond(uint256 bondId, string calldata reason)
        external override onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(_bonds[bondId].status == 0, "AIS-1: Bond is not active");

        _bonds[bondId].status = 1; // suspended

        emit BondSuspended(bondId, msg.sender, reason, block.timestamp);
    }

    function reinstateBond(uint256 bondId)
        external override onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(_bonds[bondId].status == 1, "AIS-1: Bond is not suspended");

        _bonds[bondId].status = 0; // active

        emit BondReinstated(bondId, msg.sender, block.timestamp);
    }

    // ── STATUS UPDATES ────────────────────────────────────────────────────────

    function updateAmlStatus(uint256 bondId, uint8 newStatus)
        external override onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(newStatus <= 2, "AIS-1: Invalid AML status");

        uint8 old = _agentCards[bondId].amlStatus;
        _agentCards[bondId].amlStatus = newStatus;

        emit AmlStatusUpdated(bondId, old, newStatus, msg.sender);
    }

    function updateKycStatus(uint256 bondId, uint8 newStatus)
        external override onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(newStatus <= 2, "AIS-1: Invalid KYC status");

        uint8 old = _sponsorCards[bondId].kycStatus;
        _sponsorCards[bondId].kycStatus = newStatus;

        emit KycStatusUpdated(bondId, old, newStatus, msg.sender);
    }

    // ── ERC-8002 RECOVERY ─────────────────────────────────────────────────────

    /**
     * @notice Initiate recovery — move bond to new sponsor address
     * @dev Requires both current sponsor signature AND ISSUER_ROLE authorisation
     *      This is a re-issuance, not a transfer. Creates an audit trail.
     */
    function initiateRecovery(uint256 bondId, address newSponsorAddress)
        external override onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        require(_bonds[bondId].status == 0, "AIS-1: Bond is not active");
        require(newSponsorAddress != address(0), "AIS-1: Invalid recovery address");

        address oldAddress = _sponsorAddress[bondId];
        _sponsorAddress[bondId] = newSponsorAddress;

        // Transfer the underlying NFT (internal, bypasses soulbound restriction)
        _transfer(oldAddress, newSponsorAddress, bondId);

        emit RecoveryInitiated(bondId, newSponsorAddress, block.timestamp);
    }

    // ── READ FUNCTIONS ────────────────────────────────────────────────────────

    function getBond(uint256 bondId) external view override
        returns (AgentCard memory, SponsorCard memory, Bond memory)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        return (_agentCards[bondId], _sponsorCards[bondId], _bonds[bondId]);
    }

    function getBondByAgentDid(string calldata agentDid) external view override
        returns (uint256 bondId)
    {
        bondId = _didToBond[agentDid];
        require(bondId != 0, "AIS-1: No bond found for agentDid");
        return bondId;
    }

    function getBondsBySponsorDid(string calldata sponsorDid) external view override
        returns (uint256[] memory)
    {
        return _sponsorBonds[sponsorDid];
    }

    /**
     * @notice Primary AML/compliance verification function
     * @dev Counterparties call this before transacting with an agent
     *      Returns everything needed for compliance in one call
     */
    function verifyBond(uint256 bondId) external view override
        returns (
            bool   valid,
            uint8  tier,
            string memory sponsorDid,
            uint8  amlStatus
        )
    {
        if (!_exists(bondId)) {
            return (false, 0, "", 0);
        }

        Bond memory b       = _bonds[bondId];
        AgentCard memory a  = _agentCards[bondId];
        SponsorCard memory s = _sponsorCards[bondId];

        // Bond is valid if: active (not revoked/suspended) AND not expired
        bool notExpired = b.expiry == 0 || b.expiry > block.timestamp;
        valid = (b.status == 0) && notExpired;

        return (valid, b.tier, s.sponsorDid, a.amlStatus);
    }

    // ── BOND HASH VERIFICATION ────────────────────────────────────────────────

    /**
     * @notice Verify the integrity of a bond by recomputing its hash
     * @dev Tamper detection — if any attribute was modified, hash will not match
     */
    function verifyBondIntegrity(uint256 bondId) external view returns (bool) {
        require(_exists(bondId), "AIS-1: Bond does not exist");

        bytes32 expected = keccak256(abi.encodePacked(
            _agentCards[bondId].agentDid,
            _sponsorCards[bondId].sponsorDid,
            _bonds[bondId].issuedAt,
            _bonds[bondId].tier
        ));

        return expected == _bonds[bondId].bondHash;
    }

    // ── HCS SEQUENCE UPDATE ───────────────────────────────────────────────────

    /**
     * @notice Update the HCS sequence number after off-chain confirmation
     * @dev Called by authorised issuer after Hedera confirms the log entry
     */
    function updateHcsSequence(uint256 bondId, uint256 sequence)
        external onlyRole(ISSUER_ROLE)
    {
        require(_exists(bondId), "AIS-1: Bond does not exist");
        _bonds[bondId].hcsSequence = sequence;
    }

    // ── ADMIN ─────────────────────────────────────────────────────────────────

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function totalBonds() external view returns (uint256) {
        return _bondIds.current();
    }

    // ── INTERFACE SUPPORT ─────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
