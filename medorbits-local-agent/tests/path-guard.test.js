/**

* MedOrbits Local Coding Agent
* File: tests/path-guard.test.js
* Tests repository path containment and path traversal protection.
* Run:
* node –test tests/path-guard.test.js
    */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

/**

* Resolve a candidate path and verify that it remains inside the
* configured repository root.
* This helper is deliberately self-contained so the tests can run
* before the production path-guard module has been implemented.
    */
    function resolveInsideRoot(root, candidate) {
    if (typeof root !== "string" || root.trim() === "") {
    throw new TypeError("Repository root must be a non-empty string.");
    }

if (typeof candidate !== "string" || candidate.trim() === "") {
throw new TypeError("Candidate path must be a non-empty string.");
}

if (candidate.includes("\0")) {
throw new Error("Null bytes are not allowed in paths.");
}

// Reject absolute paths and Windows drive/UNC paths, even when
// tests are running on a POSIX system.
if (
path.isAbsolute(candidate) ||
path.win32.isAbsolute(candidate) ||
/^[a-zA-Z]:/.test(candidate) ||
candidate.startsWith("\\") ||
candidate.startsWith("//")
) {
throw new Error("Absolute paths are not allowed.");
}

// Interpret both slash styles as separators to avoid accepting
// Windows traversal strings on POSIX systems.
const normalizedCandidate = candidate.replace(/[\/]+/g, path.sep);

const resolvedRoot = path.resolve(root);
const resolvedCandidate = path.resolve(resolvedRoot, normalizedCandidate);
const relative = path.relative(resolvedRoot, resolvedCandidate);

if (
relative === ".." ||
relative.startsWith(..${path.sep}) ||
path.isAbsolute(relative)
) {
throw new Error("Path escapes the repository root.");
}

return resolvedCandidate;
}

/**

* Check real filesystem containment, including symlinks.
* For a path that does not exist yet, resolve its nearest existing
* parent and verify that parent’s real path stays inside the real root.
    */
    async function resolveRealInsideRoot(root, candidate) {
    const lexicalPath = resolveInsideRoot(root, candidate);
    const realRoot = await fs.realpath(root);

let existingPath = lexicalPath;

while (true) {
try {
await fs.lstat(existingPath);
break;
} catch (error) {
if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
throw error;
}

  const parent = path.dirname(existingPath);
  if (parent === existingPath) {
    throw new Error("No existing parent directory was found.");
  }
  existingPath = parent;
}

}

const realExistingPath = await fs.realpath(existingPath);
const relativeExisting = path.relative(realRoot, realExistingPath);

if (
relativeExisting === ".." ||
relativeExisting.startsWith(..${path.sep}) ||
path.isAbsolute(relativeExisting)
) {
throw new Error("Symlink escapes the repository root.");
}

return lexicalPath;
}

async function createTempRoot(t) {
const root = await fs.mkdtemp(
path.join(os.tmpdir(), "medorbits-path-guard-")
);

t.after(async () => {
await fs.rm(root, { recursive: true, force: true });
});

return root;
}

test("accepts a normal file inside the repository", async (t) => {
const root = await createTempRoot(t);

await fs.mkdir(path.join(root, "src"), { recursive: true });
await fs.writeFile(path.join(root, "src", "agent.js"), "export {};\n");

const result = resolveInsideRoot(root, "src/agent.js");

assert.equal(result, path.join(root, "src", "agent.js"));
});

test("accepts a nested relative path", async (t) => {
const root = await createTempRoot(t);

const result = resolveInsideRoot(
root,
"src/services/ollama.service.js"
);

assert.equal(
result,
path.join(root, "src", "services", "ollama.service.js")
);
});

test("normalizes harmless current-directory segments", async (t) => {
const root = await createTempRoot(t);

const result = resolveInsideRoot(root, "src/./agent.js");

assert.equal(result, path.join(root, "src", "agent.js"));
});

test("rejects parent-directory traversal", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, "../outside.txt"),
/escapes|Absolute paths/
);
});

test("rejects nested parent-directory traversal", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, "src/../../outside.txt"),
/escapes|Absolute paths/
);
});

test("rejects traversal using Windows backslashes", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, String.raw..\outside.txt),
/escapes|Absolute paths/
);
});

test("rejects absolute POSIX paths", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, path.join(os.tmpdir(), "outside.txt")),
/Absolute paths/
);
});

test("rejects Windows drive-letter paths", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, String.rawC:\Windows\system.ini),
/Absolute paths/
);
});

test("rejects Windows UNC paths", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, String.raw\\server\share\file.txt),
/Absolute paths/
);
});

test("rejects null bytes", async (t) => {
const root = await createTempRoot(t);

assert.throws(
() => resolveInsideRoot(root, "src/file\0.js"),
/Null bytes/
);
});

test("rejects empty and non-string candidate paths", async (t) => {
const root = await createTempRoot(t);

assert.throws(() => resolveInsideRoot(root, ""), /non-empty/);
assert.throws(() => resolveInsideRoot(root, "   "), /non-empty/);
assert.throws(() => resolveInsideRoot(root, null), /non-empty/);
});

test("rejects an empty repository root", () => {
assert.throws(
() => resolveInsideRoot("", "src/agent.js"),
/Repository root/
);
});

test("rejects a symlink that points outside the repository", async (t) => {
const root = await createTempRoot(t);
const outside = await fs.mkdtemp(
path.join(os.tmpdir(), "medorbits-outside-")
);

t.after(async () => {
await fs.rm(outside, { recursive: true, force: true });
});

await fs.writeFile(path.join(outside, "secret.txt"), "private\n");

const linkPath = path.join(root, "external-link");

try {
await fs.symlink(outside, linkPath, "dir");
} catch (error) {
if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
t.skip(Symlink creation is unavailable: ${error.code});
return;
}

throw error;

}

await assert.rejects(
() => resolveRealInsideRoot(root, "external-link/secret.txt"),
/Symlink escapes/
);
});

test("accepts a symlink that points inside the repository", async (t) => {
const root = await createTempRoot(t);

const internalDirectory = path.join(root, "internal");
await fs.mkdir(internalDirectory);
await fs.writeFile(
path.join(internalDirectory, "safe.txt"),
"safe\n"
);

const linkPath = path.join(root, "internal-link");

try {
await fs.symlink(internalDirectory, linkPath, "dir");
} catch (error) {
if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
t.skip(Symlink creation is unavailable: ${error.code});
return;
}

throw error;

}

const result = await resolveRealInsideRoot(
root,
"internal-link/safe.txt"
);

assert.equal(result, path.join(root, "internal-link", "safe.txt"));
});

test("rejects a symlink escape for a file that does not exist yet", async (t) => {
const root = await createTempRoot(t);
const outside = await fs.mkdtemp(
path.join(os.tmpdir(), "medorbits-outside-new-")
);

t.after(async () => {
await fs.rm(outside, { recursive: true, force: true });
});

const linkPath = path.join(root, "external-link");

try {
await fs.symlink(outside, linkPath, "dir");
} catch (error) {
if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
t.skip(Symlink creation is unavailable: ${error.code});
return;
}

throw error;

}

await assert.rejects(
() => resolveRealInsideRoot(root, "external-link/new-file.txt"),
/Symlink escapes/
);
});

/**

* Optional integration test.
* If the production path-guard module exists, import it and exercise
* the exported guard. The module may expose resolveInsideRoot or
* assertPathInsideRoot. Set PATH_GUARD_MODULE to its relative path
* to select the module.
    */
    test("production path guard integration (when configured)", async (t) => {
    const modulePath = process.env.PATH_GUARD_MODULE;

if (!modulePath) {
t.skip("Set PATH_GUARD_MODULE to test the production guard module.");
return;
}

const moduleUrl = pathToFileURL(
path.resolve(process.cwd(), modulePath)
).href;

const guardModule = await import(moduleUrl);

const guard =
guardModule.resolveInsideRoot ||
guardModule.assertPathInsideRoot ||
guardModule.guardPath;

assert.equal(
typeof guard,
"function",
"The configured module must export resolveInsideRoot, assertPathInsideRoot, or guardPath."
);

const root = await createTempRoot(t);
const safePath = guard(root, "src/agent.js");

if (safePath && typeof safePath.then === "function") {
await assert.rejects(
() => Promise.resolve(guard(root, "../outside.txt")),
/escapes|outside|invalid|traversal|absolute/i
);
return;
}

assert.throws(
() => guard(root, "../outside.txt"),
/escapes|outside|invalid|traversal|absolute/i
);
});