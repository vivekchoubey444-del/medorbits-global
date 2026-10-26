
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  asyncHandler,
  sendSuccess,
  getPagination,
  httpError,
} = require('../utils/http');

const { listPublicReleases } = require('../services/public-releases.service');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'assets', 'data');

const MAX_PAGE_SIZE = 100;

const COLLECTIONS = Object.freeze([
  { filename: 'news.json', key: 'news', outputKey: 'notices' },
  {
    filename: 'bulletins.json',
    key: 'bulletins',
    outputKey: 'bulletins',
  },
]);

function readCollection(filename, collection) {
  const file = path.join(DATA_DIR, filename);

  let raw;

  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw httpError(
        503,
        'PUBLIC_RELEASES_UNAVAILABLE',
        'Public releases are temporarily unavailable.'
      );
    }

    throw error;
  }

  let dataset;

  try {
    dataset = JSON.parse(raw);
  } catch {
    throw httpError(
      500,
      'PUBLIC_RELEASES_DATA_INVALID',
      'Public release data is invalid.'
    );
  }

  if (
    !dataset ||
    typeof dataset !== 'object' ||
    Array.isArray(dataset) ||
    !Array.isArray(dataset[collection])
  ) {
    throw httpError(
      500,
      'PUBLIC_RELEASES_DATA_INVALID',
      `${filename} must contain a valid ${collection} array.`
    );
  }

  return dataset[collection];
}

function getSafePagination(query) {
  const pagination = getPagination(query || {});

  if (
    !pagination ||
    !Number.isSafeInteger(pagination.page) ||
    pagination.page < 1 ||
    !Number.isSafeInteger(pagination.limit) ||
    pagination.limit < 1
  ) {
    throw httpError(
      400,
      'INVALID_PAGINATION',
      'Invalid pagination parameters.'
    );
  }

  const limit = Math.min(pagination.limit, MAX_PAGE_SIZE);
  const offset = (pagination.page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    throw httpError(
      400,
      'INVALID_PAGINATION',
      'The requested page is too large.'
    );
  }

  return {
    page: pagination.page,
    limit,
    offset,
  };
}

function pageItems(items, offset, limit) {
  return items.slice(offset, offset + limit);
}

const list = asyncHandler(async (req, res) => {
  const pagination = getSafePagination(req.query);

  const releases = listPublicReleases({
    news: readCollection('news.json', 'news'),
    bulletins: readCollection('bulletins.json', 'bulletins'),
  });

  if (
    !releases ||
    !Array.isArray(releases.notices) ||
    !Array.isArray(releases.bulletins)
  ) {
    throw httpError(
      500,
      'PUBLIC_RELEASES_SERVICE_INVALID',
      'The public releases service returned invalid data.'
    );
  }

  return sendSuccess(
    res,
    {
      notices: pageItems(
        releases.notices,
        pagination.offset,
        pagination.limit
      ),
      bulletins: pageItems(
        releases.bulletins,
        pagination.offset,
        pagination.limit
      ),
    },
    200,
    {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: {
          notices: releases.notices.length,
          bulletins: releases.bulletins.length,
        },
      },
    }
  );
});

module.exports = Object.freeze({ list });
