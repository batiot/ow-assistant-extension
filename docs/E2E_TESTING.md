# E2E Testing Guide

## Overview

This document describes the End-to-End (E2E) testing approach for the OpenWebUI Assistant extension, including the testing infrastructure, common patterns, and troubleshooting guide.

## Test Infrastructure

### Headless Chrome with Extension Support

The test setup uses Playwright's `chromium.launchPersistentContext` with the `--headless=new` flag to enable extension loading in headless mode. This is critical for CI/CD environments without display servers (like Docker containers, GitHub Actions, etc.).

#### Why `--headless=new`?

- **Old headless mode (`--headless`)**: Doesn't support Chrome extensions
- **New headless mode (`--headless=new`)**: Full Chrome feature parity, including extensions
- **Automatic detection**: Tests detect if running in CI or without `$DISPLAY` and enable headless mode automatically

### Implementation

```typescript
// test/e2e/utils/test-utils.ts

// Detect headless environment
const shouldHeadless = Boolean(process.env.CI) || !process.env.DISPLAY;
const headlessArgs = shouldHeadless ? ['--headless=new'] : [];

// Launch persistent context with extension
const context = await chromium.launchPersistentContext(chromeDataDir, {
  headless: shouldHeadless,
  channel: 'chromium',  // Use Playwright's bundled Chromium
  ignoreDefaultArgs: [
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',  // Must remove these to allow extensions
  ],
  args: [
    ...headlessArgs,
    '--no-sandbox',  // Required for Docker/CI
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
  ],
});
```

### Extension ID Detection

Chrome assigns a random ID to unpacked extensions. Tests must discover this ID before navigating to extension pages.

#### Strategy

Poll for the extension ID from:
1. **Service workers** (Manifest V3) - Primary method
2. **Background pages** (Manifest V2) - Fallback

```typescript
const waitForExtensionId = async (timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    // Check service workers (MV3)
    const sw = context.serviceWorkers().find(w => 
      w.url().startsWith('chrome-extension://')
    );
    if (sw) {
      const match = sw.url().match(/^chrome-extension:\/\/([^\/]+)/);
      if (match && match[1]) return match[1];
    }
    
    // Check background pages (MV2)
    const bg = context.backgroundPages().find(p => 
      p.url().startsWith('chrome-extension://')
    );
    if (bg) {
      const parts = bg.url().split('/');
      if (parts[2]) return parts[2];
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  return undefined;
};
```

#### Why Polling?

- Extension initialization is asynchronous
- Service worker may take time to start
- No synchronous API to get extension ID
- Timeout prevents infinite waiting

### Test Fixtures

Custom Playwright fixtures provide `context` and `extensionId` to all tests:

```typescript
export const test = base.extend<TestFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(/*...*/);
    const extensionId = await waitForExtensionId(30000);
    
    if (!extensionId) {
      await context.close();
      throw new Error('Could not determine extension ID');
    }
    
    (context as ExtensionBrowserContext)._extensionId = extensionId;
    await use(context);
    await context.close();
  },
  
  extensionId: async ({ context }, use) => {
    const id = (context as ExtensionBrowserContext)._extensionId;
    if (!id) throw new Error('Extension ID not available');
    await use(id);
  },
});
```

### Usage in Tests

```typescript
import { test, expect } from './utils/test-utils';

test('should load options page', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  
  await expect(page.locator('h1')).toContainText('Settings');
});
```

## Common Patterns

### Opening Extension Pages

```typescript
// Options page
await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

// Popup
await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

// Sidepanel
await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
```

### Waiting for Elements

```typescript
// Wait for specific selector
await page.waitForSelector('.settings-section', { timeout: 5000 });

// Wait for visibility
await expect(page.locator('button.save-button')).toBeVisible();

// Wait for specific state
await expect(page.locator('input[type="radio"][value="dark"]')).toBeChecked();
```

### Testing Storage Persistence

```typescript
// Make changes
await page.locator('input[type="radio"][value="dark"]').click();
await page.locator('button.save-button').click();
await expect(page.locator('.success-banner')).toBeVisible();

// Reload page
await page.reload();
await page.waitForSelector('.theme-selector');

// Verify persistence
await expect(page.locator('input[type="radio"][value="dark"]')).toBeChecked();
```

### Testing Cross-Context Sync

```typescript
// Change in options page
const optionsPage = await context.newPage();
await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
await optionsPage.locator('input[type="radio"][value="dark"]').click();
await optionsPage.locator('button.save-button').click();

// Verify in popup
const popupPage = await context.newPage();
await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
const theme = await popupPage.evaluate(() => 
  document.documentElement.getAttribute('data-theme')
);
expect(theme).toBe('dark');
```

## Implementation Bugs Found During Testing

### Bug 1: Incorrect `useState` Usage for Settings Sync

**Problem:**
```typescript
// WRONG: useState called inside component body without useEffect
useState(() => {
  setFormData(settings);
});
```

This doesn't sync form data when settings change from the context.

**Fix:**
```typescript
// CORRECT: useEffect watches settings and updates form data
useEffect(() => {
  setFormData(settings);
}, [settings]);
```

**Impact:** Settings wouldn't reflect in the form when loaded from storage or changed in another context.

### Bug 2: Save Button Always Enabled

**Problem:**
The `hasChanges` variable correctly computed whether form data differed from settings, but the save button wasn't properly disabled when no changes were made.

**Root Cause:**
The `formData` state wasn't initializing correctly because settings weren't loaded yet when the component first rendered.

**Fix:**
The `useEffect` fix from Bug 1 also resolves this issue by ensuring `formData` syncs with `settings` after they load.

### Bug 3: Reset Message Inconsistency

**Problem:**
Reset success message said "Settings reset to defaults" but tests expected "Settings have been reset to defaults" (with "have been" for proper grammar).

**Fix:**
```typescript
setSaveMessage('Settings have been reset to defaults');
```

### Bug 4: Missing Save Message on Reset

**Problem:**
Reset function didn't clear previous save messages before showing the reset message.

**Fix:**
```typescript
setSaveMessage(null);  // Clear previous messages
await resetSettings();
setSaveMessage('Settings have been reset to defaults');
```

## Test Results

### Current Status

**After Fixes:**
- ✅ 8 tests passing
- ❌ 6 tests failing (persistence and state management issues remain)

### Passing Tests
1. ✅ Should open options page from extension context
2. ✅ Should display all settings sections
3. ✅ Should display theme selector with all options
4. ✅ Should accept valid instance URL
5. ✅ Should validate instance URL - empty not allowed
6. ✅ Should validate instance URL - invalid format
7. ✅ Should validate instance URL - non-http protocol
8. ✅ Should apply light theme immediately

### Failing Tests

#### 1. Theme Persistence After Reload
**Test:** `should change theme and persist`
**Issue:** Save button remains disabled after selecting theme
**Root Cause:** Form state update timing or storage not persisting

#### 2. Language Persistence
**Test:** `should apply dark theme immediately` (misnamed - actually tests language)
**Issue:** Language selection doesn't persist after reload
**Root Cause:** Same as theme persistence

#### 3. Settings Reload Persistence
**Test:** `should preserve settings on page reload`
**Issue:** Settings revert to defaults after reload
**Root Cause:** Storage operations may not complete before reload

#### 4. Reset Confirmation
**Test:** `should show reset confirmation and reset to defaults`
**Issue:** Save button disabled - can't save changes before reset
**Root Cause:** Related to Bug 1 - form state not updating

#### 5. Save Button State Management
**Test:** `should disable save button when no changes`
**Issue:** Save button is enabled on initial load when it shouldn't be
**Root Cause:** `hasChanges` calculation issue or form data initialization

#### 6. Cross-Context Sync
**Test:** `should sync settings across popup and options page`
**Issue:** Wrong CSS class - expects `.success-message`, code has `.success-banner`
**Fix Required:** Update test to use `.success-banner` or update code to use `.success-message`

## Debugging Tips

### View Test Output

```bash
# Run with headed mode (if you have a display)
unset CI
export DISPLAY=:0
npm run test:e2e

# View last test report
npm run test:e2e:report

# Debug specific test
npx playwright test --grep "test name" --debug
```

### Common Issues

#### Extension Doesn't Load
**Symptoms:** "Could not determine extension ID" error
**Solutions:**
- Check `dist/` directory exists and has `manifest.json`
- Run `npm run build:test` before testing
- Check manifest.json is valid
- Look for service worker errors in browser console

#### Tests Timeout
**Symptoms:** "Timeout 30000ms exceeded"
**Solutions:**
- Increase timeout: `test.setTimeout(60000)`
- Add wait statements: `await page.waitForSelector()`
- Check if element exists: `await page.locator().count()`
- Check browser console for JavaScript errors

#### Storage Not Persisting
**Symptoms:** Settings revert after reload
**Solutions:**
- Check `chrome.storage.sync` and `chrome.storage.local` permissions in manifest
- Verify storage keys are consistent
- Check if storage operations complete before navigation
- Use `await` on all storage operations

#### Wrong Element Located
**Symptoms:** Test can't find element or finds wrong one
**Solutions:**
- Use specific selectors: `button.save-button` not just `button`
- Check selector in DevTools: `$$('your-selector')`
- Wait for element: `await page.waitForSelector()`
- Use `page.locator().count()` to verify element exists

### Diagnostic Logging

Add to tests:
```typescript
// Log page content
console.log(await page.content());

// Log specific element
const button = page.locator('button.save-button');
console.log(await button.getAttribute('disabled'));
console.log(await button.textContent());

// Log storage state
const storage = await page.evaluate(() => 
  chrome.storage.sync.get(null)
);
console.log('Storage:', storage);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Build extension
        run: npm run build:test
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Environment Variables

- `CI=true` - Enables headless mode automatically
- `DISPLAY` - If set and not in CI, runs headed mode
- `MOCK_SERVER_URL` - Set by global-setup.ts for test server

## Next Steps

### Immediate Fixes Needed

1. **Fix Storage Persistence**
   - Ensure `chrome.storage.sync.set()` completes before page reloads
   - Add error handling for storage operations
   - Verify storage permissions in manifest

2. **Fix State Management**
   - Debug why `hasChanges` isn't detecting theme changes immediately
   - Consider using `useCallback` for memoization
   - Add logging to track state updates

3. **CSS Class Consistency**
   - Standardize on `.success-banner` or `.success-message`
   - Update all tests and code to match

4. **Test Improvements**
   - Rename "should apply dark theme immediately" to reflect actual test (language)
   - Add explicit waits before assertions
   - Add retry logic for flaky assertions

### Future Enhancements

- Visual regression testing with Percy or similar
- Performance testing (page load times, interaction responsiveness)
- Accessibility testing with axe-core
- Cross-browser testing (Firefox, Edge)
- Network condition testing (slow 3G, offline)
- Test coverage reporting

## References

- [Playwright Documentation](https://playwright.dev/)
- [Chrome Extensions Testing](https://developer.chrome.com/docs/extensions/mv3/testing/)
- [Headless Chrome](https://developer.chrome.com/blog/headless-chrome/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
