// hcs/hcs-logger.js
// AIS-1 Hedera Consensus Service Logger
// Logs all bond events to the canonical HCS topic

const {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId
} = require("@hashgraph/sdk");

// ── CONFIG ────────────────────────────────────────────────────────────────────
const HEDERA_ACCOUNT_ID  = process.env.HEDERA_ACCOUNT_ID;  // e.g. "0.0.1234567"
const HEDERA_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY; // ed25519 private key
const HEDERA_NETWORK     = process.env.HEDERA_NETWORK || "testnet"; // "testnet" | "mainnet"

// ── CLIENT ────────────────────────────────────────────────────────────────────
function getClient() {
  const accountId  = AccountId.fromString(HEDERA_ACCOUNT_ID);
  const privateKey = PrivateKey.fromString(HEDERA_PRIVATE_KEY);

  const client = HEDERA_NETWORK === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();

  client.setOperator(accountId, privateKey);
  return client;
}

// ── CREATE AIS-1 HCS TOPIC ────────────────────────────────────────────────────

/**
 * Creates a new HCS topic for AIS-1 canonical log.
 * Run once on deployment.
 * @returns {string} topicId — e.g. "0.0.1234567"
 */
async function createAIS1Topic() {
  const client = getClient();

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("AIS-1 Agent Identity Standard — Canonical Bond Log")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId.toString();

  console.log("AIS-1 HCS topic created:", topicId);
  console.log("Add this to your .env as: HCS_TOPIC_ID=" + topicId);

  client.close();
  return topicId;
}

// ── LOG BOND EVENT ────────────────────────────────────────────────────────────

/**
 * Logs a bond event to the AIS-1 HCS canonical topic.
 * Called after every on-chain bond event.
 *
 * @param {string} topicId   - Hedera topic ID (e.g. "0.0.1234567")
 * @param {object} event     - Bond event data
 * @returns {number} sequenceNumber - HCS sequence number
 */
async function logBondEvent(topicId, event) {
  const client = getClient();

  const message = {
    ais1_version:  "0.1",
    event_type:    event.type, // BOND_ISSUED | BOND_REVOKED | STATUS_UPDATE | BOND_SUSPENDED
    bond_id:       event.bondId,
    bond_hash:     event.bondHash || null,
    agent_did:     event.agentDid,
    sponsor_did:   event.sponsorDid,
    tier:          event.tier,
    issuer:        event.issuedBy || null,
    timestamp:     new Date().toISOString(),
    hcs_topic_id:  topicId,
    chain:         event.chain || "base",
    tx_hash:       event.txHash || null,
    reason:        event.reason || null,
    signature:     null // TODO: add issuer signature
  };

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(message))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const sequenceNumber = receipt.topicSequenceNumber.toNumber();

  console.log(`HCS log: ${event.type} | bond ${event.bondId} | sequence ${sequenceNumber}`);

  client.close();
  return sequenceNumber;
}

// ── LOG BOND ISSUANCE ─────────────────────────────────────────────────────────

async function logBondIssued(topicId, bondId, agentDid, sponsorDid, tier, issuedBy, bondHash, txHash) {
  return logBondEvent(topicId, {
    type:       "BOND_ISSUED",
    bondId,
    agentDid,
    sponsorDid,
    tier,
    issuedBy,
    bondHash,
    txHash
  });
}

// ── LOG BOND REVOCATION ───────────────────────────────────────────────────────

async function logBondRevoked(topicId, bondId, agentDid, sponsorDid, reason, txHash) {
  return logBondEvent(topicId, {
    type:       "BOND_REVOKED",
    bondId,
    agentDid,
    sponsorDid,
    reason,
    txHash
  });
}

// ── LOG STATUS UPDATE ─────────────────────────────────────────────────────────

async function logStatusUpdate(topicId, bondId, agentDid, field, oldValue, newValue, txHash) {
  return logBondEvent(topicId, {
    type:       "STATUS_UPDATE",
    bondId,
    agentDid,
    field,
    oldValue,
    newValue,
    txHash
  });
}

// ── QUERY HCS HISTORY ─────────────────────────────────────────────────────────

/**
 * Retrieves all HCS messages for a topic (bond audit history).
 * Uses Hedera Mirror Node REST API.
 *
 * @param {string} topicId
 * @param {number} limit
 * @returns {Array} messages
 */
async function getBondHistory(topicId, limit = 100) {
  const network = HEDERA_NETWORK === "mainnet"
    ? "mainnet-public"
    : "testnet";

  const url = `https://${network}.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=${limit}&order=asc`;

  const response = await fetch(url);
  const data = await response.json();

  return data.messages.map(msg => {
    try {
      const decoded = Buffer.from(msg.message, "base64").toString("utf8");
      return { ...JSON.parse(decoded), consensus_timestamp: msg.consensus_timestamp };
    } catch {
      return { raw: msg.message, consensus_timestamp: msg.consensus_timestamp };
    }
  });
}

// ── VERIFY BOND ON HCS ────────────────────────────────────────────────────────

/**
 * Verifies a bond has not been revoked by checking HCS history.
 * HCS is the canonical record — takes precedence over on-chain state.
 *
 * @param {string} topicId
 * @param {string|number} bondId
 * @returns {object} { valid, events, lastEvent }
 */
async function verifyBondOnHCS(topicId, bondId) {
  const history = await getBondHistory(topicId);
  const bondEvents = history.filter(m => m.bond_id == bondId);

  if (bondEvents.length === 0) {
    return { valid: false, reason: "Bond not found in HCS log", events: [] };
  }

  const lastEvent = bondEvents[bondEvents.length - 1];
  const hasRevocation = bondEvents.some(e => e.event_type === "BOND_REVOKED");

  return {
    valid:     !hasRevocation,
    reason:    hasRevocation ? "Bond revoked per HCS log" : "Active",
    events:    bondEvents,
    lastEvent
  };
}

module.exports = {
  createAIS1Topic,
  logBondIssued,
  logBondRevoked,
  logStatusUpdate,
  getBondHistory,
  verifyBondOnHCS
};
