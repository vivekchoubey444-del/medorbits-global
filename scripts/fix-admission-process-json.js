"use strict";

const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(
process.cwd(),
"assets/data/admission-process.json"
);

function extractJsonDocuments(source) {
const documents = [];
let depth = 0;
let inString = false;
let escaped = false;
let start = -1;

for (let i = 0; i < source.length; i += 1) {
const char = source[i];

if (inString) {
  if (escaped) {
    escaped = false;
  } else if (char === "\\") {
    escaped = true;
  } else if (char === '"') {
    inString = false;
  }
  continue;
}
if (char === '"') {
  inString = true;
  continue;
}
if (char === "{") {
  if (depth === 0) start = i;
  depth += 1;
} else if (char === "}") {
  depth -= 1;
  if (depth < 0) {
    throw new Error("Unexpected closing brace.");
  }
  if (depth === 0 && start !== -1) {
    documents.push(source.slice(start, i + 1));
    start = -1;
  }
}

}

if (inString || depth !== 0) {
throw new Error("Incomplete JSON document.");
}

return documents;
}

function main() {
if (!fs.existsSync(filePath)) {
throw new Error(File not found: ${filePath});
}

const original = fs.readFileSync(filePath, "utf8");
const documents = extractJsonDocuments(original);

if (documents.length !== 2) {
throw new Error(
Expected exactly 2 JSON documents; found ${documents.length}.  +
"No changes were made."
);
}

// Validate both documents before selecting the expanded version.
JSON.parse(documents[0]);
const expanded = JSON.parse(documents[1]);

if (
expanded.schemaVersion !== "1.1.0" ||
!Array.isArray(expanded.processes) ||
expanded.processes.length === 0
) {
throw new Error(
"The second document does not match the expected schema."
);
}

const ids = expanded.processes.map((process) => process.id);
const slugs = expanded.processes.map((process) => process.slug);

if (new Set(ids).size !== ids.length) {
throw new Error("Duplicate process IDs detected.");
}

if (new Set(slugs).size !== slugs.length) {
throw new Error("Duplicate process slugs detected.");
}

// Write only after successful validation.
const backupPath = ${filePath}.bak;
fs.writeFileSync(backupPath, original);
fs.writeFileSync(
filePath,
${JSON.stringify(expanded, null, 2)}\n,
"utf8"
);

// Verify the final file.
const verified = JSON.parse(
fs.readFileSync(filePath, "utf8")
);

console.log("Admission JSON repaired successfully.");
console.log(Processes: ${verified.processes.length});
console.log(Backup: ${backupPath});
}

try {
main();
} catch (error) {
console.error(Repair failed: ${error.message});
process.exitCode = 1;
}