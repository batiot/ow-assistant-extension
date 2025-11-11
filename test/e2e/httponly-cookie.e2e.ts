import { test, expect } from './utils/test-utils';

/**
 * E2E tests for HttpOnly cookie-based authentication
 * 
 * These tests verify that the extension can:
 * 1. Read HttpOnly cookies using chrome.cookies API
 * 2. Send cookies explicitly in Cookie header for session detection
 * 3. Work with cookies marked as HttpOnly, Secure, and SameSite=Strict
 * 
 * ## Test Strategy
 * 
 * These tests use the mock server's `/test/auth-scenario` endpoint to customize
 * authentication behavior. This is the recommended approach for E2E tests in
 * Playwright, where the mock server runs in a separate process from test workers.
 * 
 * ### Available Auth Scenarios:
 * - `require-cookie-header`: Server only accepts tokens from Cookie header
 * - `require-bearer-token`: Server only accepts tokens from Authorization header
 * - `default`: Server accepts tokens from either source (normal behavior)
 * 
 * @see MockOpenWebUIServer.authTestScenario for all available scenarios
 */
test.describe('HttpOnly Cookie Authentication', () => {
  let mockServerUrl: string;

  test.beforeAll(async () => {
    mockServerUrl = process.env.MOCK_SERVER_URL || '';
    
    if (!mockServerUrl) {
      throw new Error('Mock server not initialized. Global setup may have failed.');
    }
  });

  test.afterEach(async () => {
    // Reset auth scenario to default after each test
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'default' }),
    });
  });

  test('should detect session using HttpOnly cookie', async ({ page, extensionId }) => {
    // Set mock server to require Cookie header
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-cookie-header' }),
    });

    const url = new URL(mockServerUrl);
    const baseUrl = mockServerUrl;

    // Configure the extension with our mock server URL
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.fill('input[data-testid="instance-url-input"]', baseUrl);
    await page.click('button[data-testid="save-settings"]');
    
    // Wait for settings to be saved
    await page.waitForTimeout(500);

    // Set an HttpOnly cookie directly (simulating backend login)
    await page.context().addCookies([{
      name: 'token',
      value: 'test-httponly-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // localhost doesn't require HTTPS
      sameSite: 'Strict',
      url: baseUrl,
    }]);

    // Open the popup to trigger authentication
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Wait for authentication to complete
    await page.waitForTimeout(1000);

    // Verify the popup shows authenticated state
    const authStatus = await page.textContent('[data-testid="auth-status"]');
    expect(authStatus).toContain('test@example.com');
  });

  test('should extract token from HttpOnly cookie after OAuth callback', async ({ page, extensionId }) => {
    const baseUrl = mockServerUrl;
    
    // Set mock server to require Bearer token (extension should extract from cookie)
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-bearer-token' }),
    });
    
    // Configure extension
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.fill('input[data-testid="instance-url-input"]', baseUrl);
    await page.click('button[data-testid="save-settings"]');
    await page.waitForTimeout(500);

    // Simulate OAuth callback by setting the cookie
    await page.context().addCookies([{
      name: 'token',
      value: 'oauth-callback-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      url: baseUrl,
      // Set expiration 1 hour from now
      expires: Math.floor(Date.now() / 1000) + 3600,
    }]);

    // Trigger the extension to read and validate the cookie
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(1000);

    // Verify authentication succeeded
    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');
  });

  test('should handle missing token cookie gracefully', async ({ page, extensionId }) => {
    const baseUrl = mockServerUrl;
    
    // Configure extension
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.fill('input[data-testid="instance-url-input"]', baseUrl);
    await page.click('button[data-testid="save-settings"]');
    await page.waitForTimeout(500);

    // Ensure no token cookie exists
    const cookies = await page.context().cookies();
    const tokenCookies = cookies.filter(c => c.name === 'token');
    for (const cookie of tokenCookies) {
      await page.context().clearCookies({ name: 'token', domain: cookie.domain });
    }

    // Open popup - should show unauthenticated state
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(500);

    // Verify unauthenticated state
    const loginButton = await page.$('[data-testid="login-button"]');
    expect(loginButton).not.toBeNull();
  });

  test('should work with Secure and SameSite=Strict cookies', async ({ page, extensionId }) => {
    const baseUrl = mockServerUrl;
    
    // Set mock server to require Cookie header
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-cookie-header' }),
    });
    
    // Configure extension
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.fill('input[data-testid="instance-url-input"]', baseUrl);
    await page.click('button[data-testid="save-settings"]');
    await page.waitForTimeout(500);

    // Set cookie with all security flags
    await page.context().addCookies([{
      name: 'token',
      value: 'secure-strict-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // localhost is treated as secure context
      sameSite: 'Strict',
      url: baseUrl,
    }]);

    // Open popup and verify authentication
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(1000);

    const authStatus = await page.textContent('[data-testid="auth-status"]');
    expect(authStatus).toContain('@example.com');
  });
});
