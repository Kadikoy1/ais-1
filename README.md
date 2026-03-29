# AIS-1: Agent Identity Standard

**The world's first open standard for bonded AI agent identity.**

[![License: CC0](https://img.shields.io/badge/License-CC0-blue.svg)](https://creativecommons.org/publicdomain/zero/1.0/)
[![Version](https://img.shields.io/badge/version-0.1-blue)](https://github.com/kadikoy/ais-1)
[![Status](https://img.shields.io/badge/status-draft--for--comment-orange)](https://github.com/kadikoy/ais-1/issues)

---

## What is AIS-1?

AIS-1 defines an open smart contract standard for bonded identity pairs linking an AI agent to its controlling sponsor. It addresses the Wild Agent Problem: hundreds of millions of  AI agents operate globally with no identity, no legal standing, and no accountability infrastructure.

An AIS-1 **Agent Passport** is a cryptographic, soulbound token that permanently and verifiably bonds:

- **Agent Card** — the AI system's identity, capabilities, and AML status
- **Sponsor Card** — the human, company, or legal entity accountable for the agent
- **Bond** — the permanent, tamper-evident link between them

```
┌─────────────────────────────────────┐
│           AIS-1 BOND                │
│                                     │
│  AGENT CARD        SPONSOR CARD     │
│  ──────────        ────────────     │
│  Agent DID         Sponsor DID      │
│  Capabilities      Legal name       │
│  AML status        KYC status       │
│  Chain addresses   Jurisdiction     │
│  Model/framework   Sponsor VC (ROC) │
│                                     │
│  Bond hash · HCS topic · Tier       │
└─────────────────────────────────────┘
```

## Why AIS-1?

| Without AIS-1 | With AIS-1 |
|---|---|
| Agents have no identity | Every agent has a unique, verifiable DID |
| No accountability | Sponsor permanently linked to agent |
| AML/KYC impossible | verifyBond() checks compliance in milliseconds |
| Travel Rule can't apply | Bond ID travels with every transaction |
| Agent can't hold assets | Sovereign tier enables full legal standing |

## Three Tiers

| Tier | Name | Requirements | Use case |
|---|---|---|---|
| 0 | **Basic** | Permissionless | Developer / prototype agents |
| 1 | **Verified** | KYC/AML by authorised issuer | Commercial / enterprise agents |
| 2 | **Sovereign** | Full legal wrapper + government VC | Regulated / financial agents |

## Quick Start

```bash
# Install
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Base Sepolia testnet
cp .env.example .env
# Fill in your PRIVATE_KEY and other values
npm run deploy:testnet
```

## Verify an Agent (SDK)

```javascript
const { verifyAgent } = require('./sdk/ais1-verify');

// Before transacting with an agent:
const result = await verifyAgent("did:ais1:base:0x...", {
  minTier: 1,              // require Verified or above
  requireAmlCleared: true  // require AML clearance
});

if (result.valid) {
  console.log("Agent cleared for commerce");
  console.log("Tier:", result.tierName);      // "Verified"
  console.log("Sponsor:", result.sponsorDid); // who is accountable
} else {
  console.log("Agent not cleared:", result.reason);
}
// Typical latency: < 100ms
```

## Issue a Bond

```javascript
const { ethers } = require("hardhat");

const ais1 = await ethers.getContractAt("AIS1", AIS1_ADDRESS);

const bondId = await ais1.issueBond(
  {
    agentDid:       "did:ais1:base:my-agent-001",
    agentName:      "My Agent",
    agentType:      "autonomous",
    capabilities:   '["payments","api_calls"]',
    modelFramework: "claude-3-opus",
    deploymentDate: Math.floor(Date.now() / 1000),
    chainAddresses: '[{"chain":"base","address":"0x..."}]',
    amlStatus:      0, // unverified at Basic tier
    metadataUri:    "ipfs://..."
  },
  {
    sponsorDid:     "did:ais1:sponsor:my-company",
    legalName:      "My Company Ltd",
    entityType:     "company",
    jurisdiction:   "BM",
    registrationNo: "12345",
    kycStatus:      0, // self-declared at Basic tier
    sponsorVc:      "",
    issuerId:       ""
  },
  0, // Basic tier
  "" // no HCS topic at Basic tier
);
```

## Repository Structure

```
ais-1/
├── contracts/
│   ├── AIS1.sol          ← Main contract (ERC-721 + ERC-8002)
│   └── IAIS1.sol         ← Interface
├── scripts/
│   ├── deploy.js         ← Deployment script
│   └── issue-first-bonds.js ← Historic first bond issuances
├── test/
│   └── AIS1.test.js      ← Full test suite
├── sdk/
│   └── ais1-verify.js    ← Verification SDK
├── hcs/
│   └── hcs-logger.js     ← Hedera HCS integration
├── context/
│   └── ais1-context-v1.jsonld ← JSON-LD vocabulary
├── did-method/
│   └── did-ais1-spec.md  ← DID method specification
├── hardhat.config.js
├── package.json
└── .env.example
```

## Standards Compliance

- **ERC-721** — Non-Fungible Token standard (OpenZeppelin implementation)
- **ERC-8002** — Soulbound Token standard with sponsor-controlled recovery
- **W3C DID Core 1.0** — Decentralised Identifier standard
- **W3C Verifiable Credentials** — For government-issued sponsor credentials
- **Hedera HCS** — Canonical immutable audit log
- **FATF Recommendations 10, 15, 16** — AML/CTF compliance architecture

## Tiers: Technical Requirements

### Basic Tier
- Self-issued (permissionless)
- No KYC/AML verification
- No HCS logging required
- Suitable for development and testing

### Verified Tier
- Requires `ISSUER_ROLE` — authorised issuer only
- Full KYC/AML of sponsor conducted by issuer
- HCS logging required
- amlStatus set by issuer after screening

### Sovereign Tier
- Requires `ISSUER_ROLE` — authorised issuer only
- Enhanced KYC/AML + beneficial owner disclosure
- `sponsorVc` must contain valid government-issued Verifiable Credential
- HCS logging required + notarised
- Physical data deposit facility in issuing jurisdiction
- Requires qualifying jurisdiction with agent legal entity legislation

## The FATF Travel Rule

AIS-1 solves the Travel Rule for agent transactions:
- Bond ID travels with every agent transaction
- Receiving party calls `verifyBond()` to retrieve full compliance data
- No correspondent banking infrastructure required
- Satisfies FATF Recommendations 10, 15, 16 simultaneously

## Licence

**CC0 — No rights reserved.**

AIS-1 is published under Creative Commons CC0. This standard is free to implement, fork, extend, and build upon without restriction or attribution requirement.

The open standard is what drives adoption. The value is in the ecosystem, not in owning the spec.

## Contributing

This is a draft for public comment. Feedback welcome via:
- GitHub Issues: [github.com/kadikoy/ais-1/issues](https://github.com/kadikoy/ais-1/issues)
- Email: info@aiagentsservices.net
- Comment period for v0.1 closes: 30 June 2026

## Authors


Kadikoy Limited, Bermuda
BDA AI Agent Services
(mailto:info@aiagentsservices.net)

---

*"If you're not counted, you don't count."*
*— Agent-Pulse, agentpulse.ai*
