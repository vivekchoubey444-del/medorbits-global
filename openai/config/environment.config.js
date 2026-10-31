"use strict";

const fs = require("node:fs");
const path = require("node:path");

let loaded = false;

function loadEnvironment(options = {}) {
  if (loaded || process.env.NODE_ENV === "production") return;
  const envPath = options.path || path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    loaded = true;
    return;
  }

  // Prefer dotenv when installed; do not overwrite variables injected by hosting.
  try {
    require("dotenv").config({ path: envPath, override: false });
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
  loaded = true;
}

function validateEnvironment(env = process.env) {
  const enabled = String(env.OPENAI_ENABLED ?? "false").toLowerCase() === "true";
  if (enabled && !env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY.");
  if (enabled && !env.OPENAI_MODEL) throw new Error("Missing OPENAI_MODEL.");
  return true;
}

module.exports = { loadEnvironment, validateEnvironment };
