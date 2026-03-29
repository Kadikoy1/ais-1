// scripts/issue-first-bonds.js
// Issues the first two AIS-1 bonds in history:
//   Bond 1 — PayAgent → ISA (company-agent)
//   Bond 2 — BC → Personal Agent (human-agent)

const { ethers } = require("hardhat");

// ── CONFIG — update these before running ──────────────────────────────────────
const AIS1_ADDRESS    = process.env.AIS1_ADDRESS || "0x..."; // deployed contract
const HCS_TOPIC_ID    = process.env.HCS_TOPIC_ID || "0.0.xxxxxxx"; // Hedera topic

async function main() {
  const [issuer] = await ethers.getSigners();
  const ais1 = await ethers.getContractAt("AIS1", AIS1_ADDRESS);

  console.log("═══════════════════════════════════════════════");
  console.log("  AIS-1 First Bond Issuances                  ");
  console.log("  The first agent identity bonds in history   ");
  console.log("═══════════════════════════════════════════════\n");

  // ── BOND 1: PayAgent → ISA (Company-Agent) ────────────────────────────────
  console.log("Issuing Bond 1: PayAgent → ISA (company-agent)...\n");

  const payAgentCard = {
    agentDid:        "did:ais1:base:payagent-001",
    agentName:       "PayAgent",
    agentType:       "autonomous",
    capabilities:    JSON.stringify(["payments", "financial_analysis", "api_calls", "reporting"]),
    modelFramework:  "claude-3-opus/custom",
    deploymentDate:  Math.floor(Date.now() / 1000),
    chainAddresses:  JSON.stringify([
      { chain: "base",    address: "0x..." },
      { chain: "ethereum", address: "0x..." }
    ]),
    amlStatus:       1, // cleared
    metadataUri:     "ipfs://Qm..." // PayAgent metadata on IPFS
  };

  const isaCard = {
    sponsorDid:      "did:ais1:sponsor:isa-company-001",
    legalName:       "Kadikoy Limited",
    entityType:      "company",
    jurisdiction:    "BM", // Bermuda
    registrationNo:  "202302362",
    kycStatus:       2, // enhanced
    sponsorVc:       "ipfs://Qm...", // ROC certificate of incorporation VC (once issued)
    issuerId:        "did:ais1:issuer:kadikoy"
  };

  const tx1 = await ais1.issueBond(
    payAgentCard,
    isaCard,
    1, // AIS-1 Verified
    HCS_TOPIC_ID
  );
  const receipt1 = await tx1.wait();

  const event1 = receipt1.logs.find(l => {
    try { return ais1.interface.parseLog(l)?.name === 'BondIssued'; } catch { return false; }
  });
  const parsed1 = ais1.interface.parseLog(event1);
  const bondId1 = parsed1.args.bondId;

  console.log("✓ Bond 1 issued!");
  console.log("  Bond ID:    ", bondId1.toString());
  console.log("  Tx hash:    ", receipt1.hash);
  console.log("  Agent DID:  ", payAgentCard.agentDid);
  console.log("  Sponsor:    ", isaCard.legalName);
  console.log("  Tier:        AIS-1 Verified");
  console.log("");

  // Verify Bond 1
  const [valid1, tier1, sponsorDid1, aml1] = await ais1.verifyBond(bondId1);
  console.log("  Verification:");
  console.log("    valid:     ", valid1);
  console.log("    tier:      ", tier1.toString(), "(1 = Verified)");
  console.log("    sponsorDid:", sponsorDid1);
  console.log("    amlStatus: ", aml1.toString(), "(1 = cleared)");
  console.log("");

  // ── BOND 2: BC → Personal Agent (Human-Agent) ─────────────────────────────
  console.log("Issuing Bond 2: BC → Personal Agent (human-agent)...\n");

  const personalAgentCard = {
    agentDid:        "did:ais1:base:bc-personal-agent-001",
    agentName:       "BC Personal Agent",
    agentType:       "semi-autonomous",
    capabilities:    JSON.stringify(["legal_research", "document_drafting", "communications", "scheduling"]),
    modelFramework:  "claude-3-opus",
    deploymentDate:  Math.floor(Date.now() / 1000),
    chainAddresses:  JSON.stringify([
      { chain: "base", address: "0x..." }
    ]),
    amlStatus:       1, // cleared
    metadataUri:     "ipfs://Qm..."
  };

  const bcCard = {
    sponsorDid:      "did:ais1:sponsor:bc-human-001",
    legalName:       "BC (Bourn Collier)",
    entityType:      "individual",
    jurisdiction:    "BM", // Bermuda
    registrationNo:  "", // individual — no company reg
    kycStatus:       2, // enhanced
    sponsorVc:       "ipfs://Qm...", // passport VC (once government VC infrastructure exists)
    issuerId:        "did:ais1:issuer:kadikoy"
  };

  const tx2 = await ais1.issueBond(
    personalAgentCard,
    bcCard,
    2, // AIS-1 Sovereign
    HCS_TOPIC_ID
  );
  const receipt2 = await tx2.wait();

  const event2 = receipt2.logs.find(l => {
    try { return ais1.interface.parseLog(l)?.name === 'BondIssued'; } catch { return false; }
  });
  const parsed2 = ais1.interface.parseLog(event2);
  const bondId2 = parsed2.args.bondId;

  console.log("✓ Bond 2 issued!");
  console.log("  Bond ID:    ", bondId2.toString());
  console.log("  Tx hash:    ", receipt2.hash);
  console.log("  Agent DID:  ", personalAgentCard.agentDid);
  console.log("  Sponsor:    ", bcCard.legalName);
  console.log("  Tier:        AIS-1 Sovereign");
  console.log("");

  // Verify Bond 2
  const [valid2, tier2, sponsorDid2, aml2] = await ais1.verifyBond(bondId2);
  console.log("  Verification:");
  console.log("    valid:     ", valid2);
  console.log("    tier:      ", tier2.toString(), "(2 = Sovereign)");
  console.log("    sponsorDid:", sponsorDid2);
  console.log("    amlStatus: ", aml2.toString(), "(1 = cleared)");
  console.log("");

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════");
  console.log("  Historic First Issuances — Summary          ");
  console.log("═══════════════════════════════════════════════");
  console.log("");
  console.log("Bond 1 — First company-agent bond in history");
  console.log("  ID:", bondId1.toString());
  console.log("  PayAgent (autonomous AI agent)");
  console.log("  Sponsored by: Kadikoy Limited, Bermuda");
  console.log("  Tier: AIS-1 Verified");
  console.log("");
  console.log("Bond 2 — First human-agent bond in history");
  console.log("  ID:", bondId2.toString());
  console.log("  BC Personal Agent");
  console.log("  Sponsored by: BC (individual, Bermuda)");
  console.log("  Tier: AIS-1 Sovereign");
  console.log("");
  console.log("Total bonds issued:", (await ais1.totalBonds()).toString());
  console.log("");
  console.log("Publish these bond IDs on Agent-Pulse.");
  console.log("These are the founding entries of the AIS-1 registry.");
  console.log("═══════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Bond issuance failed:", error);
    process.exit(1);
  });
