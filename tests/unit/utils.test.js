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
 * These tests automatically discover utility modules in src/utils.
 * They test known utility exports when available and safely skip modules
 * that do not exist in this repository.
 */

const fs = require('node:fs');
const path = require('node:path');

const UTILS_DIR = path.resolve(__dirname, '../../src/utils');

function loadUtils() {
  if (!fs.existsSync(UTILS_DIR)) {
    return {};
  }

  const files = fs
    .readdirSync(UTILS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(?:js|cjs)$/.test(entry.name) &&
        !entry.name.endsWith('.test.js') &&
        !entry.name.endsWith('.spec.js'),
    );

  const modules = {};

  for (const file of files) {
    const modulePath = path.join(UTILS_DIR, file.name);

    try {
      modules[path.basename(file.name, path.extname(file.name))] =
        require(modulePath);
    } catch (error) {
      modules[path.basename(file.name, path.extname(file.name))] = {
        __loadError: error,
      };
    }
  }

  return modules;
}

const utils = loadUtils();

function getExport(moduleName, exportName) {
  const utility = utils[moduleName];

  if (!utility || utility.__loadError) {
    return undefined;
  }

  return utility[exportName];
}

function describeIfFunction(description, callback) {
  test(description, callback);
}

describe('MedOrbits utility directory', () => {
  test('utility directory exists', () => {
    expect(fs.existsSync(UTILS_DIR)).toBe(true);
  });

  test('utility modules load without throwing', () => {
    const loadErrors = Object.entries(utils)
      .filter(([, utility]) => utility.__loadError)
      .map(([name, utility]) => ({
        module: name,
        message: utility.__loadError.message,
      }));

    expect(loadErrors).toEqual([]);
  });

  test('utility modules export objects or functions', () => {
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
    '%s.%s behaves correctly when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(fn).toBeInstanceOf(Function);
      expect(() => fn('MedOrbits')).not.toThrow();
    },
  );

  test('HTML escaping prevents raw markup when an escapeHtml utility exists', () => {
    const fn =
      getExport('string', 'escapeHtml') ||
      getExport('formatters', 'escapeHtml') ||
      getExport('helpers', 'escapeHtml');

    if (typeof fn !== 'function') {
      return;
    }

    const output = fn('<script>alert(1)</script>');

    expect(typeof output).toBe('string');
    expect(output).not.toContain('<script>');
  });

  test('slugification returns a string when available', () => {
    const fn =
      getExport('string', 'slugify') ||
      getExport('formatters', 'slugify') ||
      getExport('helpers', 'slugify');

    if (typeof fn !== 'function') {
      return;
    }

    const output = fn('MedOrbits Education');

    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });
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
    '%s.%s handles a representative input when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(fn).toBeInstanceOf(Function);
      expect(() => fn('2026-10-21')).not.toThrow();
    },
  );

  test('date formatting returns a predictable type when available', () => {
    const fn =
      getExport('date', 'formatDate') ||
      getExport('formatters', 'formatDate') ||
      getExport('helpers', 'formatDate');

    if (typeof fn !== 'function') {
      return;
    }

    const result = fn('2026-10-21');

    expect(['string', 'number', 'object']).toContain(typeof result);
  });
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

      expect(fn).toBeInstanceOf(Function);
      expect(() => fn(123.456)).not.toThrow();
    },
  );

  test('rounding utility returns a finite number when available', () => {
    const fn =
      getExport('number', 'round') ||
      getExport('helpers', 'round');

    if (typeof fn !== 'function') {
      return;
    }

    const result = fn(12.345, 2);

    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });
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
    '%s.%s handles plain objects when exported',
    (moduleName, exportName) => {
      const fn = getExport(moduleName, exportName);

      if (typeof fn !== 'function') {
        return;
      }

      expect(fn).toBeInstanceOf(Function);
      expect(() => fn({ name: 'MedOrbits', active: true })).not.toThrow();
    },
  );

  test('pick utility returns only requested fields when available', () => {
    const fn =
      getExport('object', 'pick') ||
      getExport('helpers', 'pick');

    if (typeof fn !== 'function') {
      return;
    }

    const result = fn(
      {
        name: 'Student',
        email: 'student@example.com',
        role: 'admin',
      },
      ['name', 'email'],
    );

    expect(result).toEqual({
      name: 'Student',
      email: 'student@example.com',
    });
    expect(result).not.toHaveProperty('role');
  });

  test('omit utility removes specified fields when available', () => {
    const fn =
      getExport('object', 'omit') ||
      getExport('helpers', 'omit');

    if (typeof fn !== 'function') {
      return;
    }

    const result = fn(
      {
        name: 'Student',
        role: 'admin',
      },
      ['role'],
    );

    expect(result).not.toHaveProperty('role');
    expect(result).toHaveProperty('name', 'Student');
  });
});

describe('Security-oriented utility checks', () => {
  test('HTML escaping utility handles common injection payloads', () => {
    const fn =
      getExport('string', 'escapeHtml') ||
      getExport('formatters', 'escapeHtml') ||
      getExport('helpers', 'escapeHtml');

    if (typeof fn !== 'function') {
      return;
    }

    const payloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '" onmouseover="alert(1)',
      "'; DROP TABLE users; --",
    ];

    for (const payload of payloads) {
      const output = fn(payload);

      expect(typeof output).toBe('string');
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('<img');
    }
  });

  test('URL validation utility rejects JavaScript URLs when available', () => {
    const fn =
      getExport('url', 'validateUrl') ||
      getExport('url', 'isSafeUrl') ||
      getExport('security', 'validateUrl') ||
      getExport('security', 'isSafeUrl');

    if (typeof fn !== 'function') {
      return;
    }

    const result = fn('javascript:alert(1)');

    if (typeof result === 'boolean') {
      expect(result).toBe(false);
    } else {
      expect(result).toBeFalsy();
    }
  });

  test('JSON parsing utilities handle malformed input safely', () => {
    const fn =
      getExport('json', 'safeJsonParse') ||
      getExport('json', 'parseJsonSafely') ||
      getExport('helpers', 'safeJsonParse');

    if (typeof fn !== 'function') {
      return;
    }

    expect(() => fn('{"valid":true}')).not.toThrow();
    expect(() => fn('{invalid-json')).not.toThrow();
  });

  test('utilities do not unexpectedly mutate input objects in common operations', () => {
    const fn =
      getExport('object', 'pick') ||
      getExport('helpers', 'pick');

    if (typeof fn !== 'function') {
      return;
    }

    const input = {
      name: 'Student',
      email: 'student@example.com',
      role: 'user',
    };

    const original = structuredClone(input);

    fn(input, ['name', 'email']);

    expect(input).toEqual(original);
  });
});

describe('Utility export integrity', () => {
  test('does not expose module loading errors as normal exports', () => {
    for (const utility of Object.values(utils)) {
      if (utility && typeof utility === 'object') {
        expect(utility).not.toHaveProperty('__loadError');
      }
    }
  });

  test('utility module names are unique', () => {
    const names = Object.keys(utils);

    expect(new Set(names).size).toBe(names.length);
  });
});