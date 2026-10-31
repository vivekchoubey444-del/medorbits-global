"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const URL = "https://raw.githubusercontent.com/openai/openai-openapi/main/openapi.yaml";
const DESTINATION = path.resolve(__dirname, "../openapi.yaml");
const TEMP = `${DESTINATION}.tmp`;

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Too many redirects."));
    https.get(url, { headers: { "User-Agent": "MedOrbits-OpenAPI-Updater/1.0" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (!res.headers.location) return reject(new Error("Redirect has no location."));
        const next = new URLConstructor(res.headers.location, url).toString();
        return resolve(download(next, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed with HTTP ${res.statusCode}.`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const URLConstructor = global.URL;

async function main() {
  try {
    const data = await download(URL);
    const content = data.toString("utf8");
    if (!content.trim() || !/^openapi:\s*3\./m.test(content)) {
      throw new Error("Downloaded content does not appear to be an OpenAPI 3 specification.");
    }
    fs.mkdirSync(path.dirname(DESTINATION), { recursive: true });
    fs.writeFileSync(TEMP, content, { mode: 0o644 });
    fs.renameSync(TEMP, DESTINATION);
    console.log(`Updated ${DESTINATION} (${data.length} bytes).`);
  } catch (error) {
    try { fs.rmSync(TEMP, { force: true }); } catch {}
    console.error(`OpenAPI download failed: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
