/**
 * Authentication Test Helper
 * 
 * Provides reusable methods for E2E authentication testing.
 */

import { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';

export class AuthTestHelper {
  constructor(
    private page: Page,
    private context: BrowserContext,
    private extensionId: string
  ) {}

  /**
   * Open the extension popup
   */
  async openPopup(): Promise<Page> {
    const popupUrl = `chrome-extension://${this.extensionId}/src/popup/index.html`;
    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }

  /**
   * Open the extension sidepanel
   */
  async openSidepanel(): Promise<Page> {
    const sidepanelUrl = `chrome-extension://${this.extensionId}/src/sidepanel/index.html`;
    const sidepanel = await this.context.newPage();
    await sidepanel.goto(sidepanelUrl);
    await sidepanel.waitForLoadState('domcontentloaded');
    return sidepanel;
  }

  /**
   * Click the login button
   */
  async clickLogin(): Promise<void> {
    const loginButton = this.page.locator('button:has-text("Login")');
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    await loginButton.click();
  }

  /**
   * Click the logout button
   */
  async clickLogout(): Promise<void> {
    const logoutButton = this.page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await logoutButton.click();
  }

  /**
   * Wait for OAuth authentication to complete
   * Returns the popup window that was opened for OAuth
   */
  async waitForAuthComplete(timeout: number = 30000): Promise<void> {
    // Wait for the authentication to complete by checking for user profile
    await this.page.waitForSelector('.user-profile, [data-testid="user-profile"]', {
      timeout,
      state: 'visible',
    }).catch(() => {
      // Fallback: just wait for login button to disappear
      return this.page.waitForSelector('button:has-text("Login")', {
        timeout,
        state: 'hidden',
      });
    });
  }

  /**
   * Wait for OAuth callback with cookie
   * Monitors browser context for OAuth callback and cookie setting
   */
  async waitForCallbackWithCookie(timeout: number = 30000): Promise<string | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check all pages in the context for OAuth callback
      const pages = this.context.pages();
      for (const page of pages) {
        const url = page.url();
        if (url.includes('/oauth/microsoft/callback')) {
          // Wait a bit for cookie to be set
          await page.waitForTimeout(500);
          
          // Try to extract token from cookies
          const cookies = await this.context.cookies();
          const tokenCookie = cookies.find(c => c.name === 'token');
          
          if (tokenCookie) {
            return tokenCookie.value;
          }
        }
      }
      
      await this.page.waitForTimeout(100);
    }
    
    return null;
  }

  /**
   * Extract token from browser cookies
   */
  async extractTokenFromCookie(): Promise<string | null> {
    const cookies = await this.context.cookies();
    const tokenCookie = cookies.find(c => c.name === 'token');
    return tokenCookie?.value || null;
  }

  /**
   * Get stored token from chrome.storage
   */
  async getStoredToken(): Promise<string | null> {
    return await this.page.evaluate(async () => {
      try {
        const result = await chrome.storage.session.get('authToken');
        return result.authToken || null;
      } catch {
        // Fallback to local storage
        const result = await chrome.storage.local.get('authToken');
        return result.authToken || null;
      }
    });
  }

  /**
   * Verify the extension is in authenticated state
   */
  async verifyAuthenticatedState(): Promise<void> {
    // Check for user profile
    const userProfile = this.page.locator('.user-profile, [data-testid="user-profile"]');
    await expect(userProfile).toBeVisible({ timeout: 5000 });

    // Check for logout button
    const logoutButton = this.page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();

    // Check login button is hidden
    const loginButton = this.page.locator('button:has-text("Login")');
    await expect(loginButton).not.toBeVisible();

    // Verify token is stored
    const token = await this.getStoredToken();
    expect(token).not.toBeNull();
    expect(token).toBeTruthy();
  }

  /**
   * Verify the extension is in unauthenticated state
   */
  async verifyUnauthenticatedState(): Promise<void> {
    // Check for login button
    const loginButton = this.page.locator('button:has-text("Login")');
    await expect(loginButton).toBeVisible({ timeout: 5000 });

    // Check logout button is hidden
    const logoutButton = this.page.locator('button:has-text("Logout")');
    await expect(logoutButton).not.toBeVisible();

    // Check user profile is hidden
    const userProfile = this.page.locator('.user-profile, [data-testid="user-profile"]');
    await expect(userProfile).not.toBeVisible();

    // Verify no token is stored
    const token = await this.getStoredToken();
    expect(token).toBeNull();
  }

  /**
   * Clear all auth state (for cleanup between tests)
   */
  async clearAuthState(): Promise<void> {
    await this.page.evaluate(async () => {
      await chrome.storage.session.clear();
      await chrome.storage.local.clear();
    });
  }

  /**
   * Wait for loading state to complete
   */
  async waitForLoadingComplete(timeout: number = 10000): Promise<void> {
    // Wait for loading spinner to disappear
    await this.page.waitForSelector('.spinner, .loading, [data-testid="loading"]', {
      timeout,
      state: 'hidden',
    }).catch(() => {
      // If no loading indicator found, that's okay
    });
  }

  /**
   * Check if error is displayed
   */
  async isErrorDisplayed(): Promise<boolean> {
    const errorDisplay = this.page.locator('.error-display, [data-testid="error-display"]');
    try {
      await errorDisplay.waitFor({ timeout: 1000, state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    const errorDisplay = this.page.locator('.error-display, [data-testid="error-display"]');
    try {
      await errorDisplay.waitFor({ timeout: 1000, state: 'visible' });
      return await errorDisplay.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Close all extra windows (OAuth popups, etc.)
   */
  async closeExtraWindows(): Promise<void> {
    const pages = this.context.pages();
    for (const page of pages) {
      if (page !== this.page) {
        await page.close().catch(() => {
          // Ignore errors if page is already closed
        });
      }
    }
  }
}
