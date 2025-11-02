import { test, expect } from './utils/test-utils';
import { ExtensionHelper, MockBackendService } from './utils/extension-helper';

test.describe('Basic Extension Tests', () => {
  test('should load extension successfully', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const extensionHelper = new ExtensionHelper(page, extensionId);
    
    // Test popup
    const popupPage = await extensionHelper.openPopup();
    await expect(popupPage).toBeTruthy();
    // Wait for heading; if it doesn't appear, dump the popup HTML for debugging.
    try {
      // Be permissive: wait for any heading to appear (project template may differ).
      await popupPage.getByRole('heading').first().waitFor({ timeout: 5000 });
    } catch (err) {
      // Dump debug HTML to help diagnose why the heading isn't present
      console.error('DEBUG: popup HTML start');
      console.error(await popupPage.content());
      console.error('DEBUG: popup HTML end');
      throw err;
    }
  await expect(popupPage.getByRole('heading').first()).toBeVisible();

    // Test sidepanel
    const sidebarPage = await extensionHelper.openSidebar();
  await expect(sidebarPage).toBeTruthy();
  await expect(sidebarPage.getByRole('heading').first()).toBeVisible();

    // Test content script injection
    await page.goto('https://example.com');
    const hasContentScript = await extensionHelper.getInjectedContentScript();
    if (!hasContentScript) {
      // Dump page content and context info to debug why content script didn't inject
      console.error('DEBUG: current page url:', page.url());
      try {
        console.error('DEBUG: page content start');
        console.error(await page.content());
        console.error('DEBUG: page content end');
      } catch (err) {
        console.error('DEBUG: could not read page content', err);
      }
      try {
        const bg = page.context().backgroundPages().map(p => p.url());
        const sw = page.context().serviceWorkers().map(w => w.url());
        console.error('DEBUG: backgroundPages:', bg);
        console.error('DEBUG: serviceWorkers:', sw);
      } catch (err) {
        console.error('DEBUG: could not read context pages', err);
      }
    }
    expect(hasContentScript).toBeTruthy();
  });

  test('should handle API calls correctly', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const extensionHelper = new ExtensionHelper(page, extensionId);
    const mockBackend = new MockBackendService(page);

    const popupPage = await extensionHelper.openPopup();
    
    // Verify API calls are mocked
    // This is a placeholder - add actual API testing based on your extension's needs
    await expect(popupPage).toBeTruthy();
  });
});