#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Official Release Feed Synchronizer
 * Suggested file: /scripts/sync-official-releases.cjs
 *
 * Purpose:
 *   Fetch configured official RSS/Atom feeds and append new release
 *   candidates to assets/data/news.json as inactive drafts.
 *
 * Security:
 *   - HTTPS-only feed URLs and redirect validation.
 *   - Exact configured hostname or its subdomains only.
 *   - Bounded response size and request timeout.
 *   - Validates feed configuration and resource URLs.
 *   - Skips invalid entries and detects duplicate IDs.
 *   - Never automatically publishes announcements.
 *   - Writes updates atomically after successful validation.
 *   - Supports --dry-run and --json.
 *
 * Requirements:
 *   Node.js 20+
 *   npm install rss-parser
 *
 * IMPORTANT:
 *   Feed content is untrusted input. Human review is mandatory.
 *   This script does not establish the authenticity or accuracy
 *   of an announcement.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Parser = require('rss-parser');
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'assets', 'data');
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_ITEMS_PER_FEED = 2_000;
const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 500;
const MAX_SOURCE_ID_LENGTH = 100;
const ACCEPT_HEADER =
  'application/rss+xml, application/atom+xml, application/xml, text/xml';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  maxRedirects: 0,
  maxItems: MAX_ITEMS_PER_FEED,
  customFields: {
    item: [],
  },
});
function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}
function asMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function assertSafeRepositoryPath(file, label) {
  const resolved = path.resolve(file);
  const relative = path.relative(ROOT, resolved);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must remain inside the repository.`);
  }
  return resolved;
}
function validateSourceId(id) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_SOURCE_ID_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}
/**
 * Check whether a hostname matches a configured allowlist entry.
 *
 * The configured hostname may match exactly or allow its own
 * subdomains. It does not allow suffix lookalikes such as
 * official.gov.example.attacker.test.
 */
function hostnameMatchesAllowlist(hostname, allowedHost) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const allowed = allowedHost.toLowerCase().trim().replace(/\.$/, '');
  return host === allowed || host.endsWith(`.${allowed}`);
}
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
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port && url.port !== '443'
    ) {
      return false;
    }
    // Configured allowlist entries must be hostnames, not URLs,
    // paths, wildcard patterns, or host:port strings.
    const host = allowedHost.trim();
    if (
      host.includes('/') ||
      host.includes(':') ||
      host.includes('*') ||
      /\s/.test(host)
    ) {
      return false;
    }
    return hostnameMatchesAllowlist(url.hostname, host);
  } catch {
    return false;
  }
}
function validateSource(source) {
  if (!isPlainObject(source)) {
    throw new Error('Feed source must be an object.');
  }
  if (!validateSourceId(source.id)) {
    throw new Error('Feed source has an invalid id.');
  }
  if (
    typeof source.name !== 'string' ||
    !source.name.trim() ||
    source.name.length > 250
  ) {
    throw new Error(`${source.id}: source name is invalid.`);
  }
  if (
    typeof source.allowedHost !== 'string' ||
    !source.allowedHost.trim()
  ) {
    throw new Error(`${source.id}: allowedHost is required.`);
  }
  if (!isAllowedHttpsUrl(source.feedUrl, source.allowedHost)) {
    throw new Error(
      `${source.id}: feedUrl must use HTTPS and match allowedHost.`
    );
  }
  if (
    source.keywords !== undefined &&
    (!Array.isArray(source.keywords) ||
      source.keywords.some(
        (keyword) =>
          typeof keyword !== 'string' ||
          keyword.length > 150
      ))
  ) {
    throw new Error(`${source.id}: keywords must be an array of strings.`);
  }
  if (
    source.language !== undefined &&
    (typeof source.language !== 'string' ||
      source.language.length > 35)
  ) {
    throw new Error(`${source.id}: language is invalid.`);
  }
  if (
    source.sourceType !== undefined &&
    (typeof source.sourceType !== 'string' ||
      source.sourceType.length > 100)
  ) {
    throw new Error(`${source.id}: sourceType is invalid.`);
  }
}
function matchesSourceKeywords(title, keywords) {
  if (
    typeof title !== 'string' ||
    !Array.isArray(keywords) ||
    keywords.length === 0
  ) {
    return false;
  }
  const normalizedTitle = title.toLocaleLowerCase('en');
  return keywords.some(
    (keyword) =>
      typeof keyword === 'string' &&
      keyword.trim() !== '' &&
      normalizedTitle.includes(keyword.trim().toLocaleLowerCase('en'))
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
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    !Number.isFinite(Date.parse(value))
  ) {
    return null;
  }
  return new Date(value).toISOString();
}
function safeResourceUrl(value, allowedHost) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    if (!isAllowedHttpsUrl(url.href, allowedHost)) {
      return null;
    }
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
function createReleaseCandidate(item, source, createdAt) {
  if (!isPlainObject(item) || !isPlainObject(source)) {
    return null;
  }
  const title =
    typeof item.title === 'string'
      ? item.title.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_LENGTH)
      : '';
  const link = safeResourceUrl(item.link, source.allowedHost);
  if (!title || !link) {
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
  const publishedDate = parsePublishedDate(item);
  const safeSourceName = source.name
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SUMMARY_LENGTH);
  return {
    id: `news-release-${idHash}`,
    title,
    slug: `release-${idHash}`,
    summary:
      `A potential announcement was detected from ${safeSourceName}. ` +
      'Review the original source and verify its accuracy before publication.',
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
      name: safeSourceName,
      sourceType:
        typeof source.sourceType === 'string'
          ? source.sourceType
          : 'official-feed',
      url: link,
    },
    officialNoticeUrl: link,
    sourceUrl: link,
    noticeNumber: null,
    noticeDate: publishedDate ? publishedDate.slice(0, 10) : null,
    language:
      typeof source.language === 'string' && source.language.trim()
        ? source.language.trim()
        : 'en',
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
async function readResponseWithLimit(response, sourceId) {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      Number.isFinite(parsedLength) &&
      parsedLength >= 0 &&
      parsedLength > MAX_FEED_BYTES
    ) {
      throw new Error(`${sourceId} exceeded the feed size limit.`);
    }
  }
  if (!response.body) {
    throw new Error(`${sourceId} returned an empty response body.`);
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
        try {
          await reader.cancel('Feed response exceeded size limit.');
        } catch {
          // Preserve the size-limit error.
        }
        throw new Error(`${sourceId} exceeded the feed size limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8');
}
async function fetchWithSafeRedirects(source, fetchImpl) {
  let currentUrl = source.feedUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isAllowedHttpsUrl(currentUrl, source.allowedHost)) {
      throw new Error(
        `${source.id}: feed URL or redirect violates the HTTPS hostname allowlist.`
      );
    }
    const response = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: ACCEPT_HEADER,
        'User-Agent': 'MedOrbits-ReleaseFeed/1.0',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      // Do not leave an unconsumed redirect response open.
      try {
        await response.body?.cancel();
      } catch {
        // Ignore cancellation errors.
      }
      if (!location) {
        throw new Error(
          `${source.id} returned a redirect without a location.`
        );
      }
      if (redirects === MAX_REDIRECTS) {
        throw new Error(`${source.id} exceeded the redirect limit.`);
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        throw new Error(`${source.id} returned an invalid redirect URL.`);
      }
      if (!isAllowedHttpsUrl(nextUrl, source.allowedHost)) {
        throw new Error(
          `${source.id} attempted to redirect outside its allowed hostname.`
        );
      }
      currentUrl = nextUrl;
      continue;
    }
    return response;
  }
  throw new Error(`${source.id} exceeded the redirect limit.`);
}
async function fetchFeed(source, fetchImpl = globalThis.fetch) {
  validateSource(source);
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A compatible fetch implementation is required.');
  }
  const response = await fetchWithSafeRedirects(source, fetchImpl);
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // Ignore cancellation errors.
    }
    throw new Error(`${source.id} returned HTTP ${response.status}.`);
  }
  const contentType = (
    response.headers.get('content-type') || ''
  ).toLowerCase();
  const xml = await readResponseWithLimit(response, source.id);
  // Require an XML-compatible response type or recognizable XML root.
  const xmlRoot = /^\uFEFF?\s*(?:<\?xml\b[^>]*>\s*)?(<rss\b|<feed\b|<rdf:RDF\b)/i;
  if (
    !/(xml|rss|atom)/i.test(contentType) &&
    !xmlRoot.test(xml)
  ) {
    throw new Error(
      `${source.id} did not return a recognizable RSS or Atom document.`
    );
  }
  let feed;
  try {
    feed = await parser.parseString(xml);
  } catch {
    throw new Error(`${source.id} returned an invalid RSS/Atom document.`);
  }
  if (!isPlainObject(feed) || !Array.isArray(feed.items)) {
    throw new Error(`${source.id} feed has an invalid item collection.`);
  }
  if (feed.items.length > MAX_ITEMS_PER_FEED) {
    throw new Error(`${source.id} returned too many feed items.`);
  }
  return feed;
}
function atomicWriteJson(file, value) {
  const resolvedFile = assertSafeRepositoryPath(file, 'Output file');
  const directory = path.dirname(resolvedFile);
  fs.mkdirSync(directory, { recursive: true });
  const directoryStat = fs.lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error('Output directory must be a real directory.');
  }
  const temporary = path.join(
    directory,
    `.${path.basename(resolvedFile)}.${process.pid}.${crypto
      .randomBytes(8)
      .toString('hex')}.tmp`
  );
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(
      fd,
      `${JSON.stringify(value, null, 2)}\n`,
      'utf8'
    );
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // Recheck immediately before replacing the destination.
    // This reduces, but cannot eliminate, filesystem race conditions.
    if (fs.existsSync(resolvedFile)) {
      const destinationStat = fs.lstatSync(resolvedFile);
      if (destinationStat.isSymbolicLink() || !destinationStat.isFile()) {
        throw new Error(
          'Output destination must be a regular file, not a symlink or directory.'
        );
      }
    }
    fs.renameSync(temporary, resolvedFile);
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Preserve the primary error.
      }
    }
    try {
      fs.unlinkSync(temporary);
    } catch {
      // The temporary file may not exist.
    }
    throw error;
  }
}
function readJsonFile(file, label) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`${label} could not be read: ${asMessage(error)}`);
  }
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}
function validateDataset(dataset) {
  if (!isPlainObject(dataset) || !Array.isArray(dataset.news)) {
    throw new TypeError('news.json must contain a news array.');
  }
  const ids = new Set();
  for (const [index, item] of dataset.news.entries()) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id.trim()) {
      throw new TypeError(`news.json entry ${index} has an invalid ID.`);
    }
    if (ids.has(item.id)) {
      throw new TypeError(`news.json contains duplicate ID "${item.id}".`);
    }
    ids.add(item.id);
  }
  return ids;
}
function validateSourceConfiguration(sourceData) {
  if (
    !isPlainObject(sourceData) ||
    !Array.isArray(sourceData.sources)
  ) {
    throw new TypeError(
      'release-sources.json must contain a sources array.'
    );
  }
  const sourceIds = new Set();
  for (const [index, source] of sourceData.sources.entries()) {
    if (!isPlainObject(source)) {
      throw new TypeError(`Feed source entry ${index} must be an object.`);
    }
    if (!validateSourceId(source.id)) {
      throw new TypeError(`Feed source entry ${index} has an invalid ID.`);
    }
    if (sourceIds.has(source.id)) {
      throw new TypeError(`Duplicate feed source ID "${source.id}".`);
    }
    sourceIds.add(source.id);
    if (source.enabled === true) {
      validateSource(source);
    }
  }
  return sourceData.sources.filter(
    (source) => source.enabled === true
  );
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
  if (typeof dryRun !== 'boolean') {
    throw new TypeError('dryRun must be a boolean.');
  }
  const resolvedDataDir = assertSafeRepositoryPath(
    dataDir,
    'Data directory'
  );
  const dataDirStat = fs.lstatSync(resolvedDataDir);
  if (!dataDirStat.isDirectory() || dataDirStat.isSymbolicLink()) {
    throw new Error('Data directory must be a real directory.');
  }
  const sourcesPath = path.join(
    resolvedDataDir,
    'release-sources.json'
  );
  const newsPath = path.join(resolvedDataDir, 'news.json');
  const sourcesStat = fs.lstatSync(sourcesPath);
  const newsStat = fs.lstatSync(newsPath);
  if (
    sourcesStat.isSymbolicLink() ||
    !sourcesStat.isFile() ||
    newsStat.isSymbolicLink() ||
    !newsStat.isFile()
  ) {
    throw new Error('Input JSON files must be regular, non-symlink files.');
  }
  const sourceData = readJsonFile(
    sourcesPath,
    'release-sources.json'
  );
  const dataset = readJsonFile(newsPath, 'news.json');
  const sources = validateSourceConfiguration(sourceData);
  const existingIds = validateDataset(dataset);
  if (sources.length === 0) {
    throw new Error('No official release feeds are enabled.');
  }
  const createdAt = asOf.toISOString();
  const added = [];
  const errors = [];
  let successfulFeeds = 0;
  let itemsSeen = 0;
  for (const source of sources) {
    try {
      const feed = await fetchFeed(source, fetchImpl);
      successfulFeeds += 1;
      itemsSeen += feed.items.length;
      for (const item of feed.items) {
        const candidate = createReleaseCandidate(
          item,
          source,
          createdAt
        );
        if (!candidate || existingIds.has(candidate.id)) {
          continue;
        }
        // Prevent duplicates within the same run.
        existingIds.add(candidate.id);
        added.push(candidate);
      }
    } catch (error) {
      errors.push({
        source: source.id,
        message: asMessage(error),
      });
    }
  }
  if (successfulFeeds === 0) {
    const summary = errors
      .map((entry) => `${entry.source}: ${entry.message}`)
      .join('; ');
    throw new Error(
      `All configured release feeds failed. No changes were written. ${summary}`
    );
  }
  if (!dryRun && added.length > 0) {
    dataset.news.push(...added);
    dataset.updatedAt = createdAt;
    atomicWriteJson(newsPath, dataset);
  }
  return {
    ok: errors.length === 0,
    feedsConfigured: sources.length,
    feedsChecked: successfulFeeds,
    itemsSeen,
    candidatesAdded: added.length,
    written: !dryRun && added.length > 0,
    dryRun,
    errors,
  };
}
function parseCliArgs(argv) {
  const supported = new Set(['--dry-run', '--json', '--help', '-h']);
  const unknown = argv.filter((arg) => !supported.has(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  }
  return {
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}
async function main() {
  let cli;
  try {
    cli = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[MedOrbits Releases] ${asMessage(error)}`);
    process.exitCode = 2;
    return;
  }
  if (cli.help) {
    console.log(`MedOrbits Official Release Feed Synchronizer
Usage:
  node scripts/sync-official-releases.cjs [options]
Options:
  --dry-run   Fetch and validate feeds without modifying news.json
  --json      Print a JSON result
  --help      Show this help
Only verified and manually approved announcements should be published.`);
    return;
  }
  try {
    const result = await syncOfficialReleases({
      dryRun: cli.dryRun,
    });
    if (cli.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('MedOrbits Official Release Feed Synchronizer');
      console.log(`Feeds configured: ${result.feedsConfigured}`);
      console.log(`Feeds checked: ${result.feedsChecked}`);
      console.log(`Items inspected: ${result.itemsSeen}`);
      console.log(`Draft candidates: ${result.candidatesAdded}`);
      console.log(`Dry run: ${result.dryRun ? 'yes' : 'no'}`);
      console.log(`Dataset written: ${result.written ? 'yes' : 'no'}`);
      for (const entry of result.errors) {
        console.error(
          `WARNING: ${entry.source}: ${entry.message}`
        );
      }
    }
    // A partial feed failure should be visible to CI and monitoring.
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const result = {
      ok: false,
      error: asMessage(error),
    };
    if (cli.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`[MedOrbits Releases] ${result.error}`);
    }
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
module.exports = {
  createReleaseCandidate,
  fetchFeed,
  getCategory,
  hostnameMatchesAllowlist,
  isAllowedHttpsUrl,
  matchesSourceKeywords,
  parsePublishedDate,
  syncOfficialReleases,
  validateSource,
};