"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.resolve(__dirname, "../openapi.yaml");

function main() {
  if (!fs.existsSync(file)) throw new Error("openapi.yaml not found. Run npm run download:openapi.");
  const content = fs.readFileSync(file, "utf8");

  if (!/^openapi:\s*3\./m.test(content)) {
    throw new Error("The file does not declare an OpenAPI 3.x version.");
  }
  if (!/^info:\s*$/m.test(content)) {
    throw new Error("OpenAPI info section is missing.");
  }
  if (!/^paths:\s*$/m.test(content)) {
    throw new Error("OpenAPI paths section is missing.");
  }

  try {
    require("@apidevtools/swagger-parser");
  } catch {
    console.warn("Swagger Parser is not installed; performing basic structural checks only.");
    console.log("Basic OpenAPI checks passed.");
    return;
  }

  const SwaggerParser = require("@apidevtools/swagger-parser");
  SwaggerParser.validate(file)
    .then((api) => {
      console.log(`OpenAPI validation passed: ${api.info?.title || "Untitled API"}`);
    })
    .catch((error) => {
      console.error(`OpenAPI validation failed: ${error.message}`);
      process.exitCode = 1;
    });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
