
/**
 * MedOrbits -- Secure Download API
 * File: app/api/download/routes.js
 *
 * Note:
 * Next.js App Router expects route handlers in route.js, not routes.js.
 * Recommended location: app/api/download/route.js
 *
 * Runtime: Node.js
 *
 * Environment:
 *   DOWNLOAD_ROOT (optional; defaults to <project>/private-downloads)
 *   ALLOWED_ORIGINS (optional; comma-separated browser origins)
 *
 * Supported:
 *   GET /api/download?file=admission-guide.pdf
 *
 * Security:
 *   - Only serves files inside DOWNLOAD_ROOT.
 *   - Rejects path traversal and symbolic-link escapes.
 *   - Does not expose directory listings.
 *   - Uses an explicit file allowlist when DOWNLOAD_ALLOWLIST is set.
 */

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { realpath, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const MIME_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".csv", "text/csv; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

function jsonError(message, status) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function originAllowed(request) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();

  // Requests without Origin may be non-browser clients. Apply authentication
  // separately if downloads contain private or user-specific documents.
  return !origin || allowed.length === 0 || allowed.includes(origin);
}

function isSafeFilename(filename) {
  return (
    typeof filename === "string" &&
    filename.length > 0 &&
    filename.length <= 180 &&
    filename === path.basename(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    /^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(filename)
  );
}

function getAllowlist() {
  return new Set(
    (process.env.DOWNLOAD_ALLOWLIST || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function getDownloadRoot() {
  if (process.env.DOWNLOAD_ROOT) {
    return path.resolve(process.env.DOWNLOAD_ROOT);
  }

  // The default directory is relative to the process working directory.
  return path.resolve(process.cwd(), "private-downloads");
}

export async function GET(request) {
  if (!originAllowed(request)) {
    return jsonError("Origin not allowed.", 403);
  }

  const url = new URL(request.url);
  const filename = url.searchParams.get("file");

  if (!isSafeFilename(filename)) {
    return jsonError("A valid filename is required.", 400);
  }

  const allowlist = getAllowlist();

  // An empty allowlist means any safe filename in the private directory
  // can be requested. Production deployments should configure an allowlist
  // or add authorization before enabling private downloads.
  if (allowlist.size > 0 && !allowlist.has(filename)) {
    return jsonError("File not found.", 404);
  }

  const extension = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES.get(extension);

  if (!contentType) {
    return jsonError("This file type is not permitted.", 415);
  }

  try {
    const configuredRoot = getDownloadRoot();
    const root = await realpath(configuredRoot);
    const candidate = path.resolve(root, filename);

    if (path.dirname(candidate) !== root) {
      return jsonError("Invalid file path.", 400);
    }

    const resolvedFile = await realpath(candidate);

    // Reject symbolic links or other paths escaping the download root.
    if (path.dirname(resolvedFile) !== root) {
      return jsonError("File not found.", 404);
    }

    const fileStats = await stat(resolvedFile);

    if (!fileStats.isFile()) {
      return jsonError("File not found.", 404);
    }

    if (fileStats.size > MAX_FILE_SIZE) {
      return jsonError("File exceeds the download size limit.", 413);
    }

    const data = await fs.readFile(resolvedFile);

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "")}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return jsonError("File not found.", 404);
    }

    console.error("[download-api] Download failed:", error.message);
    return jsonError("Unable to process download.", 500);
  }
}

export async function POST() {
  return jsonError("Method not allowed.", 405);
}

export async function PUT() {
  return jsonError("Method not allowed.", 405);
}

export async function PATCH() {
  return jsonError("Method not allowed.", 405);
}

export async function DELETE() {
  return jsonError("Method not allowed.", 405);
}
