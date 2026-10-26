 'use strict';

const crypto = require('node:crypto');

const {
  ServiceError,
  requireDependency,
  requiredString,
  audit,
} = require('./service-utils');

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function createVerificationService({
  userRepository,
  verificationRepository,
  emailService,
  auditService,
  tokenTtlMs = DEFAULT_TOKEN_TTL_MS,
  clock = () => new Date(),
}) {
  requireDependency(userRepository, 'userRepository');
  requireDependency(
    verificationRepository,
    'verificationRepository',
  );

  if (typeof userRepository.findByEmail !== 'function') {
    throw new TypeError(
      'userRepository must implement findByEmail().',
    );
  }

  if (typeof verificationRepository.create !== 'function') {
    throw new TypeError(
      'verificationRepository must implement create().',
    );
  }

  if (
    !Number.isSafeInteger(tokenTtlMs) ||
    tokenTtlMs <= 0 ||
    tokenTtlMs > MAX_TOKEN_TTL_MS
  ) {
    throw new TypeError(
      'tokenTtlMs must be a positive integer no greater than 24 hours.',
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  function getNow() {
    const value = clock();

    if (
      !(value instanceof Date) ||
      Number.isNaN(value.getTime())
    ) {
      throw new TypeError(
        'clock must return a valid Date.',
      );
    }

    return new Date(value.getTime());
  }

  function createToken() {
    return crypto.randomBytes(TOKEN_BYTES).toString('hex');
  }

  function hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
  }

  function invalidTokenError() {
    return new ServiceError(
      'Verification token is invalid, expired, or already used.',
      {
        code: 'TOKEN_INVALID',
        status: 400,
      },
    );
  }

  function assertValidUser(user) {
    if (
      !user ||
      typeof user !== 'object' ||
      user.id == null ||
      typeof user.email !== 'string' ||
      !user.email.trim()
    ) {
      throw new ServiceError(
        'A valid user is required.',
        {
          code: 'INVALID_USER',
          status: 400,
        },
      );
    }
  }

  async function sendEmailVerification(user) {
    assertValidUser(user);

    if (
      typeof emailService?.sendVerificationEmail !== 'function'
    ) {
      throw new ServiceError(
        'Email delivery is not configured.',
        {
          code: 'EMAIL_NOT_CONFIGURED',
          status: 503,
        },
      );
    }

    if (user.status !== 'pending_verification') {
      throw new ServiceError(
        'This account is not awaiting email verification.',
        {
          code: 'VERIFICATION_NOT_REQUIRED',
          status: 409,
        },
      );
    }

    const token = createToken();
    const tokenHash = hashToken(token);
    const now = getNow();
    const expiresAt = new Date(
      now.getTime() + tokenTtlMs,
    );

    // If supported, invalidate older outstanding tokens before
    // issuing another one. Implement this operation atomically
    // in the repository.
    if (
      typeof verificationRepository
        .invalidateOutstandingTokens === 'function'
    ) {
      await verificationRepository.invalidateOutstandingTokens(
        user.id,
        'email',
        now,
      );
    }

    await verificationRepository.create({
      userId: user.id,
      tokenHash,
      type: 'email',
      expiresAt,
      consumedAt: null,
      createdAt: now,
    });

    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        name: typeof user.name === 'string' ? user.name : '',
        token,
        expiresAt,
        expiryMinutes: Math.ceil(tokenTtlMs / 60000),
      });
    } catch {
      // Do not log or expose the raw token or verification URL.
      // If available, invalidate the token after delivery failure.
      if (
        typeof verificationRepository
          .invalidateByTokenHash === 'function'
      ) {
        try {
          await verificationRepository.invalidateByTokenHash(
            tokenHash,
            getNow(),
          );
        } catch {
          // Monitor cleanup failures without logging secrets.
        }
      }

      throw new ServiceError(
        'Unable to send the verification email. Please try again later.',
        {
          code: 'EMAIL_DELIVERY_FAILED',
          status: 503,
        },
      );
    }

    return { sent: true };
  }

  async function verifyEmail(input = {}) {
    const token = requiredString(input.token, 'token', {
      max: 256,
    });

    if (!TOKEN_PATTERN.test(token)) {
      throw invalidTokenError();
    }

    const tokenHash = hashToken(token);
    const now = getNow();

    /*
     * REQUIRED ATOMIC REPOSITORY CONTRACT
     *
     * consumeValidTokenAndActivateUser(tokenHash, now)
     *
     * Within one database transaction, this method must:
     * 1. Find a token whose hash and type match.
     * 2. Confirm it is unconsumed and has not expired.
     * 3. Confirm the user is still pending verification.
     * 4. Consume the token exactly once.
     * 5. Activate the user and set emailVerifiedAt.
     * 6. Commit all changes atomically.
     *
     * Return the updated user or null.
     * Concurrent verification attempts must not both succeed.
     */
    if (
      typeof verificationRepository
        .consumeValidTokenAndActivateUser !== 'function'
    ) {
      throw new ServiceError(
        'Atomic email verification is not configured.',
        {
          code: 'VERIFICATION_REPOSITORY_MISCONFIGURED',
          status: 500,
        },
      );
    }

    const user =
      await verificationRepository
        .consumeValidTokenAndActivateUser(tokenHash, now);

    if (!user) {
      throw invalidTokenError();
    }

    // The shared audit helper intentionally swallows audit-provider
    // errors. Operational monitoring should report audit failures.
    await audit(auditService, {
      action: 'verification.email_verified',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
      metadata: {
        method: 'email_token',
      },
    });

    return {
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async function resendEmailVerification(email) {
    const normalizedEmail = requiredString(
      email,
      'email',
      { max: 254 },
    ).toLowerCase();

    // The controller should return the same public response for
    // all eligible and ineligible addresses to reduce enumeration.
    const user = await userRepository.findByEmail(
      normalizedEmail,
    );

    if (user && user.status === 'pending_verification') {
      await sendEmailVerification(user);
    }

    return { accepted: true };
  }

  return {
    sendEmailVerification,
    verifyEmail,
    resendEmailVerification,
  };
}

module.exports = {
  createVerificationService,
  DEFAULT_TOKEN_TTL_MS,
  MAX_TOKEN_TTL_MS,
};
