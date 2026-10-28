#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'assets', 'data');
const UNIVERSITIES_PATH = path.join(DATA_DIR, 'universities.json');
const LOCATIONS_PATH = path.join(DATA_DIR, 'locations.json');

const UGC_API =
  'https://www.ugc.gov.in/universitydetails/Getuniversity_details';
const UGC_DIRECTORY =
  'https://www.ugc.gov.in/universitydetails/university';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

const CATEGORIES = [
  {
    sourceId: 1,
    label: 'Central',
    institutionType: 'central-university',
    ownershipType: 'public',
  },
  {
    sourceId: 2,
    label: 'State',
    institutionType: 'state-university',
    ownershipType: 'public',
  },
  {
    sourceId: 3,
    label: 'Private',
    institutionType: 'private-university',
    ownershipType: 'private',
  },
  {
    sourceId: 4,
    label: 'Deemed to be Universities',
    institutionType: 'deemed-university',
    ownershipType: 'other',
  },
];

function cleanText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const cleaned = String(value).trim();
  return cleaned || null;
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'institution';
}

function normalizeWebsite(value) {
  if (typeof value !== 'string') return null;

  let candidate = value.trim().replace(/^['"`]+|['"`]+$/g, '');

  if (
    !candidate ||
    /^(?:null|n\/a|na|none|-)$/i.test(candidate) ||
    /[,;\s]/.test(candidate)
  ) {
    return null;
  }

  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const website = new URL(candidate);

    if (
      !['http:', 'https:'].includes(website.protocol) ||
      !website.hostname.includes('.') ||
      website.username ||
      website.password
    ) {
      return null;
    }

    return website.href;
  } catch {
    return null;
  }
}

function createStateIndex(locations) {
  if (!locations || typeof locations !== 'object') {
    throw new Error('locations.json must contain a JSON object.');
  }

  if (!Array.isArray(locations.states)) {
    throw new Error('locations.json must contain a states array.');
  }

  const index = new Map();

  for (const state of locations.states) {
    if (
      !state ||
      typeof state !== 'object' ||
      typeof state.name !== 'string' ||
      typeof state.id !== 'string'
    ) {
      continue;
    }

    const key = state.name.trim().toLowerCase();

    if (key && !index.has(key)) {
      index.set(key, state.id);
    }
  }

  return index;
}

function createUniversityRecord(
  row,
  category,
  stateIndex,
  checkedAt,
  updatedAt,
) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('UGC record must be an object.');
  }

  const sourceId = cleanText(row.ID);
  const name = cleanText(row.uni_name);

  if (!sourceId || !/^\d+$/.test(sourceId) || !name) {
    throw new Error('UGC record is missing a valid ID or university name.');
  }

  const stateName = cleanText(row.state);
  const ugcStatus = cleanText(row.status);
  const website = normalizeWebsite(row.url);

  const sourceUrl = new URL(UGC_API);
  sourceUrl.searchParams.set('unitypeID', String(category.sourceId));

  const sourceUrls = [
    {
      url: sourceUrl.href,
      sourceType: 'government-directory',
      description:
        `University Grants Commission directory; category: ${category.label}` +
        (ugcStatus ? `; listed status: ${ugcStatus}` : '') +
        '.',
      checkedAt,
    },
  ];

  if (website) {
    sourceUrls.push({
      url: website,
      sourceType: 'official-website',
      description:
        'Website URL listed by UGC; destination and current ownership have not been independently verified.',
      checkedAt: null,
    });
  }

  const summary =
    `Listed in the UGC directory as ${category.label}` +
    (ugcStatus ? ` (UGC listing status: ${ugcStatus})` : '') +
    '. Confirm current recognition, campus, programmes and admissions directly with official sources.';

  const rawZip = cleanText(row.Zip);
  const pincode = rawZip && /^\d{6}$/.test(rawZip) ? rawZip : null;

  return {
    id: `inst-in-ugc-${sourceId}`,
    name,
    shortName: null,
    slug: `${slugify(name)}-${sourceId}`,
    aliases: [],
    institutionType: category.institutionType,
    ownershipType: category.ownershipType,
    parentInstitutionId: null,
    foundedYear: null,
    countryCode: 'IN',
    stateId: stateName
      ? stateIndex.get(stateName.toLowerCase()) || null
      : null,
    stateName,
    cityId: null,
    address: cleanText(row.address),
    pincode,
    coordinates: null,
    website,
    contact: null,
    recognitions: [],
    accreditations: [],
    courseIds: [],
    collegeIds: [],
    feeIds: [],
    admissionIds: [],
    examIds: [],
    hostelIds: [],
    facilities: [],
    languageOfInstruction: [],
    summary,
    ugcInstitutionId: sourceId,
    ugcStatus,
    sourceUrls,
    verificationStatus: 'pending-review',
    verifiedAt: null,
    verifiedBy: null,
    reviewDueAt: null,
    active: true,
    createdAt: null,
    updatedAt,
  };
}

async function fetchCategory(category, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A compatible fetch implementation is required.');
  }

  const url = new URL(UGC_API);
  url.searchParams.set('unitypeID', String(category.sourceId));

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(url.href, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Referer: UGC_DIRECTORY,
        'User-Agent': 'MedOrbits-University-Importer/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(
        `UGC request failed for ${category.label}: HTTP ${response.status}`,
      );
    }

    const contentType = response.headers?.get?.('content-type');

    if (
      contentType &&
      !/json/i.test(contentType) &&
      !/text\/plain/i.test(contentType)
    ) {
      throw new Error(
        `Unexpected response content type for ${category.label}: ${contentType}`,
      );
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      // Support simple mocked responses while enforcing the same size limit.
      const text = await response.text();

      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error(`UGC response too large for ${category.label}.`);
      }

      return parsePayload(text, category);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => {});
          throw new Error(`UGC response too large for ${category.label}.`);
        }

        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return parsePayload(
      Buffer.concat(chunks).toString('utf8'),
      category,
    );
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(
        `UGC request timed out for ${category.label} after ${REQUEST_TIMEOUT_MS} ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePayload(text, category) {
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`UGC returned invalid JSON for ${category.label}.`);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray(payload.List)
  ) {
    throw new Error(
      `UGC response has an unexpected structure for ${category.label}.`,
    );
  }

  if (payload.List.length === 0) {
    throw new Error(
      `UGC returned no university records for ${category.label}.`,
    );
  }

  return payload.List;
}

function validateDataset(dataset, filename) {
  if (
    !dataset ||
    typeof dataset !== 'object' ||
    Array.isArray(dataset)
  ) {
    throw new Error(`${filename} must contain a JSON object.`);
  }

  if (!Array.isArray(dataset.universities)) {
    throw new Error(`${filename} must contain a universities array.`);
  }

  const ids = new Set();

  for (const university of dataset.universities) {
    if (
      !university ||
      typeof university !== 'object' ||
      Array.isArray(university) ||
      typeof university.id !== 'string' ||
      !university.id.trim()
    ) {
      throw new Error(
        `${filename} contains a university record without a valid string ID.`,
      );
    }

    if (ids.has(university.id)) {
      throw new Error(
        `${filename} contains duplicate university ID: ${university.id}`,
      );
    }

    ids.add(university.id);
  }

  return ids;
}

async function readJsonFile(filename) {
  const content = await fs.readFile(filename, 'utf8');

  if (content.charCodeAt(0) === 0xfeff) {
    throw new Error(`${path.basename(filename)} contains a UTF-8 BOM.`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Cannot parse ${path.basename(filename)}: ${error.message}`,
    );
  }
}

async function atomicWriteJson(filename, data) {
  const directory = path.dirname(filename);
  const temporary = path.join(
    directory,
    `.${path.basename(filename)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  const content = `${JSON.stringify(data, null, 2)}\n`;

  try {
    await fs.writeFile(temporary, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });

    // Verify the serialized file before replacing the dataset.
    const verification = JSON.parse(await fs.readFile(temporary, 'utf8'));

    if (!verification || !Array.isArray(verification.universities)) {
      throw new Error('Serialized university dataset failed validation.');
    }

    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function importUniversities({
  fetchImpl = globalThis.fetch,
  dryRun = false,
} = {}) {
  const [dataset, locations] = await Promise.all([
    readJsonFile(UNIVERSITIES_PATH),
    readJsonFile(LOCATIONS_PATH),
  ]);

  validateDataset(dataset, 'universities.json');

  const stateIndex = createStateIndex(locations);
  const timestamp = new Date().toISOString();
  const checkedAt = timestamp.slice(0, 10);

  // Fetch every category successfully before preparing any file changes.
  const rowsByCategory = await Promise.all(
    CATEGORIES.map(async (category) => ({
      category,
      rows: await fetchCategory(category, fetchImpl),
    })),
  );

  const imported = [];

  for (const { category, rows } of rowsByCategory) {
    const categoryIds = new Set();

    for (const row of rows) {
      const record = createUniversityRecord(
        row,
        category,
        stateIndex,
        checkedAt,
        timestamp,
      );

      if (categoryIds.has(record.id)) {
        throw new Error(
          `Duplicate UGC institution ID in ${category.label}: ${record.id}`,
        );
      }

      categoryIds.add(record.id);
      imported.push(record);
    }
  }

  const importedIds = new Set();
  for (const record of imported) {
    if (importedIds.has(record.id)) {
      throw new Error(`Duplicate UGC institution ID: ${record.id}`);
    }
    importedIds.add(record.id);
  }

  // Preserve manually curated records that are not part of the UGC import.
  const existingById = new Map(
    dataset.universities.map((record) => [record.id, record]),
  );

  const merged = new Map(existingById);

  for (const record of imported) {
    const existing = existingById.get(record.id);

    // Keep existing curated fields while refreshing imported UGC fields.
    merged.set(
      record.id,
      existing
        ? { ...existing, ...record }
        : record,
    );
  }

  const universities = [...merged.values()];

  const counts = Object.fromEntries(
    rowsByCategory.map(({ category, rows }) => [
      category.label,
      rows.length,
    ]),
  );

  const report = {
    dryRun,
    categoryCounts: counts,
    importedRecords: imported.length,
    existingRecords: dataset.universities.length,
    finalRecords: universities.length,
    addedRecords: imported.filter(
      (record) => !existingById.has(record.id),
    ).length,
    refreshedRecords: imported.filter(
      (record) => existingById.has(record.id),
    ).length,
  };

  if (dryRun) {
    return report;
  }

  const output = {
    ...dataset,
    updatedAt: timestamp,
    metadata: {
      ...(dataset.metadata && typeof dataset.metadata === 'object'
        ? dataset.metadata
        : {}),
      sourceSnapshot: {
        name: 'University Grants Commission university directory',
        url: UGC_DIRECTORY,
        api: UGC_API,
        importedAt: timestamp,
        recordsImported: imported.length,
        categories: counts,
        verificationNote:
          'Imported records remain pending review. Listing in the UGC directory does not independently establish current recognition, programme approval, or the validity of website destinations.',
      },
    },
    universities,
  };

  validateDataset(output, 'output universities.json');
  await atomicWriteJson(UNIVERSITIES_PATH, output);

  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const allowed = new Set(['--dry-run', '--json']);

  for (const arg of args) {
    if (!allowed.has(arg)) {
      console.error(
        'Usage: node scripts/import-ugc-universities.js [--dry-run] [--json]',
      );
      process.exit(2);
    }
  }

  importUniversities({
    dryRun: args.includes('--dry-run'),
  })
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(`[ugc-import] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  CATEGORIES,
  createStateIndex,
  createUniversityRecord,
  fetchCategory,
  importUniversities,
  normalizeWebsite,
  parsePayload,
  slugify,
  validateDataset,
};
