
'use strict';

/**
 * MedOrbits -- Application Submission E2E Tests
 *
 * File: tests/e2e/application-submission.e2e.test.js
 * Framework: Playwright Test
 * Requires: Node.js >= 20
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
 * Optional:
 *   E2E_APPLICATION_FORM_SELECTOR
 *   E2E_APPLICATION_SUBMIT_SELECTOR
 *   E2E_APPLICATION_SUCCESS_TEXT
 *   E2E_APPLICATION_EMAIL_SELECTOR
 *   E2E_APPLICATION_NAME_SELECTOR
 *   E2E_APPLICATION_PHONE_SELECTOR
 *
 * Security:
 * - Use a dedicated test environment and synthetic test accounts.
 * - Never submit real applicant or medical information.
 * - Never run submission tests against production.
 * - Do not hard-code credentials or authentication tokens.
 */

const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

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
      'E2E_BASE_URL must not contain credentials, query parameters, or a fragment.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.E2E_ALLOW_PRODUCTION === 'true'
  ) {
    throw new Error(
      'Refusing to run application-submission tests in production.',
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
  application: normalizePath(
    process.env.E2E_APPLICATION_PATH || '/apply',
    'E2E_APPLICATION_PATH',
  ),
  applications: normalizePath(
    process.env.E2E_APPLICATIONS_PATH || '/applications',
    'E2E_APPLICATIONS_PATH',
  ),
});

const SELECTORS = Object.freeze({
  form: process.env.E2E_APPLICATION_FORM_SELECTOR || 'form',

  submit:
    process.env.E2E_APPLICATION_SUBMIT_SELECTOR ||
    'button[type="submit"]',

  successText:
    process.env.E2E_APPLICATION_SUCCESS_TEXT ||
    'application submitted successfully',

  email: [
    process.env.E2E_APPLICATION_EMAIL_SELECTOR,
    'input[name="email"]',
    'input[type="email"]',
    '#email',
  ].filter(Boolean),

  fullName: [
    process.env.E2E_APPLICATION_NAME_SELECTOR,
    'input[name="fullName"]',
    'input[name="name"]',
    '#fullName',
  ].filter(Boolean),

  phone: [
    process.env.E2E_APPLICATION_PHONE_SELECTOR,
    'input[name="phone"]',
    'input[type="tel"]',
    '#phone',
  ].filter(Boolean),

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
});

const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;

function hasUserCredentials() {
  return (
    typeof USER_EMAIL === 'string' &&
    USER_EMAIL.trim().length > 0 &&
    typeof USER_PASSWORD === 'string' &&
    USER_PASSWORD.trim().length > 0
  );
}

function uniqueEmail() {
  return `e2e-${randomUUID()}@example.test`;
}

function currentPathname(page) {
  return new URL(page.url()).pathname.replace(/\/+$/, '') || '/';
}

function isLoginPath(page) {
  const pathname = currentPathname(page);

  return (
    pathname === ROUTES.login ||
    pathname.startsWith(`${ROUTES.login}/`)
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePattern(route) {
  return new RegExp(
    `^${escapeRegExp(route)}(?:[/?#]|$)`,
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
    /internal server error|uncaught exception|application error/i,
  );
}

async function loginAsTestUser(page) {
  if (!hasUserCredentials()) {
    throw new Error(
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated tests.',
    );
  }

  await page.goto(`${BASE_URL}${ROUTES.login}`, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  const email = await firstVisibleLocator(
    page,
    SELECTORS.email,
  );

  const password = await firstVisibleLocator(
    page,
    SELECTORS.password,
  );

  await email.fill(USER_EMAIL);
  await password.fill(USER_PASSWORD);

  const submit = await firstVisibleLocator(
    page,
    SELECTORS.loginButton,
  );

  await submit.click();

  // A redirect is only an intermediate signal.
  // Protected access is verified separately by the test.
  await expect
    .poll(
      async () => !isLoginPath(page),
      { timeout: TIMEOUT },
    )
    .toBeTruthy();
}

async function assertAccessDenied(page, response) {
  if ([401, 403].includes(response?.status())) {
    return;
  }

  if (isLoginPath(page)) {
    return;
  }

  const deniedMessage = page.getByText(
    /access denied|not authorized|forbidden|permission denied|please log in|sign in to continue/i,
  ).first();

  await expect(deniedMessage).toBeVisible({
    timeout: TIMEOUT,
  });
}

async function assertPageLoaded(page, response) {
  expect(
    response,
    'Expected the route to return a document response.',
  ).not.toBeNull();

  expect(
    response.status(),
    'Page request must not return a server error.',
  ).toBeLessThan(500);

  await expect(page.locator('body')).toBeVisible();
  await assertNoServerError(page);
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
      `${BASE_URL}${ROUTES.application}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      },
    );

    await assertPageLoaded(page, response);
  });

  test('application form contains a submit control', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const form = page.locator(SELECTORS.form).first();

    await expect(form).toBeVisible();

    const submit = form.locator(SELECTORS.submit).first();

    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test('required fields prevent an empty submission', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const form = page.locator(SELECTORS.form).first();

    await expect(form).toBeVisible();

    const requiredFields = form.locator(
      'input[required], select[required], textarea[required]',
    );

    const requiredCount = await requiredFields.count();

    test.skip(
      requiredCount === 0,
      'No native required fields found. Configure this test for the application validation rules.',
    );

    const submit = form.locator(SELECTORS.submit).first();

    await submit.click();

    // Browser-native validation blocks submission when a required
    // field is invalid. Verify validity directly rather than assuming
    // that the URL cannot change under custom frontend behavior.
    const invalidRequiredCount = await requiredFields.evaluateAll(
      (elements) =>
        elements.filter((element) => !element.validity.valid).length,
    );

    expect(
      invalidRequiredCount,
      'At least one required field should remain invalid.',
    ).toBeGreaterThan(0);

    await expect(form).toBeVisible();
  });

  test('invalid email is rejected when an email field exists', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const emailField = page.locator(
      'input[type="email"], input[name="email"]',
    ).first();

    test.skip(
      !(await emailField.isVisible().catch(() => false)),
      'No visible email field found on the application form.',
    );

    await emailField.fill('invalid-email-format');

    const validity = await emailField.evaluate(
      (element) => element.validity.valid,
    );

    expect(validity).toBe(false);
  });

  test('authenticated test user can submit an application', async ({
    page,
  }) => {
    test.skip(
      !hasUserCredentials(),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this authenticated test.',
    );

    await loginAsTestUser(page);

    // Ensure the test account can access the application route.
    await page.goto(`${BASE_URL}${ROUTES.application}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const form = page.locator(SELECTORS.form).first();

    await expect(form).toBeVisible();

    const email = uniqueEmail();

    // Synthetic data only. Configure additional required fields
    // for the actual MedOrbits application form before CI execution.
    await fillIfPresent(
      page,
      SELECTORS.fullName,
      'E2E Test Applicant',
    );

    await fillIfPresent(page, SELECTORS.email, email);

    await fillIfPresent(
      page,
      SELECTORS.phone,
      '9000000001',
    );

    // Capture submission requests only after the form has been filled.
    // The listener is armed before clicking the submit control.
    const submissionResponsePromise = page.waitForResponse(
      (response) => {
        const request = response.request();
        const method = request.method();

        if (!['POST', 'PUT'].includes(method)) {
          return false;
        }

        const responseUrl = new URL(response.url());

        return (
          responseUrl.origin === BASE_URL &&
          !/\/logout\/?$/i.test(responseUrl.pathname)
        );
      },
      { timeout: TIMEOUT },
    ).catch(() => null);

    await form.locator(SELECTORS.submit).first().click();

    const submissionResponse = await submissionResponsePromise;

    const successMessage = page.getByText(
      new RegExp(escapeRegExp(SELECTORS.successText), 'i'),
    ).first();

    const genericSuccessMessage = page.getByText(
      /application received|submitted successfully|application created/i,
    ).first();

    const successVisible =
      await successMessage.isVisible().catch(() => false) ||
      await genericSuccessMessage.isVisible().catch(() => false);

    if (submissionResponse) {
      expect(
        submissionResponse.status(),
        'Application submission must not return an HTTP error.',
      ).toBeLessThan(400);
    }

    const redirectedAway = !routePattern(ROUTES.application).test(
      currentPathname(page),
    );

    expect(
      Boolean(submissionResponse) && submissionResponse.status() < 400 ||
        successVisible ||
        redirectedAway,
      'Expected a successful submission response, a confirmation message, ' +
        'or a redirect after submission. Verify the actual application API ' +
        'and configure a specific response assertion if necessary.',
    ).toBeTruthy();

    await assertNoServerError(page);
  });

  test('application page does not expose sensitive server errors', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${ROUTES.application}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    await expect(page.locator('body')).not.toContainText(
      /stack trace|sql syntax|database password|access denied for user/i,
    );
  });

  test('unauthenticated visitors cannot access the private application list', async ({
    page,
  }) => {
    const response = await page.goto(
      `${BASE_URL}${ROUTES.applications}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      },
    );

    const deniedByStatus = [401, 403].includes(
      response?.status(),
    );

    const deniedByRedirect = isLoginPath(page);

    if (deniedByStatus || deniedByRedirect) {
      return;
    }

    const deniedMessage = page.getByText(
      /access denied|not authorized|forbidden|permission denied|please log in|sign in to continue/i,
    ).first();

    await expect(deniedMessage).toBeVisible({
      timeout: TIMEOUT,
    });
  });
});
