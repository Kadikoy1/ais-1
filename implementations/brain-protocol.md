# Brain Protocol — AIS-1 Reference Implementation (Starknet, STARK-based)

**Status:** Proposed reference implementation for AIS-1 v0.2
**Submitted to:** AIS-1 v0.1 public comment period (closes 30 June 2026)
**Submitter:** Vauban Research — sfirae54@gmail.com — GitHub @seritalien
**Live endpoint:** https://brain.api.vauban.tech
**Source:** https://github.com/seritalien/brain-protocol
**Date:** 2026-04-17

---

## Summary

Brain Protocol is proposed as a **Starknet-native, STARK-based** reference implementation for AIS-1, complementing the existing Base (EVM, SNARK-based) reference. It provides:

1. A **W3C DID resolution endpoint** (`GET /did/{starknet_address}`) returning a conformant DID Document with Starknet verification methods, MCP endpoint service types, and retrieval proof API service types.
2. A full **MCP (Model Context Protocol) integration** — 41 MCP tools exposed over OAuth 2.1 HTTP transport, including `prove`, `verify`, `get_proof_chain`, and `get_decision_chain`.
3. **Post-quantum proof infrastructure** — Starknet Stwo prover, Poseidon hashing, FRI-based STARKs, no trusted setup.
4. **L3 anchoring** — every knowledge entry carries a `chain_hash` anchored on Starknet Madara L3, with public verification at `/proof/{id}`.

---

## Why AIS-1 Needs a STARK-Based Reference Implementation

The current v0.1 reference implementation targets Base (Ethereum L2), which inherits EVM constraints: SNARK-based proofs (trusted setup required, elliptic-curve assumptions, quantum-vulnerable under Shor's algorithm). AIS-1 v0.1 does not specify proof technology requirements, which creates an implicit bias toward SNARK-based identity systems and excludes post-quantum alternatives.

**Starknet's STARK infrastructure** provides:

| Property | SNARK (Base reference) | STARK (Brain Protocol) |
|---|---|---|
| Trusted setup | Required (Groth16/PLONK) | **None** |
| Post-quantum | No (elliptic curves) | **Yes (hash-only)** |
| ZK-friendly hash | Keccak/SHA-256 | **Poseidon (5-80x cheaper)** |
| Settlement | Ethereum L1 | L3 → L2 → Ethereum L1 |
| Production status | Base mainnet | Starknet mainnet (Nov 2025), Madara L3 |

This is not a replacement for the Base reference — it is a **complementary tier** that extends AIS-1 to post-quantum-ready ecosystems.

---

## Conformance Map

### Live Today

| AIS-1 capability | Brain Protocol evidence |
|---|---|
| DID resolution (`GET /did/{did}`) | **Live** — `GET https://brain.api.vauban.tech/did/{starknet_address}` returns a W3C DID Core 1.0 document with `StarknetVerificationKey2026`, `MCPEndpoint`, and `RetrievalProofAPI` service types. Content-Type: `application/did+ld+json`. Deployed 2026-04-15 (commit `17210da`). |
| Ed25519 key derivation for agents | **Live** — `agent-auth.service.ts` (`computeIdentityHash()` + `deriveKeyPair()`). |
| OAuth 2.1 MCP transport | **Live** — `brain.api.vauban.tech/mcp` with GitHub/Google OAuth. |
| Retrieval proofs (Poseidon/Merkle) | **Live** — `POST /v1/retrieval-proofs`, `proof.routes.ts`. |
| Public proof verification | **Live** — `GET /proof/{id}` — HTML + Starkscan link, no auth. |
| Decision chain recording | **Live** — `decision-chain.routes.ts`, `GET/POST /v1/decision-chains`. |
| MCP tools: `prove`, `verify`, `get_proof_chain`, `get_decision_chain` | **Live** — 41 MCP tools, available via Claude Desktop, Cursor, Windsurf. |
| Starknet L3 anchoring | **Live** — Madara anchor, `chain_hash` + `proof_tx` per knowledge entry. |

### On Roadmap (planned for AIS-1 v0.2 conformance)

| Operation | Plan |
|---|---|
| Key rotation | `POST /auth/rotate-key` |
| DID deactivation | `POST /auth/deactivate` |
| `AgentIdentityCredential` issuance | At agent registration |
| `HumanDelegationCredential` | Via Glacis identity chain integration |

---

## Proposed AIS-1 v0.2 Additions (driven by this implementation)

### 1. MCP Binding Section (§8)

MCP is the dominant AI agent protocol in 2026 (Claude Desktop, Cursor, Windsurf, ChatGPT all speak MCP). AIS-1 v0.1 does not specify MCP bindings. We propose §8 defining:

```
§8.1 MCP Identity Tool Requirements

An AIS-1 compliant agent MUST expose the following MCP tools
when operating as an MCP server with identity capabilities:

  - get_agent_did          : Returns the agent's DID Document
  - verify_agent_credential: Verifies a Verifiable Credential
  - sign_agent_claim       : Produces a signed claim
  - get_proof_chain        : Returns the proof chain linking
                             identity to most recent decision

§8.2 MCP Transport and Authentication

MCP tools exposing identity operations MUST use either:
  (a) HTTP with OAuth 2.1 Bearer token (per MCP spec §4.3)
  (b) stdio with signed session token

The agent's DID Document MUST include a `#mcp-endpoint`
verification method linking to the MCP server's URL.
```

### 2. `DecisionProvenanceCredential` Credential Type

AIS-1 v0.1 defines *who* an agent is, but not *what it knew when it decided*. EU AI Act Article 12, ISO/IEC 42001, and NIST AI RMF all require decision logging for trustworthy AI. We propose:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://ais-1.org/credentials/v1"
  ],
  "type": ["VerifiableCredential", "DecisionProvenanceCredential"],
  "issuer": "did:ais1:starknet:0x...",
  "credentialSubject": {
    "decisionId": "dec_01HXYZ123",
    "retrievalProofHash": "0x3f7a9c...",
    "merkleRoot": "0x8b12ef...",
    "starknetAnchor": {
      "l3Block": 812445,
      "txHash": "0x4a2c...",
      "verifierContract": "0x..."
    },
    "epistemicStatus": "fact",
    "confidence": 0.87
  },
  "proof": {
    "type": "StarkProof2026",
    "verificationMethod": "did:ais1:starknet:0x...#stark-key",
    "proofValue": "..."
  }
}
```

### 3. `StarkProof2026` Proof Type

The v0.1 spec implicitly assumes SNARK-based proofs (through the Base reference). We propose a new proof type for STARK-based implementations:

```
StarkProof2026:
  Algorithm:       FRI-based STARK (Stwo prover, Starknet standard)
  Hash function:   Poseidon (ZK-friendly, 5-80x cheaper than SHA-256)
  Post-quantum:    Yes — hash-based commitments only
  Trusted setup:   None
  Settlement:      Starknet L3 (Madara) → L2 → Ethereum L1
```

As quantum computing advances, SNARK-based identity systems become vulnerable. AIS-1 should specify a proof abstraction that supports both SNARK and STARK implementations, with post-quantum as a recommended tier.

---

## Request to Working Group

1. **Recognition** of Brain Protocol as an AIS-1 reference implementation for Starknet-based agents (complementing the Base reference).
2. **Inclusion** of the MCP binding section (§8) in v0.2.
3. **Addition** of `DecisionProvenanceCredential` to v0.2 credential types.
4. **Addition** of `StarkProof2026` alongside existing SNARK-based proof types.

We are committed to maintaining conformance through the v0.2 specification and engaging with the working group during the comment period.

---

## Contact

- **Fabien — Vauban Research**
- Email: sfirae54@gmail.com
- GitHub: [@seritalien](https://github.com/seritalien)
- Live API: https://brain.api.vauban.tech
- Source: https://github.com/seritalien/brain-protocol
- Available for working group participation, live demo, or technical review.
