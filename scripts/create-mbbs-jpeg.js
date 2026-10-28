#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

const SOURCE = path.join(
  ROOT,
  'assets',
  'images',
  'education',
  'medical-education.jpg',
);

const OUTPUT = path.join(
  ROOT,
  'assets',
  'images',
  'education',
  'mbbs.jpg',
);

const WIDTH = 1200;
const HEIGHT = 675;
const QUALITY = 88;
const OVERWRITE = process.argv.includes('--overwrite');

async function assertRegularFile(filename, label) {
  const stats = await fs.lstat(filename);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file: ${filename}`);
  }

  return stats;
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--overwrite')) {
    throw new Error('Usage: node scripts/create-mbbs-jpeg.js [--overwrite]');
  }

  await assertRegularFile(SOURCE, 'Source image');

  const sourceStats = await fs.stat(SOURCE);

  if (sourceStats.size === 0) {
    throw new Error('Source image is empty.');
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });

  try {
    await fs.lstat(OUTPUT);

    if (!OVERWRITE) {
      throw new Error(
        'Output already exists. Use --overwrite to replace it.',
      );
    }

    await assertRegularFile(OUTPUT, 'Output image');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const temporary = path.join(
    path.dirname(OUTPUT),
    `.mbbs-${process.pid}-${Date.now()}.tmp.jpg`,
  );

  try {
    const result = await sharp(SOURCE, {
      failOn: 'error',
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .resize(WIDTH, HEIGHT, {
        fit: 'cover',
        position: sharp.strategy.attention,
        withoutEnlargement: false,
      })
      .flatten({ background: '#F6F0E6' })
      .jpeg({
        quality: QUALITY,
        mozjpeg: true,
        progressive: true,
      })
      .toFile(temporary);

    if (
      result.width !== WIDTH ||
      result.height !== HEIGHT ||
      result.format !== 'jpeg' ||
      result.size <= 0
    ) {
      throw new Error('Generated image failed output validation.');
    }

    // Confirm the temporary image is readable before publishing it.
    const metadata = await sharp(temporary).metadata();

    if (
      metadata.format !== 'jpeg' ||
      metadata.width !== WIDTH ||
      metadata.height !== HEIGHT
    ) {
      throw new Error('Generated JPEG metadata is invalid.');
    }

    if (OVERWRITE) {
      await fs.rename(temporary, OUTPUT);
    } else {
      // Exclusive creation prevents overwriting an existing file.
      const outputHandle = await fs.open(OUTPUT, 'wx');

      try {
        await outputHandle.writeFile(await fs.readFile(temporary));
        await outputHandle.sync();
      } finally {
        await outputHandle.close();
      }

      await fs.unlink(temporary);
    }

    console.log(
      `Created ${path.relative(ROOT, OUTPUT)} ` +
      `(${result.width}x${result.height}, ${result.size} bytes).`,
    );
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[mbbs-image] ${error.message}`);
  process.exitCode = 1;
});
