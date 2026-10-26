
#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..');
const PDF_ROOT = path.join(ROOT, 'assets', 'documents');
const LOGO_PATH = path.join(ROOT, 'assets', 'images', 'logo', 'medorbits-logo.png');
const BACKUP_ROOT = path.join(ROOT, 'storage', 'temporary', 'pdf-brand-backups');
const TEMP_ROOT = path.join(ROOT, 'storage', 'temporary', 'pdf-brand-output');
const BRAND_MARKER = 'MedOrbits-Branded-Cover-v1';
const MAX_PDF_BYTES = 100 * 1024 * 1024;

const CONTACT_LINES = [
  'support@medorbits.in',
  '+91 62058 89064  |  +91 76449 87052',
  'WhatsApp: wa.me/916205889064  |  wa.me/917644987052',
];

const PALETTES = {
  checklists: { primary: '#711F36', secondary: '#C9A96E', pale: '#F6F0E6' },
  'admission-guides': { primary: '#64233A', secondary: '#D5A85D', pale: '#F8F1E7' },
  'fee-guides': { primary: '#155B58', secondary: '#D8B86A', pale: '#EDF5F0' },
  'study-abroad': { primary: '#244F70', secondary: '#76B7C4', pale: '#EDF4F7' },
  'career-resources': { primary: '#315A42', secondary: '#C19A62', pale: '#F0F4ED' },
};

function color(hex) {
  const value = hex.replace('#', '');

  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function relativeToPdfRoot(filename) {
  const relative = path.relative(PDF_ROOT, filename);

  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`PDF path is outside the documents directory: ${filename}`);
  }

  return relative;
}

function titleFromFilename(filename) {
  return path.basename(filename, path.extname(filename))
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function categoryForFile(filename) {
  return relativeToPdfRoot(filename).split(path.sep)[0];
}

async function listPdfs(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const filename = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      files.push(...await listPdfs(filename));
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.pdf')
    ) {
      files.push(filename);
    }
  }

  return files.sort();
}

function wrapText(text, font, size, maxWidth) {
  const lines = [];
  let line = '';

  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function coverDescription(category) {
  const descriptions = {
    checklists:
      'A practical planning resource from MedOrbits. Use it to organize your next steps and confirm requirements with the relevant institution or authority.',
    'admission-guides':
      'An informational guide to support admission planning. Confirm current eligibility, documents, dates, and procedures with official sources.',
    'fee-guides':
      'A financial planning resource. Confirm current fees, payment schedules, refund terms, and funding conditions directly with the institution.',
    'study-abroad':
      'A planning guide for international study. Verify admission, immigration, insurance, and travel requirements with official sources.',
    'career-resources':
      'A career planning resource from MedOrbits. Tailor guidance to your experience and confirm role-specific requirements with employers.',
  };

  return descriptions[category] ||
    'An informational planning resource from MedOrbits. Independently confirm all current details with the relevant official source.';
}

async function assertRealFile(filename, label) {
  const stats = await fs.lstat(filename);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file: ${filename}`);
  }

  return stats;
}

async function readPdf(filename) {
  const stats = await assertRealFile(filename, 'PDF');

  if (stats.size <= 0 || stats.size > MAX_PDF_BYTES) {
    throw new Error(
      `PDF size must be between 1 byte and ${MAX_PDF_BYTES} bytes: ${filename}`,
    );
  }

  const bytes = await fs.readFile(filename);

  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error(`File does not have a valid PDF header: ${filename}`);
  }

  return bytes;
}

async function loadLogo() {
  await assertRealFile(LOGO_PATH, 'Logo');
  const bytes = await fs.readFile(LOGO_PATH);

  if (
    bytes.length < 8 ||
    !bytes.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  ) {
    throw new Error('MedOrbits logo must be a valid PNG file.');
  }

  return bytes;
}

async function ensureSafeDirectory(directory) {
  const relative = path.relative(ROOT, directory);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Output directory is outside the repository: ${directory}`);
  }

  const parts = relative.split(path.sep).filter(Boolean);
  let current = ROOT;

  for (const part of parts) {
    current = path.join(current, part);

    try {
      const stats = await fs.lstat(current);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Unsafe output directory component: ${current}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(current);
    }
  }
}

async function writeNewFile(filename, data) {
  await ensureSafeDirectory(path.dirname(filename));

  const handle = await fs.open(filename, 'wx', 0o600);

  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(filename, data) {
  const directory = path.dirname(filename);
  await ensureSafeDirectory(directory);

  const temporary = path.join(
    directory,
    `.${path.basename(filename)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  try {
    await writeNewFile(temporary, data);
    await fs.rename(temporary, filename);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function drawCover(pdf, logo, filename) {
  const category = categoryForFile(filename);
  const palette = PALETTES[category] || PALETTES.checklists;
  const primary = color(palette.primary);
  const secondary = color(palette.secondary);
  const pale = color(palette.pale);

  const regular = pdf.embedStandardFont(StandardFonts.Helvetica);
  const bold = pdf.embedStandardFont(StandardFonts.HelveticaBold);

  return {
    category,
    palette,
    primary,
    secondary,
    pale,
    regular,
    bold,
    logo,
  };
}

async function brandPdf(filename, logoBytes, options = {}) {
  const original = await readPdf(filename);
  const pdf = await PDFDocument.load(original, {
    updateMetadata: false,
    throwOnInvalidObject: true,
  });

  const keywords = pdf.getKeywords() || [];

  if (keywords.includes(BRAND_MARKER)) {
    return { status: 'already-branded', file: relativeToPdfRoot(filename) };
  }

  const relativePath = relativeToPdfRoot(filename);
  const backup = path.join(BACKUP_ROOT, relativePath);

  if (options.write !== true) {
    return { status: 'dry-run', file: relativePath };
  }

  const existingPages = pdf.getPageCount();
  if (existingPages < 1) {
    throw new Error(`PDF contains no pages: ${relativePath}`);
  }

  const logo = await pdf.embedPng(logoBytes);
  const design = drawCover(pdf, logo, filename);

  const page = pdf.insertPage(0, [595.28, 841.89]);
  const width = page.getWidth();
  const height = page.getHeight();

  page.drawRectangle({
    x: 0, y: 0, width, height, color: rgb(1, 1, 1),
  });

  page.drawRectangle({
    x: 0, y: height - 18, width, height: 18, color: design.primary,
  });

  page.drawRectangle({
    x: 44, y: 56, width: width - 88, height: 2, color: design.secondary,
  });

  const logoScale = Math.min(76 / logo.width, 76 / logo.height);
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;

  page.drawImage(logo, {
    x: 48,
    y: height - 143 + (76 - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight,
  });

  page.drawText('MEDORBITS', {
    x: 142,
    y: height - 104,
    size: 20,
    font: design.bold,
    color: design.primary,
  });

  page.drawText('STUDY  |  CAREER  |  CONSULTANCY', {
    x: 143,
    y: height - 124,
    size: 8,
    font: design.regular,
    color: color('#655A54'),
  });

  const categoryLabel = design.category.replace(/-/g, ' ').toUpperCase();

  page.drawRectangle({
    x: 48,
    y: height - 226,
    width: width - 96,
    height: 34,
    color: design.pale,
  });

  page.drawText(categoryLabel, {
    x: 62,
    y: height - 214,
    size: 9,
    font: design.bold,
    color: design.primary,
  });

  const title = pdf.getTitle() || titleFromFilename(filename);
  const titleLines = wrapText(title, design.bold, 27, width - 112).slice(0, 3);

  let titleY = height - 286;

  for (const line of titleLines) {
    page.drawText(line, {
      x: 50,
      y: titleY,
      size: 27,
      font: design.bold,
      color: design.primary,
    });

    titleY -= 36;
  }

  page.drawRectangle({
    x: 50,
    y: titleY - 8,
    width: 62,
    height: 3,
    color: design.secondary,
  });

  const descriptionLines = wrapText(
    coverDescription(design.category),
    design.regular,
    12,
    width - 112,
  ).slice(0, 5);

  let descriptionY = titleY - 42;

  for (const line of descriptionLines) {
    page.drawText(line, {
      x: 50,
      y: descriptionY,
      size: 12,
      font: design.regular,
      color: color('#403A3A'),
    });

    descriptionY -= 19;
  }

  page.drawRectangle({
    x: 48,
    y: 95,
    width: width - 96,
    height: 94,
    color: design.pale,
  });

  page.drawText('MEDORBITS RESOURCE', {
    x: 62,
    y: 167,
    size: 8,
    font: design.bold,
    color: design.primary,
  });

  page.drawText('Keep this guide with your planning notes.', {
    x: 62,
    y: 148,
    size: 10,
    font: design.regular,
    color: color('#403A3A'),
  });

  CONTACT_LINES.forEach((line, index) => {
    page.drawText(line, {
      x: 62,
      y: 129 - index * 13,
      size: 8,
      font: design.regular,
      color: color('#403A3A'),
    });
  });

  page.drawText(
    'Informational use only. Verify time-sensitive information with official sources.',
    {
      x: 50,
      y: 70,
      size: 8,
      font: design.regular,
      color: color('#655A54'),
    },
  );

  pdf.setAuthor('MedOrbits');
  pdf.setTitle(title);
  pdf.setSubject(
    pdf.getSubject() || 'MedOrbits informational planning resource',
  );
  pdf.setKeywords([
    ...new Set([
      ...keywords,
      BRAND_MARKER,
      design.category,
    ]),
  ]);

  const brandedBytes = await pdf.save({ useObjectStreams: false });

  // Validate the output before touching the source PDF.
  const verificationPdf = await PDFDocument.load(brandedBytes, {
    updateMetadata: false,
    throwOnInvalidObject: true,
  });

  if (
    verificationPdf.getPageCount() !== existingPages + 1 ||
    !(verificationPdf.getKeywords() || []).includes(BRAND_MARKER)
  ) {
    throw new Error(`Branded PDF verification failed: ${relativePath}`);
  }

  // Preserve an immutable original backup. Never overwrite an existing backup.
  await ensureSafeDirectory(path.dirname(backup));

  try {
    await writeNewFile(backup, original);
  } catch (error) {
    if (error.code === 'EEXIST') {
      const backupBytes = await fs.readFile(backup);

      if (!backupBytes.equals(original)) {
        throw new Error(
          `Existing backup differs from the source; refusing to overwrite: ${relativePath}`,
        );
      }
    } else {
      throw error;
    }
  }

  // Recheck the source immediately before replacement.
  const currentSource = await readPdf(filename);

  if (!currentSource.equals(original)) {
    throw new Error(
      `Source PDF changed during processing; refusing to replace: ${relativePath}`,
    );
  }

  await atomicReplace(filename, brandedBytes);

  return {
    status: 'branded',
    file: relativePath,
    pages: verificationPdf.getPageCount(),
    backup: relativeToPdfRoot(backup).replace(/^\.\.\//, ''),
  };
}

async function preflightPdfs(files) {
  const errors = [];
  let alreadyBranded = 0;

  for (const filename of files) {
    try {
      const bytes = await readPdf(filename);
      const pdf = await PDFDocument.load(bytes, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });

      if ((pdf.getKeywords() || []).includes(BRAND_MARKER)) {
        alreadyBranded += 1;
      }
    } catch (error) {
      errors.push(`${relativeToPdfRoot(filename)}: ${error.message}`);
    }
  }

  return { errors, alreadyBranded };
}

function parseArguments() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const dryRun = args.includes('--dry-run');
  const jsonOutput = args.includes('--json');
  const limitIndex = args.indexOf('--limit');

  if (write && dryRun) {
    throw new Error('Use either --write or --dry-run, not both.');
  }

  if (args.filter((arg) => arg === '--limit').length > 1) {
    throw new Error('--limit may only be specified once.');
  }

  if (limitIndex >= 0 && !args[limitIndex + 1]) {
    throw new Error('--limit requires a positive integer.');
  }

  const allowed = new Set(['--write', '--dry-run', '--json']);

  for (let i = 0; i < args.length; i += 1) {
    if (allowed.has(args[i])) continue;

    if (args[i] === '--limit') {
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${args[i]}`);
  }

  const limit = limitIndex >= 0
    ? Number(args[limitIndex + 1])
    : Infinity;

  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }

  return { write, jsonOutput, limit };
}

async function main() {
  const options = parseArguments();

  const rootStats = await fs.lstat(PDF_ROOT).catch(() => null);

  if (!rootStats || rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error('PDF documents directory is missing or unsafe.');
  }

  const allFiles = await listPdfs(PDF_ROOT);
  const files = allFiles.slice(0, options.limit);

  if (files.length === 0) {
    throw new Error('No PDF files found in assets/documents.');
  }

  const preflight = await preflightPdfs(files);

  if (preflight.errors.length > 0) {
    const result = {
      ok: false,
      total: files.length,
      alreadyBranded: preflight.alreadyBranded,
      errors: preflight.errors,
    };

    if (options.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const message of preflight.errors) {
        console.error(`Unreadable PDF: ${message}`);
      }

      console.error('Preflight failed; no PDFs were changed.');
    }

    process.exitCode = 1;
    return;
  }

  if (!options.write) {
    const result = {
      ok: true,
      mode: 'dry-run',
      total: files.length,
      alreadyBranded: preflight.alreadyBranded,
      files: files.map((file) => relativeToPdfRoot(file)),
    };

    if (options.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `Preflight passed: ${files.length} PDF(s); ` +
        `${preflight.alreadyBranded} already branded. No files changed.`,
      );

      console.log('Use --write to add branded cover pages and preserve original backups.');
    }

    return;
  }

  const logoBytes = await loadLogo();
  const results = [];
  const failures = [];

  for (const filename of files) {
    try {
      const result = await brandPdf(filename, logoBytes, { write: true });
      results.push(result);

      if (!options.jsonOutput) {
        console.log(`${result.status}: ${result.file}`);
      }
    } catch (error) {
      failures.push({
        file: relativeToPdfRoot(filename),
        message: error.message,
      });

      if (!options.jsonOutput) {
        console.error(`FAILED: ${relativeToPdfRoot(filename)}: ${error.message}`);
      }
    }
  }

  const summary = {
    ok: failures.length === 0,
    mode: 'write',
    total: files.length,
    branded: results.filter((item) => item.status === 'branded').length,
    alreadyBranded: results.filter((item) => item.status === 'already-branded').length,
    failed: failures.length,
    results,
    errors: failures,
  };

  if (options.jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `Completed: ${summary.branded} branded, ` +
      `${summary.alreadyBranded} already branded, ` +
      `${summary.failed} failed.`,
    );
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[brand-pdfs] ${error.message}`);
  process.exitCode = 1;
});
