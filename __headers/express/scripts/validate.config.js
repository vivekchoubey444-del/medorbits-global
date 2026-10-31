"use strict";

const fs = require("node:fs");
const path = require("node:path");

const configPath = path.join(__dirname, "..", "config", "security-headers.json");

try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (config.project !== "MedOrbits") {
    throw new Error("Unexpected project name.");
  }

  if (config.runtime !== "Express") {
    throw new Error("Runtime must be Express.");
  }

  const required = [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-Frame-Options",
    "Permissions-Policy"
  ];

  for (const header of required) {
    const value = config.defaults?.[header];

    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Missing required default: ${header}`);
    }
  }

  console.log("[PASS] MedOrbits Express header configuration is valid.");
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exitCode = 1;
}
