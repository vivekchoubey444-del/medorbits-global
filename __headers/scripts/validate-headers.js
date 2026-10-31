"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const HEADER_FILE = path.join(ROOT, "_headers");

const REQUIRED = [
  "X-Content-Type-Options",
  "Referrer-Policy"
];

const WARNINGS = [
  "X-Frame-Options",
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "Permissions-Policy"
];

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
}

function main() {
  console.log("\nMedOrbits Cloudflare Header Validator\n");

  if (!fs.existsSync(HEADER_FILE)) {
    fail("Missing Cloudflare _headers file.");
    return;
  }

  const content = fs.readFileSync(HEADER_FILE, "utf8");
  const lines = content.split(/\r?\n/);

  const headers = new Map();
  let currentPath = null;

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    if (!rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      currentPath = line;
      continue;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);

    if (!match) {
      fail(`Invalid header syntax at line ${index + 1}`);
      continue;
    }

    const name = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (!value) {
      fail(`Empty value for ${match[1]} at line ${index + 1}`);
    }

    const key = `${currentPath}:${name}`;

    if (headers.has(key)) {
      console.warn(`[WARNING] Duplicate header: ${match[1]}`);
    }

    headers.set(key, value);
  }

  const globalHeaders = [...headers.keys()]
    .filter(key => key.startsWith("/*:"))
    .map(key => key.split(":")[1]);

  for (const name of REQUIRED) {
    if (!globalHeaders.includes(name.toLowerCase())) {
      fail(`Missing recommended global header: ${name}`);
    }
  }

  for (const name of WARNINGS) {
    if (!globalHeaders.includes(name.toLowerCase())) {
      console.warn(`[WARNING] Review whether ${name} is required.`);
    }
  }

  if (!process.exitCode) {
    console.log("[SUCCESS] Basic header configuration validation passed.");
  }
}

main();