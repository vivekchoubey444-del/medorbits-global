
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const authService = require('../services/auth.service');

const controller = Object.create(null);

const MAX_TOKEN_LENGTH = 8192;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireBody(req) {
  if (!isPlainObject(req.body)) {
    throw httpError(400, 'A valid JSON request body is required.');
  }

  return req.body;
}

function pickFields(body, fields) {
  const result = Object.create(null);

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body[field];

    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  });

  if (missing.length > 0) {
    throw httpError(400, `Required fields: ${missing.join(', ')}.`);
  }
}

function requireString(value, field, maxLength = 512) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw httpError(400, `Invalid ${field}.`);
  }

  return value.trim();
}

function validateEmail(value) {
  const email = requireString(value, 'email', 254).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'A valid email address is required.');
  }

  return email;
}

function validatePhone(value) {
  const phone = requireString(value, 'phone', 20);

  // Require international format, e.g. +919876543210.
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw httpError(
      400,
      'Enter a valid phone number in international format.'
    );
  }

  return phone;
}

function validateOtp(value) {
  const otp = requireString(value, 'OTP', 12);

  if (!/^\d{4,8}$/.test(otp)) {
    throw httpError(400, 'Enter a valid OTP.');
  }

  return otp;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw httpError(
      400,
      'Password must contain between 12 and 128 characters.'
    );
  }

  return value;
}

function validateToken(value, field = 'token') {
  const token = requireString(value, field, MAX_TOKEN_LENGTH);

  if (/\s/.test(token)) {
    throw httpError(400, `Invalid ${field}.`);
  }

  return token;
}

function getServiceMethod(methodName) {
  const method = authService && authService[methodName];

  if (typeof method !== 'function') {
    throw httpError(
      503,
      `Authentication operation "${methodName}" is not configured.`
    );
  }

  return method.bind(authService);
}

function createHandler(methodName, buildPayload, options = {}) {
  return asyncHandler(async (req, res) => {
    const payload = buildPayload(req);
    const result = await getServiceMethod(methodName)(payload, req);

    if (options.noContent === true) {
      return res.status(204).end();
    }

    return sendSuccess(
      res,
      result === undefined ? null : result,
      options.status || 200
    );
  });
}

/**
 * POST /api/v1/auth/register
 *
 * Creates an account. Email/phone verification must be enforced by the
 * authentication service before the account becomes fully active.
 */
controller.register = createHandler(
  'register',
  (req) => {
    const body = requireBody(req);

    requireFields(body, ['email', 'password']);

    const payload = pickFields(body, [
      'firstName',
      'lastName',
      'name',
      'email',
      'phone',
      'password',
      'role',
      'acceptedTerms',
      'acceptedPrivacyPolicy',
      'referralCode',
    ]);

    payload.email = validateEmail(body.email);
    payload.password = validatePassword(body.password);

    if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
      payload.phone = validatePhone(body.phone);
    }

    // Public registration must not permit privilege escalation.
    delete payload.role;

    return payload;
  },
  { status: 201 }
);

/**
 * POST /api/v1/auth/login
 *
 * Email/password login. The service must verify the password hash and
 * enforce account status, lockouts, and any required MFA policy.
 */
controller.login = createHandler('login', (req) => {
  const body = requireBody(req);

  requireFields(body, ['email', 'password']);

  return {
    email: validateEmail(body.email),
    password: requireString(body.password, 'password', 128),
  };
});

/**
 * POST /api/v1/auth/email-otp/request
 */
controller.requestEmailOtp = createHandler('requestEmailOtp', (req) => {
  const body = requireBody(req);

  requireFields(body, ['email']);

  return {
    email: validateEmail(body.email),
    purpose: body.purpose === 'login' ? 'login' : 'verification',
  };
});

/**
 * POST /api/v1/auth/email-otp/verify
 */
controller.verifyEmailOtp = createHandler('verifyEmailOtp', (req) => {
  const body = requireBody(req);

  requireFields(body, ['email', 'otp']);

  return {
    email: validateEmail(body.email),
    otp: validateOtp(body.otp),
    purpose: body.purpose === 'login' ? 'login' : 'verification',
  };
});

/**
 * POST /api/v1/auth/phone-otp/request
 */
controller.requestPhoneOtp = createHandler('requestPhoneOtp', (req) => {
  const body = requireBody(req);

  requireFields(body, ['phone']);

  return {
    phone: validatePhone(body.phone),
    purpose: body.purpose === 'login' ? 'login' : 'verification',
  };
});

/**
 * POST /api/v1/auth/phone-otp/verify
 */
controller.verifyPhoneOtp = createHandler('verifyPhoneOtp', (req) => {
  const body = requireBody(req);

  requireFields(body, ['phone', 'otp']);

  return {
    phone: validatePhone(body.phone),
    otp: validateOtp(body.otp),
    purpose: body.purpose === 'login' ? 'login' : 'verification',
  };
});

/**
 * POST /api/v1/auth/google
 *
 * Accepts a Google ID token or an authorization code.
 * The service must verify it with Google's official verification flow.
 * Never trust a client-supplied Google profile or email alone.
 */
controller.googleLogin = createHandler('googleLogin', (req) => {
  const body = requireBody(req);

  const payload = pickFields(body, [
    'idToken',
    'authorizationCode',
    'redirectUri',
    'codeVerifier',
  ]);

  if (payload.idToken !== undefined) {
    payload.idToken = validateToken(payload.idToken, 'Google ID token');
  }

  if (payload.authorizationCode !== undefined) {
    payload.authorizationCode = validateToken(
      payload.authorizationCode,
      'Google authorization code'
    );
  }

  if (!payload.idToken && !payload.authorizationCode) {
    throw httpError(
      400,
      'A Google ID token or authorization code is required.'
    );
  }

  if (payload.redirectUri !== undefined) {
    payload.redirectUri = requireString(
      payload.redirectUri,
      'redirect URI',
      2048
    );
  }

  if (payload.codeVerifier !== undefined) {
    payload.codeVerifier = requireString(
      payload.codeVerifier,
      'PKCE code verifier',
      256
    );
  }

  return payload;
});

/**
 * POST /api/v1/auth/refresh
 *
 * The service must rotate refresh tokens and detect token reuse.
 */
controller.refresh = createHandler('refresh', (req) => {
  const body = requireBody(req);

  const refreshToken =
    body.refreshToken ||
    (req.cookies && req.cookies.refreshToken);

  requireFields({ refreshToken }, ['refreshToken']);

  return {
    refreshToken: validateToken(refreshToken, 'refresh token'),
  };
});

/**
 * POST /api/v1/auth/logout
 *
 * Revoke the current refresh token/session server-side.
 */
controller.logout = createHandler('logout', (req) => {
  const body = isPlainObject(req.body) ? req.body : {};

  const refreshToken =
    body.refreshToken ||
    (req.cookies && req.cookies.refreshToken);

  return {
    refreshToken:
      refreshToken === undefined || refreshToken === null || refreshToken === ''
        ? null
        : validateToken(refreshToken, 'refresh token'),
    userId: req.user && (req.user.id || req.user.userId),
    tokenId: req.auth && req.auth.tokenId,
  };
});

/**
 * POST /api/v1/auth/password/forgot
 *
 * Always return a generic response from the service to reduce account
 * enumeration. Apply a dedicated rate limiter at the route.
 */
controller.forgotPassword = createHandler('forgotPassword', (req) => {
  const body = requireBody(req);

  requireFields(body, ['email']);

  return {
    email: validateEmail(body.email),
  };
});

/**
 * POST /api/v1/auth/password/reset
 *
 * The service must verify a single-use, expiring reset token.
 */
controller.resetPassword = createHandler('resetPassword', (req) => {
  const body = requireBody(req);

  requireFields(body, ['token', 'password']);

  return {
    token: validateToken(body.token, 'password reset token'),
    password: validatePassword(body.password),
  };
});

/**
 * GET /api/v1/auth/me
 *
 * Mount behind authenticate middleware.
 */
controller.me = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw httpError(401, 'Authentication required.');
  }

  const getCurrentUser = getServiceMethod('getCurrentUser');
  const user = await getCurrentUser(
    { userId: req.user.id || req.user.userId },
    req
  );

  return sendSuccess(res, user, 200);
});

/**
 * POST /api/v1/auth/email/change/request
 */
controller.requestEmailChange = createHandler(
  'requestEmailChange',
  (req) => {
    if (!req.user) {
      throw httpError(401, 'Authentication required.');
    }

    const body = requireBody(req);

    requireFields(body, ['email']);

    return {
      userId: req.user.id || req.user.userId,
      email: validateEmail(body.email),
    };
  }
);

/**
 * POST /api/v1/auth/phone/change/request
 */
controller.requestPhoneChange = createHandler(
  'requestPhoneChange',
  (req) => {
    if (!req.user) {
      throw httpError(401, 'Authentication required.');
    }

    const body = requireBody(req);

    requireFields(body, ['phone']);

    return {
      userId: req.user.id || req.user.userId,
      phone: validatePhone(body.phone),
    };
  }
);

/**
 * POST /api/v1/auth/password/change
 *
 * Mount behind authenticate middleware.
 */
controller.changePassword = createHandler('changePassword', (req) => {
  if (!req.user) {
    throw httpError(401, 'Authentication required.');
  }

  const body = requireBody(req);

  requireFields(body, ['currentPassword', 'newPassword']);

  return {
    userId: req.user.id || req.user.userId,
    currentPassword: requireString(
      body.currentPassword,
      'current password',
      128
    ),
    newPassword: validatePassword(body.newPassword),
  };
});

module.exports = controller;
