
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const {
  idFrom,
  requireUser,
  normalizeFilters,
} = require('./controller.helpers');

const repository = require('../repositories/notification.repository');

const FILTER_FIELDS = Object.freeze([
  'status',
  'isRead',
  'type',
  'category',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'notificationId',
  'title',
  'message',
  'body',
  'type',
  'category',
  'status',
  'isRead',
  'readAt',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeNotificationFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const key of ['page', 'limit']) {
    if (filters[key] === undefined) continue;

    if (!/^[1-9]\d{0,5}$/.test(filters[key])) {
      throw httpError(400, 'INVALID_FILTER', `Invalid ${key} filter.`);
    }

    filters[key] = Number(filters[key]);
  }

  if (filters.page !== undefined && filters.page > 100000) {
    throw httpError(400, 'INVALID_PAGE', 'Page number is too large.');
  }

  if (filters.limit !== undefined) {
    filters.limit = Math.min(filters.limit, 100);
  }

  if (filters.isRead !== undefined) {
    if (!['true', 'false', '1', '0'].includes(filters.isRead)) {
      throw httpError(
        400,
        'INVALID_READ_FILTER',
        'isRead must be true or false.'
      );
    }

    filters.isRead = ['true', '1'].includes(filters.isRead);
  }

  if (filters.sortOrder !== undefined) {
    filters.sortOrder = filters.sortOrder.toLowerCase();

    if (!['asc', 'desc'].includes(filters.sortOrder)) {
      throw httpError(
        400,
        'INVALID_SORT_ORDER',
        'Sort order must be asc or desc.'
      );
    }
  }

  if (
    filters.sortBy !== undefined &&
    !['createdAt', 'updatedAt', 'readAt'].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported notification sort field.'
    );
  }

  return filters;
}

function sanitizeNotification(notification) {
  if (
    !notification ||
    typeof notification !== 'object' ||
    Array.isArray(notification)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The notification repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(notification, field)) {
      safe[field] = notification[field];
    }
  }

  return safe;
}

function requireRepositoryMethod(methodName) {
  if (typeof repository[methodName] !== 'function') {
    throw httpError(
      501,
      'NOTIFICATION_OPERATION_UNAVAILABLE',
      'This notification operation is not configured.'
    );
  }

  return repository[methodName].bind(repository);
}

/**
 * GET /notifications
 * List notifications belonging to the authenticated user.
 */
async function listNotifications(req, res) {
  const user = requireUser(req);
  const filters = normalizeNotificationFilters(req.query || {});
  const listForUser = requireRepositoryMethod('listForUser');

  const result = await listForUser(user.id, filters);

  if (
    !result ||
    !Array.isArray(result.items) ||
    !result.pagination ||
    typeof result.pagination !== 'object'
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The notification repository returned an invalid list response.'
    );
  }

  return sendSuccess(
    res,
    result.items.map(sanitizeNotification),
    200,
    { pagination: result.pagination }
  );
}

/**
 * GET /notifications/:id
 * Retrieve a notification belonging to the authenticated user.
 */
async function getNotification(req, res) {
  const user = requireUser(req);
  const id = idFrom(req);
  const findForUser = requireRepositoryMethod('findForUser');

  const notification = await findForUser(id, user.id);

  if (!notification) {
    throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  return sendSuccess(res, sanitizeNotification(notification));
}

/**
 * PATCH /notifications/:id/read
 * Mark a notification as read.
 */
async function markNotificationRead(req, res) {
  const user = requireUser(req);
  const id = idFrom(req);
  const markReadForUser = requireRepositoryMethod('markReadForUser');

  const notification = await markReadForUser(id, user.id);

  if (!notification) {
    throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  return sendSuccess(res, sanitizeNotification(notification));
}

module.exports = Object.freeze({
  list: asyncHandler(listNotifications),
  get: asyncHandler(getNotification),
  markRead: asyncHandler(markNotificationRead),
});
