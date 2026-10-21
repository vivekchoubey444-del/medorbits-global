
'use strict';

/**
 * MedOrbits -- Public Data Routes
 *
 * File: src/routes/public-data.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/public-data
 *
 * Endpoint:
 * - GET /:dataset
 *
 * Security:
 * - Only explicitly allowlisted datasets can be accessed.
 * - Resolve dataset paths inside the approved data directory.
 * - Reject malformed or unexpected dataset names.
 * - Return only approved public collections and fields.
 * - Never expose filesystem paths, stack traces, or internal errors.
 * - Limit dataset file size and response payload size.
 * - Cache public datasets briefly to reduce disk I/O.
 * - Apply rate limiting through the application's middleware.
 */

const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

const { asyncHandler } = require('./route-utils');
const { httpError, sendSuccess } = require('../utils/http');

const router = express.Router();

const DATA_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'assets',
  'data',
);

const MAX_DATASET_BYTES = 10 * 1024 * 1024;
const CACHE_TTL_MS = 60 * 1000;

const PUBLIC_DATASETS = Object.freeze({
  'admission-process': ['processes'],
  admissions: ['admissions'],
  categories: ['categories'],
  'career-options': ['careerOptions'],
  colleges: ['colleges'],
  courses: ['courses'],
  countries: ['countries'],
  documents: ['documents'],
  'entrance-exams': ['exams'],
  faqs: ['faqs'],
  'fee-guides': ['documents'],
  fees: ['fees'],
  hostels: ['hostels'],
  internships: ['internships'],
  jobs: ['jobs'],
  locations: ['countries', 'states', 'cities'],
  news: ['news'],
  notifications: ['notifications'],
  recruitment: ['recruitments'],
  scholarships: ['scholarships'],
  sectors: ['sectors'],
  services: ['services'],
  testimonials: ['testimonials'],
  universities: ['universities'],
});

const cache = new Map();

function getDatasetPath(datasetName) {
  const filename = `${datasetName}.json`;
  const absolutePath = path.resolve(DATA_DIR, filename);
  const relativePath = path.relative(DATA_DIR, absolutePath);

  if (
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === '..' ||
    path.isAbsolute(relativePath)
  ) {
    throw httpError(
      400,
      'PUBLIC_DATASET_INVALID',
      'Invalid dataset name.',
    );
  }

  return absolutePath;
}

function validateDataset(dataset, collections) {
  if (
    !dataset ||
    typeof dataset !== 'object' ||
    Array.isArray(dataset)
  ) {
    throw httpError(
      503,
      'PUBLIC_DATASET_UNAVAILABLE',
      'Public dataset is temporarily unavailable.',
    );
  }

  const data = {};

  for (const collection of collections) {
    if (!Array.isArray(dataset[collection])) {
      throw httpError(
        503,
        'PUBLIC_DATASET_UNAVAILABLE',
        'Public dataset is temporarily unavailable.',
      );
    }

    data[collection] = dataset[collection];
  }

  return data;
}

async function readPublicDataset(datasetName, collections) {
  const now = Date.now();
  const cached = cache.get(datasetName);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const filename = getDatasetPath(datasetName);

  let contents;

  try {
    const stat = await fs.stat(filename);

    if (!stat.isFile() || stat.size > MAX_DATASET_BYTES) {
      throw httpError(
        503,
        'PUBLIC_DATASET_UNAVAILABLE',
        'Public dataset is temporarily unavailable.',
      );
    }

    contents = await fs.readFile(filename, 'utf8');
  } catch (error) {
    if (error.statusCode) throw error;

    if (error.code === 'ENOENT') {
      throw httpError(
        404,
        'PUBLIC_DATASET_NOT_FOUND',
        'Public dataset not found.',
      );
    }

    throw error;
  }

  let dataset;

  try {
    dataset = JSON.parse(contents);
  } catch {
    throw httpError(
      503,
      'PUBLIC_DATASET_UNAVAILABLE',
      'Public dataset is temporarily unavailable.',
    );
  }

  const result = {
    data: validateDataset(dataset, collections),
    updatedAt:
      typeof dataset.updatedAt === 'string' ||
      typeof dataset.updatedAt === 'number'
        ? dataset.updatedAt
        : null,
    expiresAt: now + CACHE_TTL_MS,
  };

  cache.set(datasetName, result);

  return result;
}

router.get(
  '/:dataset',
  asyncHandler(async (req, res) => {
    const datasetName = req.params.dataset;

    // Validate against the allowlist before performing filesystem access.
    if (
      typeof datasetName !== 'string' ||
      !Object.prototype.hasOwnProperty.call(
        PUBLIC_DATASETS,
        datasetName,
      )
    ) {
      throw httpError(
        404,
        'PUBLIC_DATASET_NOT_FOUND',
        'Public dataset not found.',
      );
    }

    const result = await readPublicDataset(
      datasetName,
      PUBLIC_DATASETS[datasetName],
    );

    res.set('Cache-Control', 'public, max-age=60');
    res.set('X-Content-Type-Options', 'nosniff');

    return sendSuccess(
      res,
      result.data,
      200,
      { updatedAt: result.updatedAt },
    );
  }),
);

// Internal utility for tests or controlled administrative refreshes.
// Do not expose cache invalidation as a public HTTP endpoint.
router.clearDatasetCache = function clearDatasetCache(datasetName) {
  if (datasetName === undefined) {
    cache.clear();
    return;
  }

  if (
    typeof datasetName !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      PUBLIC_DATASETS,
      datasetName,
    )
  ) {
    throw new TypeError('Unknown public dataset.');
  }

  cache.delete(datasetName);
};

module.exports = router;
