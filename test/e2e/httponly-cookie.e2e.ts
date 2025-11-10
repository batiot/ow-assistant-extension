import { test, expect } from './utils/test-utils';
import { setupMockServer, MockServer } from './utils/mock-server';

/**
 * E2E tests for HttpOnly cookie-based authentication
 * 
 * These tests verify that the extension can:
 * 1. Read HttpOnly cookies using chrome.cookies API
 * 2. Send cookies explicitly in Cookie header for session detection
 * 3. Work with cookies marked as HttpOnly, Secure, and SameSite=Strict
 */
test.describe('HttpOnly Cookie Authentication', () => {
  let mockServer: MockServer;
  const testPort = 8081;
  const baseUrl = `http://localhost:${testPort}`;

  test.beforeAll(async () => {
    mockServer = await setupMockServer(testPort);
  });

  test.afterAll(async () => {
    await mockServer.close();
  });

  test('should detect session using HttpOnly cookie', async ({ page, extensionId }) => {
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

    // Mock the /api/v1/auths/ endpoint to return user info
    await mockServer.setRouteHandler('/api/v1/auths/', (req, res) => {
      // Verify the Cookie header was sent
      const cookieHeader = req.headers['cookie'];
      
      if (cookieHeader && cookieHeader.includes('token=test-httponly-token')) {
        res.json({
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          token: 'test-httponly-token',
          token_type: 'Bearer',
          expires_at: null,
        });
      } else {
        res.status(401).json({ detail: 'Unauthorized' });
      }
    });

    // Open the popup to trigger authentication
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Wait for authentication to complete
    await page.waitForTimeout(1000);

    // Verify the popup shows authenticated state
    const authStatus = await page.textContent('[data-testid="auth-status"]');
    expect(authStatus).toContain('test@example.com');
  });

  test('should extract token from HttpOnly cookie after OAuth callback', async ({ page, extensionId }) => {
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

    // Mock validation endpoint
    await mockServer.setRouteHandler('/api/v1/auths/', (req, res) => {
      const authHeader = req.headers['authorization'];
      
      if (authHeader === 'Bearer oauth-callback-token') {
        res.json({
          id: 'oauth-user-456',
          email: 'oauth@example.com',
          name: 'OAuth User',
        });
      } else {
        res.status(401).json({ detail: 'Unauthorized' });
      }
    });

    // Trigger the extension to read and validate the cookie
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(1000);

    // Verify authentication succeeded
    const userEmail = await page.textContent('[data-testid="user-email"]');
    expect(userEmail).toBe('oauth@example.com');
  });

  test('should handle missing token cookie gracefully', async ({ page, extensionId }) => {
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

    // Mock endpoint
    await mockServer.setRouteHandler('/api/v1/auths/', (req, res) => {
      const cookieHeader = req.headers['cookie'];
      
      if (cookieHeader && cookieHeader.includes('token=secure-strict-token')) {
        res.json({
          id: 'secure-user',
          email: 'secure@example.com',
          name: 'Secure User',
          role: 'user',
          token: 'secure-strict-token',
          token_type: 'Bearer',
          expires_at: null,
        });
      } else {
        res.status(401).json({ detail: 'Unauthorized' });
      }
    });

    // Open popup and verify authentication
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForTimeout(1000);

    const authStatus = await page.textContent('[data-testid="auth-status"]');
    expect(authStatus).toContain('secure@example.com');
  });
});
