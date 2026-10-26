#!/usr/bin/env node
'use strict';

/**
 * MedOrbits Page Builder & Link Integrator
 * File: scripts/build-pages.mjs
 * Node.js >= 20; no third-party dependencies.
 *
 * Safe defaults:
 * - Dry-run unless --apply is supplied.
 * - Only fills zero-byte or effectively empty HTML pages.
 * - Never overwrites completed HTML/CSS/JS files.
 * - Skips backend templates and generated/vendor directories.
 * - Creates shared CSS/JS only when those files do not already exist.
 * - Produces reports/page-builder-report.json.
 *
 * Usage:
 *   node scripts/build-pages.mjs
 *   node scripts/build-pages.mjs --apply
 *   node scripts/build-pages.mjs --apply --create-assets
 *   node scripts/build-pages.mjs --check
 *   node scripts/build-pages.mjs --root .
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const MAX_FILES = 20000;
const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.vercel', '.netlify', '__pycache__',
  'medorbits-local-agent', 'src', 'tests', 'test', 'docs',
  'reports', 'storage', 'uploads', 'tmp', 'temp',
]);
const SKIP_PREFIXES = ['src/templates/', 'medorbits-local-agent/'];
const BASE_CSS = 'assets/css/styles.css';
const CAREER_CSS = 'assets/css/career.css';
const BASE_JS = 'assets/js/main.js';
const GENERATED_CSS = 'assets/css/generated-pages.css';
const GENERATED_JS = 'assets/js/generated-pages.js';
const REPORT_PATH = 'reports/page-builder-report.json';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')
    ? argv[i + 1] : fallback;
};

function help() {
  console.log(`
MedOrbits Page Builder & Link Integrator

Options:
  --root <directory>   Repository root (default: parent of this script)
  --apply              Write changes; otherwise dry-run
  --create-assets      Create shared generated-page CSS/JS if missing
  --check              Scan blank pages and missing shared assets without writing
  --json               Print report as JSON
  --help               Show this help

Examples:
  node scripts/build-pages.mjs
  node scripts/build-pages.mjs --apply --create-assets
  node scripts/build-pages.mjs --root . --check
`);
}

function isWithin(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function rel(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function safeRead(file) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 3 * 1024 * 1024) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function writeNewFile(root, relativePath, content, changes) {
  const target = path.resolve(root, relativePath);
  if (!isWithin(root, target)) throw new Error(`Path escapes repository: ${relativePath}`);
  if (fs.existsSync(target)) {
    changes.push({ path: relativePath, action: 'preserved-existing' });
    return false;
  }
  if (!flag('--apply')) {
    changes.push({ path: relativePath, action: 'would-create' });
    return true;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o644);
    try { fs.writeFileSync(fd, content, 'utf8'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  changes.push({ path: relativePath, action: 'created' });
  return true;
}

function walk(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      if (!isWithin(root, target) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith('.medorbits-page-builder-')) stack.push(target);
      } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
        result.push(target);
        if (result.length > MAX_FILES) throw new Error(`More than ${MAX_FILES} HTML files; narrow the root.`);
      }
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function effectivelyBlank(html) {
  if (html == null) return true;
  const content = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype\s+html\s*>/gi, '')
    .replace(/<html\b[^>]*>|<\/html\s*>|<head\b[^>]*>[\s\S]*?<\/head\s*>|<body\b[^>]*>|<\/body\s*>/gi, '')
    .replace(/<meta\b[^>]*\/?>|<link\b[^>]*\/?>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<script\b(?![^>]*\bsrc\s*=)[^>]*>\s*<\/script\s*>|<style\b[^>]*>\s*<\/style\s*>/gi, '')
    .trim();
  return content.length === 0;
}

function words(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (x) => x.toUpperCase());
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function siteUrl(relativePath) {
  return '/' + relativePath.split(path.sep).join('/').replace(/^\/+/, '');
}

function inferDescription(title, relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower.startsWith('career/locations/')) {
    return `Explore career information, job-search resources and location-specific considerations for ${title}. Verify vacancies, eligibility and visa requirements with official sources.`;
  }
  if (lower.startsWith('career/sectors/')) {
    return `Explore ${title.toLowerCase()} career pathways, skills, preparation resources and related opportunities through MedOrbits. Verify employer and vacancy details before applying.`;
  }
  if (lower.startsWith('career/resources/')) {
    return `Use this MedOrbits career resource for practical guidance on ${title.toLowerCase()}. Check current requirements and official information before acting.`;
  }
  if (lower.startsWith('career/')) {
    return `Explore ${title.toLowerCase()} information, preparation resources and related career pathways with MedOrbits. Verify vacancies and employer details before applying.`;
  }
  if (lower.startsWith('education/')) {
    return `Explore ${title.toLowerCase()} information and related education resources with MedOrbits. Confirm admissions, eligibility, fees and deadlines with official institutions.`;
  }
  return `Explore ${title.toLowerCase()} information and related resources with MedOrbits. Verify official requirements and service details before making decisions.`;
}

function getExistingPageSet(root, allPages) {
  return new Set(allPages.map((p) => rel(root, p)));
}

function candidateLinks(root, current, allPages, existingSet) {
  const currentRel = rel(root, current);
  const parent = path.posix.dirname(currentRel);
  const currentName = path.posix.basename(currentRel);
  const siblings = allPages
    .map((p) => rel(root, p))
    .filter((p) => p !== currentRel && path.posix.dirname(p) === parent)
    .sort((a, b) => {
      const ai = path.posix.basename(a).toLowerCase() === 'index.html' ? -1 : 0;
      const bi = path.posix.basename(b).toLowerCase() === 'index.html' ? -1 : 0;
      return ai - bi || a.localeCompare(b);
    });

  const preferred = [];
  const parentIndex = parent === '.' ? null : `${parent}/index.html`;
  if (parentIndex && parentIndex !== currentRel && existingSet.has(parentIndex)) preferred.push(parentIndex);
  if (existingSet.has('index.html') && currentRel !== 'index.html') preferred.push('index.html');

  for (const item of siblings) {
    if (!preferred.includes(item)) preferred.push(item);
  }

  return [...new Set(preferred)].slice(0, 8).map((p) => ({
    path: p,
    title: words(path.posix.basename(p, path.posix.extname(p))),
    href: '/' + p,
  }));
}

function findOptionalPageScript(root, relativeHtml) {
  const base = path.posix.basename(relativeHtml, path.posix.extname(relativeHtml));
  const dir = path.posix.dirname(relativeHtml);
  const candidates = [
    `${dir}/${base}.js`,
    `assets/js/${base}.js`,
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(root, candidate)) &&
    fs.statSync(path.join(root, candidate)).isFile()) || null;
}

function renderPage(root, absolutePath, allPages, existingSet) {
  const relativePath = rel(root, absolutePath);
  const title = words(path.posix.basename(relativePath, path.posix.extname(relativePath)));
  const description = inferDescription(title, relativePath);
  const links = candidateLinks(root, absolutePath, allPages, existingSet);
  const isCareer = relativePath.startsWith('career/');
  const script = findOptionalPageScript(root, relativePath);
  const theme = isCareer ? '#21172b' : '#102c3a';

  const breadcrumbParts = relativePath.split('/').slice(0, -1);
  const breadcrumbs = [
    ...(existingSet.has('index.html') ? [{ title: 'Home', href: '/index.html' }] : []),
    ...breadcrumbParts.map((part, i) => {
      const candidate = breadcrumbParts.slice(0, i + 1).join('/') + '/index.html';
      return { title: words(part), href: '/' + candidate, path: candidate };
    }).filter((item) => existingSet.has(item.path)),
    { title, href: null },
  ];
  const breadcrumbHtml = breadcrumbs.map((item, i) =>
    item.href
      ? `<a href="${esc(item.href)}">${esc(item.title)}</a>`
      : `<span aria-current="page">${esc(item.title)}</span>`
  ).join('<span class="mo-breadcrumb-separator" aria-hidden="true">/</span>');

  const navCandidates = [
    ['Education', 'education/index.html'],
    ['Admissions', 'pages/admissions.html'],
    ['Careers', 'career/index.html'],
    ['Support', 'support/index.html'],
  ].filter(([, p]) => existingSet.has(p));

  const nav = navCandidates.map(([label, p]) =>
    `<a href="${siteUrl(p)}">${esc(label)}</a>`
  ).join('\n        ');

  const relatedHtml = links.length
    ? links.map((link) => `
        <article class="mo-related-card">
          <span class="mo-card-kicker">Related resource</span>
          <h3><a href="${esc(link.href)}">${esc(link.title)}</a></h3>
          <p>Continue exploring related MedOrbits information and resources.</p>
          <a class="mo-text-link" href="${esc(link.href)}">Explore page <span aria-hidden="true">→</span></a>
        </article>`).join('\n')
    : `<p class="mo-muted">Related pages will appear here as this section of the website grows.</p>`;

  const cssLinks = [
    `<link rel="stylesheet" href="${siteUrl(BASE_CSS)}">`,
    ...(isCareer ? [`<link rel="stylesheet" href="${siteUrl(CAREER_CSS)}">`] : []),
    `<link rel="stylesheet" href="${siteUrl(GENERATED_CSS)}">`,
  ].join('\n  ');

  const jsLinks = [
    fs.existsSync(path.join(root, BASE_JS)) ? `<script defer src="${siteUrl(BASE_JS)}"></script>` : '',
    `<script defer src="${siteUrl(GENERATED_JS)}"></script>`,
    script ? `<script defer src="${siteUrl(script)}"></script>` : '',
  ].filter(Boolean).join('\n  ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="${theme}">
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="MedOrbits">
  <meta name="robots" content="index,follow">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${esc(title)} | MedOrbits</title>
  <link rel="canonical" href="https://medorbits.in${siteUrl(relativePath)}">
  <link rel="icon" href="/assets/images/logo/medorbits-logo.svg" type="image/svg+xml">
  ${cssLinks}
  ${jsLinks}
</head>
<body class="mo-generated-page${isCareer ? ' mo-career-page' : ''}">
  <a class="mo-skip-link" href="#main">Skip to content</a>
  <header class="mo-site-header">
    <div class="mo-header-inner">
      <a class="mo-brand" href="/index.html" aria-label="MedOrbits home">
        <span class="mo-brand-mark" aria-hidden="true">M</span>
        <span><strong>MedOrbits</strong><small>Study · Work · Grow</small></span>
      </a>
      <button class="mo-menu-toggle" type="button" aria-expanded="false" aria-controls="mo-primary-nav">Menu</button>
      <nav class="mo-primary-nav" id="mo-primary-nav" aria-label="Primary navigation">
        ${nav}
      </nav>
    </div>
  </header>
  <main id="main" class="mo-page-shell">
    <nav class="mo-breadcrumbs" aria-label="Breadcrumb">${breadcrumbHtml}</nav>
    <section class="mo-hero">
      <p class="mo-eyebrow">MedOrbits · ${esc(isCareer ? 'Career & Opportunity' : relativePath.startsWith('education/') ? 'Education & Admissions' : 'Information & Resources')}</p>
      <h1>${esc(title)}</h1>
      <p class="mo-lead">${esc(description)}</p>
      <div class="mo-hero-actions">
        <a class="mo-button mo-button-primary" href="#overview">Explore this page</a>
        <a class="mo-button mo-button-secondary" href="/support/index.html">Contact support</a>
      </div>
    </section>
    <section id="overview" class="mo-content-section">
      <div class="mo-section-heading">
        <p class="mo-eyebrow">Overview</p>
        <h2>About ${esc(title)}</h2>
      </div>
      <div class="mo-content-panel">
        <p>This page is part of the MedOrbits information directory. Use it to explore relevant pathways, preparation resources and official information connected with ${esc(title.toLowerCase())}.</p>
        <p><strong>Verification note:</strong> Admission criteria, fees, job vacancies, salaries, visa rules, deadlines and eligibility can change. Confirm important details with the responsible institution, employer or official authority before making a decision.</p>
        <p class="mo-generated-note">This page was generated to restore an empty page in the repository. Review and replace this starter copy with verified, page-specific content before publishing.</p>
      </div>
    </section>
    <section class="mo-content-section" aria-labelledby="related-heading">
      <div class="mo-section-heading">
        <p class="mo-eyebrow">Keep exploring</p>
        <h2 id="related-heading">Related pages</h2>
        <p class="mo-muted">These links are discovered from pages that already exist in the repository.</p>
      </div>
      <div class="mo-related-grid">${relatedHtml}
      </div>
    </section>
    <section class="mo-contact-strip">
      <div><p class="mo-eyebrow">Need help?</p><h2>Talk to MedOrbits</h2><p>Contact the team for guidance about the information on this page.</p></div>
      <a class="mo-button mo-button-primary" href="/support/contact.html">Contact us</a>
    </section>
  </main>
  <footer class="mo-site-footer">
    <div class="mo-footer-inner">
      <a class="mo-brand" href="/index.html"><span class="mo-brand-mark" aria-hidden="true">M</span><span><strong>MedOrbits</strong><small>Study · Work · Grow</small></span></a>
      <nav aria-label="Footer navigation">
        <a href="/legal/privacy-policy.html">Privacy</a>
        <a href="/legal/terms.html">Terms</a>
        <a href="/support/index.html">Support</a>
      </nav>
      <p>© <span data-mo-current-year>2026</span> MedOrbits. Verify official requirements before making decisions.</p>
    </div>
  </footer>
</body>
</html>
`;
}

const GENERATED_CSS_CONTENT = `/*
 * MedOrbits generated page shell
 * Shared by pages restored by scripts/build-pages.mjs.
 * Do not put confidential data or inline executable content here.
 */
:root {
  --mo-gen-bg: #0d1722;
  --mo-gen-panel: #142433;
  --mo-gen-panel-soft: #192c3c;
  --mo-gen-text: #f0f5f8;
  --mo-gen-muted: #b6c4cf;
  --mo-gen-accent: #8ee1db;
  --mo-gen-gold: #e3c28e;
  --mo-gen-line: rgba(142, 225, 219, .22);
  --mo-gen-radius: 20px;
  --mo-gen-max: 1160px;
}
.mo-generated-page {
  min-height: 100vh;
  margin: 0;
  color: var(--mo-gen-text);
  background:
    radial-gradient(ellipse at 8% 0%, rgba(48, 103, 130, .22), transparent 38%),
    radial-gradient(ellipse at 95% 28%, rgba(142, 225, 219, .07), transparent 30%),
    linear-gradient(135deg, #08121d, var(--mo-gen-bg) 55%, #152737);
  font: 400 15px/1.75 "DM Sans", system-ui, -apple-system, sans-serif;
}
.mo-generated-page *, .mo-generated-page *::before, .mo-generated-page *::after { box-sizing: border-box; }
.mo-generated-page a { color: inherit; text-decoration: none; }
.mo-generated-page a:hover { color: var(--mo-gen-accent); }
.mo-generated-page :focus-visible { outline: 2px solid var(--mo-gen-accent); outline-offset: 4px; }
.mo-skip-link { position: fixed; z-index: 1000; top: -80px; left: 16px; padding: 10px 14px; color: #07121b !important; background: var(--mo-gen-accent); border-radius: 8px; }
.mo-skip-link:focus { top: 12px; }
.mo-site-header { position: sticky; z-index: 100; top: 0; border-bottom: 1px solid var(--mo-gen-line); background: rgba(7, 17, 27, .88); backdrop-filter: blur(18px); }
.mo-header-inner, .mo-footer-inner { width: min(var(--mo-gen-max), calc(100% - 36px)); margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.mo-header-inner { min-height: 76px; }
.mo-brand { display: inline-flex; align-items: center; gap: 11px; min-width: 0; }
.mo-brand-mark { display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid var(--mo-gen-gold); border-radius: 13px; color: var(--mo-gen-gold); font: 700 25px/1 Georgia, serif; background: linear-gradient(145deg, #20394a, #101e2b); }
.mo-brand strong, .mo-brand small { display: block; }
.mo-brand strong { font-size: 15px; letter-spacing: .03em; }
.mo-brand small { color: var(--mo-gen-muted); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
.mo-primary-nav, .mo-site-footer nav { display: flex; align-items: center; flex-wrap: wrap; gap: 18px; }
.mo-primary-nav a, .mo-site-footer nav a { color: var(--mo-gen-muted); font-size: 13px; }
.mo-menu-toggle { display: none; padding: 8px 12px; border: 1px solid var(--mo-gen-line); border-radius: 10px; color: var(--mo-gen-text); background: var(--mo-gen-panel); }
.mo-page-shell { width: min(var(--mo-gen-max), calc(100% - 36px)); margin: auto; padding: 26px 0 72px; }
.mo-breadcrumbs { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; color: var(--mo-gen-muted); font-size: 12px; margin: 0 0 24px; }
.mo-breadcrumbs [aria-current="page"] { color: var(--mo-gen-accent); }
.mo-breadcrumb-separator { opacity: .5; }
.mo-hero { position: relative; overflow: hidden; padding: clamp(28px, 6vw, 68px); border: 1px solid var(--mo-gen-line); border-radius: 28px; background: linear-gradient(135deg, rgba(23, 49, 67, .96), rgba(12, 27, 40, .96)); box-shadow: 0 24px 70px rgba(0, 0, 0, .18); }
.mo-hero::after { position: absolute; width: 260px; height: 260px; right: -100px; top: -110px; border: 1px solid rgba(227, 194, 142, .24); border-radius: 50%; box-shadow: 0 0 0 35px rgba(227, 194, 142, .025), 0 0 0 70px rgba(227, 194, 142, .02); content: ""; pointer-events: none; }
.mo-eyebrow { color: var(--mo-gen-accent); font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
.mo-hero h1 { max-width: 850px; margin: 12px 0; font: 600 clamp(2.3rem, 7vw, 4.7rem)/1.08 "Playfair Display", Georgia, serif; overflow-wrap: anywhere; }
.mo-lead { max-width: 760px; color: var(--mo-gen-muted); font-size: clamp(1rem, 2vw, 1.15rem); }
.mo-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.mo-button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 10px 17px; border: 1px solid var(--mo-gen-line); border-radius: 12px; font-weight: 700; transition: transform .2s ease, border-color .2s ease; }
.mo-button:hover { transform: translateY(-2px); }
.mo-button-primary { color: #07151e !important; background: linear-gradient(135deg, var(--mo-gen-accent), #b9f1df); border-color: transparent; }
.mo-button-secondary { color: var(--mo-gen-text); background: rgba(255, 255, 255, .025); }
.mo-content-section { margin-top: clamp(38px, 6vw, 70px); }
.mo-section-heading { margin-bottom: 20px; }
.mo-section-heading .mo-eyebrow { margin-bottom: 8px; }
.mo-section-heading h2, .mo-contact-strip h2 { margin: 0; font: 600 clamp(1.7rem, 4vw, 2.5rem)/1.2 "Playfair Display", Georgia, serif; }
.mo-muted { color: var(--mo-gen-muted); }
.mo-content-panel { padding: clamp(20px, 4vw, 34px); border: 1px solid var(--mo-gen-line); border-radius: var(--mo-gen-radius); background: rgba(19, 38, 53, .75); }
.mo-generated-note { padding: 12px 15px; border-left: 3px solid var(--mo-gen-gold); color: var(--mo-gen-muted); background: rgba(227, 194, 142, .055); font-size: 13px; }
.mo-related-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.mo-related-card { min-width: 0; display: flex; flex-direction: column; padding: 22px; border: 1px solid var(--mo-gen-line); border-radius: var(--mo-gen-radius); background: linear-gradient(145deg, rgba(24, 46, 62, .95), rgba(14, 29, 42, .95)); }
.mo-card-kicker { color: var(--mo-gen-gold); font-size: 10px; letter-spacing: .13em; text-transform: uppercase; }
.mo-related-card h3 { margin: 12px 0 8px; font-size: 1.15rem; line-height: 1.35; overflow-wrap: anywhere; }
.mo-related-card p { color: var(--mo-gen-muted); font-size: 13px; }
.mo-text-link { margin-top: auto; padding-top: 8px; color: var(--mo-gen-accent) !important; font-weight: 700; font-size: 13px; }
.mo-contact-strip { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 48px; padding: clamp(22px, 4vw, 36px); border: 1px solid rgba(227, 194, 142, .25); border-radius: var(--mo-gen-radius); background: linear-gradient(110deg, rgba(54, 44, 42, .48), rgba(20, 39, 52, .85)); }
.mo-contact-strip p { color: var(--mo-gen-muted); }
.mo-site-footer { border-top: 1px solid var(--mo-gen-line); background: rgba(4, 12, 20, .6); }
.mo-footer-inner { min-height: 120px; padding: 24px 0; flex-wrap: wrap; }
.mo-footer-inner > p { width: 100%; margin: 0; color: var(--mo-gen-muted); font-size: 12px; }
@media (max-width: 760px) {
  .mo-header-inner { min-height: 68px; }
  .mo-menu-toggle { display: inline-flex; }
  .mo-primary-nav { display: none; position: absolute; top: calc(100% + 1px); left: 0; right: 0; padding: 16px 22px 20px; border-bottom: 1px solid var(--mo-gen-line); background: #0a1723; }
  .mo-primary-nav.is-open { display: flex; align-items: stretch; flex-direction: column; gap: 12px; }
  .mo-related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mo-contact-strip { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 480px) {
  .mo-page-shell, .mo-header-inner, .mo-footer-inner { width: min(100% - 24px, var(--mo-gen-max)); }
  .mo-related-grid { grid-template-columns: minmax(0, 1fr); }
  .mo-hero { border-radius: 18px; }
}
@media (prefers-reduced-motion: reduce) { .mo-generated-page *, .mo-generated-page *::before, .mo-generated-page *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; } }
`;

const GENERATED_JS_CONTENT = `/* MedOrbits generated page interactions. No third-party dependencies. */
(() => {
  'use strict';
  const init = () => {
    const toggle = document.querySelector('.mo-menu-toggle');
    const nav = document.querySelector('#mo-primary-nav');
    if (toggle && nav && !toggle.dataset.moBound) {
      toggle.dataset.moBound = 'true';
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        nav.classList.toggle('is-open', open);
      });
      nav.addEventListener('click', (event) => {
        if (event.target.closest('a')) {
          toggle.setAttribute('aria-expanded', 'false');
          nav.classList.remove('is-open');
        }
      });
    }
    document.querySelectorAll('[data-mo-current-year]').forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
`;

function main() {
  if (flag('--help')) return help();
  const root = path.resolve(option('--root', DEFAULT_ROOT));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Invalid repository root: ${root}`);
  }

  const allPages = walk(root);
  const eligiblePages = allPages.filter((absolute) => {
    const p = rel(root, absolute);
    return !SKIP_PREFIXES.some((prefix) => p.startsWith(prefix));
  });
  const existingSet = new Set(eligiblePages.map((p) => rel(root, p)));
  const blankPages = [];
  const refreshPages = [];

  for (const absolute of eligiblePages) {
    const html = safeRead(absolute);
    if (effectivelyBlank(html)) {
      blankPages.push(absolute);
    } else if (flag('--refresh-generated') && html && html.includes('class="mo-generated-page')) {
      refreshPages.push(absolute);
    }
  }

  const changes = [];
  const issues = [];
  const targets = [
    ...blankPages.map((absolute) => ({ absolute, action: 'fill-empty-html' })),
    ...refreshPages.map((absolute) => ({ absolute, action: 'refresh-generated-html' })),
  ];
  for (const targetInfo of targets) {
    const absolute = targetInfo.absolute;
    const relative = rel(root, absolute);
    const content = renderPage(root, absolute, eligiblePages, existingSet);
    if (!flag('--apply')) {
      changes.push({ path: relative, action: `would-${targetInfo.action}` });
    } else {
      fs.writeFileSync(absolute, content, { encoding: 'utf8', flag: 'w' });
      changes.push({ path: relative, action: targetInfo.action });
    }
  }

  if (flag('--create-assets')) {
    writeNewFile(root, GENERATED_CSS, GENERATED_CSS_CONTENT, changes);
    writeNewFile(root, GENERATED_JS, GENERATED_JS_CONTENT, changes);
  } else {
    for (const asset of [GENERATED_CSS, GENERATED_JS]) {
      if (!fs.existsSync(path.join(root, asset))) {
        issues.push({ code: 'SHARED_ASSET_MISSING', path: asset, message: 'Run with --create-assets to create this shared asset.' });
      }
    }
  }

  const report = {
    tool: 'MedOrbits Page Builder & Link Integrator',
    version: '1.0.0',
    root,
    mode: flag('--apply') ? 'apply' : 'dry-run',
    scannedHtmlFiles: eligiblePages.length,
    blankHtmlFilesFound: blankPages.length,
    generatedPagesRefreshedOrEligible: refreshPages.length,
    changes,
    issues,
    safety: {
      completedHtmlOverwritten: false,
      filesDeleted: false,
      javascriptExecuted: false,
      remoteAssetsDownloaded: false,
    },
  };

  const reportAbs = path.join(root, REPORT_PATH);
  if (flag('--apply')) {
    fs.mkdirSync(path.dirname(reportAbs), { recursive: true });
    const temp = `${reportAbs}.tmp-${process.pid}`;
    fs.writeFileSync(temp, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temp, reportAbs);
  }

  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Scanned ${report.scannedHtmlFiles} HTML files.`);
    console.log(`Found ${report.blankHtmlFilesFound} empty HTML pages.`);
    console.log(`Mode: ${report.mode}.`);
    for (const change of changes) console.log(`${change.action}: ${change.path}`);
    for (const issue of issues) console.warn(`${issue.code}: ${issue.path} — ${issue.message}`);
    if (!flag('--apply')) {
      if (targets.length) console.log('No files changed. Re-run with --apply to apply the listed page changes.');
      else console.log('No eligible empty pages found. No files changed.');
    }
    if (flag('--apply')) console.log(`Report written to ${REPORT_PATH}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[build-pages] ${error.message}`);
  process.exitCode = 1;
}
