'use strict';
/**
 * MedOrbits -- Application Submission E2E Tests
 *
 * File: tests/e2e/application-submission.e2e.test.js
 * Framework: Playwright Test
 *
 * Run:
 *   npx playwright test tests/e2e/application-submission.e2e.test.js
 *
 * Environment:
 *   E2E_BASE_URL
 *   E2E_LOGIN_PATH
 *   E2E_APPLICATION_PATH
 *   E2E_APPLICATIONS_PATH
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional selector overrides:
 *   E2E_APPLICATION_FORM_SELECTOR
 *   E2E_APPLICATION_SUBMIT_SELECTOR
 *   E2E_APPLICATION_SUCCESS_TEXT
 *
 * Security:
 * - Use a dedicated test environment and synthetic test accounts.
 * - Never submit real applicant or medical information.
 * - Never run submission tests against production.
 * - Do not hard-code credentials or authentication tokens.
 *
 * IMPORTANT:
 * Configure the route and selector values to match the actual
 * MedOrbits application before enabling these tests in CI.
 */
const { test, expect } = require('@playwright/test');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const ROUTES = Object.freeze({
  login: process.env.E2E_LOGIN_PATH || '/login',
  application: process.env.E2E_APPLICATION_PATH || '/apply',
  applications: process.env.E2E_APPLICATIONS_PATH || '/applications',
});
const SELECTORS = Object.freeze({
  form: process.env.E2E_APPLICATION_FORM_SELECTOR || 'form',
  submit: process.env.E2E_APPLICATION_SUBMIT_SELECTOR ||
    'button[type="submit"]',
  successText: process.env.E2E_APPLICATION_SUCCESS_TEXT ||
    'application submitted successfully',
  email: [
    'input[name="email"]',
    'input[type="email"]',
    '#email',
  ],
  fullName: [
    'input[name="fullName"]',
    'input[name="name"]',
    '#fullName',
  ],
  phone: [
    'input[name="phone"]',
    'input[type="tel"]',
    '#phone',
  ],
});
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const TIMEOUT = 15000;
function hasUserCredentials() {
  return Boolean(
    USER_EMAIL?.trim() && USER_PASSWORD?.trim()
  );
}
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}@example.test`;
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
async function loginAsTestUser(page) {
  if (!hasUserCredentials()) {
    throw new Error(
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated tests.'
    );
  }
  await page.goto(`${BASE_URL}${ROUTES.login}`);
  const email = await firstVisibleLocator(page, SELECTORS.email);
  const password = await firstVisibleLocator(page, [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
  ]);
  await email.fill(USER_EMAIL);
  await password.fill(USER_PASSWORD);
  const submit = await firstVisibleLocator(page, [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
  ]);
  await submit.click();
  await expect
    .poll(
      async () => {
        return !new URL(page.url()).pathname
          .replace(/\/+$/, '')
          .endsWith('/login');
      },
      { timeout: TIMEOUT }
    )
    .toBeTruthy();
}
async function fillIfPresent(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
}
async function assertNoServerError(page) {
  await expect(page.locator('body')).not.toContainText(
    /internal server error|uncaught exception|application error/i
  );
}
test.describe('MedOrbits application submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 900,
    });
  });
  test('application page loads successfully', async ({ page }) => {
    const response = await page.goto(
      `${BASE_URL}${ROUTES.application}`
    );
    expect(
      response,
      'Application route should return a document response.'
    ).not.toBeNull();
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await assertNoServerError(page);
  });
  test('application form contains a submit control', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`);
    const form = page.locator(SELECTORS.form).first();
    await expect(form).toBeVisible();
    const submit = form.locator(SELECTORS.submit).first();
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });
  test('required fields prevent an empty submission', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`);
    const form = page.locator(SELECTORS.form).first();
    await expect(form).toBeVisible();
    const requiredFields = form.locator(
      'input[required], select[required], textarea[required]'
    );
    const requiredCount = await requiredFields.count();
    test.skip(
      requiredCount === 0,
      'No native required fields found. Configure this test for the application validation rules.'
    );
    const submit = form.locator(SELECTORS.submit).first();
    await submit.click();
    // HTML native validation normally keeps the form on the same page.
    // Applications using custom validation should configure an appropriate
    // validation-message assertion for their actual UI.
    await expect(page).toHaveURL(
      new RegExp(
        `${ROUTES.application.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`
      )
    );
    await expect(requiredFields.first()).toBeVisible();
  });
  test('invalid email is rejected when an email field exists', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`);
    const emailField = page.locator(
      'input[type="email"], input[name="email"]'
    ).first();
    test.skip(
      !(await emailField.isVisible().catch(() => false)),
      'No visible email field found on the application form.'
    );
    await emailField.fill('invalid-email-format');
    const validity = await emailField.evaluate((element) => {
      return element.validity.valid;
    });
    expect(validity).toBe(false);
  });
  test('test user can submit an application', async ({ page }) => {
    test.skip(
      !hasUserCredentials(),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this authenticated test.'
    );
    await loginAsTestUser(page);
    await page.goto(`${BASE_URL}${ROUTES.application}`);
    const form = page.locator(SELECTORS.form).first();
    await expect(form).toBeVisible();
    const email = uniqueEmail();
    // Fill known common fields when present.
    // Configure the form-specific required fields before relying on
    // this test in CI.
    await fillIfPresent(page, SELECTORS.fullName, 'E2E Test Applicant');
    await fillIfPresent(page, SELECTORS.email, email);
    await fillIfPresent(page, SELECTORS.phone, '9000000001');
    const responsePromise = page.waitForResponse(
      (response) => {
        const request = response.request();
        return (
          ['POST', 'PUT'].includes(request.method()) &&
          response.url().startsWith(BASE_URL) &&
          !response.url().includes('/logout')
        );
      },
      { timeout: TIMEOUT }
    ).catch(() => null);
    await form.locator(SELECTORS.submit).first().click();
    const response = await responsePromise;
    if (response) {
      expect(
        response.status(),
        'Application submission must not return a server error.'
      ).toBeLessThan(500);
    }
    const successMessage = page.getByText(
      /application submitted successfully|application received|submitted successfully|application created/i
    ).first();
    const successVisible = await successMessage
      .isVisible()
      .catch(() => false);
    const redirected = !page.url().includes(ROUTES.application);
    expect(
      successVisible || redirected,
      'Expected a submission confirmation or a redirect after submission. ' +
        'If the application uses an API response without a redirect, ' +
        'configure a specific success-message assertion.'
    ).toBeTruthy();
    await assertNoServerError(page);
  });
  test('application submission does not expose server errors', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`);
    await expect(page.locator('body')).not.toContainText(
      /stack trace|sql syntax|database password|access denied for user/i
    );
  });
  test('application records require appropriate access control', async ({
    page,
  }) => {
    // This test assumes the application list is private. If MedOrbits
    // intentionally exposes a public application-tracking page, use its
    // dedicated route and assert its authorization contract instead.
    const response = await page.goto(
      `${BASE_URL}${ROUTES.applications}`
    );
    const pathname = new URL(page.url()).pathname;
    const redirectedToLogin = pathname === ROUTES.login ||
      pathname.startsWith(`${ROUTES.login}/`);
    const statusDenied = [401, 403].includes(response?.status());
    const deniedMessage = page.getByText(
      /access denied|not authorized|forbidden|please log in|sign in to continue/i
    ).first();
    const messageVisible = await deniedMessage
      .isVisible()
      .catch(() => false);
    expect(
      redirectedToLogin || statusDenied || messageVisible,
      `Expected unauthenticated application-list access to be denied. URL: ${page.url()}`
    ).toBeTruthy();
  });
});