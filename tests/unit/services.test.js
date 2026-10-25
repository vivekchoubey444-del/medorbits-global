'use strict';

/**
 * MedOrbits -- Service Unit Tests
 *
 * File: tests/unit/services.test.js
 * Runtime: Node.js >= 20
 * Test runner: Jest
 *
 * Run:
 *   npx jest tests/unit/services.test.js --runInBand
 *
 * Coverage:
 * - Service errors and shared validation utilities
 * - CRUD operations, pagination, and audit events
 * - Audit redaction and analytics sanitization
 * - User and course service authorization-sensitive operations
 * - Search, session, email, and notification services
 * - Authentication, verification, and password workflows
 * - Payment and subscription input validation
 *
 * These tests use synthetic data and mocked dependencies. They do not connect
 * to production databases, email providers, or payment gateways.
 */

const {
  ServiceError,
  requiredString,
  requiredId,
  plainObject,
  assertFound,
  assertAllowed,
  safePage,
  audit,
  createCrudService,
} = require('../../src/services/service-utils');

const {
  createAuditService,
  redact,
} = require('../../src/services/audit.service');

const {
  createAnalyticsService,
  sanitizeProperties,
} = require('../../src/services/analytics.service');

const { createUserService } = require('../../src/services/user.service');
const { createCourseService } = require('../../src/services/course.service');
const { createSearchService } = require('../../src/services/search.service');
const { createSessionService } = require('../../src/services/session.service');
const { createEmailService } = require('../../src/services/email.service');

const {
  createNotificationService,
} = require('../../src/services/notification.service');

const {
  createAuthService,
  sanitizeUser,
} = require('../../src/services/auth.service');

const {
  createVerificationService,
} = require('../../src/services/verification.service');

const {
  createPasswordService,
} = require('../../src/services/password.service');

const {
  createPaymentService,
} = require('../../src/services/payment.service');

const {
  createSubscriptionService,
} = require('../../src/services/subscription.service');

const TEST_DATE = new Date('2026-01-01T00:00:00.000Z');

function createClock(date = TEST_DATE) {
  return () => new Date(date.getTime());
}

function expectServiceError(promise, expected = {}) {
  return expect(promise).rejects.toMatchObject({
    name: 'ServiceError',
    ...expected,
  });
}

function createAuditRepository(overrides = {}) {
  return {
    create: jest.fn(async (entry) => ({
      id: 'audit-test-001',
      ...entry,
    })),
    list: jest.fn(async () => ({
      items: [],
      total: 0,
    })),
    ...overrides,
  };
}

describe('ServiceError', () => {
  test('creates a structured service error', () => {
    const error = new ServiceError('Invalid input', {
      code: 'VALIDATION_ERROR',
      status: 422,
      details: { field: 'name' },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ServiceError');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(422);
    expect(error.publicMessage).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'name' });
  });

  test('uses default error properties', () => {
    const error = new ServiceError('Request failed');

    expect(error.code).toBe('SERVICE_ERROR');
    expect(error.status).toBe(400);
    expect(error.details).toBeUndefined();
  });

  test('preserves an explicit public message', () => {
    const error = new ServiceError('Internal description', {
      publicMessage: 'Request could not be completed.',
      code: 'REQUEST_FAILED',
      status: 400,
    });

    expect(error.message).toBe('Internal description');
    expect(error.publicMessage).toBe('Request could not be completed.');
  });
});

describe('service-utils validation helpers', () => {
  test('requiredString trims valid input', () => {
    expect(requiredString('  MedOrbits  ', 'name')).toBe('MedOrbits');
  });

  test('requiredString rejects missing and non-string values', () => {
    for (const value of [undefined, null, 123, {}, '', '   ']) {
      expect(() => requiredString(value, 'name')).toThrow(ServiceError);
    }
  });

  test('requiredString enforces minimum and maximum length', () => {
    expect(() =>
      requiredString('ab', 'name', { min: 3, max: 10 }),
    ).toThrow(/between 3 and 10 characters/i);

    expect(() =>
      requiredString('a'.repeat(11), 'name', { min: 1, max: 10 }),
    ).toThrow(ServiceError);
  });

  test('requiredString rejects invalid length configuration', () => {
    expect(() =>
      requiredString('valid', 'name', { min: -1, max: 10 }),
    ).toThrow(TypeError);
  });

  test('requiredId accepts non-empty strings and finite numbers', () => {
    expect(requiredId('user-test-001')).toBe('user-test-001');
    expect(requiredId(123)).toBe(123);
  });

  test('requiredId rejects invalid identifiers', () => {
    for (const id of [
      undefined,
      null,
      '',
      '   ',
      NaN,
      Infinity,
      -Infinity,
      {},
    ]) {
      expect(() => requiredId(id)).toThrow(ServiceError);
    }
  });

  test('plainObject returns a shallow copy', () => {
    const input = { name: 'MedOrbits' };
    const result = plainObject(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  test('plainObject rejects arrays and non-objects', () => {
    for (const value of [null, undefined, [], 'text', 123]) {
      expect(() => plainObject(value)).toThrow(ServiceError);
    }
  });

  test('plainObject rejects non-plain objects', () => {
    expect(() => plainObject(new Date())).toThrow(ServiceError);
  });

  test('plainObject does not silently accept class instances', () => {
    class Example {
      constructor() {
        this.name = 'MedOrbits';
      }
    }

    expect(() => plainObject(new Example())).toThrow(ServiceError);
  });

  test('assertFound returns an existing value unchanged', () => {
    const record = { id: 'record-test-001' };

    expect(assertFound(record, 'Record')).toBe(record);
  });

  test('assertFound throws a 404 error for missing records', () => {
    for (const value of [null, undefined]) {
      expect(() => assertFound(value, 'Course')).toThrow(
        expect.objectContaining({
          status: 404,
          code: 'NOT_FOUND',
        }),
      );
    }
  });

  test('assertAllowed accepts configured values only', () => {
    expect(
      assertAllowed('active', ['active', 'disabled'], 'status'),
    ).toBe('active');

    expect(() =>
      assertAllowed('unknown', ['active', 'disabled'], 'status'),
    ).toThrow(ServiceError);
  });

  test('safePage normalizes pagination and caps maximum values', () => {
    expect(safePage()).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });

    expect(safePage({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      offset: 20,
    });

    expect(safePage({ page: -2, limit: 'invalid' })).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });

    expect(safePage({ page: 999999, limit: 500 })).toEqual({
      page: 100000,
      limit: 100,
      offset: 9999900,
    });
  });

  test('audit is non-fatal when the audit provider fails', async () => {
    const auditService = {
      record: jest.fn().mockRejectedValue(
        new Error('Synthetic audit provider failure'),
      ),
    };

    await expect(
      audit(auditService, { action: 'test.action' }),
    ).resolves.toBeUndefined();

    expect(auditService.record).toHaveBeenCalledWith({
      action: 'test.action',
    });
  });

  test('audit supports log as a fallback method', async () => {
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    await audit(auditService, { action: 'test.action' });

    expect(auditService.log).toHaveBeenCalledTimes(1);
  });

  test('audit handles a missing provider without throwing', async () => {
    await expect(
      audit(null, { action: 'test.action' }),
    ).resolves.toBeUndefined();
  });
});

describe('createCrudService', () => {
  let repository;
  let auditService;
  let service;

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: 'course-test-001',
        name: 'Example Course',
      }),
      create: jest.fn().mockImplementation(async (data) => ({
        id: 'course-test-002',
        ...data,
      })),
      updateById: jest.fn().mockImplementation(async (id, data) => ({
        id,
        ...data,
      })),
      deleteById: jest.fn().mockResolvedValue(true),
    };

    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = createCrudService({
      repository,
      entity: 'Course',
      auditService,
      allowedSort: ['createdAt', 'name'],
    });
  });

  test('requires a repository', () => {
    expect(() =>
      createCrudService({
        repository: null,
        entity: 'Course',
      }),
    ).toThrow(/dependency is required/i);
  });

  test('requires a non-empty allowedSort array', () => {
    expect(() =>
      createCrudService({
        repository,
        entity: 'Course',
        allowedSort: [],
      }),
    ).toThrow(/allowedSort/i);
  });

  test('lists records with normalized pagination and sorting', async () => {
    await service.list({
      page: 2,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
      filters: { status: 'published' },
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      offset: 10,
      filters: { status: 'published' },
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  test('falls back to a permitted sort field', async () => {
    await service.list({ sortBy: 'untrusted-column' });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    );
  });

  test('gets a record by ID', async () => {
    await expect(
      service.getById('course-test-001'),
    ).resolves.toEqual({
      id: 'course-test-001',
      name: 'Example Course',
    });

    expect(repository.findById).toHaveBeenCalledWith('course-test-001');
  });

  test('throws when a requested record does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expectServiceError(service.getById('missing'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('creates a record and audits the action', async () => {
    const result = await service.create(
      { name: 'New Course' },
      { id: 'admin-test-001' },
    );

    expect(result).toEqual({
      id: 'course-test-002',
      name: 'New Course',
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'New Course',
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'course.created',
        entity: 'Course',
        entityId: 'course-test-002',
        actorId: 'admin-test-001',
      }),
    );
  });

  test('rejects non-object create input', async () => {
    await expectServiceError(service.create([]), {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('rejects null create input', async () => {
    await expectServiceError(service.create(null), {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('updates a record and audits the action', async () => {
    await service.update(
      'course-test-001',
      { name: 'Updated Course' },
      { id: 'admin-test-001' },
    );

    expect(repository.updateById).toHaveBeenCalledWith(
      'course-test-001',
      { name: 'Updated Course' },
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'course.updated',
        entityId: 'course-test-001',
        actorId: 'admin-test-001',
      }),
    );
  });

  test('removes a record and returns a deletion result', async () => {
    await expect(
      service.remove('course-test-001', { id: 'admin-test-001' }),
    ).resolves.toEqual({
      id: 'course-test-001',
      deleted: true,
    });

    expect(repository.deleteById).toHaveBeenCalledWith('course-test-001');
  });

  test('rejects deletion when the repository reports no record', async () => {
    repository.deleteById.mockResolvedValue(false);

    await expectServiceError(service.remove('missing'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('does not audit a failed create operation', async () => {
    repository.create.mockRejectedValue(
      new Error('Synthetic repository failure'),
    );

    await expect(
      service.create({ name: 'Broken Course' }),
    ).rejects.toThrow('Synthetic repository failure');

    expect(auditService.record).not.toHaveBeenCalled();
  });
});

describe('audit.service', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = createAuditRepository();

    service = createAuditService({
      auditRepository: repository,
      clock: createClock(),
    });
  });

  test('requires an audit repository', () => {
    expect(() =>
      createAuditService({ auditRepository: null }),
    ).toThrow(/dependency is required/i);
  });

  test('records normalized audit events', async () => {
    await service.record({
      action: ' user.created ',
      entity: 'User',
      entityId: 123,
      actorId: 'admin-test-001',
      requestId: 'request-test-001',
      metadata: { source: 'test' },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.created',
        entity: 'User',
        entityId: '123',
        actorId: 'admin-test-001',
        requestId: 'request-test-001',
        metadata: { source: 'test' },
        createdAt: TEST_DATE,
      }),
    );
  });

  test('rejects malformed audit events', async () => {
    await expectServiceError(service.record(null), {
      code: 'VALIDATION_ERROR',
      status: 422,
    });

    await expect(
      service.record({ action: '' }),
    ).rejects.toThrow(ServiceError);
  });

  test('redacts sensitive metadata keys', async () => {
    await service.record({
      action: 'auth.login',
      metadata: {
        username: 'student',
        password: 'synthetic-password',
        accessToken: 'synthetic-token',
        nested: {
          apiKey: 'synthetic-api-key',
          safeValue: 'visible',
        },
      },
    });

    expect(repository.create.mock.calls[0][0].metadata).toEqual({
      username: 'student',
      nested: {
        safeValue: 'visible',
      },
    });
  });

  test('rejects audit metadata that exceeds the allowed size', async () => {
    await expectServiceError(
      service.record({
        action: 'test.large',
        metadata: {
          content: 'x'.repeat(17000),
        },
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );

    expect(repository.create).not.toHaveBeenCalled();
  });

  test('lists audit events with validated filters', async () => {
    await service.list({
      limit: 10,
      actorId: 'admin-test-001',
      entity: 'User',
      action: 'user.created',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        actorId: 'admin-test-001',
        entity: 'User',
        action: 'user.created',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      }),
    );
  });

  test('rejects an inverted audit date range', async () => {
    await expectServiceError(
      service.list({
        from: '2026-02-01',
        to: '2026-01-01',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('redact handles circular references', () => {
    const value = { name: 'record' };
    value.self = value;

    expect(redact(value)).toEqual({
      name: 'record',
      self: '[CIRCULAR_REFERENCE]',
    });
  });
});

describe('analytics.service', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      create: jest.fn(async (event) => event),
      report: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    };

    service = createAnalyticsService({
      analyticsRepository: repository,
      clock: createClock(),
    });
  });

  test('tracks events with sanitized properties', async () => {
    await service.track({
      name: 'course.viewed',
      actorId: 'user-test-001',
      properties: {
        category: 'medical',
        password: 'synthetic-password',
        email: 'private@example.test',
        count: 3,
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'course.viewed',
        actorId: 'user-test-001',
        anonymousId: null,
        occurredAt: TEST_DATE,
        properties: {
          category: 'medical',
          count: 3,
        },
      }),
    );
  });

  test('rejects an event with both actorId and anonymousId', async () => {
    await expectServiceError(
      service.track({
        name: 'course.viewed',
        actorId: 'user-test-001',
        anonymousId: 'anonymous-test-001',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('rejects invalid event names', async () => {
    await expect(service.track({ name: ' ' })).rejects.toThrow(ServiceError);
  });

  test('sanitizes sensitive analytics properties', () => {
    expect(
      sanitizeProperties({
        category: 'education',
        email: 'private@example.test',
        password: 'synthetic-password',
        nested: {
          safe: true,
          phone: '0000000000',
        },
      }),
    ).toEqual({
      category: 'education',
      nested: {
        safe: true,
      },
    });
  });

  test('reports analytics with normalized pagination', async () => {
    await service.report({
      page: 2,
      limit: 10,
      eventName: 'course.viewed',
    });

    expect(repository.report).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        offset: 10,
        eventName: 'course.viewed',
      }),
    );
  });

  test('rejects an inverted report date range', async () => {
    await expectServiceError(
      service.report({
        from: '2026-02-01',
        to: '2026-01-01',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });
});

describe('user.service', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: 'user-test-001',
        name: 'Student',
        email: 'student@example.test',
        passwordHash: 'synthetic-private-hash',
        resetToken: 'synthetic-reset-token',
      }),
      create: jest.fn(),
      updateById: jest.fn().mockImplementation(async (id, data) => ({
        id,
        name: 'Student',
        email: 'student@example.test',
        ...data,
        passwordHash: 'synthetic-private-hash',
      })),
      deleteById: jest.fn().mockResolvedValue(true),
    };

    service = createUserService({
      userRepository: repository,
    });
  });

  test('requires a user repository', () => {
    expect(() => createUserService({})).toThrow(
      /userRepository is required/i,
    );
  });

  test('gets a profile without exposing authentication secrets', async () => {
    await expect(
      service.getProfile('user-test-001'),
    ).resolves.toEqual({
      id: 'user-test-001',
      name: 'Student',
      email: 'student@example.test',
    });
  });

  test('removes blocked fields from profile updates', async () => {
    await service.updateProfile('user-test-001', {
      name: '  Updated Student  ',
      role: 'admin',
      status: 'active',
      passwordHash: 'attacker-controlled',
      isAdmin: true,
    });

    expect(repository.updateById).toHaveBeenCalledWith(
      'user-test-001',
      {
        name: 'Updated Student',
      },
    );
  });

  test('requires the dedicated email-change flow for email updates', async () => {
    await expect(
      service.updateProfile('user-test-001', {
        email: 'new@example.test',
      }),
    ).rejects.toThrow(/email-change verification flow/i);

    expect(repository.updateById).not.toHaveBeenCalled();
  });

  test('rejects unsupported user statuses', async () => {
    await expect(
      service.setStatus('user-test-001', 'superadmin'),
    ).rejects.toThrow(/unsupported user status/i);
  });

  test('sets an allowed user status', async () => {
    await service.setStatus(
      'user-test-001',
      'suspended',
      { id: 'admin-test-001' },
    );

    expect(repository.updateById).toHaveBeenCalledWith(
      'user-test-001',
      { status: 'suspended' },
    );
  });
});

describe('course.service', () => {
  test('requires a course repository', () => {
    expect(() => createCourseService({})).toThrow(
      /dependency is required/i,
    );
  });

  test('publishes a course and sets publication timestamps', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'course-test-001',
        status: 'draft',
        publishedAt: null,
      }),
      updateById: jest.fn().mockImplementation(async (id, changes) => ({
        id,
        ...changes,
      })),
    };

    const service = createCourseService({
      courseRepository: repository,
      clock: createClock(),
    });

    const result = await service.setStatus(
      'course-test-001',
      'published',
      { id: 'admin-test-001' },
    );

    expect(repository.updateById).toHaveBeenCalledWith(
      'course-test-001',
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );

    expect(result.status).toBe('published');
  });

  test('rejects an unsupported course status', async () => {
    const service = createCourseService({
      courseRepository: {},
    });

    await expectServiceError(
      service.setStatus('course-test-001', 'deleted'),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('throws when the course does not exist', async () => {
    const service = createCourseService({
      courseRepository: {
        findById: jest.fn().mockResolvedValue(null),
        updateById: jest.fn(),
      },
    });

    await expectServiceError(
      service.setStatus('missing-course', 'published'),
      {
        code: 'NOT_FOUND',
        status: 404,
      },
    );
  });
});

describe('search.service', () => {
  test('uses the central search repository when available', async () => {
    const searchRepository = {
      search: jest.fn().mockResolvedValue({
        items: [],
      }),
    };

    const service = createSearchService({
      searchRepository,
    });

    await service.search({
      q: 'medical',
      types: ['courses', 'colleges'],
      page: 2,
      limit: 10,
    });

    expect(searchRepository.search).toHaveBeenCalledWith({
      q: 'medical',
      types: ['courses', 'colleges'],
      page: 2,
      limit: 10,
      offset: 10,
    });
  });

  test('searches configured repositories without a central search', async () => {
    const courseRepository = {
      search: jest.fn().mockResolvedValue([
        { id: 'course-test-001' },
      ]),
    };

    const service = createSearchService({
      courseRepository,
    });

    const result = await service.search({
      q: 'medical',
      types: ['courses'],
    });

    expect(courseRepository.search).toHaveBeenCalledWith({
      q: 'medical',
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({
      query: 'medical',
      page: 1,
      limit: 20,
      results: [
        {
          type: 'courses',
          items: [{ id: 'course-test-001' }],
        },
      ],
    });
  });

  test('rejects search queries shorter than two characters', async () => {
    const service = createSearchService({});

    await expectServiceError(
      service.search({ q: 'a' }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('rejects unsupported search types', async () => {
    const service = createSearchService({});

    await expectServiceError(
      service.search({
        q: 'medical',
        types: ['unknown'],
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('expands the all type into configured search types', async () => {
    const searchRepository = {
      search: jest.fn().mockResolvedValue({
        items: [],
      }),
    };

    const service = createSearchService({
      searchRepository,
    });

    await service.search({
      q: 'medical',
      types: ['all'],
    });

    expect(searchRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ['courses', 'colleges', 'jobs', 'internships'],
      }),
    );
  });
});

describe('session.service', () => {
  test('rejects an invalid TTL', () => {
    expect(() =>
      createSessionService({
        sessionRepository: {},
        ttlSeconds: 10,
      }),
    ).toThrow(/ttlSeconds/i);
  });

  test('creates a session with expiry and request context', async () => {
    const repository = {
      create: jest.fn().mockImplementation(async (session) => ({
        id: 'session-test-001',
        ...session,
      })),
    };

    const service = createSessionService({
      sessionRepository: repository,
      ttlSeconds: 3600,
      clock: createClock(),
    });

    await service.create('user-test-001', {
      ip: '127.0.0.1',
      userAgent: 'MedOrbits Synthetic Test Client',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-test-001',
        ipAddress: '127.0.0.1',
        userAgent: 'MedOrbits Synthetic Test Client',
        revokedAt: null,
        expiresAt: new Date(TEST_DATE.getTime() + 3600 * 1000),
      }),
    );
  });

  test("rejects access to another user's session", async () => {
    const service = createSessionService({
      sessionRepository: {
        findById: jest.fn().mockResolvedValue({
          id: 'session-test-001',
          userId: 'user-test-002',
          expiresAt: new Date(TEST_DATE.getTime() + 60000),
          revokedAt: null,
        }),
      },
      clock: createClock(),
    });

    await expectServiceError(
      service.getActive('session-test-001', 'user-test-001'),
      {
        code: 'SESSION_INVALID',
        status: 401,
      },
    );
  });

  test('revokes an existing session', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'session-test-001',
        userId: 'user-test-001',
        revokedAt: null,
      }),
      updateById: jest.fn().mockResolvedValue({
        id: 'session-test-001',
        revokedAt: TEST_DATE,
      }),
    };

    const service = createSessionService({
      sessionRepository: repository,
      clock: createClock(),
    });

    await expect(
      service.revoke('session-test-001', 'user-test-001'),
    ).resolves.toEqual({
      revoked: true,
    });

    expect(repository.updateById).toHaveBeenCalledWith(
      'session-test-001',
      { revokedAt: TEST_DATE },
    );
  });

  test('returns an idempotent result for a missing session', async () => {
    const service = createSessionService({
      sessionRepository: {
        findById: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.revoke('missing-session'),
    ).resolves.toEqual({
      revoked: true,
    });
  });
});

describe('email.service', () => {
  test('requires a provider', () => {
    expect(() =>
      createEmailService({
        from: 'noreply@example.test',
      }),
    ).toThrow(/dependency is required/i);
  });

  test('requires a valid HTTPS application URL', () => {
    expect(() =>
      createEmailService({
        provider: { send: jest.fn() },
        from: 'noreply@example.test',
        appUrl: 'http://example.test',
      }),
    ).toThrow(/HTTPS/i);
  });

  test('rejects invalid recipient email addresses', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@example.test',
    });

    await expectServiceError(
      service.send({
        to: 'invalid-address',
        subject: 'Test',
        text: 'Synthetic message',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('restricts recipient domains when configured', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@example.test',
      allowedHosts: ['medorbits.in'],
    });

    await expectServiceError(
      service.send({
        to: 'student@example.test',
        subject: 'Test',
        text: 'Synthetic message',
      }),
      {
        code: 'RECIPIENT_NOT_ALLOWED',
        status: 422,
      },
    );
  });

  test('requires a subject or template', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@example.test',
    });

    await expectServiceError(
      service.send({
        to: 'student@example.test',
        text: 'Synthetic message',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });
});

describe('notification.service', () => {
  test('creates an in-app notification', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({
        id: 'notification-test-001',
        recipientId: 'user-test-001',
        status: 'unread',
      }),
    };

    const service = createNotificationService({
      notificationRepository: repository,
    });

    const result = await service.create({
      recipientId: 'user-test-001',
      title: 'Application update',
      message: 'Your application has been received.',
    });

    expect(result.status).toBe('unread');

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'user-test-001',
        title: 'Application update',
        status: 'unread',
        channel: 'in_app',
      }),
    );
  });

  test('rejects unsupported notification channels', async () => {
    const service = createNotificationService({
      notificationRepository: {
        create: jest.fn(),
      },
    });

    await expectServiceError(
      service.create({
        recipientId: 'user-test-001',
        title: 'Notice',
        message: 'Synthetic notification',
        channel: 'unsupported',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test("does not allow a user to read another user's notification", async () => {
    const service = createNotificationService({
      notificationRepository: {
        findById: jest.fn().mockResolvedValue({
          id: 'notification-test-001',
          recipientId: 'user-test-002',
          status: 'unread',
        }),
        updateById: jest.fn(),
      },
    });

    await expectServiceError(
      service.markRead('notification-test-001', 'user-test-001'),
      {
        code: 'NOT_FOUND',
        status: 404,
      },
    );
  });
});

describe('auth.service', () => {
  test('sanitizeUser removes authentication secrets', () => {
    expect(
      sanitizeUser({
        id: 'user-test-001',
        email: 'student@example.test',
        password: 'synthetic-password',
        passwordHash: 'synthetic-hash',
        refreshToken: 'synthetic-refresh-token',
        sessionToken: 'synthetic-session-token',
        role: 'student',
      }),
    ).toEqual({
      id: 'user-test-001',
      email: 'student@example.test',
      role: 'student',
    });
  });

  test('sanitizeUser returns null for invalid input', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser('invalid')).toBeNull();
    expect(sanitizeUser([])).toBeNull();
  });

  test('requires authentication dependencies', () => {
    expect(() => createAuthService({})).toThrow(
      /userRepository dependency is required/i,
    );

    expect(() =>
      createAuthService({
        userRepository: { create: jest.fn() },
      }),
    ).toThrow(/passwordHasher dependency is required/i);
  });

  test('registers a user with normalized email and hashed password', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'user-test-001',
        email: 'student@example.test',
        name: 'Student',
        status: 'pending_verification',
        passwordHash: 'synthetic-password-hash',
      }),
    };

    const passwordHasher = {
      hash: jest.fn().mockResolvedValue('synthetic-password-hash'),
      verify: jest.fn(),
    };

    const service = createAuthService({
      userRepository,
      passwordHasher,
      tokenService: {
        issue: jest.fn(),
      },
    });

    const result = await service.register({
      name: 'Student',
      email: ' STUDENT@EXAMPLE.TEST ',
      password: 'synthetic-test-password',
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith(
      'student@example.test',
    );

    expect(passwordHasher.hash).toHaveBeenCalledWith(
      'synthetic-test-password',
    );

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.email).toBe('student@example.test');
  });

  test('rejects duplicate email registration', async () => {
    const service = createAuthService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'existing-user-test-001',
        }),
        create: jest.fn(),
      },
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
      tokenService: {
        issue: jest.fn(),
      },
    });

    await expectServiceError(
      service.register({
        name: 'Student',
        email: 'student@example.test',
        password: 'synthetic-test-password',
      }),
      {
        code: 'EMAIL_IN_USE',
        status: 409,
      },
    );
  });

  test('rejects invalid login credentials', async () => {
    const service = createAuthService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
      tokenService: {
        issue: jest.fn(),
      },
    });

    await expectServiceError(
      service.login({
        email: 'student@example.test',
        password: 'synthetic-wrong-password',
      }),
      {
        code: 'INVALID_CREDENTIALS',
        status: 401,
      },
    );
  });
});

describe('verification.service', () => {
  test('requires a valid token TTL', () => {
    expect(() =>
      createVerificationService({
        userRepository: {},
        verificationRepository: {},
        tokenTtlMs: 0,
      }),
    ).toThrow(/tokenTtlMs/i);
  });

  test('does not send verification email for an invalid user', async () => {
    const service = createVerificationService({
      userRepository: {},
      verificationRepository: {},
      emailService: {
        sendVerificationEmail: jest.fn(),
      },
    });

    await expectServiceError(
      service.sendEmailVerification(null),
      {
        code: 'INVALID_USER',
        status: 400,
      },
    );
  });

  test('rejects verification when atomic token consumption is unavailable', async () => {
    const service = createVerificationService({
      userRepository: {},
      verificationRepository: {},
    });

    await expectServiceError(
      service.verifyEmail({
        token: 'synthetic-verification-token',
      }),
      {
        code: 'VERIFICATION_REPOSITORY_MISCONFIGURED',
        status: 500,
      },
    );
  });

  test('returns a generic accepted response for an unknown email', async () => {
    const service = createVerificationService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue(null),
      },
      verificationRepository: {},
      emailService: {
        sendVerificationEmail: jest.fn(),
      },
    });

    await expect(
      service.resendEmailVerification('UNKNOWN@EXAMPLE.TEST'),
    ).resolves.toEqual({
      accepted: true,
    });
  });
});

describe('password.service', () => {
  test('requires core dependencies', () => {
    expect(() => createPasswordService({})).toThrow(
      /userRepository dependency is required/i,
    );
  });

  test('uses the same public response for an unknown reset email', async () => {
    const service = createPasswordService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue(null),
      },
      passwordResetRepository: {},
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
    });

    await expect(
      service.requestReset('UNKNOWN@EXAMPLE.TEST'),
    ).resolves.toEqual({
      accepted: true,
    });
  });

  test('rejects a new password shorter than the minimum length', async () => {
    const service = createPasswordService({
      userRepository: {},
      passwordResetRepository: {},
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
    });

    await expectServiceError(
      service.change('user-test-001', {
        currentPassword: 'synthetic-current-password',
        newPassword: 'short',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });

  test('rejects reusing the current password as the new password', async () => {
    const service = createPasswordService({
      userRepository: {},
      passwordResetRepository: {},
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
    });

    await expectServiceError(
      service.change('user-test-001', {
        currentPassword: 'synthetic-same-password',
        newPassword: 'synthetic-same-password',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });
});

describe('payment.service', () => {
  test('requires the payment repository', () => {
    expect(() =>
      createPaymentService({
        paymentProvider: {},
      }),
    ).toThrow(/paymentRepository dependency is required/i);
  });

  test('requires the payment provider', () => {
    expect(() =>
      createPaymentService({
        paymentRepository: {},
      }),
    ).toThrow(/paymentProvider dependency is required/i);
  });

  test('rejects invalid payment amounts', async () => {
    const service = createPaymentService({
      paymentRepository: {},
      paymentProvider: {},
    });

    await expectServiceError(
      service.createIntent({
        userId: 'user-test-001',
        amount: 0,
        currency: 'INR',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });
});

describe('subscription.service', () => {
  test('requires subscription dependencies', () => {
    expect(() => createSubscriptionService({})).toThrow(
      /subscriptionRepository dependency is required/i,
    );
  });

  test('rejects missing subscription identifiers', async () => {
    const service = createSubscriptionService({
      subscriptionRepository: {},
      planRepository: {},
      billingProvider: {},
    });

    await expectServiceError(
      service.subscribe({
        userId: '',
        planId: 'plan-test-001',
      }),
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      },
    );
  });
});
</CodeBlock>

Run the suite:

```bash
npx jest tests/unit/services.test.js --runInBand