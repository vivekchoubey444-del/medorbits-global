/**

* MedOrbits Local Coding Agent
* File: src/commands/check.js
* Read-only project health checker.
* Usage:
* node src/commands/check.js
* node src/commands/check.js /path/to/repository
* Options:
* –no-tests       Skip test execution.
* –no-syntax      Skip JavaScript syntax checks.
* –json           Print a JSON report.
* –help           Show usage information.
* Environment:
* AGENT_ROOT       Repository root override.
    */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(MODULE_DIRECTORY, "../../..");

const REQUIRED_FILES = [
"package.json",
"server.js",
];

const RECOMMENDED_FILES = [
".gitignore",
".env.example",
"README.md",
];

const EXCLUDED_DIRECTORIES = new Set([
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

const MAX_FILES = 5000;
const MAX_OUTPUT = 20000;

function parseArguments(argv) {
const options = {
root: null,
tests: true,
syntax: true,
json: false,
help: false,
};

for (let index = 0; index < argv.length; index += 1) {
const argument = argv[index];

switch (argument) {
  case "--no-tests":
    options.tests = false;
    break;
  case "--no-syntax":
    options.syntax = false;
    break;
  case "--json":
    options.json = true;
    break;
  case "--help":
  case "-h":
    options.help = true;
    break;
  default:
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }
    if (options.root !== null) {
      throw new Error("Only one repository root can be supplied.");
    }
    options.root = argument;
    break;
}

}

return options;
}

function printHelp() {
console.log(`
MedOrbits Local Coding Agent -- Project Check

Usage:
node src/commands/check.js [repository-root] [options]

Options:
–no-tests    Skip running tests
–no-syntax   Skip JavaScript syntax checks
–json        Print a JSON report
–help, -h    Show this help

Environment:
AGENT_ROOT    Use this directory when no root is provided

Examples:
node src/commands/check.js
node src/commands/check.js ..
node src/commands/check.js –no-tests
node src/commands/check.js –json
`);
}

function resolveRoot(input) {
if (typeof input !== "string" || input.trim() === "") {
throw new TypeError("Repository root must be a non-empty path.");
}

return path.resolve(input);
}

function makeResult(name, status, message, details = {}) {
return {
name,
status,
message,
…details,
};
}

async function exists(filePath) {
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

async function readPackageJson(root, results) {
const packagePath = path.join(root, "package.json");

if (!(await exists(packagePath))) {
results.push(
makeResult(
"package.json",
"FAIL",
"package.json is missing."
)
);

return null;

}

let parsed;

try {
parsed = JSON.parse(await fs.readFile(packagePath, "utf8"));
} catch (error) {
results.push(
makeResult(
"package.json",
"FAIL",
Could not parse package.json: ${error.message}
)
);

return null;

}

if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
results.push(
makeResult(
"package.json",
"FAIL",
"package.json must contain a JSON object."
)
);

return null;

}

results.push(
makeResult(
"package.json",
"PASS",
"package.json exists and contains valid JSON.",
{
packageName: parsed.name || null,
packageVersion: parsed.version || null,
}
)
);

return parsed;
}

async function checkRequiredFiles(root, results) {
for (const relativePath of REQUIRED_FILES) {
const filePath = path.join(root, relativePath);

if (await exists(filePath)) {
  results.push(
    makeResult(
      `Required file: ${relativePath}`,
      "PASS",
      "Required file exists."
    )
  );
} else {
  results.push(
    makeResult(
      `Required file: ${relativePath}`,
      "FAIL",
      "Required file is missing."
    )
  );
}

}

for (const relativePath of RECOMMENDED_FILES) {
const filePath = path.join(root, relativePath);

if (await exists(filePath)) {
  results.push(
    makeResult(
      `Recommended file: ${relativePath}`,
      "PASS",
      "Recommended file exists."
    )
  );
} else {
  results.push(
    makeResult(
      `Recommended file: ${relativePath}`,
      "WARN",
      "Recommended file is missing."
    )
  );
}

}
}

function checkRuntime(packageJson, results) {
const currentMajor = Number(process.versions.node.split(".")[0]);

if (currentMajor >= 20) {
results.push(
makeResult(
"Node.js version",
"PASS",
Running Node.js ${process.versions.node}.
)
);
} else {
results.push(
makeResult(
"Node.js version",
"FAIL",
Node.js 20 or newer is recommended; current version is ${process.versions.node}.
)
);
}

if (!packageJson) {
return;
}

if (packageJson.type === "module") {
results.push(
makeResult(
"ES modules",
"PASS",
‘package.json declares "type": "module".’
)
);
} else {
results.push(
makeResult(
"ES modules",
"WARN",
‘package.json does not declare "type": "module". Check whether this project uses ES modules.’
)
);
}

const nodeEngine = packageJson.engines?.node;

if (!nodeEngine) {
results.push(
makeResult(
"Node.js engine",
"WARN",
"package.json does not declare engines.node."
)
);
} else {
results.push(
makeResult(
"Node.js engine",
"INFO",
Declared Node.js engine: ${nodeEngine}.
)
);
}
}

function checkPackageScripts(packageJson, results) {
if (!packageJson) {
return;
}

const scripts = packageJson.scripts;

if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
results.push(
makeResult(
"npm scripts",
"FAIL",
"package.json does not contain a valid scripts object."
)
);

return;

}

for (const scriptName of ["start", "test"]) {
if (typeof scripts[scriptName] === "string") {
results.push(
makeResult(
npm script: ${scriptName},
"PASS",
Script "${scriptName}" is defined.
)
);
} else {
results.push(
makeResult(
npm script: ${scriptName},
"WARN",
Script "${scriptName}" is not defined.
)
);
}
}

if (typeof scripts.check === "string") {
results.push(
makeResult(
"npm script: check",
"PASS",
‘Script "check" is defined.’
)
);
} else {
results.push(
makeResult(
"npm script: check",
"WARN",
‘Script "check" is not defined.’
)
);
}
}

async function collectJavaScriptFiles(root, results) {
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
  results.push(
    makeResult(
      `Directory: ${path.relative(root, directory) || "."}`,
      "WARN",
      `Could not inspect directory: ${error.message}`
    )
  );
  continue;
}
for (const entry of entries) {
  const absolutePath = path.join(directory, entry.name);
  const relativePath = path.relative(root, absolutePath);
  if (entry.isSymbolicLink()) {
    continue;
  }
  if (entry.isDirectory()) {
    if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
      queue.push(absolutePath);
    }
    continue;
  }
  if (
    entry.isFile() &&
    /\.(?:js|mjs|cjs)$/.test(entry.name)
  ) {
    files.push({
      absolutePath,
      relativePath,
    });
    if (files.length >= MAX_FILES) {
      results.push(
        makeResult(
          "JavaScript file scan",
          "WARN",
          `Scan reached the ${MAX_FILES}-file limit.`
        )
      );
      return files;
    }
  }
}

}

return files;
}

function runProcess(command, args, cwd, timeoutMs = 15000) {
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
let finished = false;
function finish(result) {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timer);
  resolve(result);
}
const timer = setTimeout(() => {
  child.kill("SIGTERM");
  finish({
    ok: false,
    code: null,
    timedOut: true,
    stdout,
    stderr,
  });
}, timeoutMs);
child.stdout.on("data", (chunk) => {
  if (stdout.length < MAX_OUTPUT) {
    stdout += chunk.toString();
  }
});
child.stderr.on("data", (chunk) => {
  if (stderr.length < MAX_OUTPUT) {
    stderr += chunk.toString();
  }
});
child.on("error", (error) => {
  finish({
    ok: false,
    code: null,
    timedOut: false,
    stdout,
    stderr: `${stderr}\n${error.message}`,
  });
});
child.on("close", (code) => {
  finish({
    ok: code === 0,
    code,
    timedOut: false,
    stdout,
    stderr,
  });
});

});
}

async function checkJavaScriptSyntax(root, files, results) {
if (files.length === 0) {
results.push(
makeResult(
"JavaScript syntax",
"WARN",
"No JavaScript files were found."
)
);

return;

}

let failed = 0;
const failures = [];

for (const file of files) {
const result = await runProcess(
process.execPath,
["–check", file.absolutePath],
root,
10000
);

if (!result.ok) {
  failed += 1;
  failures.push({
    file: file.relativePath,
    error: (
      result.stderr ||
      result.stdout ||
      (result.timedOut ? "Syntax check timed out." : "Unknown error.")
    ).trim().slice(0, 1500),
  });
}

}

if (failed === 0) {
results.push(
makeResult(
"JavaScript syntax",
"PASS",
All ${files.length} JavaScript files passed node --check.,
{ checkedFiles: files.length }
)
);

return;

}

results.push(
makeResult(
"JavaScript syntax",
"FAIL",
${failed} of ${files.length} JavaScript files failed syntax checks.,
{
checkedFiles: files.length,
failures,
}
)
);
}

async function checkTests(root, packageJson, results) {
const testDirectory = path.join(root, "tests");
const testDirectoryExists = await exists(testDirectory);

if (!testDirectoryExists) {
results.push(
makeResult(
"Test directory",
"WARN",
"The tests directory is missing."
)
);

return;

}

const testFiles = [];

async function walk(directory) {
let entries;

try {
  entries = await fs.readdir(directory, {
    withFileTypes: true,
  });
} catch {
  return;
}
for (const entry of entries) {
  const absolutePath = path.join(directory, entry.name);
  if (entry.isSymbolicLink()) {
    continue;
  }
  if (entry.isDirectory()) {
    await walk(absolutePath);
  } else if (
    entry.isFile() &&
    /\.test\.(?:js|mjs|cjs)$/.test(entry.name)
  ) {
    testFiles.push(absolutePath);
  }
}

}

await walk(testDirectory);

if (testFiles.length === 0) {
results.push(
makeResult(
"Test discovery",
"WARN",
"No *.test.js, *.test.mjs, or *.test.cjs files were found."
)
);

return;

}

const testScript = packageJson?.scripts?.test;

if (typeof testScript === "string" && testScript.trim()) {
results.push(
makeResult(
"Test discovery",
"PASS",
Found ${testFiles.length} test files.
)
);

return;

}

results.push(
makeResult(
"Test discovery",
"PASS",
Found ${testFiles.length} test files.
)
);
}

async function executeTests(root, packageJson, results) {
const testScript = packageJson?.scripts?.test;

if (typeof testScript !== "string" || !testScript.trim()) {
results.push(
makeResult(
"Test execution",
"WARN",
"Skipped because package.json has no test script."
)
);

return;

}

const npmExecutable =
process.platform === "win32" ? "npm.cmd" : "npm";

const result = await runProcess(
npmExecutable,
["test", "–", "–run"],
root,
120000
);

// Some npm test scripts do not accept –run. Retry with the plain
// command only when the initial attempt appears to reject that flag.
const rejectedRunFlag =
!result.ok &&
/unknown option|unrecognized option|unexpected argument|unknown argument/i.test(
${result.stdout}\n${result.stderr}
);

const finalResult = rejectedRunFlag
? await runProcess(
npmExecutable,
["test"],
root,
120000
)
: result;

if (finalResult.ok) {
results.push(
makeResult(
"Test execution",
"PASS",
"npm test completed successfully.",
{
output: finalResult.stdout.trim().slice(-5000),
}
)
);

return;

}

results.push(
makeResult(
"Test execution",
"FAIL",
finalResult.timedOut
? "npm test timed out."
: npm test failed with exit code ${finalResult.code}.,
{
stdout: finalResult.stdout.trim().slice(-5000),
stderr: finalResult.stderr.trim().slice(-5000),
}
)
);
}

function summarize(results) {
const summary = {
total: results.length,
passed: 0,
failed: 0,
warnings: 0,
informational: 0,
};

for (const result of results) {
switch (result.status) {
case "PASS":
summary.passed += 1;
break;

  case "FAIL":
    summary.failed += 1;
    break;
  case "WARN":
    summary.warnings += 1;
    break;
  default:
    summary.informational += 1;
    break;
}

}

summary.ok = summary.failed === 0;

return summary;
}

function formatReport(report) {
const lines = [
"MedOrbits Local Coding Agent -- Project Health Check",
"=".repeat(54),
Repository: ${report.root},
Node.js:    ${report.runtime.node},
Platform:   ${report.runtime.platform},
Started:    ${report.startedAt},
Completed:  ${report.completedAt},
"",
PASS: ${report.summary.passed}  FAIL: ${report.summary.failed}  WARN: ${report.summary.warnings}  INFO: ${report.summary.informational},
"",
];

for (const result of report.results) {
lines.push([${result.status}] ${result.name}: ${result.message});

if (Array.isArray(result.failures)) {
  for (const failure of result.failures) {
    lines.push(`  File: ${failure.file}`);
    lines.push(`  ${failure.error}`);
  }
}
if (result.stderr) {
  lines.push(`  Error: ${result.stderr}`);
}
lines.push("");

}

lines.push(
report.summary.ok
? "Overall result: PASS"
: "Overall result: FAIL -- review the failures above."
);

return lines.join("\n");
}

export async function runCheck(inputOptions = {}) {
const root = resolveRoot(
inputOptions.root ||
process.env.AGENT_ROOT ||
DEFAULT_ROOT
);

const rootStat = await fs.stat(root);

if (!rootStat.isDirectory()) {
throw new Error(Repository root is not a directory: ${root});
}

const startedAt = new Date().toISOString();
const results = [];

const packageJson = await readPackageJson(root, results);

await checkRequiredFiles(root, results);
checkRuntime(packageJson, results);
checkPackageScripts(packageJson, results);

const javascriptFiles = await collectJavaScriptFiles(root, results);

if (inputOptions.syntax !== false) {
await checkJavaScriptSyntax(root, javascriptFiles, results);
} else {
results.push(
makeResult(
"JavaScript syntax",
"INFO",
"Skipped by request."
)
);
}

await checkTests(root, packageJson, results);

if (inputOptions.tests === true) {
await executeTests(root, packageJson, results);
} else {
results.push(
makeResult(
"Test execution",
"INFO",
"Skipped by request."
)
);
}

const completedAt = new Date().toISOString();

const report = {
schemaVersion: 1,
root,
runtime: {
node: process.versions.node,
platform: process.platform,
architecture: process.arch,
},
startedAt,
completedAt,
summary: summarize(results),
results,
};

return {
report,
text: formatReport(report),
exitCode: report.summary.ok ? 0 : 1,
};
}

async function main() {
let options;

try {
options = parseArguments(process.argv.slice(2));
} catch (error) {
console.error(Argument error: ${error.message});
process.exitCode = 2;
return;
}

if (options.help) {
printHelp();
return;
}

const root =
options.root ||
process.env.AGENT_ROOT ||
DEFAULT_ROOT;

try {
const result = await runCheck({
root,
tests: options.tests,
syntax: options.syntax,
});

if (options.json) {
  console.log(JSON.stringify(result.report, null, 2));
} else {
  console.log(result.text);
}
if (result.exitCode !== 0) {
  process.exitCode = result.exitCode;
}

} catch (error) {
console.error(Project check failed: ${error.message});
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