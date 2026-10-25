
'use strict';

/**
 * MedOrbits -- Secure Resource Download API
 *
 * File: app/api/download/route.js
 * Endpoint: GET /api/download?id=<resource-id>
 * Runtime: Node.js 20+
 *
 * Environment:
 *   DOWNLOADS_DIRECTORY=public/downloads
 *   DOWNLOAD_MAX_FILE_BYTES=52428800
 *
 * Security:
 * - Resource IDs are allowlisted through a fixed resource manifest.
 * - User input is never treated as a filesystem path.
 * - Path traversal is prevented.
 * - Only approved file types are served.
 * - Files must remain inside the configured download directory.
 * - No directory listing is exposed.
 * - Responses are not cached.
 *
 * Add or change downloadable resources in RESOURCE_MANIFEST.
 */

import path from 'node:path';
import { realpath, stat, open } from 'node:fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_DOWNLOAD_DIRECTORY = 'public/downloads';
const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;

const COMMON_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/**
 * Explicitly allowlisted public resources.
 *
 * Add real resources here before making them downloadable.
 * File paths are relative to DOWNLOADS_DIRECTORY.
 *
 * Do not add private documents, user uploads, admission applications,
 * identity documents, or other confidential files to this manifest.
 */
const RESOURCE_MANIFEST = Object.freeze({
  'mbbs-admission-guide': Object.freeze({
    file: 'mbbs-admission-guide.pdf',
    filename: 'MedOrbits-MBBS-Admission-Guide.pdf',
    contentType: 'application/pdf',
  }),

  'neet-ug-checklist': Object.freeze({
    file: 'neet-ug-document-checklist.pdf',
    filename: 'MedOrbits-NEET-UG-Document-Checklist.pdf',
    contentType: 'application/pdf',
  }),

  'career-guide': Object.freeze({
    file: 'career-guide.pdf',
    filename: 'MedOrbits-Career-Guide.pdf',
    contentType: 'application/pdf',
  }),

  'course-catalog': Object.freeze({
    file: 'course-catalog.pdf',
    filename: 'MedOrbits-Course-Catalog.pdf',
    contentType: 'application/pdf',
  }),
});

function jsonResponse(payload, status) {
  return Response.json(payload, {
    status,
    headers: COMMON_HEADERS,
  });
}

function getMaxFileBytes() {
  const configured = Number.parseInt(
    process.env.DOWNLOAD_MAX_FILE_BYTES ?? '',
    10,
  );

  if (!Number.isSafeInteger(configured) || configured <= 0) {
    return DEFAULT_MAX_FILE_BYTES;
  }

  // Prevent accidentally configuring an unbounded file size.
  return Math.min(configured, 200 * 1024 * 1024);
}

function getDownloadRoot() {
  const configured =
    process.env.DOWNLOADS_DIRECTORY || DEFAULT_DOWNLOAD_DIRECTORY;

  return path.resolve(process.cwd(), configured);
}

function isSafeManifestEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  if (
    typeof entry.file !== 'string' ||
    typeof entry.filename !== 'string' ||
    typeof entry.contentType !== 'string'
  ) {
    return false;
  }

  // Manifest entries must be plain filenames, not paths.
  if (
    entry.file !== path.basename(entry.file) ||
    entry.file.includes('\0') ||
    entry.file === '.' ||
    entry.file === '..'
  ) {
    return false;
  }

  // This endpoint intentionally serves only PDFs.
  if (
    entry.contentType !== 'application/pdf' ||
    !entry.file.toLowerCase().endsWith('.pdf') ||
    !entry.filename.toLowerCase().endsWith('.pdf')
  ) {
    return false;
  }

  return true;
}

function makeContentDisposition(filename) {
  const safeAscii = filename
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/[\r\n"]/g, '_');

  return `attachment; filename="${safeAscii}"`;
}

function makeDownloadHeaders(entry, size) {
  return {
    ...COMMON_HEADERS,
    'Content-Type': entry.contentType,
    'Content-Disposition': makeContentDisposition(entry.filename),
    'Content-Length': String(size),
    'Accept-Ranges': 'none',
  };
}

/**
 * Resolve and validate the resource file.
 *
 * realpath() resolves symbolic links, allowing the handler to verify that
 * the final file remains inside the intended directory.
 */
async function resolveDownload(resourceId, maxBytes) {
  const entry = RESOURCE_MANIFEST[resourceId];

  if (!entry || !isSafeManifestEntry(entry)) {
    return { error: 'not_found' };
  }

  const configuredRoot = getDownloadRoot();

  let root;
  let filePath;

  try {
    root = await realpath(configuredRoot);

    const candidate = path.resolve(root, entry.file);

    if (path.dirname(candidate) !== root) {
      return { error: 'not_found' };
    }

    filePath = await realpath(candidate);

    // Do not permit symlinks or paths that resolve outside the download root.
    if (path.dirname(filePath) !== root) {
      return { error: 'not_found' };
    }

    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      return { error: 'not_found' };
    }

    if (fileInfo.size <= 0 || fileInfo.size > maxBytes) {
      return { error: 'file_unavailable' };
    }

    return {
      entry,
      filePath,
      size: fileInfo.size,
    };
  } catch {
    // Avoid disclosing filesystem paths or operating-system errors.
    return { error: 'not_found' };
  }
}

/**
 * GET /api/download?id=mbbs-admission-guide
 */
export async function GET(request) {
  const url = new URL(request.url);
  const resourceId = url.searchParams.get('id');

  if (
    !resourceId ||
    resourceId.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resourceId)
  ) {
    return jsonResponse(
      {
        success: false,
        error: 'invalid_resource_id',
        message: 'Please provide a valid resource identifier.',
      },
      400,
    );
  }

  const maxBytes = getMaxFileBytes();
  const resolved = await resolveDownload(resourceId, maxBytes);

  if (resolved.error === 'file_unavailable') {
    return jsonResponse(
      {
        success: false,
        error: 'file_unavailable',
        message: 'This resource is currently unavailable.',
      },
      503,
    );
  }

  if (resolved.error || !resolved.entry || !resolved.filePath) {
    return jsonResponse(
      {
        success: false,
        error: 'resource_not_found',
        message: 'The requested resource was not found.',
      },
      404,
    );
  }

  let fileHandle;

  try {
    /*
     * Open the resolved path and verify the opened file.
     * O_NOFOLLOW is available on supported POSIX platforms and helps
     * prevent following a final-component symlink.
     */
    const noFollow = typeof process.platform === 'string' &&
      process.platform !== 'win32'
      ? 0x20000
      : 0;

    fileHandle = await open(
      resolved.filePath,
      noFollow ? 0 | noFollow : 'r',
    );

    const openedInfo = await fileHandle.stat();

    if (
      !openedInfo.isFile() ||
      openedInfo.size !== resolved.size ||
      openedInfo.size <= 0 ||
      openedInfo.size > maxBytes
    ) {
      return jsonResponse(
        {
          success: false,
          error: 'file_unavailable',
          message: 'This resource is currently unavailable.',
        },
        503,
      );
    }

    const buffer = await fileHandle.readFile();

    if (buffer.byteLength !== openedInfo.size) {
      return jsonResponse(
        {
          success: false,
          error: 'file_unavailable',
          message: 'This resource is currently unavailable.',
        },
        503,
      );
    }

    return new Response(buffer, {
      status: 200,
      headers: makeDownloadHeaders(resolved.entry, buffer.byteLength),
    });
  } catch {
    return jsonResponse(
      {
        success: false,
        error: 'download_failed',
        message: 'The resource could not be downloaded. Please try again later.',
      },
      500,
    );
  } finally {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}

/**
 * HEAD /api/download?id=<resource-id>
 *
 * Returns metadata without returning the file body.
 */
export async function HEAD(request) {
  const url = new URL(request.url);
  const resourceId = url.searchParams.get('id');

  if (
    !resourceId ||
    resourceId.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resourceId)
  ) {
    return new Response(null, {
      status: 400,
      headers: COMMON_HEADERS,
    });
  }

  const resolved = await resolveDownload(
    resourceId,
    getMaxFileBytes(),
  );

  if (resolved.error || !resolved.entry || !resolved.filePath) {
    return new Response(null, {
      status: resolved.error === 'file_unavailable' ? 503 : 404,
      headers: COMMON_HEADERS,
    });
  }

  return new Response(null, {
    status: 200,
    headers: makeDownloadHeaders(resolved.entry, resolved.size),
  });
}

/**
 * OPTIONS /api/download
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...COMMON_HEADERS,
      Allow: 'GET, HEAD, OPTIONS',
    },
  });
}
