'use strict';

const {
  CATEGORIES,
  createUniversityRecord,
  normalizeWebsite,
  slugify,
} = require('../../scripts/import-ugc-universities');

describe('UGC university importer', () => {
  const category = CATEGORIES.find((item) => item.label === 'Private');
  const states = new Map([['maharashtra', 'state-in-mh']]);
  const sourceDate = '2026-10-17';
  const importedAt = '2026-10-17T00:00:00.000Z';

  const sourceRecord = {
    ID: '42',
    uni_name: 'Example University',
    uni_type: 'Private',
    state: 'Maharashtra',
    address: 'Pune',
    Zip: '411001',
    status: '2(f)',
    url: 'www.example.edu',
    user_password: 'must-not-be-copied',
  };

  function makeRecord(overrides = {}) {
    return createUniversityRecord(
      { ...sourceRecord, ...overrides },
      category,
      states,
      sourceDate,
      importedAt,
    );
  }

  describe('configuration', () => {
    test('exports university categories', () => {
      expect(Array.isArray(CATEGORIES)).toBe(true);
      expect(CATEGORIES.length).toBeGreaterThan(0);
      expect(category).toBeDefined();
    });

    test('exports the expected helper functions', () => {
      expect(typeof createUniversityRecord).toBe('function');
      expect(typeof normalizeWebsite).toBe('function');
      expect(typeof slugify).toBe('function');
    });
  });

  describe('createUniversityRecord', () => {
    test('creates a stable, source-backed record', () => {
      const record = makeRecord();

      expect(record.id).toBe('inst-in-ugc-42');
      expect(record.slug).toBe('example-university-42');
      expect(record.stateId).toBe('state-in-mh');
      expect(record.website).toBe('https://www.example.edu/');
      expect(record.verificationStatus).toBe('pending-review');
      expect(record.verifiedAt).toBeNull();
      expect(record.sourceUrls[0].sourceType).toBe(
        'government-directory',
      );
    });

    test('does not copy private feed fields', () => {
      const record = makeRecord();

      expect(record).not.toHaveProperty('user_password');
      expect(JSON.stringify(record)).not.toContain('must-not-be-copied');
    });

    test('does not expose unexpected sensitive source fields', () => {
      const record = makeRecord({
        internal_token: 'secret-token',
        api_key: 'secret-api-key',
        password: 'secret-password',
        private_notes: 'internal note',
      });

      expect(record).not.toHaveProperty('internal_token');
      expect(record).not.toHaveProperty('api_key');
      expect(record).not.toHaveProperty('password');
      expect(record).not.toHaveProperty('private_notes');

      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain('secret-token');
      expect(serialized).not.toContain('secret-api-key');
      expect(serialized).not.toContain('secret-password');
      expect(serialized).not.toContain('internal note');
    });

    test('uses the supplied state mapping', () => {
      expect(makeRecord().stateId).toBe(states.get('maharashtra'));
    });

    test('generates a normalized slug from the university name', () => {
      const record = makeRecord({
        uni_name: '  Example   Medical University  ',
      });

      expect(record.slug).toBe('example-medical-university-42');
    });

    test('keeps imported records pending review', () => {
      const record = makeRecord({ status: '2(f)' });

      expect(record.verificationStatus).toBe('pending-review');
      expect(record.verifiedAt).toBeNull();
    });

    test('produces stable identifiers for identical input', () => {
      const first = makeRecord();
      const second = makeRecord();

      expect(second.id).toBe(first.id);
      expect(second.slug).toBe(first.slug);
    });

    test('includes source provenance', () => {
      const record = makeRecord();

      expect(Array.isArray(record.sourceUrls)).toBe(true);
      expect(record.sourceUrls.length).toBeGreaterThan(0);

      for (const source of record.sourceUrls) {
        expect(source.sourceType).toBeDefined();
      }
    });
  });

  describe('normalizeWebsite', () => {
    test.each([
      ['Null', null],
      ['null', null],
      ['', null],
      ['   ', null],
      ['first.example.edu, second.example.edu', null],
      ['javascript:alert(1)', null],
      ['data:text/html,hello', null],
      ['file:///etc/passwd', null],
      ['//example.edu', null],
    ])('handles website input %j', (input, expected) => {
      expect(normalizeWebsite(input)).toBe(expected);
    });

    test('normalizes a bare domain to HTTPS', () => {
      expect(normalizeWebsite('www.example.edu')).toBe(
        'https://www.example.edu/',
      );
    });

    test('normalizes HTTPS URLs', () => {
      expect(normalizeWebsite('https://www.example.edu')).toBe(
        'https://www.example.edu/',
      );
    });

    test('preserves a valid URL path', () => {
      expect(
        normalizeWebsite('https://www.example.edu/admissions'),
      ).toBe('https://www.example.edu/admissions');
    });

    test.each([null, undefined, 123, {}, [], true])(
      'rejects non-string website input: %j',
      (input) => {
        expect(normalizeWebsite(input)).toBeNull();
      },
    );

    test('rejects URLs containing credentials', () => {
      expect(
        normalizeWebsite('https://user:password@example.edu'),
      ).toBeNull();
    });

    test.each(['https://', 'http://', 'javascript:alert(1)'])(
      'rejects malformed or unsafe URL: %s',
      (input) => {
        expect(normalizeWebsite(input)).toBeNull();
      },
    );
  });

  describe('slugify', () => {
    test('creates URL-safe slugs', () => {
      expect(slugify('Banaras Hindu University')).toBe(
        'banaras-hindu-university',
      );
    });

    test('normalizes whitespace', () => {
      expect(slugify('  Example   Medical   University  ')).toBe(
        'example-medical-university',
      );
    });

    test('normalizes uppercase characters', () => {
      expect(slugify('EXAMPLE UNIVERSITY')).toBe('example-university');
    });

    test('removes punctuation and special separators', () => {
      expect(slugify('University of Health & Sciences!')).toBe(
        'university-of-health-sciences',
      );
    });

    test('preserves an already normalized slug', () => {
      expect(slugify('example-university')).toBe('example-university');
    });

    test('does not produce whitespace', () => {
      expect(slugify('Medical University of India')).not.toMatch(/\s/);
    });

    test('does not produce leading or trailing hyphens', () => {
      expect(slugify('---Example University---')).not.toMatch(/^-|-$/);
    });
  });
});