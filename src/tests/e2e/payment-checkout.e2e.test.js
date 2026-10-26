
'use strict';

/**
 * MedOrbits -- Payment Checkout E2E Tests
 *
 * File: tests/e2e/payment-checkout.e2e.test.js
 * Framework: Playwright Test
 * Minimum Node.js: 20
 *
 * Run:
 *   npx playwright test tests/e2e/payment-checkout.e2e.test.js
 *
 * Environment:
 *   E2E_BASE_URL
 *   E2E_CHECKOUT_PATH
 *   E2E_LOGIN_PATH
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *
 * Optional:
 *   E2E_CHECKOUT_REQUIRES_AUTH=true
 *   E2E_PAYMENT_MODE=mock
 *   E2E_ALLOW_REMOTE_TEST_TARGET=true
 *
 * Safety:
 * - Payment submission is not performed by these tests.
 * - Use a dedicated test environment and synthetic accounts.
 * - Never use live payment credentials or real card details.
 * - Do not treat a redirect or browser message as proof of settlement.
 * - Verify amount, currency, ownership, and final status server-side.
 */

const { test, expect } = require('@playwright/test');

const TIMEOUT = 15_000;

const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const ROUTES = Object.freeze({
  checkout: process.env.E2E_CHECKOUT_PATH || '/checkout',
  login: process.env.E2E_LOGIN_PATH || '/login',
});

const USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const REQUIRES_AUTH =
  process.env.E2E_CHECKOUT_REQUIRES_AUTH === 'true';

const PAYMENT_MODE = (
  process.env.E2E_PAYMENT_MODE || 'mock'
).trim().toLowerCase();

const SELECTORS = Object.freeze({
  checkoutForm: [
    'form[data-testid="checkout-form"]',
    'form#checkout-form',
    'form[name="checkout"]',
    'form',
  ],

  amount: [
    '[data-testid="checkout-amount"]',
    '[data-testid="payment-amount"]',
    '[name="amount"]',
    '#amount',
    '.checkout-amount',
  ],

  currency: [
    '[data-testid="checkout-currency"]',
    '[data-testid="payment-currency"]',
    '[name="currency"]',
    '#currency',
    '.checkout-currency',
  ],

  submit: [
    'button[data-testid="pay-button"]',
    'button[type="submit"]',
    'button:has-text("Pay now")',
    'button:has-text("Pay Now")',
    'button:has-text("Proceed to payment")',
    'button:has-text("Continue to payment")',
  ],

  success: [
    '[data-testid="payment-success"]',
    '.payment-success',
  ],

  failure: [
    '[data-testid="payment-error"]',
    '.payment-error',
  ],

  cancel: [
    '[data-testid="cancel-payment"]',
    'a:has-text("Cancel")',
    'button:has-text("Cancel payment")',
    'button:has-text("Cancel Payment")',
  ],

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

  loginSubmit: [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
  ],
});

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    throw new Error(
      'E2E_BASE_URL must be a valid absolute HTTP or HTTPS URL.'
    );
  }

  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('E2E_BASE_URL must use HTTP or HTTPS.');
  }

  if (base.username || base.password || base.search || base.hash) {
    throw new Error(
      'E2E_BASE_URL must not contain credentials, a query string, or a fragment.'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Payment checkout E2E tests must not run with NODE_ENV=production.'
    );
  }

  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ]);

  if (
    !localHosts.has(base.hostname.toLowerCase())
    && process.env.E2E_ALLOW_REMOTE_TEST_TARGET !== 'true'
  ) {
    throw new Error(
      'Remote test targets are disabled. Set E2E_ALLOW_REMOTE_TEST_TARGET=true ' +
      'only after verifying that E2E_BASE_URL points to a dedicated test environment.'
    );
  }

  validatePath(ROUTES.checkout, 'E2E_CHECKOUT_PATH');
  validatePath(ROUTES.login, 'E2E_LOGIN_PATH');

  if (!['mock', 'sandbox'].includes(PAYMENT_MODE)) {
    throw new Error(
      'E2E_PAYMENT_MODE must be "mock" or "sandbox". Live payment mode is prohibited.'
    );
  }

  return base;
}

function validatePath(path, name) {
  if (
    typeof path !== 'string'
    || !path.startsWith('/')
    || path.startsWith('//')
    || path.includes('\\')
  ) {
    throw new Error(`${name} must be an absolute application path.`);
  }

  let parsed;

  try {
    parsed = new URL(path, BASE_URL);
  } catch {
    throw new Error(`${name} is not a valid URL path.`);
  }

  if (parsed.origin !== new URL(BASE_URL).origin) {
    throw new Error(`${name} must remain on the configured origin.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain URL credentials.`);
  }

  return parsed.pathname + parsed.search;
}

validateConfiguration();

function appUrl(path) {
  return new URL(
    validatePath(path, 'application path'),
    BASE_URL
  ).toString();
}

function hasCredentials() {
  return Boolean(USER_EMAIL.trim() && USER_PASSWORD.trim());
}

function normalizedPath(path) {
  return path.replace(/\/+$/, '') || '/';
}

function currentPathname(page) {
  return normalizedPath(new URL(page.url()).pathname);
}

function loginPathname() {
  return normalizedPath(new URL(appUrl(ROUTES.login)).pathname);
}

function isLoginPage(page) {
  const current = currentPathname(page);
  const login = loginPathname();

  return current === login || current.startsWith(`${login}/`);
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
      `Could not locate ${description}. Update the selectors in ` +
      'tests/e2e/payment-checkout.e2e.test.js to match the MedOrbits interface.'
    );
  }

  return locator;
}

async function login(page) {
  if (!hasCredentials()) {
    throw new Error(
      'Authenticated checkout tests require E2E_USER_EMAIL and E2E_USER_PASSWORD.'
    );
  }

  await page.goto(appUrl(ROUTES.login), {
    waitUntil: 'domcontentloaded',
  });

  const email = await requiredVisible(
    page,
    SELECTORS.email,
    'login email field'
  );

  const password = await requiredVisible(
    page,
    SELECTORS.password,
    'login password field'
  );

  await email.fill(USER_EMAIL);
  await password.fill(USER_PASSWORD);

  const submit = await requiredVisible(
    page,
    SELECTORS.loginSubmit,
    'login submit button'
  );

  await submit.click();

  await expect
    .poll(
      () => isLoginPage(page),
      { timeout: TIMEOUT }
    )
    .toBe(false);
}

async function openCheckout(page) {
  await page.goto(appUrl(ROUTES.checkout), {
    waitUntil: 'domcontentloaded',
  });

  if (REQUIRES_AUTH && isLoginPage(page)) {
    test.skip(
      !hasCredentials(),
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated checkout tests.'
    );

    await login(page);

    await page.goto(appUrl(ROUTES.checkout), {
      waitUntil: 'domcontentloaded',
    });
  }

  await expect(page.locator('body')).toBeVisible();

  if (REQUIRES_AUTH) {
    expect(
      isLoginPage(page),
      'An authenticated user should be able to reach checkout.'
    ).toBe(false);
  }
}

async function readElementValue(page, selectors) {
  const element = await firstVisible(page, selectors);

  if (!element) {
    return null;
  }

  const tagName = await element.evaluate(
    (node) => node.tagName.toLowerCase()
  );

  if (['input', 'select', 'textarea'].includes(tagName)) {
    const value = await element.inputValue().catch(() => '');

    if (value.trim()) {
      return value.trim();
    }
  }

  const text = await element.textContent();

  return text?.trim() || null;
}

async function readAmount(page) {
  return readElementValue(page, SELECTORS.amount);
}

async function readCurrency(page) {
  return readElementValue(page, SELECTORS.currency);
}

async function assertNoSensitiveError(page) {
  const body = page.locator('body');

  await expect(body).not.toContainText(
    /stack trace|sqlstate|database connection string|password hash|webhook signing secret|private key/i
  );

  const bodyText = await body.innerText();

  expect(bodyText).not.toMatch(
    /\bsk_live_[A-Za-z0-9]+\b|\brk_live_[A-Za-z0-9]+\b/
  );
}

async function assertPageLoaded(page) {
  await expect(page.locator('body')).toBeVisible();

  await expect(page.locator('body')).not.toContainText(
    /internal server error|uncaught exception|application crashed/i
  );

  await assertNoSensitiveError(page);
}

async function assertSafePaymentMode() {
  expect(
    ['mock', 'sandbox'].includes(PAYMENT_MODE),
    'E2E_PAYMENT_MODE must be mock or sandbox; live payment tests are prohibited.'
  ).toBe(true);
}

test.describe('MedOrbits payment checkout', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(TIMEOUT);

    await page.setViewportSize({
      width: 1365,
      height: 900,
    });
  });

  test('checkout page loads without a server or application error', async ({
    page,
  }) => {
    const response = await page.goto(appUrl(ROUTES.checkout), {
      waitUntil: 'domcontentloaded',
    });

    expect(response, 'Checkout navigation should return a response.')
      .not.toBeNull();

    expect(
      response.status(),
      'Checkout should not return an HTTP client or server error.'
    ).toBeLessThan(400);

    await assertPageLoaded(page);
  });

  test('checkout displays a payment amount', async ({ page }) => {
    await openCheckout(page);

    const amount = await readAmount(page);

    expect(
      amount,
      'Checkout should display an amount using a configured selector.'
    ).not.toBeNull();

    expect(amount.trim()).not.toBe('');
  });

  test('checkout amount is parseable and non-negative', async ({ page }) => {
    await openCheckout(page);

    const amountText = await readAmount(page);

    test.skip(
      !amountText,
      'No checkout amount is exposed by the configured selectors.'
    );

    const match = amountText
      .replace(/,/g, '')
      .match(/-?\d+(?:\.\d{1,2})?/);

    expect(
      match,
      `Could not parse a monetary amount from "${amountText}".`
    ).not.toBeNull();

    const amount = Number(match[0]);

    expect(Number.isFinite(amount)).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
  });

  test('checkout displays currency when the UI exposes it', async ({
    page,
  }) => {
    await openCheckout(page);

    const currency = await readCurrency(page);

    test.skip(
      !currency,
      'No currency field or display element is configured.'
    );

    expect(currency.trim()).not.toBe('');
  });

  test('checkout provides a payment action', async ({ page }) => {
    await openCheckout(page);

    const submit = await requiredVisible(
      page,
      SELECTORS.submit,
      'checkout payment button'
    );

    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test('checkout does not expose payment secrets or internal errors', async ({
    page,
  }) => {
    await openCheckout(page);
    await assertNoSensitiveError(page);
  });

  test('checkout form blocks empty required fields', async ({ page }) => {
    await openCheckout(page);

    const form = await firstVisible(page, SELECTORS.checkoutForm);

    test.skip(
      !form,
      'No checkout form is exposed; the payment provider may host checkout.'
    );

    const submit = await firstVisible(page, SELECTORS.submit);

    test.skip(
      !submit,
      'No checkout submit control is available.'
    );

    const requiredInputs = form.locator(
      'input[required], select[required], textarea[required]'
    );

    const count = await requiredInputs.count();

    test.skip(
      count === 0,
      'The form has no native required fields. Add assertions for the application-specific validation.'
    );

    await submit.click();

    const invalidCount = await requiredInputs.evaluateAll(
      (elements) => elements.filter(
        (element) => !element.checkValidity()
      ).length
    );

    const validationMessage = page.getByText(
      /required field|please enter|please select|complete this field|this field is required/i
    ).first();

    const hasValidationMessage = await validationMessage
      .isVisible()
      .catch(() => false);

    expect(
      invalidCount > 0 || hasValidationMessage,
      'An incomplete checkout should be blocked by validation.'
    ).toBeTruthy();
  });

  test('cancel action does not report a successful payment', async ({
    page,
  }) => {
    await openCheckout(page);

    const cancel = await firstVisible(page, SELECTORS.cancel);

    test.skip(
      !cancel,
      'No cancellation control exists on this checkout screen.'
    );

    await cancel.click();

    await expect
      .poll(
        async () => {
          const success = await firstVisible(page, SELECTORS.success);
          return Boolean(success);
        },
        { timeout: 3000 }
      )
      .toBe(false);

    await assertNoSensitiveError(page);
  });

  test('payment mode is restricted to mock or sandbox', async () => {
    await assertSafePaymentMode();
  });

  test('payment submission remains disabled in this UI-only suite', async ({
    page,
  }) => {
    await assertSafePaymentMode();
    await openCheckout(page);

    const submit = await requiredVisible(
      page,
      SELECTORS.submit,
      'checkout payment button'
    );

    await expect(submit).toBeVisible();

    // Deliberately do not click the payment action.
    // Implement a separate payment integration suite that uses a deterministic
    // mock provider or official sandbox and verifies the resulting server-side
    // payment record, amount, currency, ownership, and final status.
    test.skip(
      true,
      'Payment submission requires a configured mock/sandbox integration and server-side payment-status assertions.'
    );
  });

  test('unauthenticated users cannot access a protected checkout', async ({
    page,
  }) => {
    test.skip(
      !REQUIRES_AUTH,
      'Set E2E_CHECKOUT_REQUIRES_AUTH=true if checkout requires authentication.'
    );

    const response = await page.goto(appUrl(ROUTES.checkout), {
      waitUntil: 'domcontentloaded',
    });

    const path = currentPathname(page);
    const login = loginPathname();

    const redirectedToLogin =
      path === login || path.startsWith(`${login}/`);

    const deniedStatus = [401, 403].includes(response?.status());

    const deniedMessage = page.getByText(
      /access denied|not authorized|forbidden|please log in|sign in to continue/i
    ).first();

    const messageVisible = await deniedMessage
      .isVisible()
      .catch(() => false);

    expect(
      redirectedToLogin || deniedStatus || messageVisible,
      `Expected unauthenticated checkout access to be denied. URL: ${page.url()}`
    ).toBeTruthy();
  });
});
