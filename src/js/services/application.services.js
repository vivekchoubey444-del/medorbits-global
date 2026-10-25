
/**
 * MedOrbits -- Application Services
 * File: /src/js/services/application.services.js
 *
 * Responsibilities:
 * - Manage student and candidate applications.
 * - Submit and retrieve application records.
 * - Update application information.
 * - Track application status.
 * - Support withdrawal where the backend permits it.
 * - Upload application-related documents.
 * - Normalize application service errors.
 *
 * Dependencies:
 * - ../services/api.services.js
 * - ../utils/validators.js
 * - ../utils/contants.js
 *
 * Security:
 * - The backend remains authoritative for validation, permissions,
 *   application ownership, status transitions, and document access.
 * - Never trust application IDs, status values, or role information
 *   supplied by the browser without server-side authorization.
 */

import {
  apiClient,
  ApiServiceError,
} from "./api.services.js";

import {
  API,
  APPLICATION_STATUS,
} from "../utils/contants.js";

import {
  validateApplicationPayload,
  validateIdentifier,
} from "../utils/validators.js";

/* --------------------------------------------------------------------------
 * Configuration
 * -------------------------------------------------------------------------- */

const APPLICATION_ENDPOINT = (() => {
  const endpoint = API.ENDPOINTS?.APPLICATIONS;

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return `${API.PREFIX}/applications`;
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
})();

const DOCUMENT_ENDPOINT = (() => {
  const endpoint = API.ENDPOINTS?.DOCUMENTS;

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return `${API.PREFIX}/documents`;
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
})();

const ALLOWED_APPLICATION_STATUSES = new Set(
  Object.values(APPLICATION_STATUS)
);

/* --------------------------------------------------------------------------
 * Service-specific errors
 * -------------------------------------------------------------------------- */

export class ApplicationServiceError extends Error {
  constructor({
    message = "The application operation could not be completed.",
    code = "APPLICATION_SERVICE_ERROR",
    status = 0,
    correlationId = null,
    cause,
  } = {}) {
    super(message);

    this.name = "ApplicationServiceError";
    this.code = code;
    this.status = status;
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

function toApplicationError(error, fallbackMessage) {
  if (error instanceof ApplicationServiceError) {
    return error;
  }

  if (error instanceof ApiServiceError) {
    return new ApplicationServiceError({
      message: error.message || fallbackMessage,
      code: error.code || "APPLICATION_SERVICE_ERROR",
      status: error.status,
      correlationId: error.correlationId,
      cause: error,
    });
  }

  return new ApplicationServiceError({
    message: fallbackMessage,
    code: "APPLICATION_SERVICE_ERROR",
    cause: error,
  });
}

async function execute(operation, fallbackMessage) {
  try {
    return await operation();
  } catch (error) {
    throw toApplicationError(error, fallbackMessage);
  }
}

/* --------------------------------------------------------------------------
 * Input helpers
 * -------------------------------------------------------------------------- */

function normalizeApplicationId(applicationId) {
  const result = validateIdentifier(applicationId, {
    required: true,
    maxLength: 128,
    label: "Application ID",
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
  });

  if (!result.valid) {
    throw new ApplicationServiceError({
      message: "A valid application ID is required.",
      code: "INVALID_APPLICATION_ID",
    });
  }

  return result.value;
}

function normalizeDocumentId(documentId) {
  const result = validateIdentifier(documentId, {
    required: true,
    maxLength: 128,
    label: "Document ID",
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
  });

  if (!result.valid) {
    throw new ApplicationServiceError({
      message: "A valid document ID is required.",
      code: "INVALID_DOCUMENT_ID",
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
    throw new ApplicationServiceError({
      message: "The pagination parameters are invalid.",
      code: "INVALID_PAGINATION",
    });
  }

  return {
    page,
    pageSize,
  };
}

function normalizeStatus(status) {
  if (typeof status !== "string") {
    throw new ApplicationServiceError({
      message: "A valid application status is required.",
      code: "INVALID_APPLICATION_STATUS",
    });
  }

  const normalized = status.trim().toLowerCase();

  if (!ALLOWED_APPLICATION_STATUSES.has(normalized)) {
    throw new ApplicationServiceError({
      message: "The requested application status is not supported.",
      code: "INVALID_APPLICATION_STATUS",
    });
  }

  return normalized;
}

function normalizePlainObject(value, label = "Application data") {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new ApplicationServiceError({
      message: `${label} must be a valid object.`,
      code: "INVALID_PAYLOAD",
    });
  }

  return value;
}

/**
 * Validate the payload before sending it.
 *
 * Server-side validation is still required. The payload contract should
 * match /api/schemas/application.schema.json.
 */
function validateCreatePayload(payload) {
  normalizePlainObject(payload);

  const result = validateApplicationPayload(payload);

  if (!result.valid) {
    throw new ApplicationServiceError({
      message: "Please correct the application information before submitting.",
      code: "VALIDATION_ERROR",
    });
  }

  return result.value;
}

/**
 * Validate a partial update without requiring fields that may already
 * exist on the server.
 */
function validateUpdatePayload(payload) {
  normalizePlainObject(payload);

  const forbiddenFields = [
    "id",
    "applicationId",
    "userId",
    "ownerId",
    "createdAt",
    "updatedAt",
    "approvedBy",
    "reviewedBy",
  ];

  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      throw new ApplicationServiceError({
        message: "The update contains a field that cannot be modified here.",
        code: "FORBIDDEN_FIELD",
      });
    }
  }

  if (Object.keys(payload).length === 0) {
    throw new ApplicationServiceError({
      message: "Provide at least one field to update.",
      code: "EMPTY_UPDATE",
    });
  }

  return payload;
}

function assertFormData(formData) {
  if (
    typeof FormData === "undefined" ||
    !(formData instanceof FormData)
  ) {
    throw new ApplicationServiceError({
      message: "Application document upload requires FormData.",
      code: "INVALID_UPLOAD",
    });
  }
}

/* --------------------------------------------------------------------------
 * Application CRUD operations
 * -------------------------------------------------------------------------- */

/**
 * Retrieve a paginated list of applications.
 *
 * The backend must scope results according to the authenticated user's
 * permissions. Pagination is not an authorization mechanism.
 */
export async function listApplications(options = {}) {
  const pagination = normalizePagination(options);

  const query = {
    ...pagination,
  };

  if (typeof options.search === "string" && options.search.trim()) {
    query.search = options.search.trim().slice(0, 200);
  }

  if (options.status !== undefined && options.status !== null) {
    query.status = normalizeStatus(options.status);
  }

  if (typeof options.sort === "string" && options.sort.trim()) {
    query.sort = options.sort.trim().slice(0, 64);
  }

  return execute(
    () => apiClient.get(APPLICATION_ENDPOINT, {
      query,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }),
    "Applications could not be loaded."
  );
}

/**
 * Retrieve a single application by ID.
 */
export async function getApplication(applicationId, options = {}) {
  const id = normalizeApplicationId(applicationId);

  return execute(
    () => apiClient.get(`${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}`, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    }),
    "The application could not be loaded."
  );
}

/**
 * Create a new application.
 */
export async function createApplication(payload, options = {}) {
  const validatedPayload = validateCreatePayload(payload);

  return execute(
    () => apiClient.post(APPLICATION_ENDPOINT, validatedPayload, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      correlationId: options.correlationId,
    }),
    "The application could not be submitted."
  );
}

/**
 * Update editable application fields.
 *
 * Do not use this function to change workflow status or privileged review
 * fields. Those operations should have dedicated, permission-checked
 * backend endpoints.
 */
export async function updateApplication(
  applicationId,
  payload,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);
  const validatedPayload = validateUpdatePayload(payload);

  return execute(
    () => apiClient.patch(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}`,
      validatedPayload,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        correlationId: options.correlationId,
      }
    ),
    "The application could not be updated."
  );
}

/**
 * Withdraw an application if the backend permits it.
 *
 * This operation intentionally uses a dedicated action endpoint instead
 * of allowing arbitrary status changes through updateApplication().
 */
export async function withdrawApplication(
  applicationId,
  {
    reason,
    signal,
    timeoutMs,
    correlationId,
  } = {}
) {
  const id = normalizeApplicationId(applicationId);

  const payload = {};

  if (reason !== undefined && reason !== null) {
    if (typeof reason !== "string" || reason.trim().length > 1000) {
      throw new ApplicationServiceError({
        message: "The withdrawal reason is invalid.",
        code: "INVALID_WITHDRAWAL_REASON",
      });
    }

    payload.reason = reason.trim();
  }

  return execute(
    () => apiClient.post(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/withdraw`,
      payload,
      {
        signal,
        timeoutMs,
        correlationId,
      }
    ),
    "The application could not be withdrawn."
  );
}

/* --------------------------------------------------------------------------
 * Application status
 * -------------------------------------------------------------------------- */

/**
 * Retrieve the latest application status from the backend.
 */
export async function getApplicationStatus(
  applicationId,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);

  return execute(
    () => apiClient.get(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/status`,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      }
    ),
    "The application status could not be retrieved."
  );
}

/**
 * Request an application status transition.
 *
 * IMPORTANT:
 * The backend must authorize this action, validate the current state, and
 * enforce the workflow transition. Client-side status checks are not enough.
 *
 * This function expects the backend to expose a dedicated status endpoint.
 * Remove or adjust it if your backend uses a different route.
 */
export async function requestApplicationStatusChange(
  applicationId,
  status,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);
  const nextStatus = normalizeStatus(status);

  return execute(
    () => apiClient.patch(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/status`,
      {
        status: nextStatus,
        ...(options.reason !== undefined
          ? { reason: String(options.reason).trim().slice(0, 1000) }
          : {}),
      },
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        correlationId: options.correlationId,
      }
    ),
    "The application status could not be changed."
  );
}

/* --------------------------------------------------------------------------
 * Application documents
 * -------------------------------------------------------------------------- */

/**
 * Upload a document associated with an application.
 *
 * The FormData field names must match the backend upload contract.
 * The backend must verify ownership, size, file content, and permitted types.
 */
export async function uploadApplicationDocument(
  applicationId,
  fileOrFormData,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);

  let formData;

  if (
    typeof FormData !== "undefined" &&
    fileOrFormData instanceof FormData
  ) {
    formData = fileOrFormData;
  } else {
    if (
      typeof File === "undefined" ||
      !(fileOrFormData instanceof File)
    ) {
      throw new ApplicationServiceError({
        message: "Choose a valid document to upload.",
        code: "INVALID_UPLOAD",
      });
    }

    formData = new FormData();
    formData.append("file", fileOrFormData);
  }

  assertFormData(formData);

  return execute(
    () => apiClient.upload(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/documents`,
      formData,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        correlationId: options.correlationId,
      }
    ),
    "The application document could not be uploaded."
  );
}

/**
 * List documents attached to an application.
 */
export async function listApplicationDocuments(
  applicationId,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);

  return execute(
    () => apiClient.get(
      `${APPLICATION_ENDPOINT}/${encodeURIComponent(id)}/documents`,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      }
    ),
    "Application documents could not be loaded."
  );
}

/**
 * Delete an application document by its document ID.
 *
 * The backend must verify that the document belongs to the application
 * and that the authenticated user is permitted to delete it.
 */
export async function deleteApplicationDocument(
  applicationId,
  documentId,
  options = {}
) {
  const id = normalizeApplicationId(applicationId);
  const document = normalizeDocumentId(documentId);

  return execute(
    () => apiClient.delete(
      `${DOCUMENT_ENDPOINT}/${encodeURIComponent(document)}`,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        correlationId: options.correlationId,
      }
    ),
    "The application document could not be deleted."
  );
}

/* --------------------------------------------------------------------------
 * Convenience facade
 * -------------------------------------------------------------------------- */

export const applicationService = Object.freeze({
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  withdrawApplication,
  getApplicationStatus,
  requestApplicationStatusChange,
  uploadApplicationDocument,
  listApplicationDocuments,
  deleteApplicationDocument,
});

export default applicationService;
