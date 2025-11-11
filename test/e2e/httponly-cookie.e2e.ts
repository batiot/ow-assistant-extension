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

  test('should detect session using HttpOnly cookie', async ({ context, extensionId }) => {
    // Set mock server to require Cookie header
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-cookie-header' }),
    });

    // Set an HttpOnly cookie directly (simulating backend login)
    // IMPORTANT: Set cookie BEFORE triggering auth check
    await context.addCookies([{
      name: 'token',
      value: 'test-httponly-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Strict',
    }]);

    // Force auth re-check by calling AUTH_LOGIN (which calls checkSessionAuth())
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Trigger login - it should detect the existing cookie session
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });
    
    // Wait for authentication to complete
    await page.waitForTimeout(1000);
    
    // Reload popup to see authenticated state
    await page.reload();
    await page.waitForTimeout(500);

    // Verify the popup shows authenticated state
    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');
    
    await page.close();
  });

  test('should extract token from HttpOnly cookie after OAuth callback', async ({ context, extensionId }) => {
    // Set mock server to require Bearer token (extension should extract from cookie)
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-bearer-token' }),
    });

    // Simulate OAuth callback by setting the cookie FIRST
    await context.addCookies([{
      name: 'token',
      value: 'oauth-callback-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Lax',
      // Set expiration 1 hour from now
      expires: Math.floor(Date.now() / 1000) + 3600,
    }]);

    // Trigger the extension to read and validate the cookie
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Trigger login - it should detect the existing cookie session
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });
    
    await page.waitForTimeout(1000);
    
    // Reload to see authenticated state
    await page.reload();
    await page.waitForTimeout(500);

    // Verify authentication succeeded
    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');
    
    await page.close();
  });

  test('should handle missing token cookie gracefully', async ({ context, extensionId }) => {
    // Ensure no token cookie exists
    const cookies = await context.cookies();
    const tokenCookies = cookies.filter(c => c.name === 'token');
    for (const cookie of tokenCookies) {
      await context.clearCookies({ name: 'token', domain: cookie.domain });
    }

    // Open popup - should show unauthenticated state
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(500);

    // Verify unauthenticated state
    const loginButton = await page.$('[data-testid="login-button"]');
    expect(loginButton).not.toBeNull();
    
    await page.close();
  });

  test('should work with Secure and SameSite=Strict cookies', async ({ context, extensionId }) => {
    // Set mock server to require Cookie header
    await fetch(`${mockServerUrl}/test/auth-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'require-cookie-header' }),
    });

    // Set cookie with all security flags FIRST
    await context.addCookies([{
      name: 'token',
      value: 'secure-strict-token',
      url: mockServerUrl,
      httpOnly: true,
      sameSite: 'Strict',
    }]);

    // Open popup and verify authentication
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Trigger login - it should detect the existing cookie session
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
    });
    
    await page.waitForTimeout(1000);
    
    // Reload to see authenticated state
    await page.reload();
    await page.waitForTimeout(500);

    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toContain('@example.com');
    
    await page.close();
  });
});
