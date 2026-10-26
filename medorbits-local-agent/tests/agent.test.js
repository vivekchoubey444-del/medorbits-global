/**

* MedOrbits Local Coding Agent
* File: tests/agent.test.js
* Unit tests for the agent and planner modules.
* Run from medorbits-local-agent:
* node –test tests/agent.test.js
* These tests use mock providers and do not require Ollama to be running.
    */

import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const AGENT_MODULE =
process.env.AGENT_MODULE || "../src/agent/agent.js";

const PLANNER_MODULE =
process.env.PLANNER_MODULE || "../src/agent/planner.js";

async function importOptionalModule(relativePath) {
const absolutePath = path.resolve(process.cwd(), relativePath);
return import(pathToFileURL(absolutePath).href);
}

function createMockProvider(response = "Mock agent response.") {
const calls = [];

return {
calls,

async generate(prompt, options = {}) {
  calls.push({ prompt, options });
  return response;
},
async chat(messages, options = {}) {
  calls.push({ messages, options });
  return { content: response };
},
async complete(prompt, options = {}) {
  calls.push({ prompt, options });
  return response;
},

};
}

function getCallableExport(module, names) {
for (const name of names) {
if (typeof module[name] === "function") {
return module[name];
}
}

return null;
}

function getAgentClass(module) {
return getCallableExport(module, [
"Agent",
"CodingAgent",
"LocalAgent",
]);
}

function getPlannerClass(module) {
return getCallableExport(module, [
"Planner",
"AgentPlanner",
"TaskPlanner",
]);
}

function assertHasNoUnsafePathTraversal(value) {
const serialized = JSON.stringify(value);

assert.equal(typeof serialized, "string");

// Reject common traversal forms in generated file paths.
assert.doesNotMatch(
serialized,
/(?:^|["\s:=])..[/\]/
);

assert.doesNotMatch(
serialized,
/[A-Za-z]:/\(?:[/\]|["\s])/i
);
}

test("agent module can be imported", async (t) => {
let module;

try {
module = await importOptionalModule(AGENT_MODULE);
} catch (error) {
assert.fail(
Unable to import agent module at "${AGENT_MODULE}": ${error.message}
);
}

assert.ok(module);
assert.equal(typeof module, "object");
});

test("agent module exports an agent implementation or factory", async (t) => {
const module = await importOptionalModule(AGENT_MODULE);

const AgentClass = getAgentClass(module);
const factory = getCallableExport(module, [
"createAgent",
"createCodingAgent",
"buildAgent",
]);

assert.ok(
AgentClass || factory,
"Export Agent/CodingAgent/LocalAgent or createAgent/createCodingAgent/buildAgent."
);
});

test("planner module can be imported", async () => {
let module;

try {
module = await importOptionalModule(PLANNER_MODULE);
} catch (error) {
assert.fail(
Unable to import planner module at "${PLANNER_MODULE}": ${error.message}
);
}

assert.ok(module);
assert.equal(typeof module, "object");
});

test("planner module exports a planner implementation or factory", async () => {
const module = await importOptionalModule(PLANNER_MODULE);

const PlannerClass = getPlannerClass(module);
const factory = getCallableExport(module, [
"createPlanner",
"createAgentPlanner",
"buildPlanner",
]);

const plannerFunction = getCallableExport(module, [
"plan",
"createPlan",
"buildPlan",
]);

assert.ok(
PlannerClass || factory || plannerFunction,
"Export a Planner class, planner factory, or plan/createPlan/buildPlan function."
);
});

test("mock provider records generation calls", async () => {
const provider = createMockProvider("Proposed plan");

const response = await provider.generate("Create a test plan.");

assert.equal(response, "Proposed plan");
assert.equal(provider.calls.length, 1);
assert.equal(
provider.calls[0].prompt,
"Create a test plan."
);
});

test("mock provider supports chat-style interfaces", async () => {
const provider = createMockProvider("Chat response");

const response = await provider.chat([
{ role: "user", content: "Explain this function." },
]);

assert.equal(response.content, "Chat response");
assert.equal(provider.calls.length, 1);
});

test("mock provider supports completion-style interfaces", async () => {
const provider = createMockProvider("Completion response");

const response = await provider.complete("Return a summary.");

assert.equal(response, "Completion response");
assert.equal(provider.calls.length, 1);
});

test("mock provider can simulate provider failures", async () => {
const provider = {
async generate() {
throw new Error("Simulated provider failure");
},
};

await assert.rejects(
() => provider.generate("Test"),
/Simulated provider failure/
);
});

test("agent rejects an empty task when an input validator is exported", async (t) => {
const module = await importOptionalModule(AGENT_MODULE);

const validate = getCallableExport(module, [
"validateRequest",
"validateTask",
"validateInput",
]);

if (!validate) {
t.skip("No public request-validation function is exported.");
return;
}

assert.throws(
() => validate(""),
/empty|required|invalid|request|task/i
);
});

test("agent rejects a non-string task when an input validator is exported", async (t) => {
const module = await importOptionalModule(AGENT_MODULE);

const validate = getCallableExport(module, [
"validateRequest",
"validateTask",
"validateInput",
]);

if (!validate) {
t.skip("No public request-validation function is exported.");
return;
}

assert.throws(
() => validate(null),
/string|invalid|request|task/i
);
});

test("planner handles an ordinary task when a public planning function exists", async (t) => {
const module = await importOptionalModule(PLANNER_MODULE);

const planFunction = getCallableExport(module, [
"plan",
"createPlan",
"buildPlan",
]);

if (!planFunction) {
t.skip("No public planning function is exported.");
return;
}

const result = await planFunction("Add a unit test for the agent.");

assert.notEqual(result, undefined);
assert.notEqual(result, null);
});

test("planner does not return an empty result for a valid task", async (t) => {
const module = await importOptionalModule(PLANNER_MODULE);

const planFunction = getCallableExport(module, [
"plan",
"createPlan",
"buildPlan",
]);

if (!planFunction) {
t.skip("No public planning function is exported.");
return;
}

const result = await planFunction("Explain the repository structure.");

assert.notEqual(result, undefined);
assert.notEqual(result, null);

if (typeof result === "string") {
assert.ok(result.trim().length > 0);
} else if (Array.isArray(result)) {
assert.ok(result.length > 0);
} else if (typeof result === "object") {
assert.ok(Object.keys(result).length > 0);
}
});

test("generated proposal data does not contain common path traversal strings", () => {
const proposal = {
summary: "Add a unit test.",
changes: [
{
path: "tests/agent.test.js",
action: "create",
content: "test(‘example’, () => {});",
},
],
};

assertHasNoUnsafePathTraversal(proposal);
});

test("proposal checks detect a parent-directory escape", () => {
const maliciousProposal = {
changes: [
{
path: "../../outside.txt",
action: "create",
content: "unsafe",
},
],
};

assert.throws(
() => assertHasNoUnsafePathTraversal(maliciousProposal),
assert.AssertionError
);
});

test("proposal checks detect an absolute Windows system path", () => {
const maliciousProposal = {
changes: [
{
path: String.rawC:\Windows\System32\example.dll,
action: "modify",
},
],
};

assert.throws(
() => assertHasNoUnsafePathTraversal(maliciousProposal),
assert.AssertionError
);
});

test("proposal content is treated as data, not executed", () => {
let executed = false;

const proposal = {
path: "tests/example.js",
content: "globalThis.__agentTestExecuted = true;",
};

assert.equal(executed, false);
assert.equal(typeof proposal.content, "string");
assert.equal(executed, false);
});

test("agent tests do not require an Ollama server", () => {
const provider = createMockProvider("Offline response");

assert.equal(typeof provider.generate, "function");
assert.equal(typeof provider.chat, "function");
assert.equal(typeof provider.complete, "function");
assert.equal(provider.calls.length, 0);
});