
#!/usr/bin/env node

/**
 * MedOrbits HTML Validator
 * File: tools/validate-html.js
 * Version: 2.0.0
 *
 * Usage:
 *   node tools/validate-html.js
 *   node tools/validate-html.js pages
 *   node tools/validate-html.js index.html
 *
 * Options:
 *   --help
 *   --version
 *
 * Checks:
 *   - HTML parsing errors
 *   - Missing local script, stylesheet, image and link targets
 *   - Duplicate IDs
 *   - Missing image alt attributes
 *   - Broken local HTML fragment references
 *
 * Dependency:
 *   npm install --save-dev parse5
 *
 * Safety:
 *   - Read-only.
 *   - Does not execute application code.
 *   - Does not install dependencies.
 *   - Does not follow symbolic links.
 *   - Rejects paths outside the repository.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT = path.resolve(SCRIPT_DIR, "..");

const VERSION = "2.0.0";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "vendor",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo"
]);

const HTML_EXTENSIONS = new Set([
  ".html",
  ".htm"
]);

const REFERENCE_ATTRIBUTES = {
  script: ["src"],
  img: ["src", "srcset"],
  source: ["src", "srcset"],
  video: ["src", "poster"],
  audio: ["src"],
  iframe: ["src"],
  embed: ["src"],
  track: ["src"],
  link: ["href"],
  a: ["href"],
  form: ["action"]
};

const results = {
  checked: 0,
  passed: 0,
  failed: 0,
  skipped: 0
};

const failures = [];

function printHelp() {
  console.log(`
MedOrbits HTML Validator v${VERSION}

Usage:
  node tools/validate-html.js [options] [paths...]

Examples:
  node tools/validate-html.js
  node tools/validate-html.js pages
  node tools/validate-html.js index.html

Options:
  --help       Show help.
  --version    Show version.

Checks:
  HTML parsing, duplicate IDs, image alt attributes,
  local references and local HTML fragments.

Dependency:
  npm install --save-dev parse5
`);
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
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

function reportPass(file) {
  results.checked++;
  results.passed++;

  console.log(`[PASS] ${relativePath(file)}`);
}

function reportFailure(file, errors) {
  results.checked++;
  results.failed++;

  const relative = relativePath(file);

  console.error(`\n[FAIL] ${relative}`);

  for (const error of errors) {
    console.error(`  - ${error}`);
    failures.push(`${relative}: ${error}`);
  }
}

function reportSkip(message) {
  results.skipped++;
  console.log(`[SKIP] ${message}`);
}

function collectHtmlFiles(directory, output = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `Cannot read directory ${relativePath(directory)}: ${error.message}`
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectHtmlFiles(fullPath, output);
      }

      continue;
    }

    if (
      entry.isFile() &&
      HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      output.push(fullPath);
    }
  }

  return output;
}

function resolveTargets(targets) {
  const files = [];

  for (const input of targets) {
    const target = path.resolve(ROOT, input);

    if (!isInsideRoot(target)) {
      throw new Error(
        `Path outside repository rejected: ${input}`
      );
    }

    let stat;

    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      throw new Error(
        `Cannot access ${input}: ${error.message}`
      );
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are not permitted: ${input}`
      );
    }

    if (stat.isFile()) {
      if (!HTML_EXTENSIONS.has(path.extname(target).toLowerCase())) {
        throw new Error(`Not an HTML file: ${input}`);
      }

      files.push(target);
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...collectHtmlFiles(target));
      continue;
    }

    throw new Error(`Unsupported path: ${input}`);
  }

  return [...new Set(files)].sort();
}

function walk(node, callback) {
  callback(node);

  for (const child of node.childNodes || []) {
    walk(child, callback);
  }

  if (node.content) {
    walk(node.content, callback);
  }
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&#([0-9]+);/g, (_, code) =>
      String.fromCodePoint(Number(code))
    );
}

function isExternalReference(value) {
  return (
    /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("javascript:")
  );
}

function extractSrcset(value) {
  // Simple srcset extraction. Data URLs are excluded because their
  // embedded commas make simple comma-separated parsing unreliable.
  if (/^\s*data:/i.test(value)) {
    return [];
  }

  return value
    .split(",")
    .map(candidate => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function resolveLocalReference(raw, htmlFile) {
  const value = decodeEntities(raw).trim();

  if (!value || isExternalReference(value)) {
    return null;
  }

  // Root-relative URLs are resolved against the repository root.
  // Relative URLs are resolved against the HTML file's directory.
  const isRootRelative = value.startsWith("/");
  const withoutQueryOrHash = value.split(/[?#]/, 1)[0];

  if (!withoutQueryOrHash) {
    return null;
  }

  if (/[${}]/.test(withoutQueryOrHash)) {
    return {
      skipped: true,
      reason: "Dynamic template reference"
    };
  }

  let decodedPath;

  try {
    decodedPath = decodeURIComponent(withoutQueryOrHash);
  } catch {
    return {
      error: `Invalid URL encoding: ${value}`
    };
  }

  if (decodedPath.includes("\0")) {
    return {
      error: `Invalid null byte in URL: ${value}`
    };
  }

  const base = isRootRelative
    ? ROOT
    : path.dirname(htmlFile);

  const target = path.resolve(
    base,
    decodedPath.replace(/^\/+/, "")
  );

  if (!isInsideRoot(target)) {
    return {
      error: `Reference escapes repository root: ${value}`
    };
  }

  return {
    target,
    fragment: value.includes("#")
      ? value.slice(value.indexOf("#") + 1)
      : ""
  };
}

function inspectTarget(target) {
  let stat;

  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false
      };
    }

    return {
      error: `Cannot inspect target: ${error.message}`
    };
  }

  if (stat.isSymbolicLink()) {
    return {
      error: "Target is a symbolic link."
    };
  }

  let realPath;

  try {
    realPath = fs.realpathSync(target);
  } catch (error) {
    return {
      error: `Cannot resolve target: ${error.message}`
    };
  }

  if (!isInsideRoot(realPath)) {
    return {
      error: "Resolved target escapes repository root."
    };
  }

  return {
    exists: true,
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory()
  };
}

function parseHtml(source, parse5) {
  const parseErrors = [];

  const document = parse5.parse(source, {
    sourceCodeLocationInfo: true,

    onParseError(error) {
      parseErrors.push(
        `HTML parse error at line ${error.startLine || "?"}, ` +
        `column ${error.startCol || "?"}: ${error.code}`
      );
    }
  });

  return {
    document,
    parseErrors
  };
}

function checkHtml(file, parse5) {
  const errors = [];
  const ids = new Set();
  const references = [];

  let stat;

  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    return [`Cannot inspect HTML file: ${error.message}`];
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    return ["HTML path must be a regular non-symbolic-link file."];
  }

  if (stat.size > MAX_FILE_SIZE) {
    return [
      `HTML file exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB size limit.`
    ];
  }

  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    return [`Cannot read HTML file: ${error.message}`];
  }

  const { document, parseErrors } = parseHtml(source, parse5);

  errors.push(...parseErrors);

  walk(document, node => {
    if (!node.tagName) {
      return;
    }

    const attrs = Object.fromEntries(
      (node.attrs || []).map(attribute => [
        attribute.name.toLowerCase(),
        attribute.value
      ])
    );

    const line = node.sourceCodeLocation?.startLine || "?";

    if (Object.hasOwn(attrs, "id")) {
      const id = attrs.id;

      if (ids.has(id)) {
        errors.push(
          `Duplicate id="${id}" at line ${line}.`
        );
      }

      ids.add(id);
    }

    if (
      node.tagName === "img" &&
      !Object.hasOwn(attrs, "alt")
    ) {
      errors.push(
        `Image missing alt attribute at line ${line}.`
      );
    }

    for (const attribute of REFERENCE_ATTRIBUTES[node.tagName] || []) {
      const value = attrs[attribute];

      if (value === undefined || value.trim() === "") {
        continue;
      }

      if (attribute === "srcset") {
        for (const url of extractSrcset(value)) {
          references.push({
            url,
            line,
            tag: node.tagName,
            attribute
          });
        }
      } else {
        references.push({
          url: value,
          line,
          tag: node.tagName,
          attribute
        });
      }
    }
  });

  for (const reference of references) {
    const resolved = resolveLocalReference(
      reference.url,
      file
    );

    if (!resolved) {
      continue;
    }

    if (resolved.skipped) {
      continue;
    }

    if (resolved.error) {
      errors.push(
        `${resolved.error} at line ${reference.line}.`
      );
      continue;
    }

    // Fragment-only links refer to the current document.
    const target = resolved.target;

    const targetInfo = inspectTarget(target);

    if (targetInfo.error) {
      errors.push(
        `${targetInfo.error} at line ${reference.line}: ${reference.url}`
      );
      continue;
    }

    if (!targetInfo.exists) {
      errors.push(
        `Missing local target at line ${reference.line}: ${reference.url}`
      );
      continue;
    }

    if (
      resolved.fragment &&
      targetInfo.isFile &&
      HTML_EXTENSIONS.has(path.extname(target).toLowerCase())
    ) {
      let targetSource;

      try {
        targetSource = fs.readFileSync(target, "utf8");
      } catch {
        errors.push(
          `Cannot read fragment target at line ${reference.line}: ${reference.url}`
        );
        continue;
      }

      const fragmentIds = new Set();
      const fragmentDocument = parse5.parse(targetSource);

      walk(fragmentDocument, node => {
        if (!node.tagName) return;

        const idAttribute = node.attrs?.find(
          attribute => attribute.name.toLowerCase() === "id"
        );

        if (idAttribute) {
          fragmentIds.add(idAttribute.value);
        }

        if (node.tagName === "a") {
          const nameAttribute = node.attrs?.find(
            attribute => attribute.name.toLowerCase() === "name"
          );

          if (nameAttribute) {
            fragmentIds.add(nameAttribute.value);
          }
        }
      });

      let decodedFragment;

      try {
        decodedFragment = decodeURIComponent(resolved.fragment);
      } catch {
        errors.push(
          `Invalid fragment encoding at line ${reference.line}: ${reference.url}`
        );
        continue;
      }

      if (!fragmentIds.has(decodedFragment)) {
        errors.push(
          `Missing fragment "#${decodedFragment}" at line ${reference.line}: ${reference.url}`
        );
      }
    }
  }

  return errors;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version")) {
    console.log(`MedOrbits HTML Validator v${VERSION}`);
    return;
  }

  if (args.some(arg => arg.startsWith("--"))) {
    console.error("[ERROR] Unknown option.");
    printHelp();
    process.exitCode = 2;
    return;
  }

  let parse5;

  try {
    const module = await import("parse5");
    parse5 = module.default ?? module;
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" ||
      error.code === "MODULE_NOT_FOUND"
    ) {
      console.error("[ERROR] parse5 is not installed.");
      console.error("Run: npm install --save-dev parse5");
      process.exitCode = 2;
      return;
    }

    throw error;
  }

  let files;

  try {
    files = args.length > 0
      ? resolveTargets(args)
      : collectHtmlFiles(ROOT);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (files.length === 0) {
    reportSkip("No HTML files found.");
    return;
  }

  console.log("============================================================");
  console.log("MedOrbits HTML Validation");
  console.log("============================================================");
  console.log(`Repository: ${ROOT}`);
  console.log(`Version:    ${VERSION}`);
  console.log(`Files:      ${files.length}`);
  console.log("============================================================");

  for (const file of files) {
    try {
      const errors = checkHtml(file, parse5);

      if (errors.length > 0) {
        reportFailure(file, errors);
      } else {
        reportPass(file);
      }
    } catch (error) {
      reportFailure(file, [
        `Unexpected validation error: ${error.message}`
      ]);
    }
  }

  console.log("\n============================================================");
  console.log("MedOrbits HTML Validation Summary");
  console.log("============================================================");
  console.log(`Checked: ${results.checked}`);
  console.log(`Passed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log("============================================================");

  if (results.failed > 0) {
    console.error("\n[RESULT] HTML VALIDATION FAILED");
    process.exitCode = 1;
    return;
  }

  console.log("\n[RESULT] All checked HTML files passed the configured checks.");
  console.log(
    "Note: this is not a complete accessibility, CSS, browser or application-runtime audit."
  );
}

main().catch(error => {
  console.error(`[FATAL] ${error.stack || error.message}`);
  process.exitCode = 2;
});
