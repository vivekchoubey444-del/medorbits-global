'use strict';
/**
 * MedOrbits -- Course Test Fixtures
 *
 * File: tests/fixtures/courses.js
 *
 * Purpose:
 *   Provide deterministic synthetic course records for unit, integration,
 *   API, search, filtering, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic course data only.
 *   - Does not assert real-world fees, admissions criteria, or recognition.
 *   - Separates normal payload defaults from server-managed record fields.
 *   - Does not create database records or establish permissions.
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
  Object.values(COURSE_STATUSES)
);
const COURSE_CATEGORY_VALUES = Object.freeze(
  Object.values(COURSE_CATEGORIES)
);
const COURSE_TYPE_VALUES = Object.freeze(
  Object.values(COURSE_TYPES)
);
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
  institutionIds: Object.freeze(['institution_test_0001']),
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
 * Validate a plain object.
 *
 * @param {*} value
 * @param {string} label
 */
function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}
/**
 * Recursively clone arrays and plain objects.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone);
  }
  if (value !== null && typeof value === 'object') {
    assertPlainObject(value, 'Fixture values');
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }
  return value;
}
/**
 * Validate and copy an array of primitive values.
 *
 * @param {*} value
 * @param {string} label
 * @returns {Array}
 */
function cloneArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return clone(value);
}
/**
 * Merge a nested plain-object field with its default.
 *
 * @param {object} base
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(base, overrides, label) {
  assertPlainObject(overrides, label);
  return {
    ...clone(base),
    ...clone(overrides),
  };
}
/**
 * Create a fresh course record.
 *
 * Nested objects are merged with their defaults. Array fields are copied
 * so mutations do not leak between fixture instances.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourse(overrides = {}) {
  assertPlainObject(overrides, 'Course overrides');
  const course = {
    ...clone(DEFAULT_COURSE),
    ...clone(overrides),
  };
  for (const field of [
    'duration',
    'eligibility',
    'fees',
    'location',
  ]) {
    course[field] = overrides[field] === undefined
      ? clone(DEFAULT_COURSE[field])
      : mergeObject(
          DEFAULT_COURSE[field],
          overrides[field],
          `${field} overrides`
        );
  }
  for (const field of [
    'institutionIds',
    'languageOfInstruction',
  ]) {
    course[field] = cloneArray(
      overrides[field] === undefined
        ? DEFAULT_COURSE[field]
        : overrides[field],
      field
    );
  }
  course.eligibility.requirements = cloneArray(
    course.eligibility.requirements,
    'eligibility.requirements'
  );
  course.eligibility.entranceExams = cloneArray(
    course.eligibility.entranceExams,
    'eligibility.entranceExams'
  );
  return course;
}
/**
 * Create a client-submittable course payload.
 *
 * Server-managed fields are excluded by default:
 * id, code, status, isPublished, isFeatured, createdAt, updatedAt.
 *
 * Explicit overrides are supported for negative and security tests.
 * Therefore, this helper does not prevent callers from adding server-managed
 * fields. The API must independently enforce its accepted-field allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCoursePayload(overrides = {}) {
  assertPlainObject(overrides, 'Course payload overrides');
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
    languageOfInstruction: clone(DEFAULT_COURSE.languageOfInstruction),
    officialUrl: DEFAULT_COURSE.officialUrl,
    brochureUrl: DEFAULT_COURSE.brochureUrl,
    ...clone(overrides),
  };
  for (const field of [
    'duration',
    'eligibility',
    'fees',
    'location',
  ]) {
    payload[field] = overrides[field] === undefined
      ? clone(DEFAULT_COURSE[field])
      : mergeObject(
          DEFAULT_COURSE[field],
          overrides[field],
          `${field} payload overrides`
        );
  }
  for (const field of [
    'institutionIds',
    'languageOfInstruction',
  ]) {
    payload[field] = cloneArray(
      overrides[field] === undefined
        ? DEFAULT_COURSE[field]
        : overrides[field],
      field
    );
  }
  payload.eligibility.requirements = cloneArray(
    payload.eligibility.requirements,
    'eligibility.requirements'
  );
  payload.eligibility.entranceExams = cloneArray(
    payload.eligibility.entranceExams,
    'eligibility.entranceExams'
  );
  return payload;
}
/**
 * Create multiple courses with unique generated identities.
 *
 * Generated IDs, codes, slugs, and titles remain unique even when common
 * overrides are supplied.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createCourseSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Course count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'Course set overrides');
  const commonOverrides = clone(overrides);
  // This factory controls these generated identity fields.
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
    ...clone(overrides),
    status: COURSE_STATUSES.DRAFT,
    isPublished: false,
  });
}
/**
 * Create an inactive course.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createInactiveCourse(overrides = {}) {
  assertPlainObject(overrides, 'Inactive course overrides');
  return createCourse({
    ...clone(overrides),
    id: 'course_test_inactive_0001',
    slug: 'test-inactive-course',
    code: 'MO-COURSE-TEST-INACTIVE-0001',
    title: 'Test Inactive Course',
    status: COURSE_STATUSES.INACTIVE,
    isPublished: false,
  });
}
/**
 * Create an archived course.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createArchivedCourse(overrides = {}) {
  assertPlainObject(overrides, 'Archived course overrides');
  return createCourse({
    ...clone(overrides),
    id: 'course_test_archived_0001',
    slug: 'test-archived-course',
    code: 'MO-COURSE-TEST-ARCHIVED-0001',
    title: 'Test Archived Course',
    status: COURSE_STATUSES.ARCHIVED,
    isPublished: false,
  });
}
/**
 * Create a deliberately hostile payload for mass-assignment tests.
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
    ...clone(overrides),
  };
}
/**
 * Create a course with a selected status.
 *
 * This helper does not enforce valid workflow transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourseWithStatus(status, overrides = {}) {
  if (!COURSE_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported course status: ${status}`);
  }
  assertPlainObject(overrides, 'Course status overrides');
  return createCourse({
    ...clone(overrides),
    status,
  });
}
/**
 * Create synthetic course fee metadata.
 *
 * A null amount avoids implying an actual institution's current fees.
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
    ...clone(overrides),
  };
}
/**
 * Create synthetic eligibility metadata.
 *
 * This is not an authoritative admission eligibility statement.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCourseEligibility(overrides = {}) {
  assertPlainObject(overrides, 'Course eligibility overrides');
  const eligibility = {
    summary: 'Synthetic eligibility summary for testing only.',
    requirements: [],
    entranceExams: [],
    minimumAge: null,
    maximumAge: null,
    ...clone(overrides),
  };
  eligibility.requirements = cloneArray(
    eligibility.requirements,
    'eligibility.requirements'
  );
  eligibility.entranceExams = cloneArray(
    eligibility.entranceExams,
    'eligibility.entranceExams'
  );
  return eligibility;
}
module.exports = {
  COURSE_STATUSES,
  COURSE_CATEGORIES,
  COURSE_TYPES,
  COURSE_STATUS_VALUES,
  COURSE_CATEGORY_VALUES,
  COURSE_TYPE_VALUES,
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
};