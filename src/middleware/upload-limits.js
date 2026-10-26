
'use strict';

/**
 * MedOrbits -- Secure Upload Middleware
 *
 * File: src/middleware/upload.js
 * Runtime: Node.js >= 20
 *
 * Uses Multer memory storage. Validate file content, scan uploads,
 * and authorize access before persisting files.
 *
 * MIME type and filename supplied by the client are untrusted.
 */

const DEFAULT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FIELDS = 30;
const DEFAULT_MAX_FIELD_SIZE = 64 * 1024;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function loadMulter() {
  try {
    const multer = require('multer');

    if (
      typeof multer !== 'function' ||
      typeof multer.memoryStorage !== 'function' ||
      typeof multer.MulterError !== 'function'
    ) {
      throw new TypeError('Invalid Multer module export.');
    }

    return multer;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Upload middleware requires `multer`. Install it with `npm install multer`.',
        { cause: error }
      );
    }

    throw error;
  }
}

function positiveInteger(value, name, maximum) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new TypeError(
      `${name} must be an integer between 1 and ${maximum}.`
    );
  }

  return value;
}

function normalizeMimeTypes(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (type) =>
        typeof type !== 'string' ||
        !/^[\w.+-]+\/[\w.+-]+$/.test(type)
    )
  ) {
    throw new TypeError(
      'allowedMimeTypes must be a non-empty array of valid MIME types.'
    );
  }

  return new Set(value.map((type) => type.toLowerCase()));
}

function createUpload(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Upload options must be an object.');
  }

  const multer = loadMulter();

  const maxFileSize = positiveInteger(
    options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
    'maxFileSize',
    100 * 1024 * 1024
  );

  const maxFiles = positiveInteger(
    options.maxFiles ?? DEFAULT_MAX_FILES,
    'maxFiles',
    100
  );

  const maxFields = positiveInteger(
    options.maxFields ?? DEFAULT_MAX_FIELDS,
    'maxFields',
    200
  );

  const maxFieldSize = positiveInteger(
    options.maxFieldSize ?? DEFAULT_MAX_FIELD_SIZE,
    'maxFieldSize',
    1024 * 1024
  );

  const allowedMimeTypes = normalizeMimeTypes(
    options.allowedMimeTypes ?? DEFAULT_MIME_TYPES
  );

  if (
    options.fileFilter != null &&
    typeof options.fileFilter !== 'function'
  ) {
    throw new TypeError('fileFilter must be a function.');
  }

  const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
      fields: maxFields,
      parts: maxFiles + maxFields,
      fieldNameSize: 100,
      fieldSize: maxFieldSize,
      headerPairs: 200,
    },

    fileFilter(req, file, callback) {
      const mimetype =
        typeof file?.mimetype === 'string'
          ? file.mimetype.toLowerCase()
          : '';

      if (!allowedMimeTypes.has(mimetype)) {
        return callback(
          createHttpError(
            415,
            'UNSUPPORTED_FILE_TYPE',
            'This file type is not allowed.'
          )
        );
      }

      if (options.fileFilter) {
        try {
          return options.fileFilter(req, file, callback);
        } catch (error) {
          return callback(error);
        }
      }

      return callback(null, true);
    },
  });

  function handleUploadError(error, req, res, next) {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';

      const mapped = createHttpError(
        isFileTooLarge ? 413 : 400,
        `UPLOAD_${error.code}`,
        isFileTooLarge
          ? 'The uploaded file exceeds the allowed size.'
          : 'The upload request exceeds the allowed limits or contains invalid multipart data.'
      );

      return next(mapped);
    }

    // Do not expose raw parser, filesystem, or scanner errors to clients.
    return next(error);
  }

  /**
   * Optional middleware for routes that must accept no more than
   * one uploaded file in the field named "file".
   *
   * Use upload.single('file') on the route, then handleUploadError
   * as route error middleware.
   */

  return Object.freeze({
    upload,
    handleUploadError,
    limits: Object.freeze({
      maxFileSize,
      maxFiles,
      maxFields,
      maxFieldSize,
    }),
    allowedMimeTypes: Object.freeze([...allowedMimeTypes]),
  });
}

module.exports = createUpload;
module.exports.createUpload = createUpload;
module.exports.createHttpError = createHttpError;
