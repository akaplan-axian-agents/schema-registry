import fs from "node:fs";
import YAML from "yaml";

const requiredKeys = ["state_resource_group_name", "state_storage_account_name", "state_container_name", "state_key"];

const configPath = process.argv[2];

if (!configPath) {
  console.error("Usage: npm run github:env-config -- <config.yml>");
  process.exit(1);
}

const config = YAML.parse(fs.readFileSync(configPath, "utf8"));

if (!config || typeof config !== "object" || Array.isArray(config)) {
  console.error(`${configPath} must contain a YAML mapping.`);
  process.exit(1);
}

for (const key of requiredKeys) {
  const value = config[key];
  if (typeof value !== "string" || !value) {
    console.error(`${configPath} must define string key ${key}.`);
    process.exit(1);
  }
  if (value.includes("\n") || value.includes("\r")) {
    console.error(`${configPath} key ${key} must be a single-line value.`);
    process.exit(1);
  }
  console.log(`${key}=${value}`);
}
