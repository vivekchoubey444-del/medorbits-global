"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.resolve(__dirname, "../openapi.yaml");

function main() {
  if (!fs.existsSync(file)) {
    console.error("openapi.yaml is missing. Run npm run download:openapi.");
    process.exitCode = 1;
    return;
  }

  const content = fs.readFileSync(file, "utf8");
  const version = content.match(/^openapi:\s*([^\s#]+)/m);
  const title = content.match(/^\s{2}title:\s*(.+)$/m);
  const apiVersion = content.match(/^\s{2}version:\s*(.+)$/m);

  console.log(`Specification: ${version ? version[1] : "unknown"}`);
  console.log(`API title: ${title ? title[1].trim() : "not detected"}`);
  console.log(`API version: ${apiVersion ? apiVersion[1].trim() : "not detected"}`);
  console.log(`Last modified: ${fs.statSync(file).mtime.toISOString()}`);
}

main();
