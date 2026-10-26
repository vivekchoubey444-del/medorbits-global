
'use strict';

const APPROVED_STATUSES = new Set([
  'verified',
  'content_reviewed',
]);

const NOTICE_TYPES = new Set([
  'official_notice',
  'announcement',
  'deadline_update',
  'schedule_change',
  'result_declared',
  'policy_change',
  'correction',
]);

const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 500;

function isValidDate(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function parseDate(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    return Date.parse(value);
  }

  return Number.NaN;
}

function isNotExpired(item, asOf) {
  if (item.expiresAt == null || item.expiresAt === '') {
    return true;
  }

  const expiry = parseDate(item.expiresAt);

  return (
    Number.isFinite(expiry) &&
    expiry >= asOf.getTime()
  );
}

function hasPublicSource(item) {
  const sourceUrl =
    item.officialNoticeUrl ||
    item.sourceUrl ||
    (item.source && item.source.url);

  if (
    typeof sourceUrl !== 'string' ||
    sourceUrl.length > MAX_SOURCE_URL_LENGTH ||
    /[\u0000-\u0020\u007f]/.test(sourceUrl)
  ) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);

    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isPublishable(item, asOf) {
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item)
  ) {
    return false;
  }

  if (
    item.active !== true ||
    item.publicationStatus !== 'published' ||
    !APPROVED_STATUSES.has(item.verificationStatus) ||
    !hasPublicSource(item) ||
    !isNotExpired(item, asOf)
  ) {
    return false;
  }

  // Published records must have a valid publication or creation date.
  const publishedAt = item.publishedAt ?? item.createdAt;

  return isValidDate(publishedAt);
}

function sortNewestFirst(left, right) {
  const leftTime = parseDate(left.publishedAt ?? left.createdAt);
  const rightTime = parseDate(right.publishedAt ?? right.createdAt);

  return rightTime - leftTime;
}

function normalizeAsOf(asOf) {
  if (asOf === undefined) {
    return new Date();
  }

  if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) {
    throw new TypeError('asOf must be a valid Date.');
  }

  return new Date(asOf.getTime());
}

function listPublicReleases({
  news = [],
  bulletins = [],
  asOf,
} = {}) {
  if (!Array.isArray(news) || !Array.isArray(bulletins)) {
    throw new TypeError('news and bulletins must be arrays.');
  }

  const referenceDate = normalizeAsOf(asOf);

  return {
    notices: news
      .filter(
        (item) =>
          item &&
          NOTICE_TYPES.has(item.newsType) &&
          isPublishable(item, referenceDate),
      )
      .slice()
      .sort(sortNewestFirst),

    bulletins: bulletins
      .filter((item) => isPublishable(item, referenceDate))
      .slice()
      .sort(sortNewestFirst),
  };
}

module.exports = {
  listPublicReleases,
  isPublishable,
  hasPublicSource,
  isNotExpired,
  sortNewestFirst,
  APPROVED_STATUSES,
  NOTICE_TYPES,
};
