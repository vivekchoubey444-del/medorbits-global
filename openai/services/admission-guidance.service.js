"use strict";

const { askAssistant } = require("./ai-assistant.service");

async function getAdmissionGuidance({ question, course, state, admissionYear, client, config } = {}) {
  if (typeof question !== "string" || !question.trim()) {
    throw new TypeError("question must be a non-empty string.");
  }

  const context = [
    course && `Course: ${String(course).slice(0, 150)}`,
    state && `State: ${String(state).slice(0, 100)}`,
    admissionYear && `Admission year: ${String(admissionYear).slice(0, 20)}`
  ].filter(Boolean).join("\n");

  return askAssistant({
    message: [
      "Provide general admission-process guidance.",
      "Do not guarantee admission, eligibility, seat availability, or a cutoff.",
      "Direct the user to the current official counselling authority for binding requirements.",
      context,
      `Question: ${question}`
    ].filter(Boolean).join("\n"),
    client,
    config
  });
}

module.exports = { getAdmissionGuidance };
