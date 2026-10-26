'use strict';

/**
 * MedOrbits Institution Directory Compiler
 *
 * Input:
 *   data/colleges.json
 *   data/universities.json
 *
 * Output:
 *   data/institutions.json
 *
 * Runtime: Node.js 20+
 * Dependencies: None (Node.js built-ins only)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const COLLEGES_FILE = path.join(DATA_DIR, 'colleges.json');
const UNIVERSITIES_FILE = path.join(DATA_DIR, 'universities.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'institutions.json');

const GENERATED_ON = '2026-10-26';

function readJson(filePath, datasetName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${datasetName} file: ${filePath}`
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${error.message}`
    );
  }

  if (!parsed || !Array.isArray(parsed.records)) {
    throw new Error(
      `${datasetName} must contain a records array.`
    );
  }

  return parsed;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function normalizeId(value) {
  return cleanString(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;
}

function normalizeCountryCode(value) {
  const code = cleanString(value);

  if (!code) return 'IN';

  return code.toUpperCase();
}

function normalizeUrl(value) {
  const url = cleanString(value);

  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function normalizeInstitution(record, sourceDataset) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const id = normalizeId(record.id);
  const name = cleanString(record.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    city: cleanString(record.city),
    state: cleanString(record.state),
    countryCode: normalizeCountryCode(record.countryCode),
    institutionType: cleanString(
      record.institutionType || record.universityType
    ) || 'Institution',
    officialUrl: normalizeUrl(record.officialUrl),
    verificationStatus:
      cleanString(record.verificationStatus) ||
      'unverified',
    sourceDataset: [sourceDataset]
  };
}

/**
 * Additional Indian institutions.
 *
 * These records are directory candidates. Check the current
 * official URLs, institution identity, and regulatory status
 * before using them for admissions or course-level claims.
 */
const ADDITIONAL_INSTITUTIONS = [
  {
    id: 'nit-silchar',
    name: 'National Institute of Technology Silchar',
    city: 'Silchar',
    state: 'Assam',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nits.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nit-calicut',
    name: 'National Institute of Technology Calicut',
    city: 'Kozhikode',
    state: 'Kerala',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://nitc.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nit-jaipur',
    name: 'Malaviya National Institute of Technology Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://mnit.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nit-kurukshetra',
    name: 'National Institute of Technology Kurukshetra',
    city: 'Kurukshetra',
    state: 'Haryana',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://nitkkr.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nit-patna',
    name: 'National Institute of Technology Patna',
    city: 'Patna',
    state: 'Bihar',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nitp.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nit-agartala',
    name: 'National Institute of Technology Agartala',
    city: 'Agartala',
    state: 'Tripura',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.nita.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'iit-jodhpur',
    name: 'Indian Institute of Technology Jodhpur',
    city: 'Jodhpur',
    state: 'Rajasthan',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitj.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'iit-gandhinagar',
    name: 'Indian Institute of Technology Gandhinagar',
    city: 'Gandhinagar',
    state: 'Gujarat',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitgn.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'iit-bhilai',
    name: 'Indian Institute of Technology Bhilai',
    city: 'Bhilai',
    state: 'Chhattisgarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitbhilai.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'iit-dharwad',
    name: 'Indian Institute of Technology Dharwad',
    city: 'Dharwad',
    state: 'Karnataka',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://iitdh.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'aiims-patna',
    name: 'All India Institute of Medical Sciences, Patna',
    city: 'Patna',
    state: 'Bihar',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimspatna.edu.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'aiims-raipur',
    name: 'All India Institute of Medical Sciences, Raipur',
    city: 'Raipur',
    state: 'Chhattisgarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://www.aiimsraipur.edu.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'aiims-deoghar',
    name: 'All India Institute of Medical Sciences, Deoghar',
    city: 'Deoghar',
    state: 'Jharkhand',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimsdeoghar.edu.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'aiims-guwahati',
    name: 'All India Institute of Medical Sciences, Guwahati',
    city: 'Changsari',
    state: 'Assam',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://aiimsguwahati.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'king-georges-medical-university',
    name: "King George's Medical University",
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    countryCode: 'IN',
    institutionType: 'State Medical University',
    officialUrl: 'https://www.kgmu.org/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'jipmer',
    name: 'Jawaharlal Institute of Postgraduate Medical Education and Research',
    city: 'Puducherry',
    state: 'Puducherry',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://jipmer.edu.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'pgimer-chandigarh',
    name: 'Postgraduate Institute of Medical Education and Research',
    city: 'Chandigarh',
    state: 'Chandigarh',
    countryCode: 'IN',
    institutionType: 'Institute of National Importance',
    officialUrl: 'https://pgimer.edu.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nlsiu-bengaluru',
    name: 'National Law School of India University',
    city: 'Bengaluru',
    state: 'Karnataka',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://www.nls.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'nalsar-hyderabad',
    name: 'NALSAR University of Law',
    city: 'Hyderabad',
    state: 'Telangana',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://nalsar.ac.in/',
    verificationStatus: 'official-website-reference'
  },
  {
    id: 'national-law-university-delhi',
    name: 'National Law University Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    countryCode: 'IN',
    institutionType: 'Law University',
    officialUrl: 'https://nludelhi.ac.in/',
    verificationStatus: 'official-website-reference'
  }
];

function canonicalName(name) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function mergeRecords(groups) {
  const byId = new Map();
  const idByName = new Map();

  for (const { records, sourceDataset } of groups) {
    for (const raw of records) {
      const normalized = normalizeInstitution(raw, sourceDataset);

      if (!normalized) {
        console.warn(
          `Skipping invalid record from ${sourceDataset}:`,
          raw?.id || raw?.name || '(missing ID/name)'
        );
        continue;
      }

      const nameKey = [
        normalized.countryCode,
        canonicalName(normalized.name)
      ].join(':');

      const existingId = byId.has(normalized.id)
        ? normalized.id
        : idByName.get(nameKey);

      if (existingId) {
        const existing = byId.get(existingId);

        if (!existing.sourceDataset.includes(sourceDataset)) {
          existing.sourceDataset.push(sourceDataset);
        }

        // Fill missing values without overwriting existing values.
        for (const field of [
          'city',
          'state',
          'officialUrl'
        ]) {
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

        continue;
      }

      byId.set(normalized.id, normalized);
      idByName.set(nameKey, normalized.id);
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', {
      sensitivity: 'base'
    })
  );
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const colleges = readJson(COLLEGES_FILE, 'colleges');
  const universities = readJson(
    UNIVERSITIES_FILE,
    'universities'
  );

  const records = mergeRecords([
    {
      records: colleges.records,
      sourceDataset: 'colleges'
    },
    {
      records: universities.records,
      sourceDataset: 'universities'
    },
    {
      records: ADDITIONAL_INSTITUTIONS,
      sourceDataset: 'additional-curated'
    }
  ]);

  const output = {
    metadata: {
      schemaVersion: '1.0.0',
      dataset: 'institutions',
      description:
        'Combined source-linked Indian and international higher-education institution directory for MedOrbits discovery and directory linking.',
      defaultCountryCode: 'IN',
      currency: 'INR',
      dateFormat: 'YYYY-MM-DD',
      generatedOn: GENERATED_ON,
      verificationPolicy:
        'Verify official institution identity, current course availability, recognition, eligibility, fees and admissions through official institution and relevant regulator sources.',
      notes: [
        'This is a curated directory and not a complete official register.',
        'Institutions are merged from the colleges and universities datasets plus additional directory candidates.',
        'sourceDataset identifies which input directory supplied a record.',
        'Duplicate IDs and duplicate country/name combinations are merged.',
        'Official website references do not prove that a specific course is available or approved.',
        'Medical programmes must be checked against current National Medical Commission requirements and applicable admission authorities.',
        'Engineering, law, pharmacy, nursing and other regulated programmes require checks with their applicable regulators.',
        'International qualification recognition and professional eligibility must be checked separately.',
        'No live admission availability, fee, ranking, intake or seat-count information is implied.',
        'Review additional-curated records and official URLs before production publication.'
      ],
      sourceDatasets: [
        'colleges',
        'universities',
        'additional-curated'
      ],
      recordCount: records.length
    },
    records
  };

  const temporaryFile = `${OUTPUT_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(output, null, 2) + '\n',
    'utf8'
  );

  // Parse the generated file before replacing the destination.
  JSON.parse(fs.readFileSync(temporaryFile, 'utf8'));

  fs.renameSync(temporaryFile, OUTPUT_FILE);

  console.log('MedOrbits institution catalogue compiled.');
  console.log(`Total unique records: ${records.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

try {
  main();
} catch (error) {
  console.error(`Compilation failed: ${error.message}`);
  process.exitCode = 1;
}