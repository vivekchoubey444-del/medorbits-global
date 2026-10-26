
'use strict';

/**
 * MedOrbits -- Public Release Publication Policy Tests
 * File: tests/unit/public-releases.service.test.js
 *
 * Coverage:
 * - Publication, activation, and verification requirements
 * - Official-source URL validation
 * - Expiration and future-publication filtering
 * - Notice and bulletin classification
 * - Invalid arguments, dates, and collection types
 * - Malformed records and defensive handling
 * - Input immutability and deterministic output
 * - Exclusion of unpublished or untrusted content
 *
 * Run:
 *   npx jest tests/unit/public-releases.service.test.js --runInBand
 */

const {
  listPublicReleases,
} = require('../../src/services/public-releases.service');

const SOURCE = Object.freeze({
  name: 'Official source',
  url: 'https://example.gov.in/notice',
});

const AS_OF = new Date('2026-10-17T12:00:00.000Z');

function makeNotice(overrides = {}) {
  return {
    id: 'notice-current',
    newsType: 'official_notice',
    publicationStatus: 'published',
    verificationStatus: 'verified',
    active: true,
    publishedAt: '2026-10-17T10:00:00.000Z',
    officialNoticeUrl: SOURCE.url,
    ...overrides,
  };
}

function makeBulletin(overrides = {}) {
  return {
    id: 'bulletin-current',
    publicationStatus: 'published',
    verificationStatus: 'content_reviewed',
    active: true,
    publishedAt: '2026-10-17T09:00:00.000Z',
    source: SOURCE,
    ...overrides,
  };
}

function listReleases({
  news = [],
  bulletins = [],
  asOf = AS_OF,
} = {}) {
  return listPublicReleases({
    news,
    bulletins,
    asOf,
  });
}

describe('public release publication policy', () => {
  describe('configuration and result contract', () => {
    test('exports the public release listing function', () => {
      expect(typeof listPublicReleases).toBe('function');
    });

    test('returns notice and bulletin arrays', () => {
      const result = listReleases();

      expect(result).toEqual(
        expect.objectContaining({
          notices: expect.any(Array),
          bulletins: expect.any(Array),
        }),
      );
    });

    test('returns empty arrays for empty collections', () => {
      const result = listReleases();

      expect(result.notices).toEqual([]);
      expect(result.bulletins).toEqual([]);
    });

    test('returns the same result for identical inputs and reference time', () => {
      const input = {
        news: [makeNotice()],
        bulletins: [makeBulletin()],
        asOf: AS_OF,
      };

      const first = listPublicReleases(input);
      const second = listPublicReleases(input);

      expect(second).toEqual(first);
    });
  });

  describe('publication eligibility', () => {
    test('returns only approved, active, sourced, unexpired notices and bulletins', () => {
      const result = listReleases({
        news: [
          makeNotice(),
          makeNotice({
            id: 'notice-draft',
            publicationStatus: 'draft',
            verificationStatus: 'pending_review',
            active: false,
            source: SOURCE,
          }),
          makeNotice({
            id: 'notice-expired',
            newsType: 'announcement',
            verificationStatus: 'content_reviewed',
            expiresAt: '2026-10-16T00:00:00.000Z',
            officialNoticeUrl: undefined,
            source: SOURCE,
          }),
        ],
        bulletins: [
          makeBulletin(),
        ],
      });

      expect(result.notices.map((item) => item.id)).toEqual([
        'notice-current',
      ]);

      expect(result.bulletins.map((item) => item.id)).toEqual([
        'bulletin-current',
      ]);
    });

    test.each([
      ['draft', { publicationStatus: 'draft' }],
      ['pending publication', { publicationStatus: 'pending' }],
      ['archived', { publicationStatus: 'archived' }],
      ['rejected', { publicationStatus: 'rejected' }],
      ['unpublished', { publicationStatus: 'unpublished' }],
    ])('rejects a %s notice', (_description, overrides) => {
      const result = listReleases({
        news: [makeNotice(overrides)],
      });

      expect(result.notices).toHaveLength(0);
    });

    test.each([
      ['inactive', { active: false }],
      ['unverified', { verificationStatus: 'pending_review' }],
      ['missing verification', { verificationStatus: undefined }],
      ['missing active flag', { active: undefined }],
      ['null active flag', { active: null }],
      ['string active flag', { active: 'true' }],
    ])('rejects an %s notice', (_description, overrides) => {
      const result = listReleases({
        news: [makeNotice(overrides)],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('rejects a notice without a usable source URL', () => {
      const result = listReleases({
        news: [
          makeNotice({
            officialNoticeUrl: undefined,
            sourceUrl: undefined,
            source: undefined,
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('rejects a bulletin without a usable source', () => {
      const result = listReleases({
        bulletins: [
          makeBulletin({
            source: undefined,
            sourceUrl: undefined,
            officialNoticeUrl: undefined,
          }),
        ],
      });

      expect(result.bulletins).toHaveLength(0);
    });

    test('does not accept truthy strings as publication approval', () => {
      const result = listReleases({
        news: [
          makeNotice({
            active: 'true',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('does not accept a string publication date in the future', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publishedAt: '2026-10-18T10:00:00.000Z',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });
  });

  describe('verification policy', () => {
    test.each([
      'pending_review',
      'pending-review',
      'unverified',
      'rejected',
      '',
      null,
      undefined,
    ])('rejects notice with verification status %p', (status) => {
      const result = listReleases({
        news: [
          makeNotice({
            verificationStatus: status,
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('accepts a verified notice', () => {
      const result = listReleases({
        news: [
          makeNotice({
            verificationStatus: 'verified',
          }),
        ],
      });

      expect(result.notices.map((item) => item.id)).toEqual([
        'notice-current',
      ]);
    });

    test('accepts a content-reviewed bulletin', () => {
      const result = listReleases({
        bulletins: [
          makeBulletin({
            verificationStatus: 'content_reviewed',
          }),
        ],
      });

      expect(result.bulletins.map((item) => item.id)).toEqual([
        'bulletin-current',
      ]);
    });

    test('does not promote a draft merely because it is verified', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publicationStatus: 'draft',
            verificationStatus: 'verified',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });
  });

  describe('source URL security', () => {
    test.each([
      ['HTTP', 'http://example.gov.in/notice'],
      ['JavaScript', 'javascript:alert(1)'],
      ['data URL', 'data:text/html,unsafe'],
      ['file URL', 'file:///etc/passwd'],
      ['protocol-relative URL', '//example.gov.in/notice'],
      ['empty URL', ''],
      ['whitespace URL', '   '],
      ['malformed URL', 'https://'],
    ])('rejects %s notice source URLs', (_description, url) => {
      const result = listReleases({
        news: [
          makeNotice({
            officialNoticeUrl: url,
            sourceUrl: url,
            source: {
              name: 'Untrusted source',
              url,
            },
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('rejects non-string source URLs', () => {
      for (const url of [null, undefined, 123, {}, [], true]) {
        const result = listReleases({
          news: [
            makeNotice({
              officialNoticeUrl: url,
              sourceUrl: url,
              source: {
                name: 'Test source',
                url,
              },
            }),
          ],
        });

        expect(result.notices).toHaveLength(0);
      }
    });

    test('does not accept a valid URL from an unrelated source field alone', () => {
      const result = listReleases({
        news: [
          makeNotice({
            officialNoticeUrl: undefined,
            sourceUrl: undefined,
            source: {
              name: 'Official source',
              url: SOURCE.url,
            },
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('does not publish an insecure URL even when all other fields are eligible', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publicationStatus: 'published',
            verificationStatus: 'verified',
            active: true,
            officialNoticeUrl: 'http://example.gov.in/notice',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });
  });

  describe('publication dates and expiration', () => {
    test('rejects notices published after the reference time', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publishedAt: '2026-10-18T10:00:00.000Z',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('accepts a notice published before the reference time', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publishedAt: '2026-10-17T10:00:00.000Z',
          }),
        ],
      });

      expect(result.notices).toHaveLength(1);
    });

    test('accepts a notice published exactly at the reference time', () => {
      const result = listReleases({
        news: [
          makeNotice({
            publishedAt: AS_OF.toISOString(),
          }),
        ],
      });

      expect(result.notices).toHaveLength(1);
    });

    test('rejects expired notices', () => {
      const result = listReleases({
        news: [
          makeNotice({
            expiresAt: '2026-10-16T00:00:00.000Z',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('accepts notices without an expiry date', () => {
      const result = listReleases({
        news: [
          makeNotice({
            expiresAt: undefined,
          }),
        ],
      });

      expect(result.notices).toHaveLength(1);
    });

    test('accepts a notice expiring exactly at the reference time if expiry is inclusive', () => {
      const result = listReleases({
        news: [
          makeNotice({
            expiresAt: AS_OF.toISOString(),
          }),
        ],
      });

      // Expiration boundary policy must be explicit. This test expects
      // an item to remain active through its exact expiry timestamp.
      expect(result.notices).toHaveLength(1);
    });

    test.each([
      'not-a-date',
      '2026-13-40T99:99:99Z',
      '',
      null,
    ])('rejects a notice with malformed expiry %p', (expiresAt) => {
      const result = listReleases({
        news: [
          makeNotice({
            expiresAt,
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test.each([
      'not-a-date',
      '',
      null,
    ])('rejects a notice with malformed publication date %p', (publishedAt) => {
      const result = listReleases({
        news: [
          makeNotice({
            publishedAt,
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });
  });

  describe('notice and bulletin classification', () => {
    test('does not classify ordinary announcements as official notices', () => {
      const result = listReleases({
        news: [
          makeNotice({
            newsType: 'announcement',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('does not classify an unrelated news type as an official notice', () => {
      const result = listReleases({
        news: [
          makeNotice({
            newsType: 'social_post',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
    });

    test('keeps notices and bulletins in separate result collections', () => {
      const result = listReleases({
        news: [makeNotice()],
        bulletins: [makeBulletin()],
      });

      expect(result.notices.map((item) => item.id)).toEqual([
        'notice-current',
      ]);

      expect(result.bulletins.map((item) => item.id)).toEqual([
        'bulletin-current',
      ]);
    });
  });

  describe('invalid arguments and defensive behavior', () => {
    test.each([
      null,
      undefined,
      'invalid',
      42,
      true,
    ])('rejects invalid asOf value %p', (asOf) => {
      expect(() => listPublicReleases({
        news: [],
        bulletins: [],
        asOf,
      })).toThrow(TypeError);
    });

    test('rejects an invalid Date instance', () => {
      expect(() => listPublicReleases({
        news: [],
        bulletins: [],
        asOf: new Date('invalid'),
      })).toThrow(TypeError);
    });

    test.each([
      ['news object', {}],
      ['news string', 'invalid'],
      ['news number', 42],
      ['bulletins object', {}],
      ['bulletins string', 'invalid'],
      ['bulletins number', 42],
    ])('rejects invalid release collection: %s', (_description, value) => {
      const input = {
        news: [],
        bulletins: [],
        asOf: AS_OF,
      };

      if (_description.startsWith('news ')) {
        input.news = value;
      } else {
        input.bulletins = value;
      }

      expect(() => listPublicReleases(input)).toThrow(TypeError);
    });

    test('rejects a null options object', () => {
      expect(() => listPublicReleases(null)).toThrow(TypeError);
    });

    test('rejects a non-object options argument', () => {
      expect(() => listPublicReleases('invalid')).toThrow(TypeError);
    });

    test('handles an empty options object according to the required-argument contract', () => {
      expect(() => listPublicReleases({})).toThrow(TypeError);
    });

    test('rejects null collection entries or safely excludes them', () => {
      const result = listReleases({
        news: [null, makeNotice()],
      });

      expect(result.notices.map((item) => item.id)).toEqual([
        'notice-current',
      ]);
    });

    test('does not throw for ordinary malformed records', () => {
      expect(() => listReleases({
        news: [
          {},
          { id: null },
          { id: '' },
          { id: 0 },
          { id: [] },
          { id: {} },
        ],
        bulletins: [
          {},
          { id: null },
          { id: '' },
        ],
      })).not.toThrow();
    });
  });

  describe('input integrity and data exposure', () => {
    test('does not mutate the supplied news records', () => {
      const news = [makeNotice()];
      const before = structuredClone(news);

      listReleases({ news });

      expect(news).toEqual(before);
    });

    test('does not mutate the supplied bulletin records', () => {
      const bulletins = [makeBulletin()];
      const before = structuredClone(bulletins);

      listReleases({ bulletins });

      expect(bulletins).toEqual(before);
    });

    test('does not mutate the supplied reference date', () => {
      const asOf = new Date(AS_OF);
      const originalTime = asOf.getTime();

      listReleases({ asOf });

      expect(asOf.getTime()).toBe(originalTime);
    });

    test('does not include rejected draft records in the output', () => {
      const result = listReleases({
        news: [
          makeNotice({
            id: 'public-notice',
          }),
          makeNotice({
            id: 'internal-draft',
            publicationStatus: 'draft',
          }),
        ],
      });

      const ids = result.notices.map((item) => item.id);

      expect(ids).toContain('public-notice');
      expect(ids).not.toContain('internal-draft');
    });

    test('does not include unapproved content in either result collection', () => {
      const result = listReleases({
        news: [
          makeNotice({
            id: 'pending-news',
            verificationStatus: 'pending_review',
          }),
        ],
        bulletins: [
          makeBulletin({
            id: 'draft-bulletin',
            publicationStatus: 'draft',
          }),
        ],
      });

      expect(result.notices).toHaveLength(0);
      expect(result.bulletins).toHaveLength(0);
    });
  });
});
