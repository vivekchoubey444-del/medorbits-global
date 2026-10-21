
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredString,
  safePage,
  plainObject,
} = require('./service-utils');

const MAX_PROPERTIES = 50;
const MAX_PROPERTY_KEY_LENGTH = 80;
const MAX_STRING_LENGTH = 500;
const MAX_PROPERTY_DEPTH = 4;
const MAX_PROPERTY_BYTES = 16_384;
const MAX_EVENT_NAME_LENGTH = 100;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_REPORT_DAYS = 366;

const SENSITIVE_KEY_PATTERN =
  /password|passphrase|token|secret|email|phone|mobile|address|document|payment|authorization|cookie|credential|api.?key|private.?key|card|cvv|cvc|bank.?account|date.?of.?birth|dob|passport|aadhaar|otp|recovery.?code|session|refresh.?key|access.?key/i;

function normalizeDate(value, field) {
  if (value == null || value === '') {
    return undefined;
  }

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ServiceError(`${field} must be a valid date.`, {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  }

  return date;
}

function sanitizeProperties(value, depth = 0) {
  if (value == null) {
    return {};
  }

  if (!Number.isSafeInteger(depth) || depth < 0) {
    throw new ServiceError('Invalid property nesting depth.', {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  }

  const input = plainObject(value, 'properties');

  if (depth >= MAX_PROPERTY_DEPTH) {
    return {};
  }

  const result = Object.create(null);
  const entries = Object.entries(input).slice(0, MAX_PROPERTIES);

  for (const [key, val] of entries) {
    if (
      typeof key !== 'string' ||
      SENSITIVE_KEY_PATTERN.test(key)
    ) {
      continue;
    }

    const safeKey = key.trim().slice(0, MAX_PROPERTY_KEY_LENGTH);

    if (!safeKey || SENSITIVE_KEY_PATTERN.test(safeKey)) {
      continue;
    }

    if (typeof val === 'string') {
      result[safeKey] = val
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .slice(0, MAX_STRING_LENGTH);
      continue;
    }

    if (typeof val === 'number' && Number.isFinite(val)) {
      result[safeKey] = val;
      continue;
    }

    if (typeof val === 'boolean' || val === null) {
      result[safeKey] = val;
      continue;
    }

    if (Array.isArray(val)) {
      result[safeKey] = val
        .slice(0, MAX_PROPERTIES)
        .map((item) => {
          if (item === null || typeof item === 'boolean') {
            return item;
          }

          if (typeof item === 'string') {
            return item
              .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
              .slice(0, MAX_STRING_LENGTH);
          }

          if (typeof item === 'number' && Number.isFinite(item)) {
            return item;
          }

          if (
            item &&
            typeof item === 'object' &&
            !Array.isArray(item)
          ) {
            try {
              return sanitizeProperties(item, depth + 1);
            } catch {
              return undefined;
            }
          }

          return undefined;
        })
        .filter((item) => item !== undefined);

      continue;
    }

    if (typeof val === 'object') {
      try {
        result[safeKey] = sanitizeProperties(val, depth + 1);
      } catch {
        // Unsupported nested values are excluded.
      }
    }
  }

  return result;
}

function normalizeOptionalIdentifier(value, field) {
  if (value == null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' &&
    !(typeof value === 'number' && Number.isSafeInteger(value))
  ) {
    throw new ServiceError(`${field} must be a string or safe integer.`, {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  }

  return requiredString(String(value), field, {
    max: MAX_IDENTIFIER_LENGTH,
  });
}

function normalizeEventName(value) {
  const name = requiredString(value, 'event.name', {
    max: MAX_EVENT_NAME_LENGTH,
  });

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(name)
  ) {
    throw new ServiceError('Invalid event name.', {
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  }

  return name;
}

function getClockDate(clock) {
  const value = clock();
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ServiceError('Invalid clock result.', {
      code: 'CONFIGURATION_ERROR',
      status: 500,
    });
  }

  return date;
}

function createAnalyticsService({
  analyticsRepository,
  clock = () => new Date(),
}) {
  requireDependency(analyticsRepository, 'analyticsRepository');

  if (
    typeof analyticsRepository.create !== 'function' ||
    typeof analyticsRepository.report !== 'function'
  ) {
    throw new ServiceError(
      'Analytics repository must implement create() and report().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  return {
    async track(event) {
      if (
        !event ||
        typeof event !== 'object' ||
        Array.isArray(event)
      ) {
        throw new ServiceError('event must be an object.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      const name = normalizeEventName(event.name);

      const actorId = normalizeOptionalIdentifier(
        event.actorId,
        'actorId',
      );

      const anonymousId = normalizeOptionalIdentifier(
        event.anonymousId,
        'anonymousId',
      );

      if (actorId && anonymousId) {
        throw new ServiceError(
          'Provide actorId or anonymousId, not both.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const occurredAt = event.occurredAt == null
        ? getClockDate(clock)
        : normalizeDate(event.occurredAt, 'occurredAt');

      const now = getClockDate(clock);

      // Reject future-dated events beyond a small clock-skew allowance.
      if (occurredAt.getTime() > now.getTime() + 5 * 60 * 1000) {
        throw new ServiceError(
          'occurredAt cannot be in the future.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const properties = sanitizeProperties(
        event.properties == null ? {} : event.properties,
      );

      let serialized;

      try {
        serialized = JSON.stringify(properties);
      } catch {
        throw new ServiceError(
          'Event properties could not be serialized.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      if (
        Buffer.byteLength(serialized, 'utf8') > MAX_PROPERTY_BYTES
      ) {
        throw new ServiceError(
          'Event properties exceed the allowed size.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      return analyticsRepository.create({
        name,
        actorId,
        anonymousId,
        occurredAt,
        properties,
      });
    },

    async report(query = {}, actor = {}) {
      if (
        !query ||
        typeof query !== 'object' ||
        Array.isArray(query)
      ) {
        throw new ServiceError(
          'Report query must be an object.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      if (
        !actor ||
        typeof actor !== 'object' ||
        Array.isArray(actor)
      ) {
        throw new ServiceError('Invalid report actor.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      /*
       * Reporting is privileged. The actor must come from trusted
       * authentication middleware, never directly from request input.
       */
      if (
        actor.isAdmin !== true &&
        !(
          Array.isArray(actor.permissions) &&
          actor.permissions.includes('analytics:read')
        )
      ) {
        throw new ServiceError('Analytics report access denied.', {
          code: 'FORBIDDEN',
          status: 403,
        });
      }

      const { page, limit, offset } = safePage(query);

      const from = normalizeDate(query.from, 'from');
      const to = normalizeDate(query.to, 'to');

      if (from && to && from.getTime() > to.getTime()) {
        throw new ServiceError(
          'from must be earlier than or equal to to.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      if (from && to) {
        const rangeMs = to.getTime() - from.getTime();
        const maxRangeMs = MAX_REPORT_DAYS * 24 * 60 * 60 * 1000;

        if (rangeMs > maxRangeMs) {
          throw new ServiceError(
            `Report range cannot exceed ${MAX_REPORT_DAYS} days.`,
            {
              code: 'VALIDATION_ERROR',
              status: 422,
            },
          );
        }
      }

      const eventName =
        query.eventName == null || query.eventName === ''
          ? undefined
          : normalizeEventName(query.eventName);

      return analyticsRepository.report({
        from,
        to,
        eventName,
        page,
        limit,
        offset,
      });
    },
  };
}

module.exports = {
  createAnalyticsService,
  sanitizeProperties,
  normalizeDate,
  normalizeOptionalIdentifier,
};
