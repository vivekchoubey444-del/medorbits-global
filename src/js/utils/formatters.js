
/**
 * MedOrbits -- Shared Formatting Utilities
 * File: /src/js/utils/formatters.js
 *
 * Purpose:
 * - Format dates, times, and timestamps.
 * - Format currency, numbers, percentages, and file sizes.
 * - Normalize and display text safely.
 * - Format application and job statuses.
 * - Format durations, phone numbers, and identifiers.
 * - Provide reusable helpers for frontend UI components.
 *
 * Module format: ES Module
 *
 * Security:
 * - Formatting is not HTML sanitization.
 * - Use textContent when rendering untrusted text.
 * - Do not expose secrets, tokens, or private identifiers.
 */

import {
  APP,
  APPLICATION_STATUS,
  JOB_STATUS,
  USER_ROLE,
} from "./contants.js";

/* --------------------------------------------------------------------------
 * Internal helpers
 * -------------------------------------------------------------------------- */

const DEFAULT_LOCALE = APP.DEFAULT_LOCALE || "en";
const DEFAULT_TIME_ZONE = APP.DEFAULT_TIME_ZONE || "Asia/Kolkata";
const DEFAULT_CURRENCY = APP.DEFAULT_CURRENCY || "INR";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

function isPresent(value) {
  return value !== null && value !== undefined;
}

function toFiniteNumber(value) {
  if (
    typeof value === "string" &&
    value.trim() === ""
  ) {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : null;
}

function safeLocale(locale) {
  if (typeof locale !== "string" || !locale.trim()) {
    return DEFAULT_LOCALE;
  }

  try {
    Intl.getCanonicalLocales(locale);
    return locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function safeTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en", {
      timeZone,
    });

    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function toValidDate(value) {
  if (!isPresent(value) || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    // Numeric timestamps are interpreted as milliseconds since the epoch.
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function titleCaseWords(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (character) => character.toUpperCase());
}

/* --------------------------------------------------------------------------
 * General text formatting
 * -------------------------------------------------------------------------- */

/**
 * Convert a value to a safe, bounded plain-text string.
 *
 * This function does not sanitize HTML. Render its result using textContent.
 */
export function formatText(
  value,
  {
    fallback = "--",
    maxLength = 5000,
    trim = true,
  } = {}
) {
  if (!isPresent(value)) {
    return fallback;
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return fallback;
  }

  let text = String(value);

  if (trim) {
    text = text.trim();
  }

  if (!text) {
    return fallback;
  }

  const limit = Number.isFinite(maxLength)
    ? Math.max(0, Math.floor(maxLength))
    : 5000;

  if (text.length > limit) {
    text = `${text.slice(0, limit).trimEnd()}…`;
  }

  return text;
}

/**
 * Collapse consecutive whitespace into single spaces.
 */
export function normalizeWhitespace(value, fallback = "") {
  if (!isPresent(value)) {
    return fallback;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const normalized = String(value)
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

/**
 * Return a short preview of longer text.
 */
export function truncateText(value, maxLength = 120, suffix = "…") {
  const text = normalizeWhitespace(value);

  if (!text) {
    return "";
  }

  const limit = Number.isFinite(maxLength)
    ? Math.max(0, Math.floor(maxLength))
    : 120;

  if (text.length <= limit) {
    return text;
  }

  if (limit <= suffix.length) {
    return suffix.slice(0, limit);
  }

  return `${text.slice(0, limit - suffix.length).trimEnd()}${suffix}`;
}

/**
 * Format a person's display name.
 *
 * Does not attempt to infer a person's legal name or identity.
 */
export function formatPersonName(value, fallback = "--") {
  const name = normalizeWhitespace(value);

  if (!name) {
    return fallback;
  }

  return name
    .split(" ")
    .map((part) => part)
    .join(" ");
}

/**
 * Return an uppercase identifier for visual display.
 * Avoid using this helper on case-sensitive identifiers.
 */
export function formatIdentifier(value, fallback = "--") {
  const text = normalizeWhitespace(value);

  return text ? text.toUpperCase() : fallback;
}

/**
 * Format a machine-readable code as a human-readable label.
 */
export function formatLabel(value, fallback = "--") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return titleCaseWords(value.trim());
}

/* --------------------------------------------------------------------------
 * Number formatting
 * -------------------------------------------------------------------------- */

/**
 * Format a number using the requested locale.
 */
export function formatNumber(
  value,
  {
    locale = "en-IN",
    minimumFractionDigits,
    maximumFractionDigits = 2,
    fallback = "--",
    useGrouping = true,
  } = {}
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return fallback;
  }

  try {
    const options = {
      useGrouping,
      maximumFractionDigits: Math.max(
        0,
        Math.min(20, maximumFractionDigits)
      ),
    };

    if (Number.isInteger(minimumFractionDigits)) {
      options.minimumFractionDigits = Math.max(
        0,
        Math.min(20, minimumFractionDigits)
      );
    }

    return new Intl.NumberFormat(
      safeLocale(locale),
      options
    ).format(number);
  } catch {
    return String(number);
  }
}

/**
 * Format currency amounts.
 *
 * Input is expected to be a major currency-unit amount, such as 1250 INR.
 * This function does not convert between currencies.
 */
export function formatCurrency(
  value,
  {
    locale = "en-IN",
    currency = DEFAULT_CURRENCY,
    fallback = "--",
    minimumFractionDigits,
    maximumFractionDigits = 2,
    currencyDisplay = "symbol",
  } = {}
) {
  const amount = toFiniteNumber(value);

  if (amount === null) {
    return fallback;
  }

  const normalizedCurrency =
    typeof currency === "string"
      ? currency.trim().toUpperCase()
      : DEFAULT_CURRENCY;

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return fallback;
  }

  try {
    const options = {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay,
      maximumFractionDigits: Math.max(
        0,
        Math.min(20, maximumFractionDigits)
      ),
    };

    if (Number.isInteger(minimumFractionDigits)) {
      options.minimumFractionDigits = Math.max(
        0,
        Math.min(20, minimumFractionDigits)
      );
    }

    return new Intl.NumberFormat(
      safeLocale(locale),
      options
    ).format(amount);
  } catch {
    return fallback;
  }
}

/**
 * Format percentages.
 *
 * By default, 0.25 is displayed as 25%.
 * Set inputIsPercent: true to display 25 as 25%.
 */
export function formatPercentage(
  value,
  {
    locale = "en-IN",
    maximumFractionDigits = 1,
    minimumFractionDigits,
    inputIsPercent = false,
    fallback = "--",
  } = {}
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return fallback;
  }

  const normalized = inputIsPercent ? number / 100 : number;

  try {
    const options = {
      style: "percent",
      maximumFractionDigits: Math.max(
        0,
        Math.min(20, maximumFractionDigits)
      ),
    };

    if (Number.isInteger(minimumFractionDigits)) {
      options.minimumFractionDigits = Math.max(
        0,
        Math.min(20, minimumFractionDigits)
      );
    }

    return new Intl.NumberFormat(
      safeLocale(locale),
      options
    ).format(normalized);
  } catch {
    return fallback;
  }
}

/**
 * Compact number formatting for dashboards and analytics.
 */
export function formatCompactNumber(
  value,
  {
    locale = "en-IN",
    maximumFractionDigits = 1,
    fallback = "--",
  } = {}
) {
  const number = toFiniteNumber(value);

  if (number === null) {
    return fallback;
  }

  try {
    return new Intl.NumberFormat(safeLocale(locale), {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: Math.max(
        0,
        Math.min(10, maximumFractionDigits)
      ),
    }).format(number);
  } catch {
    return String(number);
  }
}

/* --------------------------------------------------------------------------
 * Date and time formatting
 * -------------------------------------------------------------------------- */

/**
 * Format a date without displaying a time.
 *
 * Numeric timestamps must be milliseconds since the Unix epoch.
 */
export function formatDate(
  value,
  {
    locale = DEFAULT_LOCALE,
    timeZone = DEFAULT_TIME_ZONE,
    dateStyle = "medium",
    fallback = "--",
  } = {}
) {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(safeLocale(locale), {
      dateStyle,
      timeZone: safeTimeZone(timeZone),
    }).format(date);
  } catch {
    return fallback;
  }
}

/**
 * Format a date and time.
 */
export function formatDateTime(
  value,
  {
    locale = DEFAULT_LOCALE,
    timeZone = DEFAULT_TIME_ZONE,
    dateStyle = "medium",
    timeStyle = "short",
    fallback = "--",
  } = {}
) {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(safeLocale(locale), {
      dateStyle,
      timeStyle,
      timeZone: safeTimeZone(timeZone),
    }).format(date);
  } catch {
    return fallback;
  }
}

/**
 * Format a time only.
 */
export function formatTime(
  value,
  {
    locale = DEFAULT_LOCALE,
    timeZone = DEFAULT_TIME_ZONE,
    timeStyle = "short",
    fallback = "--",
  } = {}
) {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(safeLocale(locale), {
      timeStyle,
      timeZone: safeTimeZone(timeZone),
    }).format(date);
  } catch {
    return fallback;
  }
}

/**
 * Format a date as YYYY-MM-DD.
 *
 * Uses the requested time zone to determine the calendar date.
 */
export function formatISODate(
  value,
  {
    timeZone = DEFAULT_TIME_ZONE,
    fallback = "",
  } = {}
) {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: safeTimeZone(timeZone),
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    if (!values.year || !values.month || !values.day) {
      return fallback;
    }

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return fallback;
  }
}

/**
 * Return a relative-time label such as "3 days ago".
 */
export function formatRelativeTime(
  value,
  {
    locale = DEFAULT_LOCALE,
    now = Date.now(),
    numeric = "auto",
    style = "long",
    fallback = "--",
  } = {}
) {
  const date = toValidDate(value);
  const referenceTime = toFiniteNumber(now);

  if (!date || referenceTime === null) {
    return fallback;
  }

  const deltaSeconds = (date.getTime() - referenceTime) / 1000;
  const absoluteSeconds = Math.abs(deltaSeconds);

  let unit;
  let amount;

  if (absoluteSeconds < 60) {
    unit = "second";
    amount = Math.round(deltaSeconds);
  } else if (absoluteSeconds < 3600) {
    unit = "minute";
    amount = Math.round(deltaSeconds / 60);
  } else if (absoluteSeconds < 86400) {
    unit = "hour";
    amount = Math.round(deltaSeconds / 3600);
  } else if (absoluteSeconds < 2592000) {
    unit = "day";
    amount = Math.round(deltaSeconds / 86400);
  } else if (absoluteSeconds < 31536000) {
    unit = "month";
    amount = Math.round(deltaSeconds / 2592000);
  } else {
    unit = "year";
    amount = Math.round(deltaSeconds / 31536000);
  }

  try {
    return new Intl.RelativeTimeFormat(safeLocale(locale), {
      numeric,
      style,
    }).format(amount, unit);
  } catch {
    return fallback;
  }
}

/* --------------------------------------------------------------------------
 * Duration and file-size formatting
 * -------------------------------------------------------------------------- */

/**
 * Format a duration given in seconds.
 */
export function formatDuration(
  value,
  {
    includeSeconds = true,
    fallback = "--",
  } = {}
) {
  const seconds = toFiniteNumber(value);

  if (seconds === null || seconds < 0) {
    return fallback;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return includeSeconds
      ? `${hours}h ${minutes}m ${remainingSeconds}s`
      : `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return includeSeconds
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  return includeSeconds
    ? `${remainingSeconds}s`
    : "0m";
}

/**
 * Format a byte count using binary units.
 *
 * 1 KiB = 1024 bytes.
 */
export function formatFileSize(
  value,
  {
    locale = "en-IN",
    maximumFractionDigits = 2,
    fallback = "--",
  } = {}
) {
  const bytes = toFiniteNumber(value);

  if (bytes === null || bytes < 0) {
    return fallback;
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const scaled = bytes / Math.pow(1024, unitIndex);

  return `${formatNumber(scaled, {
    locale,
    maximumFractionDigits,
    fallback,
  })} ${units[unitIndex]}`;
}

/* --------------------------------------------------------------------------
 * Phone and email display helpers
 * -------------------------------------------------------------------------- */

/**
 * Normalize an email address for display.
 *
 * This is not email validation and does not verify ownership.
 */
export function formatEmail(value, fallback = "--") {
  if (typeof value !== "string") {
    return fallback;
  }

  const email = value.trim();

  return email || fallback;
}

/**
 * Normalize a phone value for display without guessing a country code.
 */
export function formatPhone(value, fallback = "--") {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return fallback;
  }

  const phone = String(value).trim();

  return phone || fallback;
}

/**
 * Mask a string while preserving a configurable number of trailing
 * characters. Intended for display only, not access control.
 */
export function maskValue(
  value,
  {
    visibleEnd = 4,
    maskCharacter = "•",
    fallback = "--",
  } = {}
) {
  if (!isPresent(value)) {
    return fallback;
  }

  const text = String(value);

  if (!text) {
    return fallback;
  }

  const visible = Number.isFinite(visibleEnd)
    ? Math.max(0, Math.floor(visibleEnd))
    : 4;

  const mask = typeof maskCharacter === "string"
    ? maskCharacter.slice(0, 4)
    : "•";

  const visibleCount = Math.min(visible, text.length);
  const hiddenCount = Math.max(0, text.length - visibleCount);

  return `${mask.repeat(Math.min(hiddenCount, 64))}${text.slice(-visibleCount)}`;
}

/* --------------------------------------------------------------------------
 * Application, job, and role status formatting
 * -------------------------------------------------------------------------- */

/**
 * Convert an application status code to a display label.
 */
export function formatApplicationStatus(value, fallback = "Unknown") {
  const status = normalizeStatus(value);

  if (!status) {
    return fallback;
  }

  const knownStatuses = new Set(Object.values(APPLICATION_STATUS));

  return knownStatuses.has(status)
    ? titleCaseWords(status)
    : titleCaseWords(status);
}

/**
 * Convert a job status code to a display label.
 */
export function formatJobStatus(value, fallback = "Unknown") {
  const status = normalizeStatus(value);

  if (!status) {
    return fallback;
  }

  const knownStatuses = new Set(Object.values(JOB_STATUS));

  return knownStatuses.has(status)
    ? titleCaseWords(status)
    : titleCaseWords(status);
}

/**
 * Convert a user role to a display label.
 *
 * This is presentation logic only; never use it to authorize actions.
 */
export function formatUserRole(value, fallback = "Unknown") {
  const role = normalizeStatus(value);

  if (!role) {
    return fallback;
  }

  const knownRoles = new Set(Object.values(USER_ROLE));

  return knownRoles.has(role)
    ? titleCaseWords(role)
    : titleCaseWords(role);
}

/**
 * Return a stable, presentation-oriented CSS token for a status.
 *
 * Always validate or constrain the value before using it in other contexts.
 */
export function getStatusClass(value) {
  const status = normalizeStatus(value);

  if (!status || !/^[a-z0-9_]+$/.test(status)) {
    return "status-unknown";
  }

  const statusClasses = {
    draft: "status-draft",
    submitted: "status-submitted",
    under_review: "status-pending",
    documents_required: "status-warning",
    approved: "status-success",
    completed: "status-success",
    rejected: "status-danger",
    withdrawn: "status-muted",
    open: "status-success",
    paused: "status-warning",
    closed: "status-muted",
    filled: "status-muted",
    archived: "status-muted",
  };

  return statusClasses[status] || "status-default";
}

/* --------------------------------------------------------------------------
 * List and pagination helpers
 * -------------------------------------------------------------------------- */

/**
 * Format a list as a readable sentence.
 */
export function formatList(
  values,
  {
    locale = DEFAULT_LOCALE,
    type = "conjunction",
    fallback = "--",
  } = {}
) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const items = values
    .filter((item) => isPresent(item))
    .map((item) => normalizeWhitespace(String(item)))
    .filter(Boolean);

  if (items.length === 0) {
    return fallback;
  }

  try {
    return new Intl.ListFormat(safeLocale(locale), {
      style: "long",
      type: type === "disjunction" ? "disjunction" : "conjunction",
    }).format(items);
  } catch {
    return items.join(", ");
  }
}

/**
 * Format a pagination range.
 *
 * Example: "21–40 of 126"
 */
export function formatPaginationRange(
  page,
  pageSize,
  total,
  fallback = "--"
) {
  const normalizedPage = toFiniteNumber(page);
  const normalizedPageSize = toFiniteNumber(pageSize);
  const normalizedTotal = toFiniteNumber(total);

  if (
    normalizedPage === null ||
    normalizedPageSize === null ||
    normalizedTotal === null ||
    normalizedPage < 1 ||
    normalizedPageSize < 1 ||
    normalizedTotal < 0
  ) {
    return fallback;
  }

  if (normalizedTotal === 0) {
    return "0 of 0";
  }

  const start = (Math.floor(normalizedPage) - 1) *
    Math.floor(normalizedPageSize) + 1;

  const end = Math.min(
    start + Math.floor(normalizedPageSize) - 1,
    Math.floor(normalizedTotal)
  );

  if (start > normalizedTotal) {
    return `0 of ${formatNumber(normalizedTotal)}`;
  }

  return `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(normalizedTotal)}`;
}

/* --------------------------------------------------------------------------
 * Export convenience object
 * -------------------------------------------------------------------------- */

const formatters = Object.freeze({
  formatText,
  normalizeWhitespace,
  truncateText,
  formatPersonName,
  formatIdentifier,
  formatLabel,

  formatNumber,
  formatCurrency,
  formatPercentage,
  formatCompactNumber,

  formatDate,
  formatDateTime,
  formatTime,
  formatISODate,
  formatRelativeTime,

  formatDuration,
  formatFileSize,

  formatEmail,
  formatPhone,
  maskValue,

  formatApplicationStatus,
  formatJobStatus,
  formatUserRole,
  getStatusClass,

  formatList,
  formatPaginationRange,
});

export default formatters;
