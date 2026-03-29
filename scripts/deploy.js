// scripts/deploy.js
// AIS-1 Deployment Script
// Deploys AIS1.sol to Base Sepolia (testnet) or Base mainnet

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════");
  console.log("  AIS-1 Agent Identity Standard — Deployment  ");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("");

  // Deploy AIS1
  console.log("Deploying AIS1.sol...");
  const AIS1 = await ethers.getContractFactory("AIS1");
  const ais1 = await AIS1.deploy();
  await ais1.waitForDeployment();

  const address = await ais1.getAddress();
  console.log("✓ AIS1 deployed to:", address);
  console.log("");

  // Verify deployment
  console.log("Verifying deployment...");
  const total = await ais1.totalBonds();
  console.log("✓ Total bonds:", total.toString());
  console.log("✓ Contract name:", await ais1.name());
  console.log("✓ Contract symbol:", await ais1.symbol());
  console.log("");

  // Grant ISSUER_ROLE to deployer (already granted in constructor)
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  const hasRole = await ais1.hasRole(ISSUER_ROLE, deployer.address);
  console.log("✓ Deployer has ISSUER_ROLE:", hasRole);
  console.log("");

  console.log("═══════════════════════════════════════════════");
  console.log("  Deployment Summary                          ");
  console.log("═══════════════════════════════════════════════");
  console.log("Contract address:", address);
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Set up Hedera HCS topic for canonical log");
  console.log("  2. Issue first test bonds (Bond 1 + Bond 2)");
  console.log("  3. Verify contract on block explorer");
  console.log("  4. Update AIS-1 spec with deployed address");
  console.log("═══════════════════════════════════════════════");

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
