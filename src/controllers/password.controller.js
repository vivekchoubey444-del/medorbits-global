
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { requireUser } = require('./controller.helpers');
const validator = require('../validators/password.validator');
const passwordService = require('../services/password.service');

function requireValidator(methodName) {
  if (!validator || typeof validator[methodName] !== 'function') {
    throw httpError(
      500,
      'PASSWORD_VALIDATOR_MISCONFIGURED',
      'Password validation is not configured.'
    );
  }

  return validator[methodName].bind(validator);
}

function requireService(methodName) {
  if (!passwordService || typeof passwordService[methodName] !== 'function') {
    throw httpError(
      503,
      'PASSWORD_SERVICE_UNAVAILABLE',
      'This password operation is temporarily unavailable.'
    );
  }

  return passwordService[methodName].bind(passwordService);
}

/**
 * PATCH /auth/password/change
 * Change the password for the authenticated user.
 */
const change = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const validateChange = requireValidator('validateChange');
  const data = validateChange(req.body);

  if (
    !data ||
    typeof data.currentPassword !== 'string' ||
    typeof data.newPassword !== 'string'
  ) {
    throw httpError(
      400,
      'INVALID_PASSWORD_DATA',
      'Valid current and new passwords are required.'
    );
  }

  const changePassword = requireService('changePassword');

  await changePassword({
    userId: user.id,
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  });

  return sendSuccess(res, {
    message: 'Password changed successfully.',
  });
});

/**
 * POST /auth/password/reset/request
 * Request a password-reset email without revealing account existence.
 */
const requestReset = asyncHandler(async (req, res) => {
  const validateResetRequest = requireValidator('validateResetRequest');
  const data = validateResetRequest(req.body);

  if (!data || typeof data.email !== 'string') {
    throw httpError(400, 'INVALID_EMAIL', 'A valid email address is required.');
  }

  const requestPasswordReset = requireService('requestPasswordReset');

  await requestPasswordReset({
    email: data.email.trim().toLowerCase(),
  });

  return sendSuccess(res, {
    message:
      'If an account matches that email, password-reset instructions will be sent.',
  });
});

/**
 * POST /auth/password/reset
 * Reset a password using a single-use token.
 */
const reset = asyncHandler(async (req, res) => {
  const validateReset = requireValidator('validateReset');
  const data = validateReset(req.body);

  if (
    !data ||
    typeof data.token !== 'string' ||
    typeof data.newPassword !== 'string'
  ) {
    throw httpError(
      400,
      'INVALID_RESET_DATA',
      'A valid reset token and new password are required.'
    );
  }

  const resetPassword = requireService('resetPassword');

  await resetPassword({
    token: data.token,
    newPassword: data.newPassword,
  });

  return sendSuccess(res, {
    message: 'Password reset successfully.',
  });
});

module.exports = Object.freeze({
  change,
  requestReset,
  reset,
});
