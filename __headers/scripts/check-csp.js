"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const HEADER_FILE = path.join(ROOT, "_headers");

const DANGEROUS_DIRECTIVES = [
  "'unsafe-eval'",
  "data:"
];

function main() {
  if (!fs.existsSync(HEADER_FILE)) {
    console.error("Cloudflare _headers file not found.");
    process.exit(1);
  }

  const content = fs.readFileSync(HEADER_FILE, "utf8");

  const cspLine = content
    .split(/\r?\n/)
    .find(line =>
      /^\s*Content-Security-Policy\s*:/i.test(line)
    );

  if (!cspLine) {
    console.error("Content-Security-Policy not found.");
    process.exit(1);
  }

  const policy = cspLine
    .replace(/^\s*Content-Security-Policy\s*:/i, "")
    .trim();

  console.log("\nMedOrbits CSP Review\n");

  const directives = policy
    .split(";")
    .map(item => item.trim())
    .filter(Boolean);

  const names = new Set();

  for (const directive of directives) {
    const [name, ...values] = directive.split(/\s+/);

    if (names.has(name)) {
      console.warn(`[WARNING] Duplicate directive: ${name}`);
    }

    names.add(name);

    console.log(`[DIRECTIVE] ${name}`);

    for (const value of values) {
      if (DANGEROUS_DIRECTIVES.includes(value)) {
        console.warn(
          `[REVIEW] Potentially unsafe CSP value: ${value}`
        );
      }
    }
  }

  for (const name of [
    "default-src",
    "object-src",
    "base-uri",
    "frame-ancestors"
  ]) {
    if (!names.has(name)) {
      console.warn(`[REVIEW] Missing directive: ${name}`);
    }
  }

  console.log("\nCSP inspection completed.");
}

main();