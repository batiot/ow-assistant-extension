/**
 * E2E Authentication Tests
 * 
 * Tests authentication flows with mock OpenWebUI server.
 * 
 * NOTE: These tests are currently skipped because the authentication UI
 * has not been implemented yet. Unskip these tests once authentication
 * functionality is added to the extension.
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { AuthTestHelper } from './utils/auth-helper';

test.describe.skip('Authentication E2E Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    // Get mock server URL from global setup
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    if (!mockServerUrl) {
      throw new Error('Mock server URL not found. Global setup may have failed.');
    }
    console.log(`Using mock server at ${mockServerUrl}`);
  });

  test.beforeEach(async () => {
    // Launch browser with extension
    const pathToExtension = path.resolve('dist');
    const chromeDataDir = path.resolve('test/e2e/tmp/auth-chrome-data');
    
    // Use headless=new for better extension support
    const shouldHeadless = Boolean(process.env.CI) || !process.env.DISPLAY;
    const headlessArgs = shouldHeadless ? ['--headless=new'] : [];
    
    context = await chromium.launchPersistentContext(chromeDataDir, {
      headless: shouldHeadless,
      channel: 'chromium',
      ignoreDefaultArgs: [
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
      ],
      args: [
        ...headlessArgs,
        '--no-sandbox',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Wait for extension service worker to initialize
    const waitForExtensionId = async (timeout = 30000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const sw = context.serviceWorkers().find(w => w.url().startsWith('chrome-extension://'));
        if (sw) {
          const m = sw.url().match(/^chrome-extension:\/\/([^\/]+)/);
          if (m && m[1]) return m[1];
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return undefined;
    };

    const id = await waitForExtensionId();
    if (!id) {
      throw new Error('Failed to get extension ID - service worker did not start');
    }
    extensionId = id;
    console.log(`Extension ID: ${extensionId}`);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  // REQ-001: Login Flow Tests
  test.describe('REQ-001: Login Flow', () => {
    test('SCEN-001-01: Successful OAuth login stores token and shows user profile', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.verifyUnauthenticatedState();
      await helper.clickLogin();

      const token = await helper.waitForCallbackWithCookie(30000);
      expect(token).not.toBeNull();
      expect(token).toContain('eyJ');

      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();
      await helper.verifyAuthenticatedState();

      const storedToken = await helper.getStoredToken();
      expect(storedToken).toBe(token);
    });

    test('SCEN-001-02: OAuth callback with valid code sets cookie and redirects', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.clickLogin();

      const callbackPromise = page.waitForResponse(
        response => response.url().includes('/oauth/microsoft/callback')
      );

      const response = await callbackPromise;
      expect(response.status()).toBe(200);

      const setCookieHeader = response.headers()['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('token=');

      const token = await helper.extractTokenFromCookie();
      expect(token).not.toBeNull();
    });

    test('SCEN-001-03: Login button disabled during authentication', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();

      const loginButton = page.locator('button:has-text("Login")');
      await loginButton.click();

      await page.waitForTimeout(500);
      const isDisabled = await loginButton.isDisabled().catch(() => false);
      const isVisible = await loginButton.isVisible().catch(() => false);
      expect(isDisabled || !isVisible).toBe(true);
    });

    test('SCEN-001-04: UI transitions from login to authenticated state', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();

      const loginButton = page.locator('button:has-text("Login")');
      await expect(loginButton).toBeVisible();

      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();

      await expect(loginButton).not.toBeVisible();
      const logoutButton = page.locator('button:has-text("Logout")');
      await expect(logoutButton).toBeVisible();
    });

    test('SCEN-001-05: Token stored in chrome.storage.session', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();

      const token = await page.evaluate(async () => {
        const result = await chrome.storage.session.get('authToken');
        return result.authToken;
      });

      expect(token).toBeTruthy();
      expect(token).toContain('eyJ');
    });
  });

  // REQ-002: Logout Flow Tests
  test.describe('REQ-002: Logout Flow', () => {
    test.beforeEach(async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();
      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();
      await page.close();
    });

    test('SCEN-002-01: Logout clears token and shows login button', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.verifyAuthenticatedState();

      await helper.clickLogout();
      await helper.waitForLoadingComplete();

      await helper.verifyUnauthenticatedState();
    });

    test('SCEN-002-02: Logout removes token from chrome.storage', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      
      let token = await helper.getStoredToken();
      expect(token).toBeTruthy();

      await helper.clickLogout();
      await helper.waitForLoadingComplete();

      token = await helper.getStoredToken();
      expect(token).toBeNull();
    });

    test('SCEN-002-03: Logout button disabled during logout process', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();

      const logoutButton = page.locator('button:has-text("Logout")');
      await logoutButton.click();

      await page.waitForTimeout(200);
      const isDisabled = await logoutButton.isDisabled().catch(() => false);
      const isVisible = await logoutButton.isVisible().catch(() => false);
      
      expect(isDisabled || !isVisible).toBe(true);
    });

    test('SCEN-002-04: UI resets to initial state after logout', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.clickLogout();
      await helper.waitForLoadingComplete();

      const loginButton = page.locator('button:has-text("Login")');
      await expect(loginButton).toBeVisible();

      const logoutButton = page.locator('button:has-text("Logout")');
      await expect(logoutButton).not.toBeVisible();

      const userProfile = page.locator('.user-profile, [data-testid="user-profile"]');
      await expect(userProfile).not.toBeVisible();
    });

    test('SCEN-002-05: Logout calls server signout endpoint', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      // Track signout endpoint calls
      const signoutRequests: any[] = [];
      await page.route('**/api/v1/auths/signout', (route) => {
        signoutRequests.push({
          url: route.request().url(),
          method: route.request().method(),
          headers: route.request().headers(),
        });
        route.continue();
      });

      await helper.openPopup();
      await helper.verifyAuthenticatedState();

      // Get the token before logout for verification
      const token = await helper.getStoredToken();
      expect(token).toBeTruthy();

      // Trigger logout
      await helper.clickLogout();
      await helper.waitForLoadingComplete();

      // Verify server signout endpoint was called
      expect(signoutRequests.length).toBeGreaterThan(0);
      const signoutRequest = signoutRequests[0];
      expect(signoutRequest.method).toBe('GET');
      expect(signoutRequest.headers['authorization']).toContain('Bearer');
      
      // Verify local state was cleared
      await helper.verifyUnauthenticatedState();
      const clearedToken = await helper.getStoredToken();
      expect(clearedToken).toBeNull();
    });

    test('SCEN-002-06: Logout completes even if server signout fails', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.verifyAuthenticatedState();

      // Set server to error mode
      const mockServerUrl = process.env.MOCK_SERVER_URL;
      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'server_error' }),
      });

      // Logout should still complete locally
      await helper.clickLogout();
      await helper.waitForLoadingComplete();

      // Reset error mode
      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'none' }),
      });

      // Verify local state was cleared despite server error
      await helper.verifyUnauthenticatedState();
      const token = await helper.getStoredToken();
      expect(token).toBeNull();
    });
  });

  // REQ-003: Auth Persistence Tests
  test.describe('REQ-003: Auth Persistence', () => {
    test('SCEN-003-01: Token persists after closing and reopening popup', async () => {
      let page = await context.newPage();
      let helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();
      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();

      const originalToken = await helper.getStoredToken();
      await page.close();

      page = await context.newPage();
      helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();

      const newToken = await helper.getStoredToken();
      expect(newToken).toBe(originalToken);
      await helper.verifyAuthenticatedState();
    });

    test('SCEN-003-02: Auth state syncs between popup and sidepanel', async () => {
      const popupPage = await context.newPage();
      const popupHelper = new AuthTestHelper(popupPage, context, extensionId);
      await popupHelper.openPopup();
      await popupHelper.clickLogin();
      await popupHelper.waitForCallbackWithCookie();
      await popupHelper.closeExtraWindows();
      await popupHelper.waitForAuthComplete();

      const token = await popupHelper.getStoredToken();

      const sidepanelPage = await popupHelper.openSidepanel();
      const sidepanelHelper = new AuthTestHelper(sidepanelPage, context, extensionId);

      const sidepanelToken = await sidepanelHelper.getStoredToken();
      expect(sidepanelToken).toBe(token);
      await sidepanelHelper.verifyAuthenticatedState();
    });

    test('SCEN-003-03: Logout in popup reflects in sidepanel', async () => {
      const popupPage = await context.newPage();
      const popupHelper = new AuthTestHelper(popupPage, context, extensionId);
      await popupHelper.openPopup();
      await popupHelper.clickLogin();
      await popupHelper.waitForCallbackWithCookie();
      await popupHelper.closeExtraWindows();
      await popupHelper.waitForAuthComplete();

      const sidepanelPage = await popupHelper.openSidepanel();
      const sidepanelHelper = new AuthTestHelper(sidepanelPage, context, extensionId);
      await sidepanelHelper.verifyAuthenticatedState();

      await popupHelper.clickLogout();
      await popupHelper.waitForLoadingComplete();

      await sidepanelPage.waitForTimeout(1000);
      await sidepanelPage.reload();
      await sidepanelHelper.verifyUnauthenticatedState();
    });

    test('SCEN-003-04: Login in sidepanel reflects in popup', async () => {
      const sidepanelPage = await context.newPage();
      const sidepanelHelper = new AuthTestHelper(sidepanelPage, context, extensionId);
      await sidepanelHelper.openSidepanel();
      
      await sidepanelHelper.clickLogin();
      await sidepanelHelper.waitForCallbackWithCookie();
      await sidepanelHelper.closeExtraWindows();
      await sidepanelHelper.waitForAuthComplete();

      const token = await sidepanelHelper.getStoredToken();

      const popupPage = await context.newPage();
      const popupHelper = new AuthTestHelper(popupPage, context, extensionId);
      await popupHelper.openPopup();

      const popupToken = await popupHelper.getStoredToken();
      expect(popupToken).toBe(token);
      await popupHelper.verifyAuthenticatedState();
    });
  });

  // REQ-004: Token Synchronization Tests
  test.describe('REQ-004: Token Synchronization', () => {
    test('SCEN-004-01: Concurrent logins do not create race conditions', async () => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const helper1 = new AuthTestHelper(page1, context, extensionId);
      const helper2 = new AuthTestHelper(page2, context, extensionId);

      await helper1.openPopup();
      await helper2.openPopup();

      const login1 = helper1.clickLogin();
      const login2 = helper2.clickLogin();

      await Promise.all([login1, login2]);

      await helper1.waitForCallbackWithCookie();
      await helper1.closeExtraWindows();
      await helper2.closeExtraWindows();

      await Promise.all([
        helper1.waitForAuthComplete(),
        helper2.waitForAuthComplete(),
      ]);

      const token1 = await helper1.getStoredToken();
      const token2 = await helper2.getStoredToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).toBe(token2);
    });

    test('SCEN-004-02: Storage changes propagate to all open views', async () => {
      const page1 = await context.newPage();
      const helper1 = new AuthTestHelper(page1, context, extensionId);
      await helper1.openPopup();
      await helper1.clickLogin();
      await helper1.waitForCallbackWithCookie();
      await helper1.closeExtraWindows();
      await helper1.waitForAuthComplete();

      const page2 = await context.newPage();
      const helper2 = new AuthTestHelper(page2, context, extensionId);
      await helper2.openPopup();
      await helper2.verifyAuthenticatedState();

      await helper1.clickLogout();
      await helper1.waitForLoadingComplete();

      await page2.waitForTimeout(1000);
      await page2.reload();

      await helper2.verifyUnauthenticatedState();
    });

    test('SCEN-004-03: Token update reflects immediately across views', async () => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const helper1 = new AuthTestHelper(page1, context, extensionId);
      const helper2 = new AuthTestHelper(page2, context, extensionId);

      await helper1.openPopup();
      await helper2.openPopup();

      await helper1.clickLogin();
      await helper1.waitForCallbackWithCookie();
      await helper1.closeExtraWindows();
      await helper1.waitForAuthComplete();

      const token1 = await helper1.getStoredToken();

      await page2.waitForTimeout(1000);
      await page2.reload();

      const token2 = await helper2.getStoredToken();
      expect(token2).toBe(token1);
      await helper2.verifyAuthenticatedState();
    });
  });

  // REQ-005: Error Handling Tests
  test.describe('REQ-005: Error Handling', () => {
    test('SCEN-005-01: Network error during login shows error message', async () => {
      const mockServerUrl = process.env.MOCK_SERVER_URL;
      if (!mockServerUrl) throw new Error('Mock server URL not found');

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'network' }),
      });

      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();
      await helper.clickLogin();

      await page.waitForTimeout(2000);

      const hasError = await helper.isErrorDisplayed();
      expect(hasError).toBe(true);

      const errorMessage = await helper.getErrorMessage();
      expect(errorMessage).toBeTruthy();

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'none' }),
      });
    });

    test('SCEN-005-02: Invalid token returns 401 and triggers re-login', async () => {
      const mockServerUrl = process.env.MOCK_SERVER_URL;
      if (!mockServerUrl) throw new Error('Mock server URL not found');

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'invalid_token' }),
      });

      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();

      await page.evaluate(async () => {
        await chrome.storage.session.set({ authToken: 'invalid-token-12345' });
      });

      await page.reload();

      await helper.verifyUnauthenticatedState();

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'none' }),
      });
    });

    test('SCEN-005-03: Server error (500) during token validation shows error', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();
      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();

      const mockServerUrl = process.env.MOCK_SERVER_URL;
      if (!mockServerUrl) throw new Error('Mock server URL not found');

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'server_error' }),
      });

      await page.reload();
      await page.waitForTimeout(2000);

      const hasError = await helper.isErrorDisplayed();
      const isLoginVisible = await page.locator('button:has-text("Login")').isVisible().catch(() => false);

      expect(hasError || isLoginVisible).toBe(true);

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'none' }),
      });
    });

    test('SCEN-005-04: OAuth callback without code shows error', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();

      const mockServerUrl = process.env.MOCK_SERVER_URL;
      await page.goto(`${mockServerUrl}/oauth/microsoft/callback`);

      await page.waitForTimeout(1000);

      const content = await page.content();
      expect(content).toContain('400');
    });

    test('SCEN-005-05: Network interruption during logout handled gracefully', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);
      await helper.openPopup();
      await helper.clickLogin();
      await helper.waitForCallbackWithCookie();
      await helper.closeExtraWindows();
      await helper.waitForAuthComplete();

      const mockServerUrl = process.env.MOCK_SERVER_URL;
      if (!mockServerUrl) throw new Error('Mock server URL not found');

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'network' }),
      });

      await helper.clickLogout();
      await page.waitForTimeout(2000);

      const token = await helper.getStoredToken();
      expect(token).toBeNull();

      await fetch(`${mockServerUrl}/test/error-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'none' }),
      });
    });
  });

  // Token Expiration Tests
  test.describe('Token Expiration', () => {
    test('SCEN-006-01: Expired token triggers re-authentication', async () => {
      const page = await context.newPage();
      const helper = new AuthTestHelper(page, context, extensionId);

      await helper.openPopup();

      await page.evaluate(async () => {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature';
        await chrome.storage.session.set({ authToken: expiredToken });
      });

      await page.reload();
      await page.waitForTimeout(2000);

      const loginButton = page.locator('button:has-text("Login")');
      await expect(loginButton).toBeVisible();
    });
  });
});
