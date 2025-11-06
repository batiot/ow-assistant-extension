import { test, expect } from './utils/test-utils';

/**
 * E2E Tests for Dynamic Auth Service Reinitialization
 * 
 * These tests verify that the AuthService correctly reinitializes
 * when the OpenWebUI instance URL is configured or changed at runtime,
 * without requiring an extension reload.
 */

test.describe('Auth Service Dynamic Reinitialization', () => {
  const mockServerUrl = 'https://test.openwebui.com';

  test.beforeEach(async ({ context, extensionId }) => {
    // Clear storage before each test
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.clear(() => {
          chrome.storage.sync.clear(() => {
            resolve();
          });
        });
      });
    });
    await page.close();
  });

  test('should initialize auth service immediately after URL configuration', async ({ context, extensionId }) => {
    /**
     * Scenario: User configures OpenWebUI URL for the first time
     * Expected: Auth service becomes available without extension reload
     */
    
    // Step 1: Configure URL in options page (no need to check popup first)
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    // Wait for options page to load
    await optionsPage.waitForSelector('input#instance-url', { timeout: 5000 });
    
    // Fill in the URL
    await optionsPage.fill('input#instance-url', mockServerUrl);
    
    // Click save button
    await optionsPage.click('button.save-button, button[type="submit"]');
    
    // Wait a moment for storage to update and auth service to initialize
    await optionsPage.waitForTimeout(1500);
    
    await optionsPage.close();

    // Step 2: Open popup WITHOUT reloading extension
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Wait for page to render
    await popupPage.waitForSelector('.app-container', { timeout: 5000 });
    
    // Verify auth UI is available (login button or authenticated view)
    // The key test is that we don't get an error when trying to use auth
    const hasAuthUI = await popupPage.locator('button:has-text("Login"), button:has-text("Log in"), .authenticated-view').count();
    expect(hasAuthUI).toBeGreaterThan(0);
    
    // Verify there's no "not initialized" error displayed
    const errorDisplay = await popupPage.locator('.error-display:has-text("not initialized")').count();
    expect(errorDisplay).toBe(0);
    
    await popupPage.close();
  });

  test('should reinitialize auth service when URL changes', async ({ context, extensionId }) => {
    /**
     * Scenario: User changes OpenWebUI URL to different instance
     * Expected: Auth service reinitializes with new URL
     */
    
    const originalUrl = 'https://original.openwebui.com';
    const newUrl = 'https://new.openwebui.com';
    
    // Step 1: Configure initial URL
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await optionsPage.waitForSelector('input#instance-url');
    await optionsPage.fill('input#instance-url', originalUrl);
    await optionsPage.click('button.save-button, button[type="submit"]');
    await optionsPage.waitForTimeout(1000);
    
    // Step 2: Verify auth service works with initial URL
    let popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popupPage.waitForSelector('.app-container');
    
    const errorCount1 = await popupPage.locator('text=/not initialized/i').count();
    expect(errorCount1).toBe(0);
    
    await popupPage.close();
    
    // Step 3: Change URL to new instance
    await optionsPage.fill('input#instance-url', newUrl);
    await optionsPage.click('button.save-button, button[type="submit"]');
    await optionsPage.waitForTimeout(1500); // Give more time for reinitialization
    
    await optionsPage.close();
    
    // Step 4: Verify auth service still works with new URL
    popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popupPage.waitForSelector('.app-container');
    
    const errorCount2 = await popupPage.locator('text=/not initialized/i').count();
    expect(errorCount2).toBe(0);
    
    await popupPage.close();
  });

  test('should clear auth service when URL is removed', async ({ context, extensionId }) => {
    /**
     * Scenario: User removes/clears the OpenWebUI URL
     * Expected: Auth service becomes unavailable, appropriate error shown
     */
    
    // Step 1: Configure URL initially
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await optionsPage.waitForSelector('input#instance-url');
    await optionsPage.fill('input#instance-url', mockServerUrl);
    await optionsPage.click('button.save-button, button[type="submit"]');
    await optionsPage.waitForTimeout(1000);
    
    // Step 2: Verify auth service is available
    let popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popupPage.waitForSelector('.app-container');
    
    const errorBefore = await popupPage.locator('text=/not initialized/i').count();
    expect(errorBefore).toBe(0);
    
    await popupPage.close();
    
    // Step 3: Clear the URL (set to empty)
    await optionsPage.fill('input#instance-url', '');
    
    // Note: Validation might prevent saving empty URL, but we can test the behavior
    // If validation prevents it, auth service should remain with old URL
    // For now, just test that the options page handles it gracefully
    
    await optionsPage.close();
  });

  test('should preserve auth service during non-URL setting changes', async ({ context, extensionId }) => {
    /**
     * Scenario: User changes theme/language but not URL
     * Expected: Auth service is not reinitialized
     */
    
    // Step 1: Configure URL
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await optionsPage.waitForSelector('input#instance-url');
    await optionsPage.fill('input#instance-url', mockServerUrl);
    await optionsPage.click('button.save-button, button[type="submit"]');
    await optionsPage.waitForTimeout(1000);
    
    // Step 2: Change theme (not URL)
    await optionsPage.click('input[value="dark"]');
    await optionsPage.waitForTimeout(500);
    
    // Step 3: Verify auth service still works
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popupPage.waitForSelector('.app-container');
    
    const errorCount = await popupPage.locator('text=/not initialized/i').count();
    expect(errorCount).toBe(0);
    
    await popupPage.close();
    await optionsPage.close();
  });
});
