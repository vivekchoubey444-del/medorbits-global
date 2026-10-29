
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits HTML Validator
 * File: tools/validate-html.js
 *
 * Usage:
 *   node tools/validate-html.js
 *   node tools/validate-html.js pages
 *   node tools/validate-html.js index.html
 *
 * Checks:
 *   - HTML parsing errors
 *   - Missing local script, stylesheet, image and link targets
 *   - Duplicate IDs
 *
 * Install:
 *   npm install --save-dev parse5
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.next'
]);

const HTML_EXTENSIONS = new Set(['.html', '.htm']);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function collectHtmlFiles(target) {
  const stat = fs.statSync(target);

  if (stat.isFile()) {
    if (!HTML_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      throw new Error(`Not an HTML file: ${target}`);
    }
    return [target];
  }

  if (!stat.isDirectory()) return [];

  const files = [];

  for (const entry of fs.readdirSync(target, {
    withFileTypes: true
  })) {
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...collectHtmlFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&#([0-9]+);/g, (_, code) =>
      String.fromCodePoint(Number(code))
    );
}

function walk(node, callback) {
  callback(node);

  for (const child of node.childNodes || []) {
    walk(child, callback);
  }

  if (node.content) {
    walk(node.content, callback);
  }
}

function checkHtml(file, parse5) {
  const source = fs.readFileSync(file, 'utf8');
  const errors = [];
  const ids = new Set();
  const localReferences = [];

  const document = parse5.parse(source, {
    sourceCodeLocationInfo: true,
    onParseError(error) {
      errors.push(
        `HTML parse error at line ${error.startLine || '?'}: ${error.code}`
      );
    }
  });

  walk(document, (node) => {
    if (!node.tagName) return;

    const attrs = Object.fromEntries(
      (node.attrs || []).map((attr) => [
        attr.name.toLowerCase(),
        attr.value
      ])
    );

    if (attrs.id) {
      if (ids.has(attrs.id)) {
        errors.push(`Duplicate id="${attrs.id}"`);
      }
      ids.add(attrs.id);
    }

    const location = node.sourceCodeLocation;
    const line = location?.startLine || '?';

    const referenceAttributes = {
      script: ['src'],
      img: ['src', 'srcset'],
      source: ['src', 'srcset'],
      video: ['src', 'poster'],
      audio: ['src'],
      iframe: ['src'],
      embed: ['src'],
      track: ['src'],
      link: ['href'],
      a: ['href'],
      form: ['action']
    };

    for (const attrName of referenceAttributes[node.tagName] || []) {
      const value = attrs[attrName];

      if (!value || value.startsWith('#')) continue;

      if (
        /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|blob:|javascript:)/i.test(value)
      ) {
        continue;
      }

      if (attrName === 'srcset') {
        for (const candidate of value.split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (url) {
            localReferences.push({ url, line });
          }
        }
      } else {
        localReferences.push({ url: value, line });
      }
    }

    if (
      node.tagName === 'img' &&
      !Object.prototype.hasOwnProperty.call(attrs, 'alt')
    ) {
      errors.push(`Image missing alt attribute at line ${line}`);
    }
  });

  for (const reference of localReferences) {
    const raw = decodeEntities(reference.url).trim();

    if (!raw || raw.startsWith('#')) continue;

    let pathname;

    try {
      pathname = decodeURIComponent(raw.split(/[?#]/)[0]);
    } catch {
      errors.push(
        `Invalid URL encoding at line ${reference.line}: ${raw}`
      );
      continue;
    }

    if (!pathname) continue;

    // Ignore template placeholders that cannot be resolved statically.
    if (/[${}]/.test(pathname)) continue;

    const target = path.resolve(path.dirname(file), pathname);

    // Ignore absolute URLs and root-relative URLs that require server mapping.
    if (path.isAbsolute(raw) || raw.startsWith('/')) continue;

    if (!fs.existsSync(target)) {
      errors.push(
        `Missing local target at line ${reference.line}: ${raw}`
      );
    }
  }

  return errors;
}

async function main() {
  let parse5;

  try {
    parse5 = require('parse5');
  } catch {
    console.error('ERROR: parse5 is not installed.');
    console.error('Run: npm install --save-dev parse5');
    process.exitCode = 2;
    return;
  }

  const targets = process.argv.slice(2);
  const inputs = targets.length ? targets : [ROOT];
  const files = [];

  try {
    for (const input of inputs) {
      const target = path.resolve(ROOT, input);

      if (!fs.existsSync(target)) {
        throw new Error(`Path does not exist: ${input}`);
      }

      files.push(...collectHtmlFiles(target));
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (uniqueFiles.length === 0) {
    console.log('No HTML files found.');
    return;
  }

  let passed = 0;
  let failed = 0;

  console.log(`Checking ${uniqueFiles.length} HTML file(s)...`);

  for (const file of uniqueFiles) {
    const relative = path.relative(ROOT, file);

    try {
      const errors = checkHtml(file, parse5);

      if (errors.length > 0) {
        failed++;
        console.error(`\nFAIL ${relative}`);

        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      } else {
        passed++;
        console.log(`PASS ${relative}`);
      }
    } catch (error) {
      failed++;
      console.error(`\nFAIL ${relative}`);
      console.error(`  - ${error.message}`);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exitCode = 2;
});
