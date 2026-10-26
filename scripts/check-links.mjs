#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Website Link Integrity Checker
 * File: /scripts/check-links.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Checks:
 * - HTML and HTM files
 * - Local assets and page references
 * - Same-page and cross-page fragments
 * - Duplicate IDs
 * - Root-relative and document-relative paths
 * - Optional external HTTP/HTTPS links
 *
 * Security:
 * - Does not execute website JavaScript.
 * - Does not follow filesystem symlinks.
 * - External requests are disabled by default.
 * - External requests reject obvious private/local destinations.
 * - Redirects are validated before following.
 *
 * Note:
 * External checking is intended for trusted website content.
 * For untrusted URLs, use network-level egress restrictions as well.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RETRIES = 1;
const MAX_ISSUES = 2000;
const MAX_HTML_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'MedOrbits-LinkChecker/2.0';
const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  'coverage', '__pycache__', '.cache', '.turbo',
  '.vercel', '.netlify',
]);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const EXIT = Object.freeze({
  OK: 0,
  FAILED: 1,
  CONFIG: 2,
});
function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    site: null,
    strict: false,
    includeHidden: false,
    external: false,
    timeout: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    exclude: new Set(),
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--include-hidden') options.includeHidden = true;
    else if (arg === '--check-external') options.external = true;
    else if (arg === '--json') options.json = true;
    else if (['--root', '--site', '--exclude', '--timeout',
      '--concurrency', '--retries'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      i += 1;
      if (arg === '--root') options.root = path.resolve(value);
      else if (arg === '--site') options.site = value;
      else if (arg === '--exclude') {
        if (value === '.' || value === '..' ||
            value.includes('/') || value.includes('\\')) {
          throw new Error('--exclude requires a directory name.');
        }
        options.exclude.add(value);
      } else {
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 0) {
          throw new Error(`${arg} requires a non-negative integer.`);
        }
        if (arg === '--timeout') {
          if (number === 0) throw new Error('--timeout must be positive.');
          options.timeout = number;
        } else if (arg === '--concurrency') {
          if (number < 1 || number > 50) {
            throw new Error('--concurrency must be between 1 and 50.');
          }
          options.concurrency = number;
        } else {
          if (number > 5) throw new Error('--retries must not exceed 5.');
          options.retries = number;
        }
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}
function help() {
  console.log(`
MedOrbits Link Integrity Checker
Usage:
  node scripts/check-links.mjs [options]
Options:
  --root <dir>           Project root
  --site <dir>           Website directory relative to root
  --exclude <name>       Exclude directory name (repeatable)
  --include-hidden       Include hidden paths
  --check-external       Check public HTTP/HTTPS links
  --timeout <ms>         Request timeout (default 8000)
  --concurrency <n>      Concurrent external requests (default 5)
  --retries <n>          Retry count (default 1; maximum 5)
  --strict               Treat warnings as failures
  --json                 JSON output
  --help, -h             Show help
`);
}
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel));
}
function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/') || '.';
}
function addIssue(report, level, code, file, reference, message) {
  report.totalIssues += 1;
  if (level === 'error') report.errors += 1;
  else report.warnings += 1;
  if (report.issues.length < MAX_ISSUES) {
    report.issues.push({
      level, code, file: file || '.',
      reference: reference || null, message,
    });
  } else {
    report.omittedIssues += 1;
  }
}
function safeFsMessage(error) {
  const messages = {
    EACCES: 'Permission denied',
    EPERM: 'Operation not permitted',
    ENOENT: 'File or directory no longer exists',
    ELOOP: 'Symbolic-link loop detected',
    EIO: 'Filesystem I/O error',
  };
  return messages[error?.code] || 'Filesystem operation failed';
}
function walkHtml(root, options, report) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    report.directoriesVisited += 1;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      addIssue(report, 'error', 'DIRECTORY_READ_FAILED',
        relative(options.root, dir), null, safeFsMessage(error));
      continue;
    }
    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        report.symlinksSkipped += 1;
        continue;
      }
      if (!options.includeHidden && entry.name.startsWith('.')) {
        report.pathsSkipped += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name) ||
            options.exclude.has(entry.name)) {
          report.pathsSkipped += 1;
          continue;
        }
        if (inside(options.siteRoot, target)) stack.push(target);
        continue;
      }
      if (entry.isFile() &&
          HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(target);
      }
    }
  }
  return files.sort();
}
function readHtml(file, options, report) {
  let stat;
  let fd;
  try {
    stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (stat.size > MAX_HTML_BYTES) {
      addIssue(report, 'error', 'HTML_FILE_TOO_LARGE',
        relative(options.root, file), null,
        'HTML file exceeds the 10 MiB limit.');
      return null;
    }
    fd = fs.openSync(file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const openedStat = fs.fstatSync(fd);
    if (!openedStat.isFile() || openedStat.size > MAX_HTML_BYTES) {
      addIssue(report, 'error', 'UNSAFE_HTML_FILE',
        relative(options.root, file), null,
        'File changed or exceeded the permitted size.');
      return null;
    }
    const chunks = [];
    const buffer = Buffer.alloc(64 * 1024);
    let total = 0;
    while (true) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      total += count;
      if (total > MAX_HTML_BYTES) {
        addIssue(report, 'error', 'HTML_FILE_TOO_LARGE',
          relative(options.root, file), null,
          'File grew beyond the 10 MiB limit while reading.');
        return null;
      }
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const finalStat = fs.fstatSync(fd);
    if (openedStat.size !== finalStat.size ||
        openedStat.mtimeMs !== finalStat.mtimeMs ||
        total !== finalStat.size) {
      addIssue(report, 'error', 'HTML_CHANGED_DURING_READ',
        relative(options.root, file), null,
        'File changed during scanning; rerun against stable files.');
      return null;
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    addIssue(report, 'error', 'HTML_READ_FAILED',
      relative(options.root, file), null, safeFsMessage(error));
    return null;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}
function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (whole, n) => {
      const number = Number(n);
      try { return String.fromCodePoint(number); } catch { return whole; }
    })
    .replace(/&#x([\da-f]+);/gi, (whole, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); }
      catch { return whole; }
    });
}
function attributes(tag) {
  const result = new Map();
  const content = tag.replace(/^<[^\s/>]+|\/?>$/g, '');
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    result.set(match[1].toLowerCase(),
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return result;
}
function extractDocument(file, html, options, report) {
  const doc = {
    path: file,
    relativePath: relative(options.siteRoot, file),
    ids: new Set(),
    refs: [],
  };
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  const tagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(text)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = attributes(match[0]);
    const id = attrs.get('id');
    if (id) {
      if (doc.ids.has(id)) {
        addIssue(report, 'warning', 'DUPLICATE_ID',
          relative(options.root, file), `#${id}`,
          `Duplicate id "${id}" in document.`);
      }
      doc.ids.add(id);
    }
    if (tagName === 'a' && attrs.get('name')) {
      doc.ids.add(attrs.get('name'));
    }
    for (const attr of [
      'href', 'src', 'poster', 'data-src', 'data-href',
      'action', 'formaction', 'cite', 'background', 'xlink:href',
    ]) {
      if (attrs.has(attr)) {
        doc.refs.push({ attribute: attr, value: attrs.get(attr) });
      }
    }
    if (tagName === 'meta') {
      const key = attrs.get('property') || attrs.get('name');
      if (key && /^(og:image|og:url|twitter:image)$/i.test(key) &&
          attrs.has('content')) {
        doc.refs.push({
          attribute: `meta:${key}`,
          value: attrs.get('content'),
        });
      }
    }
  }
  const cssUrl = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  while ((match = cssUrl.exec(text)) !== null) {
    const value = match[2].trim();
    if (value) doc.refs.push({ attribute: 'css:url', value });
  }
  return doc;
}
function externalUrl(value) {
  return /^(?:https?:)?\/\//i.test(value);
}
function ignoredUrl(value) {
  return value === '' ||
    /^(?:mailto:|tel:|sms:|data:|blob:|javascript:|about:|ftp:|file:)/i.test(value);
}
function dynamicUrl(value) {
  return /{{|}}|\$\{|<%|%>/.test(value);
}
function splitUrl(value) {
  const hash = value.indexOf('#');
  const beforeHash = hash >= 0 ? value.slice(0, hash) : value;
  const query = beforeHash.indexOf('?');
  return {
    pathname: query >= 0 ? beforeHash.slice(0, query) : beforeHash,
    fragment: hash >= 0 ? value.slice(hash + 1) : null,
  };
}
function localTarget(rawValue, sourceFile, options) {
  const { pathname, fragment } = splitUrl(rawValue.trim());
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch {}
  if (!decoded) return { target: sourceFile, fragment };
  // URL paths use "/" even on Windows.
  const target = decoded.startsWith('/')
    ? path.resolve(options.siteRoot, `.${decoded}`)
    : path.resolve(path.dirname(sourceFile), decoded);
  if (!inside(options.siteRoot, target)) {
    return { outside: true, target, fragment };
  }
  let resolved = target;
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      return { unsafe: true, target, fragment };
    }
    if (stat.isDirectory()) {
      const index = ['index.html', 'index.htm']
        .map((name) => path.join(target, name))
        .find((candidate) => {
          try {
            const s = fs.lstatSync(candidate);
            return s.isFile() && !s.isSymbolicLink();
          } catch { return false; }
        });
      if (index) resolved = index;
    }
  } catch {
    // The caller reports the missing path.
  }
  return { target: resolved, fragment };
}
function validateLocalReferences(documents, options, report) {
  const byPath = new Map(
    [...documents.values()].map((doc) => [path.resolve(doc.path), doc]),
  );
  for (const doc of documents.values()) {
    for (const ref of doc.refs) {
      const value = String(ref.value || '').trim();
      const source = relative(options.root, doc.path);
      if (!value || ignoredUrl(value)) continue;
      if (dynamicUrl(value)) {
        report.dynamicReferencesSkipped += 1;
        continue;
      }
      if (externalUrl(value)) {
        if (options.external) {
          report.externalReferences.push({
            value,
            file: source,
            attribute: ref.attribute,
          });
        }
        continue;
      }
      const result = localTarget(value, doc.path, options);
      if (result.outside) {
        addIssue(report, 'warning', 'REFERENCE_OUTSIDE_SITE',
          source, value,
          'Reference resolves outside the configured website directory.');
        continue;
      }
      if (result.unsafe) {
        addIssue(report, 'error', 'SYMLINK_TARGET_BLOCKED',
          source, value,
          'Local reference targets a symbolic link.');
        continue;
      }
      let targetStat;
      try {
        targetStat = fs.lstatSync(result.target);
      } catch {
        addIssue(report, 'error', 'BROKEN_LOCAL_REFERENCE',
          source, value,
          `Local target does not exist: ${relative(options.siteRoot, result.target)}`);
        continue;
      }
      if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
        addIssue(report, 'error', 'INVALID_LOCAL_TARGET',
          source, value, 'Target is not a regular file.');
        continue;
      }
      report.localReferencesChecked += 1;
      if (result.fragment !== null && result.fragment !== '') {
        let fragment = result.fragment;
        try { fragment = decodeURIComponent(fragment); } catch {}
        const targetDoc = byPath.get(path.resolve(result.target));
        if (targetDoc && !targetDoc.ids.has(fragment)) {
          addIssue(report, 'error', 'BROKEN_FRAGMENT',
            source, value,
            `Fragment "#${fragment}" was not found in ${relative(options.siteRoot, result.target)}.`);
        }
      }
    }
  }
}
function blockedIp(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224;
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === '::' || v === '::1' ||
      v.startsWith('fc') || v.startsWith('fd') ||
      /^fe[89ab]/i.test(v) || v.startsWith('ff') ||
      v.startsWith('::ffff:127.') ||
      v.startsWith('::ffff:10.') ||
      v.startsWith('::ffff:192.168.');
  }
  return true;
}
function blockedHostname(host) {
  const hostname = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return blockedIp(hostname);
  if (!hostname.includes('.') ||
      hostname === 'localhost' ||
      /\.(?:localhost|local|internal|test|invalid|example)$/i.test(hostname)) {
    return true;
  }
  return false;
}
async function validatePublicHost(url) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return 'Only HTTP and HTTPS URLs are supported.';
  }
  if (url.username || url.password) {
    return 'URLs containing credentials are not requested.';
  }
  if (blockedHostname(url.hostname)) {
    return 'Local or private hostname blocked.';
  }
  // Resolve and reject private destinations before connecting.
  // DNS can still change between this check and fetch; use network egress
  // restrictions for stronger SSRF protection.
  try {
    const addresses = isIP(url.hostname)
      ? [{ address: url.hostname }]
      : await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((item) => blockedIp(item.address))) {
      return 'Hostname resolves to a private or non-public IP address.';
    }
  } catch {
    return 'Hostname DNS resolution failed.';
  }
  return null;
}
async function externalRequest(rawUrl, options) {
  let current;
  try {
    current = new URL(rawUrl);
  } catch {
    return { status: 'warning', message: 'Malformed URL.' };
  }
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const blockReason = await validatePublicHost(current);
    if (blockReason) {
      return { status: 'skipped', message: blockReason };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);
    try {
      let response = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: '*/*',
        },
      });
      if ([403, 405, 501].includes(response.status)) {
        // Retry with a range request, then cancel its body.
        response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': USER_AGENT,
            accept: '*/*',
            range: 'bytes=0-0',
          },
        });
        if (response.body) await response.body.cancel();
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            status: 'warning',
            message: `HTTP ${response.status} redirect has no Location header.`,
          };
        }
        if (redirects === MAX_REDIRECTS) {
          return { status: 'warning', message: 'Redirect limit exceeded.' };
        }
        try {
          current = new URL(location, current);
        } catch {
          return { status: 'warning', message: 'Invalid redirect URL.' };
        }
        continue;
      }
      if (response.status >= 200 && response.status < 400) {
        return { status: 'ok', statusCode: response.status };
      }
      if ((response.status === 429 || response.status >= 500) &&
          redirects === 0) {
        return {
          status: 'warning',
          message: `Remote server returned HTTP ${response.status}.`,
        };
      }
      return {
        status: 'broken',
        message: `HTTP ${response.status}.`,
      };
    } catch (error) {
      return {
        status: 'warning',
        message: error.name === 'AbortError'
          ? `Request timed out after ${options.timeout} ms.`
          : 'External request failed.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { status: 'warning', message: 'Redirect limit exceeded.' };
}
async function checkExternal(options, report) {
  const unique = new Map();
  for (const ref of report.externalReferences) {
    try {
      const url = new URL(ref.value);
      url.hash = '';
      const key = url.href;
      if (!unique.has(key)) unique.set(key, []);
      unique.get(key).push(ref);
    } catch {
      addIssue(report, 'warning', 'EXTERNAL_URL_INVALID',
        ref.file, ref.value, 'Invalid external URL.');
    }
  }
  const items = [...unique.entries()];
  report.externalUrlsChecked = items.length;
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      const [url, refs] = item;
      const result = await externalRequest(url, options);
      if (result.status === 'ok') {
        report.externalUrlsPassed += 1;
      } else if (result.status === 'skipped') {
        report.externalUrlsSkipped += 1;
        addIssue(report, 'warning', 'EXTERNAL_URL_SKIPPED',
          refs[0].file, url, result.message);
      } else if (result.status === 'broken') {
        report.externalUrlsFailed += 1;
        for (const ref of refs) {
          addIssue(report, 'error', 'EXTERNAL_URL_FAILED',
            ref.file, ref.value, result.message);
        }
      } else {
        report.externalUrlsWarnings += 1;
        for (const ref of refs) {
          addIssue(report, 'warning', 'EXTERNAL_URL_UNVERIFIED',
            ref.file, ref.value, result.message);
        }
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, items.length) },
      () => worker(),
    ),
  );
}
function createReport(options) {
  return {
    root: options.root,
    siteRoot: options.siteRoot,
    strict: options.strict,
    externalCheckingEnabled: options.external,
    htmlFilesScanned: 0,
    directoriesVisited: 0,
    pathsSkipped: 0,
    symlinksSkipped: 0,
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
async function main() {
  const started = performance.now();
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`ARGUMENT ERROR: ${error.message}`);
    return EXIT.CONFIG;
  }
  if (options.help) {
    help();
    return EXIT.OK;
  }
  try {
    options.root = fs.realpathSync(options.root);
    if (!fs.statSync(options.root).isDirectory()) {
      throw new Error('Root is not a directory.');
    }
  } catch {
    console.error('CONFIGURATION ERROR: Project root is inaccessible.');
    return EXIT.CONFIG;
  }
  const candidates = options.site
    ? [path.resolve(options.root, options.site)]
    : [
        path.join(options.root, 'public'),
        path.join(options.root, 'dist'),
        options.root,
      ];
  for (const candidate of candidates) {
    try {
      if (!fs.statSync(candidate).isDirectory()) continue;
      const real = fs.realpathSync(candidate);
      if (!inside(options.root, real)) {
        throw new Error('Website root resolves outside project root.');
      }
      options.siteRoot = real;
      break;
    } catch (error) {
      if (options.site) {
        console.error(`SITE ERROR: ${error.message}`);
        return EXIT.CONFIG;
      }
    }
  }
  if (!options.siteRoot) {
    console.error('SITE ERROR: No website directory found. Use --site.');
    return EXIT.CONFIG;
  }
  const report = createReport(options);
  const files = walkHtml(options.siteRoot, options, report);
  const documents = new Map();
  for (const file of files) {
    const html = readHtml(file, options, report);
    if (html === null) continue;
    const doc = extractDocument(file, html, options, report);
    documents.set(file, doc);
    report.htmlFilesScanned += 1;
  }
  validateLocalReferences(documents, options, report);
  if (options.external) {
    await checkExternal(options, report);
  }
  const failed = report.errors > 0 ||
    (options.strict && report.warnings > 0);
  const output = {
    tool: 'MedOrbits Website Link Integrity Checker',
    version: 2,
    timestamp: new Date().toISOString(),
    durationMs: Number((performance.now() - started).toFixed(2)),
    ...report,
    externalReferences: undefined,
    result: failed ? 'failed' : 'passed',
    exitCode: failed ? EXIT.FAILED : EXIT.OK,
  };
  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\nMedOrbits Link Integrity Report');
    console.log('='.repeat(48));
    console.log(`Site: ${options.siteRoot}`);
    console.log(`HTML files scanned: ${report.htmlFilesScanned}`);
    console.log(`Local references checked: ${report.localReferencesChecked}`);
    console.log(`Dynamic references skipped: ${report.dynamicReferencesSkipped}`);
    console.log(`External checks: ${options.external ? 'enabled' : 'disabled'}`);
    if (options.external) {
      console.log(`External URLs checked: ${report.externalUrlsChecked}`);
      console.log(`External URLs passed: ${report.externalUrlsPassed}`);
      console.log(`External URLs failed: ${report.externalUrlsFailed}`);
      console.log(`External URLs skipped: ${report.externalUrlsSkipped}`);
      console.log(`External URL warnings: ${report.externalUrlsWarnings}`);
    }
    console.log(`Errors: ${report.errors}`);
    console.log(`Warnings: ${report.warnings}`);
    console.log(`Duration: ${output.durationMs} ms`);
    for (const issue of report.issues) {
      console.log(
        `[${issue.level.toUpperCase()}] ${issue.code} ${issue.file}` +
        `${issue.reference ? ` -> ${issue.reference}` : ''}: ${issue.message}`,
      );
    }
    if (report.omittedIssues) {
      console.log(`${report.omittedIssues} additional issues omitted.`);
    }
    console.log(`\nResult: ${output.result.toUpperCase()}`);
  }
  return output.exitCode;
}
main().then(
  (code) => { process.exitCode = code; },
  () => {
    console.error('FATAL ERROR: Link checker failed unexpectedly.');
    process.exitCode = EXIT.CONFIG;
  },
);