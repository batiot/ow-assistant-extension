<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# as a edge extension devvelloper with CRXJS. How add an e2E playwright test. Installing the extensions and checking is porper installatin

As an Edge extension developer using CRXJS, you can add end-to-end Playwright tests by setting up a persistent browser context with your extension loaded, then verifying installation through the service worker.[^1][^2]

## Installation and Setup

First, install Playwright in your project:[^3]

```bash
npm init playwright@latest
```

Configure your `playwright.config.ts` to use only Chromium since Edge extensions work with Chromium-based browsers:[^3]

```typescript
projects: [{
  name: "chromium",
  use: {
    ...devices["Desktop Chrome"],
  },
}]
```


## Create Test Fixtures

Create a fixtures file (e.g., `tests/fixtures.ts`) that loads your extension and retrieves its ID:[^2]

```typescript
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ }, use) => {
    // CRXJS typically builds to 'dist' directory
    const pathToExtension = path.join(__dirname, '../dist');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
    });
    await use(context);
    await context.close();
  },
  
  extensionId: async ({ context }, use) => {
    // Wait for service worker to verify extension loaded properly
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[^2];
    await use(extensionId);
  },
});

export const expect = test.expect;
```


## Verifying Proper Installation

The extension ID fixture automatically verifies installation by waiting for the service worker to load. If the service worker doesn't load, the test will timeout, indicating installation failed.[^4][^5][^2]

For additional verification, add a test that checks the service worker exists:[^2]

```typescript
import { test, expect } from './fixtures';

test('extension loads successfully', async ({ context, extensionId }) => {
  // Verify service worker is running
  const serviceWorkers = context.serviceWorkers();
  expect(serviceWorkers.length).toBeGreaterThan(0);
  
  // Verify extension ID is valid
  expect(extensionId).toMatch(/^[a-z]{32}$/);
});
```


## Writing Extension Tests

Test your popup page directly:[^2]

```typescript
test('popup page loads', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('body')).toBeVisible();
  // Add your specific popup assertions here
});
```

Test content scripts on web pages:[^3]

```typescript
test('content script modifies page', async ({ page }) => {
  await page.goto('https://example.com');
  // Verify your content script made expected changes
  await expect(page.locator('.injected-by-extension')).toBeVisible();
});
```


## CRXJS-Specific Considerations

Build your extension before running tests. Add a build script to your test setup:[^1]

```typescript
// global-setup.ts
import { execSync } from 'child_process';

export default function globalSetup() {
  console.log('Building extension with CRXJS...');
  execSync('npm run build', { stdio: 'inherit' });
}
```

Reference this in your `playwright.config.ts`:[^1]

```typescript
export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  // ... rest of config
});
```


## Headless Testing

For CI/CD pipelines, you can run tests in headless mode using the Chromium channel:[^3][^2]

```bash
npx playwright test
```

The `channel: 'chromium'` option in your fixtures enables headless extension testing, which isn't available in standard Chrome.[^2]

## Important Notes

Google Chrome and Microsoft Edge removed command-line flags needed to side-load extensions, so you must use Chromium bundled with Playwright for testing. Your extension must have a background service worker in the manifest for the extension ID retrieval to work.[^4][^2]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/crxjs/chrome-extension-tools/discussions/523

[^2]: https://playwright.dev/docs/chrome-extensions

[^3]: https://railsware.com/blog/test-chrome-extensions/

[^4]: https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template

[^5]: https://playwright.dev/python/docs/chrome-extensions

[^6]: https://learn.microsoft.com/en-us/microsoft-edge/playwright/

[^7]: https://playwright.dev/docs/browsers

[^8]: https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl

[^9]: https://testingbot.com/support/web-automate/playwright/browser-extension-testing

[^10]: https://vinothqaacademy.com/docs/playwright-vs-code-extension-installation-and-execution/

[^11]: https://www.browserstack.com/guide/end-to-end-testing-using-playwright

[^12]: https://stackoverflow.com/questions/72100106/playwright-vscode-gives-no-tests-found-message

[^13]: https://stackoverflow.com/questions/6373117/how-to-get-my-extensions-id-from-javascript

[^14]: https://www.reddit.com/r/Playwright/comments/1dk8l2p/add_extension_or_chrome_profile_to_test_browser/

[^15]: https://ray.run/discord-forum/threads/59611-test-service-worker-in-chrome-extension-with-playwright

[^16]: https://github.com/microsoft/playwright/issues/5586

[^17]: https://github.com/microsoft/playwright/issues/35554

[^18]: https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing

