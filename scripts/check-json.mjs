import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__"
]);

const errors = [];
const warnings = [];
let checked = 0;

function walk(directory) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(`${directory}: cannot read directory (${error.message})`);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }

    checked += 1;

    try {
      const source = fs.readFileSync(fullPath, "utf8");
      JSON.parse(source);

      if (strict && source.charCodeAt(0) === 0xFEFF) {
        warnings.push(`${path.relative(root, fullPath)}: remove UTF-8 BOM.`);
      }
    } catch (error) {
      errors.push(`${path.relative(root, fullPath)}: ${error.message}`);
    }
  }
}

walk(root);

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`JSON validation failed: ${errors.length} error(s), ${checked} file(s) checked.`);
  process.exitCode = 1;
} else {
  console.log(`JSON validation passed: ${checked} file(s) checked.`);
}
