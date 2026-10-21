'use strict';
/**
 * MedOrbits -- Authentication E2E Tests
 *
 * File: tests/e2e/authentication.e2e.test.js
 * Framework: Playwright Test
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
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const ROUTES = Object.freeze({
  login: process.env.E2E_LOGIN_PATH || '/login',
  dashboard: process.env.E2E_DASHBOARD_PATH || '/dashboard',
  logout: process.env.E2E_LOGOUT_PATH || null,
  register: process.env.E2E_REGISTER_PATH || '/register',
  protected: process.env.E2E_PROTECTED_PATH || '/dashboard',
});
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const TIMEOUT = 15000;
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
    (value) => typeof value === 'string' && value.trim().length > 0
  );
}
function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normalizedPath(path) {
  return path.replace(/\/+$/, '') || '/';
}
function currentPath(page) {
  return normalizedPath(new URL(page.url()).pathname);
}
function loginPath() {
  return normalizedPath(new URL(`${BASE_URL}${ROUTES.login}`).pathname);
}
function isLoginPage(page) {
  const pathname = currentPath(page);
  const login = loginPath();
  return pathname === login || pathname.startsWith(`${login}/`);
}
function isDeniedUrl(page) {
  return /forbidden|unauthorized|access-denied|not-authorized/i.test(
    page.url()
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
      `Could not locate ${description}. Check the selectors against the MedOrbits interface.`
    );
  }
  return locator;
}
async function openLoginPage(page) {
  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('body')).toBeVisible();
}
async function submitCredentials(page, email, password) {
  const emailInput = await requiredVisible(
    page,
    SELECTORS.email,
    'login email field'
  );
  const passwordInput = await requiredVisible(
    page,
    SELECTORS.password,
    'login password field'
  );
  await emailInput.fill(email);
  await passwordInput.fill(password);
  const submitButton = await requiredVisible(
    page,
    SELECTORS.submit,
    'login submit button'
  );
  await submitButton.click();
}
async function login(page, email, password) {
  await openLoginPage(page);
  await submitCredentials(page, email, password);
  // Navigation away from login is only an initial signal.
  // Callers must verify access to a protected resource.
  await expect
    .poll(
      async () => !isLoginPage(page),
      { timeout: TIMEOUT }
    )
    .toBeTruthy();
}
async function expectNotAuthenticated(page) {
  const deniedMessage = page.getByText(
    /invalid credentials|incorrect password|login failed|unable to sign in|please log in|access denied|not authorized|permission denied/i
  ).first();
  await expect
    .poll(
      async () => {
        if (isLoginPage(page) || isDeniedUrl(page)) {
          return 'denied';
        }
        if (await deniedMessage.isVisible().catch(() => false)) {
          return 'denied';
        }
        return 'pending';
      },
      { timeout: TIMEOUT }
    )
    .toBe('denied');
}
async function assertNoSensitiveError(page) {
  await expect(page.locator('body')).not.toContainText(
    /stack trace|database connection string|password hash|secret key|sqlstate|node_modules\/.*\.js/i
  );
}
async function assertProtectedAccessDenied(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'domcontentloaded',
  });
  const deniedStatus = [401, 403].includes(response?.status());
  const deniedMessage = page.getByText(
    /access denied|not authorized|forbidden|please log in|sign in to continue|permission denied/i
  ).first();
  const messageVisible = await deniedMessage
    .isVisible()
    .catch(() => false);
  expect(
    isLoginPage(page) ||
      isDeniedUrl(page) ||
      deniedStatus ||
      messageVisible,
    `Expected protected route "${route}" to deny access. URL: ${page.url()}`
  ).toBeTruthy();
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
      await requiredVisible(page, SELECTORS.email, 'login email field')
    ).toBeVisible();
    await expect(
      await requiredVisible(page, SELECTORS.password, 'login password field')
    ).toBeVisible();
    await expect(
      await requiredVisible(page, SELECTORS.submit, 'login submit button')
    ).toBeVisible();
  });
  test('password field masks entered characters', async ({ page }) => {
    await openLoginPage(page);
    const passwordInput = await requiredVisible(
      page,
      SELECTORS.password,
      'login password field'
    );
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
  test('empty credentials are rejected by form validation', async ({
    page,
  }) => {
    await openLoginPage(page);
    const emailInput = await requiredVisible(
      page,
      SELECTORS.email,
      'login email field'
    );
    const passwordInput = await requiredVisible(
      page,
      SELECTORS.password,
      'login password field'
    );
    const submitButton = await requiredVisible(
      page,
      SELECTORS.submit,
      'login submit button'
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
      (field) => field.required && !field.valid
    );
    const validationMessage = page.getByText(
      /email is required|password is required|enter your email|enter your password|required field/i
    ).first();
    const customValidationShown = await validationMessage
      .isVisible()
      .catch(() => false);
    expect(
      browserBlocksSubmission || customValidationShown,
      'Empty login must be blocked by browser or application validation.'
    ).toBeTruthy();
    await expect(page).toHaveURL(
      new RegExp(`${escaped(loginPath())}(?:[/?#]|$)`)
    );
  });
  test('invalid credentials do not grant protected access', async ({
    page,
  }) => {
    await openLoginPage(page);
    await submitCredentials(
      page,
      'invalid.user@example.test',
      'WrongTestOnly!Password999'
    );
    await expectNotAuthenticated(page);
    await assertNoSensitiveError(page);
    // Independently verify the protected route after the failed login.
    await assertProtectedAccessDenied(page, ROUTES.protected);
  });
  test('valid test-user credentials can access a protected route', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    const response = await page.goto(
      `${BASE_URL}${ROUTES.protected}`,
      { waitUntil: 'domcontentloaded' }
    );
    expect(
      response?.status(),
      'Protected route should not return a server error.'
    ).toBeLessThan(500);
    expect(
      isLoginPage(page),
      'Authenticated user should not be redirected back to login.'
    ).toBe(false);
    await expect(page.locator('body')).toBeVisible();
    await assertNoSensitiveError(page);
  });
  test('unauthenticated user cannot access a protected route', async ({
    page,
  }) => {
    await assertProtectedAccessDenied(page, ROUTES.protected);
  });
  test('logout ends access to protected pages', async ({ page }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.protected}`, {
      waitUntil: 'domcontentloaded',
    });
    if (ROUTES.logout) {
      // Configure this only if the application intentionally supports
      // a browser-accessible logout route.
      await page.goto(`${BASE_URL}${ROUTES.logout}`, {
        waitUntil: 'domcontentloaded',
      });
    } else {
      const logoutControl = await firstVisible(page, SELECTORS.logout);
      if (!logoutControl) {
        throw new Error(
          'No logout control found. Configure E2E_LOGOUT_PATH or update the logout selectors.'
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
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.protected}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(
      isLoginPage(page),
      'Refreshing a protected page should preserve a valid session.'
    ).toBe(false);
  });
  test('registration page responds without a server error', async ({
    page,
  }) => {
    const response = await page.goto(
      `${BASE_URL}${ROUTES.register}`,
      { waitUntil: 'domcontentloaded' }
    );
    expect(
      response?.status(),
      'Registration route should not return a server error.'
    ).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await assertNoSensitiveError(page);
  });
});