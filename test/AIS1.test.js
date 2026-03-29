// test/AIS1.test.js
// Comprehensive test suite for AIS-1 smart contract

const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("AIS-1 Agent Identity Standard", function () {

  let ais1, owner, issuer, sponsor, thirdParty;

  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  const HCS_TOPIC   = "0.0.1234567";

  // Sample agent card
  const sampleAgent = {
    agentDid:       "did:ais1:base:test-agent-001",
    agentName:      "Test Agent",
    agentType:      "autonomous",
    capabilities:   '["payments","api_calls"]',
    modelFramework: "claude-3-opus",
    deploymentDate: Math.floor(Date.now() / 1000),
    chainAddresses: '[{"chain":"base","address":"0x1234"}]',
    amlStatus:      1,
    metadataUri:    "ipfs://QmTest"
  };

  // Sample sponsor card
  const sampleSponsor = {
    sponsorDid:     "did:ais1:sponsor:test-sponsor-001",
    legalName:      "Test Company Ltd",
    entityType:     "company",
    jurisdiction:   "BM",
    registrationNo: "12345",
    kycStatus:      1,
    sponsorVc:      "ipfs://QmSponsorVC",
    issuerId:       "did:ais1:issuer:kadikoy"
  };

  beforeEach(async function () {
    [owner, issuer, sponsor, thirdParty] = await ethers.getSigners();
    const AIS1 = await ethers.getContractFactory("AIS1");
    ais1 = await AIS1.deploy();
    await ais1.waitForDeployment();
    // Grant ISSUER_ROLE to issuer account
    await ais1.grantRole(ISSUER_ROLE, issuer.address);
  });

  // ── DEPLOYMENT ──────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await ais1.name()).to.equal("AIS-1 Agent Passport");
      expect(await ais1.symbol()).to.equal("AIS1");
    });

    it("Should grant deployer all roles", async function () {
      expect(await ais1.hasRole(ISSUER_ROLE, owner.address)).to.be.true;
    });

    it("Should start with zero bonds", async function () {
      expect(await ais1.totalBonds()).to.equal(0);
    });
  });

  // ── BASIC TIER ISSUANCE ─────────────────────────────────────────────────────
  describe("Basic Tier Issuance (permissionless)", function () {
    it("Should allow anyone to issue a Basic tier bond", async function () {
      const tx = await ais1.connect(thirdParty).issueBond(
        sampleAgent, sampleSponsor, 0, HCS_TOPIC
      );
      await expect(tx).to.emit(ais1, "BondIssued").withArgs(
        1, sampleAgent.agentDid, sampleSponsor.sponsorDid, 0,
        sampleSponsor.issuerId, HCS_TOPIC
      );
      expect(await ais1.totalBonds()).to.equal(1);
    });

    it("Should prevent duplicate agentDid", async function () {
      await ais1.connect(thirdParty).issueBond(sampleAgent, sampleSponsor, 0, HCS_TOPIC);
      await expect(
        ais1.connect(thirdParty).issueBond(sampleAgent, sampleSponsor, 0, HCS_TOPIC)
      ).to.be.revertedWith("AIS-1: agentDid already has a bond");
    });

    it("Should require agentDid", async function () {
      const badAgent = { ...sampleAgent, agentDid: "" };
      await expect(
        ais1.connect(thirdParty).issueBond(badAgent, sampleSponsor, 0, HCS_TOPIC)
      ).to.be.revertedWith("AIS-1: agentDid required");
    });
  });

  // ── VERIFIED/SOVEREIGN TIER ─────────────────────────────────────────────────
  describe("Verified/Sovereign Tier (issuer only)", function () {
    it("Should allow issuer to issue Verified bond", async function () {
      await expect(
        ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC)
      ).to.emit(ais1, "BondIssued");
    });

    it("Should reject non-issuer Verified issuance", async function () {
      await expect(
        ais1.connect(thirdParty).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC)
      ).to.be.revertedWith("AIS-1: Verified/Sovereign issuance requires ISSUER_ROLE");
    });

    it("Should allow issuer to issue Sovereign bond", async function () {
      await expect(
        ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 2, HCS_TOPIC)
      ).to.emit(ais1, "BondIssued");
    });

    it("Should reject invalid tier", async function () {
      await expect(
        ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 3, HCS_TOPIC)
      ).to.be.revertedWith("AIS-1: Invalid tier");
    });
  });

  // ── SOULBOUND (NON-TRANSFERABLE) ─────────────────────────────────────────────
  describe("Soulbound — Non-Transferable", function () {
    let bondId;
    beforeEach(async function () {
      const tx = await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      const receipt = await tx.wait();
      bondId = 1;
    });

    it("Should reject transferFrom", async function () {
      await expect(
        ais1.transferFrom(issuer.address, thirdParty.address, bondId)
      ).to.be.revertedWith("AIS-1: bonds are non-transferable");
    });

    it("Should reject safeTransferFrom", async function () {
      await expect(
        ais1["safeTransferFrom(address,address,uint256)"](issuer.address, thirdParty.address, bondId)
      ).to.be.revertedWith("AIS-1: bonds are non-transferable");
    });

    it("Should reject approve", async function () {
      await expect(
        ais1.connect(issuer).approve(thirdParty.address, bondId)
      ).to.be.revertedWith("AIS-1: bonds are non-transferable");
    });
  });

  // ── VERIFY BOND ──────────────────────────────────────────────────────────────
  describe("verifyBond()", function () {
    let bondId;
    beforeEach(async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      bondId = 1;
    });

    it("Should return valid=true for active Verified bond", async function () {
      const [valid, tier, sponsorDid, amlStatus] = await ais1.verifyBond(bondId);
      expect(valid).to.be.true;
      expect(tier).to.equal(1);
      expect(sponsorDid).to.equal(sampleSponsor.sponsorDid);
      expect(amlStatus).to.equal(1);
    });

    it("Should return valid=false for non-existent bond", async function () {
      const [valid] = await ais1.verifyBond(999);
      expect(valid).to.be.false;
    });

    it("Should return valid=false after revocation", async function () {
      await ais1.connect(issuer).revokeBond(bondId, "Test revocation");
      const [valid] = await ais1.verifyBond(bondId);
      expect(valid).to.be.false;
    });

    it("Should return valid=false after suspension", async function () {
      await ais1.connect(issuer).suspendBond(bondId, "Under investigation");
      const [valid] = await ais1.verifyBond(bondId);
      expect(valid).to.be.false;
    });
  });

  // ── REVOCATION ───────────────────────────────────────────────────────────────
  describe("Revocation", function () {
    let bondId;
    beforeEach(async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      bondId = 1;
    });

    it("Should allow issuer to revoke", async function () {
      await expect(ais1.connect(issuer).revokeBond(bondId, "Compliance failure"))
        .to.emit(ais1, "BondRevoked").withArgs(bondId, issuer.address, "Compliance failure", await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should prevent double revocation", async function () {
      await ais1.connect(issuer).revokeBond(bondId, "First revocation");
      await expect(
        ais1.connect(issuer).revokeBond(bondId, "Second revocation")
      ).to.be.revertedWith("AIS-1: Bond already revoked");
    });

    it("Should prevent non-sponsor/issuer from revoking", async function () {
      await expect(
        ais1.connect(thirdParty).revokeBond(bondId, "Unauthorized")
      ).to.be.revertedWith("AIS-1: Only sponsor or issuer can revoke");
    });
  });

  // ── SUSPEND / REINSTATE ──────────────────────────────────────────────────────
  describe("Suspend and Reinstate", function () {
    let bondId;
    beforeEach(async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      bondId = 1;
    });

    it("Should suspend and reinstate", async function () {
      await ais1.connect(issuer).suspendBond(bondId, "Investigation");
      let [valid] = await ais1.verifyBond(bondId);
      expect(valid).to.be.false;

      await ais1.connect(issuer).reinstateBond(bondId);
      [valid] = await ais1.verifyBond(bondId);
      expect(valid).to.be.true;
    });
  });

  // ── AML STATUS UPDATE ────────────────────────────────────────────────────────
  describe("AML Status Updates", function () {
    let bondId;
    beforeEach(async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      bondId = 1;
    });

    it("Should update AML status", async function () {
      await expect(ais1.connect(issuer).updateAmlStatus(bondId, 2))
        .to.emit(ais1, "AmlStatusUpdated").withArgs(bondId, 1, 2, issuer.address);
      const [, , , aml] = await ais1.verifyBond(bondId);
      expect(aml).to.equal(2);
    });

    it("Should reject invalid AML status", async function () {
      await expect(
        ais1.connect(issuer).updateAmlStatus(bondId, 3)
      ).to.be.revertedWith("AIS-1: Invalid AML status");
    });
  });

  // ── BOND HASH INTEGRITY ──────────────────────────────────────────────────────
  describe("Bond Hash Integrity", function () {
    it("Should verify bond hash correctly", async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      expect(await ais1.verifyBondIntegrity(1)).to.be.true;
    });
  });

  // ── LOOKUPS ──────────────────────────────────────────────────────────────────
  describe("Bond Lookups", function () {
    it("Should look up bond by agentDid", async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      const bondId = await ais1.getBondByAgentDid(sampleAgent.agentDid);
      expect(bondId).to.equal(1);
    });

    it("Should look up bonds by sponsorDid", async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      const bonds = await ais1.getBondsBySponsorDid(sampleSponsor.sponsorDid);
      expect(bonds.length).to.equal(1);
      expect(bonds[0]).to.equal(1);
    });

    it("Should retrieve full bond data", async function () {
      await ais1.connect(issuer).issueBond(sampleAgent, sampleSponsor, 1, HCS_TOPIC);
      const [agent, sponsor, bond] = await ais1.getBond(1);
      expect(agent.agentDid).to.equal(sampleAgent.agentDid);
      expect(sponsor.legalName).to.equal(sampleSponsor.legalName);
      expect(bond.tier).to.equal(1);
    });
  });
});
