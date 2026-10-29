'use strict';

// Fail-closed integration adapter. Inject a real implementation before enabling
// this service in production. No fake data or successful writes are returned.
const unavailable = (method) => async function serviceNotConfigured() {
  const error = new Error(`Service integration is not configured: ${method}`);
  error.status = 503;
  error.code = 'SERVICE_UNAVAILABLE';
  error.expose = true;
  throw error;
};
module.exports = Object.freeze({
  listPublishedJobs: unavailable('listPublishedJobs'),
  listFeaturedJobs: unavailable('listFeaturedJobs'),
  getPublishedJobById: unavailable('getPublishedJobById'),
  getPublishedJobBySlug: unavailable('getPublishedJobBySlug'),
  listMyJobs: unavailable('listMyJobs'),
  createJob: unavailable('createJob'),
  updateJob: unavailable('updateJob'),
  requestJobPublication: unavailable('requestJobPublication'),
  closeJob: unavailable('closeJob'),
  deleteJob: unavailable('deleteJob'),
  reviewJob: unavailable('reviewJob'),
});
