'use strict';
/**
 * MedOrbits Institution Directory Compiler
 * File: /scripts/compile-institutions.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-ins only
 *
 * Inputs:
 *   /data/colleges.json
 *   /data/universities.json
 *
 * Output:
 *   /data/institutions.json
 *
 * Features:
 * - Validates input JSON and records.
 * - Normalizes IDs, country codes, URLs, and strings.
 * - Merges duplicate IDs and country/name combinations.
 * - Preserves source dataset provenance.
 * - Adds curated institution directory candidates.
 * - Writes output atomically using a temporary file.
 * - Avoids following symlinks for input and output files.
 * - Supports --root, --check, --strict, --json, and --help.
 *
 * Important:
 * This script does not verify regulatory recognition, current
 * admissions, fees, courses, rankings, or seat availability.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_RECORDS_PER_DATASET = 500000;
const EXIT = Object.freeze({
  OK: 0,
  FAILED: 1,
  CONFIG: 2,
});
const ADDITIONAL_INSTITUTIONS = [
  {
    id: 'nit-silchar',
    name: 'National Institute of Technology Silchar',
    city: 'Silchar',
    state: 'Assam',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nits.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nit-calicut',
    name: 'National Institute of Technology Calicut',
    city: 'Kozhikode',
    state: 'Kerala',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://nitc.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nit-jaipur',
    name: 'Malaviya National Institute of Technology Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://mnit.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nit-kurukshetra',
    name: 'National Institute of Technology Kurukshetra',
    city: 'Kurukshetra',
    state: 'Haryana',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://nitkkr.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nit-patna',
    name: 'National Institute of Technology Patna',
    city: 'Patna',
    state: 'Bihar',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nitp.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nit-agartala',
    name: 'National Institute of Technology Agartala',
    city: 'Agartala',
    state: 'Tripura',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nita.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'iit-jodhpur',
    name: 'Indian Institute of Technology Jodhpur',
    city: 'Jodhpur',
    state: 'Rajasthan',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitj.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'iit-gandhinagar',
    name: 'Indian Institute of Technology Gandhinagar',
    city: 'Gandhinagar',
    state: 'Gujarat',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitgn.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'iit-bhilai',
    name: 'Indian Institute of Technology Bhilai',
    city: 'Bhilai',
    state: 'Chhattisgarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitbhilai.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'iit-dharwad',
    name: 'Indian Institute of Technology Dharwad',
    city: 'Dharwad',
    state: 'Karnataka',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitdh.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'aiims-patna',
    name: 'All India Institute of Medical Sciences, Patna',
    city: 'Patna',
    state: 'Bihar',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimspatna.edu.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'aiims-raipur',
    name: 'All India Institute of Medical Sciences, Raipur',
    city: 'Raipur',
    state: 'Chhattisgarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.aiimsraipur.edu.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'aiims-deoghar',
    name: 'All India Institute of Medical Sciences, Deoghar',
    city: 'Deoghar',
    state: 'Jharkhand',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimsdeoghar.edu.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'aiims-guwahati',
    name: 'All India Institute of Medical Sciences, Guwahati',
    city: 'Changsari',
    state: 'Assam',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimsguwahati.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'king-georges-medical-university',
    name: "King George's Medical University",
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    countryCode: 'IN',
    institutionType: 'State Medical University',
    officialUrl: 'https://www.kgmu.org/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'jipmer',
    name: 'Jawaharlal Institute of Postgraduate Medical Education and Research',
    city: 'Puducherry',
    state: 'Puducherry',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://jipmer.edu.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'pgimer-chandigarh',
    name: 'Postgraduate Institute of Medical Education and Research',
    city: 'Chandigarh',
    state: 'Chandigarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://pgimer.edu.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nlsiu-bengaluru',
    name: 'National Law School of India University',
    city: 'Bengaluru',
    state: 'Karnataka',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://www.nls.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'nalsar-hyderabad',
    name: 'NALSAR University of Law',
    city: 'Hyderabad',
    state: 'Telangana',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://nalsar.ac.in/',
    verificationStatus: 'official-website-reference',
  },
  {
    id: 'national-law-university-delhi',
    name: 'National Law University Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://nludelhi.ac.in/',
    verificationStatus: 'official-website-reference',
  },
];
function parseArguments(argv) {
  const options = {
    root: DEFAULT_ROOT,
    checkOnly: false,
    strict: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--check') {
      options.checkOnly = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--root') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--root requires a directory path.');
      }
      options.root = path.resolve(value);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}
function showHelp() {
  console.log(`
MedOrbits Institution Directory Compiler
Usage:
  node scripts/compile-institutions.js [options]
Options:
  --root <directory>  Project root (default: repository root)
  --check             Validate and compile in memory without writing
  --strict            Fail if any input records are skipped
  --json              Print machine-readable summary
  --help, -h          Show this help
Inputs:
  data/colleges.json
  data/universities.json
Output:
  data/institutions.json
`);
}
function isInside(root, target) {
  const relativePath = path.relative(root, target);
  return relativePath === '' ||
    (
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    );
}
function cleanString(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}
function normalizeId(value) {
  const text = cleanString(value);
  if (!text) return null;
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;
}
function normalizeCountryCode(value) {
  const code = cleanString(value);
  if (!code) return 'IN';
  const normalized = code.toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}
function normalizeUrl(value) {
  const text = cleanString(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
function canonicalName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function readRegularFile(filePath, root) {
  const resolved = path.resolve(filePath);
  if (!isInside(root, resolved)) {
    throw new Error('Input path escapes project root.');
  }
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Required file is missing: ${path.relative(root, resolved)}`);
    }
    throw new Error(`Cannot inspect ${path.relative(root, resolved)}.`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `Expected a regular, non-symlink file: ${path.relative(root, resolved)}`
    );
  }
  if (stat.size > MAX_INPUT_BYTES) {
    throw new Error(
      `Input exceeds the ${MAX_INPUT_BYTES} byte limit: ${path.relative(root, resolved)}`
    );
  }
  let fd;
  try {
    fd = fs.openSync(
      resolved,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    const openedStat = fs.fstatSync(fd);
    if (!openedStat.isFile() || openedStat.size > MAX_INPUT_BYTES) {
      throw new Error('Input file changed or exceeded the size limit.');
    }
    const chunks = [];
    const buffer = Buffer.alloc(64 * 1024);
    let total = 0;
    while (true) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      total += count;
      if (total > MAX_INPUT_BYTES) {
        throw new Error('Input grew beyond the permitted size.');
      }
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const finalStat = fs.fstatSync(fd);
    if (
      openedStat.size !== finalStat.size ||
      openedStat.mtimeMs !== finalStat.mtimeMs ||
      total !== finalStat.size
    ) {
      throw new Error('Input changed while it was being read.');
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    throw new Error(
      `Unable to read ${path.relative(root, resolved)}: ${error.message}`
    );
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Preserve the original read error.
      }
    }
  }
}
function readJson(filePath, datasetName, root) {
  const source = readRegularFile(filePath, root);
  let parsed;
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${path.relative(root, filePath)}: ${error.message}`
    );
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray(parsed.records)
  ) {
    throw new Error(`${datasetName} must contain a records array.`);
  }
  if (parsed.records.length > MAX_RECORDS_PER_DATASET) {
    throw new Error(
      `${datasetName} exceeds ${MAX_RECORDS_PER_DATASET} records.`
    );
  }
  return parsed;
}
function normalizeInstitution(record, sourceDataset, stats) {
  if (
    !record ||
    typeof record !== 'object' ||
    Array.isArray(record)
  ) {
    stats.invalidRecords += 1;
    return null;
  }
  const id = normalizeId(record.id);
  const name = cleanString(record.name);
  const countryCode = normalizeCountryCode(record.countryCode);
  if (!id || !name || !countryCode) {
    stats.invalidRecords += 1;
    return null;
  }
  const rawType = cleanString(
    record.institutionType || record.universityType
  );
  const verificationStatus =
    cleanString(record.verificationStatus) || 'unverified';
  return {
    id,
    name,
    city: cleanString(record.city),
    state: cleanString(record.state),
    countryCode,
    institutionType: rawType || 'Institution',
    officialUrl: normalizeUrl(record.officialUrl),
    verificationStatus,
    sourceDataset: [sourceDataset],
  };
}
function mergeRecords(groups, stats) {
  const byId = new Map();
  const idByName = new Map();
  for (const group of groups) {
    for (const rawRecord of group.records) {
      stats.inputRecords += 1;
      const normalized = normalizeInstitution(
        rawRecord,
        group.sourceDataset,
        stats
      );
      if (!normalized) continue;
      const nameKey = [
        normalized.countryCode,
        canonicalName(normalized.name),
      ].join(':');
      const existingId = byId.has(normalized.id)
        ? normalized.id
        : idByName.get(nameKey);
      if (existingId) {
        const existing = byId.get(existingId);
        stats.duplicateRecords += 1;
        if (!existing.sourceDataset.includes(group.sourceDataset)) {
          existing.sourceDataset.push(group.sourceDataset);
        }
        for (const field of ['city', 'state', 'officialUrl']) {
          if (!existing[field] && normalized[field]) {
            existing[field] = normalized[field];
          }
        }
        if (
          existing.institutionType === 'Institution' &&
          normalized.institutionType !== 'Institution'
        ) {
          existing.institutionType = normalized.institutionType;
        }
        if (
          existing.verificationStatus === 'unverified' &&
          normalized.verificationStatus !== 'unverified'
        ) {
          existing.verificationStatus = normalized.verificationStatus;
        }
        continue;
      }
      byId.set(normalized.id, normalized);
      idByName.set(nameKey, normalized.id);
    }
  }
  const records = [...byId.values()];
  for (const record of records) {
    record.sourceDataset.sort();
  }
  records.sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
  return records;
}
function makeOutput(records, stats) {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      dataset: 'institutions',
      description:
        'Combined source-linked higher-education institution directory for MedOrbits.',
      defaultCountryCode: 'IN',
      currency: 'INR',
      dateFormat: 'YYYY-MM-DD',
      generatedOn: new Date().toISOString().slice(0, 10),
      generator: 'scripts/compile-institutions.js',
      verificationPolicy:
        'Verify institution identity, official URLs, current courses, recognition, eligibility, fees, and admissions using official institution and applicable regulator sources.',
      recordCount: records.length,
      sourceDatasets: [
        'colleges',
        'universities',
        'additional-curated',
      ],
      compilation: {
        inputRecords: stats.inputRecords,
        invalidRecords: stats.invalidRecords,
        duplicateRecords: stats.duplicateRecords,
      },
      notes: [
        'This directory is not a complete official institution register.',
        'Records from the curated list are directory candidates, not regulatory endorsements.',
        'Official website references do not establish course approval or current admission availability.',
        'Medical programmes must be checked against current National Medical Commission requirements and applicable counselling authorities.',
        'Other regulated programmes must be checked against their applicable regulators.',
        'International qualification recognition and professional eligibility must be verified separately.',
        'Fees, rankings, intake, seat counts, and live availability are not implied.',
      ],
    },
    records,
  };
}
function validateOutput(output) {
  if (!Array.isArray(output.records)) {
    throw new Error('Output records must be an array.');
  }
  const ids = new Set();
  for (const record of output.records) {
    if (!record.id || !record.name || !record.countryCode) {
      throw new Error('Generated record is missing required fields.');
    }
    if (ids.has(record.id)) {
      throw new Error(`Duplicate output ID: ${record.id}`);
    }
    ids.add(record.id);
    if (
      record.officialUrl &&
      !['http:', 'https:'].includes(new URL(record.officialUrl).protocol)
    ) {
      throw new Error(`Invalid URL in generated record: ${record.id}`);
    }
  }
  if (output.metadata.recordCount !== output.records.length) {
    throw new Error('Output metadata recordCount does not match records.');
  }
}
function writeAtomically(outputPath, content, root) {
  const directory = path.dirname(outputPath);
  const baseName = path.basename(outputPath);
  if (!isInside(root, outputPath) || !isInside(root, directory)) {
    throw new Error('Output path escapes project root.');
  }
  const directoryStat = fs.lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error('Output directory must be a regular, non-symlink directory.');
  }
  try {
    const existing = fs.lstatSync(outputPath);
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error('Output target must be a regular, non-symlink file.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporaryPath = path.join(
    directory,
    `.${baseName}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  let fd;
  try {
    fd = fs.openSync(
      temporaryPath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        (fs.constants.O_NOFOLLOW || 0),
      0o600
    );
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // Validate the complete temporary JSON before replacement.
    JSON.parse(fs.readFileSync(temporaryPath, 'utf8'));
    fs.renameSync(temporaryPath, outputPath);
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close failure while preserving the primary error.
      }
    }
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Temporary file may not have been created.
    }
    throw error;
  }
}
function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    showHelp();
    return EXIT.OK;
  }
  let root;
  try {
    root = fs.realpathSync(options.root);
  } catch {
    console.error('CONFIGURATION ERROR: Project root does not exist.');
    return EXIT.CONFIG;
  }
  if (!fs.statSync(root).isDirectory()) {
    console.error('CONFIGURATION ERROR: Project root is not a directory.');
    return EXIT.CONFIG;
  }
  const dataDirectory = path.join(root, 'data');
  const collegesFile = path.join(dataDirectory, 'colleges.json');
  const universitiesFile = path.join(dataDirectory, 'universities.json');
  const outputFile = path.join(dataDirectory, 'institutions.json');
  const stats = {
    inputRecords: 0,
    invalidRecords: 0,
    duplicateRecords: 0,
  };
  try {
    const colleges = readJson(collegesFile, 'colleges', root);
    const universities = readJson(universitiesFile, 'universities', root);
    const records = mergeRecords([
      {
        records: colleges.records,
        sourceDataset: 'colleges',
      },
      {
        records: universities.records,
        sourceDataset: 'universities',
      },
      {
        records: ADDITIONAL_INSTITUTIONS,
        sourceDataset: 'additional-curated',
      },
    ], stats);
    const output = makeOutput(records, stats);
    validateOutput(output);
    if (options.strict && stats.invalidRecords > 0) {
      throw new Error(
        `Strict mode rejected ${stats.invalidRecords} invalid input record(s).`
      );
    }
    const content = `${JSON.stringify(output, null, 2)}\n`;
    if (!options.checkOnly) {
      fs.mkdirSync(dataDirectory, { recursive: true });
      // Ensure the data directory resolves inside the chosen project root.
      const realDataDirectory = fs.realpathSync(dataDirectory);
      if (!isInside(root, realDataDirectory)) {
        throw new Error('Data directory resolves outside project root.');
      }
      writeAtomically(outputFile, content, root);
    }
    const result = {
      tool: 'MedOrbits Institution Directory Compiler',
      status: 'passed',
      checkOnly: options.checkOnly,
      output: options.checkOnly
        ? null
        : path.relative(root, outputFile).split(path.sep).join('/'),
      recordCount: records.length,
      ...stats,
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('MedOrbits Institution Directory Compiler');
      console.log('Compilation validated successfully.');
      console.log(`Unique institutions: ${records.length}`);
      console.log(`Input records: ${stats.inputRecords}`);
      console.log(`Invalid records skipped: ${stats.invalidRecords}`);
      console.log(`Duplicate records merged: ${stats.duplicateRecords}`);
      console.log(options.checkOnly
        ? 'Check mode: output was not written.'
        : `Output: ${outputFile}`);
    }
    return EXIT.OK;
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({
        tool: 'MedOrbits Institution Directory Compiler',
        status: 'failed',
        error: error.message,
      }, null, 2));
    } else {
      console.error(`Compilation failed: ${error.message}`);
    }
    return EXIT.FAILED;
  }
}
try {
  process.exitCode = main();
} catch (error) {
  console.error(`Fatal error: ${error.message}`);
  process.exitCode = EXIT.CONFIG;
}