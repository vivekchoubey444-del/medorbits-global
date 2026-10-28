#!/usr/bin/env node
'use strict';

/**
 * MedOrbits Site Autobot
 *
 * Read-only checks:
 * - JSON syntax validation
 * - Local asset reference checks in HTML and CSS
 * - Notification schedule reporting
 *
 * Usage:
 *   node scripts/site-autobot.js
 *   node scripts/site-autobot.js --watch
 *   node scripts/site-autobot.js --json
 *   node scripts/site-autobot.js --watch --json
 *
 * No files or application data are modified.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');

const ROOT = path.resolve(__dirname, '..');
const WATCH_INTERVAL_MS = 10 * 60 * 1000;

const ASSET_REFERENCE =
  /(?:src|href|poster)\s*=\s*["'](\/assets\/[^"'?#]+)["']/gi;

const CSS_URL =
  /url\(\s*["']?(\/assets\/[^"')]+)["']?\s*\)/gi;

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build',
  '.next',
  '.cache'
]);

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const jsonOutput = args.includes('--json');

let watchTimer;
let isRunning = false;
let stopRequested = false;
let latestFailed = false;

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isInside(parent, target) {
  const rel = path.relative(parent, target);

  return (
    rel === '' ||
    (rel !== '..' &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel))
  );
}

async function listFiles(directory, predicate = () => true) {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];

    throw new Error(
      `Cannot read ${relative(directory)}: ${error.message}`
    );
  }

  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const absolutePath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (
      entry.isDirectory() &&
      !IGNORED_DIRECTORIES.has(entry.name)
    ) {
      files.push(...await listFiles(absolutePath, predicate));
    } else if (
      entry.isFile() &&
      predicate(absolutePath)
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function readText(file) {
  return fs.readFile(file, 'utf8');
}

async function checkJson() {
  const directories = [
    path.join(ROOT, 'assets/data'),
    path.join(ROOT, 'assets/documents')
  ];

  const files = [];

  for (const directory of directories) {
    files.push(
      ...await listFiles(
        directory,
        (file) => file.toLowerCase().endsWith('.json')
      )
    );
  }

  const errors = [];
  const warnings = [];

  for (const file of [...new Set(files)]) {
    try {
      const content = await readText(file);

      if (content.charCodeAt(0) === 0xfeff) {
        errors.push(`${relative(file)}: contains a UTF-8 BOM`);
        continue;
      }

      JSON.parse(content);
    } catch (error) {
      errors.push(`${relative(file)}: ${error.message}`);
    }
  }

  if (files.length === 0) {
    warnings.push(
      'No JSON files found in assets/data or assets/documents.'
    );
  }

  return {
    checked: files.length,
    errors,
    warnings
  };
}

function extractReferences(content, pattern) {
  // Reset global regular-expression state between calls.
  pattern.lastIndex = 0;

  return [...content.matchAll(pattern)].map((match) => match[1]);
}

async function checkLocalAssets() {
  const htmlFiles = await listFiles(
    ROOT,
    (file) => file.toLowerCase().endsWith('.html')
  );

  const cssFiles = await listFiles(
    path.join(ROOT, 'assets/css'),
    (file) => file.toLowerCase().endsWith('.css')
  );

  const errors = [];
  const warnings = [];
  const files = [
    ...htmlFiles.map((file) => ({ file, type: 'html' })),
    ...cssFiles.map((file) => ({ file, type: 'css' }))
  ];

  for (const { file, type } of files) {
    let content;

    try {
      content = await readText(file);
    } catch (error) {
      errors.push(`${relative(file)}: ${error.message}`);
      continue;
    }

    const pattern = type === 'css'
      ? CSS_URL
      : ASSET_REFERENCE;

    const references = extractReferences(content, pattern);

    for (const reference of references) {
      let decodedReference;

      try {
        decodedReference = decodeURIComponent(reference);
      } catch {
        errors.push(
          `${relative(file)}: invalid URL encoding in ${reference}`
        );
        continue;
      }

      if (
        decodedReference.includes('\0') ||
        decodedReference.includes('\\')
      ) {
        errors.push(
          `${relative(file)}: unsafe asset reference ${reference}`
        );
        continue;
      }

      const target = path.resolve(
        ROOT,
        `.${decodedReference}`
      );

      if (!isInside(ROOT, target)) {
        errors.push(
          `${relative(file)}: unsafe asset path ${reference}`
        );
        continue;
      }

      try {
        const stat = await fs.stat(target);

        if (!stat.isFile()) {
          errors.push(
            `${relative(file)}: asset is not a file: ${reference}`
          );
        }
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
          errors.push(
            `${relative(file)}: missing asset ${reference}`
          );
        } else {
          errors.push(
            `${relative(file)}: cannot access ${reference}: ${error.message}`
          );
        }
      }
    }
  }

  return {
    pages: htmlFiles.length,
    stylesheets: cssFiles.length,
    errors,
    warnings
  };
}

function parseDate(value, field, index, errors) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push(
      `assets/data/notifications.json: notifications[${index}].${field} is not a valid date`
    );
    return null;
  }

  return Date.parse(value);
}

async function reportNotifications() {
  const file = path.join(ROOT, 'assets/data/notifications.json');

  let data;

  try {
    data = JSON.parse(await readText(file));
  } catch (error) {
    return {
      records: 0,
      live: 0,
      scheduled: 0,
      expired: 0,
      errors: [
        `assets/data/notifications.json: ${error.message}`
      ],
      warnings: []
    };
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    return {
      records: 0,
      live: 0,
      scheduled: 0,
      expired: 0,
      errors: [
        'assets/data/notifications.json: root must be an object'
      ],
      warnings: []
    };
  }

  if (!Array.isArray(data.notifications)) {
    return {
      records: 0,
      live: 0,
      scheduled: 0,
      expired: 0,
      errors: [
        'assets/data/notifications.json: notifications must be an array'
      ],
      warnings: []
    };
  }

  const records = data.notifications;
  const errors = [];
  const warnings = [];
  const now = Date.now();

  let live = 0;
  let scheduled = 0;
  let expired = 0;

  records.forEach((item, index) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      errors.push(
        `assets/data/notifications.json: notifications[${index}] must be an object`
      );
      return;
    }

    const startsAt = parseDate(
      item.startsAt,
      'startsAt',
      index,
      errors
    );

    const endsAt = parseDate(
      item.endsAt,
      'endsAt',
      index,
      errors
    );

    if (
      startsAt !== null &&
      endsAt !== null &&
      endsAt <= startsAt
    ) {
      errors.push(
        `assets/data/notifications.json: notifications[${index}].endsAt must be after startsAt`
      );
    }

    if (
      item.active === true &&
      item.publicationStatus === 'live' &&
      (startsAt === null || startsAt <= now) &&
      (endsAt === null || endsAt > now)
    ) {
      live += 1;
    }

    if (
      item.active === true &&
      item.publicationStatus === 'scheduled' &&
      startsAt !== null &&
      startsAt > now
    ) {
      scheduled += 1;
    }

    if (endsAt !== null && endsAt <= now) {
      expired += 1;
    }

    if (
      item.active === true &&
      !['live', 'scheduled', 'draft', 'archived'].includes(
        item.publicationStatus
      )
    ) {
      warnings.push(
        `notifications[${index}] has an unknown publicationStatus`
      );
    }
  });

  return {
    records: records.length,
    live,
    scheduled,
    expired,
    errors,
    warnings
  };
}

async function runChecks() {
  if (isRunning) {
    return null;
  }

  isRunning = true;

  try {
    const [json, assets, notifications] = await Promise.all([
      checkJson(),
      checkLocalAssets(),
      reportNotifications()
    ]);

    const errors = [
      ...json.errors,
      ...assets.errors,
      ...notifications.errors
    ];

    const warnings = [
      ...json.warnings,
      ...assets.warnings,
      ...notifications.warnings
    ];

    const result = {
      ok: errors.length === 0,
      timestamp: new Date().toISOString(),
      json: {
        checked: json.checked,
        errors: json.errors
      },
      assets: {
        pages: assets.pages,
        stylesheets: assets.stylesheets,
        errors: assets.errors
      },
      notifications: {
        records: notifications.records,
        live: notifications.live,
        scheduled: notifications.scheduled,
        expired: notifications.expired,
        errors: notifications.errors
      },
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings
    };

    latestFailed = !result.ok;

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n[site-autobot] MedOrbits read-only checks');
      console.log(`[site-autobot] JSON files checked: ${json.checked}`);
      console.log(
        `[site-autobot] HTML pages: ${assets.pages}; stylesheets: ${assets.stylesheets}`
      );
      console.log(
        `[site-autobot] Notifications: ${notifications.live} live, ` +
        `${notifications.scheduled} scheduled, ${notifications.expired} expired ` +
        `(${notifications.records} total)`
      );

      for (const warning of warnings) {
        console.warn(`[site-autobot] WARNING: ${warning}`);
      }

      for (const error of errors) {
        console.error(`[site-autobot] ERROR: ${error}`);
      }

      console.log(
        `[site-autobot] ${result.ok ? 'All checks passed' : 'Checks failed'} ` +
        `(${result.errorCount} errors, ${result.warningCount} warnings).`
      );
    }

    if (result.ok) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }

    return result.ok;
  } finally {
    isRunning = false;
  }
}

function shutdown() {
  stopRequested = true;

  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = undefined;
  }

  if (!isRunning) {
    process.exitCode = latestFailed ? 1 : 0;
  }
}

async function main() {
  await runChecks();

  if (!watch) {
    return;
  }

  if (!jsonOutput) {
    console.log(
      '[site-autobot] Read-only checks repeat every 10 minutes. Press Ctrl+C to stop.'
    );
  }

  watchTimer = setInterval(async () => {
    if (stopRequested) return;

    try {
      await runChecks();
    } catch (error) {
      latestFailed = true;
      process.exitCode = 1;
      console.error(`[site-autobot] ${error.message}`);
    }
  }, WATCH_INTERVAL_MS);

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(`[site-autobot] Fatal error: ${error.message}`);
  process.exitCode = 1;
});
