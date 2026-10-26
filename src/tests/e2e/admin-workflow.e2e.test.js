
'use strict';

/**
 * MedOrbits -- Admin Workflow E2E Tests
 *
 * File: tests/e2e/admin-workflow.e2e.test.js
 * Framework: Playwright Test
 * Requires: Node.js >= 20
 *
 * Run:
 *   npx playwright test tests/e2e/admin-workflow.e2e.test.js
 *
 * Required for authenticated tests:
 *   E2E_ADMIN_EMAIL
 *   E2E_ADMIN_PASSWORD
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional:
 *   E2E_BASE_URL
 *   E2E_LOGIN_PATH
 *   E2E_ADMIN_DASHBOARD_PATH
 *   E2E_ADMIN_USERS_PATH
 *   E2E_ADMIN_APPLICATIONS_PATH
 *
 * Security:
 * - Use a dedicated test environment and synthetic test accounts.
 * - Never run destructive E2E tests against production.
 * - Never hard-code real credentials.
 * - Never log passwords, cookies, tokens, or authorization headers.
 */

const { test, expect } = require('@playwright/test');

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

const TIMEOUTS = Object.freeze({
  navigation: 15000,
  action: 10000,
});

function normalizePath(value, name) {
  const path = String(value || '').trim();

  if (!path) {
    throw new Error(`${name} must not be empty.`);
  }

  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\r\n\\]/.test(path) ||
    /^[a-z][a-z\d+.-]*:/i.test(path)
  ) {
    throw new Error(
      `${name} must be a local absolute path beginning with "/".`,
    );
  }

  const parsed = new URL(path, 'http://127.0.0.1');

  if (parsed.origin !== 'http://127.0.0.1') {
    throw new Error(`${name} must not change the URL origin.`);
  }

  return parsed.pathname.replace(/\/+$/, '') || '/';
}

function getBaseUrl() {
  const raw = String(
    process.env.E2E_BASE_URL || DEFAULT_BASE_URL,
  ).trim();

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      'E2E_BASE_URL must be a valid absolute HTTP(S) URL.',
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('E2E_BASE_URL must use HTTP or HTTPS.');
  }

  if (url.username || url.password) {
    throw new Error(
      'Do not include credentials in E2E_BASE_URL.',
    );
  }

  if (url.search || url.hash) {
    throw new Error(
      'E2E_BASE_URL must not contain a query string or fragment.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.E2E_ALLOW_PRODUCTION === 'true'
  ) {
    throw new Error(
      'Refusing to run admin E2E tests in a production environment.',
    );
  }

  if (
    process.env.E2E_BASE_URL &&
    !['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
    process.env.E2E_ALLOW_REMOTE_TEST_TARGET !== 'true'
  ) {
    throw new Error(
      'Remote E2E targets require E2E_ALLOW_REMOTE_TEST_TARGET=true. ' +
      'Use only a dedicated, authorized test environment.',
    );
  }

  return url.origin.replace(/\/+$/, '');
}

const BASE_URL = getBaseUrl();

const ROUTES = Object.freeze({
  login: normalizePath(
    process.env.E2E_LOGIN_PATH || '/login',
    'E2E_LOGIN_PATH',
  ),
  dashboard: normalizePath(
    process.env.E2E_ADMIN_DASHBOARD_PATH || '/admin',
    'E2E_ADMIN_DASHBOARD_PATH',
  ),
  users: normalizePath(
    process.env.E2E_ADMIN_USERS_PATH || '/admin/users',
    'E2E_ADMIN_USERS_PATH',
  ),
  applications: normalizePath(
    process.env.E2E_ADMIN_APPLICATIONS_PATH ||
      '/admin/applications',
    'E2E_ADMIN_APPLICATIONS_PATH',
  ),
});

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;

const SELECTORS = Object.freeze({
  email: [
    'input[name="email"]',
    'input[type="email"]',
    '#email',
  ],
  password: [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
  ],
  loginButton: [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
  ],
  logoutButton: [
    'button:has-text("Log out")',
    'button:has-text("Logout")',
    'button:has-text("Sign out")',
    'a:has-text("Logout")',
    'a:has-text("Sign out")',
  ],
});

function hasCredentials(...values) {
  return values.every(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0,
  );
}

function routePattern(route) {
  const escaped = route.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );

  return new RegExp(`${escaped}(?:[/?#]|$)`);
}

function currentPathname(page) {
  return new URL(page.url()).pathname.replace(/\/+$/, '') || '/';
}

function isLoginPath(page) {
  const current = currentPathname(page);

  return (
    current === ROUTES.login ||
    current.startsWith(`${ROUTES.login}/`)
  );
}

function isAccessDeniedUrl(page) {
  return /forbidden|unauthorized|access-denied|not-authorized/i.test(
    page.url(),
  );
}

function isAdminPath(page) {
  const current = currentPathname(page);

  return (
    current === ROUTES.dashboard ||
    current.startsWith(`${ROUTES.dashboard}/`)
  );
}

async function firstVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  throw new Error(
    `No visible element found for selectors: ${selectors.join(', ')}`,
  );
}

async function assertNoServerError(page) {
  await expect(page.locator('body')).not.toContainText(
    /internal server error|uncaught exception|application error/i,
  );
}

async function assertPageLoadedSuccessfully(page, response) {
  expect(
    response,
    'Expected a response from the application.',
  ).not.toBeNull();

  expect(
    response.status(),
    'Page request must not return a server error.',
  ).toBeLessThan(500);

  await expect(page.locator('body')).toBeVisible();

  await assertNoServerError(page);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });

  const emailInput = await firstVisibleLocator(
    page,
    SELECTORS.email,
  );

  const passwordInput = await firstVisibleLocator(
    page,
    SELECTORS.password,
  );

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = await firstVisibleLocator(
    page,
    SELECTORS.loginButton,
  );

  await submitButton.click();

  // Do not treat a redirect alone as proof of successful login.
  // Protected-route authorization is verified separately.
  await expect
    .poll(
      async () => !isLoginPath(page),
      { timeout: TIMEOUTS.navigation },
    )
    .toBeTruthy();
}

async function visitProtectedRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });

  return {
    response,
    pathname: currentPathname(page),
  };
}

async function assertAccessDenied(page, response) {
  const status = response?.status();

  if ([401, 403].includes(status)) {
    return;
  }

  if (isLoginPath(page) || isAccessDeniedUrl(page)) {
    return;
  }

  const deniedMessage = page.getByText(
    /access denied|not authorized|forbidden|permission denied|please log in|sign in to continue/i,
  ).first();

  await expect
    .poll(
      async () =>
        deniedMessage.isVisible().catch(() => false),
      { timeout: TIMEOUTS.navigation },
    )
    .toBeTruthy();
}

async function assertAdminRouteAccessible(page, route) {
  const { response, pathname } = await visitProtectedRoute(
    page,
    route,
  );

  expect(
    response?.status(),
    'The admin route must not return an HTTP error.',
  ).toBeLessThan(400);

  expect(
    pathname,
    `Expected access to remain on the requested admin route: ${route}`,
  ).toMatch(routePattern(route));

  await assertPageLoadedSuccessfully(page, response);
}

async function assertOrdinaryUserDenied(page, route) {
  const { response } = await visitProtectedRoute(page, route);

  const redirectedAwayFromAdmin =
    !isAdminPath(page) &&
    (isLoginPath(page) || isAccessDeniedUrl(page));

  if ([401, 403].includes(response?.status())) {
    return;
  }

  if (redirectedAwayFromAdmin) {
    return;
  }

  await assertAccessDenied(page, response);

  // A forbidden response, login redirect, or explicit denial message
  // is required. A successful HTTP status alone does not prove access.
}

test.describe('MedOrbits admin workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 900,
    });
  });

  test('login page provides credential inputs', async ({ page }) => {
    const response = await page.goto(
      `${BASE_URL}${ROUTES.login}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.navigation,
      },
    );

    await assertPageLoadedSuccessfully(page, response);

    const emailInput = await firstVisibleLocator(
      page,
      SELECTORS.email,
    );

    const passwordInput = await firstVisibleLocator(
      page,
      SELECTORS.password,
    );

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await expect(emailInput).toHaveAttribute(
      'type',
      /^(email|text)$/i,
    );

    await expect(passwordInput).toHaveAttribute(
      'type',
      'password',
    );
  });

  test('unauthenticated visitors cannot access the admin dashboard', async ({
    page,
  }) => {
    const { response } = await visitProtectedRoute(
      page,
      ROUTES.dashboard,
    );

    await assertAccessDenied(page, response);
  });

  test('admin can sign in and access the dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.',
    );

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await assertAdminRouteAccessible(
      page,
      ROUTES.dashboard,
    );
  });

  test('admin can access user management', async ({ page }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.',
    );

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await assertAdminRouteAccessible(
      page,
      ROUTES.users,
    );
  });

  test('admin can access application review', async ({ page }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.',
    );

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await assertAdminRouteAccessible(
      page,
      ROUTES.applications,
    );
  });

  test('ordinary user cannot access the admin dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertOrdinaryUserDenied(
      page,
      ROUTES.dashboard,
    );
  });

  test('ordinary user cannot access admin user management', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertOrdinaryUserDenied(
      page,
      ROUTES.users,
    );
  });

  test('ordinary user cannot access application administration', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertOrdinaryUserDenied(
      page,
      ROUTES.applications,
    );
  });

  test('logout prevents subsequent access to the admin dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.',
    );

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await assertAdminRouteAccessible(
      page,
      ROUTES.dashboard,
    );

    const logoutButton = await firstVisibleLocator(
      page,
      SELECTORS.logoutButton,
    );

    await logoutButton.click();

    await expect
      .poll(
        async () => {
          if (isLoginPath(page) || isAccessDeniedUrl(page)) {
            return true;
          }

          return /login|logout|signed-out/i.test(
            currentPathname(page),
          );
        },
        { timeout: TIMEOUTS.navigation },
      )
      .toBeTruthy();

    const { response } = await visitProtectedRoute(
      page,
      ROUTES.dashboard,
    );

    await assertAccessDenied(page, response);
  });

  test('invalid credentials do not grant admin access', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.login}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });

    const emailInput = await firstVisibleLocator(
      page,
      SELECTORS.email,
    );

    const passwordInput = await firstVisibleLocator(
      page,
      SELECTORS.password,
    );

    await emailInput.fill('invalid.admin@example.test');

    await passwordInput.fill(
      'Invalid-Test-Password-Not-Real-123!',
    );

    const submitButton = await firstVisibleLocator(
      page,
      SELECTORS.loginButton,
    );

    await submitButton.click();

    const errorMessage = page.getByText(
      /invalid credentials|incorrect password|login failed|unable to sign in|invalid email or password/i,
    ).first();

    await expect
      .poll(
        async () => {
          if (isLoginPath(page)) {
            return true;
          }

          return errorMessage.isVisible().catch(() => false);
        },
        { timeout: TIMEOUTS.action },
      )
      .toBeTruthy();

    const { response } = await visitProtectedRoute(
      page,
      ROUTES.dashboard,
    );

    await assertAccessDenied(page, response);
  });
});
