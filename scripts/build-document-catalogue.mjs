
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jsonOutput = args.includes("--json");

function option(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const documentsDir = path.resolve(
  ROOT_DIR,
  option("dir", "assets/documents")
);

const outputFile = path.resolve(
  ROOT_DIR,
  option(
    "output",
    "assets/documents/catalogue.json"
  )
);

const errors = [];
const warnings = [];
const catalogue = [];
const seenIds = new Set();
const seenPaths = new Set();

function relative(file) {
  return path.relative(ROOT_DIR, file).split(path.sep).join("/");
}

function addError(file, message) {
  errors.push({ file: relative(file), message });
}

function addWarning(file, message) {
  warnings.push({ file: relative(file), message });
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return (
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    addError(
      file,
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

function findManifests(directory) {
  const results = [];

  function walk(current) {
    let entries;

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      addError(
        current,
        `Cannot read directory: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isSymbolicLink()) {
        addWarning(fullPath, "Symbolic link skipped.");
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase() === "manifest.json"
      ) {
        results.push(fullPath);
      }
    }
  }

  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    addError(directory, "Documents directory does not exist.");
    return results;
  }

  walk(directory);
  return results;
}

function normalizeKeywords(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

function resolveResourcePath(manifestFile, resourcePath) {
  if (
    typeof resourcePath !== "string" ||
    !resourcePath.trim() ||
    path.isAbsolute(resourcePath) ||
    resourcePath.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(resourcePath)
  ) {
    return null;
  }

  const segments = resourcePath.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const resolved = path.resolve(path.dirname(manifestFile), resourcePath);

  return isInside(documentsDir, resolved) ? resolved : null;
}

function publicResourceUrl(manifestFile, resourcePath) {
  const resolved = resolveResourcePath(manifestFile, resourcePath);
  if (!resolved) return null;

  const documentRelative = path.relative(documentsDir, resolved);
  return `/assets/documents/${documentRelative
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/")}`;
}

function processManifest(manifestFile) {
  const manifest = readJson(manifestFile);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    addError(manifestFile, "Manifest root must be an object.");
    return;
  }

  if (!Array.isArray(manifest.resources)) {
    addWarning(manifestFile, "Manifest has no resources array; skipped.");
    return;
  }

  for (const [index, resource] of manifest.resources.entries()) {
    const location = `resources[${index}]`;

    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
      addError(manifestFile, `${location} must be an object.`);
      continue;
    }

    const id = typeof resource.id === "string" ? resource.id.trim() : "";
    const title =
      typeof resource.title === "string" ? resource.title.trim() : "";
    const resourcePath =
      typeof resource.path === "string" ? resource.path.trim() : "";

    if (!id || !title || !resourcePath) {
      addError(manifestFile, `${location} requires id, title, and path.`);
      continue;
    }

    if (seenIds.has(id)) {
      addError(manifestFile, `Duplicate resource ID: ${id}`);
      continue;
    }

    const resolved = resolveResourcePath(manifestFile, resourcePath);

    if (!resolved) {
      addError(
        manifestFile,
        `${location}.path is unsafe or resolves outside assets/documents.`
      );
      continue;
    }

    const normalizedPath = path.relative(documentsDir, resolved)
      .split(path.sep)
      .join("/");

    if (seenPaths.has(normalizedPath)) {
      addError(
        manifestFile,
        `Duplicate resource path: ${normalizedPath}`
      );
      continue;
    }

    if (
      resource.status === "published" &&
      (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile())
    ) {
      addError(
        manifestFile,
        `Published resource file is missing: ${normalizedPath}`
      );
      continue;
    }

    if (!["published", "draft", "archived"].includes(resource.status)) {
      addWarning(
        manifestFile,
        `${location} has unrecognized status "${String(resource.status)}".`
      );
    }

    seenIds.add(id);
    seenPaths.add(normalizedPath);

    // Do not expose draft or archived records in the public catalogue.
    if (resource.status !== "published") continue;

    const url = publicResourceUrl(manifestFile, resourcePath);

    if (!url) {
      addError(manifestFile, `${location} has an invalid public URL path.`);
      continue;
    }

    catalogue.push({
      id,
      title,
      category:
        typeof resource.category === "string"
          ? resource.category
          : "general",
      description:
        typeof resource.description === "string"
          ? resource.description
          : "",
      intendedUse:
        typeof resource.intendedUse === "string"
          ? resource.intendedUse
          : "",
      format:
        typeof resource.format === "string"
          ? resource.format
          : "application/pdf",
      language:
        typeof resource.language === "string"
          ? resource.language
          : "en",
      version:
        typeof resource.version === "string"
          ? resource.version
          : "1.0.0",
      keywords: normalizeKeywords(resource.keywords),
      url
    });
  }
}

const manifestFiles = findManifests(documentsDir);

for (const file of manifestFiles) {
  processManifest(file);
}

catalogue.sort((a, b) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" })
);

const output = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  count: catalogue.length,
  resources: catalogue
};

const result = {
  ok: errors.length === 0,
  manifestsFound: manifestFiles.length,
  publishedResources: catalogue.length,
  output: relative(outputFile),
  errors,
  warnings
};

if (jsonOutput) {
  console.log(JSON.stringify({ ...result, catalogue: output }, null, 2));
} else {
  console.log("MedOrbits document catalogue builder");
  console.log(`Manifests found: ${result.manifestsFound}`);
  console.log(`Published resources: ${result.publishedResources}`);

  for (const warning of warnings) {
    console.warn(`WARNING: ${warning.file}: ${warning.message}`);
  }

  for (const err of errors) {
    console.error(`ERROR: ${err.file}: ${err.message}`);
  }
}

if (errors.length > 0) {
  if (!jsonOutput) {
    console.error("Catalogue generation stopped; fix the errors first.");
  }
  process.exitCode = 1;
} else if (dryRun) {
  if (!jsonOutput) console.log("Dry run complete; no files written.");
} else {
  try {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    // Prevent writing outside the repository.
    if (!isInside(ROOT_DIR, outputFile)) {
      throw new Error("Output path must remain inside the repository.");
    }

    fs.writeFileSync(
      outputFile,
      `${JSON.stringify(output, null, 2)}\n`,
      "utf8"
    );

    if (!jsonOutput) {
      console.log(`Catalogue written to ${relative(outputFile)}`);
    }
  } catch (err) {
    console.error(
      `Unable to write catalogue: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    process.exitCode = 1;
  }
}
