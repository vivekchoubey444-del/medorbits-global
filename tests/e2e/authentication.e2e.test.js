
'use strict';

/**
 * MedOrbits -- Authentication E2E Tests
 *
 * File: tests/e2e/authentication.e2e.test.js
 * Framework: Playwright Test
 * Requires: Node.js >= 20
 *
 * Run:
 *   npx playwright test tests/e2e/authentication.e2e.test.js
 *
 * Environment:
 *   E2E_BASE_URL
 *   E2E_LOGIN_PATH
 *   E2E_DASHBOARD_PATH
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional:
 *   E2E_LOGOUT_PATH
 *   E2E_REGISTER_PATH
 *   E2E_PROTECTED_PATH
 *
 * Security:
 * - Use a dedicated test environment and synthetic accounts.
 * - Never run destructive tests against production.
 * - Never hard-code real credentials.
 * - Never log passwords, cookies, tokens, or authorization headers.
 */

const { test, expect } = require('@playwright/test');

const TIMEOUT = 15000;

function getBaseUrl() {
  const raw = String(
    process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
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

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'E2E_BASE_URL must not contain credentials, query parameters, or fragments.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.E2E_ALLOW_PRODUCTION === 'true'
  ) {
    throw new Error(
      'Refusing to run authentication E2E tests against production.',
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

function normalizePath(value, name) {
  const path = String(value || '').trim();

  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\r\n\\]/.test(path)
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

const BASE_URL = getBaseUrl();

const ROUTES = Object.freeze({
  login: normalizePath(
    process.env.E2E_LOGIN_PATH || '/login',
    'E2E_LOGIN_PATH',
  ),
  dashboard: normalizePath(
    process.env.E2E_DASHBOARD_PATH || '/dashboard',
    'E2E_DASHBOARD_PATH',
  ),
  logout: process.env.E2E_LOGOUT_PATH
    ? normalizePath(process.env.E2E_LOGOUT_PATH, 'E2E_LOGOUT_PATH')
    : null,
  register: normalizePath(
    process.env.E2E_REGISTER_PATH || '/register',
    'E2E_REGISTER_PATH',
  ),
  protected: normalizePath(
    process.env.E2E_PROTECTED_PATH ||
      process.env.E2E_DASHBOARD_PATH ||
      '/dashboard',
    'E2E_PROTECTED_PATH',
  ),
});

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
  submit: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
  ],
  logout: [
    'button:has-text("Log out")',
    'button:has-text("Logout")',
    'button:has-text("Sign out")',
    'a:has-text("Log out")',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function currentPath(page) {
  return new URL(page.url()).pathname.replace(/\/+$/, '') || '/';
}

function isLoginPage(page) {
  const pathname = currentPath(page);

  return (
    pathname === ROUTES.login ||
    pathname.startsWith(`${ROUTES.login}/`)
  );
}

function isDeniedUrl(page) {
  return /forbidden|unauthorized|access-denied|not-authorized/i.test(
    page.url(),
  );
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
}

async function requiredVisible(page, selectors, description) {
  const locator = await firstVisible(page, selectors);

  if (!locator) {
    throw new Error(
      `Could not locate ${description}. Check the selectors against the MedOrbits interface.`,
    );
  }

  return locator;
}

async function openLoginPage(page) {
  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  await expect(page.locator('body')).toBeVisible();
}

async function submitCredentials(page, email, password) {
  const emailInput = await requiredVisible(
    page,
    SELECTORS.email,
    'login email field',
  );

  const passwordInput = await requiredVisible(
    page,
    SELECTORS.password,
    'login password field',
  );

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = await requiredVisible(
    page,
    SELECTORS.submit,
    'login submit button',
  );

  await submitButton.click();
}

async function login(page, email, password) {
  await openLoginPage(page);
  await submitCredentials(page, email, password);

  // Leaving the login page is an initial signal only.
  // Protected-resource access must be verified independently.
  await expect
    .poll(
      async () => !isLoginPage(page),
      { timeout: TIMEOUT },
    )
    .toBeTruthy();
}

async function expectNotAuthenticated(page) {
  const deniedMessage = page.getByText(
    /invalid credentials|incorrect password|login failed|unable to sign in|please log in|access denied|not authorized|permission denied/i,
  ).first();

  await expect
    .poll(
      async () => {
        if (isLoginPage(page) || isDeniedUrl(page)) {
          return true;
        }

        return deniedMessage.isVisible().catch(() => false);
      },
      { timeout: TIMEOUT },
    )
    .toBeTruthy();
}

async function assertNoSensitiveError(page) {
  await expect(page.locator('body')).not.toContainText(
    /stack trace|database connection string|password hash|secret key|sqlstate|node_modules\/.*\.js/i,
  );
}

async function assertProtectedAccessDenied(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  if ([401, 403].includes(response?.status())) {
    return;
  }

  if (isLoginPage(page) || isDeniedUrl(page)) {
    return;
  }

  const deniedMessage = page.getByText(
    /access denied|not authorized|forbidden|please log in|sign in to continue|permission denied/i,
  ).first();

  await expect(deniedMessage).toBeVisible({
    timeout: TIMEOUT,
  });
}

async function assertAuthenticatedAccess(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  expect(
    response,
    `Expected an HTTP response for protected route "${route}".`,
  ).not.toBeNull();

  expect(
    response.status(),
    `Protected route "${route}" must not return an HTTP error.`,
  ).toBeLessThan(400);

  expect(
    isLoginPage(page),
    'Authenticated user must not be redirected to login.',
  ).toBe(false);

  await expect(page.locator('body')).toBeVisible();
  await assertNoSensitiveError(page);
}

test.describe('MedOrbits authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1365,
      height: 900,
    });
  });

  test('login page loads successfully', async ({ page }) => {
    await openLoginPage(page);

    await expect(
      await requiredVisible(
        page,
        SELECTORS.email,
        'login email field',
      ),
    ).toBeVisible();

    await expect(
      await requiredVisible(
        page,
        SELECTORS.password,
        'login password field',
      ),
    ).toBeVisible();

    await expect(
      await requiredVisible(
        page,
        SELECTORS.submit,
        'login submit button',
      ),
    ).toBeVisible();
  });

  test('password field masks entered characters', async ({ page }) => {
    await openLoginPage(page);

    const passwordInput = await requiredVisible(
      page,
      SELECTORS.password,
      'login password field',
    );

    await expect(passwordInput).toHaveAttribute(
      'type',
      'password',
    );
  });

  test('empty credentials are rejected by form validation', async ({
    page,
  }) => {
    await openLoginPage(page);

    const emailInput = await requiredVisible(
      page,
      SELECTORS.email,
      'login email field',
    );

    const passwordInput = await requiredVisible(
      page,
      SELECTORS.password,
      'login password field',
    );

    const submitButton = await requiredVisible(
      page,
      SELECTORS.submit,
      'login submit button',
    );

    await submitButton.click();

    const validation = await Promise.all([
      emailInput.evaluate((element) => ({
        required: element.required,
        valid: element.checkValidity(),
      })),
      passwordInput.evaluate((element) => ({
        required: element.required,
        valid: element.checkValidity(),
      })),
    ]);

    const browserBlocksSubmission = validation.some(
      (field) => field.required && !field.valid,
    );

    const validationMessage = page.getByText(
      /email is required|password is required|enter your email|enter your password|required field/i,
    ).first();

    const customValidationShown = await validationMessage
      .isVisible()
      .catch(() => false);

    expect(
      browserBlocksSubmission || customValidationShown,
      'Empty login must be blocked by browser or application validation.',
    ).toBe(true);

    expect(
      isLoginPage(page),
      'Empty credentials must not authenticate the user.',
    ).toBe(true);
  });

  test('invalid credentials do not grant protected access', async ({
    page,
  }) => {
    await openLoginPage(page);

    await submitCredentials(
      page,
      'invalid.user@example.test',
      'WrongTestOnly!Password999',
    );

    await expectNotAuthenticated(page);
    await assertNoSensitiveError(page);

    // Verify authorization independently of the login response.
    await assertProtectedAccessDenied(page, ROUTES.protected);
  });

  test('valid test-user credentials can access a protected route', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertAuthenticatedAccess(page, ROUTES.protected);
  });

  test('unauthenticated user cannot access a protected route', async ({
    page,
  }) => {
    await assertProtectedAccessDenied(page, ROUTES.protected);
  });

  test('logout ends access to protected pages', async ({ page }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertAuthenticatedAccess(page, ROUTES.protected);

    if (ROUTES.logout) {
      await page.goto(`${BASE_URL}${ROUTES.logout}`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });
    } else {
      const logoutControl = await firstVisible(
        page,
        SELECTORS.logout,
      );

      if (!logoutControl) {
        throw new Error(
          'No logout control found. Configure E2E_LOGOUT_PATH or update the logout selectors.',
        );
      }

      await logoutControl.click();
    }

    await assertProtectedAccessDenied(page, ROUTES.protected);
  });

  test('refreshing a protected page preserves a valid session', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.',
    );

    await login(page, USER_EMAIL, USER_PASSWORD);

    await assertAuthenticatedAccess(page, ROUTES.protected);

    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    expect(
      isLoginPage(page),
      'Refreshing a protected page should preserve a valid session.',
    ).toBe(false);

    await expect(page.locator('body')).toBeVisible();
  });

  test('registration page responds without a server error', async ({
    page,
  }) => {
    const response = await page.goto(
      `${BASE_URL}${ROUTES.register}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      },
    );

    expect(
      response,
      'Registration route should return a document response.',
    ).not.toBeNull();

    expect(
      response.status(),
      'Registration route should not return a server error.',
    ).toBeLessThan(500);

    await expect(page.locator('body')).toBeVisible();
    await assertNoSensitiveError(page);
  });
});
