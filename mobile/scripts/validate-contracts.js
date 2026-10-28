#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "api-contracts");
const required = ["README.md", "openapi.yaml"];
const missing = required.filter((name) => !fs.existsSync(path.join(root, name)));
if (missing.length) {
  console.error(`Missing API contract file(s): ${missing.join(", ")}`);
  process.exit(1);
}
const openapi = fs.readFileSync(path.join(root, "openapi.yaml"), "utf8");
if (!/^\s*openapi:\s*["']?3\./m.test(openapi)) {
  console.error("openapi.yaml does not declare an OpenAPI 3.x version.");
  process.exit(1);
}
console.log("Required contract files exist and the OpenAPI version declaration was found.");
console.log("Note: this lightweight check does not fully validate OpenAPI schemas.");
