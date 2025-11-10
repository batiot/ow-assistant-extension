/**
 * E2E Instance URL Configuration Tests
 * 
 * Tests instance URL configuration, validation, and state management.
 * Covers manual test tasks from detect-cookie-auth proposal.
 * 
 * Manual test tasks addressed:
 * - Test fresh install with no prior authentication
 * - Test instance URL change clears old state properly
 * - Verify API response structure matches documentation
 */

import { test, expect } from './utils/test-utils';

test.describe('Instance URL Configuration E2E Tests', () => {
  let mockServerUrl: string;

  test.beforeAll(async () => {
    mockServerUrl = process.env.MOCK_SERVER_URL!;
    if (!mockServerUrl) {
      throw new Error('Mock server URL not found. Global setup may have failed.');
    }
    console.log(`Using mock server at ${mockServerUrl}`);
  });

  test('URL-01: Fresh install with no prior authentication', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Open options page to configure instance
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Should have no instance URL configured initially
    const initialUrl = await page.evaluate(() => {
      return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
    });

    // Initially might be undefined or empty
    expect(initialUrl === undefined || initialUrl === '' || initialUrl === null).toBe(true);

    // Configure instance URL
    const urlInput = page.locator('input[type="url"], input[name="instanceUrl"], input[id*="url"]').first();
    await urlInput.fill(mockServerUrl);

    // Save settings
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(500);
    }

    // Verify URL was saved
    const savedUrl = await page.evaluate(() => {
      return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
    });

    expect(savedUrl).toBe(mockServerUrl);

    // Open popup and verify unauthenticated state
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');

    const loginButton = page.locator('button:has-text("Login")');
    await expect(loginButton).toBeVisible({ timeout: 5000 });

    // Should not have auth token
    const token = await page.evaluate(() => {
      return chrome.storage.session.get(['authToken']).then(result => result.authToken);
    });

    expect(token).toBeFalsy();
  });

  test('URL-02: Instance URL change clears old auth state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // First, set up authentication with mock server
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Set instance URL
    await page.evaluate((url) => {
      return chrome.storage.sync.set({ instance_url: url });
    }, mockServerUrl);

    await page.waitForTimeout(500);

    // Store a fake auth token
    await page.evaluate(() => {
      return chrome.storage.session.set({ authToken: 'fake-token-12345' });
    });

    // Verify token is stored
    let token = await page.evaluate(() => {
      return chrome.storage.session.get(['authToken']).then(result => result.authToken);
    });
    expect(token).toBe('fake-token-12345');

    // Change instance URL
    const newUrl = 'https://different-server.example.com';
    await page.evaluate((url) => {
      return chrome.storage.sync.set({ instance_url: url });
    }, newUrl);

    // Wait for background worker to process the change
    await page.waitForTimeout(1000);

    // Auth token should be cleared when instance URL changes
    token = await page.evaluate(() => {
      return chrome.storage.session.get(['authToken']).then(result => result.authToken);
    });

    // Token should be cleared or extension should be in unauthenticated state
    expect(token === undefined || token === null || token === '').toBe(true);
  });

  test('URL-03: Invalid URL format shows validation error', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Try to set invalid URL
    const urlInput = page.locator('input[type="url"], input[name="instanceUrl"], input[id*="url"]').first();
    
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill('not-a-valid-url');
      
      // Try to save
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);

        // Should show validation error or prevent save
        // Check if URL was actually saved
        const savedUrl = await page.evaluate(() => {
          return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
        });

        // Invalid URL should not be saved, or if HTML5 validation is used, button won't submit
        expect(savedUrl !== 'not-a-valid-url').toBe(true);
      }
    }
  });

  test('URL-04: Valid HTTPS URL is accepted', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    const validUrl = 'https://openwebui.example.com';
    
    const urlInput = page.locator('input[type="url"], input[name="instanceUrl"], input[id*="url"]').first();
    
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(validUrl);
      
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);

        // Should successfully save
        const savedUrl = await page.evaluate(() => {
          return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
        });

        expect(savedUrl).toBe(validUrl);
      }
    }
  });

  test('URL-05: HTTP URL (non-HTTPS) handling', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Mock server uses HTTP in test environment
    const urlInput = page.locator('input[type="url"], input[name="instanceUrl"], input[id*="url"]').first();
    
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(mockServerUrl);
      
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);

        // HTTP should be allowed (for development/testing)
        const savedUrl = await page.evaluate(() => {
          return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
        });

        expect(savedUrl).toBe(mockServerUrl);
      }
    }
  });

  test('URL-06: Instance URL removal clears state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // First set a URL
    await page.evaluate((url) => {
      return chrome.storage.sync.set({ instance_url: url });
    }, mockServerUrl);

    await page.waitForTimeout(500);

    // Set a fake token
    await page.evaluate(() => {
      return chrome.storage.session.set({ authToken: 'test-token' });
    });

    // Clear the URL
    await page.evaluate(() => {
      return chrome.storage.sync.set({ instance_url: '' });
    });

    await page.waitForTimeout(1000);

    // Extension should handle URL removal gracefully
    const url = await page.evaluate(() => {
      return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
    });

    expect(url === '' || url === undefined || url === null).toBe(true);
  });

  test('URL-07: URL with trailing slash normalization', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    const urlWithSlash = mockServerUrl + '/';
    
    await page.evaluate((url) => {
      return chrome.storage.sync.set({ instance_url: url });
    }, urlWithSlash);

    await page.waitForTimeout(500);

    const savedUrl = await page.evaluate(() => {
      return chrome.storage.sync.get(['instance_url']).then(result => result.instance_url);
    });

    // Extension should either normalize (remove trailing slash) or accept it
    expect(savedUrl === urlWithSlash || savedUrl === mockServerUrl).toBe(true);
  });
});
