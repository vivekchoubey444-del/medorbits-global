
/**
 * MedOrbits -- Document Services
 * File: /src/js/services/document.services.js
 *
 * Responsibilities:
 * - List and retrieve document records.
 * - Upload documents and supporting files.
 * - Download document content.
 * - Delete documents when authorized by the backend.
 * - Manage application-document associations.
 * - Validate upload metadata before submission.
 * - Normalize document service errors.
 *
 * Dependencies:
 * - ./api.services.js
 * - ../utils/contants.js
 * - ../utils/validators.js
 *
 * Security:
 * - Client-side checks are not authoritative.
 * - The backend must validate file contents, file size, ownership,
 *   access permissions, and document associations.
 * - Never expose private storage paths or signed download URLs in logs.
 * - Do not treat a document ID as proof of authorization.
 */

import {
  apiClient,
  ApiServiceError,
} from "./api.services.js";

import {
  API,
  VALIDATION,
} from "../utils/contants.js";

import {
  validateIdentifier,
  validateFile,
} from "../utils/validators.js";

/* --------------------------------------------------------------------------
 * Configuration
 * -------------------------------------------------------------------------- */

const DOCUMENT_ENDPOINT = (() => {
  const endpoint = API.ENDPOINTS?.DOCUMENTS;

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return `${API.PREFIX}/documents`;
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
})();

const APPLICATION_ENDPOINT = (() => {
  const endpoint = API.ENDPOINTS?.APPLICATIONS;

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return `${API.PREFIX}/applications`;
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
})();

const DEFAULT_UPLOAD_TIMEOUT_MS = API.UPLOAD_TIMEOUT_MS || 60000;

const DEFAULT_ALLOWED_MIME_TYPES = [
  ...(VALIDATION.ALLOWED_DOCUMENT_MIME_TYPES || []),
  ...(VALIDATION.ALLOWED_IMAGE_MIME_TYPES || []),
];

const DEFAULT_MAX_FILE_SIZE =
  VALIDATION.MAX_UPLOAD_SIZE_BYTES || 10 * 1024 * 1024;

/* --------------------------------------------------------------------------
 * Service errors
 * -------------------------------------------------------------------------- */

export class DocumentServiceError extends Error {
  constructor({
    message = "The document operation could not be completed.",
    code = "DOCUMENT_SERVICE_ERROR",
    status = 0,
    correlationId = null,
    cause,
  } = {}) {
    super(message);

    this.name = "DocumentServiceError";
    this.code = code;
    this.status = Number.isInteger(status) ? status : 0;
    this.correlationId = correlationId;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      correlationId: this.correlationId,
    };
  }
}

function toDocumentError(error, fallbackMessage) {
  if (error instanceof DocumentServiceError) {
    return error;
  }

  if (error instanceof ApiServiceError) {
    return new DocumentServiceError({
      message: error.message || fallbackMessage,
      code: error.code || "DOCUMENT_SERVICE_ERROR",
      status: error.status,
      correlationId: error.correlationId,
      cause: error,
    });
  }

  return new DocumentServiceError({
    message: fallbackMessage,
    code: "DOCUMENT_SERVICE_ERROR",
    cause: error,
  });
}

async function execute(operation, fallbackMessage) {
  try {
    return await operation();
  } catch (error) {
    throw toDocumentError(error, fallbackMessage);
  }
}

/* --------------------------------------------------------------------------
 * Input helpers
 * -------------------------------------------------------------------------- */

function normalizeResourceId(value, label = "Document ID") {
  const result = validateIdentifier(value, {
    required: true,
    maxLength: 128,
    label,
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
  });

  if (!result.valid) {
    throw new DocumentServiceError({
      message: `A valid ${label.toLowerCase()} is required.`,
      code: "INVALID_IDENTIFIER",
    });
  }

  return result.value;
}

function normalizePagination(options = {}) {
  const page = Number(options.page ?? 1);
  const pageSize = Number(options.pageSize ?? 20);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new DocumentServiceError({
      message: "The pagination parameters are invalid.",
      code: "INVALID_PAGINATION",
    });
  }

  return { page, pageSize };
}

function normalizeSearch(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new DocumentServiceError({
      message: "The document search value is invalid.",
      code: "INVALID_SEARCH",
    });
  }

  return value.trim().slice(0, 200);
}

function normalizeDocumentCategory(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim().length > 100 ||
    !/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(value.trim())
  ) {
    throw new DocumentServiceError({
      message: "The document category is invalid.",
      code: "INVALID_CATEGORY",
    });
  }

  return value.trim();
}

function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(metadata))
  ) {
    throw new DocumentServiceError({
      message: "Document metadata must be an object.",
      code: "INVALID_METADATA",
    });
  }

  // Only pass explicitly supported metadata fields to the API.
  const allowedKeys = [
    "category",
    "description",
    "applicationId",
    "documentType",
  ];

  const result = {};

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
      continue;
    }

    const value = metadata[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value !== "string" || value.length > 1000) {
      throw new DocumentServiceError({
        message: `The document metadata field "${key}" is invalid.`,
        code: "INVALID_METADATA",
      });
    }

    result[key] = value.trim();
  }

  if (result.applicationId) {
    result.applicationId = normalizeResourceId(
      result.applicationId,
      "Application ID"
    );
  }

  return result;
}

function validateUploadFile(file, options = {}) {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE;

  const allowedMimeTypes =
    options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;

  const result = validateFile(file, {
    required: true,
    maxSizeBytes,
    allowedMimeTypes,
    maxNameLength: 255,
  });

  if (!result.valid) {
    throw new DocumentServiceError({
      message: result.message || "Choose a valid document.",
      code: result.errors?.[0]?.code || "INVALID_FILE",
    });
  }

  return result.value;
}

function assertFormData(formData) {
  if (
    typeof FormData === "undefined" ||
    !(formData instanceof FormData)
  ) {
    throw new DocumentServiceError({
      message: "A valid FormData object is required.",
      code: "INVALID_UPLOAD",
    });
  }
}

function buildResourcePath(id) {
  const documentId = normalizeResourceId(id);

  return `${DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}`;
}

/* --------------------------------------------------------------------------
 * Document listing and metadata
 * -------------------------------------------------------------------------- */

/**
 * List document records accessible to the authenticated user.
 *
 * The backend must enforce ownership and permissions before returning data.
 */
export async function listDocuments(options = {}) {
  const pagination = normalizePagination(options);
  const query = { ...pagination };

  const search = normalizeSearch(options.search);

  if (search) {
    query.search = search;
  }

  const category = normalizeDocumentCategory(options.category);

  if (category) {
    query.category = category;
  }

  if (options.applicationId !== undefined) {
    query.applicationId = normalizeResourceId(
      options.applicationId,
      "Application ID"
    );
  }

  return execute(
    () => apiClient.get(DOCUMENT_ENDPOINT, {
      query,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }),
    "Documents could not be loaded."
  );
}

/**
 * Retrieve document metadata by document ID.
 */
export async function getDocument(documentId, options = {}) {
  const path = buildResourcePath(documentId);

  return execute(
    () => apiClient.get(path, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }),
    "The document could not be loaded."
  );
}

/**
 * Retrieve the document's audit/history information if supported by
 * the backend. The endpoint must be implemented server-side.
 */
export async function getDocumentHistory(documentId, options = {}) {
  const path = `${buildResourcePath(documentId)}/history`;

  return execute(
    () => apiClient.get(path, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }),
    "Document history could not be loaded."
  );
}

/* --------------------------------------------------------------------------
 * Document upload
 * -------------------------------------------------------------------------- */

/**
 * Upload a single document.
 *
 * FormData fields:
 * - file: the selected file
 * - optional metadata fields
 *
 * The backend must validate the actual file content, not just the declared
 * MIME type, filename extension, or browser File metadata.
 */
export async function uploadDocument(file, options = {}) {
  const validatedFile = validateUploadFile(file, options);
  const metadata = normalizeMetadata(options.metadata);

  const formData = new FormData();

  formData.append(
    options.fileField || "file",
    validatedFile,
    validatedFile.name
  );

  for (const [key, value] of Object.entries(metadata)) {
    formData.append(key, value);
  }

  return execute(
    () => apiClient.upload(DOCUMENT_ENDPOINT, formData, {
      signal: options.signal,
      timeoutMs: options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS,
      correlationId: options.correlationId,
    }),
    "The document could not be uploaded."
  );
}

/**
 * Upload a pre-built FormData object.
 *
 * The caller is responsible for ensuring that the field names match the
 * server's multipart upload contract.
 */
export async function uploadDocumentForm(formData, options = {}) {
  assertFormData(formData);

  return execute(
    () => apiClient.upload(DOCUMENT_ENDPOINT, formData, {
      signal: options.signal,
      timeoutMs: options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS,
      correlationId: options.correlationId,
    }),
    "The document could not be uploaded."
  );
}

/* --------------------------------------------------------------------------
 * Application document associations
 * -------------------------------------------------------------------------- */

/**
 * List documents associated with a particular application.
 */
export async function listApplicationDocuments(
  applicationId,
  options = {}
) {
  const id = normalizeResourceId(applicationId, "Application ID");

  return execute(
    () => apiClient.get(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/documents`,
      {
        query: {
          page: options.page ?? 1,
          pageSize: options.pageSize ?? 20,
        },
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      }
    ),
    "Application documents could not be loaded."
  );
}

/**
 * Upload a document and associate it with an application.
 *
 * Uses the application-scoped endpoint. Confirm that the backend supports
 * this route before enabling the workflow.
 */
export async function uploadApplicationDocument(
  applicationId,
  file,
  options = {}
) {
  const id = normalizeResourceId(applicationId, "Application ID");
  const validatedFile = validateUploadFile(file, options);
  const metadata = normalizeMetadata({
    ...options.metadata,
    applicationId: id,
  });

  const formData = new FormData();

  formData.append(
    options.fileField || "file",
    validatedFile,
    validatedFile.name
  );

  for (const [key, value] of Object.entries(metadata)) {
    formData.append(key, value);
  }

  return execute(
    () => apiClient.upload(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/documents`,
      formData,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS,
        correlationId: options.correlationId,
      }
    ),
    "The application document could not be uploaded."
  );
}

/* --------------------------------------------------------------------------
 * Download
 * -------------------------------------------------------------------------- */

/**
 * Fetch document bytes as a Blob.
 *
 * The centralized API client parses JSON/text responses. For binary
 * downloads, this function uses fetch directly to preserve the Blob.
 *
 * Download authorization must be enforced by the backend.
 */
export async function downloadDocument(
  documentId,
  options = {}
) {
  const path = buildResourcePath(documentId);
  const query = options.variant
    ? { variant: String(options.variant).slice(0, 50) }
    : undefined;

  const url = new URL(
    path,
    typeof globalThis.location !== "undefined"
      ? globalThis.location.origin
      : "http://localhost"
  );

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  if (typeof globalThis.fetch !== "function") {
    throw new DocumentServiceError({
      message: "File downloads are not supported in this environment.",
      code: "FETCH_UNAVAILABLE",
    });
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS;

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromCaller();
  } else if (options.signal) {
    options.signal.addEventListener("abort", abortFromCaller, {
      once: true,
    });
  }

  try {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/octet-stream, application/pdf, */*");

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "same-origin",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DocumentServiceError({
        message: response.status === 403
          ? "You do not have permission to download this document."
          : response.status === 404
            ? "The requested document could not be found."
            : "The document could not be downloaded.",
        status: response.status,
        code: response.status === 403
          ? "FORBIDDEN"
          : response.status === 404
            ? "NOT_FOUND"
            : "DOWNLOAD_FAILED",
        correlationId:
          response.headers.get("x-correlation-id") ||
          response.headers.get("x-request-id"),
      });
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof DocumentServiceError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new DocumentServiceError({
        message: "The document download was cancelled or timed out.",
        code: "DOWNLOAD_ABORTED",
        cause: error,
      });
    }

    throw new DocumentServiceError({
      message: "The document could not be downloaded. Check your connection and try again.",
      code: "DOWNLOAD_FAILED",
      cause: error,
    });
  } finally {
    clearTimeout(timer);

    if (options.signal) {
      options.signal.removeEventListener("abort", abortFromCaller);
    }
  }
}

/**
 * Trigger a browser download.
 *
 * Filename must be provided by trusted application logic or derived from
 * sanitized metadata. Never use raw response headers as trusted HTML.
 */
export function saveDownloadedBlob(blob, filename = "document") {
  if (
    typeof Blob === "undefined" ||
    !(blob instanceof Blob)
  ) {
    throw new DocumentServiceError({
      message: "The downloaded file is invalid.",
      code: "INVALID_DOWNLOAD",
    });
  }

  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new DocumentServiceError({
      message: "Browser downloads are unavailable in this environment.",
      code: "DOWNLOAD_UNAVAILABLE",
    });
  }

  const safeFilename = String(filename)
    .replace(/[\/\\\u0000-\u001F\u007F]/g, "_")
    .trim()
    .slice(0, 180) || "document";

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = safeFilename;
  anchor.hidden = true;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Give the browser time to begin consuming the object URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/* --------------------------------------------------------------------------
 * Delete
 * -------------------------------------------------------------------------- */

/**
 * Delete a document if permitted by the backend.
 *
 * Do not expose deletion controls to unauthorized users. The backend must
 * check document ownership, retention policies, and related application rules.
 */
export async function deleteDocument(documentId, options = {}) {
  const path = buildResourcePath(documentId);

  return execute(
    () => apiClient.delete(path, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      correlationId: options.correlationId,
    }),
    "The document could not be deleted."
  );
}

/* --------------------------------------------------------------------------
 * Document metadata updates
 * -------------------------------------------------------------------------- */

/**
 * Update permitted metadata fields.
 *
 * This deliberately excludes storage paths, ownership fields, security flags,
 * scan results, and privileged review fields.
 */
export async function updateDocumentMetadata(
  documentId,
  metadata,
  options = {}
) {
  const path = buildResourcePath(documentId);

  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(metadata))
  ) {
    throw new DocumentServiceError({
      message: "Document metadata must be a valid object.",
      code: "INVALID_METADATA",
    });
  }

  const allowedFields = [
    "description",
    "category",
    "documentType",
  ];

  const payload = {};

  for (const key of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
      continue;
    }

    const value = metadata[key];

    if (
      typeof value !== "string" ||
      value.trim().length > 1000
    ) {
      throw new DocumentServiceError({
        message: `The metadata field "${key}" is invalid.`,
        code: "INVALID_METADATA",
      });
    }

    payload[key] = value.trim();
  }

  if (Object.keys(payload).length === 0) {
    throw new DocumentServiceError({
      message: "Provide at least one supported metadata field.",
      code: "EMPTY_UPDATE",
    });
  }

  return execute(
    () => apiClient.patch(path, payload, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      correlationId: options.correlationId,
    }),
    "Document metadata could not be updated."
  );
}

/* --------------------------------------------------------------------------
 * Convenience facade
 * -------------------------------------------------------------------------- */

export const documentService = Object.freeze({
  listDocuments,
  getDocument,
  getDocumentHistory,

  uploadDocument,
  uploadDocumentForm,

  listApplicationDocuments,
  uploadApplicationDocument,

  downloadDocument,
  saveDownloadedBlob,

  deleteDocument,
  updateDocumentMetadata,
});

export default documentService;
