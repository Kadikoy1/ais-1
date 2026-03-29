// sdk/ais1-verify.js
// AIS-1 Verification SDK v0.1
// The simplest way to verify an agent's identity before transacting
//
// Usage:
//   const { verifyAgent } = require('@ais1/verify');
//   const result = await verifyAgent("did:ais1:base:0x...");
//   if (result.valid && result.tier >= 1) { // proceed with transaction }

const { ethers } = require("ethers");

// ABI — just the verifyBond function (minimal for verification)
const AIS1_ABI = [
  "function verifyBond(uint256 bondId) view returns (bool valid, uint8 tier, string sponsorDid, uint8 amlStatus)",
  "function getBondByAgentDid(string agentDid) view returns (uint256 bondId)",
  "function getBond(uint256 bondId) view returns (tuple(string agentDid, string agentName, string agentType, string capabilities, string modelFramework, uint256 deploymentDate, string chainAddresses, uint8 amlStatus, string metadataUri), tuple(string sponsorDid, string legalName, string entityType, string jurisdiction, string registrationNo, uint8 kycStatus, string sponsorVc, string issuerId), tuple(uint256 bondId, bytes32 bondHash, uint256 issuedAt, string issuedBy, uint8 tier, string jurisdiction, string hcsTopicId, uint256 hcsSequence, uint8 status, uint256 expiry))"
];

// Deployed contract addresses (update after deployment)
const CONTRACTS = {
  base:     process.env.AIS1_BASE_ADDRESS     || null,
  ethereum: process.env.AIS1_ETH_ADDRESS      || null,
  arbitrum: process.env.AIS1_ARB_ADDRESS      || null,
  testnet:  process.env.AIS1_TESTNET_ADDRESS  || null,
};

// RPC endpoints
const RPC = {
  base:     process.env.BASE_RPC     || "https://mainnet.base.org",
  ethereum: process.env.ETH_RPC      || "https://eth.llamarpc.com",
  arbitrum: process.env.ARB_RPC      || "https://arb1.arbitrum.io/rpc",
  testnet:  process.env.TESTNET_RPC  || "https://sepolia.base.org",
};

// ── TIER LABELS ───────────────────────────────────────────────────────────────
const TIER = { 0: "Basic", 1: "Verified", 2: "Sovereign" };
const AML  = { 0: "unverified", 1: "cleared", 2: "suspended" };
const KYC  = { 0: "unverified", 1: "verified", 2: "enhanced" };

// ── PARSE DID ─────────────────────────────────────────────────────────────────

function parseDid(did) {
  // did:ais1:{chain}:{address} or did:ais1:bond:{id}
  const parts = did.split(":");
  if (parts.length < 4 || parts[0] !== "did" || parts[1] !== "ais1") {
    throw new Error(`Invalid AIS-1 DID: ${did}`);
  }
  return { chain: parts[2], address: parts[3] };
}

// ── GET CONTRACT ──────────────────────────────────────────────────────────────

function getContract(chain) {
  const address = CONTRACTS[chain] || CONTRACTS.testnet;
  if (!address) throw new Error(`AIS-1 contract address not configured for chain: ${chain}`);

  const rpc = RPC[chain] || RPC.testnet;
  const provider = new ethers.JsonRpcProvider(rpc);
  return new ethers.Contract(address, AIS1_ABI, provider);
}

// ── VERIFY AGENT ──────────────────────────────────────────────────────────────

/**
 * Verify an agent's AIS-1 identity before transacting.
 *
 * @param {string} agentDid  - The agent's DID (did:ais1:base:0x...)
 *                           - Or a bond ID (number)
 * @param {object} options   - { minTier: 0|1|2, requireAmlCleared: true }
 *
 * @returns {object} {
 *   valid:       boolean,
 *   tier:        0|1|2,
 *   tierName:    "Basic"|"Verified"|"Sovereign",
 *   sponsorDid:  string,
 *   amlStatus:   0|1|2,
 *   amlLabel:    string,
 *   bondId:      number,
 *   reason:      string (if invalid),
 *   latency_ms:  number
 * }
 */
async function verifyAgent(agentDid, options = {}) {
  const start = Date.now();
  const minTier = options.minTier ?? 0;
  const requireAml = options.requireAmlCleared ?? false;

  try {
    const { chain } = parseDid(agentDid);
    const contract = getContract(chain);

    // Look up bond ID by DID
    const bondId = await contract.getBondByAgentDid(agentDid);

    // Verify the bond
    const [valid, tier, sponsorDid, amlStatus] =
      await contract.verifyBond(bondId);

    const latency = Date.now() - start;

    // Apply caller's requirements
    let reason = null;
    let meetsRequirements = valid;

    if (!valid) {
      reason = "Bond is revoked, suspended, or expired";
    } else if (tier < minTier) {
      meetsRequirements = false;
      reason = `Bond tier ${TIER[tier]} is below required minimum ${TIER[minTier]}`;
    } else if (requireAml && amlStatus !== 1) {
      meetsRequirements = false;
      reason = `AML status is ${AML[amlStatus]} — cleared required`;
    }

    return {
      valid:       meetsRequirements,
      tier:        Number(tier),
      tierName:    TIER[tier] || "Unknown",
      sponsorDid,
      amlStatus:   Number(amlStatus),
      amlLabel:    AML[amlStatus] || "unknown",
      bondId:      Number(bondId),
      reason,
      latency_ms:  latency
    };

  } catch (err) {
    return {
      valid:      false,
      reason:     `Verification error: ${err.message}`,
      latency_ms: Date.now() - start
    };
  }
}

// ── GET FULL BOND ─────────────────────────────────────────────────────────────

/**
 * Retrieve the full bond record for an agent.
 * Use this when you need full identity details, not just verification.
 */
async function getAgentBond(agentDid) {
  const { chain } = parseDid(agentDid);
  const contract = getContract(chain);

  const bondId = await contract.getBondByAgentDid(agentDid);
  const [agentCard, sponsorCard, bond] = await contract.getBond(bondId);

  return {
    bondId:     Number(bond.bondId),
    tier:       Number(bond.tier),
    tierName:   TIER[bond.tier],
    status:     Number(bond.status),
    issuedAt:   new Date(Number(bond.issuedAt) * 1000).toISOString(),
    agent: {
      did:           agentCard.agentDid,
      name:          agentCard.agentName,
      type:          agentCard.agentType,
      capabilities:  JSON.parse(agentCard.capabilities || "[]"),
      amlStatus:     Number(agentCard.amlStatus),
      amlLabel:      AML[agentCard.amlStatus]
    },
    sponsor: {
      did:           sponsorCard.sponsorDid,
      legalName:     sponsorCard.legalName,
      entityType:    sponsorCard.entityType,
      jurisdiction:  sponsorCard.jurisdiction,
      kycStatus:     Number(sponsorCard.kycStatus),
      kycLabel:      KYC[sponsorCard.kycStatus],
      sponsorVc:     sponsorCard.sponsorVc
    }
  };
}

// ── BATCH VERIFY ─────────────────────────────────────────────────────────────

/**
 * Verify multiple agents in parallel.
 * Useful for multi-agent transaction screening.
 */
async function verifyAgents(agentDids, options = {}) {
  const results = await Promise.allSettled(
    agentDids.map(did => verifyAgent(did, options))
  );

  return results.map((r, i) => ({
    agentDid: agentDids[i],
    ...(r.status === "fulfilled" ? r.value : { valid: false, reason: r.reason?.message })
  }));
}

module.exports = {
  verifyAgent,
  getAgentBond,
  verifyAgents,
  parseDid,
  TIER,
  AML,
  KYC
};
