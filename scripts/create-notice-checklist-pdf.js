
#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(
  ROOT,
  'assets',
  'documents',
  'checklists',
  'general',
  'official-notice-verification-checklist.pdf',
);
const LOGO = path.join(ROOT, 'assets', 'images', 'logo', 'medorbits-logo.png');

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const OVERWRITE = process.argv.includes('--overwrite');

function color(hex) {
  const value = hex.replace('#', '');

  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function wrap(text, font, size, maxWidth) {
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

async function readLogo() {
  const stats = await fs.lstat(LOGO);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('Logo must be a regular PNG file.');
  }

  const bytes = await fs.readFile(LOGO);

  const pngSignature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  if (
    bytes.length < 8 ||
    !bytes.subarray(0, 8).equals(pngSignature)
  ) {
    throw new Error('MedOrbits logo is not a valid PNG file.');
  }

  return bytes;
}

async function ensureOutputDirectory() {
  const relative = path.relative(ROOT, path.dirname(OUTPUT));

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Output path must remain inside the repository.');
  }

  const parts = relative.split(path.sep).filter(Boolean);
  let current = ROOT;

  for (const part of parts) {
    current = path.join(current, part);

    try {
      const stats = await fs.lstat(current);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Unsafe output directory: ${current}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(current);
    }
  }
}

function drawWrapped(page, text, options) {
  const {
    x,
    y,
    maxWidth,
    font,
    size,
    lineHeight,
    color: textColor,
    maxLines = Infinity,
  } = options;

  const lines = wrap(text, font, size, maxWidth).slice(0, maxLines);

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: textColor,
    });
  });

  return y - lines.length * lineHeight;
}

async function buildPdf(logoBytes) {
  const pdf = await PDFDocument.create();

  pdf.setAuthor('MedOrbits');
  pdf.setTitle('Official Notice Verification Checklist');
  pdf.setSubject(
    'General checklist for checking education and career notices',
  );
  pdf.setKeywords([
    'MedOrbits',
    'notice verification',
    'checklist',
    'education',
    'career',
  ]);
  pdf.setCreator('MedOrbits PDF Resource Generator');

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(logoBytes);

  const burgundy = color('#711F36');
  const gold = color('#C9A96E');
  const pale = color('#F6F0E6');
  const ink = color('#342D2D');
  const muted = color('#6F6663');

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 18,
    width: PAGE_WIDTH,
    height: 18,
    color: burgundy,
  });

  const logoScale = Math.min(64 / logo.width, 64 / logo.height);

  page.drawImage(logo, {
    x: 48,
    y: 680 + (64 - logo.height * logoScale) / 2,
    width: logo.width * logoScale,
    height: logo.height * logoScale,
  });

  page.drawText('MEDORBITS', {
    x: 126,
    y: 716,
    size: 19,
    font: bold,
    color: burgundy,
  });

  page.drawText('STUDY  |  CAREER  |  CONSULTANCY', {
    x: 127,
    y: 698,
    size: 8,
    font: regular,
    color: muted,
  });

  page.drawRectangle({
    x: 48,
    y: 630,
    width: 516,
    height: 34,
    color: pale,
  });

  page.drawText('PUBLIC INFORMATION CHECKLIST', {
    x: 61,
    y: 642,
    size: 9,
    font: bold,
    color: burgundy,
  });

  page.drawText('Verify an official notice', {
    x: 48,
    y: 590,
    size: 25,
    font: bold,
    color: burgundy,
  });

  drawWrapped(
    page,
    'A practical check before acting on an admission, exam, result, or policy update.',
    {
      x: 48,
      y: 570,
      maxWidth: 516,
      font: regular,
      size: 10,
      lineHeight: 14,
      color: muted,
      maxLines: 2,
    },
  );

  const items = [
    'Open the issuing authority or institution website directly. Do not rely only on forwarded screenshots or social posts.',
    'Check the issuing organization, notice number, publication date, and the course, exam, intake, or group it applies to.',
    'Look for a newer correction, extension, withdrawal, or superseding notice on the same official channel.',
    'Confirm dates, time zone, eligibility, required documents, and next steps against the original notice.',
    'Use only the official portal for applications and payments. Keep copies of the notice and payment receipts.',
    'If any detail conflicts, pause and ask the issuing authority using contact details from its official website.',
  ];

  let y = 526;
  const textX = 104;
  const textWidth = 450;
  const itemFontSize = 10;
  const itemLineHeight = 13;
  const itemGap = 14;
  const minimumItemHeight = 42;
  const bottomContentLimit = 220;

  for (const [index, item] of items.entries()) {
    const lines = wrap(item, regular, itemFontSize, textWidth);
    const itemHeight = Math.max(
      minimumItemHeight,
      lines.length * itemLineHeight + itemGap,
    );

    if (y - itemHeight < bottomContentLimit) {
      throw new Error(
        'Checklist content exceeds the available page space. Reduce text or implement multi-page layout.',
      );
    }

    page.drawRectangle({
      x: 50,
      y: y - 2,
      width: 15,
      height: 15,
      borderColor: gold,
      borderWidth: 1.2,
    });

    page.drawText(String(index + 1).padStart(2, '0'), {
      x: 78,
      y,
      size: 9,
      font: bold,
      color: burgundy,
    });

    lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: textX,
        y: y - lineIndex * itemLineHeight,
        size: itemFontSize,
        font: regular,
        color: ink,
      });
    });

    y -= itemHeight;
  }

  page.drawRectangle({
    x: 48,
    y: 78,
    width: 516,
    height: 76,
    color: pale,
  });

  page.drawText('Need help finding the right source?', {
    x: 61,
    y: 135,
    size: 10,
    font: bold,
    color: burgundy,
  });

  page.drawText(
    'Use the official issuer contact details shown on its own website.',
    {
      x: 61,
      y: 118,
      size: 9,
      font: regular,
      color: ink,
    },
  );

  page.drawText(
    'support@medorbits.in  |  +91 62058 89064  |  +91 76449 87052',
    {
      x: 61,
      y: 100,
      size: 8,
      font: regular,
      color: muted,
    },
  );

  page.drawText('WhatsApp: wa.me/916205889064  |  wa.me/917644987052', {
    x: 61,
    y: 86,
    size: 8,
    font: regular,
    color: muted,
  });

  page.drawRectangle({
    x: 48,
    y: 58,
    width: 516,
    height: 2,
    color: gold,
  });

  page.drawText(
    'General information only. This checklist is not an official notice or a substitute for issuer instructions.',
    {
      x: 48,
      y: 40,
      size: 7,
      font: regular,
      color: muted,
    },
  );

  const bytes = await pdf.save({ useObjectStreams: false });

  // Confirm the generated document can be parsed before writing it.
  const verifiedPdf = await PDFDocument.load(bytes, {
    updateMetadata: false,
    throwOnInvalidObject: true,
  });

  if (verifiedPdf.getPageCount() !== 1) {
    throw new Error('Generated checklist PDF has an unexpected page count.');
  }

  return bytes;
}

async function writeOutput(bytes) {
  await ensureOutputDirectory();

  const temporary = path.join(
    path.dirname(OUTPUT),
    `.${path.basename(OUTPUT)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });

    if (OVERWRITE) {
      const stats = await fs.lstat(OUTPUT).catch((error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });

      if (stats && (stats.isSymbolicLink() || !stats.isFile())) {
        throw new Error('Existing output is not a regular file.');
      }

      await fs.rename(temporary, OUTPUT);
    } else {
      // Exclusive creation protects an existing output file.
      const handle = await fs.open(OUTPUT, 'wx');

      try {
        await handle.writeFile(await fs.readFile(temporary));
        await handle.sync();
      } finally {
        await handle.close();
      }

      await fs.unlink(temporary);
    }
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.some((arg) => arg !== '--overwrite')) {
    throw new Error(
      'Usage: node scripts/create-notice-checklist-pdf.js [--overwrite]',
    );
  }

  const logoBytes = await readLogo();
  const bytes = await buildPdf(logoBytes);

  await writeOutput(bytes);

  console.log(
    `Created ${path.relative(ROOT, OUTPUT)} (${bytes.length} bytes).`,
  );
}

main().catch((error) => {
  console.error(`[notice-checklist] ${error.message}`);
  process.exitCode = 1;
});
