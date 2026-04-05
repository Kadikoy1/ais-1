# AIS-1 v0.2 — Specification Changes
## Change Log from v0.1

Published by Kadikoy Limited, Bermuda
Date: April 2026
Status: Draft — supersedes v0.1

---

## Summary of Changes

AIS-1 v0.2 incorporates feedback from the first real-world deployment (Bond No. 1, PayAgent, 
Base Mainnet, 2 April 2026). All changes are backward compatible. Bond No. 1 is grandfathered 
under v0.1 and recognised as an ALA by definition.

---

## 1. New Fields — AgentCard

### 1.1 agentClass (NEW)

| Field | Type | Values |
|---|---|---|
| agentClass | string | "ala" \| "soa" |

**ALA** — Autonomous Legal Agent. Has independent legal standing. Bonded directly to a 
sponsor legal entity or individual.

**SOA** — Subordinate Operating Agent. Derives identity from a parent ALA. Has no 
independent legal standing. Accountability flows to the parent ALA and thence to the 
sponsor.

This field is mandatory from v0.2. Bonds issued under v0.1 without this field are 
recognised as ALA by definition.

### 1.2 parentDid (NEW)

| Field | Type | Values |
|---|---|---|
| parentDid | string | Empty string if ALA; parent agent DID if SOA |

Format: `did:ais1:{chain}:{address}`

If agentClass is "ala", parentDid must be an empty string.
If agentClass is "soa", parentDid must reference a valid ALA bond on the same registry.

**Maximum subordination depth: one level.** A SOA cannot sponsor another SOA. 
This rule is enforced at the registry level and should be enforced at the contract level.

---

## 2. Renamed Field — timestampServiceRef (was hcsTopicId)

The field previously named `hcsTopicId` is renamed `timestampServiceRef` in v0.2.

This field is **optional for all tiers** in v0.2. An empty string is valid.

AIS-1 supports secondary timestamping via any auditable independent service. 
A secondary timestamp provides cross-chain or cross-system corroboration of bond 
issuance time, independent of the issuance chain.

Supported formats:

| Format | Service | Description |
|---|---|---|
| `hcs:0.0.xxxxxxx` | Hedera Consensus Service | Hashgraph-based immutable log |
| `rfc3161:{authority}` | RFC 3161 Trusted Timestamping | ISO standard trusted timestamp |
| `ots:{digest}` | OpenTimestamps | Bitcoin-anchored timestamp |
| `custom:{uri}` | Any auditable log | Implementer-defined service |
| `""` | None | No secondary timestamp — valid for all tiers |

Absence of a secondary timestamp does not invalidate a bond.

---

## 3. New Section — Subordinate Operating Agents (SOA)

### 3.1 Definition

A Subordinate Operating Agent (SOA) is an AI agent that:

- Operates under the authority and accountability of a parent ALA
- Has an AIS-1 bond with agentClass "soa" and a populated parentDid field
- Has no independent legal standing
- Cannot sponsor further subordinate agents (maximum one level)
- Can be upgraded to ALA status by obtaining a new bond with its own sponsor entity

### 3.2 Accountability Chain

The accountability chain for a SOA is:

SOA → Parent ALA → Sponsor Legal Entity

This chain is readable on-chain via the parentDid field and in the registry via the 
parent_bond field. It is machine-readable by any agent or system querying the bond.

### 3.3 SOA Governance Rules

- A SOA bond requires the same sponsor entity as its parent ALA, or a sponsor entity 
  that has an existing relationship with the parent ALA's sponsor
- A SOA bond is revoked automatically if the parent ALA bond is revoked
- A SOA can be independently suspended without affecting the parent ALA
- A SOA cannot hold assets in its own name — assets are held by the parent ALA

### 3.4 SOA Upgrade Path

A SOA may be upgraded to ALA status by:
1. Obtaining an independent sponsor legal entity
2. Issuing a new AIS-1 bond with agentClass "ala"
3. Revoking the existing SOA bond

This mirrors the concept in Bermuda's ISAC legislation where a cell can be converted 
to an independent entity.

---

## 4. Terminology Update

The term "operating agent" is replaced by "Subordinate Operating Agent" (SOA) throughout 
this specification. This aligns with the terminology used in the Autonomous Legal Agent 
Recognition and Governance Act (ALARGA) draft legislation.

---

## 5. Grandfathering — Bond No. 1 (PayAgent)

Bond No. 1 (PayAgent, did:ais1:base:payagent-001) was issued under AIS-1 v0.1 on 
2 April 2026 via contract 0x52d0E17b80d19470E0d97Ea6b62bf35d867FDcb3 on Base Mainnet.

This bond does not contain the agentClass or parentDid fields introduced in v0.2, 
nor the renamed timestampServiceRef field.

**Bond No. 1 is recognised as an ALA by definition** — its absence of a parentDid 
field is treated as equivalent to parentDid: "". Its agentClass is confirmed as "ala" 
in the v0.2 registry and DID document.

The v0.1 contract address is noted in the registry as grandfathered. All subsequent 
bonds should be issued on the v0.2 contract.

---

## 6. DID Resolution — Section 6.1 (NEW)

### 6.1 Resolution Algorithm

The did:ais1 DID method resolves as follows:

Given a DID of the form `did:ais1:{chain}:{identifier}`:

1. Construct the resolution URL: `https://ais-1.org/resolve/{identifier}.json`
2. Fetch the JSON document at that URL
3. Verify the bond_id in the document against the on-chain record via getBond()
4. Return the DID Document

**Resolution URL pattern:**
- Agent: `https://ais-1.org/resolve/{agent-identifier}.json`
- Sponsor: `https://ais-1.org/resolve/sponsor-{identifier}.json`
- Bond: `https://ais-1.org/resolve/bond-{bond-id}.json`

**Interim resolution:** Until ais-1.org is fully operational, resolution is available at:
`https://kadikoy1.github.io/ais-1/resolve/{identifier}.json`

### 6.2 Registry

The AIS-1 registry is maintained at `https://ais-1.org/registry.json`.

The registry lists all issued bonds with their current status, agent class, parent 
relationships, and resolution URLs. It is the canonical source of truth for bond 
discovery and is updated on each bond issuance, revocation, or status change.

---

## 7. Updated Smart Contract Interface

See contracts/IAIS1v2.sol in the repository for the full v0.2 interface.

Key changes from v0.1:
- AgentCard struct: added agentClass, parentDid
- Bond struct: hcsTopicId renamed to timestampServiceRef
- BondIssued event: extended with agentClass, parentDid parameters
- New functions: getSubordinates(), isSOA()
- verifyBond() return values extended with agentClass, parentDid

---

## 8. Request for Comment

Changes in v0.2 are open for public comment until 30 September 2026.

Feedback via:
- Email: info@aiagentsservices.net  
- GitHub: github.com/kadikoy1/ais-1/issues
