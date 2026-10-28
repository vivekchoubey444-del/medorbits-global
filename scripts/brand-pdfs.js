#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- PDF Branding Utility
 *
 * File: scripts/brand-pdfs.js
 *
 * Purpose:
 *   - Discover PDF files recursively.
 *   - Add consistent MedOrbits document metadata.
 *   - Preserve original PDF files.
 *   - Write processed PDFs to a separate output directory.
 *   - Support dry-run and JSON reporting.
 *   - Reject symlinked input files and unsafe output paths.
 *
 * Requirements:
 *   - Node.js 20+
 *   - pdf-lib
 *
 * Usage:
 *   node scripts/brand-pdfs.js --help
 *   node scripts/brand-pdfs.js --dry-run
 *   node scripts/brand-pdfs.js
 *   node scripts/brand-pdfs.js --json
 *   node scripts/brand-pdfs.js --input=documents/pdfs
 *   node scripts/brand-pdfs.js --output=storage/branded-pdfs
 *
 * Environment:
 *   PDF_INPUT_DIR   Default: documents/pdfs
 *   PDF_OUTPUT_DIR  Default: storage/branded-pdfs
 *   PDF_AUTHOR      Default: MedOrbits
 *   PDF_SUBJECT     Default: Official MedOrbits document
 *
 * Important:
 *   This script updates PDF metadata. It does not insert a visual logo,
 *   watermark, header, footer, or modify page content.
 *   Digital signatures may become invalid when a PDF is modified.
 */

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const { PDFDocument } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..');

const DEFAULT_INPUT_DIR =
  process.env.PDF_INPUT_DIR || 'documents/pdfs';

const DEFAULT_OUTPUT_DIR =
  process.env.PDF_OUTPUT_DIR || 'storage/branded-pdfs';

const DEFAULT_AUTHOR =
  process.env.PDF_AUTHOR || 'MedOrbits';

const DEFAULT_SUBJECT =
  process.env.PDF_SUBJECT || 'Official MedOrbits document';

const MAX_PDF_SIZE_BYTES = 250 * 1024 * 1024;

const errors = [];
const warnings = [];
const processed = [];
const skipped = [];

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function parseArguments(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    input: DEFAULT_INPUT_DIR,
    output: DEFAULT_OUTPUT_DIR,
    overwrite: false,
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

    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    const match = arg.match(/^--(input|output)=(.*)$/);

    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [, key, value] = match;

    if (seen.has(key)) {
      throw new Error(`Option --${key} was provided more than once.`);
    }

    seen.add(key);

    if (!value.trim()) {
      throw new Error(`Option --${key} cannot be empty.`);
    }

    options[key] = value;
  }

  return options;
}

function resolveRepositoryPath(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is invalid.`);
  }

  const resolved = path.resolve(ROOT, value);

  if (!isInside(ROOT, resolved) || resolved === ROOT) {
    throw new Error(
      `${label} must be a subdirectory inside the repository.`
    );
  }

  return resolved;
}

function assertNoSymlinkPath(target) {
  if (!isInside(ROOT, target)) {
    throw new Error('Path escapes the repository root.');
  }

  const relative = path.relative(ROOT, target);
  const components = relative.split(path.sep).filter(Boolean);

  let current = ROOT;

  for (const component of components) {
    current = path.join(current, component);

    let stat;

    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic link is not permitted: ${path.relative(ROOT, current)}`
      );
    }
  }
}

function discoverPdfs(directory, outputDirectory) {
  const results = [];

  function walk(currentDirectory) {
    let entries;

    try {
      entries = fs.readdirSync(currentDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      errors.push({
        file: path.relative(ROOT, currentDirectory),
        message: `Cannot read directory: ${messageOf(error)}`,
      });

      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        warnings.push({
          file: path.relative(ROOT, fullPath),
          message: 'Symbolic link skipped.',
        });

        continue;
      }

      if (isInside(outputDirectory, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        path.extname(entry.name).toLowerCase() === '.pdf'
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(directory);

  return results;
}

function createOutputPath(inputFile, inputDirectory, outputDirectory) {
  const relative = path.relative(inputDirectory, inputFile);

  if (!isInside(inputDirectory, inputFile)) {
    throw new Error('Input file is outside the input directory.');
  }

  const outputFile = path.resolve(outputDirectory, relative);

  if (!isInside(outputDirectory, outputFile)) {
    throw new Error('Output file escapes the output directory.');
  }

  return outputFile;
}

function ensureOutputDirectory(directory) {
  assertNoSymlinkPath(directory);

  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700,
  });

  assertNoSymlinkPath(directory);

  const stat = fs.lstatSync(directory);

  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Output path must be a real directory.');
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
  }
}

async function brandPdf(inputFile, outputFile, options) {
  const inputStat = fs.lstatSync(inputFile);

  if (inputStat.isSymbolicLink() || !inputStat.isFile()) {
    throw new Error('Input must be a regular, non-symlink file.');
  }

  if (inputStat.size === 0) {
    throw new Error('PDF file is empty.');
  }

  if (inputStat.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `PDF exceeds the ${MAX_PDF_SIZE_BYTES}-byte size limit.`
    );
  }

  if (fs.existsSync(outputFile) && !options.overwrite) {
    throw new Error(
      'Output already exists. Use --overwrite to replace it.'
    );
  }

  const inputBytes = fs.readFileSync(inputFile);

  let pdf;

  try {
    pdf = await PDFDocument.load(inputBytes, {
      updateMetadata: false,
    });
  } catch {
    throw new Error(
      'Unable to parse PDF. It may be corrupt, encrypted, or unsupported.'
    );
  }

  pdf.setTitle(path.basename(inputFile, path.extname(inputFile)));
  pdf.setAuthor(DEFAULT_AUTHOR);
  pdf.setSubject(DEFAULT_SUBJECT);
  pdf.setCreator('MedOrbits PDF Branding Utility');
  pdf.setProducer('MedOrbits');
  pdf.setKeywords([
    'MedOrbits',
    'document',
    'branded-pdf',
  ]);

  const outputBytes = await pdf.save({
    useObjectStreams: true,
  });

  const outputDirectory = path.dirname(outputFile);

  fs.mkdirSync(outputDirectory, {
    recursive: true,
    mode: 0o700,
  });

  assertNoSymlinkPath(outputDirectory);

  const temporaryFile = path.join(
    outputDirectory,
    `.brand-pdf-${process.pid}-${require('node:crypto')
      .randomBytes(8)
      .toString('hex')}.tmp`
  );

  try {
    fs.writeFileSync(temporaryFile, outputBytes, {
      flag: 'wx',
      mode: 0o600,
    });

    if (process.platform !== 'win32') {
      fs.chmodSync(temporaryFile, 0o600);
    }

    // Verify the generated file can be reopened.
    const verification = await PDFDocument.load(
      fs.readFileSync(temporaryFile),
      { updateMetadata: false }
    );

    if (verification.getPageCount() !== pdf.getPageCount()) {
      throw new Error('PDF verification failed: page count changed.');
    }

    if (fs.existsSync(outputFile) && !options.overwrite) {
      throw new Error(
        'Output appeared during processing; refusing to overwrite it.'
      );
    }

    fs.renameSync(temporaryFile, outputFile);

    return {
      input: path.relative(ROOT, inputFile),
      output: path.relative(ROOT, outputFile),
      pages: pdf.getPageCount(),
      sizeBytes: fs.statSync(outputFile).size,
      status: 'branded',
    };
  } finally {
    try {
      fs.unlinkSync(temporaryFile);
    } catch {
      // Temporary file may already have been renamed.
    }
  }
}

function printHelp() {
  console.log(`MedOrbits PDF Branding Utility

Usage:
  node scripts/brand-pdfs.js [options]

Options:
  --input=PATH     Input PDF directory
  --output=PATH    Output directory
  --dry-run        Discover files without modifying anything
  --json           Print JSON results
  --overwrite      Allow replacing existing output PDFs
  -h, --help       Show this help

Environment:
  PDF_INPUT_DIR
  PDF_OUTPUT_DIR
  PDF_AUTHOR
  PDF_SUBJECT

Default input:
  ${DEFAULT_INPUT_DIR}

Default output:
  ${DEFAULT_OUTPUT_DIR}

Original PDFs are never modified in place.
This utility updates metadata only; it does not add a visual logo or watermark.
`);
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[MedOrbits PDF] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  let inputDirectory;
  let outputDirectory;

  try {
    inputDirectory = resolveRepositoryPath(
      options.input,
      'Input directory'
    );

    outputDirectory = resolveRepositoryPath(
      options.output,
      'Output directory'
    );

    if (
      inputDirectory === outputDirectory ||
      isInside(inputDirectory, outputDirectory)
    ) {
      throw new Error(
        'Output directory must not be inside the input directory.'
      );
    }

    assertNoSymlinkPath(inputDirectory);
    assertNoSymlinkPath(outputDirectory);

    const inputStat = fs.lstatSync(inputDirectory);

    if (!inputStat.isDirectory() || inputStat.isSymbolicLink()) {
      throw new Error('Input path must be a real directory.');
    }
  } catch (error) {
    console.error(`[MedOrbits PDF] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }

  const files = discoverPdfs(inputDirectory, outputDirectory);

  if (files.length === 0) {
    warnings.push({
      file: path.relative(ROOT, inputDirectory),
      message: 'No PDF files found.',
    });
  }

  if (!options.dryRun) {
    try {
      ensureOutputDirectory(outputDirectory);
    } catch (error) {
      console.error(`[MedOrbits PDF] ${messageOf(error)}`);
      process.exitCode = 2;
      return;
    }
  }

  for (const inputFile of files) {
    let outputFile;

    try {
      outputFile = createOutputPath(
        inputFile,
        inputDirectory,
        outputDirectory
      );

      if (options.dryRun) {
        skipped.push({
          input: path.relative(ROOT, inputFile),
          output: path.relative(ROOT, outputFile),
          status: 'dry-run',
        });

        continue;
      }

      const result = await brandPdf(
        inputFile,
        outputFile,
        options
      );

      processed.push(result);
    } catch (error) {
      errors.push({
        file: path.relative(ROOT, inputFile),
        message: messageOf(error),
      });
    }
  }

  const result = {
    ok: errors.length === 0,
    dryRun: options.dryRun,
    summary: {
      discovered: files.length,
      branded: processed.length,
      skipped: skipped.length,
      errors: errors.length,
      warnings: warnings.length,
    },
    processed,
    skipped,
    errors,
    warnings,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nMedOrbits PDF Branding Utility\n');
    console.log(`PDFs discovered: ${files.length}`);
    console.log(`PDFs branded: ${processed.length}`);
    console.log(`Dry-run entries: ${skipped.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    for (const item of processed) {
      console.log(`BRANDED: ${item.input} -> ${item.output}`);
    }

    for (const item of skipped) {
      console.log(`DRY RUN: ${item.input} -> ${item.output}`);
    }

    for (const item of errors) {
      console.error(`ERROR: ${item.file}\n  ${item.message}`);
    }

    for (const item of warnings) {
      console.warn(`WARNING: ${item.file}\n  ${item.message}`);
    }

    console.log(
      errors.length === 0
        ? '\nPDF processing completed.'
        : '\nPDF processing completed with errors.'
    );
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[MedOrbits PDF] ${messageOf(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  isInside,
  parseArguments,
  resolveRepositoryPath,
  createOutputPath,
};
