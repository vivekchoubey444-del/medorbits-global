#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Branded PDF Generator
 * File: /scripts/brand-pdfs.js
 *
 * Purpose:
 *   Generate branded PDF documents using approved MedOrbits branding
 *   assets and a JSON manifest.
 *
 * Requirements:
 *   Node.js 20+
 *   npm install pdfkit
 *
 * Usage:
 *   node scripts/brand-pdfs.js --help
 *   node scripts/brand-pdfs.js --dry-run
 *   node scripts/brand-pdfs.js --json
 *   node scripts/brand-pdfs.js --manifest=assets/documents/brand-pdfs.json
 *   node scripts/brand-pdfs.js --output=storage/generated/brand-pdfs
 *
 * Default manifest:
 *   assets/documents/brand-pdfs.json
 *
 * Default output:
 *   storage/generated/brand-pdfs
 *
 * Security:
 *   - Restricts paths to the repository.
 *   - Rejects symbolic links in source and output paths.
 *   - Does not fetch remote images or documents.
 *   - Validates manifest structure and source files.
 *   - Uses generated output filenames.
 *   - Creates output files with restrictive permissions.
 *   - Does not modify source documents.
 *
 * IMPORTANT:
 *   Generated PDFs are drafts unless reviewed and approved.
 *   Do not use this script to reproduce protected third-party branding
 *   without permission.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const process = require('node:process');
const PDFDocument = require('pdfkit');
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = 'assets/documents/brand-pdfs.json';
const DEFAULT_OUTPUT = 'storage/generated/brand-pdfs';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENTS = 250;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 30_000;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BRAND = Object.freeze({
  name: 'MedOrbits',
  tagline: 'Education • Admissions • Career Guidance',
  primary: '#173D35',
  secondary: '#C6A66B',
  text: '#24332F',
  muted: '#64736E',
  background: '#F6F1E7',
});
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
function resolveRepoPath(input, label) {
  if (
    typeof input !== 'string' ||
    !input.trim() ||
    input.includes('\0')
  ) {
    throw new Error(`${label} must be a valid non-empty path.`);
  }
  const resolved = path.resolve(ROOT, input);
  if (!isInside(ROOT, resolved) || resolved === ROOT) {
    throw new Error(`${label} must remain inside the repository.`);
  }
  return resolved;
}
function assertNoSymlinks(target) {
  const relative = path.relative(ROOT, target);
  let current = ROOT;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are not allowed in document paths: ${path.relative(ROOT, current)}`
      );
    }
  }
}
function ensureDirectory(directory) {
  assertNoSymlinks(directory);
  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700,
  });
  assertNoSymlinks(directory);
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Output path must be a real directory.');
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
  }
}
function parseArguments(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    manifest: DEFAULT_MANIFEST,
    output: DEFAULT_OUTPUT,
  };
  const seen = new Set();
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--(manifest|output)=(.*)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const [, name, value] = match;
    if (seen.has(name)) {
      throw new Error(`Option --${name} was provided more than once.`);
    }
    seen.add(name);
    if (!value.trim()) {
      throw new Error(`Option --${name} cannot be empty.`);
    }
    options[name] = value;
  }
  return options;
}
function readJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('Manifest must be a regular file.');
  }
  if (stat.size > MAX_MANIFEST_BYTES) {
    throw new Error('Manifest exceeds the maximum permitted size.');
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('Manifest contains invalid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Manifest root must be an object.');
  }
  if (!Array.isArray(data.documents)) {
    throw new Error('Manifest must contain a documents array.');
  }
  if (data.documents.length > MAX_DOCUMENTS) {
    throw new Error(`Manifest cannot contain more than ${MAX_DOCUMENTS} documents.`);
  }
  return data;
}
function normalizeText(value, label, maxLength, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${label} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  const result = value.trim();
  if (required && !result) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (result.length > maxLength) {
    throw new Error(`${label} exceeds ${maxLength} characters.`);
  }
  return result;
}
function safeFilename(value) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'document';
}
function readSourceFile(file, maxBytes, label) {
  const resolved = resolveRepoPath(file, label);
  assertNoSymlinks(resolved);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`);
  }
  if (stat.size > maxBytes) {
    throw new Error(`${label} exceeds the permitted file size.`);
  }
  return {
    path: resolved,
    buffer: fs.readFileSync(resolved),
  };
}
function validateHexColor(value, fallback) {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^#[0-9a-fA-F]{6}$/.test(value)
  ) {
    throw new Error('Brand colors must be six-digit hexadecimal colors.');
  }
  return value;
}
function validateDocument(raw, index, manifestDirectory) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`documents[${index}] must be an object.`);
  }
  const title = normalizeText(
    raw.title,
    `documents[${index}].title`,
    MAX_TITLE_LENGTH,
    true
  );
  const description = normalizeText(
    raw.description,
    `documents[${index}].description`,
    MAX_TEXT_LENGTH
  );
  const sections = raw.sections === undefined ? [] : raw.sections;
  if (!Array.isArray(sections) || sections.length > 100) {
    throw new Error(`documents[${index}].sections must be an array of at most 100 sections.`);
  }
  const normalizedSections = sections.map((section, sectionIndex) => {
    if (
      !section ||
      typeof section !== 'object' ||
      Array.isArray(section)
    ) {
      throw new Error(
        `documents[${index}].sections[${sectionIndex}] must be an object.`
      );
    }
    return {
      heading: normalizeText(
        section.heading,
        `sections[${sectionIndex}].heading`,
        200
      ),
      body: normalizeText(
        section.body,
        `sections[${sectionIndex}].body`,
        MAX_TEXT_LENGTH
      ),
      bullets: validateBullets(section.bullets, sectionIndex),
    };
  });
  let logo = null;
  if (raw.logo) {
    const logoPath = path.resolve(manifestDirectory, raw.logo);
    if (!isInside(ROOT, logoPath)) {
      throw new Error('Logo path must remain inside the repository.');
    }
    logo = readSourceFile(
      path.relative(ROOT, logoPath),
      MAX_LOGO_BYTES,
      'Logo'
    );
    validateImageSignature(logo.buffer, 'Logo');
  }
  let coverImage = null;
  if (raw.coverImage) {
    const imagePath = path.resolve(manifestDirectory, raw.coverImage);
    if (!isInside(ROOT, imagePath)) {
      throw new Error('Cover image path must remain inside the repository.');
    }
    coverImage = readSourceFile(
      path.relative(ROOT, imagePath),
      MAX_IMAGE_BYTES,
      'Cover image'
    );
    validateImageSignature(coverImage.buffer, 'Cover image');
  }
  const colors = raw.colors || {};
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
    throw new Error(`documents[${index}].colors must be an object.`);
  }
  return {
    title,
    description,
    sections: normalizedSections,
    logo,
    coverImage,
    colors: {
      primary: validateHexColor(colors.primary, BRAND.primary),
      secondary: validateHexColor(colors.secondary, BRAND.secondary),
      text: validateHexColor(colors.text, BRAND.text),
      muted: validateHexColor(colors.muted, BRAND.muted),
      background: validateHexColor(colors.background, BRAND.background),
    },
    footer: normalizeText(raw.footer, 'footer', 300),
    filename: safeFilename(
      normalizeText(raw.filename || title, 'filename', 200)
    ),
  };
}
function validateBullets(value, sectionIndex) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error(
      `sections[${sectionIndex}].bullets must be an array of at most 100 items.`
    );
  }
  return value.map((item, index) =>
    normalizeText(
      item,
      `sections[${sectionIndex}].bullets[${index}]`,
      2000,
      true
    )
  );
}
function validateImageSignature(buffer, label) {
  const png =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const jpg = jpeg;
  if (!png && !jpg) {
    throw new Error(`${label} must be a valid PNG or JPEG image.`);
  }
}
function drawHeader(doc, item) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 18)
    .fill(item.colors.primary);
  doc.fillColor(item.colors.primary)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(BRAND.name, 48, 42, {
      width: 300,
      lineBreak: false,
    });
  doc.fillColor(item.colors.muted)
    .fontSize(9)
    .font('Helvetica')
    .text(BRAND.tagline, 48, 68, {
      width: 450,
    });
  doc.strokeColor(item.colors.secondary)
    .lineWidth(1.5)
    .moveTo(48, 94)
    .lineTo(doc.page.width - 48, 94)
    .stroke();
  if (item.logo) {
    try {
      doc.image(item.logo.buffer, doc.page.width - 128, 38, {
        fit: [80, 42],
        align: 'right',
        valign: 'center',
      });
    } catch {
      // The built-in wordmark remains available if the logo is unsupported.
    }
  }
  doc.restore();
}
function drawFooter(doc, item, pageNumber) {
  const footerY = doc.page.height - 48;
  doc.save();
  doc.strokeColor(item.colors.secondary)
    .lineWidth(0.8)
    .moveTo(48, footerY - 8)
    .lineTo(doc.page.width - 48, footerY - 8)
    .stroke();
  doc.fillColor(item.colors.muted)
    .fontSize(8)
    .font('Helvetica')
    .text(
      item.footer || `${BRAND.name} | Draft document -- review before distribution`,
      48,
      footerY,
      {
        width: doc.page.width - 130,
        ellipsis: true,
      }
    );
  doc.text(String(pageNumber), doc.page.width - 65, footerY, {
    width: 17,
    align: 'right',
  });
  doc.restore();
}
function drawCover(doc, item) {
  doc.rect(0, 0, doc.page.width, doc.page.height)
    .fill(item.colors.background);
  doc.rect(0, 0, doc.page.width, 20)
    .fill(item.colors.primary);
  if (item.coverImage) {
    try {
      doc.image(item.coverImage.buffer, 48, 80, {
        fit: [doc.page.width - 96, 180],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // Continue with a text-only cover if the image cannot be rendered.
    }
  }
  const top = item.coverImage ? 290 : 160;
  doc.fillColor(item.colors.primary)
    .font('Helvetica-Bold')
    .fontSize(28)
    .text(BRAND.name, 48, top, {
      width: doc.page.width - 96,
      align: 'left',
    });
  doc.fillColor(item.colors.secondary)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('OFFICIAL RESOURCE • DOCUMENT SERIES', 48, top + 43);
  doc.fillColor(item.colors.text)
    .font('Helvetica-Bold')
    .fontSize(25)
    .text(item.title, 48, top + 75, {
      width: doc.page.width - 96,
    });
  if (item.description) {
    doc.moveDown(1);
    doc.fillColor(item.colors.muted)
      .font('Helvetica')
      .fontSize(12)
      .text(item.description, 48, doc.y + 10, {
        width: doc.page.width - 96,
        lineGap: 4,
      });
  }
  doc.fillColor(item.colors.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(
      'Prepared for informational purposes. Verify requirements and dates against the relevant official authority.',
      48,
      doc.page.height - 105,
      {
        width: doc.page.width - 96,
        lineGap: 3,
      }
    );
}
function drawSections(doc, item) {
  let pageNumber = 1;
  doc.addPage();
  drawHeader(doc, item);
  doc.y = 120;
  const bottomLimit = doc.page.height - 75;
  const textWidth = doc.page.width - 96;
  function ensureSpace(height) {
    if (doc.y + height <= bottomLimit) return;
    drawFooter(doc, item, pageNumber);
    doc.addPage();
    pageNumber += 1;
    drawHeader(doc, item);
    doc.y = 120;
  }
  if (!item.sections.length && item.description) {
    ensureSpace(80);
    doc.fillColor(item.colors.text)
      .font('Helvetica')
      .fontSize(11)
      .text(item.description, 48, doc.y, {
        width: textWidth,
        lineGap: 4,
      });
  }
  for (const section of item.sections) {
    if (section.heading) {
      ensureSpace(60);
      doc.moveDown(0.6);
      doc.fillColor(item.colors.primary)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(section.heading, 48, doc.y, {
          width: textWidth,
        });
      doc.moveDown(0.4);
    }
    if (section.body) {
      const lines = Math.ceil(section.body.length / 90);
      ensureSpace(Math.min(600, Math.max(35, lines * 14)));
      doc.fillColor(item.colors.text)
        .font('Helvetica')
        .fontSize(10.5)
        .text(section.body, 48, doc.y, {
          width: textWidth,
          lineGap: 3,
        });
      doc.moveDown(0.5);
    }
    for (const bullet of section.bullets) {
      ensureSpace(50);
      doc.fillColor(item.colors.secondary)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('•', 50, doc.y, {
          width: 12,
        });
      doc.fillColor(item.colors.text)
        .font('Helvetica')
        .fontSize(10.5)
        .text(bullet, 68, doc.y, {
          width: textWidth - 20,
          lineGap: 3,
        });
      doc.moveDown(0.3);
    }
  }
  drawFooter(doc, item, pageNumber);
}
function generatePdf(item, outputPath) {
  return new Promise((resolve, reject) => {
    const temporaryPath = `${outputPath}.${process.pid}.${crypto
      .randomBytes(6)
      .toString('hex')}.tmp`;
    let settled = false;
    let stream;
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 48,
        bottom: 60,
        left: 48,
        right: 48,
      },
      bufferPages: false,
      autoFirstPage: true,
      info: {
        Title: item.title,
        Author: BRAND.name,
        Subject: 'MedOrbits branded document',
        Creator: 'MedOrbits PDF Generator',
      },
    });
    function finish(error) {
      if (settled) return;
      settled = true;
      if (error) {
        try {
          stream?.destroy();
        } catch {
          // Best-effort stream cleanup.
        }
        try {
          fs.unlinkSync(temporaryPath);
        } catch {
          // Temporary file may not exist.
        }
        reject(error);
        return;
      }
      try {
        const stat = fs.lstatSync(temporaryPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) {
          throw new Error('Generated PDF is empty or invalid.');
        }
        fs.chmodSync(temporaryPath, 0o600);
        if (fs.existsSync(outputPath)) {
          throw new Error(
            'Output already exists; refusing to overwrite an existing PDF.'
          );
        }
        fs.renameSync(temporaryPath, outputPath);
        resolve({
          filename: path.basename(outputPath),
          sizeBytes: fs.statSync(outputPath).size,
        });
      } catch (writeError) {
        try {
          fs.unlinkSync(temporaryPath);
        } catch {
          // Best-effort cleanup.
        }
        reject(writeError);
      }
    }
    try {
      stream = fs.createWriteStream(temporaryPath, {
        flags: 'wx',
        mode: 0o600,
      });
      stream.on('error', finish);
      doc.on('error', finish);
      stream.on('finish', () => finish(null));
      doc.pipe(stream);
      drawCover(doc, item);
      drawSections(doc, item);
      doc.end();
    } catch (error) {
      finish(error);
    }
  });
}
async function buildBrandPdfs({
  manifest = DEFAULT_MANIFEST,
  output = DEFAULT_OUTPUT,
  dryRun = false,
} = {}) {
  const manifestPath = resolveRepoPath(manifest, 'Manifest');
  const outputDirectory = resolveRepoPath(output, 'Output directory');
  assertNoSymlinks(manifestPath);
  assertNoSymlinks(path.dirname(manifestPath));
  const manifestData = readJson(manifestPath);
  const manifestDirectory = path.dirname(manifestPath);
  const validated = manifestData.documents.map((entry, index) =>
    validateDocument(entry, index, manifestDirectory)
  );
  const filenames = new Set();
  for (const item of validated) {
    if (filenames.has(item.filename)) {
      throw new Error(
        `Duplicate output filename "${item.filename}". Give each document a unique filename.`
      );
    }
    filenames.add(item.filename);
  }
  const plan = validated.map((item) => ({
    title: item.title,
    filename: `${item.filename}.pdf`,
    output: path.relative(
      ROOT,
      path.join(outputDirectory, `${item.filename}.pdf`)
    ).split(path.sep).join('/'),
  }));
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      count: plan.length,
      documents: plan,
    };
  }
  ensureDirectory(outputDirectory);
  const generated = [];
  for (const item of validated) {
    const outputPath = path.join(
      outputDirectory,
      `${item.filename}.pdf`
    );
    if (!isInside(outputDirectory, outputPath)) {
      throw new Error('Generated PDF path escaped the output directory.');
    }
    generated.push({
      title: item.title,
      output: path.relative(ROOT, outputPath).split(path.sep).join('/'),
      ...(await generatePdf(item, outputPath)),
    });
  }
  return {
    ok: true,
    dryRun: false,
    count: generated.length,
    documents: generated,
  };
}
async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[MedOrbits PDFs] ${errorMessage(error)}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(`MedOrbits Branded PDF Generator
Usage:
  node scripts/brand-pdfs.js [options]
Options:
  --manifest=PATH   JSON manifest path
  --output=PATH     Generated PDF output directory
  --dry-run         Validate without writing PDFs
  --json            Output JSON results
  --help            Show help
Default manifest: ${DEFAULT_MANIFEST}
Default output:   ${DEFAULT_OUTPUT}`);
    return;
  }
  try {
    const result = await buildBrandPdfs(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      ok: false,
      error: errorMessage(error),
    };
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
module.exports = {
  BRAND,
  buildBrandPdfs,
  isInside,
  safeFilename,
  validateDocument,
  validateImageSignature,
};