import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

// Extend BrowserContext to include extension ID
interface ExtensionBrowserContext extends BrowserContext {
  _extensionId?: string;
}

export type TestFixtures = {
  context: ExtensionBrowserContext;
  extensionId: string;
};

/**
 * Extended test fixture that includes extension context
 */
export const test = base.extend<TestFixtures>({
  context: async ({}, use) => {
    // Ensure mock server is ready before launching extension
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    if (!mockServerUrl) {
      throw new Error('MOCK_SERVER_URL not set - global setup may have failed');
    }
    
    // Verify mock server is responding
    try {
      const healthCheck = await fetch(`${mockServerUrl}/health`);
      if (!healthCheck.ok) {
        throw new Error(`Mock server health check failed: ${healthCheck.status}`);
      }
      console.log(`[Test Setup] Mock server ready at ${mockServerUrl}`);
    } catch (error) {
      throw new Error(`Mock server not accessible at ${mockServerUrl}: ${error}`);
    }
    
    const pathToExtension = path.resolve('dist');
    const chromeDataDir = path.resolve('test/e2e/tmp/chrome-data');

    // Decide whether to run headed or headless: CI or missing X display should use headless.
    const shouldHeadless = Boolean(process.env.CI) || !process.env.DISPLAY;

    // When running in the newer headless mode, Chrome accepts '--headless=new'.
    // Try enabling it when we detect headless environment to see if extensions load.
    const headlessArgs = shouldHeadless ? ['--headless=new'] : [];

    // Use a persistent context so the extension is loaded. When running locally with
    // an X server, Playwright may run headed to allow extension UI interaction.
    const context = await chromium.launchPersistentContext(chromeDataDir, {
      headless: shouldHeadless,
      // Use Playwright's bundled Chromium channel to ensure extension flags work.
      channel: 'chromium',
      // Required to allow loading unpacked extensions in Playwright's Chromium.
      // Remove Playwright's default flags that disable extensions so our
      // --load-extension and --disable-extensions-except take effect.
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

    // Helper: poll background pages and service workers for a chrome-extension:// URL
  const waitForExtensionId = async (timeout = 30000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        // background pages (manifest v2)
        const bg = context.backgroundPages().find(p => p.url().startsWith('chrome-extension://'));
        if (bg) {
          const parts = bg.url().split('/');
          if (parts[2]) return parts[2];
        }

        // service workers (manifest v3)
        const sw = context.serviceWorkers().find(w => w.url().startsWith('chrome-extension://'));
        if (sw) {
          const m = sw.url().match(/^chrome-extension:\/\/([^\/]+)/);
          if (m && m[1]) return m[1];
        }

        // small delay
        await new Promise(r => setTimeout(r, 100));
      }
      return undefined;
    };

  // Give enough time for the extension/service worker to initialize.
  const extensionId = await waitForExtensionId(30000);
    if (!extensionId) {
      // Diagnostic dump to help understand why the extension didn't register.
      try {
        const bgUrls = context.backgroundPages().map(p => p.url());
        const swUrls = context.serviceWorkers().map(w => w.url());
        const distFiles = await fs.readdir(pathToExtension);
        console.error('DEBUG: backgroundPages:', bgUrls);
        console.error('DEBUG: serviceWorkers:', swUrls);
        console.error('DEBUG: dist files:', distFiles);
        const manifestPath = path.join(pathToExtension, 'manifest.json');
        try {
          const manifest = await fs.readFile(manifestPath, 'utf8');
          console.error('DEBUG: manifest.json:', manifest);
        } catch (err: any) {
          console.error('DEBUG: could not read manifest.json:', err?.message || err);
        }
      } catch (err) {
        console.error('DEBUG: error while dumping diagnostics', err);
      }
      await context.close();
      throw new Error('Could not determine extension id after launching browser');
    }

    // Store extension ID on context for later use
    (context as ExtensionBrowserContext)._extensionId = extensionId;

    // Configure extension with mock server URL immediately after load
    if (mockServerUrl) {
      const page = await context.newPage();
      try {
        await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
        await page.evaluate((serverUrl) => {
          return new Promise<void>((resolve) => {
            chrome.storage.local.set({
              user_settings_local: {
                instanceUrl: serverUrl
              }
            }, () => {
              console.log('[Test Setup] Configured instanceUrl:', serverUrl);
              resolve();
            });
          });
        }, mockServerUrl);
        console.log(`[Test Setup] Extension configured with mock server: ${mockServerUrl}`);
      } catch (error) {
        console.warn('[Test Setup] Failed to configure extension:', error);
      } finally {
        await page.close();
      }
    }

    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const ctx = context as ExtensionBrowserContext;
    if (!ctx._extensionId) {
      throw new Error('Extension ID not found on context');
    }
    await use(ctx._extensionId);
  },
});

export const expect = test.expect;