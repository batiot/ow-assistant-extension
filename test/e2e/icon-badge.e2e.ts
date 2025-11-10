/**
 * E2E Icon Badge Tests
 * 
 * Tests extension icon badge behavior based on authentication state.
 * 
 * MANUAL TESTING REQUIRED:
 * Playwright cannot directly inspect Chrome extension badge state (text, color, visibility).
 * These tests are skipped in automated runs. See tasks.md section 6 for manual testing checklist.
 * 
 * Unit tests in test/unit/background/badge.test.ts provide automated coverage of badge logic.
 */

import { test, expect } from './utils/test-utils';

test.describe.skip('Icon Badge E2E Tests - Manual Testing Required', () => {

  test('should initialize with unauthenticated state (badge should be set)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    
    // Check auth state through chrome.runtime.sendMessage
    const authState = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    // When not authenticated, badge should be set (red dot)
    expect(authState).toHaveProperty('isAuthenticated', false);
    await page.close();
  });

  test('should reflect auth state changes in background service', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Check initial unauthenticated state
    const initialState = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    expect(initialState).toHaveProperty('isAuthenticated', false);
    
    await page.close();
  });

  test('should handle storage changes that affect auth state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Set instance URL (this should trigger auth service initialization)
    await page.evaluate(() => {
      return chrome.storage.local.set({
        user_settings_local: {
          instanceUrl: 'https://test.openwebui.com',
        },
      });
    });

    // Wait for async initialization
    await page.waitForTimeout(500);

    // Verify auth state reflects the change
    const state = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    // Should still be unauthenticated but service should be initialized
    expect(state).toHaveProperty('isAuthenticated', false);
    
    await page.close();
  });

  test('should clear instance URL and update badge state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // First set a URL
    await page.evaluate(() => {
      return chrome.storage.local.set({
        user_settings_local: {
          instanceUrl: 'https://test.openwebui.com',
        },
      });
    });

    await page.waitForTimeout(300);

    // Then remove it
    await page.evaluate(() => {
      return chrome.storage.local.set({
        user_settings_local: {
          instanceUrl: undefined,
        },
      });
    });

    await page.waitForTimeout(300);

    // Verify state
    const state = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    expect(state).toHaveProperty('isAuthenticated', false);
    
    await page.close();
  });

  test('should maintain badge state across contexts', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Get initial state from popup
    const state1 = await page1.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    await page1.close();

    // Open sidepanel and check state
    const page2 = await context.newPage();
    await page2.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    
    const state2 = await page2.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    // State should be consistent
    expect(state1).toEqual(state2);
    
    await page2.close();
  });
});
