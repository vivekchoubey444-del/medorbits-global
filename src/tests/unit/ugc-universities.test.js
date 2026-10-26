
'use strict';

/**
 * MedOrbits -- UGC University Importer Unit Tests
 * File: tests/unit/import-ugc-universities.test.js
 *
 * Coverage:
 * - Exported importer API and category configuration
 * - University record construction and deterministic identifiers
 * - Explicit source-field allowlisting and sensitive-data exclusion
 * - State mapping and unknown-state handling
 * - Source provenance and verification defaults
 * - Website normalization and unsafe URL rejection
 * - Slug normalization, Unicode, and malformed inputs
 *
 * Run:
 *   npm test -- --runInBand
 *
 * Or:
 *   npx jest tests/unit/import-ugc-universities.test.js --runInBand
 */

const {
  CATEGORIES,
  createUniversityRecord,
  normalizeWebsite,
  slugify,
} = require('../../scripts/import-ugc-universities');

describe('UGC university importer', () => {
  const category = Array.isArray(CATEGORIES)
    ? CATEGORIES.find((item) => item.label === 'Private')
    : undefined;

  const states = new Map([
    ['maharashtra', 'state-in-mh'],
  ]);

  const sourceDate = '2026-10-17';
  const importedAt = '2026-10-17T00:00:00.000Z';

  const sourceRecord = Object.freeze({
    ID: '42',
    uni_name: 'Example University',
    uni_type: 'Private',
    state: 'Maharashtra',
    address: 'Pune',
    Zip: '411001',
    status: '2(f)',
    url: 'www.example.edu',
    user_password: 'must-not-be-copied',
  });

  function makeRecord(overrides = {}, options = {}) {
    const {
      source = sourceRecord,
      categoryOverride = category,
      stateMap = states,
      date = sourceDate,
      timestamp = importedAt,
    } = options;

    return createUniversityRecord(
      { ...source, ...overrides },
      categoryOverride,
      stateMap,
      date,
      timestamp,
    );
  }

  function serializeRecord(record) {
    return JSON.stringify(record);
  }

  describe('configuration and exports', () => {
    test('exports a non-empty category collection', () => {
      expect(Array.isArray(CATEGORIES)).toBe(true);
      expect(CATEGORIES.length).toBeGreaterThan(0);
    });

    test('contains the Private category', () => {
      expect(category).toBeDefined();
      expect(category).toEqual(
        expect.objectContaining({ label: 'Private' }),
      );
    });

    test('exports all expected helpers', () => {
      expect(typeof createUniversityRecord).toBe('function');
      expect(typeof normalizeWebsite).toBe('function');
      expect(typeof slugify).toBe('function');
    });

    test('category labels are non-empty strings', () => {
      for (const item of CATEGORIES) {
        expect(item).toEqual(
          expect.objectContaining({
            label: expect.any(String),
          }),
        );

        expect(item.label.trim().length).toBeGreaterThan(0);
      }
    });

    test('category labels are unique', () => {
      const labels = CATEGORIES.map((item) => item.label);

      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe('createUniversityRecord', () => {
    test('creates a source-backed university record', () => {
      const record = makeRecord();

      expect(record).toEqual(
        expect.objectContaining({
          id: 'inst-in-ugc-42',
          slug: 'example-university-42',
          stateId: 'state-in-mh',
          website: 'https://www.example.edu/',
          verificationStatus: 'pending-review',
          verifiedAt: null,
        }),
      );
    });

    test('creates a stable identifier from the source ID', () => {
      expect(makeRecord().id).toBe('inst-in-ugc-42');
    });

    test('creates a stable slug from the university name and source ID', () => {
      expect(makeRecord().slug).toBe('example-university-42');
    });

    test('normalizes the website URL', () => {
      expect(makeRecord().website).toBe('https://www.example.edu/');
    });

    test('uses the supplied state mapping', () => {
      const record = makeRecord();

      expect(record.stateId).toBe(states.get('maharashtra'));
    });

    test('normalizes the university name when generating the slug', () => {
      const record = makeRecord({
        uni_name: '  Example   Medical University  ',
      });

      expect(record.slug).toBe('example-medical-university-42');
    });

    test('keeps imported records pending review', () => {
      const record = makeRecord({
        status: '2(f)',
      });

      expect(record.verificationStatus).toBe('pending-review');
      expect(record.verifiedAt).toBeNull();
    });

    test('does not treat a source status as verification', () => {
      const record = makeRecord({
        status: 'Verified',
      });

      expect(record.verificationStatus).toBe('pending-review');
      expect(record.verifiedAt).toBeNull();
    });

    test('does not copy a source password field', () => {
      const record = makeRecord();

      expect(record).not.toHaveProperty('user_password');
      expect(serializeRecord(record)).not.toContain(
        'must-not-be-copied',
      );
    });

    test('does not copy unexpected sensitive source fields', () => {
      const record = makeRecord({
        internal_token: 'test-secret-token',
        api_key: 'test-secret-api-key',
        password: 'test-secret-password',
        private_notes: 'test-internal-note',
        access_token: 'test-access-token',
        authorization: 'Bearer test-authorization',
        secret: 'test-secret-value',
      });

      for (const field of [
        'internal_token',
        'api_key',
        'password',
        'private_notes',
        'access_token',
        'authorization',
        'secret',
      ]) {
        expect(record).not.toHaveProperty(field);
      }

      const serialized = serializeRecord(record);

      for (const secret of [
        'test-secret-token',
        'test-secret-api-key',
        'test-secret-password',
        'test-internal-note',
        'test-access-token',
        'test-authorization',
        'test-secret-value',
      ]) {
        expect(serialized).not.toContain(secret);
      }
    });

    test('does not copy arbitrary source properties', () => {
      const record = makeRecord({
        arbitraryInjectedProperty: 'unexpected-value',
        __internalDebug: 'debug-value',
        admin: true,
      });

      expect(record).not.toHaveProperty('arbitraryInjectedProperty');
      expect(record).not.toHaveProperty('__internalDebug');
      expect(record).not.toHaveProperty('admin');

      expect(serializeRecord(record)).not.toContain('unexpected-value');
      expect(serializeRecord(record)).not.toContain('debug-value');
    });

    test('includes source provenance', () => {
      const record = makeRecord();

      expect(Array.isArray(record.sourceUrls)).toBe(true);
      expect(record.sourceUrls.length).toBeGreaterThan(0);

      for (const source of record.sourceUrls) {
        expect(source).toEqual(
          expect.objectContaining({
            sourceType: expect.any(String),
          }),
        );

        expect(source.sourceType.trim().length).toBeGreaterThan(0);
      }
    });

    test('marks source provenance as a government directory', () => {
      const record = makeRecord();

      expect(record.sourceUrls[0].sourceType).toBe(
        'government-directory',
      );
    });

    test('produces stable identifiers for identical input', () => {
      const first = makeRecord();
      const second = makeRecord();

      expect(second.id).toBe(first.id);
      expect(second.slug).toBe(first.slug);
    });

    test('does not mutate the original source record', () => {
      const source = { ...sourceRecord };
      const before = { ...source };

      createUniversityRecord(
        source,
        category,
        states,
        sourceDate,
        importedAt,
      );

      expect(source).toEqual(before);
    });

    test('does not mutate the supplied state map', () => {
      const stateMap = new Map(states);
      const before = [...stateMap.entries()];

      makeRecord({}, { stateMap });

      expect([...stateMap.entries()]).toEqual(before);
    });

    test('does not reuse a mutable output record between calls', () => {
      const first = makeRecord();
      const second = makeRecord();

      expect(first).not.toBe(second);
    });

    test('uses the supplied import timestamp when exposed by the schema', () => {
      const record = makeRecord();

      if (Object.hasOwn(record, 'importedAt')) {
        expect(record.importedAt).toBe(importedAt);
      }

      if (Object.hasOwn(record, 'createdAt')) {
        expect(record.createdAt).toBe(importedAt);
      }
    });

    test('does not mark a record verified when source data is incomplete', () => {
      const record = makeRecord({
        status: '',
      });

      expect(record.verificationStatus).toBe('pending-review');
      expect(record.verifiedAt).toBeNull();
    });

    test('rejects or safely handles a missing source record', () => {
      expect(() => {
        createUniversityRecord(
          null,
          category,
          states,
          sourceDate,
          importedAt,
        );
      }).toThrow();
    });

    test('rejects or safely handles a non-object source record', () => {
      for (const source of [undefined, 'university', 42, true]) {
        expect(() => {
          createUniversityRecord(
            source,
            category,
            states,
            sourceDate,
            importedAt,
          );
        }).toThrow();
      }
    });

    test('does not emit the literal string undefined in the record ID', () => {
      const record = makeRecord({
        ID: undefined,
      });

      expect(record.id).not.toContain('undefined');
    });

    test('does not emit the literal string null in the record ID', () => {
      const record = makeRecord({
        ID: null,
      });

      expect(record.id).not.toContain('null');
    });

    test('handles a missing website without creating an unsafe URL', () => {
      const record = makeRecord({
        url: '',
      });

      expect(
        record.website == null || typeof record.website === 'string',
      ).toBe(true);

      if (record.website) {
        expect(['http:', 'https:']).toContain(
          new URL(record.website).protocol,
        );
      }
    });

    test('does not create a JavaScript URL from source website data', () => {
      const record = makeRecord({
        url: 'javascript:alert(1)',
      });

      if (record.website) {
        expect(new URL(record.website).protocol).not.toBe('javascript:');
      }
    });
  });

  describe('normalizeWebsite', () => {
    test.each([
      ['null', null],
      ['literal null', 'null'],
      ['empty string', ''],
      ['whitespace-only string', '   '],
      ['comma-separated domains', 'first.example.edu, second.example.edu'],
      ['JavaScript URL', 'javascript:alert(1)'],
      ['data URL', 'data:text/html,hello'],
      ['file URL', 'file:///etc/passwd'],
      ['protocol-relative URL', '//example.edu'],
      ['unsupported FTP URL', 'ftp://example.edu'],
      ['unsupported mailto URL', 'mailto:admin@example.edu'],
    ])('rejects or ignores unsafe/missing input: %s', (_name, input) => {
      expect(normalizeWebsite(input)).toBeNull();
    });

    test('normalizes a bare domain to HTTPS', () => {
      expect(normalizeWebsite('www.example.edu')).toBe(
        'https://www.example.edu/',
      );
    });

    test('normalizes a bare domain without www', () => {
      expect(normalizeWebsite('example.edu')).toBe(
        'https://example.edu/',
      );
    });

    test('normalizes an HTTPS URL with no path', () => {
      expect(normalizeWebsite('https://www.example.edu')).toBe(
        'https://www.example.edu/',
      );
    });

    test('preserves a valid URL path', () => {
      expect(
        normalizeWebsite('https://www.example.edu/admissions'),
      ).toBe('https://www.example.edu/admissions');
    });

    test('preserves a valid query string', () => {
      expect(
        normalizeWebsite(
          'https://www.example.edu/admissions?source=directory',
        ),
      ).toBe(
        'https://www.example.edu/admissions?source=directory',
      );
    });

    test('preserves a valid fragment', () => {
      expect(
        normalizeWebsite('https://www.example.edu/#admissions'),
      ).toBe('https://www.example.edu/#admissions');
    });

    test('normalizes surrounding whitespace', () => {
      expect(normalizeWebsite('  www.example.edu  ')).toBe(
        'https://www.example.edu/',
      );
    });

    test('rejects URLs containing username credentials', () => {
      expect(
        normalizeWebsite('https://user@example.edu'),
      ).toBeNull();
    });

    test('rejects URLs containing username and password credentials', () => {
      expect(
        normalizeWebsite('https://user:password@example.edu'),
      ).toBeNull();
    });

    test.each([
      'https://',
      'http://',
      'https:///path',
      'javascript:alert(1)',
      'data:text/plain,test',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
    ])('rejects malformed or unsafe URL: %s', (input) => {
      expect(normalizeWebsite(input)).toBeNull();
    });

    test.each([
      null,
      undefined,
      123,
      {},
      [],
      true,
      false,
      123n,
      Symbol('website'),
    ])('rejects non-string input safely: %p', (input) => {
      expect(() => normalizeWebsite(input)).not.toThrow();
      expect(normalizeWebsite(input)).toBeNull();
    });

    test('rejects excessively long website input', () => {
      expect(
        normalizeWebsite(`https://${'a'.repeat(10000)}.example.edu`),
      ).toBeNull();
    });

    test('rejects embedded control characters', () => {
      expect(
        normalizeWebsite('https://example.edu/\nmalicious'),
      ).toBeNull();
    });

    test('does not convert an explicitly unsafe scheme into HTTPS', () => {
      expect(normalizeWebsite('javascript://example.edu')).toBeNull();
    });

    test('never returns a non-HTTP protocol for a successful normalization', () => {
      const candidates = [
        'example.edu',
        'www.example.edu',
        'https://example.edu',
        'http://example.edu',
        'javascript:alert(1)',
        'data:text/html,test',
        'file:///etc/passwd',
      ];

      for (const candidate of candidates) {
        const result = normalizeWebsite(candidate);

        if (result !== null) {
          expect(['http:', 'https:']).toContain(
            new URL(result).protocol,
          );
        }
      }
    });
  });

  describe('slugify', () => {
    test('creates URL-safe slugs', () => {
      expect(slugify('Banaras Hindu University')).toBe(
        'banaras-hindu-university',
      );
    });

    test('normalizes repeated whitespace', () => {
      expect(
        slugify('  Example   Medical   University  '),
      ).toBe('example-medical-university');
    });

    test('normalizes uppercase characters', () => {
      expect(slugify('EXAMPLE UNIVERSITY')).toBe(
        'example-university',
      );
    });

    test('removes punctuation and special separators', () => {
      expect(
        slugify('University of Health & Sciences!'),
      ).toBe('university-of-health-sciences');
    });

    test('preserves an already normalized slug', () => {
      expect(slugify('example-university')).toBe(
        'example-university',
      );
    });

    test('does not produce whitespace', () => {
      expect(
        slugify('Medical University of India'),
      ).not.toMatch(/\s/);
    });

    test('does not produce leading or trailing hyphens', () => {
      expect(slugify('---Example University---')).not.toMatch(
        /^-|-$/,
      );
    });

    test('collapses repeated hyphens', () => {
      expect(slugify('Example---Medical---University')).toBe(
        'example-medical-university',
      );
    });

    test('removes underscores as separators', () => {
      expect(slugify('Example_Medical_University')).toBe(
        'example-medical-university',
      );
    });

    test('handles numeric names', () => {
      expect(slugify('University 2026')).toBe('university-2026');
    });

    test('handles empty input', () => {
      expect(slugify('')).toBe('');
    });

    test('handles whitespace-only input', () => {
      expect(slugify('    ')).toBe('');
    });

    test('handles punctuation-only input', () => {
      expect(slugify('!@#$%^&*()')).toBe('');
    });

    test.each([
      null,
      undefined,
      123,
      {},
      [],
      true,
      false,
      Symbol('slug'),
    ])('handles non-string input safely: %p', (input) => {
      expect(() => slugify(input)).not.toThrow();
    });

    test('does not produce leading or trailing whitespace', () => {
      const result = slugify('  Medical University of India  ');

      expect(result).toBe(result.trim());
    });

    test('is deterministic for identical inputs', () => {
      const value = 'Example Medical University';

      expect(slugify(value)).toBe(slugify(value));
    });

    test('does not emit HTML markup for HTML-like input', () => {
      const result = slugify('<script>alert(1)</script>');

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('/');
    });
  });
});
