
#!/usr/bin/env node

"use strict";

/**
 * MedOrbits -- HTML Validation Utility
 * File: scripts/validate-html.mjs
 *
 * Requirements:
 *   Node.js >= 20
 *
 * Usage:
 *   node scripts/validate-html.mjs
 *   node scripts/validate-html.mjs --strict
 *   node scripts/validate-html.mjs --dir education/india
 *   node scripts/validate-html.mjs --json
 *
 * Safety:
 * - Read-only.
 * - No network requests.
 * - No dependency installation.
 * - Does not rewrite or delete source files.
 *
 * Note:
 * This is a lightweight static validator, not a complete HTML5
 * conformance checker. Use the Nu HTML Checker for full validation.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".wrangler",
  "__pycache__",
]);

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const JSON_OUTPUT = args.includes("--json");
const HELP = args.includes("--help") || args.includes("-h");

const dirIndex = args.indexOf("--dir");
const requestedDirectory =
  dirIndex >= 0 ? args[dirIndex + 1] : null;

const errors = [];
const warnings = [];
let filesChecked = 0;
let filesPassed = 0;

function displayPath(file) {
  return path.relative(ROOT, file) || ".";
}

function reportError(file, message, line = null) {
  errors.push({
    file: displayPath(file),
    message,
    line,
  });

  if (!JSON_OUTPUT) {
    console.error(
      `ERROR ${displayPath(file)}` +
      (line ? `:${line}` : "") +
      ` -- ${message}`
    );
  }
}

function reportWarning(file, message, line = null) {
  warnings.push({
    file: displayPath(file),
    message,
    line,
  });

  if (!JSON_OUTPUT) {
    console.warn(
      `WARN  ${displayPath(file)}` +
      (line ? `:${line}` : "") +
      ` -- ${message}`
    );
  }
}

function lineAt(source, position) {
  return source.slice(0, position).split(/\r\n|\r|\n/).length;
}

function isInsideRoot(target) {
  const relative = path.relative(ROOT, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function getTargetDirectory() {
  if (dirIndex < 0) {
    return ROOT;
  }

  if (!requestedDirectory || requestedDirectory.startsWith("--")) {
    throw new Error("--dir requires a directory path.");
  }

  const target = path.resolve(ROOT, requestedDirectory);

  if (!isInsideRoot(target)) {
    throw new Error("--dir must remain inside the repository.");
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`Directory not found: ${requestedDirectory}`);
  }

  return target;
}

function collectHtmlFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (error) {
    reportError(directory, `Cannot read directory: ${error.message}`);
    return results;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectHtmlFiles(path.join(directory, entry.name), results);
      }

      continue;
    }

    if (
      entry.isFile() &&
      /\.html?$/i.test(entry.name)
    ) {
      results.push(path.join(directory, entry.name));
    }
  }

  return results;
}

/**
 * Remove comments and raw-text elements for tag scanning.
 * This is a lightweight scanner, not a full HTML parser.
 */
function prepareForTagScanning(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, (match) => " ".repeat(match.length))
    .replace(
      /<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      (match) => " ".repeat(match.length)
    );
}

function parseAttributes(tag) {
  const attributes = new Map();

  const body = tag.replace(/^<[^\s/>]+/, "").replace(/\/?>$/, "");
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;

  while ((match = pattern.exec(body)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (attributes.has(name)) {
      attributes.set(`__duplicate__${name}`, value);
    } else {
      attributes.set(name, value);
    }
  }

  return attributes;
}

function decodeBasicEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function checkLocalReference(file, reference) {
  const value = decodeBasicEntities(reference.trim());

  if (
    !value ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return;
  }

  const pathname = value.split(/[?#]/, 1)[0];

  if (!pathname) {
    return;
  }

  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    reportError(file, `Invalid URL encoding in reference: ${reference}`);
    return;
  }

  if (decoded.includes("\0")) {
    reportError(file, `Invalid null byte in reference: ${reference}`);
    return;
  }

  const target = path.resolve(path.dirname(file), decoded);

  if (!isInsideRoot(target)) {
    reportError(file, `Local reference escapes repository: ${reference}`);
    return;
  }

  const candidates = [];

  if (decoded.endsWith("/")) {
    candidates.push(path.join(target, "index.html"));
  } else {
    candidates.push(target);

    // Friendly directory URLs may resolve to index.html.
    if (!path.extname(decoded)) {
      candidates.push(path.join(target, "index.html"));
    }
  }

  if (!candidates.some((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  })) {
    reportWarning(file, `Local reference target not found: ${reference}`);
  }
}

function validateHtml(file) {
  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    reportError(file, `Cannot read HTML: ${error.message}`);
    return false;
  }

  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }

  if (!source.trim()) {
    reportError(file, "HTML file is empty.");
    return false;
  }

  const initialErrorCount = errors.length;
  const initialWarningCount = warnings.length;

  if (!/<!doctype\s+html\s*>/i.test(source)) {
    reportWarning(file, "Missing HTML5 DOCTYPE.");
  }

  if (!/<html\b[^>]*>/i.test(source)) {
    reportError(file, "Missing <html> element.");
  }

  if (!/<head\b[^>]*>/i.test(source)) {
    reportError(file, "Missing <head> element.");
  }

  if (!/<body\b[^>]*>/i.test(source)) {
    reportError(file, "Missing <body> element.");
  }

  if (!/<\/html\s*>/i.test(source)) {
    reportError(file, "Missing closing </html> tag.");
  }

  if (!/<meta\b[^>]*charset\s*=/i.test(source)) {
    reportWarning(file, "Missing character encoding declaration.");
  }

  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(source)) {
    reportWarning(file, "Missing viewport meta tag.");
  }

  const scanningSource = prepareForTagScanning(source);
  const ids = new Map();

  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  const stack = [];
  let tagMatch;

  while ((tagMatch = tagPattern.exec(scanningSource)) !== null) {
    const tag = tagMatch[0];
    const tagName = tagMatch[1].toLowerCase();
    const line = lineAt(source, tagMatch.index);
    const isClosing = /^<\//.test(tag);
    const isSelfClosing = /\/\s*>$/.test(tag);

    if (isClosing) {
      if (voidElements.has(tagName)) {
        reportWarning(file, `Void element </${tagName}> should not be closed.`, line);
        continue;
      }

      const expectedIndex = stack.map((item) => item.name).lastIndexOf(tagName);

      if (expectedIndex === -1) {
        reportWarning(file, `Unexpected closing tag </${tagName}>.`, line);
      } else {
        if (expectedIndex !== stack.length - 1) {
          reportWarning(
            file,
            `Possible misnested closing tag </${tagName}>.`,
            line
          );
        }

        stack.splice(expectedIndex, 1);
      }

      continue;
    }

    if (!voidElements.has(tagName) && !isSelfClosing) {
      stack.push({ name: tagName, line });
    }

    const attributes = parseAttributes(tag);

    for (const name of attributes.keys()) {
      if (name.startsWith("__duplicate__")) {
        reportWarning(
          file,
          `Duplicate attribute "${name.slice("__duplicate__".length)}".`,
          line
        );
      }
    }

    if (attributes.has("id")) {
      const id = attributes.get("id");

      if (!id) {
        reportWarning(file, "Empty id attribute.", line);
      } else if (ids.has(id)) {
        reportError(
          file,
          `Duplicate id "${id}" (first used on line ${ids.get(id)}).`,
          line
        );
      } else {
        ids.set(id, line);
      }
    }

    if (
      tagName === "img" &&
      !attributes.has("alt")
    ) {
      reportWarning(file, "Image is missing its alt attribute.", line);
    }

    if (
      tagName === "a" &&
      attributes.has("target") &&
      attributes.get("target") === "_blank"
    ) {
      const rel = (attributes.get("rel") || "").toLowerCase();

      if (!rel.split(/\s+/).includes("noopener")) {
        reportWarning(
          file,
          'Link with target="_blank" should include rel="noopener".',
          line
        );
      }
    }

    const referenceAttributes = {
      a: ["href"],
      link: ["href"],
      script: ["src"],
      img: ["src"],
      source: ["src"],
      video: ["src", "poster"],
      audio: ["src"],
      iframe: ["src"],
    };

    for (const attribute of referenceAttributes[tagName] || []) {
      if (!attributes.has(attribute)) continue;

      checkLocalReference(file, attributes.get(attribute));
    }
  }

  for (const item of stack) {
    reportWarning(
      file,
      `Possibly unclosed <${item.name}> element.`,
      item.line
    );
  }

  const passed =
    errors.length === initialErrorCount &&
    (!STRICT || warnings.length === initialWarningCount);

  if (passed) {
    filesPassed += 1;

    if (!JSON_OUTPUT) {
      console.log(`PASS ${displayPath(file)}`);
    }
  }

  return passed;
}

function main() {
  if (HELP) {
    console.log(`
MedOrbits HTML Validator

Usage:
  node scripts/validate-html.mjs [options]

Options:
  --dir <path>  Validate a directory inside the repository
  --strict      Treat warnings as failures
  --json        Print machine-readable JSON
  --help, -h    Show help
`);
    return 0;
  }

  let directory;

  try {
    directory = getTargetDirectory();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return 2;
  }

  const files = collectHtmlFiles(directory);

  for (const file of files) {
    filesChecked += 1;
    validateHtml(file);
  }

  const report = {
    ok: errors.length === 0 && (!STRICT || warnings.length === 0),
    filesChecked,
    filesPassed,
    errors: errors.length,
    warnings: warnings.length,
    details: {
      errors,
      warnings,
    },
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nHTML Validation Summary");
    console.log("-----------------------");
    console.log(`Files checked: ${filesChecked}`);
    console.log(`Files passed:  ${filesPassed}`);
    console.log(`Errors:        ${errors.length}`);
    console.log(`Warnings:      ${warnings.length}`);
    console.log(
      report.ok
        ? "\nHTML validation passed."
        : "\nHTML validation failed."
    );
  }

  return report.ok ? 0 : 1;
}

process.exitCode = main();
