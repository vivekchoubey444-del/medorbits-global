/**

* MedOrbits Local Coding Agent
* File: src/commands/audit.js
* Read-only repository audit command.
* Usage:
* node src/commands/audit.js
* node src/commands/audit.js /path/to/repository
* Optional environment variables:
* AGENT_ROOT
* AGENT_AUDIT_MAX_FILES
    */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROOT = path.resolve(MODULE_DIRECTORY, "../../..");

const MAX_FILES = parsePositiveInteger(
process.env.AGENT_AUDIT_MAX_FILES,
5000
);

const MAX_FILE_BYTES = 1024 * 1024;

const IGNORED_DIRECTORIES = new Set([
".git",
".hg",
".svn",
"node_modules",
".next",
".nuxt",
".output",
"dist",
"build",
"coverage",
".cache",
".turbo",
".vercel",
".idea",
".vscode",
]);

const SENSITIVE_FILENAMES = new Set([
".env",
".env.local",
".env.production",
"id_rsa",
"id_ed25519",
"credentials.json",
"service-account.json",
]);

const REQUIRED_PROJECT_FILES = [
"package.json",
"server.js",
];

const RECOMMENDED_DIRECTORIES = [
"src",
"src/agent",
"src/commands",
"src/config",
"src/providers",
"src/services",
"tests",
"public",
];

const SEVERITY_ORDER = {
critical: 0,
high: 1,
medium: 2,
low: 3,
info: 4,
};

function parsePositiveInteger(value, fallback) {
if (value === undefined || value === "") {
return fallback;
}

const parsed = Number.parseInt(value, 10);

return Number.isSafeInteger(parsed) && parsed > 0
? parsed
: fallback;
}

function makeFinding(
severity,
code,
message,
file = null,
line = null,
recommendation = null
) {
return {
severity,
code,
message,
file,
line,
recommendation,
};
}

function isWithinRoot(root, candidate) {
const relative = path.relative(root, candidate);

return (
relative === "" ||
(
relative !== ".." &&
!relative.startsWith(..${path.sep}) &&
!path.isAbsolute(relative)
)
);
}

function resolveRoot(input) {
if (typeof input !== "string" || input.trim() === "") {
throw new TypeError("Audit root must be a non-empty path.");
}

const root = path.resolve(input);

if (!path.isAbsolute(root)) {
throw new Error("Audit root must resolve to an absolute path.");
}

return root;
}

async function pathExists(filePath) {
try {
await fs.access(filePath);
return true;
} catch (error) {
if (error.code === "ENOENT" || error.code === "ENOTDIR") {
return false;
}

throw error;

}
}

async function readTextFile(filePath, findings, relativePath) {
try {
const stat = await fs.stat(filePath);

if (!stat.isFile()) {
  return null;
}
if (stat.size > MAX_FILE_BYTES) {
  findings.push(
    makeFinding(
      "info",
      "FILE_SKIPPED_LARGE",
      "File skipped because it exceeds the audit size limit.",
      relativePath,
      null,
      `Keep individual audited files below ${MAX_FILE_BYTES} bytes or inspect this file separately.`
    )
  );
  return null;
}
const content = await fs.readFile(filePath, "utf8");
// Avoid trying to audit binary files as source code.
if (content.includes("\0")) {
  return null;
}
return content;

} catch (error) {
findings.push(
makeFinding(
"low",
"FILE_READ_FAILED",
Could not read file: ${error.message},
relativePath
)
);

return null;

}
}

async function collectFiles(root, findings) {
const files = [];
const queue = [root];

while (queue.length > 0) {
const directory = queue.shift();

let entries;
try {
  entries = await fs.readdir(directory, {
    withFileTypes: true,
  });
} catch (error) {
  findings.push(
    makeFinding(
      "low",
      "DIRECTORY_READ_FAILED",
      `Could not read directory: ${error.message}`,
      path.relative(root, directory) || "."
    )
  );
  continue;
}
entries.sort((a, b) => a.name.localeCompare(b.name));
for (const entry of entries) {
  const absolutePath = path.join(directory, entry.name);
  const relativePath = path.relative(root, absolutePath);
  if (!isWithinRoot(root, absolutePath)) {
    findings.push(
      makeFinding(
        "high",
        "PATH_OUTSIDE_ROOT",
        "A discovered path resolves outside the repository root.",
        relativePath
      )
    );
    continue;
  }
  // Never follow symlinks during recursive traversal.
  if (entry.isSymbolicLink()) {
    continue;
  }
  if (entry.isDirectory()) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    queue.push(absolutePath);
    continue;
  }
  if (!entry.isFile()) {
    continue;
  }
  files.push({
    absolutePath,
    relativePath,
    name: entry.name,
  });
  if (files.length >= MAX_FILES) {
    findings.push(
      makeFinding(
        "medium",
        "AUDIT_FILE_LIMIT",
        `Audit stopped collecting files at the configured limit of ${MAX_FILES}.`,
        ".",
        null,
        "Increase AGENT_AUDIT_MAX_FILES if a larger audit is required."
      )
    );
    return files;
  }
}

}

return files;
}

async function auditProjectStructure(root, findings) {
for (const relativePath of REQUIRED_PROJECT_FILES) {
if (!(await pathExists(path.join(root, relativePath)))) {
findings.push(
makeFinding(
"medium",
"REQUIRED_FILE_MISSING",
Expected project file is missing: ${relativePath},
relativePath,
null,
"Confirm the project entry point and package configuration."
)
);
}
}

for (const relativePath of RECOMMENDED_DIRECTORIES) {
const absolutePath = path.join(root, relativePath);

if (!(await pathExists(absolutePath))) {
  findings.push(
    makeFinding(
      "info",
      "RECOMMENDED_DIRECTORY_MISSING",
      `Recommended directory is missing: ${relativePath}`,
      relativePath
    )
  );
}

}

const packagePath = path.join(root, "package.json");

if (!(await pathExists(packagePath))) {
return;
}

let packageJson;

try {
packageJson = JSON.parse(
await fs.readFile(packagePath, "utf8")
);
} catch (error) {
findings.push(
makeFinding(
"high",
"PACKAGE_JSON_INVALID",
package.json is not valid JSON: ${error.message},
"package.json",
null,
"Fix the JSON syntax before running npm scripts."
)
);

return;

}

if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
findings.push(
makeFinding(
"high",
"PACKAGE_JSON_SHAPE_INVALID",
"package.json must contain a JSON object.",
"package.json"
)
);

return;

}

if (packageJson.type !== "module") {
findings.push(
makeFinding(
"medium",
"ESM_TYPE_NOT_SET",
‘package.json does not declare "type": "module".’,
"package.json",
null,
‘Add "type": "module" if this project uses ES module imports.’
)
);
}

if (!packageJson.scripts || typeof packageJson.scripts !== "object") {
findings.push(
makeFinding(
"medium",
"PACKAGE_SCRIPTS_MISSING",
"package.json does not define a scripts object.",
"package.json",
null,
"Add scripts for starting the server and running tests."
)
);
} else {
for (const scriptName of ["start", "test"]) {
if (typeof packageJson.scripts[scriptName] !== "string") {
findings.push(
makeFinding(
"low",
"PACKAGE_SCRIPT_MISSING",
The "${scriptName}" npm script is missing.,
"package.json",
null,
Consider adding an npm run ${scriptName} command.
)
);
}
}
}

const enginesNode = packageJson.engines?.node;

if (!enginesNode) {
findings.push(
makeFinding(
"low",
"NODE_ENGINE_UNDECLARED",
"package.json does not specify a supported Node.js version.",
"package.json",
null,
‘Declare an engines.node range, such as ">=20.0.0", if Node.js 20+ is required.’
)
);
}

if (
packageJson.scripts &&
Object.values(packageJson.scripts).some(
(script) =>
typeof script === "string" &&
/node\s+–check|node\s+--check/.test(script)
)
) {
findings.push(
makeFinding(
"medium",
"INVALID_NODE_CHECK_DASH",
"An npm script appears to use a Unicode dash instead of ASCII double hyphens.",
"package.json",
null,
"Use node –check filename.js."
)
);
}
}

function lineNumberAt(source, index) {
return source.slice(0, index).split("\n").length;
}

function auditSecrets(relativePath, source, findings) {
const basename = path.basename(relativePath);

if (
SENSITIVE_FILENAMES.has(basename) &&
!basename.startsWith(".env.example")
) {
findings.push(
makeFinding(
"high",
"SENSITIVE_FILENAME",
"A potentially sensitive file is present in the repository.",
relativePath,
null,
"Verify that this file contains no real credentials or private keys."
)
);
}

const patterns = [
{
code: "POSSIBLE_PRIVATE_KEY",
severity: "high",
regex: /--–BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY--–/,
message: "Possible private key material found.",
recommendation: "Remove the secret from the repository and rotate it if genuine.",
},
{
code: "POSSIBLE_API_TOKEN",
severity: "high",
regex: /\b(?:api[-]?key|access[-]?token|client[_-]?secret)\s*[:=]\s*["’][^"’\r\n]{12,}["’]/i,
message: "Possible hard-coded API credential found.",
recommendation: "Load credentials from environment variables or a secret manager.",
},
{
code: "POSSIBLE_PASSWORD",
severity: "medium",
regex: /\b(?:password|passwd)\s*[:=]\s*["’][^"’\r\n]{4,}["’]/i,
message: "Possible hard-coded password found.",
recommendation: "Do not store real passwords in source code.",
},
];

for (const pattern of patterns) {
const match = pattern.regex.exec(source);

if (match) {
  findings.push(
    makeFinding(
      pattern.severity,
      pattern.code,
      pattern.message,
      relativePath,
      lineNumberAt(source, match.index),
      pattern.recommendation
    )
  );
}

}
}

function auditUnsafePatterns(relativePath, source, findings) {
const checks = [
{
code: "DYNAMIC_EVAL",
severity: "high",
regex: /\beval\s*(/,
message: "Use of eval() detected.",
recommendation: "Avoid evaluating dynamically generated JavaScript.",
},
{
code: "FUNCTION_CONSTRUCTOR",
severity: "medium",
regex: /\bnew\s+Function\s*(/,
message: "Dynamic Function constructor detected.",
recommendation: "Prefer explicit functions over dynamically compiled code.",
},
{
code: "SHELL_EXECUTION",
severity: "medium",
regex: /\bexec\s*(\s*[^,\n]+,\s*{/,
message: "A child-process exec call may use shell execution.",
recommendation: "Validate arguments carefully and prefer spawn with shell disabled.",
},
{
code: "DISABLED_TLS_VERIFICATION",
severity: "high",
regex: /rejectUnauthorized\s*:\sfalse/,
message: "TLS certificate verification appears to be disabled.",
recommendation: "Enable certificate verification for HTTPS connections.",
},
{
code: "WILDCARD_CORS",
severity: "medium",
regex: /Access-Control-Allow-Origin["’]?\s[:,]\s*["’]*["’]/i,
message: "Wildcard CORS configuration may expose an API to unintended origins.",
recommendation: "Restrict CORS to explicitly trusted origins when appropriate.",
},
];

for (const check of checks) {
const match = check.regex.exec(source);

if (!match) {
  continue;
}
findings.push(
  makeFinding(
    check.severity,
    check.code,
    check.message,
    relativePath,
    lineNumberAt(source, match.index),
    check.recommendation
  )
);

}
}

function auditEnvironmentFiles(files, findings) {
const ignoredByGit = files.some(
(file) => file.relativePath === ".gitignore"
);

const environmentFiles = files.filter((file) => {
const basename = path.basename(file.relativePath);

return (
  basename === ".env" ||
  /^\.env\.(?:local|development|production|test)$/.test(basename)
);

});

if (environmentFiles.length > 0) {
for (const file of environmentFiles) {
findings.push(
makeFinding(
"medium",
"ENVIRONMENT_FILE_PRESENT",
"An environment file is present. Confirm that it is not tracked or exposed.",
file.relativePath,
null,
"Keep actual secrets out of version control and use a sanitized .env.example."
)
);
}
}

if (!ignoredByGit) {
findings.push(
makeFinding(
"low",
"GITIGNORE_MISSING",
".gitignore was not found.",
".gitignore",
null,
"Ignore node_modules, local environment files, logs, temporary files, and generated reports."
)
);
}
}

async function auditFile(root, file, findings) {
const source = await readTextFile(
file.absolutePath,
findings,
file.relativePath
);

if (source === null) {
return;
}

auditSecrets(file.relativePath, source, findings);
auditUnsafePatterns(file.relativePath, source, findings);

if (
/.(?:js|mjs|cjs|jsx)$/.test(file.relativePath) &&
/^\s*(?:import|export)\s/m.test(source)
) {
// This is a heuristic only. Actual syntax checks are performed by
// the optional Node syntax-check phase below.
}

if (
file.relativePath === "server.js" &&
/listen\s*(\s*(?:["’]0.0.0.0["’]|0)/.test(source)
) {
findings.push(
makeFinding(
"medium",
"SERVER_BIND_ADDRESS_REVIEW",
"The server may bind to all network interfaces.",
file.relativePath,
null,
"Use loopback binding for a local-only agent unless remote access is explicitly required and protected."
)
);
}

if (
file.relativePath === "server.js" &&
/(?:AGENT_ALLOW_FILE_WRITES|ALLOW_FILE_WRITES)\s*.*(?:true|1)/i.test(source)
) {
findings.push(
makeFinding(
"info",
"FILE_WRITE_CONFIGURATION_REVIEW",
"A file-write configuration reference was found. Verify that writes require explicit approval.",
file.relativePath,
null,
"Keep writes disabled by default and require authorization and repository path validation."
)
);
}

if (
file.relativePath === "package-lock.json" &&
source.trim() === ""
) {
findings.push(
makeFinding(
"medium",
"EMPTY_LOCKFILE",
"package-lock.json is empty.",
file.relativePath,
null,
"Regenerate the lockfile with npm install and review the result."
)
);
}

// Ensure the caller supplied a path beneath the repository root.
if (!isWithinRoot(root, file.absolutePath)) {
findings.push(
makeFinding(
"high",
"AUDIT_PATH_ESCAPE",
"Audit attempted to read a file outside the configured root.",
file.relativePath
)
);
}
}

function runCommand(command, args, cwd, timeoutMs = 15000) {
return new Promise((resolve) => {
const child = spawn(command, args, {
cwd,
shell: false,
windowsHide: true,
stdio: ["ignore", "pipe", "pipe"],
env: {
…process.env,
CI: "1",
},
});

let stdout = "";
let stderr = "";
let settled = false;
const finish = (result) => {
  if (settled) {
    return;
  }
  settled = true;
  clearTimeout(timer);
  resolve(result);
};
const timer = setTimeout(() => {
  child.kill("SIGTERM");
  finish({
    ok: false,
    code: null,
    stdout,
    stderr,
    timedOut: true,
  });
}, timeoutMs);
child.stdout.on("data", (chunk) => {
  if (stdout.length < 20000) {
    stdout += chunk.toString();
  }
});
child.stderr.on("data", (chunk) => {
  if (stderr.length < 20000) {
    stderr += chunk.toString();
  }
});
child.on("error", (error) => {
  finish({
    ok: false,
    code: null,
    stdout,
    stderr: `${stderr}\n${error.message}`,
    timedOut: false,
  });
});
child.on("close", (code) => {
  finish({
    ok: code === 0,
    code,
    stdout,
    stderr,
    timedOut: false,
  });
});

});
}

async function auditJavaScriptSyntax(root, files, findings) {
const javascriptFiles = files.filter((file) =>
/.(?:js|mjs|cjs)$/.test(file.relativePath)
);

for (const file of javascriptFiles) {
const result = await runCommand(
process.execPath,
["–check", file.absolutePath],
root,
10000
);

if (result.ok) {
  continue;
}
findings.push(
  makeFinding(
    "high",
    result.timedOut ? "SYNTAX_CHECK_TIMEOUT" : "JAVASCRIPT_SYNTAX_ERROR",
    result.timedOut
      ? "JavaScript syntax check timed out."
      : "Node.js reported a JavaScript syntax error.",
    file.relativePath,
    null,
    (result.stderr || result.stdout || "Inspect this file with node --check.")
      .trim()
      .slice(0, 1200)
  )
);

}
}

function calculateSummary(findings, filesScanned) {
const counts = {
critical: 0,
high: 0,
medium: 0,
low: 0,
info: 0,
};

for (const finding of findings) {
if (Object.hasOwn(counts, finding.severity)) {
counts[finding.severity] += 1;
}
}

return {
filesScanned,
findings: findings.length,
counts,
passed: counts.critical === 0 && counts.high === 0,
};
}

function formatReport(report) {
const lines = [
"MedOrbits Local Coding Agent -- Repository Audit",
"=".repeat(48),
Root: ${report.root},
Started: ${report.startedAt},
Completed: ${report.completedAt},
Files scanned: ${report.summary.filesScanned},
Findings: ${report.summary.findings},
"",
"Severity summary:",
  Critical: ${report.summary.counts.critical},
  High:     ${report.summary.counts.high},
  Medium:   ${report.summary.counts.medium},
  Low:      ${report.summary.counts.low},
  Info:     ${report.summary.counts.info},
"",
Result: ${report.summary.passed ? "PASS" : "REVIEW REQUIRED"},
"",
];

if (report.findings.length === 0) {
lines.push("No findings were reported.");
return lines.join("\n");
}

lines.push("Findings:", "");

for (const finding of report.findings) {
const location = [
finding.file || "(repository)",
finding.line ? line ${finding.line} : null,
]
.filter(Boolean)
.join(":");

lines.push(
  `[${finding.severity.toUpperCase()}] ${finding.code}`,
  `  Location: ${location}`,
  `  ${finding.message}`
);
if (finding.recommendation) {
  lines.push(`  Recommendation: ${finding.recommendation}`);
}
lines.push("");

}

return lines.join("\n");
}

/**

* Run a read-only repository audit.
* Options:
* root: repository root path
* checkSyntax: run node –check on JavaScript files (default true)
    */
    export async function auditRepository(options = {}) {
    const configuredRoot =
    options.root ||
    process.env.AGENT_ROOT ||
    DEFAULT_ROOT;

const root = resolveRoot(configuredRoot);

const rootStat = await fs.stat(root).catch((error) => {
throw new Error(
Cannot access audit root "${root}": ${error.message},
{ cause: error }
);
});

if (!rootStat.isDirectory()) {
throw new Error(Audit root is not a directory: ${root});
}

const startedAt = new Date().toISOString();
const findings = [];

const files = await collectFiles(root, findings);

await auditProjectStructure(root, findings);
auditEnvironmentFiles(files, findings);

for (const file of files) {
await auditFile(root, file, findings);
}

if (options.checkSyntax !== false) {
await auditJavaScriptSyntax(root, files, findings);
}

findings.sort((a, b) => {
const severityDifference =
SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

if (severityDifference !== 0) {
  return severityDifference;
}
return (
  (a.file || "").localeCompare(b.file || "") ||
  (a.code || "").localeCompare(b.code || "")
);

});

const completedAt = new Date().toISOString();

const report = {
schemaVersion: 1,
root,
startedAt,
completedAt,
summary: calculateSummary(findings, files.length),
findings,
};

return report;
}

export async function runAudit(options = {}) {
const report = await auditRepository(options);

return {
report,
text: formatReport(report),
exitCode: report.summary.passed ? 0 : 1,
};
}

async function main() {
const rootArgument = process.argv[2];

try {
const result = await runAudit({
root: rootArgument || process.env.AGENT_ROOT || DEFAULT_ROOT,
});

console.log(result.text);
if (process.env.AGENT_AUDIT_JSON === "1") {
  console.log("\nJSON REPORT:");
  console.log(JSON.stringify(result.report, null, 2));
}
if (result.exitCode !== 0) {
  process.exitCode = result.exitCode;
}

} catch (error) {
console.error(Audit failed: ${error.message});
process.exitCode = 2;
}
}

const invokedPath = process.argv[1]
? path.resolve(process.argv[1])
: null;

const isMainModule =
invokedPath !== null &&
pathToFileURL(invokedPath).href === import.meta.url;

if (isMainModule) {
await main();
}