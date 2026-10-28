#!/usr/bin/env node
const required = ["EXPO_PUBLIC_API_BASE_URL"];
const missing = required.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and configure the values. Do not add secrets to EXPO_PUBLIC_*.");
  process.exit(1);
}
try {
  const url = new URL(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("unsupported protocol");
  if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("HTTP is only allowed for local development");
  }
  console.log("Environment configuration shape is valid.");
} catch (error) {
  console.error(`Invalid EXPO_PUBLIC_API_BASE_URL: ${error.message}`);
  process.exit(1);
}
