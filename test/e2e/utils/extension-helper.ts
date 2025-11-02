import { Page } from '@playwright/test';

/**
 * Helper functions for common extension testing operations
 */
export class ExtensionHelper {
  constructor(private page: Page, private extensionId: string) {}

  /**
   * Open the extension popup
   */
  async openPopup(): Promise<Page> {
    const page = await this.page.context().newPage();
    await page.goto(`chrome-extension://${this.extensionId}/src/popup/index.html`);
    return page;
  }

  /**
   * Open the extension sidebar
   */
  async openSidebar(): Promise<Page> {
    const page = await this.page.context().newPage();
    await page.goto(`chrome-extension://${this.extensionId}/src/sidepanel/index.html`);
    return page;
  }

  /**
   * Helper to interact with content script
   */
  async getInjectedContentScript(): Promise<boolean> {
    // Poll the page for the injected element for up to 5s to allow the content
    // script time to run after navigation.
    const timeout = 5000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const exists = await this.page.evaluate(() => Boolean(document.getElementById('crxjs-app')));
      if (exists) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
}

/**
 * Mock service for backend API calls
 */
export class MockBackendService {
  constructor(private page: Page) {
    this.setupMocks();
  }

  private setupMocks() {
    this.page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
  }
}