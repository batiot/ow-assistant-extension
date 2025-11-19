import { test, expect } from './utils/test-utils';

/**
 * E2E tests for HttpOnly cookie-based authentication
 * 
 * These tests verify that the extension can:
 * 1. Read HttpOnly cookies using chrome.cookies API
 * 2. Use cookie values as Bearer tokens for authentication
 * 3. Work with cookies marked as HttpOnly, Secure, and SameSite=Strict
 * 
 * ## Test Strategy
 * 
 * The real OpenWebUI backend ONLY accepts tokens via Authorization: Bearer header.
 * The extension reads HttpOnly cookies via chrome.cookies API and sends the value
 * as a Bearer token. The mock server matches this real backend behavior.
 * 
 * @see MockOpenWebUIServer.authTestScenario for available test scenarios
 */
test.describe('HttpOnly Cookie Authentication', () => {
  let mockServerUrl: string;

  test.beforeAll(async () => {
    mockServerUrl = process.env.MOCK_SERVER_URL || '';

    if (!mockServerUrl) {
      throw new Error('Mock server not initialized. Global setup may have failed.');
    }
  });

  test.beforeEach(async ({ context, extensionId }) => {
    // Clear any existing token cookies before each test
    const cookies = await context.cookies();
    const tokenCookies = cookies.filter(c => c.name === 'token');
    for (const cookie of tokenCookies) {
      await context.clearCookies({ name: 'token', domain: cookie.domain });
    }

    // Clear auth state by triggering logout and clearing storage
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // First, trigger logout to reset AuthService state
        chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' }).catch(() => {
          // Ignore errors if not authenticated
        }).finally(() => {
          // Then clear auth token from storage
          chrome.storage.session.remove(['auth_token'], () => {
            chrome.storage.local.remove(['auth_token'], () => {
              resolve();
            });
          });
        });
      });
    });
    await page.close();
  });


  test('should detect session using HttpOnly cookie as Bearer token', async ({ context, extensionId }) => {
    // First, navigate to the mock server to establish the domain
    const page = await context.newPage();
    await page.goto(`${mockServerUrl}/health`);
    await page.close();

    // Now add the HttpOnly cookie (simulating backend login)
    // IMPORTANT: Set cookie AFTER visiting the domain
    await context.addCookies([{
      name: 'token',
      value: 'test-httponly-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Strict',
    }]);

    // Force auth re-check by calling AUTH_LOGIN (which calls checkSessionAuth())
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Trigger login - extension reads cookie and sends as Bearer token
    await popupPage.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });

    // Wait for authentication to complete
    await popupPage.waitForTimeout(1000);

    // Reload popup to see authenticated state
    await popupPage.reload();
    await popupPage.waitForTimeout(500);

    // Verify the popup shows authenticated state
    const userEmail = await popupPage.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');

    await popupPage.close();
  });

  test('should extract token from HttpOnly cookie and use as Bearer token', async ({ context, extensionId }) => {
    // First, navigate to the mock server to establish the domain
    const setupPage = await context.newPage();
    await setupPage.goto(`${mockServerUrl}/health`);
    await setupPage.close();

    // Simulate OAuth callback by setting the cookie AFTER visiting domain
    // Extension reads via chrome.cookies.get() and sends as Bearer token
    await context.addCookies([{
      name: 'token',
      value: 'test-oauth-callback-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Lax',
      // Set expiration 1 hour from now
      expires: Math.floor(Date.now() / 1000) + 3600,
    }]);

    // Trigger the extension to read and validate the cookie
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Trigger login - extension reads cookie and sends as Bearer token
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });

    await page.waitForTimeout(1000);

    // Reload to see authenticated state
    await page.reload();

    // Wait for the user email element to appear (indicates auth completed)
    await page.waitForSelector('[data-testid="user-email"]', { timeout: 5000 });

    // Verify authentication succeeded
    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');

    await page.close();
  });

  test('should handle missing token cookie gracefully', async ({ context, extensionId }) => {
    // beforeEach already cleared cookies and tokens

    // Open popup - should show unauthenticated state
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Wait for the login button to appear (indicates unauthenticated state)
    await page.waitForSelector('[data-testid="login-button"]', { timeout: 5000 });

    // Verify unauthenticated state
    const loginButton = await page.$('[data-testid="login-button"]');
    expect(loginButton).not.toBeNull();

    await page.close();
  });

  test('should read HttpOnly cookies via chrome.cookies API despite security flags', async ({ context, extensionId }) => {
    // First, navigate to the mock server to establish the domain
    const setupPage = await context.newPage();
    await setupPage.goto(`${mockServerUrl}/health`);
    await setupPage.close();

    // Set cookie with all security flags (HttpOnly + SameSite=Strict)
    // chrome.cookies API can read these despite the security flags
    await context.addCookies([{
      name: 'token',
      value: 'test-secure-strict-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Strict',
    }]);

    // Open popup and verify authentication
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Trigger login - chrome.cookies.get() reads cookie despite HttpOnly flag
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });

    await page.waitForTimeout(1000);

    // Reload to see authenticated state
    await page.reload();

    // Wait for the user email element to appear (indicates auth completed)
    await page.waitForSelector('[data-testid="user-email"]', { timeout: 5000 });

    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');

    await page.close();
  });
});
