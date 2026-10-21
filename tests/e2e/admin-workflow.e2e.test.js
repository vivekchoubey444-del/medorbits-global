'use strict';
/**
 * MedOrbits -- Admin Workflow E2E Tests
 *
 * File: tests/e2e/admin-workflow.e2e.test.js
 * Framework: Playwright Test
 *
 * Run:
 *   npx playwright test tests/e2e/admin-workflow.e2e.test.js
 *
 * Required environment variables for authenticated tests:
 *   E2E_BASE_URL
 *   E2E_ADMIN_EMAIL
 *   E2E_ADMIN_PASSWORD
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional route overrides:
 *   E2E_LOGIN_PATH
 *   E2E_ADMIN_DASHBOARD_PATH
 *   E2E_ADMIN_USERS_PATH
 *   E2E_ADMIN_APPLICATIONS_PATH
 *
 * Security:
 * - Use a dedicated test environment and synthetic test accounts.
 * - Never run destructive E2E tests against production.
 * - Do not hard-code real credentials.
 * - Never log passwords, cookies, tokens, or authorization headers.
 */
const { test, expect } = require('@playwright/test');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const ROUTES = Object.freeze({
  login: process.env.E2E_LOGIN_PATH || '/login',
  dashboard: process.env.E2E_ADMIN_DASHBOARD_PATH || '/admin',
  users: process.env.E2E_ADMIN_USERS_PATH || '/admin/users',
  applications:
    process.env.E2E_ADMIN_APPLICATIONS_PATH || '/admin/applications',
});
const TIMEOUTS = Object.freeze({
  navigation: 15000,
  action: 10000,
});
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
    (value) => typeof value === 'string' && value.trim().length > 0
  );
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function routePattern(route) {
  return new RegExp(
    `${escapeRegExp(route)}(?:[/?#]|$)`
  );
}
function currentPathname(page) {
  return new URL(page.url()).pathname.replace(/\/+$/, '') || '/';
}
function isLoginPath(page) {
  return currentPathname(page) === ROUTES.login.replace(/\/+$/, '') ||
    currentPathname(page).startsWith(
      `${ROUTES.login.replace(/\/+$/, '')}/`
    );
}
function isAccessDeniedUrl(page) {
  return /forbidden|unauthorized|access-denied|not-authorized/i.test(
    page.url()
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
    `No visible element found for selectors: ${selectors.join(', ')}`
  );
}
async function assertNoServerError(page) {
  await expect(page.locator('body')).not.toContainText(
    /internal server error|uncaught exception|application error/i
  );
}
async function login(page, email, password) {
  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
  });
  const emailInput = await firstVisibleLocator(
    page,
    SELECTORS.email
  );
  const passwordInput = await firstVisibleLocator(
    page,
    SELECTORS.password
  );
  await emailInput.fill(email);
  await passwordInput.fill(password);
  const submitButton = await firstVisibleLocator(
    page,
    SELECTORS.loginButton
  );
  await submitButton.click();
  // Leaving the login route alone is not proof of successful
  // authentication. The caller must verify protected access.
  await expect
    .poll(
      async () => !isLoginPath(page),
      { timeout: TIMEOUTS.navigation }
    )
    .toBeTruthy();
}
async function assertAccessDenied(page) {
  const deniedMessage = page.getByText(
    /access denied|not authorized|forbidden|permission denied|please log in|sign in to continue/i
  ).first();
  await expect
    .poll(
      async () => {
        if (isLoginPath(page) || isAccessDeniedUrl(page)) {
          return true;
        }
        return deniedMessage.isVisible().catch(() => false);
      },
      { timeout: TIMEOUTS.navigation }
    )
    .toBeTruthy();
}
async function visitProtectedRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'domcontentloaded',
  });
  return {
    response,
    pathname: currentPathname(page),
  };
}
test.describe('MedOrbits admin workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 900,
    });
  });
  test('login page provides credential inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.login}`, {
      waitUntil: 'domcontentloaded',
    });
    const emailInput = await firstVisibleLocator(
      page,
      SELECTORS.email
    );
    const passwordInput = await firstVisibleLocator(
      page,
      SELECTORS.password
    );
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(emailInput).toHaveAttribute(
      'type',
      /^(email|text)$/i
    );
    await expect(passwordInput).toHaveAttribute(
      'type',
      'password'
    );
  });
  test('unauthenticated visitors cannot access the admin dashboard', async ({
    page,
  }) => {
    const { response } = await visitProtectedRoute(
      page,
      ROUTES.dashboard
    );
    const redirectedToLogin = isLoginPath(page);
    const deniedByUrl = isAccessDeniedUrl(page);
    const deniedByStatus = [401, 403].includes(
      response?.status()
    );
    const deniedMessage = page.getByText(
      /access denied|not authorized|forbidden|permission denied|please log in|sign in to continue/i
    ).first();
    const deniedByMessage = await deniedMessage
      .isVisible()
      .catch(() => false);
    expect(
      redirectedToLogin ||
      deniedByUrl ||
      deniedByStatus ||
      deniedByMessage,
      `Expected unauthenticated access to be denied. URL: ${page.url()}`
    ).toBeTruthy();
  });
  test('admin can sign in and access the dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.'
    );
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const { response, pathname } = await visitProtectedRoute(
      page,
      ROUTES.dashboard
    );
    expect(
      response?.status(),
      'Admin dashboard request should not return an HTTP error.'
    ).toBeLessThan(500);
    expect(
      pathname,
      'Expected the admin dashboard route to remain accessible.'
    ).toMatch(routePattern(ROUTES.dashboard));
    await assertNoServerError(page);
    await expect(page.locator('body')).toBeVisible();
  });
  test('admin can access user management', async ({ page }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.'
    );
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const { response, pathname } = await visitProtectedRoute(
      page,
      ROUTES.users
    );
    expect(response?.status()).toBeLessThan(500);
    expect(pathname).toMatch(routePattern(ROUTES.users));
    await assertNoServerError(page);
    await expect(page.locator('body')).toBeVisible();
  });
  test('admin can access application review', async ({ page }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.'
    );
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const { response, pathname } = await visitProtectedRoute(
      page,
      ROUTES.applications
    );
    expect(response?.status()).toBeLessThan(500);
    expect(pathname).toMatch(routePattern(ROUTES.applications));
    await assertNoServerError(page);
    await expect(page.locator('body')).toBeVisible();
  });
  test('ordinary user cannot access the admin dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.dashboard}`, {
      waitUntil: 'domcontentloaded',
    });
    await assertAccessDenied(page);
  });
  test('ordinary user cannot access admin user management', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.users}`, {
      waitUntil: 'domcontentloaded',
    });
    await assertAccessDenied(page);
  });
  test('ordinary user cannot access application administration', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(USER_EMAIL, USER_PASSWORD),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.'
    );
    await login(page, USER_EMAIL, USER_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.applications}`, {
      waitUntil: 'domcontentloaded',
    });
    await assertAccessDenied(page);
  });
  test('logout prevents subsequent access to the admin dashboard', async ({
    page,
  }) => {
    test.skip(
      !hasCredentials(ADMIN_EMAIL, ADMIN_PASSWORD),
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.'
    );
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`${BASE_URL}${ROUTES.dashboard}`, {
      waitUntil: 'domcontentloaded',
    });
    const logoutButton = await firstVisibleLocator(
      page,
      SELECTORS.logoutButton
    );
    await logoutButton.click();
    await expect
      .poll(
        async () => {
          const signedOutMessage = page.getByText(
            /you have been logged out|signed out successfully|logged out successfully/i
          ).first();
          if (isLoginPath(page) || /login|logout|signed-out/i.test(
            currentPathname(page)
          )) {
            return true;
          }
          if (isAccessDeniedUrl(page)) {
            return true;
          }
          return signedOutMessage.isVisible().catch(() => false);
        },
        { timeout: TIMEOUTS.navigation }
      )
      .toBeTruthy();
    await page.goto(`${BASE_URL}${ROUTES.dashboard}`, {
      waitUntil: 'domcontentloaded',
    });
    await assertAccessDenied(page);
  });
  test('invalid credentials do not grant access to the admin dashboard', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.login}`, {
      waitUntil: 'domcontentloaded',
    });
    const emailInput = await firstVisibleLocator(
      page,
      SELECTORS.email
    );
    const passwordInput = await firstVisibleLocator(
      page,
      SELECTORS.password
    );
    await emailInput.fill('invalid.admin@example.test');
    await passwordInput.fill('Invalid-Test-Password-Not-Real-123!');
    const submitButton = await firstVisibleLocator(
      page,
      SELECTORS.loginButton
    );
    await submitButton.click();
    const errorMessage = page.getByText(
      /invalid credentials|incorrect password|login failed|unable to sign in|invalid email or password/i
    ).first();
    await expect
      .poll(
        async () => {
          if (isLoginPath(page)) {
            return true;
          }
          return errorMessage.isVisible().catch(() => false);
        },
        { timeout: TIMEOUTS.action }
      )
      .toBeTruthy();
    await page.goto(`${BASE_URL}${ROUTES.dashboard}`, {
      waitUntil: 'domcontentloaded',
    });
    await assertAccessDenied(page);
  });
});