#!/usr/bin/env node
"use strict";

/**
 * =============================================================================
 * MedOrbits -- Environment Configuration Audit
 * File: tools/enviroment-audit.js
 * Release: 1.0.0
 * Runtime: Node.js >=20
 *
 * PURPOSE
 *   - Discover statically referenced environment variables.
 *   - Compare source references with .env.example and the optional schema.
 *   - Identify unused template entries and undocumented references.
 *   - Flag suspicious placeholders and unsafe configuration patterns.
 *   - Produce a safe audit report without exposing environment values.
 *
 * SAFETY
 *   - Read-only; does not modify source files or configuration.
 *   - Never loads or prints actual .env values.
 *   - Does not connect to databases, networks, or external services.
 *   - Does not install dependencies or execute application code.
 *
 * LIMITATIONS
 *   Static analysis cannot prove that a feature is implemented securely.
 *   Dynamic property access, aliases, and runtime configuration loaders
 *   may require manual review.
 * =============================================================================
 */

const fs = require("node:fs");
const path = require("node:path");

const TOOL_DIR = __dirname;
const DEFAULT_ROOT = path.resolve(TOOL_DIR, "..");

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
  ".jsx",
  ".tsx",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "coverage",
  ".nyc_output",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
]);

const MAX_SOURCE_FILES = 20000;
const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TEMPLATE_BYTES = 1024 * 1024;

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SECRET_NAME_PATTERN =
  /(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIAL|WEBHOOK_SECRET|DATABASE_URL|REDIS_URL)/i;

const SUSPICIOUS_PLACEHOLDER_PATTERN =
  /^(?:REPLACE_WITH_|CHANGE_ME|CHANGEME|YOUR[_-]|<[^>]+>|\$\{[^}]+\}|TODO$|FIXME$)/i;

const BOOLEAN_VALUES = new Set(["true", "false"]);

function log(message) {
  console.log(`[MedOrbits Env Audit] ${message}`);
}

function warn(message) {
  console.warn(`[MedOrbits Env Audit] WARNING: ${message}`);
}

function fail(message) {
  console.error(`[MedOrbits Env Audit] ERROR: ${message}`);
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function readUtf8File(filePath, maxBytes) {
  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    throw new Error("Expected a regular file.");
  }

  if (stat.size > maxBytes) {
    throw new Error("File exceeds the configured size limit.");
  }

  return fs.readFileSync(filePath, "utf8");
}

function discoverSourceFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      // Do not follow symbolic links outside the repository.
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (
          entry.name.startsWith(".") ||
          EXCLUDED_DIRECTORIES.has(entry.name)
        ) {
          continue;
        }

        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }

      files.push(fullPath);

      if (files.length > MAX_SOURCE_FILES) {
        throw new Error(
          `Source file limit exceeded (${MAX_SOURCE_FILES}). Narrow the scan scope.`,
        );
      }

      // Defensive containment check.
      if (!isWithinRoot(rootDir, fullPath)) {
        throw new Error(`Source path escaped repository root: ${relativePath}`);
      }
    }
  }

  return files.sort();
}

/**
 * Finds common static references:
 *
 *   process.env.PORT
 *   process.env["PORT"]
 *   process.env['PORT']
 *   import.meta.env.VITE_API_URL
 *   const { PORT } = process.env
 *
 * This is heuristic scanning, not a full JavaScript parser.
 */
function findEnvironmentReferences(source) {
  const names = new Set();

  const patterns = [
    /\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bprocess\s*\.\s*env\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
    /\bimport\s*\.\s*meta\s*\.\s*env\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bimport\s*\.\s*meta\s*\.\s*env\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  }

  const destructuringPatterns = [
    /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*process\s*\.\s*env\b/g,
    /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*import\s*\.\s*meta\s*\.\s*env\b/g,
  ];

  for (const pattern of destructuringPatterns) {
    for (const match of source.matchAll(pattern)) {
      for (const member of match[1].split(",")) {
        const candidate = member.trim().match(
          /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[A-Za-z_$][A-Za-z0-9_$]*)?(?:\s*=.*)?$/,
        );

        if (candidate) {
          names.add(candidate[1]);
        }
      }
    }
  }

  return names;
}

function scanSource(rootDir) {
  const files = discoverSourceFiles(rootDir);
  const usage = new Map();
  const skippedFiles = [];

  for (const fullPath of files) {
    let source;

    try {
      source = readUtf8File(fullPath, MAX_SOURCE_FILE_BYTES);
    } catch {
      skippedFiles.push(path.relative(rootDir, fullPath));
      continue;
    }

    const relativePath = path.relative(rootDir, fullPath);

    for (const name of findEnvironmentReferences(source)) {
      if (!usage.has(name)) {
        usage.set(name, new Set());
      }

      usage.get(name).add(relativePath);
    }
  }

  return {
    scannedFiles: files.length - skippedFiles.length,
    usage,
    skippedFiles,
  };
}

/**
 * Read .env.example as a key inventory only.
 *
 * Values are not retained in the returned data or printed.
 * This function does not read .env, .env.production, or other live
 * environment files.
 */
function readEnvironmentTemplate(rootDir) {
  const templatePath = path.join(rootDir, ".env.example");

  if (!fs.existsSync(templatePath)) {
    return {
      found: false,
      names: new Set(),
      suspiciousPlaceholders: [],
      invalidLines: [],
    };
  }

  const source = readUtf8File(templatePath, MAX_TEMPLATE_BYTES);
  const names = new Set();
  const suspiciousPlaceholders = [];
  const invalidLines = [];

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      invalidLines.push(index + 1);
      continue;
    }

    const name = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (!ENV_NAME_PATTERN.test(name)) {
      invalidLines.push(index + 1);
      continue;
    }

    names.add(name);

    // Only report the variable name and line number, never the value.
    if (value && SUSPICIOUS_PLACEHOLDER_PATTERN.test(value)) {
      suspiciousPlaceholders.push({
        name,
        line: index + 1,
      });
    }
  }

  return {
    found: true,
    names,
    suspiciousPlaceholders,
    invalidLines,
  };
}

function readSchemaNames(rootDir) {
  const schemaPath = path.join(rootDir, "config", "env.schema.js");

  if (!fs.existsSync(schemaPath)) {
    return {
      found: false,
      names: new Set(),
      note: "config/env.schema.js was not found.",
    };
  }

  // Intentionally do not import or execute the schema module.
  // This prevents repository code execution during a read-only audit.
  let source;

  try {
    source = readUtf8File(schemaPath, MAX_SOURCE_FILE_BYTES);
  } catch {
    return {
      found: false,
      names: new Set(),
      note: "Schema file could not be read within the size limit.",
    };
  }

  const names = new Set();

  // Recognizes conventional object entries such as:
  // PORT: Object.freeze({
  // NODE_ENV: Object.freeze({
  const pattern =
    /^\s{0,8}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*Object\.freeze\s*\(/gm;

  for (const match of source.matchAll(pattern)) {
    names.add(match[1]);
  }

  return {
    found: true,
    names,
    note:
      "Schema inventory is heuristic. It does not establish verified status or execute schema validation.",
  };
}

function sorted(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

function difference(left, right) {
  return new Set([...left].filter((item) => !right.has(item)));
}

function classifyVariables(source, template, schema) {
  const sourceNames = new Set(source.usage.keys());

  return {
    sourceReferenced: sorted(sourceNames),

    sourceMissingFromTemplate: template.found
      ? sorted(difference(sourceNames, template.names))
      : [],

    templateNotFoundInSource: template.found
      ? sorted(difference(template.names, sourceNames))
      : [],

    sourceMissingFromSchema: schema.found
      ? sorted(difference(sourceNames, schema.names))
      : [],

    schemaNotFoundInSource: schema.found
      ? sorted(difference(schema.names, sourceNames))
      : [],

    // These are static references only. Human review is still required.
    sourceLocations: Object.fromEntries(
      [...source.usage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, locations]) => [
          name,
          sorted(locations),
        ]),
    ),
  };
}

function buildReport(rootDir) {
  const source = scanSource(rootDir);
  const template = readEnvironmentTemplate(rootDir);
  const schema = readSchemaNames(rootDir);
  const classifications = classifyVariables(source, template, schema);

  const referencedSecretNames = classifications.sourceReferenced.filter(
    (name) => SECRET_NAME_PATTERN.test(name),
  );

  return {
    tool: "MedOrbits Environment Configuration Audit",
    version: "1.0.0",
    root: rootDir,
    mode: "read-only",
    scannedSourceFiles: source.scannedFiles,
    skippedSourceFiles: source.skippedFiles,
    templateFound: template.found,
    schemaFound: schema.found,
    schemaNote: schema.note,
    classifications,
    referencedSecretNames,
    suspiciousTemplatePlaceholders: template.suspiciousPlaceholders,
    invalidTemplateLineNumbers: template.invalidLines,
    summary: {
      sourceVariableCount: classifications.sourceReferenced.length,
      sourceMissingFromTemplate:
        classifications.sourceMissingFromTemplate.length,
      templateNotFoundInSource:
        classifications.templateNotFoundInSource.length,
      sourceMissingFromSchema:
        classifications.sourceMissingFromSchema.length,
      schemaNotFoundInSource:
        classifications.schemaNotFoundInSource.length,
      suspiciousTemplatePlaceholders:
        template.suspiciousPlaceholders.length,
    },
    limitations: [
      "Static scanning may miss dynamic environment-variable access.",
      "A source reference does not prove a feature is operational.",
      "Comments and unreachable code can create false positives.",
      "Schema inventory is not proof that an entry has been verified.",
      "The auditor does not inspect live process environment values.",
      "The auditor does not read .env or production environment files.",
      "Secret-name matches are indicators for review, not proof of exposure.",
    ],
  };
}

function printSection(title, entries) {
  console.log(`\n${title}`);

  if (!entries.length) {
    console.log("  None detected.");
    return;
  }

  for (const entry of entries) {
    console.log(`  - ${entry}`);
  }
}

function printReport(report) {
  console.log("");
  console.log("============================================================");
  console.log(report.tool);
  console.log("============================================================");
  console.log(`Root: ${report.root}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Source files scanned: ${report.scannedSourceFiles}`);
  console.log(`Template found: ${report.templateFound}`);
  console.log(`Schema found: ${report.schemaFound}`);

  console.log("\nSummary:");
  for (const [name, value] of Object.entries(report.summary)) {
    console.log(`  ${name}: ${value}`);
  }

  const categories = report.classifications;

  printSection(
    "Environment variables referenced in source",
    categories.sourceReferenced,
  );

  printSection(
    "Source references missing from .env.example",
    categories.sourceMissingFromTemplate,
  );

  printSection(
    "Template variables not found in source",
    categories.templateNotFoundInSource,
  );

  printSection(
    "Source references missing from schema inventory",
    categories.sourceMissingFromSchema,
  );

  printSection(
    "Schema entries not found in source",
    categories.schemaNotFoundInSource,
  );

  printSection(
    "Potential secret-related variable names (review required)",
    report.referencedSecretNames,
  );

  console.log("\nPotential unresolved template placeholders:");
  if (report.suspiciousTemplatePlaceholders.length === 0) {
    console.log("  None detected.");
  } else {
    for (const item of report.suspiciousTemplatePlaceholders) {
      console.log(`  - ${item.name} (line ${item.line})`);
    }
  }

  console.log("\nInvalid template line numbers:");
  if (report.invalidTemplateLineNumbers.length === 0) {
    console.log("  None detected.");
  } else {
    for (const line of report.invalidTemplateLineNumbers) {
      console.log(`  - Line ${line}`);
    }
  }

  console.log("\nFiles skipped:");
  if (report.skippedSourceFiles.length === 0) {
    console.log("  None.");
  } else {
    for (const file of report.skippedSourceFiles) {
      console.log(`  - ${file}`);
    }
  }

  console.log("\nLimitations:");
  for (const limitation of report.limitations) {
    console.log(`  - ${limitation}`);
  }

  console.log("\nNo environment values or secret values were printed.");
  console.log("============================================================\n");
}

function parseArgs(args) {
  const options = {
    rootDir: DEFAULT_ROOT,
    strict: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--root") {
      const next = args[index + 1];

      if (!next || next.startsWith("--")) {
        throw new Error("--root requires a directory path.");
      }

      options.rootDir = path.resolve(next);
      index += 1;
      continue;
    }

    if (argument === "--strict") {
      options.strict = true;
      continue;
    }

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`
MedOrbits environment audit

Usage:
  node tools/enviroment-audit.js [options]

Options:
  --root <directory>  Repository root to inspect.
  --strict            Exit nonzero when audit discrepancies are detected.
  --json              Print a machine-readable report.
  --help, -h          Show this help message.

Safety:
  Read-only. Does not load .env files or print environment values.
  The JSON report contains variable names and source paths, not values.
`);
}

function run() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const rootDir = path.resolve(options.rootDir);

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    fail("Repository root does not exist or is not a directory.");
    process.exitCode = 2;
    return;
  }

  try {
    const report = buildReport(rootDir);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (options.strict) {
      const hasDiscrepancies =
        !report.templateFound ||
        !report.schemaFound ||
        report.classifications.sourceMissingFromTemplate.length > 0 ||
        report.classifications.sourceMissingFromSchema.length > 0 ||
        report.suspiciousTemplatePlaceholders.length > 0 ||
        report.invalidTemplateLineNumbers.length > 0 ||
        report.skippedSourceFiles.length > 0;

      if (hasDiscrepancies) {
        fail("Strict audit found discrepancies. Review the report.");
        process.exitCode = 1;
      } else {
        log("Strict audit completed without detected discrepancies.");
      }
    }
  } catch (error) {
    fail(error.message);
    process.exitCode = 2;
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  findEnvironmentReferences,
  scanSource,
  readEnvironmentTemplate,
  readSchemaNames,
  classifyVariables,
  buildReport,
};
