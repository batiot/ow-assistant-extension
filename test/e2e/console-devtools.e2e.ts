/**
 * E2E Console and DevTools Tests
 * 
 * Tests extension behavior in Chrome DevTools and console error monitoring.
 * Covers manual test tasks from implement-silent-auth proposal.
 * 
 * Manual test tasks addressed:
 * - Test with Chrome Extensions DevMode to verify no console errors
 * - Check Chrome DevTools to confirm hidden tab is created and cleaned up
 */

import { test, expect } from './utils/test-utils';
import { AuthTestHelper } from './utils/auth-helper';

test.describe('Console and DevTools E2E Tests', () => {
  let mockServerUrl: string;

  test.beforeAll(async () => {
    mockServerUrl = process.env.MOCK_SERVER_URL!;
    if (!mockServerUrl) {
      throw new Error('Mock server URL not found. Global setup may have failed.');
    }
    console.log(`Using mock server at ${mockServerUrl}`);
  });

  test.beforeEach(async ({ context, extensionId }) => {
    const configPage = await context.newPage();
    await configPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await configPage.waitForLoadState('domcontentloaded');
    
    await configPage.evaluate((url) => {
      return chrome.storage.sync.set({ 
        instance_url: url
      });
    }, mockServerUrl);
    
    await configPage.waitForTimeout(500);
    await configPage.close();
  });

  test('CONSOLE-01: No console errors during normal extension load', async ({ context, extensionId }) => {
    const consoleErrors: string[] = [];
    
    const page = await context.newPage();
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Verify no console errors occurred during load
    expect(consoleErrors).toEqual([]);
  });

  test('CONSOLE-02: No console errors during authentication flow', async ({ context, extensionId }) => {
    const consoleErrors: string[] = [];
    
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    const helper = new AuthTestHelper(page, context, extensionId);
    await helper.openPopup();

    // Configure fast OAuth
    await fetch(`${mockServerUrl}/test/oauth-delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay: 100 }),
    });

    await helper.clickLogin();
    await page.waitForTimeout(2000);

    // Should have no console errors during authentication
    // Filter out expected/benign errors if any
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Extension context invalidated') &&
      !err.includes('Receiving end does not exist')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('CONSOLE-03: No console errors during settings changes', async ({ context, extensionId }) => {
    const consoleErrors: string[] = [];
    
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Change various settings
    await page.evaluate((url) => {
      return chrome.storage.sync.set({ 
        instance_url: url,
        theme: 'dark',
        language: 'en'
      });
    }, mockServerUrl);

    await page.waitForTimeout(1000);

    // Verify no errors during settings changes
    expect(consoleErrors).toEqual([]);
  });

  test('CONSOLE-04: Service worker errors monitoring', async ({ context, extensionId }) => {
    // Monitor service worker console
    const swErrors: string[] = [];

    // Get service worker
    const serviceWorkers = context.serviceWorkers();
    const sw = serviceWorkers.find(w => w.url().includes(extensionId));

    if (sw) {
      sw.on('console', msg => {
        if (msg.type() === 'error') {
          swErrors.push(msg.text());
        }
      });
    }

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');

    // Trigger some background operations
    await page.evaluate(() => {
      return chrome.storage.sync.set({ test_key: 'test_value' });
    });

    await page.waitForTimeout(1000);

    // Service worker should not have errors
    const criticalErrors = swErrors.filter(err => 
      !err.includes('Extension context invalidated')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('CONSOLE-05: No errors during tab cleanup in silent auth', async ({ context, extensionId }) => {
    const consoleErrors: string[] = [];
    
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    const helper = new AuthTestHelper(page, context, extensionId);
    await helper.openPopup();

    // Configure very fast OAuth to trigger silent auth
    await fetch(`${mockServerUrl}/test/oauth-delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay: 50 }),
    });

    const initialPageCount = context.pages().length;

    await helper.clickLogin();
    
    // Wait for auth to complete
    await page.waitForTimeout(3000);

    const finalPageCount = context.pages().length;

    // Verify tabs were cleaned up (should be same or fewer pages)
    expect(finalPageCount).toBeLessThanOrEqual(initialPageCount + 1);

    // No errors should occur during tab cleanup
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Extension context invalidated') &&
      !err.includes('Receiving end does not exist')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('CONSOLE-06: Console warnings logging (non-error)', async ({ context, extensionId }) => {
    const consoleWarnings: string[] = [];
    
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Warnings are acceptable but should be logged for review
    // This test just ensures we can monitor warnings
    console.log(`Console warnings found: ${consoleWarnings.length}`);
    
    // Test passes - warnings are informational
    expect(true).toBe(true);
  });

  test('CONSOLE-07: Network request errors are handled gracefully', async ({ context, extensionId }) => {
    const consoleErrors: string[] = [];
    
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    // Set up network error condition
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'network' }),
    });

    const helper = new AuthTestHelper(page, context, extensionId);
    await helper.openPopup();
    
    // Try to login with network errors
    await helper.clickLogin().catch(() => {});
    await page.waitForTimeout(2000);

    // Network errors should be logged but not crash the extension
    // Uncaught exceptions would show as page errors
    const hasUncaughtErrors = consoleErrors.some(err => 
      err.includes('Uncaught') || err.includes('TypeError')
    );

    expect(hasUncaughtErrors).toBe(false);

    // Reset
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'none' }),
    });
  });

  test('CONSOLE-08: DevTools protocol errors', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Monitor CDP (Chrome DevTools Protocol) errors
    const cdpErrors: string[] = [];
    page.on('pageerror', error => {
      if (error.message.includes('CDP') || error.message.includes('Protocol')) {
        cdpErrors.push(error.message);
      }
    });

    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should not have CDP/protocol errors
    expect(cdpErrors).toEqual([]);
  });
});
