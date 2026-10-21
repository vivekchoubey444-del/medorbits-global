'use strict';

const { listPublicReleases } = require('../../src/services/public-releases.service');

const source = {
  name: 'Official source',
  url: 'https://example.gov.in/notice',
};

describe('public release publication policy', () => {
  const asOf = new Date('2026-10-17T12:00:00Z');

  test('returns only approved, active, sourced, unexpired notices and bulletins', () => {
    const result = listPublicReleases({
      news: [
        {
          id: 'notice-current',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: true,
          publishedAt: '2026-10-17T10:00:00Z',
          officialNoticeUrl: source.url,
        },
        {
          id: 'notice-draft',
          newsType: 'official_notice',
          publicationStatus: 'draft',
          verificationStatus: 'pending_review',
          active: false,
          source,
        },
        {
          id: 'notice-expired',
          newsType: 'announcement',
          publicationStatus: 'published',
          verificationStatus: 'content_reviewed',
          active: true,
          source,
          expiresAt: '2026-10-16T00:00:00Z',
        },
      ],
      bulletins: [
        {
          id: 'bulletin-current',
          publicationStatus: 'published',
          verificationStatus: 'content_reviewed',
          active: true,
          publishedAt: '2026-10-17T09:00:00Z',
          source,
        },
      ],
      asOf,
    });

    expect(result).toEqual(
      expect.objectContaining({
        notices: expect.any(Array),
        bulletins: expect.any(Array),
      })
    );

    expect(result.notices.map((item) => item.id)).toEqual([
      'notice-current',
    ]);

    expect(result.bulletins.map((item) => item.id)).toEqual([
      'bulletin-current',
    ]);
  });

  test('rejects non-HTTPS sources and invalid inputs', () => {
    const result = listPublicReleases({
      news: [
        {
          id: 'insecure-notice',
          newsType: 'announcement',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: true,
          sourceUrl: 'http://example.gov.in/notice',
        },
      ],
      bulletins: [],
      asOf: new Date('2026-10-17T00:00:00Z'),
    });

    expect(result.notices).toHaveLength(0);
    expect(result.bulletins).toHaveLength(0);

    expect(() =>
      listPublicReleases({
        news: {},
        bulletins: [],
        asOf,
      })
    ).toThrow(TypeError);
  });

  test('rejects unpublished, inactive, or unverified notices', () => {
    const result = listPublicReleases({
      news: [
        {
          id: 'draft',
          newsType: 'official_notice',
          publicationStatus: 'draft',
          verificationStatus: 'verified',
          active: true,
          officialNoticeUrl: source.url,
        },
        {
          id: 'inactive',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: false,
          officialNoticeUrl: source.url,
        },
        {
          id: 'unverified',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'pending_review',
          active: true,
          officialNoticeUrl: source.url,
        },
      ],
      bulletins: [],
      asOf,
    });

    expect(result.notices).toHaveLength(0);
    expect(result.bulletins).toHaveLength(0);
  });

  test('rejects releases that have not yet been published', () => {
    const result = listPublicReleases({
      news: [
        {
          id: 'future-notice',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: true,
          publishedAt: '2026-10-18T10:00:00Z',
          officialNoticeUrl: source.url,
        },
      ],
      bulletins: [],
      asOf,
    });

    expect(result.notices).toHaveLength(0);
  });

  test('rejects expired releases and accepts releases without an expiry date', () => {
    const result = listPublicReleases({
      news: [
        {
          id: 'expired',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: true,
          publishedAt: '2026-10-15T10:00:00Z',
          expiresAt: '2026-10-16T00:00:00Z',
          officialNoticeUrl: source.url,
        },
        {
          id: 'no-expiry',
          newsType: 'official_notice',
          publicationStatus: 'published',
          verificationStatus: 'verified',
          active: true,
          publishedAt: '2026-10-17T10:00:00Z',
          officialNoticeUrl: source.url,
        },
      ],
      bulletins: [],
      asOf,
    });

    expect(result.notices.map((item) => item.id)).toEqual([
      'no-expiry',
    ]);
  });

  test('handles empty release collections', () => {
    const result = listPublicReleases({
      news: [],
      bulletins: [],
      asOf,
    });

    expect(result.notices).toEqual([]);
    expect(result.bulletins).toEqual([]);
  });

  test.each([
    null,
    undefined,
    {},
    [],
    'invalid-date',
  ])('rejects invalid asOf value: %p', (invalidAsOf) => {
    expect(() =>
      listPublicReleases({
        news: [],
        bulletins: [],
        asOf: invalidAsOf,
      })
    ).toThrow(TypeError);
  });
});