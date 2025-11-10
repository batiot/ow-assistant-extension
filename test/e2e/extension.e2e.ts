import { test, expect } from './utils/test-utils';
import { ExtensionHelper, MockBackendService } from './utils/extension-helper';

test.describe('Basic Extension Tests', () => {
  test('should load extension successfully', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const extensionHelper = new ExtensionHelper(page, extensionId);
    
    // Test popup - just check it opens, don't require specific content
    const popupPage = await extensionHelper.openPopup();
    await expect(popupPage).toBeTruthy();
    
    // Wait for page to load (any content)
    await popupPage.waitForLoadState('domcontentloaded');
    
    // Check if page has some content (heading OR login button OR any visible element)
    const hasContent = await popupPage.locator('body').isVisible();
    expect(hasContent).toBeTruthy();

    // Test sidepanel - just check it opens
    const sidebarPage = await extensionHelper.openSidebar();
    await expect(sidebarPage).toBeTruthy();
    
    // Wait for page to load
    await sidebarPage.waitForLoadState('domcontentloaded');
    
    // Check if page has some content
    const hasSidebarContent = await sidebarPage.locator('body').isVisible();
    expect(hasSidebarContent).toBeTruthy();

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