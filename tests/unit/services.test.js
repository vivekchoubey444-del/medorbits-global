
'use strict';

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

const { createAuditService, redact } = require('../../src/services/audit.service');
const { createAnalyticsService, sanitizeProperties } = require('../../src/services/analytics.service');
const { createUserService } = require('../../src/services/user.service');
const { createCourseService } = require('../../src/services/course.service');
const { createSearchService } = require('../../src/services/search.service');
const { createSessionService } = require('../../src/services/session.service');
const { createEmailService } = require('../../src/services/email.service');
const { createNotificationService } = require('../../src/services/notification.service');
const { createAuthService, sanitizeUser } = require('../../src/services/auth.service');
const { createVerificationService } = require('../../src/services/verification.service');
const { createPasswordService } = require('../../src/services/password.service');
const { createPaymentService } = require('../../src/services/payment.service');
const { createSubscriptionService } = require('../../src/services/subscription.service');

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
});

describe('service-utils validation helpers', () => {
  test('requiredString trims valid input', () => {
    expect(requiredString('  MedOrbits  ', 'name')).toBe('MedOrbits');
  });

  test('requiredString rejects missing and non-string values', () => {
    for (const value of [undefined, null, 123, {}, '']) {
      expect(() => requiredString(value, 'name')).toThrow(ServiceError);
    }
  });

  test('requiredString enforces length limits', () => {
    expect(() => requiredString('ab', 'name', { min: 3, max: 10 }))
      .toThrow(/between 3 and 10 characters/i);

    expect(() => requiredString('a'.repeat(11), 'name', { min: 1, max: 10 }))
      .toThrow(ServiceError);
  });

  test('requiredString rejects invalid length configuration', () => {
    expect(() => requiredString('valid', 'name', { min: -1, max: 10 }))
      .toThrow(TypeError);
  });

  test('requiredId accepts non-empty strings and finite numbers', () => {
    expect(requiredId('user-1')).toBe('user-1');
    expect(requiredId(123)).toBe(123);
  });

  test('requiredId rejects invalid identifiers', () => {
    for (const id of [undefined, null, '', '   ', NaN, Infinity, {}]) {
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

  test('assertFound returns an existing value', () => {
    const record = { id: 'record-1' };
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

  test('assertAllowed accepts only configured values', () => {
    expect(assertAllowed('active', ['active', 'disabled'], 'status'))
      .toBe('active');

    expect(() => assertAllowed('unknown', ['active', 'disabled'], 'status'))
      .toThrow(ServiceError);
  });

  test('safePage normalizes pagination and caps maximum values', () => {
    expect(safePage()).toEqual({ page: 1, limit: 20, offset: 0 });

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
      record: jest.fn().mockRejectedValue(new Error('Audit database unavailable')),
    };

    await expect(audit(auditService, { action: 'test.action' }))
      .resolves.toBeUndefined();

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
});

describe('createCrudService', () => {
  let repository;
  let auditService;
  let service;

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: 'course-1',
        name: 'Example Course',
      }),
      create: jest.fn().mockImplementation(async (data) => ({
        id: 'course-2',
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
    expect(() => createCrudService({
      repository: null,
      entity: 'Course',
    })).toThrow(/dependency is required/i);
  });

  test('requires a non-empty allowedSort array', () => {
    expect(() => createCrudService({
      repository,
      entity: 'Course',
      allowedSort: [],
    })).toThrow(/allowedSort/i);
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

    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }));
  });

  test('gets a record by ID', async () => {
    await expect(service.getById('course-1')).resolves.toEqual({
      id: 'course-1',
      name: 'Example Course',
    });

    expect(repository.findById).toHaveBeenCalledWith('course-1');
  });

  test('throws when a requested record does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('creates a record and audits the action', async () => {
    const result = await service.create(
      { name: 'New Course' },
      { id: 'admin-1' },
    );

    expect(result).toEqual({ id: 'course-2', name: 'New Course' });
    expect(repository.create).toHaveBeenCalledWith({ name: 'New Course' });

    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'course.created',
      entity: 'Course',
      entityId: 'course-2',
      actorId: 'admin-1',
    }));
  });

  test('rejects non-object create input', async () => {
    await expect(service.create([])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('updates a record and audits the action', async () => {
    await service.update(
      'course-1',
      { name: 'Updated Course' },
      { id: 'admin-1' },
    );

    expect(repository.updateById).toHaveBeenCalledWith(
      'course-1',
      { name: 'Updated Course' },
    );

    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'course.updated',
      entityId: 'course-1',
      actorId: 'admin-1',
    }));
  });

  test('removes a record and returns a deletion result', async () => {
    await expect(service.remove('course-1', { id: 'admin-1' }))
      .resolves.toEqual({ id: 'course-1', deleted: true });

    expect(repository.deleteById).toHaveBeenCalledWith('course-1');
  });

  test('rejects deletion when the repository reports no record', async () => {
    repository.deleteById.mockResolvedValue(false);

    await expect(service.remove('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('audit.service', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockImplementation(async (entry) => ({
        id: 'audit-1',
        ...entry,
      })),
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    service = createAuditService({
      auditRepository: repository,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  test('requires an audit repository', () => {
    expect(() => createAuditService({ auditRepository: null }))
      .toThrow(/dependency is required/i);
  });

  test('records normalized audit events', async () => {
    await service.record({
      action: ' user.created ',
      entity: 'User',
      entityId: 123,
      actorId: 'admin-1',
      requestId: 'request-1',
      metadata: { source: 'test' },
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.created',
      entity: 'User',
      entityId: '123',
      actorId: 'admin-1',
      requestId: 'request-1',
      metadata: { source: 'test' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
  });

  test('rejects malformed audit events', async () => {
    await expect(service.record(null)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });

    await expect(service.record({ action: '' })).rejects.toThrow(ServiceError);
  });

  test('redacts sensitive metadata keys', async () => {
    await service.record({
      action: 'auth.login',
      metadata: {
        username: 'student',
        password: 'secret-password',
        accessToken: 'sensitive-token',
        nested: {
          apiKey: 'secret-key',
          safeValue: 'visible',
        },
      },
    });

    expect(repository.create.mock.calls[0][0].metadata).toEqual({
      username: 'student',
      nested: { safeValue: 'visible' },
    });
  });

  test('rejects audit metadata that exceeds the allowed size', async () => {
    await expect(service.record({
      action: 'test.large',
      metadata: { content: 'x'.repeat(17000) },
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  test('lists audit events with validated filters', async () => {
    await service.list({
      limit: 10,
      actorId: 'admin-1',
      entity: 'User',
      action: 'user.created',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      actorId: 'admin-1',
      entity: 'User',
      action: 'user.created',
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    }));
  });

  test('rejects an inverted audit date range', async () => {
    await expect(service.list({
      from: '2026-02-01',
      to: '2026-01-01',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
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
      create: jest.fn().mockImplementation(async (event) => event),
      report: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    service = createAnalyticsService({
      analyticsRepository: repository,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  test('tracks events with sanitized properties', async () => {
    await service.track({
      name: 'course.viewed',
      actorId: 'user-1',
      properties: {
        category: 'medical',
        password: 'secret',
        email: 'private@example.com',
        count: 3,
      },
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'course.viewed',
      actorId: 'user-1',
      anonymousId: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      properties: { category: 'medical', count: 3 },
    }));
  });

  test('rejects an event with both actorId and anonymousId', async () => {
    await expect(service.track({
      name: 'course.viewed',
      actorId: 'user-1',
      anonymousId: 'anonymous-1',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('rejects invalid event names', async () => {
    await expect(service.track({ name: ' ' })).rejects.toThrow(ServiceError);
  });

  test('sanitizes sensitive analytics properties', () => {
    expect(sanitizeProperties({
      category: 'education',
      email: 'private@example.com',
      password: 'secret',
      nested: {
        safe: true,
        phone: '1234567890',
      },
    })).toEqual({
      category: 'education',
      nested: { safe: true },
    });
  });

  test('reports analytics with normalized pagination', async () => {
    await service.report({
      page: 2,
      limit: 10,
      eventName: 'course.viewed',
    });

    expect(repository.report).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      limit: 10,
      offset: 10,
      eventName: 'course.viewed',
    }));
  });

  test('rejects an inverted report date range', async () => {
    await expect(service.report({
      from: '2026-02-01',
      to: '2026-01-01',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });
});

describe('user.service', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Student',
        email: 'student@example.com',
        passwordHash: 'private-hash',
        resetToken: 'private-token',
      }),
      create: jest.fn(),
      updateById: jest.fn().mockImplementation(async (id, data) => ({
        id,
        name: 'Student',
        email: 'student@example.com',
        ...data,
        passwordHash: 'private-hash',
      })),
      deleteById: jest.fn().mockResolvedValue(true),
    };

    service = createUserService({ userRepository: repository });
  });

  test('requires a user repository', () => {
    expect(() => createUserService({})).toThrow(/userRepository is required/i);
  });

  test('gets a profile without exposing authentication secrets', async () => {
    await expect(service.getProfile('user-1')).resolves.toEqual({
      id: 'user-1',
      name: 'Student',
      email: 'student@example.com',
    });
  });

  test('removes blocked fields from profile updates', async () => {
    await service.updateProfile('user-1', {
      name: '  Updated Student  ',
      role: 'admin',
      status: 'active',
      passwordHash: 'attacker-controlled',
      isAdmin: true,
    });

    expect(repository.updateById).toHaveBeenCalledWith('user-1', {
      name: 'Updated Student',
    });
  });

  test('requires the dedicated email-change flow for email updates', async () => {
    await expect(service.updateProfile('user-1', {
      email: 'new@example.com',
    })).rejects.toThrow(/email-change verification flow/i);

    expect(repository.updateById).not.toHaveBeenCalled();
  });

  test('rejects unsupported user statuses', async () => {
    await expect(service.setStatus('user-1', 'superadmin'))
      .rejects.toThrow(/unsupported user status/i);
  });

  test('sets an allowed user status', async () => {
    await service.setStatus('user-1', 'suspended', { id: 'admin-1' });

    expect(repository.updateById).toHaveBeenCalledWith('user-1', {
      status: 'suspended',
    });
  });
});

describe('course.service', () => {
  test('requires a course repository', () => {
    expect(() => createCourseService({})).toThrow(/dependency is required/i);
  });

  test('publishes a course and sets publishedAt', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'course-1',
        status: 'draft',
        publishedAt: null,
      }),
      updateById: jest.fn().mockImplementation(async (id, changes) => ({
        id,
        ...changes,
      })),
    };

    const service = createCourseService({ courseRepository: repository });

    const result = await service.setStatus(
      'course-1',
      'published',
      { id: 'admin-1' },
    );

    expect(repository.updateById).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );

    expect(result.status).toBe('published');
  });

  test('rejects an unsupported course status', async () => {
    const service = createCourseService({ courseRepository: {} });

    await expect(service.setStatus('course-1', 'deleted'))
      .rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 422,
      });
  });

  test('throws when the course does not exist', async () => {
    const service = createCourseService({
      courseRepository: {
        findById: jest.fn().mockResolvedValue(null),
        updateById: jest.fn(),
      },
    });

    await expect(service.setStatus('missing', 'published'))
      .rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
  });
});

describe('search.service', () => {
  test('uses the central search repository when available', async () => {
    const searchRepository = {
      search: jest.fn().mockResolvedValue({ items: [] }),
    };

    const service = createSearchService({ searchRepository });

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
      search: jest.fn().mockResolvedValue([{ id: 'course-1' }]),
    };

    const service = createSearchService({ courseRepository });

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
      results: [{
        type: 'courses',
        items: [{ id: 'course-1' }],
      }],
    });
  });

  test('rejects search queries shorter than two characters', async () => {
    const service = createSearchService({});

    await expect(service.search({ q: 'a' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('rejects unsupported search types', async () => {
    const service = createSearchService({});

    await expect(service.search({
      q: 'medical',
      types: ['unknown'],
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('expands the all type into configured search types', async () => {
    const searchRepository = {
      search: jest.fn().mockResolvedValue({ items: [] }),
    };

    const service = createSearchService({ searchRepository });

    await service.search({ q: 'medical', types: ['all'] });

    expect(searchRepository.search).toHaveBeenCalledWith(expect.objectContaining({
      types: ['courses', 'colleges', 'jobs', 'internships'],
    }));
  });
});

describe('session.service', () => {
  test('rejects an invalid TTL', () => {
    expect(() => createSessionService({
      sessionRepository: {},
      ttlSeconds: 10,
    })).toThrow(/ttlSeconds/i);
  });

  test('creates a session with expiry and request context', async () => {
    const repository = {
      create: jest.fn().mockImplementation(async (session) => ({
        id: 'session-1',
        ...session,
      })),
    };

    const service = createSessionService({
      sessionRepository: repository,
      ttlSeconds: 3600,
    });

    await service.create('user-1', {
      ip: '127.0.0.1',
      userAgent: 'MedOrbits Test Client',
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'MedOrbits Test Client',
      revokedAt: null,
      expiresAt: expect.any(Date),
    }));
  });

  test("rejects access to another user's session", async () => {
    const service = createSessionService({
      sessionRepository: {
        findById: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-2',
          expiresAt: new Date(Date.now() + 60000),
          revokedAt: null,
        }),
      },
    });

    await expect(service.getActive('session-1', 'user-1'))
      .rejects.toMatchObject({
        code: 'SESSION_INVALID',
        status: 401,
      });
  });

  test('revokes an existing session', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
      }),
      updateById: jest.fn().mockResolvedValue({
        id: 'session-1',
        revokedAt: new Date(),
      }),
    };

    const service = createSessionService({ sessionRepository: repository });

    await expect(service.revoke('session-1', 'user-1'))
      .resolves.toEqual({ revoked: true });

    expect(repository.updateById).toHaveBeenCalledWith(
      'session-1',
      { revokedAt: expect.any(Date) },
    );
  });

  test('returns an idempotent result for a missing session', async () => {
    const service = createSessionService({
      sessionRepository: {
        findById: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(service.revoke('missing')).resolves.toEqual({
      revoked: true,
    });
  });
});

describe('email.service', () => {
  test('requires a provider', () => {
    expect(() => createEmailService({
      from: 'noreply@medorbits.in',
    })).toThrow(/dependency is required/i);
  });

  test('requires a valid HTTPS application URL', () => {
    expect(() => createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@medorbits.in',
      appUrl: 'http://example.com',
    })).toThrow(/HTTPS/i);
  });

  test('rejects invalid recipient email addresses', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@medorbits.in',
    });

    await expect(service.send({
      to: 'invalid-address',
      subject: 'Test',
      text: 'Hello',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('restricts recipient domains when configured', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@medorbits.in',
      allowedHosts: ['medorbits.in'],
    });

    await expect(service.send({
      to: 'student@example.com',
      subject: 'Test',
      text: 'Hello',
    })).rejects.toMatchObject({
      code: 'RECIPIENT_NOT_ALLOWED',
      status: 422,
    });
  });

  test('requires a subject or template', async () => {
    const service = createEmailService({
      provider: { send: jest.fn() },
      from: 'noreply@medorbits.in',
    });

    await expect(service.send({
      to: 'student@example.com',
      text: 'Hello',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });
});

describe('notification.service', () => {
  test('creates an in-app notification', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({
        id: 'notification-1',
        recipientId: 'user-1',
        status: 'unread',
      }),
    };

    const service = createNotificationService({
      notificationRepository: repository,
    });

    const result = await service.create({
      recipientId: 'user-1',
      title: 'Application update',
      message: 'Your application has been received.',
    });

    expect(result.status).toBe('unread');

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 'user-1',
      title: 'Application update',
      status: 'unread',
      channel: 'in_app',
    }));
  });

  test('rejects unsupported notification channels', async () => {
    const service = createNotificationService({
      notificationRepository: { create: jest.fn() },
    });

    await expect(service.create({
      recipientId: 'user-1',
      title: 'Notice',
      message: 'Test',
      channel: 'unsupported',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test("does not allow a user to read another user's notification", async () => {
    const service = createNotificationService({
      notificationRepository: {
        findById: jest.fn().mockResolvedValue({
          id: 'notification-1',
          recipientId: 'user-2',
          status: 'unread',
        }),
        updateById: jest.fn(),
      },
    });

    await expect(service.markRead('notification-1', 'user-1'))
      .rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
  });
});

describe('auth.service', () => {
  test('sanitizeUser removes authentication secrets', () => {
    expect(sanitizeUser({
      id: 'user-1',
      email: 'student@example.com',
      password: 'secret',
      passwordHash: 'hash',
      refreshToken: 'refresh-secret',
      sessionToken: 'session-secret',
      role: 'student',
    })).toEqual({
      id: 'user-1',
      email: 'student@example.com',
      role: 'student',
    });
  });

  test('sanitizeUser returns null for invalid input', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser('invalid')).toBeNull();
    expect(sanitizeUser([])).toBeNull();
  });

  test('requires authentication dependencies', () => {
    expect(() => createAuthService({}))
      .toThrow(/userRepository dependency is required/i);

    expect(() => createAuthService({
      userRepository: { create: jest.fn() },
    })).toThrow(/passwordHasher dependency is required/i);
  });

  test('registers a user with normalized email and hashed password', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'student@example.com',
        name: 'Student',
        status: 'pending_verification',
        passwordHash: 'hashed-password',
      }),
    };

    const passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn(),
    };

    const service = createAuthService({
      userRepository,
      passwordHasher,
      tokenService: { issue: jest.fn() },
    });

    const result = await service.register({
      name: 'Student',
      email: ' STUDENT@EXAMPLE.COM ',
      password: 'a-secure-password',
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('student@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('a-secure-password');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.email).toBe('student@example.com');
  });

  test('rejects duplicate email registration', async () => {
    const service = createAuthService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue({ id: 'existing-user' }),
        create: jest.fn(),
      },
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
      tokenService: { issue: jest.fn() },
    });

    await expect(service.register({
      name: 'Student',
      email: 'student@example.com',
      password: 'a-secure-password',
    })).rejects.toMatchObject({
      code: 'EMAIL_IN_USE',
      status: 409,
    });
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
      tokenService: { issue: jest.fn() },
    });

    await expect(service.login({
      email: 'student@example.com',
      password: 'wrong-password',
    })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
  });
});

describe('verification.service', () => {
  test('requires a valid token TTL', () => {
    expect(() => createVerificationService({
      userRepository: {},
      verificationRepository: {},
      tokenTtlMs: 0,
    })).toThrow(/tokenTtlMs/i);
  });

  test('does not send verification email for an invalid user', async () => {
    const service = createVerificationService({
      userRepository: {},
      verificationRepository: {},
      emailService: { sendVerificationEmail: jest.fn() },
    });

    await expect(service.sendEmailVerification(null))
      .rejects.toMatchObject({
        code: 'INVALID_USER',
        status: 400,
      });
  });

  test('rejects verification when atomic token consumption is unavailable', async () => {
    const service = createVerificationService({
      userRepository: {},
      verificationRepository: {},
    });

    await expect(service.verifyEmail({ token: 'verification-token' }))
      .rejects.toMatchObject({
        code: 'VERIFICATION_REPOSITORY_MISCONFIGURED',
        status: 500,
      });
  });

  test('returns a generic accepted response for an unknown email', async () => {
    const service = createVerificationService({
      userRepository: {
        findByEmail: jest.fn().mockResolvedValue(null),
      },
      verificationRepository: {},
      emailService: { sendVerificationEmail: jest.fn() },
    });

    await expect(service.resendEmailVerification('UNKNOWN@EXAMPLE.COM'))
      .resolves.toEqual({ accepted: true });
  });
});

describe('password.service', () => {
  test('requires core dependencies', () => {
    expect(() => createPasswordService({}))
      .toThrow(/userRepository dependency is required/i);
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

    await expect(service.requestReset('UNKNOWN@EXAMPLE.COM'))
      .resolves.toEqual({ accepted: true });
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

    await expect(service.change('user-1', {
      currentPassword: 'current-password',
      newPassword: 'short',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  test('rejects using the current password as the new password', async () => {
    const service = createPasswordService({
      userRepository: {},
      passwordResetRepository: {},
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn(),
      },
    });

    await expect(service.change('user-1', {
      currentPassword: 'same-password',
      newPassword: 'same-password',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });
});

describe('payment.service', () => {
  test('requires the payment repository', () => {
    expect(() => createPaymentService({
      paymentProvider: {},
    })).toThrow(/paymentRepository dependency is required/i);
  });

  test('requires the payment provider', () => {
    expect(() => createPaymentService({
      paymentRepository: {},
    })).toThrow(/paymentProvider dependency is required/i);
  });

  test('rejects invalid payment amounts', async () => {
    const service = createPaymentService({
      paymentRepository: {},
      paymentProvider: {},
    });

    await expect(service.createIntent({
      userId: 'user-1',
      amount: 0,
      currency: 'INR',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });
});

describe('subscription.service', () => {
  test('requires subscription dependencies', () => {
    expect(() => createSubscriptionService({}))
      .toThrow(/subscriptionRepository dependency is required/i);
  });

  test('rejects missing subscription identifiers', async () => {
    const service = createSubscriptionService({
      subscriptionRepository: {},
      planRepository: {},
      billingProvider: {},
    });

    await expect(service.subscribe({
      userId: '',
      planId: 'plan-1',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });
});
