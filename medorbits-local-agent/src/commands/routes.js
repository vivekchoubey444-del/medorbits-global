Create /medorbits-local-agent/src/commands/routes.js with this complete code. It discovers API routes in your MedOrbits Local Coding Agent, checks route declarations for common issues, and produces a readable or JSON report without modifying project files.

/**

* MedOrbits Local Coding Agent
* File: src/commands/routes.js
* Read-only API route discovery and static route audit.
* Usage:
* node src/commands/routes.js
* node src/commands/routes.js /path/to/repository
* node src/commands/routes.js –json
* node src/commands/routes.js –help
* Environment:
* AGENT_ROOT
* AGENT_ROUTES_MAX_FILES
* Notes:
* ●	This command does not start the server.
* ●	It does not make HTTP requests.
* ●	Route discovery is static and may not resolve dynamically

registered routes or imported router modules completely.

*/

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(MODULE_DIRECTORY, "../../..");

const MAX_FILES = parsePositiveInteger(
process.env.AGENT_ROUTES_MAX_FILES,
5000
);

const MAX_FILE_BYTES = 1024 * 1024;

const IGNORED_DIRECTORIES = new Set([
".git",
".hg",
".svn",
"node_modules",
"dist",
"build",
"coverage",
".next",
".nuxt",
".cache",
".turbo",
".vercel",
]);

const SOURCE_EXTENSIONS = new Set([
".js",
".mjs",
".cjs",
".ts",
".mts",
".cts",
]);

const ROUTE_METHODS = new Set([
"get",
"post",
"put",
"patch",
"delete",
"options",
"head",
"all",
]);

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

function resolveRoot(input) {
if (typeof input !== "string" || input.trim() === "") {
throw new TypeError("Repository root must be a non-empty path.");
}

return path.resolve(input);
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

function lineAt(source, index) {
return source.slice(0, index).split("\n").length;
}

function normalizeRoutePath(routePath) {
if (typeof routePath !== "string") {
return null;
}

let normalized = routePath.trim();

if (!normalized) {
return null;
}

normalized = normalized.replace(//+/g, "/");

if (!normalized.startsWith("/")) {
normalized = /${normalized};
}

if (normalized.length > 1) {
normalized = normalized.replace(//+$/, "");
}

return normalized;
}

async function collectSourceFiles(root, findings) {
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
        "Discovered path is outside the repository root.",
        relativePath
      )
    );
    continue;
  }
  if (entry.isSymbolicLink()) {
    continue;
  }
  if (entry.isDirectory()) {
    if (!IGNORED_DIRECTORIES.has(entry.name)) {
      queue.push(absolutePath);
    }
    continue;
  }
  if (!entry.isFile()) {
    continue;
  }
  if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
    continue;
  }
  files.push({
    absolutePath,
    relativePath,
  });
  if (files.length >= MAX_FILES) {
    findings.push(
      makeFinding(
        "medium",
        "FILE_SCAN_LIMIT",
        `Route scan stopped at ${MAX_FILES} source files.`,
        ".",
        null,
        "Increase AGENT_ROUTES_MAX_FILES if a larger scan is needed."
      )
    );
    return files;
  }
}

}

return files;
}

async function readSource(file, findings) {
try {
const stat = await fs.stat(file.absolutePath);

if (!stat.isFile()) {
  return null;
}
if (stat.size > MAX_FILE_BYTES) {
  findings.push(
    makeFinding(
      "info",
      "SOURCE_FILE_TOO_LARGE",
      "File skipped because it exceeds the scan size limit.",
      file.relativePath
    )
  );
  return null;
}
const source = await fs.readFile(file.absolutePath, "utf8");
if (source.includes("\0")) {
  return null;
}
return source;

} catch (error) {
findings.push(
makeFinding(
"low",
"SOURCE_READ_FAILED",
Could not read source file: ${error.message},
file.relativePath
)
);

return null;

}
}

/**

* Remove comments and string/template contents from source code.
* This helps avoid reporting route-looking text inside comments or
* ordinary strings as actual route declarations.
* Template interpolation is intentionally treated conservatively.
    */
    function maskNonCode(source) {
    const output = source.split("");
    let index = 0;

function blank(start, end, preserveNewlines = true) {
for (let cursor = start; cursor < end; cursor += 1) {
if (
preserveNewlines &&
(source[cursor] === "\n" || source[cursor] === "\r")
) {
continue;
}

  output[cursor] = " ";
}

}

while (index < source.length) {
const current = source[index];
const next = source[index + 1];

if (current === "/" && next === "/") {
  const start = index;
  index += 2;
  while (
    index < source.length &&
    source[index] !== "\n" &&
    source[index] !== "\r"
  ) {
    index += 1;
  }
  blank(start, index);
  continue;
}
if (current === "/" && next === "*") {
  const start = index;
  index += 2;
  while (
    index < source.length &&
    !(source[index] === "*" && source[index + 1] === "/")
  ) {
    index += 1;
  }
  if (index < source.length) {
    index += 2;
  }
  blank(start, index);
  continue;
}
if (current === "'" || current === '"' || current === "`") {
  const quote = current;
  const start = index;
  index += 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      index += 1;
      break;
    }
    index += 1;
  }
  blank(start, Math.min(index, source.length));
  continue;
}
index += 1;

}

return output.join("");
}

/**

* Extract quoted strings from a source file.
* Used only to recognize literal route paths and prefixes.
    */
    function readStringLiteral(source, startIndex) {
    const quote = source[startIndex];

if (quote !== "’" && quote !== ‘"’ && quote !== "`") {
return null;
}

let index = startIndex + 1;
let value = "";

while (index < source.length) {
const character = source[index];

if (character === "\\") {
  const escaped = source[index + 1];
  if (escaped === undefined) {
    return null;
  }
  const replacements = {
    n: "\n",
    r: "\r",
    t: "\t",
  };
  value += replacements[escaped] ?? escaped;
  index += 2;
  continue;
}
if (character === quote) {
  return {
    value,
    end: index + 1,
  };
}
if (quote !== "`" && (character === "\n" || character === "\r")) {
  return null;
}
// A template literal with interpolation is not a static path.
if (quote === "`" && character === "$" && source[index + 1] === "{") {
  return null;
}
value += character;
index += 1;

}

return null;
}

function findMatchingParenthesis(source, openIndex) {
let depth = 0;
let quote = null;
let escaped = false;

for (let index = openIndex; index < source.length; index += 1) {
const character = source[index];

if (quote) {
  if (escaped) {
    escaped = false;
    continue;
  }
  if (character === "\\") {
    escaped = true;
    continue;
  }
  if (character === quote) {
    quote = null;
  }
  continue;
}
if (
  character === "'" ||
  character === '"' ||
  character === "`"
) {
  quote = character;
  continue;
}
if (character === "(") {
  depth += 1;
} else if (character === ")") {
  depth -= 1;
  if (depth === 0) {
    return index;
  }
}

}

return -1;
}

function findFirstArgument(source, openParenIndex) {
let index = openParenIndex + 1;

while (index < source.length && /\s/.test(source[index])) {
index += 1;
}

if (source[index] === "’" || source[index] === ‘"’ || source[index] === "`") {
const literal = readStringLiteral(source, index);

if (literal) {
  return {
    value: literal.value,
    dynamic: false,
    start: index,
  };
}
return {
  value: null,
  dynamic: true,
  start: index,
};

}

return {
value: null,
dynamic: true,
start: index,
};
}

function extractRoutes(source, relativePath, findings) {
const routes = [];

// Work with a comment-masked copy to reduce false positives.
const masked = maskNonCode(source);

const routePattern =
/\b(?:app|router|server|apiRouter|expressRouter)\s*.\s*(get|post|put|patch|delete|options|head|all)\s*(/gi;

let match;

while ((match = routePattern.exec(masked)) !== null) {
const method = match[1].toUpperCase();
const openParenIndex = masked.indexOf("(", match.index);

if (openParenIndex < 0) {
  continue;
}
const closeParenIndex = findMatchingParenthesis(
  source,
  openParenIndex
);
if (closeParenIndex < 0) {
  findings.push(
    makeFinding(
      "medium",
      "ROUTE_CALL_UNCLOSED",
      "Could not find the closing parenthesis for a route declaration.",
      relativePath,
      lineAt(source, match.index)
    )
  );
  continue;
}
const argument = findFirstArgument(source, openParenIndex);
const route = {
  method,
  path: argument.value === null
    ? null
    : normalizeRoutePath(argument.value),
  dynamic: argument.dynamic,
  file: relativePath,
  line: lineAt(source, match.index),
  source: source.slice(match.index, Math.min(closeParenIndex + 1, match.index + 500)),
};
routes.push(route);

}

// Recognize Express-style chained router.route(’/path’).get(…).
const chainedPattern =
/\b(?:app|router|server|apiRouter|expressRouter)\s*.\sroute\s(/gi;

while ((match = chainedPattern.exec(masked)) !== null) {
const openParenIndex = masked.indexOf("(", match.index);
const argument = findFirstArgument(source, openParenIndex);

const closeParenIndex = findMatchingParenthesis(
  source,
  openParenIndex
);
if (closeParenIndex < 0) {
  findings.push(
    makeFinding(
      "medium",
      "ROUTE_CHAIN_UNCLOSED",
      "Could not find the closing parenthesis for router.route().",
      relativePath,
      lineAt(source, match.index)
    )
  );
  continue;
}
const chainSource = masked.slice(closeParenIndex + 1);
const chainMethods = [
  ...chainSource.matchAll(
    /^\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(/gim
  ),
];
for (const chainMethod of chainMethods) {
  routes.push({
    method: chainMethod[1].toUpperCase(),
    path: argument.value === null
      ? null
      : normalizeRoutePath(argument.value),
    dynamic: argument.dynamic,
    file: relativePath,
    line: lineAt(source, match.index),
    source: source.slice(
      match.index,
      Math.min(source.length, closeParenIndex + 250)
    ),
  });
}

}

return routes;
}

function extractMounts(source, relativePath) {
const mounts = [];
const masked = maskNonCode(source);

const mountPattern =
/\b(?:app|server)\s*.\suse\s(/gi;

let match;

while ((match = mountPattern.exec(masked)) !== null) {
const openParenIndex = masked.indexOf("(", match.index);
const firstArgument = findFirstArgument(source, openParenIndex);

const closeParenIndex = findMatchingParenthesis(
  source,
  openParenIndex
);
if (closeParenIndex < 0) {
  continue;
}
const argumentsText = source.slice(
  openParenIndex + 1,
  closeParenIndex
);
// router.use('/api', router) and router.use(router) are common.
if (firstArgument.value !== null) {
  mounts.push({
    prefix: normalizeRoutePath(firstArgument.value),
    dynamic: false,
    file: relativePath,
    line: lineAt(source, match.index),
    argumentsText,
  });
} else {
  mounts.push({
    prefix: null,
    dynamic: true,
    file: relativePath,
    line: lineAt(source, match.index),
    argumentsText,
  });
}

}

return mounts;
}

function joinRoutePaths(prefix, routePath) {
if (!prefix) {
return routePath || null;
}

if (!routePath) {
return normalizeRoutePath(prefix);
}

if (routePath === "/") {
return normalizeRoutePath(prefix);
}

return normalizeRoutePath(${prefix}/${routePath});
}

function auditRouteDefinitions(routes, findings) {
const seen = new Map();

for (const route of routes) {
if (!route.path) {
findings.push(
makeFinding(
"info",
"DYNAMIC_ROUTE_PATH",
"Route path is dynamic or not a static string; it could not be fully resolved.",
route.file,
route.line,
"Review the route declaration manually."
)
);

  continue;
}
if (route.path.includes("..")) {
  findings.push(
    makeFinding(
      "medium",
      "ROUTE_PATH_DOT_SEGMENT",
      "Route path contains a dot-dot sequence; verify its intended meaning.",
      route.file,
      route.line
    )
  );
}
if (route.path.includes("//")) {
  findings.push(
    makeFinding(
      "low",
      "ROUTE_PATH_DOUBLE_SLASH",
      "Route path contains repeated slashes.",
      route.file,
      route.line
    )
  );
}
if (
  route.method === "ALL" &&
  /\/(?:admin|auth|approve|delete|write|files?)(?:\/|$)/i.test(route.path)
) {
  findings.push(
    makeFinding(
      "medium",
      "SENSITIVE_ALL_METHOD_ROUTE",
      "A sensitive-looking route uses the all-methods handler.",
      route.file,
      route.line,
      "Confirm that every HTTP method is intentional and properly authorized."
    )
  );
}
const key = `${route.method} ${route.path}`;
if (seen.has(key)) {
  const previous = seen.get(key);
  findings.push(
    makeFinding(
      "medium",
      "POSSIBLE_DUPLICATE_ROUTE",
      `Potential duplicate route: ${key}. First declaration: ${previous.file}:${previous.line}.`,
      route.file,
      route.line,
      "Check route registration order and ensure the duplicate is intentional."
    )
  );
} else {
  seen.set(key, route);
}

}
}

function auditRouteSecurity(sourceFiles, sourceContents, findings) {
for (let index = 0; index < sourceFiles.length; index += 1) {
const file = sourceFiles[index];
const source = sourceContents[index];

if (source === null) {
  continue;
}
const isServerOrRouteFile =
  /(?:server|route|routes|controller|auth|middleware)/i.test(
    path.basename(file.relativePath)
  );
if (!isServerOrRouteFile) {
  continue;
}
const checks = [
  {
    code: "POSSIBLE_WILDCARD_CORS",
    severity: "medium",
    regex: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/i,
    message: "Wildcard CORS configuration may expose an API to unintended origins.",
    recommendation: "Restrict cross-origin access to explicitly trusted origins where appropriate.",
  },
  {
    code: "POSSIBLE_DISABLED_AUTH",
    severity: "medium",
    regex: /\b(?:authRequired|requireAuth|authenticationEnabled)\s*[:=]\s*false\b/i,
    message: "A security-related setting appears to disable authentication.",
    recommendation: "Confirm that public access is intentional for this route or environment.",
  },
  {
    code: "POSSIBLE_UNVALIDATED_BODY",
    severity: "low",
    regex: /\breq\.body\.[A-Za-z_$][\w$]*\s*(?:\|\||&&|\?\?)/,
    message: "Request body fields are accessed directly; verify input validation.",
    recommendation: "Validate request schemas and reject unexpected fields before processing.",
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
      file.relativePath,
      lineAt(source, match.index),
      check.recommendation
    )
  );
}

}
}

function calculateSummary(routes, findings) {
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
totalRoutes: routes.length,
staticRoutes: routes.filter((route) => route.path !== null).length,
dynamicRoutes: routes.filter((route) => route.path === null).length,
findings: findings.length,
counts,
};
}

function formatReport(report) {
const lines = [
"MedOrbits Local Coding Agent -- API Route Audit",
"=".repeat(48),
Repository: ${report.root},
Files scanned: ${report.filesScanned},
Routes discovered: ${report.summary.totalRoutes},
Static routes: ${report.summary.staticRoutes},
Dynamic routes: ${report.summary.dynamicRoutes},
Findings: ${report.summary.findings},
"",
"HTTP methods:",
];

const methodCounts = {};

for (const route of report.routes) {
methodCounts[route.method] = (methodCounts[route.method] || 0) + 1;
}

const methods = Object.keys(methodCounts).sort();

if (methods.length === 0) {
lines.push("  No static route declarations were discovered.");
} else {
for (const method of methods) {
lines.push(  ${method}: ${methodCounts[method]});
}
}

lines.push("", "Discovered routes:", "");

if (report.routes.length === 0) {
lines.push(
"  No routes found. The application may use different variable names,",
"  dynamic registration, or a framework not covered by this scanner."
);
} else {
for (const route of report.routes) {
const routePath = route.path || "(dynamic path)";

  lines.push(
    `  ${route.method.padEnd(7)} ${routePath}`,
    `          ${route.file}:${route.line}`
  );
}

}

lines.push("", "Findings:", "");

if (report.findings.length === 0) {
lines.push("  No static route-audit findings.");
} else {
for (const finding of report.findings) {
const location = [
finding.file || "(repository)",
finding.line ? line ${finding.line} : null,
]
.filter(Boolean)
.join(":");

  lines.push(
    `  [${finding.severity.toUpperCase()}] ${finding.code}`,
    `    ${location}`,
    `    ${finding.message}`
  );
  if (finding.recommendation) {
    lines.push(`    Recommendation: ${finding.recommendation}`);
  }
  lines.push("");
}

}

lines.push(
"",
"Note: Static discovery is not proof that routes are reachable or secure."
);

return lines.join("\n");
}

export async function discoverRoutes(options = {}) {
const root = resolveRoot(
options.root ||
process.env.AGENT_ROOT ||
DEFAULT_ROOT
);

const rootStat = await fs.stat(root);

if (!rootStat.isDirectory()) {
throw new Error(Repository root is not a directory: ${root});
}

const findings = [];
const files = await collectSourceFiles(root, findings);
const routes = [];
const mounts = [];
const sourceContents = [];

for (const file of files) {
const source = await readSource(file, findings);
sourceContents.push(source);

if (source === null) {
  continue;
}
routes.push(
  ...extractRoutes(source, file.relativePath, findings)
);
mounts.push(
  ...extractMounts(source, file.relativePath)
);

}

auditRouteDefinitions(routes, findings);
auditRouteSecurity(files, sourceContents, findings);

routes.sort((a, b) => {
return (
(a.file || "").localeCompare(b.file || "") ||
(a.line || 0) - (b.line || 0) ||
(a.method || "").localeCompare(b.method || "") ||
(a.path || "").localeCompare(b.path || "")
);
});

findings.sort((a, b) => {
const severityDifference =
SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

if (severityDifference !== 0) {
  return severityDifference;
}
return (
  (a.file || "").localeCompare(b.file || "") ||
  (a.line || 0) - (b.line || 0)
);

});

return {
schemaVersion: 1,
root,
generatedAt: new Date().toISOString(),
filesScanned: files.length,
routes,
mounts,
findings,
summary: calculateSummary(routes, findings),
};
}

export async function runRouteAudit(options = {}) {
const report = await discoverRoutes(options);

return {
report,
text: formatReport(report),
};
}

function printHelp() {
console.log(`
MedOrbits Local Coding Agent -- API Route Audit

Usage:
node src/commands/routes.js [repository-root] [options]

Options:
–json    Print a JSON report
–help    Show this help

Environment:
AGENT_ROOT               Repository root override
AGENT_ROUTES_MAX_FILES   Maximum source files to scan

Examples:
node src/commands/routes.js
node src/commands/routes.js ..
node src/commands/routes.js –json
`);
}

async function main() {
const args = process.argv.slice(2);
let json = false;
let help = false;
let root = null;

for (const argument of args) {
if (argument === "–json") {
json = true;
} else if (argument === "–help" || argument === "-h") {
help = true;
} else if (argument.startsWith("-")) {
console.error(Unknown option: ${argument});
process.exitCode = 2;
return;
} else if (root === null) {
root = argument;
} else {
console.error("Only one repository root can be supplied.");
process.exitCode = 2;
return;
}
}

if (help) {
printHelp();
return;
}

try {
const result = await runRouteAudit({
root: root || process.env.AGENT_ROOT || DEFAULT_ROOT,
});

if (json) {
  console.log(JSON.stringify(result.report, null, 2));
} else {
  console.log(result.text);
}

} catch (error) {
console.error(Route audit failed: ${error.message});
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

Run the route audit

From the medorbits-local-agent directory:

node src/commands/routes.js

Print JSON for automation or debugging:

node src/commands/routes.js --json

Check another directory:

node src/commands/routes.js ..

Important: This command performs static route discovery only. It does not start Express, validate live endpoint responses, or prove that authentication and authorization work. Dynamic route names and imported router mount prefixes may need manual review.