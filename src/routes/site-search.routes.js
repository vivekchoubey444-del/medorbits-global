
'use strict';

/**
 * MedOrbits -- Unified Website Search
 *
 * File: src/routes/search.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/search
 *
 * Features:
 * - Searches education datasets and public HTML pages.
 * - Supports query, type, limit, and offset parameters.
 * - Uses weighted relevance scoring and deterministic pagination.
 * - Caches the search index with a configurable refresh interval.
 * - Handles missing or invalid datasets without crashing the server.
 * - Restricts filesystem traversal to the configured project root.
 *
 * Security:
 * - Never indexes environment files, hidden directories, or private folders.
 * - Never returns internal filesystem paths or raw dataset records.
 * - Limits query length, term count, and result page size.
 * - Does not execute external searches or fetch user-supplied URLs.
 *
 * Environment:
 * - MEDORBITS_SEARCH_CACHE_TTL_MS (default: 300000)
 * - MEDORBITS_SEARCH_MAX_HTML_FILES (default: 10000)
 */

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const router = express.Router();

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'assets', 'data');

const CACHE_TTL_MS = readPositiveInteger(
  process.env.MEDORBITS_SEARCH_CACHE_TTL_MS,
  300000,
  86400000,
);

const MAX_HTML_FILES = readPositiveInteger(
  process.env.MEDORBITS_SEARCH_MAX_HTML_FILES,
  10000,
  100000,
);

const MAX_QUERY_LENGTH = 100;
const MAX_TERMS = 8;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 100000;
const MAX_SUMMARY_LENGTH = 240;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'tests',
  'test',
  'docs',
  'storage',
  'infrastructure',
  'coverage',
  'dist',
  'build',
  'vendor',
  'private',
  'uploads',
  'logs',
  'tmp',
  'temp',
  'secrets',
]);

const SKIP_FILES = new Set([
  '400.html',
  '401.html',
  '403.html',
  '404.html',
  '405.html',
  '408.html',
  '429.html',
  '500.html',
  '502.html',
  '503.html',
  '504.html',
  'offline.html',
  'maintenance.html',
]);

const DATASETS = [
  {
    file: 'courses.json',
    key: 'courses',
    type: 'course',
    url: (record) =>
      `/education/course-details.html?slug=${encodeURIComponent(
        safeIdentifier(record.slug || record.id),
      )}`,
  },
  {
    file: 'universities.json',
    key: 'universities',
    type: 'university',
    url: () => '/education/universities.html',
  },
  {
    file: 'colleges.json',
    key: 'colleges',
    type: 'college',
    url: () => '/education/colleges.html',
  },
  {
    file: 'scholarships.json',
    key: 'scholarships',
    type: 'scholarship',
    url: () => '/education/resources/scholarships.html',
  },
  {
    file: 'services.json',
    key: 'services',
    type: 'service',
    url: () => '/pages/services.html',
  },
  {
    file: 'faqs.json',
    key: 'faqs',
    type: 'faq',
    url: () => '/education/resources/faqs.html',
  },
  {
    file: 'news.json',
    key: 'news',
    type: 'news',
    url: () => '/pages/notifications.html',
  },
  {
    file: 'jobs.json',
    key: 'jobs',
    type: 'job',
    url: () => '/career/jobs.html',
  },
  {
    file: 'internships.json',
    key: 'internships',
    type: 'internship',
    url: () => '/career/internships.html',
  },
];

const ALLOWED_TYPES = new Set([
  'course',
  'university',
  'college',
  'scholarship',
  'service',
  'faq',
  'news',
  'job',
  'internship',
  'page',
]);

let cachedIndex = null;
let cacheExpiresAt = 0;
let rebuilding = null;

function readPositiveInteger(value, fallback, maximum) {
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return fallback;
  }

  return parsed;
}

function safeIdentifier(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return '';
  }

  const result = String(value).trim();

  if (
    !result ||
    result.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(result)
  ) {
    return '';
  }

  return result;
}

function normalizeText(value, maximum = 5000) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function collectText(value, output, depth = 0) {
  if (
    depth > 4 ||
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const text = normalizeText(value, 2000);
    if (text) output.push(text);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      collectText(item, output, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      // Avoid indexing internal or potentially sensitive metadata.
      if (
        /password|secret|token|credential|private|internal|email|phone|mobile|address|document|filePath|storageKey/i.test(
          key,
        )
      ) {
        continue;
      }

      collectText(item, output, depth + 1);
    }
  }
}

function resolveInsideRoot(base, target) {
  const resolved = path.resolve(base, target);
  const relative = path.relative(base, resolved);

  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    return null;
  }

  return resolved;
}

function walkHtml(dir, files = []) {
  if (files.length >= MAX_HTML_FILES) return files;

  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (files.length >= MAX_HTML_FILES) break;

    if (
      entry.name.startsWith('.') ||
      SKIP_DIRS.has(entry.name.toLowerCase())
    ) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);

    // Do not follow symbolic links during recursive indexing.
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      walkHtml(absolutePath, files);
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.html') &&
      !SKIP_FILES.has(entry.name.toLowerCase())
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function extractHtmlMetadata(html) {
  const titleMatch = html.match(
    /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i,
  );

  const descriptionMatch = html.match(
    /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["']([^"']*)["'])[^>]*>/i,
  );

  const title = titleMatch
    ? normalizeText(decodeHtmlEntities(titleMatch[1]), 300)
    : '';

  const description = descriptionMatch
    ? normalizeText(
        decodeHtmlEntities(
          descriptionMatch[1] || '',
        ),
        MAX_SUMMARY_LENGTH,
      )
    : '';

  return { title, description };
}

function normalizeDatasetRecords(json, key) {
  if (Array.isArray(json)) return json;

  if (
    json &&
    typeof json === 'object' &&
    Array.isArray(json[key])
  ) {
    return json[key];
  }

  if (
    json &&
    typeof json === 'object' &&
    Array.isArray(json.data)
  ) {
    return json.data;
  }

  return [];
}

function makeSearchItem({
  id,
  type,
  title,
  summary,
  url,
  text,
}) {
  const safeTitle = normalizeText(title, 300);
  if (!safeTitle) return null;

  const safeSummary = normalizeText(
    summary || '',
    MAX_SUMMARY_LENGTH,
  );

  const normalizedText = normalizeText(
    `${safeTitle} ${text || ''} ${safeSummary}`,
    12000,
  );

  return {
    id: safeIdentifier(id) || null,
    type,
    title: safeTitle,
    summary: safeSummary,
    url,
    titleLower: safeTitle.toLowerCase(),
    haystack: normalizedText.toLowerCase(),
  };
}

function buildIndex() {
  const items = [];
  const seen = new Set();

  function addItem(item) {
    if (!item) return;

    const key = `${item.type}:${item.url}:${item.titleLower}`;
    if (seen.has(key)) return;

    seen.add(key);
    items.push(item);
  }

  for (const dataset of DATASETS) {
    const filePath = resolveInsideRoot(
      DATA_DIR,
      dataset.file,
    );

    if (!filePath) continue;

    let json;

    try {
      const stat = fs.statSync(filePath);

      if (!stat.isFile() || stat.size > 25 * 1024 * 1024) {
        continue;
      }

      json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      // A missing or malformed dataset should not break search.
      continue;
    }

    const records = normalizeDatasetRecords(json, dataset.key);

    for (const record of records) {
      if (
        !record ||
        typeof record !== 'object' ||
        Array.isArray(record) ||
        record.active === false ||
        record.published === false ||
        record.status === 'draft' ||
        record.status === 'private'
      ) {
        continue;
      }

      const title = normalizeText(
        record.name || record.title || record.question || '',
        300,
      );

      if (!title) continue;

      const textParts = [];

      collectText(
        {
          name: record.name,
          shortName: record.shortName,
          aliases: record.aliases,
          tags: record.tags,
          summary: record.summary,
          description: record.description,
          shortDescription: record.shortDescription,
          category: record.category,
          discipline: record.discipline,
          level: record.level,
          stateName: record.stateName,
          answer: record.answer,
        },
        textParts,
      );

      let url;

      try {
        url = dataset.url(record);
      } catch {
        continue;
      }

      if (
        typeof url !== 'string' ||
        !url.startsWith('/') ||
        url.startsWith('//') ||
        /[\r\n]/.test(url)
      ) {
        continue;
      }

      addItem(
        makeSearchItem({
          id: record.id,
          type: dataset.type,
          title,
          summary:
            record.shortDescription ||
            record.summary ||
            record.description ||
            record.answer ||
            '',
          url,
          text: textParts.join(' '),
        }),
      );
    }
  }

  const htmlFiles = walkHtml(ROOT_DIR);

  for (const filePath of htmlFiles) {
    let html;

    try {
      const stat = fs.statSync(filePath);

      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
        continue;
      }

      html = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const metadata = extractHtmlMetadata(html);
    if (!metadata.title) continue;

    const relativePath = path.relative(ROOT_DIR, filePath);
    const normalizedPath = relativePath
      .split(path.sep)
      .join('/');

    if (
      normalizedPath.split('/').some((segment) =>
        SKIP_DIRS.has(segment.toLowerCase()),
      )
    ) {
      continue;
    }

    const url = `/${normalizedPath}`;

    addItem(
      makeSearchItem({
        id: url,
        type: 'page',
        title: metadata.title,
        summary: metadata.description,
        url,
        text: `${metadata.title} ${metadata.description}`,
      }),
    );
  }

  return items;
}

function getIndex() {
  const now = Date.now();

  if (cachedIndex && now < cacheExpiresAt) {
    return Promise.resolve(cachedIndex);
  }

  if (rebuilding) return rebuilding;

  rebuilding = Promise.resolve().then(() => {
    const nextIndex = buildIndex();
    cachedIndex = nextIndex;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return nextIndex;
  }).finally(() => {
    rebuilding = null;
  });

  return rebuilding;
}

function tokenize(query) {
  return query
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

function score(item, terms, phrase) {
  if (!terms.length) return 0;

  let total = 0;

  for (const term of terms) {
    if (!item.haystack.includes(term)) return 0;

    if (item.titleLower === term) {
      total += 10;
    } else if (item.titleLower.startsWith(term)) {
      total += 6;
    } else if (item.titleLower.includes(term)) {
      total += 4;
    } else {
      total += 1;
    }
  }

  if (phrase && item.titleLower.includes(phrase)) {
    total += 8;
  }

  if (item.titleLower === phrase) {
    total += 12;
  }

  return total;
}

function parseBoundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;

  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value)
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

router.get('/', async (req, res, next) => {
  try {
    if (
      req.query.q !== undefined &&
      typeof req.query.q !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_QUERY_INVALID',
          message: 'The q parameter must be a single string.',
        },
      });
    }

    const rawQuery = typeof req.query.q === 'string'
      ? req.query.q.trim()
      : '';

    if (
      rawQuery.length < 2 ||
      rawQuery.length > MAX_QUERY_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(rawQuery)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_QUERY_INVALID',
          message: 'Provide a search query between 2 and 100 characters.',
        },
      });
    }

    if (
      req.query.type !== undefined &&
      typeof req.query.type !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_TYPE_INVALID',
          message: 'The type parameter must be a single string.',
        },
      });
    }

    const type = typeof req.query.type === 'string'
      ? req.query.type.trim().toLowerCase()
      : '';

    if (type && !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_TYPE_INVALID',
          message: 'The requested search type is not supported.',
          allowedTypes: [...ALLOWED_TYPES],
        },
      });
    }

    const limit = parseBoundedInteger(
      req.query.limit,
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT,
    );

    const offset = parseBoundedInteger(
      req.query.offset,
      0,
      0,
      MAX_OFFSET,
    );

    if (limit === null || offset === null) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_PAGINATION_INVALID',
          message: `limit must be 1-${MAX_LIMIT}; offset must be 0-${MAX_OFFSET}.`,
        },
      });
    }

    const terms = tokenize(rawQuery);

    if (!terms.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SEARCH_QUERY_INVALID',
          message: 'The query must contain searchable letters or numbers.',
        },
      });
    }

    const searchIndex = await getIndex();
    const phrase = rawQuery.normalize('NFKC').toLowerCase();

    const matches = searchIndex
      .filter((item) => !type || item.type === type)
      .map((item) => ({
        item,
        relevance: score(item, terms, phrase),
      }))
      .filter((match) => match.relevance > 0)
      .sort((a, b) =>
        b.relevance - a.relevance ||
        a.item.title.localeCompare(b.item.title),
      );

    const data = matches
      .slice(offset, offset + limit)
      .map(({ item }) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        summary: item.summary,
        url: item.url,
      }));

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

    return res.status(200).json({
      success: true,
      data,
      query: rawQuery,
      pagination: {
        limit,
        offset,
        total: matches.length,
        hasMore: offset + data.length < matches.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Optional internal helper for tests or controlled index refreshes.
 * Do not expose a public cache-rebuild endpoint without authorization.
 */
router.refreshIndex = function refreshIndex() {
  cachedIndex = null;
  cacheExpiresAt = 0;
  return getIndex();
};

module.exports = router;
