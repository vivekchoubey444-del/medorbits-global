'use strict';

const {
  ServiceError,
  requireDependency,
  requiredString,
  requiredId,
  assertFound,
  audit,
} = require('./service-utils');

const BLOCKED_USER_FIELDS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'resetToken',
  'resetTokenHash',
  'reset_token',
  'reset_token_hash',
  'verificationToken',
  'verificationTokenHash',
  'verification_token',
  'verification_token_hash',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'sessionToken',
  'session_token',
  'recoveryCode',
  'recoveryCodes',
  'recovery_code',
  'recovery_codes',
  'mfaSecret',
  'mfa_secret',
  'twoFactorSecret',
  'two_factor_secret',
  'totpSecret',
  'totp_secret',
  'privateKey',
  'private_key',
]);

function sanitizeUser(user) {
  if (
    !user ||
    typeof user !== 'object' ||
    Array.isArray(user)
  ) {
    return null;
  }

  const safe = {};

  for (const [key, value] of Object.entries(user)) {
    if (BLOCKED_USER_FIELDS.has(key)) {
      continue;
    }

    // Avoid exposing nested credential fields from repository
    // projections or accidentally populated relations.
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      safe[key] = sanitizeNestedObject(value);
      continue;
    }

    if (Array.isArray(value)) {
      safe[key] = value.map((item) => {
        if (
          item &&
          typeof item === 'object' &&
          !Array.isArray(item)
        ) {
          return sanitizeNestedObject(item);
        }

        return item;
      });

      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function sanitizeNestedObject(value) {
  const safe = {};

  for (const [key, item] of Object.entries(value)) {
    if (BLOCKED_USER_FIELDS.has(key)) {
      continue;
    }

    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item)
    ) {
      safe[key] = sanitizeNestedObject(item);
    } else if (Array.isArray(item)) {
      safe[key] = item.map((entry) => {
        if (
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry)
        ) {
          return sanitizeNestedObject(entry);
        }

        return entry;
      });
    } else {
      safe[key] = item;
    }
  }

  return safe;
}

function createAuthService({
  userRepository,
  passwordHasher,
  tokenService,
  sessionService,
  auditService,
  verificationService,
}) {
  requireDependency(userRepository, 'userRepository');
  requireDependency(passwordHasher, 'passwordHasher');
  requireDependency(tokenService, 'tokenService');

  if (typeof userRepository.create !== 'function') {
    throw new TypeError(
      'userRepository must implement create().'
    );
  }

  if (typeof userRepository.findByEmail !== 'function') {
    throw new TypeError(
      'userRepository must implement findByEmail().'
    );
  }

  if (typeof passwordHasher.hash !== 'function') {
    throw new TypeError(
      'passwordHasher must implement hash().'
    );
  }

  if (typeof passwordHasher.verify !== 'function') {
    throw new TypeError(
      'passwordHasher must implement verify().'
    );
  }

  if (typeof tokenService.issue !== 'function') {
    throw new TypeError(
      'tokenService must implement issue().'
    );
  }

  function normalizeEmail(value) {
    return requiredString(value, 'email', {
      max: 254,
    }).trim().toLowerCase();
  }

  async function findUserByEmail(email) {
    return userRepository.findByEmail(email);
  }

  function assertAccountCanLogin(user) {
    if (
      user.status === 'suspended' ||
      user.status === 'disabled' ||
      user.status === 'blocked'
    ) {
      throw new ServiceError(
        'This account is unavailable.',
        {
          code: 'ACCOUNT_UNAVAILABLE',
          status: 403,
        }
      );
    }

    if (
      user.status === 'pending_verification' ||
      user.status === 'pending'
    ) {
      throw new ServiceError(
        'Verify your email before signing in.',
        {
          code: 'VERIFICATION_REQUIRED',
          status: 403,
        }
      );
    }

    if (user.status !== 'active') {
      throw new ServiceError(
        'This account is unavailable.',
        {
          code: 'ACCOUNT_UNAVAILABLE',
          status: 403,
        }
      );
    }
  }

  async function writeAudit(event) {
    await audit(auditService, event);
  }

  return {
    async register(input = {}) {
      const email = normalizeEmail(input.email);

      const password = requiredString(
        input.password,
        'password',
        { min: 10, max: 200 }
      );

      const name = requiredString(input.name, 'name', {
        max: 120,
      }).trim();

      const existing = await findUserByEmail(email);

      if (existing) {
        throw new ServiceError(
          'An account with this email already exists.',
          {
            code: 'EMAIL_IN_USE',
            status: 409,
          }
        );
      }

      const passwordHash = await passwordHasher.hash(password);

      const user = assertFound(
        await userRepository.create({
          email,
          passwordHash,
          name,
          status: 'pending_verification',
          roles: ['user'],
        }),
        'User'
      );

      let verificationRequired = false;

      if (
        verificationService &&
        typeof verificationService.sendEmailVerification ===
          'function'
      ) {
        verificationRequired = true;

        try {
          await verificationService.sendEmailVerification(user);
        } catch {
          // Keep the account pending verification.
          // Do not expose tokens or verification secrets.
          // Record delivery failures within the verification
          // service without logging sensitive message content.
        }
      }

      await writeAudit({
        action: 'auth.registered',
        entity: 'User',
        entityId: user.id,
        actorId: user.id,
        metadata: {
          verificationRequired,
        },
      });

      return {
        user: sanitizeUser(user),
        verificationRequired,
      };
    },

    async login(input = {}, context = {}) {
      const email = normalizeEmail(input.email);

      const password = requiredString(
        input.password,
        'password',
        { max: 200 }
      );

      const user = await findUserByEmail(email);

      if (
        !user ||
        typeof user.passwordHash !== 'string' ||
        !user.passwordHash ||
        !(await passwordHasher.verify(
          password,
          user.passwordHash
        ))
      ) {
        throw new ServiceError(
          'Email or password is incorrect.',
          {
            code: 'INVALID_CREDENTIALS',
            status: 401,
          }
        );
      }

      assertAccountCanLogin(user);

      let session = null;

      if (sessionService) {
        if (typeof sessionService.create !== 'function') {
          throw new TypeError(
            'sessionService must implement create().'
          );
        }

        session = assertFound(
          await sessionService.create(user.id, context),
          'Session'
        );
      }

      let tokens;

      try {
        tokens = await tokenService.issue({
          userId: user.id,
          sessionId: session?.id,
          roles: Array.isArray(user.roles)
            ? user.roles
            : [],
        });

        if (
          !tokens ||
          typeof tokens !== 'object' ||
          Array.isArray(tokens)
        ) {
          throw new TypeError(
            'tokenService.issue() must return a token object.'
          );
        }

        // Never allow a token provider to overwrite the sanitized
        // user or session returned by this service.
        if (
          Object.prototype.hasOwnProperty.call(tokens, 'user') ||
          Object.prototype.hasOwnProperty.call(tokens, 'session')
        ) {
          throw new TypeError(
            'Token response must not contain user or session properties.'
          );
        }
      } catch (error) {
        if (session?.id && sessionService?.revoke) {
          try {
            await sessionService.revoke(
              session.id,
              user.id
            );
          } catch {
            // Operational monitoring should capture cleanup failures
            // without recording tokens or other secrets.
          }
        }

        throw error;
      }

      await writeAudit({
        action: 'auth.login',
        entity: 'User',
        entityId: user.id,
        actorId: user.id,
        metadata: {
          sessionId: session?.id ?? null,
        },
      });

      return {
        user: sanitizeUser(user),
        session: session ? sanitizeUser(session) : null,
        ...tokens,
      };
    },

    async refresh(input = {}) {
      if (typeof tokenService.refresh !== 'function') {
        throw new ServiceError(
          'Token refresh is not configured.',
          {
            code: 'TOKEN_REFRESH_UNAVAILABLE',
            status: 501,
          }
        );
      }

      const refreshToken = requiredString(
        input.refreshToken,
        'refreshToken',
        { max: 4096 }
      );

      return tokenService.refresh(refreshToken);
    },

    async logout({
      userId,
      sessionId,
      refreshToken,
    } = {}) {
      let sessionRevoked = false;
      let refreshTokenRevoked = false;

      if (sessionId != null) {
        requiredId(sessionId, 'sessionId');
        requiredId(userId, 'userId');

        if (
          !sessionService ||
          typeof sessionService.revoke !== 'function'
        ) {
          throw new ServiceError(
            'Session revocation is not configured.',
            {
              code: 'SESSION_REVOCATION_UNAVAILABLE',
              status: 501,
            }
          );
        }

        await sessionService.revoke(sessionId, userId);
        sessionRevoked = true;
      }

      if (refreshToken != null) {
        const token = requiredString(
          refreshToken,
          'refreshToken',
          { max: 4096 }
        );

        if (typeof tokenService.revoke !== 'function') {
          throw new ServiceError(
            'Token revocation is not configured.',
            {
              code: 'TOKEN_REVOCATION_UNAVAILABLE',
              status: 501,
            }
          );
        }

        await tokenService.revoke(token);
        refreshTokenRevoked = true;
      }

      if (userId != null) {
        requiredId(userId, 'userId');

        await writeAudit({
          action: 'auth.logout',
          entity: 'User',
          entityId: userId,
          actorId: userId,
          metadata: {
            sessionRevoked,
            refreshTokenRevoked,
          },
        });
      }

      return {
        loggedOut: true,
      };
    },
  };
}

module.exports = {
  createAuthService,
  sanitizeUser,
};