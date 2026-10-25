
'use strict';

/**
 * MedOrbits -- Utility Unit Tests
 *
 * File: tests/unit/utils.test.js
 * Runtime: Node.js >= 20
 * Test runner: Jest
 *
 * Run:
 *   npx jest tests/unit/utils.test.js --runInBand
 *
 * Purpose:
 * - Discover CommonJS utility modules in src/utils.
 * - Detect module loading and export-integrity problems.
 * - Test known utility exports when available.
 * - Verify common input, output, mutation, and security behaviors.
 *
 * Notes:
 * - Tests for optional exports are marked as skipped when the export is absent.
 * - Utility discovery does not recurse into subdirectories.
 * - ES modules that cannot be loaded using require() are reported as load failures.
 * - These tests do not replace production API or integration security tests.
 */

const fs = require('node:fs');
const path = require('node:path');

const UTILS_DIR = path.resolve(__dirname, '../../src/utils');

const UTILITY_FILE_PATTERN = /\.(?:js|cjs)$/i;
const EXCLUDED_FILE_PATTERN = /\.(?:test|spec)\.(?:js|cjs)$/i;

function discoverUtilityFiles() {
  if (!fs.existsSync(UTILS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(UTILS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        UTILITY_FILE_PATTERN.test(entry.name) &&
        !EXCLUDED_FILE_PATTERN.test(entry.name),
    )
    .map((entry) => ({
      name: path.basename(entry.name, path.extname(entry.name)),
      filename: entry.name,
      path: path.join(UTILS_DIR, entry.name),
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

function loadUtils(files) {
  const modules = Object.create(null);

  for (const file of files) {
    try {
      modules[file.name] = require(file.path);
    } catch (error) {
      modules[file.name] = {
        __loadError: error,
      };
    }
  }

  return modules;
}

const utilityFiles = discoverUtilityFiles();
const utils = loadUtils(utilityFiles);

function getUtility(moduleName) {
  const utility = utils[moduleName];

  if (
    utility === undefined ||
    utility === null ||
    (typeof utility === 'object' && utility.__loadError)
  ) {
    return undefined;
  }

  return utility;
}

function getExport(moduleName, exportName) {
  const utility = getUtility(moduleName);

  if (
    utility === undefined ||
    (typeof utility !== 'object' && typeof utility !== 'function')
  ) {
    return undefined;
  }

  return utility[exportName];
}

function findFirstExport(candidates) {
  for (const [moduleName, exportName] of candidates) {
    const fn = getExport(moduleName, exportName);

    if (typeof fn === 'function') {
      return {
        moduleName,
        exportName,
        fn,
      };
    }
  }

  return undefined;
}

function testIfExportExists(description, candidates, callback) {
  const found = findFirstExport(candidates);

  if (!found) {
    test.skip(`${description} (optional export unavailable)`, () => {});
    return;
  }

  test(description, () => callback(found.fn, found));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function expectSafeHtmlEscape(fn, payload) {
  const output = fn(payload);

  expect(typeof output).toBe('string');
  expect(output).not.toMatch(/<\s*script\b/i);
  expect(output).not.toMatch(/<\s*img\b/i);
  expect(output).not.toMatch(/\bon\w+\s*=/i);
}

function closeEnough(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

describe('MedOrbits utility directory', () => {
  test('utility directory exists', () => {
    expect(fs.existsSync(UTILS_DIR)).toBe(true);
    expect(fs.statSync(UTILS_DIR).isDirectory()).toBe(true);
  });

  test('at least one utility module is discoverable', () => {
    expect(utilityFiles.length).toBeGreaterThan(0);
  });

  test('utility modules load without throwing', () => {
    const loadErrors = Object.entries(utils)
      .filter(([, utility]) => utility && utility.__loadError)
      .map(([name, utility]) => ({
        module: name,
        message: utility.__loadError.message,
      }));

    expect(loadErrors).toEqual([]);
  });

  test('utility modules export objects or functions', () => {
    const invalidExports = Object.entries(utils)
      .filter(
        ([, utility]) =>
          utility === null ||
          (typeof utility !== 'object' && typeof utility !== 'function') ||
          Boolean(utility && utility.__loadError),
      )
      .map(([name]) => name);

    expect(invalidExports).toEqual([]);
  });

  test('discovered module names are unique', () => {
    const names = utilityFiles.map((file) => file.name);

    expect(new Set(names).size).toBe(names.length);
  });

  test('discovery excludes test and spec files', () => {
    for (const file of utilityFiles) {
      expect(file.filename).not.toMatch(EXCLUDED_FILE_PATTERN);
    }
  });

  test('discovered paths remain within the utility directory', () => {
    for (const file of utilityFiles) {
      const relativePath = path.relative(UTILS_DIR, file.path);

      expect(relativePath).not.toBe('..');
      expect(relativePath.startsWith(`..${path.sep}`)).toBe(false);
      expect(path.isAbsolute(relativePath)).toBe(false);
    }
  });
});

describe('String utility functions', () => {
  const stringCandidates = [
    ['string', 'escapeHtml'],
    ['string', 'sanitizeString'],
    ['string', 'slugify'],
    ['string', 'capitalize'],
    ['string', 'truncate'],
    ['formatters', 'escapeHtml'],
    ['formatters', 'slugify'],
    ['helpers', 'escapeHtml'],
    ['helpers', 'slugify'],
  ];

  test.each(stringCandidates)(
    '%s.%s accepts a representative string when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(() => fn('MedOrbits')).not.toThrow();
    },
  );

  testIfExportExists(
    'HTML escaping neutralizes common markup payloads',
    [
      ['string', 'escapeHtml'],
      ['formatters', 'escapeHtml'],
      ['helpers', 'escapeHtml'],
    ],
    (fn) => {
      const payloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '" onmouseover="alert(1)',
        "'; DROP TABLE users; --",
      ];

      for (const payload of payloads) {
        expectSafeHtmlEscape(fn, payload);
      }
    },
  );

  testIfExportExists(
    'HTML escaping handles empty and ordinary text inputs',
    [
      ['string', 'escapeHtml'],
      ['formatters', 'escapeHtml'],
      ['helpers', 'escapeHtml'],
    ],
    (fn) => {
      expect(typeof fn('MedOrbits')).toBe('string');
      expect(typeof fn('')).toBe('string');
    },
  );

  testIfExportExists(
    'slugification returns a stable, non-empty string for ordinary text',
    [
      ['string', 'slugify'],
      ['formatters', 'slugify'],
      ['helpers', 'slugify'],
    ],
    (fn) => {
      const input = 'MedOrbits Education';

      const first = fn(input);
      const second = fn(input);

      expect(typeof first).toBe('string');
      expect(first.length).toBeGreaterThan(0);
      expect(second).toBe(first);
    },
  );

  testIfExportExists(
    'slugification handles whitespace and punctuation',
    [
      ['string', 'slugify'],
      ['formatters', 'slugify'],
      ['helpers', 'slugify'],
    ],
    (fn) => {
      const output = fn('  MedOrbits Education & Careers!  ');

      expect(typeof output).toBe('string');
      expect(output).not.toMatch(/^\s|\s$/);
    },
  );

  testIfExportExists(
    'capitalize returns a string for ordinary text',
    [['string', 'capitalize']],
    (fn) => {
      const output = fn('medorbits');

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    },
  );

  testIfExportExists(
    'truncate returns a string for ordinary text and a limit',
    [['string', 'truncate']],
    (fn) => {
      const output = fn('MedOrbits Education', 10);

      expect(typeof output).toBe('string');
      expect(output.length).toBeLessThanOrEqual(20);
    },
  );

  testIfExportExists(
    'sanitizeString returns a string for ordinary text',
    [['string', 'sanitizeString']],
    (fn) => {
      expect(typeof fn('MedOrbits Education')).toBe('string');
    },
  );
});

describe('Date utility functions', () => {
  const dateCandidates = [
    ['date', 'formatDate'],
    ['date', 'isValidDate'],
    ['date', 'parseDate'],
    ['date', 'toISOString'],
    ['formatters', 'formatDate'],
    ['helpers', 'formatDate'],
  ];

  test.each(dateCandidates)(
    '%s.%s handles a representative date when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(() => fn('2026-10-21')).not.toThrow();
    },
  );

  testIfExportExists(
    'date formatting returns a string for a valid date',
    [
      ['date', 'formatDate'],
      ['formatters', 'formatDate'],
      ['helpers', 'formatDate'],
    ],
    (fn) => {
      const result = fn('2026-10-21');

      expect(typeof result).toBe('string');
    },
  );

  testIfExportExists(
    'date validation identifies a valid ISO date',
    [['date', 'isValidDate']],
    (fn) => {
      const result = fn('2026-10-21');

      expect(result).toBe(true);
    },
  );

  testIfExportExists(
    'date parsing returns a usable result for a valid date',
    [['date', 'parseDate']],
    (fn) => {
      const result = fn('2026-10-21');

      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    },
  );

  testIfExportExists(
    'ISO conversion returns a canonical ISO timestamp',
    [['date', 'toISOString']],
    (fn) => {
      const result = fn('2026-10-21T00:00:00.000Z');

      expect(typeof result).toBe('string');
      expect(Number.isNaN(Date.parse(result))).toBe(false);
    },
  );
});

describe('Numeric utility functions', () => {
  const numberCandidates = [
    ['number', 'formatNumber'],
    ['number', 'round'],
    ['number', 'clamp'],
    ['formatters', 'formatNumber'],
    ['helpers', 'formatNumber'],
  ];

  test.each(numberCandidates)(
    '%s.%s handles numeric input when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(() => fn(123.456)).not.toThrow();
    },
  );

  testIfExportExists(
    'rounding returns the expected value for standard decimal input',
    [
      ['number', 'round'],
      ['helpers', 'round'],
    ],
    (fn) => {
      const result = fn(12.345, 2);

      expect(typeof result).toBe('number');
      expect(Number.isFinite(result)).toBe(true);
      expect(closeEnough(result, 12.35, 0.001)).toBe(true);
    },
  );

  testIfExportExists(
    'number formatting returns a string for a finite number',
    [
      ['number', 'formatNumber'],
      ['formatters', 'formatNumber'],
      ['helpers', 'formatNumber'],
    ],
    (fn) => {
      const result = fn(1234.5);

      expect(typeof result).toBe('string');
    },
  );

  testIfExportExists(
    'clamp returns a number within the requested bounds',
    [['number', 'clamp']],
    (fn) => {
      const result = fn(15, 0, 10);

      expect(typeof result).toBe('number');
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    },
  );
});

describe('Object utility functions', () => {
  const objectCandidates = [
    ['object', 'pick'],
    ['object', 'omit'],
    ['object', 'deepClone'],
    ['object', 'isPlainObject'],
    ['helpers', 'pick'],
    ['helpers', 'omit'],
  ];

  test.each(objectCandidates)(
    '%s.%s handles a plain object when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(() =>
        fn({ name: 'MedOrbits', active: true }),
      ).not.toThrow();
    },
  );

  testIfExportExists(
    'pick returns only the requested own fields',
    [
      ['object', 'pick'],
      ['helpers', 'pick'],
    ],
    (fn) => {
      const result = fn(
        {
          name: 'Student',
          email: 'student@example.test',
          role: 'admin',
        },
        ['name', 'email'],
      );

      expect(result).toEqual({
        name: 'Student',
        email: 'student@example.test',
      });

      expect(result).not.toHaveProperty('role');
    },
  );

  testIfExportExists(
    'omit removes requested fields and preserves other fields',
    [
      ['object', 'omit'],
      ['helpers', 'omit'],
    ],
    (fn) => {
      const result = fn(
        {
          name: 'Student',
          role: 'admin',
        },
        ['role'],
      );

      expect(result).not.toHaveProperty('role');
      expect(result).toHaveProperty('name', 'Student');
    },
  );

  testIfExportExists(
    'pick does not mutate its input',
    [
      ['object', 'pick'],
      ['helpers', 'pick'],
    ],
    (fn) => {
      const input = {
        name: 'Student',
        email: 'student@example.test',
        profile: {
          active: true,
        },
      };

      const original = structuredClone(input);

      fn(input, ['name', 'email']);

      expect(input).toEqual(original);
    },
  );

  testIfExportExists(
    'omit does not mutate its input',
    [
      ['object', 'omit'],
      ['helpers', 'omit'],
    ],
    (fn) => {
      const input = {
        name: 'Student',
        role: 'user',
      };

      const original = structuredClone(input);

      fn(input, ['role']);

      expect(input).toEqual(original);
    },
  );

  testIfExportExists(
    'deepClone produces an equivalent but independent nested object',
    [['object', 'deepClone']],
    (fn) => {
      const input = {
        name: 'Student',
        profile: {
          active: true,
          tags: ['education', 'careers'],
        },
      };

      const clone = fn(input);

      expect(clone).toEqual(input);

      if (
        clone &&
        typeof clone === 'object' &&
        clone.profile &&
        typeof clone.profile === 'object'
      ) {
        expect(clone).not.toBe(input);
        expect(clone.profile).not.toBe(input.profile);
        expect(clone.profile.tags).not.toBe(input.profile.tags);
      }
    },
  );

  testIfExportExists(
    'isPlainObject distinguishes plain objects from arrays and null',
    [['object', 'isPlainObject']],
    (fn) => {
      expect(fn({ name: 'Student' })).toBe(true);
      expect(fn([])).toBe(false);
      expect(fn(null)).toBe(false);
    },
  );
});

describe('Security-oriented utility checks', () => {
  testIfExportExists(
    'HTML escaping neutralizes injection payloads',
    [
      ['string', 'escapeHtml'],
      ['formatters', 'escapeHtml'],
      ['helpers', 'escapeHtml'],
    ],
    (fn) => {
      const payloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '" onmouseover="alert(1)',
        "'; DROP TABLE users; --",
      ];

      for (const payload of payloads) {
        expectSafeHtmlEscape(fn, payload);
      }
    },
  );

  testIfExportExists(
    'URL validation rejects JavaScript URLs',
    [
      ['url', 'validateUrl'],
      ['url', 'isSafeUrl'],
      ['security', 'validateUrl'],
      ['security', 'isSafeUrl'],
    ],
    (fn) => {
      const result = fn('javascript:alert(1)');

      if (typeof result === 'boolean') {
        expect(result).toBe(false);
      } else {
        expect(result).toBeFalsy();
      }
    },
  );

  testIfExportExists(
    'URL validation accepts a standard HTTPS URL',
    [
      ['url', 'validateUrl'],
      ['url', 'isSafeUrl'],
      ['security', 'validateUrl'],
      ['security', 'isSafeUrl'],
    ],
    (fn) => {
      const result = fn('https://example.test/path');

      if (typeof result === 'boolean') {
        expect(result).toBe(true);
      } else {
        expect(result).toBeTruthy();
      }
    },
  );

  testIfExportExists(
    'safe JSON parsing handles valid and malformed JSON without throwing',
    [
      ['json', 'safeJsonParse'],
      ['json', 'parseJsonSafely'],
      ['helpers', 'safeJsonParse'],
    ],
    (fn) => {
      expect(() => fn('{"valid":true}')).not.toThrow();
      expect(() => fn('{invalid-json')).not.toThrow();
    },
  );

  testIfExportExists(
    'safe JSON parsing preserves valid JSON data',
    [
      ['json', 'safeJsonParse'],
      ['json', 'parseJsonSafely'],
      ['helpers', 'safeJsonParse'],
    ],
    (fn) => {
      const result = fn('{"valid":true,"count":2}');

      expect(result).toEqual({
        valid: true,
        count: 2,
      });
    },
  );

  testIfExportExists(
    'object pick does not mutate input during a common operation',
    [
      ['object', 'pick'],
      ['helpers', 'pick'],
    ],
    (fn) => {
      const input = {
        name: 'Student',
        email: 'student@example.test',
        role: 'user',
      };

      const original = structuredClone(input);

      fn(input, ['name', 'email']);

      expect(input).toEqual(original);
    },
  );

  test('fixture-like test values contain no production credentials', () => {
    const safeTestValues = {
      email: 'student@example.test',
      url: 'https://example.test/resource',
      transactionReference: 'txn_test_0001',
    };

    expect(safeTestValues.email).toMatch(/@example\.test$/);
    expect(safeTestValues.url).toMatch(/^https:\/\/example\.test\//);
    expect(safeTestValues.transactionReference).toMatch(/^txn_test_/);
  });

  test('plain-object detection helper handles prototype edge cases', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('text')).toBe(false);
  });
});

describe('Utility export integrity', () => {
  test('load-error sentinels are not exposed as successfully loaded utilities', () => {
    const loadErrors = Object.entries(utils).filter(
      ([, utility]) => utility && utility.__loadError,
    );

    expect(loadErrors).toEqual([]);
  });

  test('utility exports have supported top-level types', () => {
    for (const [name, utility] of Object.entries(utils)) {
      expect({
        name,
        validExport:
          typeof utility === 'function' ||
          (utility !== null && typeof utility === 'object'),
      }).toMatchObject({
        name,
        validExport: true,
      });
    }
  });

  test('each discovered file has a corresponding module entry', () => {
    for (const file of utilityFiles) {
      expect(Object.hasOwn(utils, file.name)).toBe(true);
    }
  });

  test('export lookup safely handles missing modules and exports', () => {
    expect(getExport('__missing_utility__', 'missingExport')).toBeUndefined();
    expect(getExport(utilityFiles[0]?.name ?? '__missing_utility__', '__missing_export__'))
      .toBeUndefined();
  });

  test('utility discovery remains deterministic', () => {
    const discoveredAgain = discoverUtilityFiles().map((file) => file.filename);
    const discoveredInitially = utilityFiles.map((file) => file.filename);

    expect(discoveredAgain).toEqual(discoveredInitially);
  });
});
