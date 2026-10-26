
'use strict';

/**
 * MedOrbits -- Document Upload E2E Tests
 *
 * File: tests/e2e/document-upload.e2e.test.js
 * Framework: Playwright Test
 * Minimum Node.js: 20
 *
 * Run:
 *   npx playwright test tests/e2e/document-upload.e2e.test.js
 *
 * Required configuration:
 *   E2E_BASE_URL
 *
 * Optional configuration:
 *   E2E_DOCUMENT_UPLOAD_PATH=/documents/upload
 *   E2E_LOGIN_PATH=/login
 *   E2E_USER_EMAIL
 *   E2E_USER_PASSWORD
 *   E2E_DOCUMENT_REQUIRES_AUTH=true
 *   E2E_ALLOWED_DOCUMENT_EXTENSIONS=.pdf,.jpg,.jpeg,.png
 *   E2E_MAX_UPLOAD_BYTES=5242880
 *   E2E_ALLOW_REMOTE_TEST_TARGET=true
 *
 * Security:
 * - Run only against a dedicated test environment.
 * - Use synthetic accounts and synthetic files.
 * - Never upload real identity documents or medical records.
 * - Do not run destructive tests against production.
 * - Validate files on the server, regardless of browser validation.
 * - Keep upload storage isolated from real user documents.
 */

const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

const TIMEOUT = 15_000;
const MAX_TEST_FILE_BYTES = 50 * 1024 * 1024;

const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const UPLOAD_PATH = process.env.E2E_DOCUMENT_UPLOAD_PATH
  || '/documents/upload';

const LOGIN_PATH = process.env.E2E_LOGIN_PATH || '/login';

const USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const REQUIRES_AUTH =
  process.env.E2E_DOCUMENT_REQUIRES_AUTH === 'true';

const ALLOWED_EXTENSIONS = (
  process.env.E2E_ALLOWED_DOCUMENT_EXTENSIONS
  || '.pdf,.jpg,.jpeg,.png'
)
  .split(',')
  .map((extension) => extension.trim().toLowerCase())
  .filter(Boolean)
  .map((extension) => (
    extension.startsWith('.') ? extension : `.${extension}`
  ));

const MAX_UPLOAD_BYTES = Number(
  process.env.E2E_MAX_UPLOAD_BYTES || 5 * 1024 * 1024
);

const SELECTORS = Object.freeze({
  fileInput: [
    'input[type="file"][name="document"]',
    'input[type="file"][name="documents"]',
    'input[type="file"][name="file"]',
    'input[type="file"][name="attachment"]',
    'input[type="file"][name="resume"]',
    'input[type="file"]',
  ],

  uploadButton: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Upload document")',
    'button:has-text("Upload Document")',
    'button:has-text("Upload file")',
    'button:has-text("Upload File")',
    'button:has-text("Upload")',
  ],

  success: [
    '[data-testid="upload-success"]',
    '[role="status"]',
    '.upload-success',
  ],

  error: [
    '[data-testid="upload-error"]',
    '[role="alert"]',
    '.upload-error',
    '.error-message',
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

  loginButton: [
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
    throw new Error(
      'E2E_BASE_URL must use HTTP or HTTPS.'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Document upload E2E tests must not run with NODE_ENV=production.'
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
      'Remote E2E targets are disabled. Use a dedicated test server and set ' +
      'E2E_ALLOW_REMOTE_TEST_TARGET=true only after verifying the target.'
    );
  }

  if (
    base.username
    || base.password
    || base.search
    || base.hash
  ) {
    throw new Error(
      'E2E_BASE_URL must not contain credentials, a query string, or a fragment.'
    );
  }

  validatePath(UPLOAD_PATH, 'E2E_DOCUMENT_UPLOAD_PATH');
  validatePath(LOGIN_PATH, 'E2E_LOGIN_PATH');

  if (ALLOWED_EXTENSIONS.some(
    (extension) => !/^\.[a-z0-9][a-z0-9._+-]*$/i.test(extension)
  )) {
    throw new Error(
      'E2E_ALLOWED_DOCUMENT_EXTENSIONS contains an invalid extension.'
    );
  }

  if (
    !Number.isSafeInteger(MAX_UPLOAD_BYTES)
    || MAX_UPLOAD_BYTES <= 0
  ) {
    throw new Error(
      'E2E_MAX_UPLOAD_BYTES must be a positive safe integer.'
    );
  }

  return base;
}

function validatePath(value, name) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
  ) {
    throw new Error(`${name} must be an absolute application path.`);
  }

  let parsed;

  try {
    parsed = new URL(value, BASE_URL);
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

const BASE = validateConfiguration();

function appUrl(path) {
  return new URL(validatePath(path, 'application path'), BASE).toString();
}

function hasCredentials() {
  return Boolean(USER_EMAIL.trim() && USER_PASSWORD.trim());
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

/**
 * File inputs are frequently visually hidden behind custom upload controls.
 * Locate them by attachment rather than visibility.
 */
async function firstAttached(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.count().catch(() => 0)) {
      if (await locator.isAttached().catch(() => false)) {
        return locator;
      }
    }
  }

  return null;
}

async function requiredVisible(page, selectors, description) {
  const locator = await firstVisible(page, selectors);

  if (!locator) {
    throw new Error(
      `Could not locate ${description}. Update the selectors in ` +
      'tests/e2e/document-upload.e2e.test.js to match the application.'
    );
  }

  return locator;
}

async function requiredAttached(page, selectors, description) {
  const locator = await firstAttached(page, selectors);

  if (!locator) {
    throw new Error(
      `Could not locate ${description}. Update the selectors in ` +
      'tests/e2e/document-upload.e2e.test.js to match the application.'
    );
  }

  return locator;
}

function createSyntheticPdf() {
  // Minimal synthetic PDF. Contains no personal or real document data.
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n' +
    '<< /Type /Catalog /Pages 2 0 R >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    '<< /Type /Pages /Kids [] /Count 0 >>\n' +
    'endobj\n' +
    'trailer\n' +
    '<< /Root 1 0 R >>\n' +
    '%%EOF\n',
    'utf8'
  );
}

function createSyntheticPng() {
  // Synthetic 1 × 1 PNG.
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64'
  );
}

function createSyntheticFile(extension) {
  const normalized = extension.toLowerCase();

  if (normalized === '.pdf') {
    return {
      name: `synthetic-${randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      buffer: createSyntheticPdf(),
    };
  }

  if (normalized === '.png') {
    return {
      name: `synthetic-${randomUUID()}.png`,
      mimeType: 'image/png',
      buffer: createSyntheticPng(),
    };
  }

  if (normalized === '.jpg' || normalized === '.jpeg') {
    // Deliberately synthetic bytes. These are not real image data.
    // Use a genuine generated JPEG fixture if server-side decoding is tested.
    return {
      name: `synthetic-${randomUUID()}${normalized}`,
      mimeType: 'image/jpeg',
      buffer: Buffer.from('synthetic image test fixture', 'utf8'),
    };
  }

  return {
    name: `synthetic-${randomUUID()}${normalized}`,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('synthetic document test fixture', 'utf8'),
  };
}

async function login(page) {
  if (!hasCredentials()) {
    throw new Error(
      'Authenticated upload tests require E2E_USER_EMAIL and ' +
      'E2E_USER_PASSWORD.'
    );
  }

  await page.goto(appUrl(LOGIN_PATH), {
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
    SELECTORS.loginButton,
    'login submit button'
  );

  await submit.click();

  const loginPathname = new URL(appUrl(LOGIN_PATH)).pathname;

  await expect
    .poll(
      () => new URL(page.url()).pathname,
      { timeout: TIMEOUT }
    )
    .not.toBe(loginPathname);

  await expect(page.locator('body')).toBeVisible();
}

async function openUploadPage(page) {
  if (REQUIRES_AUTH) {
    test.skip(
      !hasCredentials(),
      'Authenticated upload tests require E2E_USER_EMAIL and E2E_USER_PASSWORD.'
    );

    await login(page);
  }

  await page.goto(appUrl(UPLOAD_PATH), {
    waitUntil: 'domcontentloaded',
  });

  if (REQUIRES_AUTH) {
    const loginPathname = new URL(appUrl(LOGIN_PATH)).pathname;

    if (new URL(page.url()).pathname === loginPathname) {
      await login(page);
      await page.goto(appUrl(UPLOAD_PATH), {
        waitUntil: 'domcontentloaded',
      });
    }

    expect(
      new URL(page.url()).pathname,
      'An authenticated user should be able to reach the upload page.'
    ).not.toBe(loginPathname);
  }

  await expect(page.locator('body')).toBeVisible();
}

async function selectFile(page, file) {
  const fileInput = await requiredAttached(
    page,
    SELECTORS.fileInput,
    'document file input'
  );

  await fileInput.setInputFiles(file);

  return fileInput;
}

async function submitUpload(page) {
  const button = await requiredVisible(
    page,
    SELECTORS.uploadButton,
    'document upload button'
  );

  await button.click();

  return button;
}

async function findFeedback(page) {
  const successText = page.getByText(
    /upload successful|document uploaded|file uploaded|uploaded successfully/i
  ).first();

  if (await successText.isVisible().catch(() => false)) {
    return 'success';
  }

  const errorText = page.getByText(
    /upload failed|unsupported file|invalid file|file too large|upload error|file type not allowed|select a file|choose a file|not allowed|maximum file size/i
  ).first();

  if (await errorText.isVisible().catch(() => false)) {
    return 'error';
  }

  const successSelector = await firstVisible(
    page,
    SELECTORS.success
  );

  if (successSelector) {
    const text = (await successSelector.textContent()) || '';

    if (text.trim()) {
      return 'success';
    }
  }

  const errorSelector = await firstVisible(
    page,
    SELECTORS.error
  );

  if (errorSelector) {
    const text = (await errorSelector.textContent()) || '';

    if (text.trim()) {
      return 'error';
    }
  }

  return 'pending';
}

async function expectFeedback(page) {
  await expect
    .poll(
      () => findFeedback(page),
      { timeout: TIMEOUT }
    )
    .not.toBe('pending');
}

async function assertNoSensitiveError(page) {
  await expect(page.locator('body')).not.toContainText(
    /stack trace|database connection string|sqlstate|password hash|secret key|node_modules\/.*\.js|internal server error at .*\.js:\d+/i
  );
}

async function assertPageHasNoServerError(page, response) {
  expect(response, 'The navigation should return an HTTP response.').not.toBeNull();
  expect(
    response.status(),
    'The page should not return an HTTP client or server error.'
  ).toBeLessThan(400);

  await expect(page.locator('body')).toBeVisible();
  await assertNoSensitiveError(page);
}

test.describe('MedOrbits document upload', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(TIMEOUT);

    await page.setViewportSize({
      width: 1365,
      height: 900,
    });
  });

  test('upload page loads without an HTTP error', async ({ page }) => {
    const response = await page.goto(appUrl(UPLOAD_PATH), {
      waitUntil: 'domcontentloaded',
    });

    await assertPageHasNoServerError(page, response);
  });

  test('upload form exposes a file input', async ({ page }) => {
    await openUploadPage(page);

    const fileInput = await requiredAttached(
      page,
      SELECTORS.fileInput,
      'document file input'
    );

    await expect(fileInput).toBeAttached();
  });

  test('file input advertises configured extensions when accept is present', async ({
    page,
  }) => {
    await openUploadPage(page);

    const fileInput = await requiredAttached(
      page,
      SELECTORS.fileInput,
      'document file input'
    );

    const accept = await fileInput.getAttribute('accept');

    test.skip(
      !accept,
      'No accept attribute is configured. Verify file restrictions with server-side tests.'
    );

    const advertised = accept
      .split(',')
      .map((item) => item.trim().toLowerCase());

    const mimeByExtension = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    for (const extension of ALLOWED_EXTENSIONS) {
      const mime = mimeByExtension[extension];

      const included = advertised.some((item) => (
        item === extension
        || item === '*/*'
        || (mime && item === mime)
        || item.endsWith(extension)
      ));

      expect(
        included,
        `The input accept="${accept}" should advertise ${extension}.`
      ).toBeTruthy();
    }
  });

  test('user can select a synthetic PDF', async ({ page }) => {
    test.skip(
      !ALLOWED_EXTENSIONS.includes('.pdf'),
      'PDF is not listed in E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );

    await openUploadPage(page);

    const file = createSyntheticFile('.pdf');
    const fileInput = await selectFile(page, file);

    const selectedFiles = await fileInput.evaluate((element) => (
      Array.from(element.files || []).map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
      }))
    ));

    expect(selectedFiles).toHaveLength(1);
    expect(selectedFiles[0].name).toBe(file.name);
    expect(selectedFiles[0].type).toBe('application/pdf');
    expect(selectedFiles[0].size).toBeGreaterThan(0);
  });

  test('user can select a synthetic PNG', async ({ page }) => {
    test.skip(
      !ALLOWED_EXTENSIONS.includes('.png'),
      'PNG is not listed in E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );

    await openUploadPage(page);

    const file = createSyntheticFile('.png');
    const fileInput = await selectFile(page, file);

    const selectedFile = await fileInput.evaluate((element) => {
      const item = element.files?.[0];

      return item
        ? {
            name: item.name,
            type: item.type,
            size: item.size,
          }
        : null;
    });

    expect(selectedFile).not.toBeNull();
    expect(selectedFile.name).toBe(file.name);
    expect(selectedFile.type).toBe('image/png');
    expect(selectedFile.size).toBeGreaterThan(0);
  });

  test('empty upload is rejected by validation', async ({ page }) => {
    await openUploadPage(page);

    const fileInput = await requiredAttached(
      page,
      SELECTORS.fileInput,
      'document file input'
    );

    const button = await submitUpload(page);

    const required = await fileInput.evaluate(
      (element) => element.required
    );

    const invalid = await fileInput.evaluate(
      (element) => !element.checkValidity()
    );

    if (required && invalid) {
      await expect(button).toBeVisible();
      return;
    }

    const feedback = await expect
      .poll(
        () => findFeedback(page),
        { timeout: TIMEOUT }
      )
      .catch(() => 'pending');

    expect(
      feedback,
      'An empty upload must be blocked by required-field validation or rejected with an error.'
    ).toBe('error');

    await expect(button).toBeVisible();
  });

  test('oversized file is rejected when a size limit is configured', async ({
    page,
  }) => {
    test.skip(
      MAX_UPLOAD_BYTES >= MAX_TEST_FILE_BYTES,
      'The configured limit is too large for a safe in-memory E2E fixture. Use an API integration test for larger limits.'
    );

    await openUploadPage(page);

    const fileInput = await selectFile(page, {
      name: `oversized-${randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x41),
    });

    await submitUpload(page);

    const feedback = await expect
      .poll(
        () => findFeedback(page),
        { timeout: TIMEOUT }
      )
      .catch(() => 'pending');

    if (feedback === 'error') {
      return;
    }

    const declaredLimit = await fileInput.getAttribute('data-max-size');

    if (feedback === 'success') {
      throw new Error(
        'The interface reported success for a file larger than E2E_MAX_UPLOAD_BYTES. Verify server-side size enforcement.'
      );
    }

    test.skip(
      !declaredLimit,
      'No size rejection or data-max-size limit was found. Verify oversized-file rejection in an API integration test.'
    );

    expect(
      Number(declaredLimit),
      'data-max-size should be a positive numeric byte limit.'
    ).toBeGreaterThan(0);

    expect(
      MAX_UPLOAD_BYTES + 1
    ).toBeGreaterThan(Number(declaredLimit));

    throw new Error(
      'The file was not visibly rejected even though a client-side size limit was declared.'
    );
  });

  test('unsupported extension is rejected when server or UI validation is available', async ({
    page,
  }) => {
    test.skip(
      ALLOWED_EXTENSIONS.length === 0,
      'Configure E2E_ALLOWED_DOCUMENT_EXTENSIONS.'
    );

    test.skip(
      ALLOWED_EXTENSIONS.includes('.exe'),
      'The configured extension list includes .exe; choose an appropriate server-side security test instead.'
    );

    await openUploadPage(page);

    const fileInput = await selectFile(page, {
      name: `synthetic-${randomUUID()}.exe`,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('synthetic harmless test fixture', 'utf8'),
    });

    const accept = await fileInput.getAttribute('accept');

    await submitUpload(page);

    const feedback = await expect
      .poll(
        () => findFeedback(page),
        { timeout: TIMEOUT }
      )
      .catch(() => 'pending');

    if (feedback === 'error') {
      return;
    }

    if (feedback === 'success') {
      throw new Error(
        'The interface reported success for an unsupported .exe upload. Verify server-side extension, MIME type, and file-content validation.'
      );
    }

    test.skip(
      !accept,
      'No client-side accept attribute or rejection message was found. Verify server-side rejection with an API integration test.'
    );

    expect(
      accept.toLowerCase(),
      'The input should not advertise .exe as an allowed file type.'
    ).not.toContain('.exe');

    throw new Error(
      'The .exe fixture was not visibly rejected. The accept attribute alone does not enforce server-side validation.'
    );
  });

  test('upload feedback does not expose internal server details', async ({
    page,
  }) => {
    await openUploadPage(page);

    await selectFile(page, createSyntheticFile('.pdf'));
    await submitUpload(page);

    await expectFeedback(page);
    await assertNoSensitiveError(page);
  });

  test('repeated upload clicks do not crash the interface', async ({
    page,
  }) => {
    await openUploadPage(page);

    await selectFile(page, createSyntheticFile('.pdf'));

    const button = await requiredVisible(
      page,
      SELECTORS.uploadButton,
      'document upload button'
    );

    await button.click();

    if (
      await button.isVisible().catch(() => false)
      && !(await button.isDisabled().catch(() => false))
    ) {
      await button.click().catch(() => {});
    }

    await expect(page.locator('body')).not.toContainText(
      /uncaught exception|application crashed|fatal application error/i
    );

    await assertNoSensitiveError(page);
  });

  test('upload page does not expose raw document storage paths', async ({
    page,
  }) => {
    await openUploadPage(page);

    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toMatch(
      /\/var\/www\/|\/home\/[^ ]+\/uploads|file:\/\/\/|[A-Za-z]:\\Users\\/i
    );
  });
});
