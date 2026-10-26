
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(ROOT_DIR, 'database', 'fixtures');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'schemas');

const FIXTURE_SCHEMA_MAP = [
  {
    fixture: 'applications.fixture.json',
    schema: 'application-fixture.schema.json'
  },
  {
    fixture: 'colleges.fixture.json',
    schema: 'college-fixture.schema.json'
  },
  {
    fixture: 'courses.fixture.json',
    schema: 'course-fixture.schema.json'
  },
  {
    fixture: 'payments.fixture.json',
    schema: 'payment-fixture.schema.json'
  }
];

function readJson(filePath) {
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Cannot read "${path.relative(ROOT_DIR, filePath)}": ${error.message}`
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON in "${path.relative(ROOT_DIR, filePath)}": ${error.message}`
    );
  }
}

function getValidator() {
  try {
    return require('ajv/dist/2020').default;
  } catch {
    try {
      return require('ajv').default || require('ajv');
    } catch {
      throw new Error(
        'AJV is not available. Add a compatible AJV version supporting JSON Schema draft 2020-12 to the project dependencies.'
      );
    }
  }
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    const location = error.instancePath || '/';
    const detail = error.message || 'Schema validation failed';
    const extra = error.params
      ? ` (${JSON.stringify(error.params)})`
      : '';

    return `  - ${location}: ${detail}${extra}`;
  });
}

function validateFixtures() {
  let Ajv;
  const failures = [];
  let validatedCount = 0;

  try {
    Ajv = getValidator();
  } catch (error) {
    console.error(`\n[SETUP ERROR] ${error.message}`);
    return 2;
  }

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false
  });

  for (const item of FIXTURE_SCHEMA_MAP) {
    const fixturePath = path.join(FIXTURES_DIR, item.fixture);
    const schemaPath = path.join(SCHEMAS_DIR, item.schema);

    if (!fs.existsSync(fixturePath)) {
      failures.push({
        file: item.fixture,
        messages: ['Fixture file does not exist.']
      });
      continue;
    }

    if (!fs.existsSync(schemaPath)) {
      failures.push({
        file: item.fixture,
        messages: [
          `Schema file does not exist: ${path.relative(ROOT_DIR, schemaPath)}`
        ]
      });
      continue;
    }

    let data;
    let schema;

    try {
      data = readJson(fixturePath);
      schema = readJson(schemaPath);
    } catch (error) {
      failures.push({
        file: item.fixture,
        messages: [error.message]
      });
      continue;
    }

    let validate;

    try {
      validate = ajv.compile(schema);
    } catch (error) {
      failures.push({
        file: item.fixture,
        messages: [
          `Could not compile schema "${item.schema}": ${error.message}`
        ]
      });
      continue;
    }

    const valid = validate(data);

    if (!valid) {
      failures.push({
        file: item.fixture,
        messages: formatAjvErrors(validate.errors)
      });
      continue;
    }

    validatedCount += 1;
    console.log(`[PASS] ${item.fixture}`);
  }

  console.log(
    `\nFixture validation: ${validatedCount}/${FIXTURE_SCHEMA_MAP.length} passed.`
  );

  if (failures.length > 0) {
    console.error('\nValidation errors:');

    for (const failure of failures) {
      console.error(`\n[FAIL] ${failure.file}`);

      for (const message of failure.messages) {
        console.error(message);
      }
    }

    return 1;
  }

  console.log('All configured fixtures passed schema validation.');
  return 0;
}

if (require.main === module) {
  process.exitCode = validateFixtures();
}

module.exports = {
  validateFixtures,
  FIXTURE_SCHEMA_MAP
};
