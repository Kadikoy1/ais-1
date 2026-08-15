const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(root, "ais-1-website"));

const files = [
  ["registry.json", "registry.json"],
  [path.join("resolve", "payagent-001.json"), path.join("resolve", "payagent-001.json")],
  [path.join("resolve", "humphrey-soa-001.json"), path.join("resolve", "humphrey-soa-001.json")],
];

for (const [sourceName, targetName] of files) {
  const source = path.join(root, sourceName);
  const target = path.join(output, targetName);
  const data = fs.readFileSync(source);
  JSON.parse(data.toString("utf8"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}

console.log(`Prepared ${files.length} canonical AIS-1 JSON resources in ${output}`);
