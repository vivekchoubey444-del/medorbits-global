
#!/usr/bin/env node

'use strict';

/**
 * MedOrbits -- Website Link Integrity Checker
 * -------------------------------------------
 * File: scripts/check-links.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Features:
 * - Recursively scans HTML and HTM files.
 * - Checks local page, stylesheet, script, image, media and other references.
 * - Resolves root-relative and document-relative paths.
 * - Checks same-page and cross-page fragment identifiers.
 * - Detects duplicate IDs in HTML documents.
 * - Supports configurable root and website directories.
 * - Supports excluded directories and hidden-file handling.
 * - Skips symbolic links.
 * - Optionally checks external HTTP/HTTPS links.
 * - Supports request timeouts, bounded concurrency and retries.
 * - Avoids sending requests to localhost/private-network URLs by default.
 * - Produces human-readable or JSON reports.
 * - Provides CI-compatible exit codes.
 *
 * Usage:
 *   node scripts/check-links.mjs
 *   node scripts/check-links.mjs --strict
 *   node scripts/check-links.mjs --root .
 *   node scripts/check-links.mjs --site public
 *   node scripts/check-links.mjs --check-external
 *   node scripts/check-links.mjs --check-external --timeout 10000
 *   node scripts/check-links.mjs --exclude uploads
 *   node scripts/check-links.mjs --include-hidden
 *   node scripts/check-links.mjs --json
 *
 * Exit codes:
 *   0 = success
 *   1 = link validation failure
 *   2 = configuration or runtime failure
 *
 * Security:
 * - External checking is disabled unless explicitly enabled.
 * - External requests are limited to HTTP and HTTPS.
 * - Private, loopback, link-local and local hostnames are blocked.
 * - No website JavaScript is executed.
 *
 * Limitations:
 * - This is a static checker; server-side routes and dynamically generated
 *   links cannot always be resolved.
 * - Some websites block HEAD requests or automated clients.
 * - Fragment checks work with literal HTML IDs and named anchors.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { isIP } from 'node:net';

const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.netlify',
];

const HTML_EXTENSIONS = new Set(['.html', '.htm']);

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RETRIES = 1;
const MAX_REPORTED_ISSUES = 2000;
const MAX_HTML_FILE_SIZE_MB = 10;
const USER_AGENT = 'MedOrbits-LinkChecker/1.0';

const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILURE: 1,
  CONFIGURATION_ERROR: 2,
});

function printHelp() {
  console.log(`
MedOrbits Website Link Integrity Checker

Usage:
  node scripts/check-links.mjs [options]

Options:
  --root <directory>
      Project root. Defaults to the current working directory.

  --site <directory>
      Website directory relative to --root, or an absolute path.
      Defaults to public/, dist/, or the project root.

  --exclude <name>
      Exclude a directory by name. Can be repeated.

  --include-hidden
      Include hidden files and directories, except excluded directories.

  --check-external
      Check HTTP/HTTPS links. External requests are disabled by default.

  --timeout <milliseconds>
      Timeout for each external request.
      Default: ${DEFAULT_TIMEOUT_MS}.

  --concurrency <number>
      Maximum simultaneous external requests.
      Default: ${DEFAULT_CONCURRENCY}.

  --retries <number>
      Number of retries after a failed external request.
      Default: ${DEFAULT_RETRIES}.

  --strict
      Treat warnings as failures.

  --json
      Print a machine-readable JSON report.

  --help, -h
      Display this help.

Examples:
  node scripts/check-links.mjs
  node scripts/check-links.mjs --strict
  node scripts/check-links.mjs --site public
  node scripts/check-links.mjs --check-external
  node scripts/check-links.mjs --check-external --timeout 10000
  node scripts/check-links.mjs --exclude uploads --exclude temp
  node scripts/check-links.mjs --json
`);
}

function parseArguments(args) {
  const options = {
    root: process.cwd(),
    site: null,
    strict: false,
    includeHidden: false,
    checkExternal: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    excludedDirectories: new Set(DEFAULT_IGNORED_DIRECTORIES),
    jsonOutput: false,
    help: false,
    errors: [],
  };

  const numericOptions = new Map([
    ['--timeout', 'timeoutMs'],
    ['--concurrency', 'concurrency'],
    ['--retries', 'retries'],
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--strict') {
      options.strict = true;
      continue;
    }

    if (argument === '--include-hidden') {
      options.includeHidden = true;
      continue;
    }

    if (argument === '--check-external') {
      options.checkExternal = true;
      continue;
    }

    if (argument === '--json') {
      options.jsonOutput = true;
      continue;
    }

    if (argument === '--root' || argument === '--site') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        options.errors.push(`${argument} requires a directory path.`);
        continue;
      }

      if (argument === '--root') {
        options.root = path.resolve(process.cwd(), value);
      } else {
        options.site = value;
      }

      index += 1;
      continue;
    }

    if (argument === '--exclude') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        options.errors.push('--exclude requires a directory name.');
        continue;
      }

      if (
        value === '.' ||
        value === '..' ||
        value.includes('/') ||
        value.includes('\\')
      ) {
        options.errors.push(
          `Invalid exclusion "${value}". Supply a directory name, not a path.`,
        );
        continue;
      }

      options.excludedDirectories.add(value);
      index += 1;
      continue;
    }

    if (numericOptions.has(argument)) {
      const value = args[index + 1];
      const key = numericOptions.get(argument);
      const parsed = Number(value);

      if (
        value === undefined ||
        value.startsWith('--') ||
        value.trim() === '' ||
        !Number.isFinite(parsed) ||
        !Number.isInteger(parsed) ||
        parsed < 0
      ) {
        options.errors.push(
          `${argument} requires a non-negative integer.`,
        );
        continue;
      }

      if (key === 'timeoutMs' && parsed < 1) {
        options.errors.push('--timeout must be greater than zero.');
        continue;
      }

      if (key === 'concurrency' && parsed < 1) {
        options.errors.push('--concurrency must be at least 1.');
        continue;
      }

      options[key] = parsed;
      index += 1;
      continue;
    }

    options.errors.push(`Unknown option: ${argument}`);
  }

  return options;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/') || '.';
}

function isInside(parent, target) {
  const result = path.relative(parent, target);

  return (
    result === '' ||
    (
      result !== '..' &&
      !result.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(result)
    )
  );
}

function addIssue(report, level, code, file, reference, message) {
  if (level === 'error') {
    report.errors += 1;
  } else {
    report.warnings += 1;
  }

  report.totalIssues += 1;

  if (report.issues.length < MAX_REPORTED_ISSUES) {
    report.issues.push({
      level,
      code,
      file: file || '.',
      reference: reference || null,
      message,
    });
  } else {
    report.omittedIssues += 1;
  }
}

function walkFiles(directory, options, report) {
  const files = [];

  function walk(currentDirectory) {
    report.directoriesVisited += 1;

    let entries;

    try {
      entries = fs.readdirSync(currentDirectory, {
        withFileTypes: true,
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      addIssue(
        report,
        'error',
        'DIRECTORY_READ_FAILED',
        relative(options.root, currentDirectory),
        null,
        error.message,
      );

      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        report.symbolicLinksSkipped += 1;
        continue;
      }

      if (!options.includeHidden && entry.name.startsWith('.')) {
        report.pathsSkipped += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (options.excludedDirectories.has(entry.name)) {
          report.pathsSkipped += 1;
          continue;
        }

        if (!isInside(options.siteRoot, fullPath)) {
          report.pathsSkipped += 1;
          continue;
        }

        walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(directory);

  return files.sort();
}

function readHtmlFiles(files, options, report) {
  const documents = new Map();

  for (const filePath of files) {
    let stat;
    let html;

    try {
      stat = fs.lstatSync(filePath);

      if (!stat.isFile() || stat.isSymbolicLink()) {
        report.pathsSkipped += 1;
        continue;
      }

      if (stat.size > MAX_HTML_FILE_SIZE_MB * 1024 * 1024) {
        addIssue(
          report,
          'error',
          'HTML_FILE_TOO_LARGE',
          relative(options.root, filePath),
          null,
          `HTML file exceeds the ${MAX_HTML_FILE_SIZE_MB} MB scanning limit.`,
        );

        continue;
      }

      html = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      addIssue(
        report,
        'error',
        'HTML_READ_FAILED',
        relative(options.root, filePath),
        null,
        error.message,
      );

      continue;
    }

    documents.set(filePath, {
      path: filePath,
      relativePath: relative(options.siteRoot, filePath),
      html,
      ids: new Set(),
      references: [],
    });

    report.htmlFilesScanned += 1;
  }

  return documents;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, number) => {
      const codePoint = Number(number);

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    })
    .replace(/&#x([\da-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    });
}

function parseAttributes(tag) {
  const attributes = new Map();
  const attributePattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  const openingTagEnd = tag.indexOf(' ');
  const content = openingTagEnd >= 0
    ? tag.slice(openingTagEnd + 1).replace(/\/?>\s*$/, '')
    : tag.replace(/^<[^>\s]+|\/?>$/g, '');

  let match;

  while ((match = attributePattern.exec(content)) !== null) {
    const name = match[1].toLowerCase();

    if (!name || name.startsWith('/')) {
      continue;
    }

    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes.set(name, decodeHtmlEntities(value));
  }

  return attributes;
}

function extractHtmlMetadata(document, options, report) {
  const { html, path: filePath } = document;
  const file = relative(options.root, filePath);

  // Remove comments so references inside HTML comments are ignored.
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');

  const idPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let tagMatch;

  while ((tagMatch = idPattern.exec(withoutComments)) !== null) {
    const tag = tagMatch[0];
    const tagName = tagMatch[1].toLowerCase();
    const attributes = parseAttributes(tag);

    const id = attributes.get('id');

    if (id !== undefined && id !== '') {
      if (document.ids.has(id)) {
        addIssue(
          report,
          'warning',
          'DUPLICATE_ID',
          file,
          `#${id}`,
          `Duplicate id "${id}" found in HTML document.`,
        );
      }

      document.ids.add(id);
    }

    // Legacy named anchors remain valid fragment targets.
    if (tagName === 'a') {
      const name = attributes.get('name');

      if (name) {
        document.ids.add(name);
      }
    }

    const references = [];

    for (const attribute of [
      'href',
      'src',
      'poster',
      'data-src',
      'data-href',
      'action',
      'formaction',
      'cite',
      'background',
      'xlink:href',
    ]) {
      if (attributes.has(attribute)) {
        references.push({
          attribute,
          value: attributes.get(attribute),
        });
      }
    }

    if (tagName === 'meta') {
      const content = attributes.get('content');
      const property = attributes.get('property') || attributes.get('name');

      if (
        content &&
        property &&
        /^(og:image|og:url|twitter:image)$/i.test(property)
      ) {
        references.push({
          attribute: `meta:${property}`,
          value: content,
        });
      }
    }

    if (tagName === 'link') {
      const rel = attributes.get('rel') || '';

      if (/\bcanonical\b/i.test(rel) && attributes.has('href')) {
        references.push({
          attribute: 'canonical',
          value: attributes.get('href'),
        });
      }
    }

    for (const reference of references) {
      document.references.push({
        ...reference,
        sourceFile: filePath,
        sourceRelativePath: document.relativePath,
      });
    }
  }

  // Inline CSS URLs are checked for local assets.
  const cssUrlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let cssMatch;

  while ((cssMatch = cssUrlPattern.exec(withoutComments)) !== null) {
    const value = cssMatch[2].trim();

    if (value) {
      document.references.push({
        attribute: 'css:url',
        value: decodeHtmlEntities(value),
        sourceFile: filePath,
        sourceRelativePath: document.relativePath,
      });
    }
  }
}

function isExternalUrl(value) {
  return /^(?:https?:)?\/\//i.test(value);
}

function isSpecialUrl(value) {
  return (
    value === '' ||
    value.startsWith('#') ||
    /^(?:mailto:|tel:|sms:|data:|blob:|javascript:|about:|magnet:|ftp:|file:)/i.test(value)
  );
}

function isTemplateReference(value) {
  return (
    value.includes('{{') ||
    value.includes('}}') ||
    value.includes('${') ||
    value.includes('<%') ||
    value.includes('%>')
  );
}

function cleanLocalPath(value) {
  let cleaned = value.trim();

  // Ignore query parameters and fragments when checking filesystem paths.
  const queryIndex = cleaned.indexOf('?');
  const hashIndex = cleaned.indexOf('#');

  const cutIndex = [
    queryIndex,
    hashIndex,
  ].filter((index) => index >= 0).reduce(
    (minimum, index) => Math.min(minimum, index),
    cleaned.length,
  );

  cleaned = cleaned.slice(0, cutIndex);

  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Keep the original path; malformed escapes will generally fail lookup.
  }

  return cleaned;
}

function buildHtmlLookup(documents, siteRoot) {
  const lookup = new Map();

  for (const document of documents.values()) {
    const key = path.resolve(document.path);
    lookup.set(key, document);
  }

  return lookup;
}

function resolveLocalTarget(value, sourceFile, options) {
  const cleaned = cleanLocalPath(value);

  if (!cleaned) {
    return {
      kind: 'same-document',
      target: sourceFile,
    };
  }

  let target;

  if (cleaned.startsWith('/')) {
    target = path.resolve(options.siteRoot, `.${cleaned}`);
  } else {
    target = path.resolve(path.dirname(sourceFile), cleaned);
  }

  if (!isInside(options.siteRoot, target)) {
    return {
      kind: 'outside-site',
      target,
    };
  }

  if (isDirectory(target)) {
    const candidates = [
      path.join(target, 'index.html'),
      path.join(target, 'index.htm'),
    ];

    const indexFile = candidates.find(isFile);

    if (indexFile) {
      target = indexFile;
    }
  }

  return {
    kind: 'local',
    target,
  };
}

function hasFragment(value) {
  return value.includes('#');
}

function extractFragment(value) {
  const index = value.indexOf('#');

  if (index < 0) {
    return null;
  }

  try {
    return decodeURIComponent(value.slice(index + 1));
  } catch {
    return value.slice(index + 1);
  }
}

function validateLocalReference(
  reference,
  document,
  documents,
  htmlLookup,
  options,
  report,
) {
  const value = reference.value.trim();
  const sourceFile = document.path;
  const sourceRelative = relative(options.root, sourceFile);

  if (isTemplateReference(value)) {
    report.dynamicReferencesSkipped += 1;
    return;
  }

  if (isSpecialUrl(value)) {
    return;
  }

  if (isExternalUrl(value)) {
    if (options.checkExternal) {
      report.externalReferences.push({
        sourceFile,
        sourceRelative,
        attribute: reference.attribute,
        value,
      });
    }

    return;
  }

  const targetInfo = resolveLocalTarget(value, sourceFile, options);

  if (targetInfo.kind === 'same-document') {
    if (hasFragment(value)) {
      const fragment = extractFragment(value);

      if (
        fragment &&
        !documents.get(sourceFile)?.ids.has(fragment)
      ) {
        addIssue(
          report,
          'error',
          'BROKEN_SAME_PAGE_FRAGMENT',
          sourceRelative,
          value,
          `Fragment "#${fragment}" does not exist in this document.`,
        );
      }
    }

    return;
  }

  if (targetInfo.kind === 'outside-site') {
    addIssue(
      report,
      'warning',
      'REFERENCE_OUTSIDE_SITE',
      sourceRelative,
      value,
      'Local reference resolves outside the configured website directory.',
    );

    return;
  }

  const target = targetInfo.target;

  if (!isFile(target)) {
    addIssue(
      report,
      'error',
      'BROKEN_LOCAL_REFERENCE',
      sourceRelative,
      value,
      `Local target does not exist: ${relative(options.siteRoot, target)}`,
    );

    return;
  }

  report.localReferencesChecked += 1;

  if (hasFragment(value)) {
    const fragment = extractFragment(value);

    if (!fragment) {
      return;
    }

    const targetDocument = htmlLookup.get(path.resolve(target));

    if (!targetDocument) {
      // Fragment validation applies only to HTML documents scanned here.
      return;
    }

    if (!targetDocument.ids.has(fragment)) {
      addIssue(
        report,
        'error',
        'BROKEN_CROSS_PAGE_FRAGMENT',
        sourceRelative,
        value,
        `Fragment "#${fragment}" does not exist in ${relative(options.siteRoot, target)}.`,
      );
    }
  }
}

function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.test') ||
    host.endsWith('.invalid')
  ) {
    return true;
  }

  const ipVersion = isIP(host);

  if (ipVersion === 4) {
    const octets = host.split('.').map(Number);
    const [a, b] = octets;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a >= 224 && a <= 255)
    );
  }

  if (ipVersion === 6) {
    const normalized = host.toLowerCase();

    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/i.test(normalized) ||
      normalized.startsWith('ff')
    );
  }

  // Conservative rejection of single-label hostnames.
  return !host.includes('.');
}

function validateExternalUrl(rawValue) {
  let url;

  try {
    url = new URL(rawValue);
  } catch {
    return {
      ok: false,
      reason: 'Malformed external URL.',
    };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return {
      ok: false,
      reason: `Unsupported protocol "${url.protocol}". Only HTTP and HTTPS are checked.`,
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      reason: 'URLs containing embedded credentials are not requested.',
    };
  }

  if (isBlockedHostname(url.hostname)) {
    return {
      ok: false,
      reason: 'Private, local, or non-public hostname blocked for security.',
    };
  }

  return {
    ok: true,
    url,
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestExternalUrl(rawUrl, options) {
  const validation = validateExternalUrl(rawUrl);

  if (!validation.ok) {
    return {
      status: 'skipped',
      message: validation.reason,
    };
  }

  const url = validation.url;
  let lastError = null;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs,
    );

    try {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: '*/*',
        },
      });

      // A bounded number of manual redirects prevents unbounded redirect
      // chains and lets us validate every redirect target before requesting.
      let redirects = 0;
      let currentUrl = url;

      while (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location') &&
        redirects < 5
      ) {
        const location = response.headers.get('location');
        let nextUrl;

        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return {
            status: 'warning',
            message: 'Server returned an invalid redirect location.',
            httpStatus: response.status,
          };
        }

        const nextValidation = validateExternalUrl(nextUrl.href);

        if (!nextValidation.ok) {
          return {
            status: 'skipped',
            message: `Redirect target blocked: ${nextValidation.reason}`,
            httpStatus: response.status,
          };
        }

        currentUrl = nextValidation.url;
        response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': USER_AGENT,
            accept: '*/*',
          },
        });

        redirects += 1;
      }

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        return {
          status: 'warning',
          message: 'Redirect limit exceeded.',
          httpStatus: response.status,
        };
      }

      // Some servers reject HEAD while supporting GET. Retry with GET
      // and immediately cancel the response body when possible.
      if ([403, 405, 501].includes(response.status)) {
        try {
          response = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'user-agent': USER_AGENT,
              accept: '*/*',
              range: 'bytes=0-0',
            },
          });

          if (response.body) {
            await response.body.cancel();
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (response.status >= 200 && response.status < 400) {
        return {
          status: 'ok',
          httpStatus: response.status,
          finalUrl: currentUrl.href,
        };
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);

        if (attempt < options.retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
      }

      return {
        status: 'broken',
        httpStatus: response.status,
        message: `HTTP ${response.status}`,
      };
    } catch (error) {
      lastError = error;

      if (attempt < options.retries) {
        await sleep(250 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    status: 'warning',
    message: lastError?.name === 'AbortError'
      ? `Request timed out after ${options.timeoutMs} ms.`
      : `Request failed: ${lastError?.message || 'unknown network error'}`,
  };
}

async function runWithConcurrency(items, concurrency, callback) {
  let nextIndex = 0;

  const workerCount = Math.min(concurrency, items.length);

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );
}

async function checkExternalReferences(options, report) {
  const unique = new Map();

  for (const reference of report.externalReferences) {
    let normalized;

    try {
      const url = new URL(reference.value);
      url.hash = '';
      normalized = url.href;
    } catch {
      normalized = reference.value;
    }

    if (!unique.has(normalized)) {
      unique.set(normalized, {
        url: normalized,
        references: [],
      });
    }

    unique.get(normalized).references.push(reference);
  }

  const uniqueUrls = [...unique.values()];
  report.externalUrlsChecked = uniqueUrls.length;

  await runWithConcurrency(
    uniqueUrls,
    options.concurrency,
    async (item) => {
      const result = await requestExternalUrl(item.url, options);

      if (result.status === 'ok') {
        report.externalUrlsPassed += 1;
        return;
      }

      if (result.status === 'skipped') {
        report.externalUrlsSkipped += 1;

        addIssue(
          report,
          'warning',
          'EXTERNAL_URL_SKIPPED',
          item.references[0]?.sourceRelative || '.',
          item.url,
          result.message,
        );

        return;
      }

      if (result.status === 'broken') {
        report.externalUrlsFailed += 1;

        for (const reference of item.references) {
          addIssue(
            report,
            'error',
            'EXTERNAL_URL_FAILED',
            reference.sourceRelative,
            reference.value,
            result.message,
          );
        }

        return;
      }

      report.externalUrlsWarnings += 1;

      for (const reference of item.references) {
        addIssue(
          report,
          'warning',
          'EXTERNAL_URL_UNVERIFIED',
          reference.sourceRelative,
          reference.value,
          result.message,
        );
      }
    },
  );
}

function createReport(options) {
  return {
    root: options.root,
    siteRoot: options.siteRoot,
    strict: options.strict,
    externalCheckingEnabled: options.checkExternal,
    htmlFilesScanned: 0,
    directoriesVisited: 0,
    pathsSkipped: 0,
    symbolicLinksSkipped: 0,
    localReferencesChecked: 0,
    dynamicReferencesSkipped: 0,
    externalUrlsChecked: 0,
    externalUrlsPassed: 0,
    externalUrlsFailed: 0,
    externalUrlsSkipped: 0,
    externalUrlsWarnings: 0,
    externalReferences: [],
    errors: 0,
    warnings: 0,
    totalIssues: 0,
    omittedIssues: 0,
    issues: [],
  };
}

function printReport(report, options, elapsedMs) {
  const failed = report.errors > 0 ||
    (options.strict && report.warnings > 0);

  const output = {
    tool: 'MedOrbits Website Link Integrity Checker',
    version: 1,
    durationMs: Number(elapsedMs.toFixed(2)),
    ...report,
    externalReferences: undefined,
    result: failed ? 'failed' : 'passed',
    exitCode: failed
      ? EXIT_CODES.VALIDATION_FAILURE
      : EXIT_CODES.SUCCESS,
  };

  if (options.jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return output.exitCode;
  }

  console.log('');
  console.log('MedOrbits Link Integrity Report');
  console.log('='.repeat(48));
  console.log(`Project root:            ${report.root}`);
  console.log(`Website root:            ${report.siteRoot}`);
  console.log(`HTML files scanned:      ${report.htmlFilesScanned}`);
  console.log(`Directories visited:     ${report.directoriesVisited}`);
  console.log(`Paths skipped:           ${report.pathsSkipped}`);
  console.log(`Symbolic links skipped:  ${report.symbolicLinksSkipped}`);
  console.log(`Local references checked:${String(report.localReferencesChecked).padStart(7)}`);
  console.log(`Dynamic references skipped: ${report.dynamicReferencesSkipped}`);
  console.log(`External checking:       ${options.checkExternal ? 'enabled' : 'disabled'}`);

  if (options.checkExternal) {
    console.log(`External URLs checked:   ${report.externalUrlsChecked}`);
    console.log(`External URLs passed:    ${report.externalUrlsPassed}`);
    console.log(`External URLs failed:    ${report.externalUrlsFailed}`);
    console.log(`External URLs skipped:   ${report.externalUrlsSkipped}`);
    console.log(`External URL warnings:   ${report.externalUrlsWarnings}`);
  }

  console.log(`Errors:                  ${report.errors}`);
  console.log(`Warnings:                ${report.warnings}`);
  console.log(`Duration:                ${elapsedMs.toFixed(2)} ms`);

  if (report.issues.length > 0) {
    console.log('');
    console.log('Issues');
    console.log('-'.repeat(48));

    for (const issue of report.issues) {
      console.log(
        `[${issue.level.toUpperCase().padEnd(7)}] ${issue.code} -- ${issue.file}`,
      );

      if (issue.reference) {
        console.log(`         Reference: ${issue.reference}`);
      }

      console.log(`         ${issue.message}`);
    }
  }

  if (report.omittedIssues > 0) {
    console.log('');
    console.log(
      `${report.omittedIssues} additional issue(s) omitted from the report.`,
    );
  }

  console.log('');
  console.log('Final result');
  console.log('-'.repeat(48));

  if (failed) {
    console.error('FAILED: Link validation did not pass.');

    if (options.strict && report.warnings > 0) {
      console.error('Strict mode treats warnings as failures.');
    }
  } else {
    console.log('PASSED: No blocking link issues were found.');

    if (report.warnings > 0) {
      console.log('Warnings remain. Use --strict to fail on warnings.');
    }
  }

  console.log('');
  return output.exitCode;
}

async function main() {
  const startedAt = performance.now();
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }

  if (options.errors.length > 0) {
    for (const error of options.errors) {
      console.error(`ARGUMENT ERROR: ${error}`);
    }

    console.error('Run with --help to see supported options.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  try {
    options.root = fs.realpathSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot resolve "${options.root}": ${error.message}`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  if (!isDirectory(options.root)) {
    console.error(`ROOT ERROR: "${options.root}" is not a directory.`);
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  const candidates = options.site
    ? [path.resolve(options.root, options.site)]
    : [
        path.join(options.root, 'public'),
        path.join(options.root, 'dist'),
        options.root,
      ];

  options.siteRoot = null;

  for (const candidate of candidates) {
    if (!isDirectory(candidate)) {
      continue;
    }

    try {
      const realCandidate = fs.realpathSync(candidate);

      if (!isInside(options.root, realCandidate)) {
        console.error(
          `SITE ERROR: Website directory resolves outside the project root: ${candidate}`,
        );

        return EXIT_CODES.CONFIGURATION_ERROR;
      }

      options.siteRoot = realCandidate;
      break;
    } catch {
      // Try the next candidate.
    }
  }

  if (!options.siteRoot) {
    console.error(
      'SITE ERROR: No website directory was found. Use --site to specify one.',
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  const report = createReport(options);
  const htmlFiles = walkFiles(options.siteRoot, options, report);
  const documents = readHtmlFiles(htmlFiles, options, report);
  const htmlLookup = buildHtmlLookup(documents, options.siteRoot);

  for (const document of documents.values()) {
    extractHtmlMetadata(document, options, report);
  }

  for (const document of documents.values()) {
    for (const reference of document.references) {
      validateLocalReference(
        reference,
        document,
        documents,
        htmlLookup,
        options,
        report,
      );
    }
  }

  if (options.checkExternal) {
    await checkExternalReferences(options, report);
  }

  const elapsedMs = performance.now() - startedAt;

  return printReport(
    report,
    options,
    elapsedMs,
  );
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    console.error('FATAL ERROR: Unexpected link checker failure.');

    if (error instanceof Error) {
      console.error(error.stack || error.message);
    } else {
      console.error(String(error));
    }

    process.exitCode = EXIT_CODES.CONFIGURATION_ERROR;
  },
);
