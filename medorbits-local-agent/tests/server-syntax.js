import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("server.js parses with the current Node.js runtime", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.ok(source.includes("createServer"));
  const result = spawnSync(process.execPath, ["--check", new URL("../server.js", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
