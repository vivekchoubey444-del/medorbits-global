
'use strict';

/**
 * MedOrbits -- Course Test Fixtures
 *
 * File: tests/fixtures/courses.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Reusable synthetic course records and payloads for unit, integration,
 *   API, search, filtering, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic course data only.
 *   - Does not assert real-world fees, admissions criteria, or recognition.
 *   - Separates ordinary payload defaults from server-managed fields.
 *   - Does not create database records or establish permissions.
 *   - Does not replace production validation or authorization.
 *
 * Module format: CommonJS.
 */

const COURSE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

const COURSE_CATEGORIES = Object.freeze({
  MEDICAL: 'medical',
  DENTAL: 'dental',
  AYUSH: 'ayush',
  PARAMEDICAL: 'paramedical',
  NURSING: 'nursing',
  PHARMACY: 'pharmacy',
  ALLIED_HEALTH: 'allied_health',
  ENGINEERING: 'engineering',
  MANAGEMENT: 'management',
  OTHER: 'other',
});

const COURSE_TYPES = Object.freeze({
  MBBS: 'mbbs',
  BDS: 'bds',
  BAMS: 'bams',
  BUMS: 'bums',
  BHMS: 'bhms',
  BSC_NURSING: 'bsc_nursing',
  GNM: 'gnm',
  PHARMACY: 'pharmacy',
  PARAMEDICAL: 'paramedical',
  OTHER: 'other',
});

const COURSE_STATUS_VALUES = Object.freeze(
  Object.values(COURSE_STATUSES),
);

const COURSE_CATEGORY_VALUES = Object.freeze(
  Object.values(COURSE_CATEGORIES),
);

const COURSE_TYPE_VALUES = Object.freeze(
  Object.values(COURSE_TYPES),
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'code',
  'status',
  'isPublished',
  'isFeatured',
  'createdAt',
  'updatedAt',
]);

const MAX_COURSE_SET_SIZE = 1000;
const MAX_CLONE_DEPTH = 50;

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const DEFAULT_COURSE = Object.freeze({
  id: 'course_test_0001',
  slug: 'test-mbbs-course',
  code: 'MO-COURSE-TEST-0001',
  title: 'Test Bachelor of Medicine and Bachelor of Surgery',
  shortTitle: 'Test MBBS',
  description: 'Synthetic medical course record for automated testing.',
  category: COURSE_CATEGORIES.MEDICAL,
  courseType: COURSE_TYPES.MBBS,
  qualificationLevel: 'undergraduate',
  duration: Object.freeze({
    value: 5.5,
    unit: 'years',
    internshipIncluded: true,
  }),
  studyMode: 'full_time',
  deliveryMode: 'on_campus',
  eligibility: Object.freeze({
    summary: 'Synthetic eligibility summary for testing only.',
    requirements: Object.freeze([]),
    entranceExams: Object.freeze([]),
    minimumAge: null,
    maximumAge: null,
  }),
  fees: Object.freeze({
    currency: 'INR',
    amount: null,
    period: null,
    notes: 'No fee amount is asserted by this fixture.',
  }),
  institutionIds: Object.freeze([
    'institution_test_0001',
  ]),
  location: Object.freeze({
    countryCode: 'IN',
    state: 'Uttar Pradesh',
    city: 'Noida',
  }),
  academicYear: '2026-2027',
  languageOfInstruction: Object.freeze(['en']),
  status: COURSE_STATUSES.ACTIVE,
  isPublished: true,
  isFeatured: false,
  officialUrl: null,
  brochureUrl: null,
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});

/**
 * Assert that a value is a plain object.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {void}
 */
function assertPlainObject(value, label) {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype
    && prototype !== null
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

/**
 * Recursively clone JSON-compatible fixture data.
 *
 * Rejects circular references, accessors, unsupported object types,
 * dangerous property names, non-finite numbers, and excessive depth.
 *
 * @param {unknown} value
 * @param {string} [label]
 * @param {WeakSet<object>} [ancestors]
 * @param {number} [depth]
 * @returns {any}
 */
function clone(
  value,
  label = 'Fixture value',
  ancestors = new WeakSet(),
  depth = 0,
) {
  if (depth > MAX_CLONE_DEPTH) {
    throw new RangeError(`${label} exceeds maximum nesting depth`);
  }

  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${label} contains a non-finite number`);
    }

    return value;
  }

  if (typeof value !== 'object') {
    throw new TypeError(`${label} contains an unsupported value`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${label} must not contain circular references`);
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => (
        clone(item, `${label}[${index}]`, ancestors, depth + 1)
      ));
    }

    assertPlainObject(value, label);

    const result = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        throw new TypeError(`${label} must not contain symbol keys`);
      }

      if (FORBIDDEN_KEYS.has(key)) {
        throw new TypeError(`${label} contains a prohibited property name`);
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(`${label}.${key} must be a data property`);
      }

      result[key] = clone(
        descriptor.value,
        `${label}.${key}`,
        ancestors,
        depth + 1,
      );
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Validate and copy an array.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {any[]}
 */
function cloneArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }

  return clone(value, label);
}

/**
 * Merge a nested plain-object field with its defaults.
 *
 * @param {object} base
 * @param {unknown} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(base, overrides, label) {
  assertPlainObject(overrides, label);

  return {
    ...clone(base, `${label} defaults`),
    ...clone(overrides, label),
  };
}

/**
 * Validate a course status.
 *
 * @param {unknown} status
 * @returns {string}
 */
function assertCourseStatus(status) {
  if (!COURSE_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported course status: ${status}`);
  }

  return status;
}

/**
 * Validate a course category.
 *
 * @param {unknown} category
 * @returns {string}
 */
function assertCourseCategory(category) {
  if (!COURSE_CATEGORY_VALUES.includes(category)) {
    throw new RangeError(`Unsupported course category: ${category}`);
  }

  return category;
}

/**
 * Validate a course type.
 *
 * @param {unknown} courseType
 * @returns {string}
 */
function assertCourseType(courseType) {
  if (!COURSE_TYPE_VALUES.includes(courseType)) {
    throw new RangeError(`Unsupported course type: ${courseType}`);
  }

  return courseType;
}

/**
 * Validate an optional HTTP or HTTPS URL.
 *
 * This is fixture-level format validation, not a security guarantee
 * for fetching the URL. Production code must apply its own URL policy.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {void}
 */
function assertOptionalHttpUrl(value, label) {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string or null`);
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be a valid absolute URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${label} must use HTTP or HTTPS`);
  }
}

/**
 * Normalize and validate nested course fields.
 *
 * @param {object} course
 * @returns {object}
 */
function normalizeCourse(course) {
  assertCourseStatus(course.status);
  assertCourseCategory(course.category);
  assertCourseType(course.courseType);

  for (const field of [
    'duration',
    'eligibility',
    'fees',
    'location',
  ]) {
    assertPlainObject(course[field], `Course ${field}`);
  }

  course.institutionIds = cloneArray(
    course.institutionIds,
    'institutionIds',
  );

  course.languageOfInstruction = cloneArray(
    course.languageOfInstruction,
    'languageOfInstruction',
  );

  course.eligibility.requirements = cloneArray(
    course.eligibility.requirements,
    'eligibility.requirements',
  );

  course.eligibility.entranceExams = cloneArray(
    course.eligibility.entranceExams,
    'eligibility.entranceExams',
  );

  assertOptionalHttpUrl(course.officialUrl, 'officialUrl');
  assertOptionalHttpUrl(course.brochureUrl, 'brochureUrl');

  return course;
}

/**
 * Create a fresh course record.
 *
 * Nested objects are merged with their defaults. Array fields are
 * independently copied to prevent mutation leaking between fixtures.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourse(overrides = {}) {
  assertPlainObject(overrides, 'Course overrides');

  const safeOverrides = clone(overrides, 'Course overrides');

  const course = {
    ...clone(DEFAULT_COURSE, 'Default course'),
    ...safeOverrides,
  };

  for (const field of [
    'duration',
    'eligibility',
    'fees',
    'location',
  ]) {
    course[field] = mergeObject(
      DEFAULT_COURSE[field],
      safeOverrides[field] === undefined
        ? {}
        : safeOverrides[field],
      `${field} overrides`,
    );
  }

  for (const field of [
    'institutionIds',
    'languageOfInstruction',
  ]) {
    course[field] = cloneArray(
      safeOverrides[field] === undefined
        ? DEFAULT_COURSE[field]
        : safeOverrides[field],
      field,
    );
  }

  return normalizeCourse(course);
}

/**
 * Create a client-submittable course payload.
 *
 * Server-managed fields are excluded from ordinary defaults. Explicit
 * overrides remain supported for negative and security tests.
 *
 * The production API must independently enforce an input allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCoursePayload(overrides = {}) {
  assertPlainObject(overrides, 'Course payload overrides');

  const safeOverrides = clone(overrides, 'Course payload overrides');

  const payload = {
    slug: DEFAULT_COURSE.slug,
    title: DEFAULT_COURSE.title,
    shortTitle: DEFAULT_COURSE.shortTitle,
    description: DEFAULT_COURSE.description,
    category: DEFAULT_COURSE.category,
    courseType: DEFAULT_COURSE.courseType,
    qualificationLevel: DEFAULT_COURSE.qualificationLevel,
    duration: clone(DEFAULT_COURSE.duration),
    studyMode: DEFAULT_COURSE.studyMode,
    deliveryMode: DEFAULT_COURSE.deliveryMode,
    eligibility: clone(DEFAULT_COURSE.eligibility),
    fees: clone(DEFAULT_COURSE.fees),
    institutionIds: clone(DEFAULT_COURSE.institutionIds),
    location: clone(DEFAULT_COURSE.location),
    academicYear: DEFAULT_COURSE.academicYear,
    languageOfInstruction: clone(
      DEFAULT_COURSE.languageOfInstruction,
    ),
    officialUrl: DEFAULT_COURSE.officialUrl,
    brochureUrl: DEFAULT_COURSE.brochureUrl,
    ...safeOverrides,
  };

  for (const field of [
    'duration',
    'eligibility',
    'fees',
    'location',
  ]) {
    payload[field] = mergeObject(
      DEFAULT_COURSE[field],
      safeOverrides[field] === undefined
        ? {}
        : safeOverrides[field],
      `${field} payload overrides`,
    );
  }

  for (const field of [
    'institutionIds',
    'languageOfInstruction',
  ]) {
    payload[field] = cloneArray(
      safeOverrides[field] === undefined
        ? DEFAULT_COURSE[field]
        : safeOverrides[field],
      field,
    );
  }

  payload.eligibility.requirements = cloneArray(
    payload.eligibility.requirements,
    'eligibility.requirements',
  );

  payload.eligibility.entranceExams = cloneArray(
    payload.eligibility.entranceExams,
    'eligibility.entranceExams',
  );

  return payload;
}

/**
 * Create multiple courses with deterministic, unique identities.
 *
 * Generated ID, code, slug, and title fields cannot be overridden by
 * common options. Other overrides are applied to every generated course.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createCourseSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > MAX_COURSE_SET_SIZE
  ) {
    throw new RangeError(
      `Course count must be an integer from 0 to ${MAX_COURSE_SET_SIZE}`,
    );
  }

  assertPlainObject(overrides, 'Course set overrides');

  const commonOverrides = clone(overrides, 'Course set overrides');

  delete commonOverrides.id;
  delete commonOverrides.code;
  delete commonOverrides.slug;
  delete commonOverrides.title;

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    return createCourse({
      ...commonOverrides,
      id: `course_test_${sequence}`,
      code: `MO-COURSE-TEST-${sequence}`,
      slug: `test-course-${sequence}`,
      title: `Test Course ${index + 1}`,
    });
  });
}

/**
 * Create a draft course.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDraftCourse(overrides = {}) {
  assertPlainObject(overrides, 'Draft course overrides');

  return createCourse({
    ...clone(overrides, 'Draft course overrides'),
    status: COURSE_STATUSES.DRAFT,
    isPublished: false,
  });
}

/**
 * Create an inactive course with deterministic identity defaults.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createInactiveCourse(overrides = {}) {
  assertPlainObject(overrides, 'Inactive course overrides');

  return createCourse({
    id: 'course_test_inactive_0001',
    slug: 'test-inactive-course',
    code: 'MO-COURSE-TEST-INACTIVE-0001',
    title: 'Test Inactive Course',
    ...clone(overrides, 'Inactive course overrides'),
    status: COURSE_STATUSES.INACTIVE,
    isPublished: false,
  });
}

/**
 * Create an archived course with deterministic identity defaults.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createArchivedCourse(overrides = {}) {
  assertPlainObject(overrides, 'Archived course overrides');

  return createCourse({
    id: 'course_test_archived_0001',
    slug: 'test-archived-course',
    code: 'MO-COURSE-TEST-ARCHIVED-0001',
    title: 'Test Archived Course',
    ...clone(overrides, 'Archived course overrides'),
    status: COURSE_STATUSES.ARCHIVED,
    isPublished: false,
  });
}

/**
 * Create a hostile payload for mass-assignment tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');

  return {
    ...createCoursePayload(),
    id: 'course_test_attacker_controlled',
    code: 'MO-ATTACKER-CONTROLLED',
    status: COURSE_STATUSES.ACTIVE,
    isPublished: true,
    isFeatured: true,
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    role: 'admin',
    isAdmin: true,
    ...clone(overrides, 'Mass-assignment overrides'),
  };
}

/**
 * Create a course with a selected status.
 *
 * This helper does not enforce workflow transition rules.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourseWithStatus(status, overrides = {}) {
  assertCourseStatus(status);
  assertPlainObject(overrides, 'Course status overrides');

  return createCourse({
    ...clone(overrides, 'Course status overrides'),
    status,
  });
}

/**
 * Create synthetic course fee metadata.
 *
 * No actual institution fee is asserted.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourseFees(overrides = {}) {
  assertPlainObject(overrides, 'Course fee overrides');

  return {
    currency: 'INR',
    amount: null,
    period: null,
    notes: 'Synthetic fee metadata for testing only.',
    ...clone(overrides, 'Course fee overrides'),
  };
}

/**
 * Create synthetic eligibility metadata.
 *
 * This is not an authoritative admissions eligibility statement.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourseEligibility(overrides = {}) {
  assertPlainObject(overrides, 'Course eligibility overrides');

  const safeOverrides = clone(
    overrides,
    'Course eligibility overrides',
  );

  const eligibility = {
    summary: 'Synthetic eligibility summary for testing only.',
    requirements: [],
    entranceExams: [],
    minimumAge: null,
    maximumAge: null,
    ...safeOverrides,
  };

  eligibility.requirements = cloneArray(
    eligibility.requirements,
    'eligibility.requirements',
  );

  eligibility.entranceExams = cloneArray(
    eligibility.entranceExams,
    'eligibility.entranceExams',
  );

  return eligibility;
}

/**
 * Create a hostile payload containing server-managed fields.
 *
 * Useful for asserting that the API rejects or ignores unauthorized
 * fields supplied by a client.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createServerManagedFieldPayload(overrides = {}) {
  assertPlainObject(
    overrides,
    'Server-managed field payload overrides',
  );

  return {
    ...createCoursePayload(),
    id: DEFAULT_COURSE.id,
    code: DEFAULT_COURSE.code,
    status: DEFAULT_COURSE.status,
    isPublished: DEFAULT_COURSE.isPublished,
    isFeatured: DEFAULT_COURSE.isFeatured,
    createdAt: DEFAULT_COURSE.createdAt,
    updatedAt: DEFAULT_COURSE.updatedAt,
    ...clone(overrides, 'Server-managed field payload overrides'),
  };
}

module.exports = {
  COURSE_STATUSES,
  COURSE_CATEGORIES,
  COURSE_TYPES,
  COURSE_STATUS_VALUES,
  COURSE_CATEGORY_VALUES,
  COURSE_TYPE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_COURSE,
  createCourse,
  createCoursePayload,
  createCourseSet,
  createDraftCourse,
  createInactiveCourse,
  createArchivedCourse,
  createMassAssignmentPayload,
  createCourseWithStatus,
  createCourseFees,
  createCourseEligibility,
  createServerManagedFieldPayload,
};
