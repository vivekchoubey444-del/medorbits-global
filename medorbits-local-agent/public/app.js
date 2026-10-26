"use strict";

const $ = (id) => document.getElementById(id);

const elements = {
  message: $("message"),
  status: $("status"),
  request: $("request"),
  propose: $("propose"),
  review: $("review"),
  summary: $("summary"),
  changes: $("changes"),
  tests: $("tests"),
  confirmation: $("confirmation"),
  approve: $("approve"),
  reject: $("reject"),
  approvalToken: $("approvalToken"),
};

const requiredElements = [
  "message",
  "status",
  "request",
  "propose",
  "review",
  "summary",
  "changes",
  "tests",
  "confirmation",
  "approve",
  "reject",
];

for (const id of requiredElements) {
  if (!elements[id]) {
    throw new Error(`Required interface element is missing: #${id}`);
  }
}

const state = {
  proposal: null,
  busy: false,
};

function setMessage(message, type = "info") {
  elements.message.textContent = message;
  elements.message.dataset.type = type;
  elements.message.setAttribute("role", type === "error" ? "alert" : "status");
}

function setBusy(busy) {
  state.busy = busy;

  elements.propose.disabled = busy;
  elements.approve.disabled = busy || !state.proposal;
  elements.reject.disabled = busy || !state.proposal;

  elements.propose.setAttribute("aria-busy", String(busy));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || `Request failed with HTTP ${response.status}.` };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `Request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

function clearProposal() {
  state.proposal = null;

  elements.review.hidden = true;
  elements.summary.textContent = "";
  elements.changes.replaceChildren();
  elements.tests.textContent = "";
  elements.confirmation.checked = false;

  elements.approve.disabled = true;
  elements.reject.disabled = true;
}

function addText(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text == null ? "" : String(text);

  if (className) {
    element.className = className;
  }

  return element;
}

function renderStatus(data) {
  const parts = [];

  if (data.status) parts.push(`Status: ${data.status}`);
  if (data.model) parts.push(`Model: ${data.model}`);
  if (data.provider) parts.push(`Provider: ${data.provider}`);
  if (data.root) parts.push(`Repository: ${data.root}`);

  if (typeof data.fileWritesEnabled === "boolean") {
    parts.push(
      `File writes: ${data.fileWritesEnabled ? "enabled" : "disabled"}`
    );
  }

  if (typeof data.allowFileWrites === "boolean") {
    parts.push(
      `File writes: ${data.allowFileWrites ? "enabled" : "disabled"}`
    );
  }

  elements.status.textContent = parts.length
    ? parts.join(" · ")
    : "Agent connected.";
}

async function refreshStatus() {
  try {
    const data = await api("/api/status");
    renderStatus(data);
  } catch (error) {
    elements.status.textContent = `Status unavailable: ${error.message}`;
  }
}

function getDiff(change) {
  if (typeof change.diff === "string") return change.diff;
  if (typeof change.patch === "string") return change.patch;
  if (typeof change.content === "string") return change.content;

  const before = change.before ?? change.oldContent ?? "";
  const after = change.after ?? change.newContent ?? "";

  if (before === after) {
    return "(No content change supplied.)";
  }

  return [
    "--- before",
    ...String(before).split("\n").map((line) => `- ${line}`),
    "+++ after",
    ...String(after).split("\n").map((line) => `+ ${line}`),
  ].join("\n");
}

function renderChanges(changes) {
  elements.changes.replaceChildren();

  if (!Array.isArray(changes) || changes.length === 0) {
    elements.changes.appendChild(
      addText("p", "No file changes were supplied.")
    );
    return;
  }

  for (const change of changes) {
    const card = document.createElement("section");
    card.className = "change-card";

    const filePath =
      change.path ||
      change.file ||
      change.filename ||
      "(unspecified file)";

    card.appendChild(addText("h3", filePath, "change-path"));

    if (change.action) {
      card.appendChild(
        addText("p", `Action: ${change.action}`, "change-action")
      );
    }

    if (change.reason) {
      card.appendChild(
        addText("p", change.reason, "change-reason")
      );
    }

    const pre = document.createElement("pre");
    pre.className = "diff";
    pre.textContent = getDiff(change);
    card.appendChild(pre);

    elements.changes.appendChild(card);
  }
}

function renderProposal(data) {
  const proposal = data.proposal || data;

  state.proposal = proposal;

  elements.summary.textContent =
    proposal.summary ||
    proposal.description ||
    "Review the proposed changes before approving.";

  renderChanges(
    proposal.changes ||
    proposal.files ||
    []
  );

  const tests = proposal.tests || proposal.validation || [];

  if (Array.isArray(tests)) {
    elements.tests.textContent = tests.length
      ? tests.map((test) => {
          if (typeof test === "string") return `• ${test}`;
          return `• ${test.name || test.command || JSON.stringify(test)}`;
        }).join("\n")
      : "No validation commands supplied.";
  } else {
    elements.tests.textContent = String(tests);
  }

  elements.confirmation.checked = false;
  elements.review.hidden = false;

  elements.approve.disabled = false;
  elements.reject.disabled = false;

  setMessage(
    "Proposal created. Review every file change before approving.",
    "success"
  );
}

function getProposalId() {
  const proposal = state.proposal;

  if (!proposal) return null;

  return (
    proposal.id ||
    proposal.proposalId ||
    proposal.proposal_id ||
    null
  );
}

function getApprovalToken() {
  return elements.approvalToken
    ? elements.approvalToken.value.trim()
    : "";
}

async function createProposal() {
  if (state.busy) return;

  const request = elements.request.value.trim();

  if (!request) {
    setMessage("Enter a task or change request first.", "error");
    elements.request.focus();
    return;
  }

  if (request.length > 3000) {
    setMessage(
      "Your request is too long. Limit it to 3,000 characters.",
      "error"
    );
    return;
  }

  clearProposal();
  setBusy(true);
  setMessage("Preparing proposal…");

  try {
    const data = await api("/api/propose", {
      method: "POST",
      body: JSON.stringify({ request }),
    });

    renderProposal(data);
  } catch (error) {
    setMessage(`Could not create proposal: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function approveProposal() {
  if (state.busy || !state.proposal) return;

  if (!elements.confirmation.checked) {
    setMessage(
      "Review the changes and confirm before approving.",
      "error"
    );
    return;
  }

  const proposalId = getProposalId();

  if (!proposalId) {
    setMessage(
      "The proposal ID is missing. Create a new proposal.",
      "error"
    );
    return;
  }

  const body = { proposalId };
  const approvalToken = getApprovalToken();

  if (approvalToken) {
    body.approvalToken = approvalToken;
  }

  setBusy(true);
  setMessage("Submitting approval…");

  try {
    const data = await api("/api/approve", {
      method: "POST",
      body: JSON.stringify(body),
    });

    clearProposal();

    setMessage(
      data.message ||
      data.status ||
      "Approval request completed.",
      "success"
    );

    await refreshStatus();
  } catch (error) {
    setMessage(`Approval failed: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function rejectProposal() {
  if (state.busy || !state.proposal) return;

  const proposalId = getProposalId();

  if (!proposalId) {
    setMessage(
      "The proposal ID is missing. Create a new proposal.",
      "error"
    );
    return;
  }

  setBusy(true);
  setMessage("Rejecting proposal…");

  try {
    const data = await api("/api/reject", {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    });

    clearProposal();

    setMessage(
      data.message ||
      data.status ||
      "Proposal rejected.",
      "success"
    );
  } catch (error) {
    setMessage(`Rejection failed: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

elements.propose.addEventListener("click", createProposal);
elements.approve.addEventListener("click", approveProposal);
elements.reject.addEventListener("click", rejectProposal);

elements.request.addEventListener("keydown", (event) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key === "Enter"
  ) {
    event.preventDefault();
    createProposal();
  }
});

refreshStatus();