
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- HTML Validation CLI
 *
 * File: scripts/validate-html.mjs
 *
 * Purpose:
 * - Validate HTML documents throughout the MedOrbits project.
 * - Detect malformed or unclosed tags, duplicate IDs, missing attributes,
 *   invalid nesting patterns, and accessibility issues.
 * - Check local links, image sources, script sources, stylesheet references,
 *   and other local resource paths.
 * - Detect missing page metadata, empty links, unsafe target="_blank" links,
 *   and common SEO problems.
 * - Support recursive scanning, configurable exclusions, JSON reports,
 *   strict mode, and CI-friendly exit codes.
 *
 * Requirements:
 * - Node.js >= 20
 * - No third-party dependencies required.
 *
 * Usage:
 *   node scripts/validate-html.mjs
 *   node scripts/validate-html.mjs --root .
 *   node scripts/validate-html.mjs --dir .
 *   node scripts/validate-html.mjs --dir career
 *   node scripts/validate-html.mjs --file index.html
 *   node scripts/validate-html.mjs --strict
 *   node scripts/validate-html.mjs --check-links
 *   node scripts/validate-html.mjs --report-json reports/html-validation.json
 *   node scripts/validate-html.mjs --help
 *
 * Exit codes:
 *   0 = validation passed
 *   1 = validation errors found
 *   2 = invalid arguments or execution failure
 *
 * Notes:
 * - This is a dependency-free static checker, not a complete WHATWG HTML parser.
 * - It does not execute JavaScript or make network requests.
 * - For standards-level conformance checks, also use the W3C Nu HTML Checker.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SCRIPT_NAME = 'validate-html.mjs';

const DEFAULT_DIRS = [
  '.',
];

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vercel',
  '.netlify',
  'vendor',
];

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const RAW_TEXT_ELEMENTS = new Set([
  'script',
  'style',
  'textarea',
  'title',
]);

const OPTIONAL_END_TAGS = new Set([
  'html',
  'head',
  'body',
  'li',
  'dt',
  'dd',
  'p',
  'rt',
  'rp',
  'optgroup',
  'option',
  'colgroup',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
]);

const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'sms:',
  'blob:',
  'data:',
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    dirs: [],
    files: [],
    ignore: [...DEFAULT_IGNORE],
    recursive: true,
    strict: false,
    checkLinks: false,
    checkImages: true,
    checkScripts: true,
    checkStylesheets: true,
    checkAnchors: true,
    checkAccessibility: true,
    checkSeo: true,
    checkForms: true,
    checkSecurity: true,
    allowMissingMetadata: false,
    allowExternalResources: true,
    quiet: false,
    verbose: false,
    help: false,
    reportJson: null,
    maxDepth: 40,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    failOnWarning: false,
  };

  const valueOptions = new Set([
    '--root',
    '--dir',
    '--file',
    '--ignore',
    '--report-json',
    '--max-depth',
    '--max-file-size',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--no-recursive') {
      options.recursive = false;
      continue;
    }

    if (arg === '--check-links') {
      options.checkLinks = true;
      continue;
    }

    if (arg === '--no-images') {
      options.checkImages = false;
      continue;
    }

    if (arg === '--no-scripts') {
      options.checkScripts = false;
      continue;
    }

    if (arg === '--no-stylesheets') {
      options.checkStylesheets = false;
      continue;
    }

    if (arg === '--no-anchors') {
      options.checkAnchors = false;
      continue;
    }

    if (arg === '--no-accessibility') {
      options.checkAccessibility = false;
      continue;
    }

    if (arg === '--no-seo') {
      options.checkSeo = false;
      continue;
    }

    if (arg === '--no-forms') {
      options.checkForms = false;
      continue;
    }

    if (arg === '--no-security') {
      options.checkSecurity = false;
      continue;
    }

    if (arg === '--allow-missing-metadata') {
      options.allowMissingMetadata = true;
      continue;
    }

    if (arg === '--no-external-resources') {
      options.allowExternalResources = false;
      continue;
    }

    if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
      continue;
    }

    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      continue;
    }

    if (arg === '--fail-on-warning') {
      options.failOnWarning = true;
      continue;
    }

    if (valueOptions.has(arg)) {
      const value = argv[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }

      index += 1;

      if (arg === '--root') {
        options.root = path.resolve(value);
      } else if (arg === '--dir') {
        options.dirs.push(value);
      } else if (arg === '--file') {
        options.files.push(value);
      } else if (arg === '--ignore') {
        options.ignore.push(value);
      } else if (arg === '--report-json') {
        options.reportJson = value;
      } else if (arg === '--max-depth') {
        const number = Number(value);

        if (!Number.isInteger(number) || number < 1 || number > 200) {
          throw new Error('--max-depth must be an integer between 1 and 200.');
        }

        options.maxDepth = number;
      } else if (arg === '--max-file-size') {
        const number = Number(value);

        if (!Number.isInteger(number) || number < 1024) {
          throw new Error('--max-file-size must be an integer of at least 1024 bytes.');
        }

        options.maxFileSize = number;
      }

      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.dirs.length === 0 && options.files.length === 0) {
    options.dirs = [...DEFAULT_DIRS];
  }

  return options;
}

function printHelp() {
  console.log(`
${SCRIPT_NAME} -- MedOrbits HTML validation CLI

Usage:
  node scripts/validate-html.mjs [options]

Options:
  --root <path>             Project root (default: current directory)
  --dir <path>              Directory to scan; repeatable
  --file <path>             Validate a single HTML file; repeatable
  --ignore <pattern>        Ignore path substring; repeatable
  --no-recursive            Scan only the specified directory level
  --strict                  Treat warnings as failures
  --fail-on-warning         Exit 1 if any warnings are found
  --check-links             Check local links and fragment targets
  --no-images               Skip local image resource checks
  --no-scripts              Skip local script source checks
  --no-stylesheets          Skip local stylesheet checks
  --no-anchors              Skip fragment anchor checks
  --no-accessibility        Skip accessibility checks
  --no-seo                  Skip SEO metadata checks
  --no-forms                Skip form checks
  --no-security             Skip link security checks
  --allow-missing-metadata  Do not warn about missing title/description
  --no-external-resources   Warn about remote images/scripts/stylesheets
  --max-depth <number>      Maximum directory traversal depth
  --max-file-size <bytes>   Maximum HTML file size
  --report-json <path>      Write a JSON report
  --quiet, -q               Print errors and summary only
  --verbose, -v             Print every successfully validated file
  --help, -h                Show help

Examples:
  node scripts/validate-html.mjs
  node scripts/validate-html.mjs --dir career --check-links
  node scripts/validate-html.mjs --strict --report-json reports/html.json
  node scripts/validate-html.mjs --file index.html
`);
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function relativePath(root, target) {
  return normalizeSlashes(path.relative(root, target)) || '.';
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);

  return relative === ''
    || (
      relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
}

function matchesIgnore(relative, patterns) {
  const normalized = normalizeSlashes(relative);

  return patterns.some((rawPattern) => {
    const pattern = normalizeSlashes(rawPattern).replaceAll('\\', '/');

    if (normalized === pattern || normalized.includes(pattern)) {
      return true;
    }

    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('**', '.*')
      .replaceAll('*', '[^/]*')
      .replaceAll('?', '.');

    try {
      return new RegExp(`^${escaped}$`).test(normalized);
    } catch {
      return false;
    }
  });
}

function createReporter(options) {
  const results = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    root: options.root,
    filesScanned: 0,
    filesPassed: 0,
    filesFailed: 0,
    errors: [],
    warnings: [],
    infos: [],
  };

  function log(level, file, line, message, details = {}) {
    const item = {
      level,
      file: file || null,
      line: Number.isInteger(line) ? line : null,
      message,
      ...details,
    };

    if (level === 'error') {
      results.errors.push(item);
    } else if (level === 'warning') {
      results.warnings.push(item);
    } else {
      results.infos.push(item);
    }

    if (options.quiet && level !== 'error') {
      return;
    }

    const prefix = level.toUpperCase().padEnd(7);
    const location = file ? ` ${file}${line ? `:${line}` : ''}` : '';

    console.log(`${prefix}${location} -- ${message}`);
  }

  return {
    results,
    error: (file, line, message, details) => log('error', file, line, message, details),
    warning: (file, line, message, details) => log('warning', file, line, message, details),
    info: (file, line, message, details) => log('info', file, line, message, details),
  };
}

function collectHtmlFiles(startPath, options, reporter) {
  const absolute = path.resolve(options.root, startPath);
  const results = [];

  if (!isInside(options.root, absolute)) {
    reporter.error(relativePath(options.root, absolute), null, 'Path resolves outside the project root.');
    return results;
  }

  if (!fs.existsSync(absolute)) {
    reporter.warning(relativePath(options.root, absolute), null, 'Configured path does not exist; skipped.');
    return results;
  }

  let stat;

  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    reporter.error(relativePath(options.root, absolute), null, `Unable to inspect path: ${error.message}`);
    return results;
  }

  if (stat.isSymbolicLink()) {
    reporter.warning(relativePath(options.root, absolute), null, 'Symbolic link skipped for safety.');
    return results;
  }

  if (stat.isFile()) {
    if (path.extname(absolute).toLowerCase() === '.html' || path.extname(absolute).toLowerCase() === '.htm') {
      results.push(absolute);
    } else {
      reporter.warning(relativePath(options.root, absolute), null, 'Specified file is not an HTML document.');
    }

    return results;
  }

  if (!stat.isDirectory()) {
    reporter.warning(relativePath(options.root, absolute), null, 'Path is neither a file nor a directory.');
    return results;
  }

  function walk(directory, depth) {
    if (depth > options.maxDepth) {
      reporter.warning(relativePath(options.root, directory), null, `Maximum scan depth (${options.maxDepth}) reached.`);
      return;
    }

    let entries;

    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      reporter.error(relativePath(options.root, directory), null, `Unable to read directory: ${error.message}`);
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      const relative = relativePath(options.root, target);

      if (matchesIgnore(relative, options.ignore)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (options.recursive) {
          walk(target, depth + 1);
        }
        continue;
      }

      if (
        entry.isFile()
        && ['.html', '.htm'].includes(path.extname(entry.name).toLowerCase())
      ) {
        results.push(target);
      }
    }
  }

  walk(absolute, 0);

  return results;
}

function lineAt(source, index) {
  let line = 1;

  for (let cursor = 0; cursor < index && cursor < source.length; cursor += 1) {
    if (source[cursor] === '\n') {
      line += 1;
    }
  }

  return line;
}

function maskCommentsAndRawText(source) {
  let output = '';
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      const finish = end === -1 ? source.length : end + 3;
      const segment = source.slice(index, finish);

      output += segment.replace(/[^\r\n]/g, ' ');
      index = finish;
      continue;
    }

    const openTag = source.slice(index).match(/^<\s*(script|style|textarea|title)\b/i);

    if (openTag) {
      const tagName = openTag[1].toLowerCase();
      const openEnd = source.indexOf('>', index + openTag[0].length);
      const start = openEnd === -1 ? source.length : openEnd + 1;

      output += source.slice(index, start);

      if (openEnd === -1) {
        index = source.length;
        continue;
      }

      const closingPattern = new RegExp(`<\\/\\s*${tagName}\\s*>`, 'ig');
      closingPattern.lastIndex = start;
      const match = closingPattern.exec(source);

      if (!match) {
        output += source.slice(start).replace(/[^\r\n]/g, ' ');
        index = source.length;
        continue;
      }

      output += source.slice(start, match.index).replace(/[^\r\n]/g, ' ');
      output += match[0];
      index = match.index + match[0].length;
      continue;
    }

    output += source[index];
    index += 1;
  }

  return output;
}

function parseAttributes(rawAttributes, source, offset, file, reporter) {
  const attributes = new Map();
  const duplicateAttributes = [];
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;

  while ((match = pattern.exec(rawAttributes)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    const line = lineAt(source, offset + match.index);

    if (attributes.has(name)) {
      duplicateAttributes.push(name);
      reporter.error(file, line, `Duplicate attribute "${name}".`);
    } else {
      attributes.set(name, {
        value,
        line,
        hasValue: match[2] !== undefined || match[3] !== undefined || match[4] !== undefined,
      });
    }
  }

  return {
    attributes,
    duplicateAttributes,
  };
}

function parseTags(source, file, reporter) {
  const masked = maskCommentsAndRawText(source);
  const tags = [];
  const tagPattern = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)([\s\S]*?)>/g;

  let match;

  while ((match = tagPattern.exec(masked)) !== null) {
    const full = match[0];
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    const rawAttributes = match[3].replace(/\/\s*$/, '');
    const selfClosing = /\/\s*>$/.test(full);
    const start = match.index;
    const line = lineAt(source, start);

    if (closing) {
      tags.push({
        name,
        closing: true,
        selfClosing: false,
        start,
        end: tagPattern.lastIndex,
        line,
        attributes: new Map(),
      });
      continue;
    }

    const { attributes } = parseAttributes(
      rawAttributes,
      source,
      start + full.indexOf(rawAttributes),
      file,
      reporter,
    );

    tags.push({
      name,
      closing: false,
      selfClosing,
      start,
      end: tagPattern.lastIndex,
      line,
      attributes,
    });
  }

  return tags;
}

function attr(tag, name) {
  return tag.attributes.get(name.toLowerCase())?.value ?? null;
}

function hasAttr(tag, name) {
  return tag.attributes.has(name.toLowerCase());
}

function validateTagStructure(tags, file, reporter) {
  const stack = [];
  const voidClosingReported = new Set();

  for (const tag of tags) {
    if (tag.closing) {
      if (VOID_ELEMENTS.has(tag.name)) {
        const key = `${tag.name}:${tag.line}`;

        if (!voidClosingReported.has(key)) {
          reporter.error(file, tag.line, `Void element </${tag.name}> must not have a closing tag.`);
          voidClosingReported.add(key);
        }

        continue;
      }

      const top = stack[stack.length - 1];

      if (top?.name === tag.name) {
        stack.pop();
        continue;
      }

      const matchingIndex = stack.map((item) => item.name).lastIndexOf(tag.name);

      if (matchingIndex === -1) {
        if (!OPTIONAL_END_TAGS.has(tag.name)) {
          reporter.warning(file, tag.line, `Closing tag </${tag.name}> has no matching opening tag.`);
        }

        continue;
      }

      for (let index = stack.length - 1; index > matchingIndex; index -= 1) {
        const unclosed = stack[index];

        if (!OPTIONAL_END_TAGS.has(unclosed.name)) {
          reporter.warning(
            file,
            unclosed.line,
            `Element <${unclosed.name}> was not closed before </${tag.name}>.`,
          );
        }
      }

      stack.length = matchingIndex;
      continue;
    }

    if (VOID_ELEMENTS.has(tag.name) || tag.selfClosing) {
      continue;
    }

    const optionalParent = stack[stack.length - 1];

    if (tag.name === 'li' && optionalParent?.name === 'li') {
      stack.pop();
    } else if (tag.name === 'p' && optionalParent?.name === 'p') {
      stack.pop();
    } else if (
      ['dt', 'dd'].includes(tag.name)
      && ['dt', 'dd'].includes(optionalParent?.name)
    ) {
      stack.pop();
    } else if (
      ['td', 'th'].includes(tag.name)
      && ['td', 'th'].includes(optionalParent?.name)
    ) {
      stack.pop();
    } else if (tag.name === 'tr' && optionalParent?.name === 'tr') {
      stack.pop();
    } else if (
      ['option', 'optgroup'].includes(tag.name)
      && ['option', 'optgroup'].includes(optionalParent?.name)
    ) {
      stack.pop();
    }

    stack.push(tag);
  }

  for (const tag of stack) {
    if (!OPTIONAL_END_TAGS.has(tag.name)) {
      reporter.warning(file, tag.line, `Opening tag <${tag.name}> is not closed.`);
    }
  }
}

function getAttributeValue(tag, name) {
  return attr(tag, name);
}

function validateDocumentStructure(source, tags, file, reporter, options) {
  const openTags = tags.filter((tag) => !tag.closing);

  const htmlTags = openTags.filter((tag) => tag.name === 'html');
  const headTags = openTags.filter((tag) => tag.name === 'head');
  const bodyTags = openTags.filter((tag) => tag.name === 'body');
  const titleTags = openTags.filter((tag) => tag.name === 'title');

  if (htmlTags.length === 0) {
    reporter.warning(file, 1, 'Missing <html> root element.');
  } else if (htmlTags.length > 1) {
    reporter.error(file, htmlTags[1].line, 'Multiple <html> root elements found.');
  }

  if (headTags.length === 0) {
    reporter.warning(file, 1, 'Missing <head> element.');
  } else if (headTags.length > 1) {
    reporter.error(file, headTags[1].line, 'Multiple <head> elements found.');
  }

  if (bodyTags.length === 0) {
    reporter.warning(file, 1, 'Missing <body> element.');
  } else if (bodyTags.length > 1) {
    reporter.error(file, bodyTags[1].line, 'Multiple <body> elements found.');
  }

  if (!options.allowMissingMetadata) {
    if (titleTags.length === 0) {
      reporter.warning(file, 1, 'Missing <title> element.');
    } else if (titleTags.length > 1) {
      reporter.warning(file, titleTags[1].line, 'Multiple <title> elements found.');
    } else {
      const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
      const titleText = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() ?? '';

      if (!titleText) {
        reporter.warning(file, titleTags[0].line, 'Document title is empty.');
      } else if (titleText.length > 70 && options.strict) {
        reporter.warning(file, titleTags[0].line, `Document title is long (${titleText.length} characters).`);
      }
    }
  }

  const charsetTags = openTags.filter((tag) => {
    return tag.name === 'meta' && hasAttr(tag, 'charset');
  });

  const legacyCharsetTags = openTags.filter((tag) => {
    return tag.name === 'meta'
      && (attr(tag, 'http-equiv') || '').toLowerCase() === 'content-type';
  });

  if (charsetTags.length === 0 && legacyCharsetTags.length === 0) {
    reporter.warning(file, 1, 'Missing character encoding declaration (for example, <meta charset="utf-8">).');
  }

  const viewportTags = openTags.filter((tag) => {
    return tag.name === 'meta'
      && (attr(tag, 'name') || '').toLowerCase() === 'viewport';
  });

  if (viewportTags.length === 0) {
    reporter.warning(file, 1, 'Missing responsive viewport meta tag.');
  }

  if (!options.allowMissingMetadata && options.checkSeo) {
    const descriptions = openTags.filter((tag) => {
      return tag.name === 'meta'
        && (attr(tag, 'name') || '').toLowerCase() === 'description';
    });

    if (descriptions.length === 0) {
      reporter.warning(file, 1, 'Missing meta description.');
    } else if (descriptions.length > 1) {
      reporter.warning(file, descriptions[1].line, 'Multiple meta description tags found.');
    } else {
      const content = attr(descriptions[0], 'content') || '';

      if (!content.trim()) {
        reporter.warning(file, descriptions[0].line, 'Meta description is empty.');
      } else if (content.trim().length > 170 && options.strict) {
        reporter.warning(file, descriptions[0].line, 'Meta description is longer than 170 characters.');
      }
    }

    const canonicalTags = openTags.filter((tag) => {
      return tag.name === 'link'
        && (attr(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical');
    });

    if (canonicalTags.length > 1) {
      reporter.warning(file, canonicalTags[1].line, 'Multiple canonical links found.');
    }
  }
}

function validateIdsAndAnchors(tags, file, reporter, options) {
  const idLocations = new Map();
  const fragmentLinks = [];

  for (const tag of tags) {
    if (tag.closing) {
      continue;
    }

    const id = attr(tag, 'id');

    if (id !== null) {
      if (!id.trim()) {
        reporter.error(file, tag.line, `Element <${tag.name}> has an empty id attribute.`);
      } else if (idLocations.has(id)) {
        reporter.error(
          file,
          tag.line,
          `Duplicate id "${id}" (first defined on line ${idLocations.get(id)}).`,
        );
      } else {
        idLocations.set(id, tag.line);
      }
    }

    const name = attr(tag, 'name');

    if (tag.name === 'a' && name) {
      if (!idLocations.has(name)) {
        idLocations.set(name, tag.line);
      }
    }

    if (tag.name === 'a') {
      const href = attr(tag, 'href');

      if (href?.startsWith('#') && href.length > 1) {
        fragmentLinks.push({
          fragment: decodeURIComponentSafe(href.slice(1)),
          line: tag.line,
        });
      }
    }
  }

  if (options.checkAnchors) {
    for (const fragment of fragmentLinks) {
      if (!idLocations.has(fragment.fragment)) {
        reporter.warning(file, fragment.line, `Fragment link "#${fragment.fragment}" has no matching id/name in this document.`);
      }
    }
  }
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validateAccessibility(tags, source, file, reporter, options) {
  if (!options.checkAccessibility) {
    return;
  }

  const headings = [];
  let previousHeadingLevel = null;

  for (const tag of tags) {
    if (tag.closing) {
      continue;
    }

    if (/^h[1-6]$/.test(tag.name)) {
      const level = Number(tag.name.slice(1));
      headings.push({ level, line: tag.line });

      if (previousHeadingLevel !== null && level > previousHeadingLevel + 1 && options.strict) {
        reporter.warning(
          file,
          tag.line,
          `Heading hierarchy skips from h${previousHeadingLevel} to h${level}.`,
        );
      }

      previousHeadingLevel = level;
    }

    if (tag.name === 'img') {
      const alt = attr(tag, 'alt');

      if (alt === null) {
        reporter.error(file, tag.line, 'Image is missing an alt attribute.');
      } else if (!alt.trim() && !hasAttr(tag, 'role') && options.strict) {
        reporter.warning(file, tag.line, 'Image has empty alt text; confirm it is decorative.');
      }

      if (!attr(tag, 'src') && !attr(tag, 'srcset') && !attr(tag, 'data-src')) {
        reporter.warning(file, tag.line, 'Image has no src, srcset, or data-src attribute.');
      }
    }

    if (tag.name === 'iframe') {
      if (!attr(tag, 'title')?.trim()) {
        reporter.warning(file, tag.line, 'Iframe is missing a descriptive title.');
      }
    }

    if (tag.name === 'button') {
      const type = attr(tag, 'type');

      if (!type && options.strict) {
        reporter.warning(file, tag.line, 'Button has no explicit type attribute; inside a form it defaults to submit.');
      }
    }

    if (tag.name === 'input') {
      const type = (attr(tag, 'type') || 'text').toLowerCase();

      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
        continue;
      }

      const id = attr(tag, 'id');
      const hasAriaLabel = Boolean(attr(tag, 'aria-label')?.trim());
      const hasLabelledBy = Boolean(attr(tag, 'aria-labelledby')?.trim());
      const hasTitle = Boolean(attr(tag, 'title')?.trim());
      const hasPlaceholder = Boolean(attr(tag, 'placeholder')?.trim());

      if (!id && !hasAriaLabel && !hasLabelledBy && !hasTitle && !hasPlaceholder) {
        reporter.warning(file, tag.line, 'Form input has no id, accessible label, title, or placeholder.');
      }

      if (type === 'image' && !attr(tag, 'alt')?.trim()) {
        reporter.warning(file, tag.line, 'Image-type input is missing alt text.');
      }
    }

    if (tag.name === 'a') {
      const href = attr(tag, 'href');
      const ariaLabel = attr(tag, 'aria-label');
      const title = attr(tag, 'title');

      const hasLabel = Boolean(
        ariaLabel?.trim()
        || title?.trim()
        || attr(tag, 'aria-labelledby')?.trim(),
      );

      if (href === '' && options.strict) {
        reporter.warning(file, tag.line, 'Anchor has an empty href attribute.');
      }

      if (href && href.trim() === '#' && options.strict) {
        reporter.warning(file, tag.line, 'Anchor uses href="#" as a placeholder; use a button for actions.');
      }

      if (!hasLabel && !anchorHasText(source, tag)) {
        reporter.warning(file, tag.line, 'Anchor may have no accessible name.');
      }
    }

    if (tag.name === 'video' || tag.name === 'audio') {
      const hasCaptions = tags.some((child) => {
        return !child.closing
          && child.name === 'track'
          && attr(child, 'kind') === 'captions';
      });

      if (tag.name === 'video' && !hasCaptions && options.strict) {
        reporter.warning(file, tag.line, 'Video has no captions track detected.');
      }
    }
  }

  const h1s = headings.filter((heading) => heading.level === 1);

  if (h1s.length === 0) {
    reporter.warning(file, 1, 'No h1 heading found.');
  } else if (h1s.length > 1 && options.strict) {
    reporter.warning(file, h1s[1].line, 'Multiple h1 headings found; verify the page heading structure.');
  }
}

function anchorHasText(source, tag) {
  const afterOpen = source.slice(tag.end);
  const closingMatch = afterOpen.match(/^[\s\S]*?<\/\s*a\s*>/i);

  if (!closingMatch) {
    return false;
  }

  const content = closingMatch[0]
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos);/gi, ' ')
    .trim();

  return content.length > 0;
}

function validateForms(tags, file, reporter, options) {
  if (!options.checkForms) {
    return;
  }

  const forms = tags.filter((tag) => !tag.closing && tag.name === 'form');

  for (const form of forms) {
    const method = (attr(form, 'method') || 'get').toLowerCase();

    if (!['get', 'post', 'dialog'].includes(method)) {
      reporter.warning(file, form.line, `Form has an unusual method value "${method}".`);
    }

    if (method === 'post' && !attr(form, 'action') && options.strict) {
      reporter.warning(file, form.line, 'POST form has no explicit action attribute.');
    }
  }

  const controls = tags.filter((tag) => {
    return !tag.closing && ['input', 'select', 'textarea', 'button'].includes(tag.name);
  });

  for (const control of controls) {
    const type = (attr(control, 'type') || '').toLowerCase();

    if (control.name === 'input' && type === 'email') {
      const autocomplete = attr(control, 'autocomplete');

      if (!autocomplete && options.strict) {
        reporter.warning(file, control.line, 'Email input has no autocomplete attribute.');
      }
    }

    if (control.name === 'input' && type === 'password' && !attr(control, 'autocomplete') && options.strict) {
      reporter.warning(file, control.line, 'Password input should define an appropriate autocomplete value.');
    }

    if (hasAttr(control, 'required') && control.name !== 'button') {
      const ariaRequired = attr(control, 'aria-required');

      if (ariaRequired === 'false') {
        reporter.warning(file, control.line, 'Required form control conflicts with aria-required="false".');
      }
    }
  }
}

function validateSecurity(tags, file, reporter, options) {
  if (!options.checkSecurity) {
    return;
  }

  for (const tag of tags) {
    if (tag.closing || tag.name !== 'a') {
      continue;
    }

    const target = (attr(tag, 'target') || '').toLowerCase();
    const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean);

    if (target === '_blank' && !rel.includes('noopener')) {
      reporter.warning(file, tag.line, 'Link with target="_blank" should include rel="noopener".');
    }

    if (target === '_blank' && !rel.includes('noreferrer') && options.strict) {
      reporter.warning(file, tag.line, 'Consider rel="noreferrer" for external links opened in a new tab.');
    }

    const href = attr(tag, 'href');

    if (href && /^\s*javascript:/i.test(href)) {
      reporter.error(file, tag.line, 'javascript: URLs are not permitted in href attributes.');
    }

    if (href && /^\s*data:/i.test(href)) {
      reporter.warning(file, tag.line, 'Data URL used in href; verify that it is intentional.');
    }
  }

  for (const tag of tags) {
    if (tag.closing || !['script', 'iframe', 'form'].includes(tag.name)) {
      continue;
    }

    const url = tag.name === 'script'
      ? attr(tag, 'src')
      : tag.name === 'iframe'
        ? attr(tag, 'src')
        : attr(tag, 'action');

    if (url && /^\s*javascript:/i.test(url)) {
      reporter.error(file, tag.line, `${tag.name} contains a javascript: URL.`);
    }
  }
}

function validateResources(tags, file, reporter, options) {
  for (const tag of tags) {
    if (tag.closing) {
      continue;
    }

    const resources = [];

    if (options.checkImages && tag.name === 'img') {
      resources.push(['image', attr(tag, 'src')]);
      resources.push(['image srcset', attr(tag, 'srcset')]);
      resources.push(['image lazy source', attr(tag, 'data-src')]);
    }

    if (options.checkScripts && tag.name === 'script') {
      resources.push(['script', attr(tag, 'src')]);
    }

    if (options.checkStylesheets && tag.name === 'link') {
      const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/);

      if (rel.includes('stylesheet') || rel.includes('icon') || rel.includes('manifest') || rel.includes('preload')) {
        resources.push([`link resource (${rel.join(' ')})`, attr(tag, 'href')]);
      }
    }

    if (tag.name === 'source') {
      resources.push(['source', attr(tag, 'src')]);
      resources.push(['source srcset', attr(tag, 'srcset')]);
    }

    if (tag.name === 'video' || tag.name === 'audio' || tag.name === 'iframe') {
      resources.push([tag.name, attr(tag, 'src')]);
    }

    for (const [kind, rawValue] of resources) {
      if (!rawValue) {
        continue;
      }

      const values = kind.includes('srcset')
        ? parseSrcset(rawValue)
        : [rawValue.trim()];

      for (const value of values) {
        validateResourceValue(value, kind, tag, file, reporter, options);
      }
    }
  }
}

function parseSrcset(srcset) {
  return srcset
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function isExternalUrl(value) {
  return /^(?:https?:)?\/\//i.test(value);
}

function isDataOrBlobUrl(value) {
  return /^(?:data|blob):/i.test(value);
}

function validateResourceValue(value, kind, tag, file, reporter, options) {
  if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:')) {
    return;
  }

  if (isExternalUrl(value)) {
    if (!options.allowExternalResources) {
      reporter.warning(file, tag.line, `${kind} uses a remote URL: ${value}`);
    }

    return;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const url = new URL(value);

      if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        reporter.warning(file, tag.line, `${kind} uses an unusual protocol: ${url.protocol}`);
      }
    } catch {
      reporter.warning(file, tag.line, `${kind} has an invalid URL: ${value}`);
    }

    return;
  }

  if (value.startsWith('//')) {
    return;
  }

  if (value.includes('${') || value.includes('{{') || value.includes('<%')) {
    reporter.info(file, tag.line, `${kind} contains a template expression; path check skipped.`);
    return;
  }

  if (value.startsWith('/')) {
    // Root-relative paths are resolved against the configured project root.
    value = value.slice(1);
    checkLocalPath(value, kind, tag, file, reporter, options, options.root);
    return;
  }

  const baseDirectory = path.dirname(path.resolve(options.root, file));
  checkLocalPath(value, kind, tag, file, reporter, options, baseDirectory);
}

function checkLocalPath(value, kind, tag, file, reporter, options, baseDirectory) {
  const cleanValue = value.split(/[?#]/, 1)[0];

  if (!cleanValue) {
    return;
  }

  let decoded;

  try {
    decoded = decodeURIComponent(cleanValue);
  } catch {
    reporter.warning(file, tag.line, `${kind} path contains malformed percent-encoding: ${value}`);
    decoded = cleanValue;
  }

  const absoluteTarget = path.resolve(baseDirectory, decoded);

  if (!isInside(options.root, absoluteTarget)) {
    reporter.warning(file, tag.line, `${kind} resolves outside the project root: ${value}`);
    return;
  }

  if (!fs.existsSync(absoluteTarget)) {
    reporter.warning(file, tag.line, `Missing local ${kind} resource: ${value}`);
  }
}

function validateLinks(tags, source, file, reporter, options) {
  if (!options.checkLinks) {
    return;
  }

  for (const tag of tags) {
    if (tag.closing || tag.name !== 'a') {
      continue;
    }

    const href = attr(tag, 'href');

    if (href === null) {
      reporter.warning(file, tag.line, 'Anchor is missing href.');
      continue;
    }

    const value = href.trim();

    if (!value) {
      reporter.warning(file, tag.line, 'Anchor href is empty.');
      continue;
    }

    if (value.startsWith('#')) {
      continue;
    }

    if (isExternalUrl(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
      continue;
    }

    if (value.startsWith('javascript:')) {
      reporter.error(file, tag.line, 'Anchor uses a javascript: URL.');
      continue;
    }

    const [pathname, fragment] = value.split('#', 2);
    const cleanPath = pathname.split('?')[0];

    if (!cleanPath) {
      if (fragment) {
        const masked = maskCommentsAndRawText(source);
        const idRegex = new RegExp(`\\bid\\s*=\\s*(["'])${escapeRegex(fragment)}\\1`, 'i');

        if (!idRegex.test(masked)) {
          reporter.warning(file, tag.line, `Fragment "#${fragment}" does not match an id in this document.`);
        }
      }

      continue;
    }

    let targetPath;

    try {
      const decoded = decodeURIComponent(cleanPath);

      targetPath = cleanPath.startsWith('/')
        ? path.resolve(options.root, decoded.slice(1))
        : path.resolve(path.dirname(path.resolve(options.root, file)), decoded);
    } catch {
      reporter.warning(file, tag.line, `Cannot decode local link path: ${value}`);
      continue;
    }

    if (!isInside(options.root, targetPath)) {
      reporter.warning(file, tag.line, `Local link resolves outside the project root: ${value}`);
      continue;
    }

    if (!fs.existsSync(targetPath)) {
      reporter.warning(file, tag.line, `Broken local link: ${value}`);
      continue;
    }

    if (fragment && fs.statSync(targetPath).isFile() && ['.html', '.htm'].includes(path.extname(targetPath).toLowerCase())) {
      try {
        const targetSource = fs.readFileSync(targetPath, 'utf8');
        const masked = maskCommentsAndRawText(targetSource);
        const idRegex = new RegExp(`\\bid\\s*=\\s*(["'])${escapeRegex(decodeURIComponentSafe(fragment))}\\1`, 'i');

        if (!idRegex.test(masked)) {
          reporter.warning(file, tag.line, `Fragment "#${fragment}" was not found in ${relativePath(options.root, targetPath)}.`);
        }
      } catch (error) {
        reporter.warning(file, tag.line, `Unable to inspect fragment target: ${error.message}`);
      }
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateInlineMarkup(source, file, reporter) {
  const dangerousPatterns = [
    {
      pattern: /<\s*script\b[^>]*>\s*<\/\s*script\s*>/gi,
      message: 'Empty inline script block detected.',
    },
    {
      pattern: /<\s*style\b[^>]*>\s*<\/\s*style\s*>/gi,
      message: 'Empty inline style block detected.',
    },
    {
      pattern: /<\s*img\b(?![^>]*\b(?:src|srcset|data-src)\s*=)[^>]*>/gi,
      message: 'Image element has no source attribute.',
    },
    {
      pattern: /<\s*a\b(?![^>]*\bhref\s*=)[^>]*>/gi,
      message: 'Anchor element has no href attribute.',
    },
  ];

  for (const item of dangerousPatterns) {
    let match;

    while ((match = item.pattern.exec(source)) !== null) {
      reporter.warning(file, lineAt(source, match.index), item.message);
    }
  }

  const doctypeMatches = [...source.matchAll(/<!doctype\b/gi)];

  if (doctypeMatches.length === 0) {
    reporter.warning(file, 1, 'Missing <!doctype html> declaration.');
  } else if (doctypeMatches.length > 1) {
    reporter.error(file, lineAt(source, doctypeMatches[1].index), 'Multiple doctype declarations found.');
  } else if (!/<!doctype\s+html\s*>/i.test(source)) {
    reporter.warning(file, lineAt(source, doctypeMatches[0].index), 'Doctype should be <!doctype html>.');
  }
}

function validateFile(filePath, options, reporter) {
  const file = relativePath(options.root, filePath);
  reporter.results.filesScanned += 1;

  let stat;

  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    reporter.error(file, null, `Unable to inspect file: ${error.message}`);
    reporter.results.filesFailed += 1;
    return;
  }

  if (stat.size === 0) {
    reporter.error(file, 1, 'HTML file is empty.');
    reporter.results.filesFailed += 1;
    return;
  }

  if (stat.size > options.maxFileSize) {
    reporter.error(
      file,
      1,
      `HTML file exceeds the maximum size of ${options.maxFileSize} bytes (${stat.size} bytes).`,
    );
    reporter.results.filesFailed += 1;
    return;
  }

  let source;

  try {
    source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    reporter.error(file, null, `Unable to read file: ${error.message}`);
    reporter.results.filesFailed += 1;
    return;
  }

  const errorCountBefore = reporter.results.errors.length;

  if (source.includes('\u0000')) {
    reporter.error(file, 1, 'HTML file contains NUL characters.');
  }

  const tags = parseTags(source, file, reporter);

  validateTagStructure(tags, file, reporter);
  validateDocumentStructure(source, tags, file, reporter, options);
  validateIdsAndAnchors(tags, file, reporter, options);
  validateAccessibility(tags, source, file, reporter, options);
  validateForms(tags, file, reporter, options);
  validateSecurity(tags, file, reporter, options);
  validateResources(tags, file, reporter, options);
  validateLinks(tags, source, file, reporter, options);
  validateInlineMarkup(source, file, reporter);

  if (reporter.results.errors.length === errorCountBefore) {
    reporter.results.filesPassed += 1;

    if (options.verbose) {
      reporter.info(file, null, 'Validation completed without errors.');
    }
  } else {
    reporter.results.filesFailed += 1;
  }
}

function writeJsonReport(reportPath, options, reporter) {
  const absolute = path.resolve(options.root, reportPath);

  if (!isInside(options.root, absolute)) {
    reporter.error(relativePath(options.root, absolute), null, 'Report path must be inside the project root.');
    return;
  }

  try {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });

    const report = {
      ...reporter.results,
      finishedAt: new Date().toISOString(),
      options: {
        strict: options.strict,
        checkLinks: options.checkLinks,
        checkAccessibility: options.checkAccessibility,
        checkSeo: options.checkSeo,
      },
      summary: {
        filesScanned: reporter.results.filesScanned,
        filesPassed: reporter.results.filesPassed,
        filesFailed: reporter.results.filesFailed,
        errors: reporter.results.errors.length,
        warnings: reporter.results.warnings.length,
        infos: reporter.results.infos.length,
      },
    };

    const temporary = `${absolute}.${process.pid}.tmp`;

    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });

    fs.renameSync(temporary, absolute);

    if (!options.quiet) {
      console.log(`INFO    ${relativePath(options.root, absolute)} -- JSON report written.`);
    }
  } catch (error) {
    reporter.error(relativePath(options.root, absolute), null, `Unable to write JSON report: ${error.message}`);
  }
}

function printSummary(reporter, options) {
  const { results } = reporter;

  results.finishedAt = new Date().toISOString();

  if (options.quiet) {
    console.log(
      `HTML validation: ${results.filesPassed}/${results.filesScanned} passed; `
      + `${results.errors.length} error(s), ${results.warnings.length} warning(s).`,
    );
  } else {
    console.log('\nMedOrbits HTML validation summary');
    console.log('---------------------------------');
    console.log(`Files scanned : ${results.filesScanned}`);
    console.log(`Files passed  : ${results.filesPassed}`);
    console.log(`Files failed  : ${results.filesFailed}`);
    console.log(`Errors        : ${results.errors.length}`);
    console.log(`Warnings      : ${results.warnings.length}`);
  }

  const failed = results.errors.length > 0
    || ((options.strict || options.failOnWarning) && results.warnings.length > 0);

  console.log(`\nResult: ${failed ? 'FAILED' : 'PASSED'}`);
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    console.error('Use --help to see supported options.');
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(options.root) || !fs.statSync(options.root).isDirectory()) {
    console.error(`Project root is not a directory: ${options.root}`);
    process.exitCode = 2;
    return;
  }

  const reporter = createReporter(options);

  if (!options.quiet) {
    console.log(`MedOrbits HTML validation -- ${SCRIPT_NAME}`);
    console.log(`Project root: ${options.root}`);
  }

  const files = [];

  for (const directory of options.dirs) {
    files.push(...collectHtmlFiles(directory, options, reporter));
  }

  for (const file of options.files) {
    files.push(...collectHtmlFiles(file, options, reporter));
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (uniqueFiles.length === 0) {
    reporter.error(null, null, 'No HTML files were found. Check --root, --dir, or --file.');
    printSummary(reporter, options);

    if (options.reportJson) {
      writeJsonReport(options.reportJson, options, reporter);
    }

    process.exitCode = 1;
    return;
  }

  for (const file of uniqueFiles) {
    validateFile(file, options, reporter);
  }

  if (options.reportJson) {
    writeJsonReport(options.reportJson, options, reporter);
  }

  printSummary(reporter, options);

  const failed = reporter.results.errors.length > 0
    || ((options.strict || options.failOnWarning) && reporter.results.warnings.length > 0);

  process.exitCode = failed ? 1 : 0;
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch((error) => {
    console.error(`Fatal HTML validation error: ${error.stack || error.message || error}`);
    process.exitCode = 2;
  });
}

export {
  collectHtmlFiles,
  parseArgs,
  parseTags,
  validateFile,
  validateTagStructure,
};
