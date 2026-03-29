# AIS-1 DID Method Specification
# did:ais1 — Agent Identity Standard DID Method
# Version: 0.1 | March 2026
# W3C DID Core conformant

## 1. Method Name

The method name is: `ais1`

DIDs using this method MUST begin with: `did:ais1:`

## 2. DID Syntax

```
did-ais1-format  := "did:ais1:" ais1-specific-id
ais1-specific-id := chain-id ":" address
                  | "sponsor:" address
                  | "bond:" bond-id
                  | "issuer:" issuer-id

chain-id   := "base" | "ethereum" | "arbitrum" | "polygon" | "solana" | "hedera"
address    := 1*66(HEXDIG / BASE58CHAR)
bond-id    := 1*DIGIT
issuer-id  := 1*64(ALPHA / DIGIT / "-" / "_")
```

### Examples

```
# Agent DIDs
did:ais1:base:0x3f2a8c1e9d4b7f2a3c5e8d1f4b7a2c5e8d1f4b7a
did:ais1:hedera:0.0.1234567
did:ais1:solana:7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV

# Sponsor DIDs
did:ais1:sponsor:0x9ca4f10988a7731b2de5513c7e5f66e5a3c4f231
did:ais1:sponsor:kadikoy-limited-bm-202302362

# Bond DIDs
did:ais1:bond:1
did:ais1:bond:1000

# Issuer DIDs
did:ais1:issuer:kadikoy
did:ais1:issuer:roc-bermuda
```

## 3. DID Document Structure

Resolving a did:ais1 agent DID returns a DID Document conforming to W3C DID Core:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://ais-1.org/context/v1"
  ],
  "id": "did:ais1:base:0x3f2a...",

  "ais1:bondId": 1,
  "ais1:tier": 1,
  "ais1:sponsorDid": "did:ais1:sponsor:0x...",
  "ais1:amlStatus": 1,
  "ais1:capabilities": ["payments", "api_calls"],
  "ais1:hcsTopicId": "0.0.1234567",

  "verificationMethod": [
    {
      "id": "did:ais1:base:0x3f2a...#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:ais1:sponsor:0x...",
      "publicKeyHex": "04..."
    }
  ],

  "authentication": [
    "did:ais1:base:0x3f2a...#key-1"
  ],

  "service": [
    {
      "id": "did:ais1:base:0x3f2a...#agent-endpoint",
      "type": "AIS1AgentEndpoint",
      "serviceEndpoint": "https://agent.example.com/api"
    },
    {
      "id": "did:ais1:base:0x3f2a...#hcs-log",
      "type": "AIS1HCSLog",
      "serviceEndpoint": "https://mainnet.hedera.com/api/v1/topics/0.0.1234567/messages"
    }
  ]
}
```

## 4. CRUD Operations

### 4.1 Create (Register)

A did:ais1 DID is created by issuing an AIS-1 bond via the smart contract.
The DID is deterministically derived from the agent's on-chain address.

```javascript
// DID is created automatically on issueBond()
const tx = await ais1.issueBond(agentCard, sponsorCard, tier, hcsTopicId);
// DID: did:ais1:base:{agentCard.agentDid}
```

### 4.2 Read (Resolve)

Resolution reads the bond data from the AIS-1 smart contract and constructs
the DID Document. The resolver queries:
1. The AIS-1 contract on the appropriate chain
2. The IPFS metadata URI for extended attributes
3. Optionally: the Hedera HCS log for audit history

```javascript
// Resolver pseudocode
async function resolve(did) {
  const { chain, address } = parseDid(did);
  const ais1 = getContract(chain, AIS1_ADDRESS);
  const bondId = await ais1.getBondByAgentDid(did);
  const [agent, sponsor, bond] = await ais1.getBond(bondId);
  return buildDidDocument(did, agent, sponsor, bond);
}
```

### 4.3 Update

AIS-1 bonds are immutable after issuance with the following exceptions:
- `amlStatus` — updateable by ISSUER_ROLE
- `kycStatus` — updateable by ISSUER_ROLE
- `hcsSequence` — updateable after HCS confirmation
- `status` — updateable via suspend/reinstate/revoke

### 4.4 Delete (Deactivate)

A DID is deactivated by revoking the bond. Revocation is permanent.
The DID remains resolvable but the DID Document will include
`"deactivated": true`.

## 5. Security Considerations

### 5.1 Key Management
The sponsor's Ethereum private key controls the bond. Loss of this key
requires the ERC-8002 recovery mechanism (ISSUER_ROLE authorisation required).

### 5.2 Replay Attacks
Bond hashes include timestamps. The smart contract prevents reuse of
agentDid across bonds, preventing replay attacks.

### 5.3 Revocation Checking
Resolvers MUST check bond status before presenting the DID Document as valid.
A revoked bond's DID Document MUST include `"deactivated": true`.

### 5.4 HCS Canonical Log
The Hedera HCS log is the canonical source of truth. In case of dispute
between on-chain state and HCS log, the HCS log takes precedence.

## 6. Privacy Considerations

AIS-1 Verified and Sovereign bonds contain real identity information in the
SponsorCard. Implementers MUST:
- Store sensitive sponsor attributes off-chain (IPFS with encryption)
- Only store identifiers (sponsorDid, jurisdiction, kycStatus) on-chain
- Implement access controls on metadata URI retrieval

## 7. Reference Implementation

- Smart contract: github.com/kadikoy/ais-1/contracts/AIS1.sol
- Resolver: github.com/kadikoy/ais-1/resolver/
- Universal Resolver driver: github.com/decentralized-identity/universal-resolver

## 8. Conformance

This specification conforms to:
- W3C DID Core 1.0 (https://www.w3.org/TR/did-core/)
- W3C DID Resolution (https://w3c-ccg.github.io/did-resolution/)
- DIF Universal Resolver driver specification

Contact: ais1@aiagentservices.net
Repository: github.com/kadikoy/ais-1
