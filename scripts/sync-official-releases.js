
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- Official Release Feed Synchronizer
 *
 * Fetches configured official RSS/Atom feeds and adds new release
 * candidates to news.json as inactive drafts requiring human review.
 *
 * Safety:
 * - HTTPS only, with configured hostname allowlists.
 * - Feed response size and request timeout limits.
 * - Candidate records remain drafts and inactive.
 * - Existing release IDs are not duplicated.
 * - Writes are atomic and occur only when new candidates are found.
 * - Supports dry-run mode.
 *
 * This script does not independently verify the authenticity or accuracy
 * of an announcement. Review every candidate before publication.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Parser = require('rss-parser');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'assets', 'data');

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  maxRedirects: 0,
});

function isAllowedHttpsUrl(value, allowedHost) {
  if (
    typeof value !== 'string' ||
    typeof allowedHost !== 'string' ||
    !allowedHost.trim()
  ) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = allowedHost.trim().toLowerCase();
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function matchesSourceKeywords(title, keywords) {
  if (typeof title !== 'string' || !Array.isArray(keywords)) {
    return false;
  }

  const normalizedTitle = title.toLocaleLowerCase();

  return keywords.some(
    (keyword) =>
      typeof keyword === 'string' &&
      keyword.trim() !== '' &&
      normalizedTitle.includes(keyword.toLocaleLowerCase())
  );
}

function getCategory(title) {
  if (/exam|परीक्षा|neet|नीट|cuet|सीयूईटी|nta|एनटीए/i.test(title)) {
    return 'exams';
  }

  if (/scholarship|छात्रवृत्ति/i.test(title)) {
    return 'scholarships';
  }

  if (/admission|प्रवेश/i.test(title)) {
    return 'admissions';
  }

  if (/recruitment|employment|भर्ती|नियुक्ति|रोजगार/i.test(title)) {
    return 'jobs';
  }

  if (/university|college|ugc|विश्वविद्यालय|महाविद्यालय|यूजीसी/i.test(title)) {
    return 'institutions';
  }

  return 'general';
}

function parsePublishedDate(item) {
  const value = item.isoDate || item.pubDate;

  if (!value || !Number.isFinite(Date.parse(value))) {
    return null;
  }

  return new Date(value).toISOString();
}

function createReleaseCandidate(item, source, createdAt) {
  if (!item || typeof item !== 'object' || !source || typeof source !== 'object') {
    return null;
  }

  const title =
    typeof item.title === 'string'
      ? item.title.trim().slice(0, 160)
      : '';

  const link =
    typeof item.link === 'string'
      ? item.link.trim()
      : '';

  if (!title || !isAllowedHttpsUrl(link, source.allowedHost)) {
    return null;
  }

  if (!matchesSourceKeywords(title, source.keywords)) {
    return null;
  }

  const idHash = crypto
    .createHash('sha256')
    .update(`${source.id}\0${link}`)
    .digest('hex')
    .slice(0, 20);

  const publishedAt = parsePublishedDate(item);

  return {
    id: `news-release-${idHash}`,
    title,
    slug: `release-${idHash}`,
    summary: `A new official release was detected from ${source.name}. Review the original source before acting.`,
    body: null,
    category: getCategory(title),
    tags: ['official-feed', source.id],
    newsType: 'announcement',
    priority: 'normal',
    countryCode: 'IN',
    stateIds: [],
    examIds: [],
    courseIds: [],
    institutionIds: [],
    admissionIds: [],
    impact: 'general',
    actionRequired: null,
    effectiveFrom: null,
    deadlineDate: null,
    source: {
      name: source.name,
      sourceType: source.sourceType,
      url: link,
    },
    officialNoticeUrl: link,
    sourceUrl: link,
    noticeNumber: null,
    noticeDate: publishedAt ? publishedAt.slice(0, 10) : null,
    language: source.language || 'en',
    image: null,
    relatedNewsIds: [],
    supersedesId: null,
    isBreaking: false,
    isPinned: false,
    publicationStatus: 'draft',
    publishedAt: null,
    expiresAt: null,
    author: 'release-feed-worker',
    reviewedBy: null,
    verificationStatus: 'pending_review',
    verifiedAt: null,
    verifiedBy: null,
    reviewDueAt: null,
    active: false,
    createdAt,
    updatedAt: createdAt,
  };
}

async function fetchWithSafeRedirects(source, fetchImpl) {
  let currentUrl = source.feedUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isAllowedHttpsUrl(currentUrl, source.allowedHost)) {
      throw new Error(
        `Feed URL or redirect is outside the allowed HTTPS host for ${source.id}.`
      );
    }

    const response = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (
      [301, 302, 303, 307, 308].includes(response.status)
    ) {
      const location = response.headers.get('location');

      if (!location) {
        throw new Error(`${source.id} returned a redirect without a location.`);
      }

      if (redirects === MAX_REDIRECTS) {
        throw new Error(`${source.id} exceeded the redirect limit.`);
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error(`${source.id} exceeded the redirect limit.`);
}

async function fetchFeed(source, fetchImpl) {
  if (
    !source ||
    typeof source.id !== 'string' ||
    typeof source.name !== 'string' ||
    !isAllowedHttpsUrl(source.feedUrl, source.allowedHost)
  ) {
    throw new Error('Feed configuration is invalid or its URL is not allowed.');
  }

  const response = await fetchWithSafeRedirects(source, fetchImpl);

  if (!response.ok) {
    throw new Error(`${source.id} returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type') || '';

  const declaredLength = Number(response.headers.get('content-length'));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_FEED_BYTES
  ) {
    throw new Error(`${source.id} exceeded the feed size limit.`);
  }

  if (!response.body) {
    throw new Error(`${source.id} returned an empty response body.`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error(`${source.id} exceeded the feed size limit.`);
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const xml = Buffer.concat(chunks).toString('utf8');

  if (
    !/xml|rss|atom/i.test(contentType) &&
    !/^\s*(?:<\?xml|<rss\b|<feed\b)/i.test(xml)
  ) {
    throw new Error(`${source.id} did not return an RSS or Atom document.`);
  }

  return parser.parseString(xml);
}

function atomicWriteJson(file, value) {
  const directory = path.dirname(file);
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );

  try {
    fs.writeFileSync(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 }
    );

    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // The temporary file may not have been created.
    }

    throw error;
  }
}

async function syncOfficialReleases({
  dataDir = DEFAULT_DATA_DIR,
  fetchImpl = globalThis.fetch,
  asOf = new Date(),
  dryRun = false,
} = {}) {
  if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) {
    throw new TypeError('asOf must be a valid Date.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A compatible fetch implementation is required.');
  }

  const resolvedDataDir = path.resolve(dataDir);
  const sourcesPath = path.join(resolvedDataDir, 'release-sources.json');
  const newsPath = path.join(resolvedDataDir, 'news.json');

  const sourceData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const dataset = JSON.parse(fs.readFileSync(newsPath, 'utf8'));

  if (
    !sourceData ||
    !Array.isArray(sourceData.sources) ||
    !dataset ||
    !Array.isArray(dataset.news)
  ) {
    throw new TypeError(
      'Release source configuration and news dataset must contain arrays.'
    );
  }

  const sources = sourceData.sources.filter(
    (source) => source && source.enabled === true
  );

  if (!sources.length) {
    throw new Error('No official release feeds are enabled.');
  }

  const existingIds = new Set(
    dataset.news
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => item.id)
  );

  const createdAt = asOf.toISOString();
  const added = [];
  const errors = [];
  let successfulFeeds = 0;

  for (const source of sources) {
    try {
      const feed = await fetchFeed(source, fetchImpl);
      successfulFeeds += 1;

      for (const item of feed.items || []) {
        const candidate = createReleaseCandidate(
          item,
          source,
          createdAt
        );

        if (candidate && !existingIds.has(candidate.id)) {
          existingIds.add(candidate.id);
          added.push(candidate);
        }
      }
    } catch (error) {
      errors.push({
        source:
          typeof source.id === 'string'
            ? source.id
            : 'unknown-source',
        message: error.message,
      });
    }
  }

  if (successfulFeeds === 0) {
    throw new Error(
      `Every configured release feed failed: ${errors
        .map((item) => item.source)
        .join(', ')}.`
    );
  }

  if (!dryRun && added.length > 0) {
    dataset.news.push(...added);
    dataset.updatedAt = createdAt;
    atomicWriteJson(newsPath, dataset);
  }

  return {
    feedsConfigured: sources.length,
    feedsChecked: successfulFeeds,
    candidatesAdded: added.length,
    errors,
    dryRun,
  };
}

if (require.main === module) {
  syncOfficialReleases({
    dryRun: process.argv.includes('--dry-run'),
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));

      if (result.errors.length > 0) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(`[MedOrbits Releases] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  createReleaseCandidate,
  fetchFeed,
  getCategory,
  isAllowedHttpsUrl,
  matchesSourceKeywords,
  syncOfficialReleases,
};
