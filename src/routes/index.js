
'use strict';

/**
 * MedOrbits -- Central API Router
 *
 * File: src/routes/index.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1
 *
 * Responsibilities:
 * - Validate route definitions.
 * - Load and validate Express Router exports.
 * - Mount API modules in a deterministic order.
 * - Fail fast when required production routes are missing or invalid.
 *
 * Security:
 * - Keep authentication and authorization in the appropriate middleware.
 * - Do not expose stack traces or internal paths to API clients.
 * - Avoid logging secrets, request bodies, or personal information.
 * - Review every registered route for its access-control policy.
 */

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const router = express.Router();

const ROUTES_DIR = __dirname;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const routeDefinitions = [
  ['/auth', 'auth.routes.js'],
  ['/sessions', 'session.routes.js'],
  ['/verification', 'verification.routes.js'],
  ['/password', 'password.routes.js'],
  ['/users', 'user.routes.js'],
  ['/courses', 'course.routes.js'],
  ['/colleges', 'college.routes.js'],
  ['/universities', 'university.routes.js'],
  ['/admissions', 'admission.routes.js'],
  ['/applications', 'application.routes.js'],
  ['/counselling', 'counselling.routes.js'],
  ['/documents', 'document.routes.js'],
  ['/jobs', 'job.routes.js'],
  ['/internships', 'internship.routes.js'],
  ['/candidates', 'candidate.routes.js'],
  ['/employers', 'employer.routes.js'],
  ['/recruitment', 'recruitment.routes.js'],
  ['/services', 'service.routes.js'],
  ['/public-data', 'public-data.routes.js'],
  ['/search', 'search.routes.js'],
  ['/site-search', 'site-search.routes.js'],
  ['/notifications', 'notification.routes.js'],
  ['/public-releases', 'public-release.routes.js'],
  ['/payments', 'payment.routes.js'],
  ['/uploads', 'upload.routes.js'],
  ['/contact', 'contact.routes.js'],
  ['/faqs', 'faq.routes.js'],
  ['/subscriptions', 'subscription.routes.js'],
  ['/admin', 'admin.routes.js'],
];

const ROUTE_FILENAME_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.routes\.js$/;

function resolveRouter(exported, filename) {
  const candidates = [
    exported,
    exported && exported.router,
    exported && exported.default,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'function' &&
      typeof candidate.use === 'function' &&
      typeof candidate.handle === 'function'
    ) {
      return candidate;
    }
  }

  throw new TypeError(
    `Route module "${filename}" must export an Express Router.`,
  );
}

function validateDefinitions() {
  const prefixes = new Set();
  const filenames = new Set();

  for (const definition of routeDefinitions) {
    if (!Array.isArray(definition) || definition.length !== 2) {
      throw new TypeError('Each route definition must contain a prefix and filename.');
    }

    const [prefix, filename] = definition;

    if (
      typeof prefix !== 'string' ||
      !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(prefix)
    ) {
      throw new Error(`Invalid route prefix: ${String(prefix)}`);
    }

    if (
      typeof filename !== 'string' ||
      !ROUTE_FILENAME_PATTERN.test(filename) ||
      path.basename(filename) !== filename
    ) {
      throw new Error(`Invalid route filename: ${String(filename)}`);
    }

    if (prefixes.has(prefix)) {
      throw new Error(`Duplicate route prefix: ${prefix}`);
    }

    if (filenames.has(filename)) {
      throw new Error(`Duplicate route module: ${filename}`);
    }

    prefixes.add(prefix);
    filenames.add(filename);
  }
}

function loadRouteModule(filename) {
  const absolutePath = path.resolve(ROUTES_DIR, filename);
  const relative = path.relative(ROUTES_DIR, absolutePath);

  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Route module is outside the routes directory: ${filename}`);
  }

  if (!fs.existsSync(absolutePath)) {
    return { missing: true };
  }

  const stat = fs.statSync(absolutePath);

  if (!stat.isFile()) {
    throw new Error(`Route module is not a regular file: ${filename}`);
  }

  try {
    return {
      missing: false,
      exported: require(absolutePath),
    };
  } catch (cause) {
    throw new Error(
      `Failed to load route module "${filename}": ${cause.message}`,
      { cause },
    );
  }
}

function mountRoutes() {
  validateDefinitions();

  const missing = [];
  const mounted = [];

  for (const [prefix, filename] of routeDefinitions) {
    const loaded = loadRouteModule(filename);

    if (loaded.missing) {
      missing.push(`${prefix} -> ${filename}`);
      continue;
    }

    let route;

    try {
      route = resolveRouter(loaded.exported, filename);
    } catch (cause) {
      throw new Error(
        `Invalid route export for "${filename}" at "${prefix}": ${cause.message}`,
        { cause },
      );
    }

    try {
      router.use(prefix, route);
    } catch (cause) {
      throw new Error(
        `Failed to mount "${filename}" at "${prefix}": ${cause.message}`,
        { cause },
      );
    }

    mounted.push({ prefix, filename });
  }

  if (missing.length > 0) {
    const message =
      `Missing route modules:\n- ${missing.join('\n- ')}`;

    if (IS_PRODUCTION) {
      throw new Error(
        `[MedOrbits][Routes] Production startup aborted. ${message}`,
      );
    }

    console.warn(`[MedOrbits][Routes] ${message}`);
  }

  for (const item of mounted) {
    console.log(
      `[MedOrbits][Routes] Mounted /api/v1${item.prefix} -> ${item.filename}`,
    );
  }

  console.log(
    `[MedOrbits][Routes] Mounted ${mounted.length} route module(s).`,
  );
}

mountRoutes();

module.exports = router;
