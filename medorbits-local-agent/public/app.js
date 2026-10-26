/* MedOrbits Local Agent -- public/app.js */
"use strict";

const $ = (id) => document.getElementById(id);

let proposalId = null;
let activeRequest = 0;
let isBusy = false;

const REQUIRED_CONFIRMATION = "APPROVE FILE CHANGES";
const MAX_DIFF_CELLS = 250_000;

function requiredElement(id) {
const element = $(id);
if (!element) {
throw new Error(Required interface element is missing: #${id});
}
return element;
}

function setMessage(text, error = false) {
const element = $("message");
if (!element) return;

element.textContent = String(text);
element.style.color = error ? "#ffc3c3" : "#baf0d4";
element.setAttribute("role", error ? "alert" : "status");
}

function setBusy(busy) {
isBusy = busy;

const propose = $("propose");
const approve = $("approve");
const reject = $("reject");

if (propose) propose.disabled = busy;
if (reject) reject.disabled = busy || !proposalId;

if (approve) {
approve.disabled =
busy ||
!proposalId ||
$("confirmation")?.value !== REQUIRED_CONFIRMATION;
}
}

function clearReview() {
proposalId = null;

const review = $("review");
const changes = $("changes");
const tests = $("tests");
const summary = $("summary");
const confirmation = $("confirmation");

if (changes) changes.replaceChildren();
if (tests) tests.replaceChildren();
if (summary) summary.textContent = "";
if (confirmation) confirmation.value = "";
if (review) review.hidden = true;

setBusy(isBusy);
}

async function api(url, body) {
const options = {
method: body === undefined ? "GET" : "POST",
headers: {
Accept: "application/json",
},
cache: "no-store",
credentials: "same-origin",
};

if (body !== undefined) {
options.headers["Content-Type"] = "application/json";
options.body = JSON.stringify(body);
}

const response = await fetch(url, options);

let data;

try {
data = await response.json();
} catch {
throw new Error(
response.ok
? "The server returned an invalid JSON response."
: Request failed with HTTP ${response.status}.
);
}

if (!response.ok) {
const serverMessage =
typeof data?.error === "string" ? data.error : "";

throw new Error(
  serverMessage || `Request failed with HTTP ${response.status}.`
);

}

if (!data || typeof data !== "object" || Array.isArray(data)) {
throw new Error("The server returned an unexpected response.");
}

return data;
}

function makeElement(tag, text, className) {
const element = document.createElement(tag);

if (text !== undefined && text !== null) {
element.textContent = String(text);
}

if (className) {
element.className = className;
}

return element;
}

/*

* Generate a line-oriented diff using the longest common subsequence.
* For very large inputs, show complete before/after content instead of
* allocating an excessively large diff matrix.
    */
    function createDiff(before, after) {
    const oldLines = String(before ?? "").split("\n");
    const newLines = String(after ?? "").split("\n");

if (
(oldLines.length + 1) * (newLines.length + 1) >
MAX_DIFF_CELLS
) {
return null;
}

const rows = oldLines.length + 1;
const cols = newLines.length + 1;
const dp = Array.from(
{ length: rows },
() => new Uint32Array(cols)
);

for (let i = oldLines.length - 1; i >= 0; i–) {
for (let j = newLines.length - 1; j >= 0; j–) {
dp[i][j] =
oldLines[i] === newLines[j]
? dp[i + 1][j + 1] + 1
: Math.max(dp[i + 1][j], dp[i][j + 1]);
}
}

const output = ["-- existing file", "+++ proposed file"];
let i = 0;
let j = 0;

while (i < oldLines.length || j < newLines.length) {
if (
i < oldLines.length &&
j < newLines.length &&
oldLines[i] === newLines[j]
) {
output.push(" " + oldLines[i]);
i++;
j++;
} else if (
j < newLines.length &&
(i >= oldLines.length || dp[i][j + 1] > dp[i + 1][j])
) {
output.push("+" + newLines[j]);
j++;
} else {
output.push("-" + oldLines[i]);
i++;
}
}

return output.join("\n");
}

function renderChange(change) {
if (
!change ||
typeof change !== "object" ||
typeof change.path !== "string" ||
typeof change.content !== "string"
) {
throw new Error("The server returned an invalid file-change proposal.");
}

const article = document.createElement("article");
article.className = "proposal-change";

const title = makeElement("h3", change.path);
const reason = makeElement(
"p",
typeof change.reason === "string" && change.reason.trim()
? change.reason
: "No explanation was provided."
);

article.append(title, reason);

const diff = createDiff(change.before, change.content);

if (diff !== null) {
const heading = makeElement("h4", "Proposed diff");
const pre = makeElement("pre", diff);
pre.className = "proposal-diff";
pre.style.whiteSpace = "pre-wrap";
pre.style.overflowWrap = "anywhere";

article.append(heading, pre);

} else {
const note = makeElement(
"p",
"This file is too large for an inline diff. Review the full content below."
);

const beforeHeading = makeElement("h4", "Existing content");
const before = makeElement("pre", change.before ?? "");
before.style.whiteSpace = "pre-wrap";
before.style.overflowWrap = "anywhere";
const afterHeading = makeElement("h4", "Proposed content");
const after = makeElement("pre", change.content);
after.style.whiteSpace = "pre-wrap";
after.style.overflowWrap = "anywhere";
article.append(note, beforeHeading, before, afterHeading, after);

}

return article;
}

function renderTests(tests) {
const list = $("tests");
if (!list) return;

list.replaceChildren();

if (!Array.isArray(tests)) {
list.append(makeElement("li", "No validation steps were supplied."));
return;
}

for (const test of tests) {
if (typeof test !== "string") continue;
list.append(makeElement("li", test));
}

if (!list.children.length) {
list.append(makeElement("li", "No validation steps were supplied."));
}
}

async function refreshStatus() {
const element = $("status");
if (!element) return;

element.textContent = "Checking Ollama connection…";

try {
const result = await api("/api/status");

if (result.connected) {
  element.textContent =
    `Ollama connected · Model: ${result.model || "Unknown model"}` +
    (result.root ? ` · ${result.root}` : "");
} else {
  element.textContent =
    `Ollama is not reachable at the configured address. ` +
    `Model: ${result.model || "Unknown model"}`;
}

} catch (error) {
element.textContent = Status unavailable: ${error.message};
}
}

async function proposeChanges() {
if (isBusy) return;

const request = $("request")?.value.trim() ?? "";

if (request.length < 4) {
setMessage("Enter a more detailed request.", true);
return;
}

if (request.length > 20_000) {
setMessage("The request is too long. Shorten it and try again.", true);
return;
}

const requestId = ++activeRequest;

clearReview();
setBusy(true);
setMessage("Inspecting files and requesting a proposal from Ollama…");

try {
const result = await api("/api/propose", { request });

if (requestId !== activeRequest) return;
if (
  typeof result.id !== "string" ||
  !result.id.trim() ||
  !Array.isArray(result.changes) ||
  result.changes.length === 0
) {
  throw new Error(
    "The server did not return a valid proposal with file changes."
  );
}
if (typeof result.summary !== "string") {
  throw new Error("The proposal is missing its summary.");
}
const fragment = document.createDocumentFragment();
for (const change of result.changes) {
  fragment.append(renderChange(change));
}
const changesElement = requiredElement("changes");
changesElement.replaceChildren(fragment);
requiredElement("summary").textContent = result.summary;
renderTests(result.tests);
proposalId = result.id;
requiredElement("confirmation").value = "";
requiredElement("review").hidden = false;
setMessage("Review the proposed changes before approving.");
requiredElement("review").scrollIntoView({
  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth",
  block: "start",
});

} catch (error) {
if (requestId === activeRequest) {
clearReview();
setMessage(error.message || "Unable to create a proposal.", true);
}
} finally {
if (requestId === activeRequest) {
setBusy(false);
}
}
}

function updateApprovalState() {
const approve = $("approve");
if (!approve) return;

approve.disabled =
isBusy ||
!proposalId ||
$("confirmation")?.value !== REQUIRED_CONFIRMATION;
}

async function approveChanges() {
if (
isBusy ||
!proposalId ||
$("confirmation")?.value !== REQUIRED_CONFIRMATION
) {
return;
}

const approvedId = proposalId;

const confirmed = window.confirm(
"Apply the reviewed changes to your repository? " +
"Only proceed if you have reviewed the proposal."
);

if (!confirmed) return;

setBusy(true);
setMessage("Applying the approved proposal…");

try {
const result = await api("/api/approve", {
id: approvedId,
confirm: REQUIRED_CONFIRMATION,
});

if (!Array.isArray(result.applied)) {
  throw new Error(
    "The server response did not confirm which files were applied. " +
    "Check repository status before retrying."
  );
}
proposalId = null;
clearReview();
const applied = result.applied
  .filter((path) => typeof path === "string")
  .join(", ");
setMessage(
  applied
    ? `Server reported applied files: ${applied}. Run the relevant checks and review the resulting diff.`
    : "The server returned no applied file list. Check repository status before proceeding.",
  !applied
);

} catch (error) {
setMessage(
${error.message} If the request may have reached the server,  +
"inspect repository status before retrying.",
true
);
} finally {
setBusy(false);
updateApprovalState();
}
}

async function rejectChanges() {
if (isBusy) return;

const rejectedId = proposalId;

// Invalidate any pending proposal request.
activeRequest++;
clearReview();

if (!rejectedId) {
setMessage("No active proposal.");
setBusy(false);
return;
}

setBusy(true);
setMessage("Rejecting proposal…");

try {
await api("/api/reject", { id: rejectedId });
setMessage("Proposal rejected. No changes were applied by this rejection.");
} catch (error) {
setMessage(
Could not confirm rejection: ${error.message}  +
"Verify the proposal state on the server.",
true
);
} finally {
setBusy(false);
}
}

function initialize() {
const requiredIds = [
"message",
"status",
"request",
"propose",
"summary",
"changes",
"tests",
"confirmation",
"approve",
"reject",
"review",
];

const missing = requiredIds.filter((id) => !$(id));

if (missing.length) {
console.error("MedOrbits Agent UI is missing elements:", missing);
setMessage(Interface configuration error: missing ${missing.join(", ")}, true);
return;
}

$("propose").addEventListener("click", proposeChanges);
$("confirmation").addEventListener("input", updateApprovalState);
$("approve").addEventListener("click", approveChanges);
$("reject").addEventListener("click", rejectChanges);

clearReview();
setBusy(false);

void refreshStatus();
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
initialize();
}