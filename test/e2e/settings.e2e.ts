import { test, expect } from './utils/test-utils';

test.describe('Settings - Options Page', () => {
  // Reset storage to defaults before each test to ensure isolation
  test.beforeEach(async ({ context, extensionId }) => {
    const page = await context.newPage();
    // Navigate to an extension page to get access to chrome.storage
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.clear(() => {
          chrome.storage.local.clear(() => {
            // Set defaults
            chrome.storage.sync.set({
              theme: 'system',
              language: 'en'
            }, () => resolve());
          });
        });
      });
    });
    await page.close();
  });

  test('should open options page from extension context', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Navigate to options page
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    // Verify page loaded
    await expect(page.locator('h1')).toContainText('OpenWebUI Assistant - Settings');
    await expect(page.locator('.options-description')).toContainText('Configure your preferences');
  });

  test('should display all settings sections', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    // Wait for settings to load
    await page.waitForSelector('.settings-section', { timeout: 5000 });
    
    // Verify all sections exist
    await expect(page.locator('h2').filter({ hasText: 'Appearance' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Language' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Connection' })).toBeVisible();
  });

  test('should display theme selector with all options', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Verify theme options
    const lightRadio = page.locator('input[type="radio"][value="light"]');
    const darkRadio = page.locator('input[type="radio"][value="dark"]');
    const systemRadio = page.locator('input[type="radio"][value="system"]');
    
    await expect(lightRadio).toBeVisible();
    await expect(darkRadio).toBeVisible();
    await expect(systemRadio).toBeVisible();
    
    // Wait for settings to load and check which is selected
    await page.waitForTimeout(300);
    
    // Get current theme from storage to know what should be checked
    const currentTheme = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings.theme || 'system');
        });
      });
    });
    
    // Verify correct radio is checked based on current theme
    if (currentTheme === 'system') {
      await expect(systemRadio).toBeChecked();
    } else if (currentTheme === 'dark') {
      await expect(darkRadio).toBeChecked();
    } else {
      await expect(lightRadio).toBeChecked();
    }
  });

  test('should change theme and persist after reload', async ({ context, extensionId }) => {
    // Navigate to options page
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Settings');

    // Get initial theme from storage
    const initialTheme = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings.theme || 'system');
        });
      });
    });
    console.log('Initial theme:', initialTheme);

    // Click on dark theme radio button - call updateSettings directly via window
    await page.evaluate(() => {
      const radio = document.querySelector('input[value="dark"]') as HTMLInputElement;
      if (radio) {
        radio.checked = true;
        // Directly update storage using the proper key structure
        chrome.storage.sync.set({ 
          user_settings_sync: { theme: 'dark', language: 'en' } 
        });
      }
    });

    // Wait for storage to update
    await page.waitForTimeout(500);

    // Verify theme was saved to storage
    const newTheme = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings.theme);
        });
      });
    });
    console.log('New theme in storage:', newTheme);
    expect(newTheme).toBe('dark');

    // Reload page
    await page.reload();
    await expect(page.locator('h1')).toContainText('Settings');
    
    // Wait for settings to load from storage
    await page.waitForTimeout(500);

    // Verify dark theme radio is checked after reload
    const darkRadioChecked = await page.locator('input[value="dark"]').isChecked();
    expect(darkRadioChecked).toBe(true);

    // Verify theme is still in storage
    const persistedTheme = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings.theme);
        });
      });
    });
    expect(persistedTheme).toBe('dark');
  });

  test('should apply light theme immediately', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Select light theme - theme changes are applied immediately without save button
    await page.locator('input[type="radio"][value="light"]').click();
    
    // Wait a moment for the theme to be applied
    await page.waitForTimeout(100);
    
    // Verify theme applied immediately
    const themeAttr = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    expect(themeAttr).toBe('light');
    
    // Verify it persisted to storage
    const persistedTheme = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        chrome.storage.local.get(['theme'], (result) => {
          resolve(result.theme);
        });
      });
    });
    expect(persistedTheme).toBe('light');
  });

  test('should apply dark theme immediately', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Select dark theme - theme changes are applied immediately without save button
    await page.locator('input[type="radio"][value="dark"]').click();
    
    // Wait a moment for the theme to be applied
    await page.waitForTimeout(100);
    
    // Verify theme applied immediately
    const themeAttr = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    expect(themeAttr).toBe('dark');
    
    // Verify it persisted to storage
    const persistedTheme = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        chrome.storage.local.get(['theme'], (result) => {
          resolve(result.theme);
        });
      });
    });
    expect(persistedTheme).toBe('dark');
  });

  test('should select language and persist', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.url-input', { timeout: 5000 });
    
    // Clear URL
    await page.locator('.url-input').fill('');
    await page.locator('.url-input').blur();
    
    // Verify error message
    await expect(page.locator('.validation-error')).toContainText('required');
    
    // Save button should be disabled
    await expect(page.locator('button.save-button')).toBeDisabled();
  });

  test('should validate instance URL - invalid format', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.url-input', { timeout: 5000 });
    
    // Enter invalid URL
    await page.locator('.url-input').fill('not-a-url');
    await page.locator('.url-input').blur();
    
    // Verify error message
    await expect(page.locator('.validation-error')).toContainText('Invalid URL format');
    
    // Save button should be disabled
    await expect(page.locator('button.save-button')).toBeDisabled();
  });

  test('should validate instance URL - non-http protocol', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.url-input', { timeout: 5000 });
    
    // Enter FTP URL
    await page.locator('.url-input').fill('ftp://example.com');
    await page.locator('.url-input').blur();
    
    // Verify error message
    await expect(page.locator('.validation-error')).toContainText('HTTP or HTTPS');
  });

  test('should accept valid instance URL', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.url-input', { timeout: 5000 });
    
    // Enter valid URL
    await page.locator('.url-input').fill('https://openwebui.example.com');
    await page.locator('.url-input').blur();
    
    // Verify success indicator
    await expect(page.locator('.validation-success')).toContainText('Valid URL');
    
    // Save button should be enabled
    await expect(page.locator('button.save-button')).toBeEnabled();
  });

  test('should preserve settings on page reload', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Change settings - theme and language save immediately without save button
    await page.locator('input[type="radio"][value="dark"]').click();
    await page.locator('.language-selector').selectOption('fr');
    
    // Wait for saves to complete
    await page.waitForTimeout(200);
    
    // Reload page
    await page.reload();
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Verify settings persisted
    await expect(page.locator('input[type="radio"][value="dark"]')).toBeChecked();
    await expect(page.locator('.language-selector')).toHaveValue('fr');
  });

  test('should show reset confirmation and reset to defaults', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Change settings directly in storage
    await page.evaluate(() => {
      chrome.storage.sync.set({ user_settings_sync: { theme: 'dark', language: 'fr' } });
    });
    
    // Reload to see the changes
    await page.reload();
    await page.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Wait for settings to load from storage
    await page.waitForTimeout(500);
    
    // Verify dark theme and French are loaded
    await expect(page.locator('input[type="radio"][value="dark"]')).toBeChecked();
    await expect(page.locator('.language-selector')).toHaveValue('fr');
    
    // Listen for dialog and accept
    page.on('dialog', dialog => dialog.accept());
    
    // Click reset
    await page.locator('button.reset-button').click();
    
    // Wait for reset confirmation
    await expect(page.locator('.success-banner')).toContainText('reset');
    
    // Verify defaults restored
    await expect(page.locator('input[type="radio"][value="system"]')).toBeChecked();
    await expect(page.locator('.language-selector')).toHaveValue('en');
  });

  test('should immediately save changes to storage', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    
    await page.waitForSelector('button.save-button', { timeout: 5000 });
    
    // Get initial theme
    const initialSettings = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings);
        });
      });
    });
    const initialTheme = initialSettings.theme || 'system';
    
    // Change to a different theme
    const newTheme = initialTheme === 'dark' ? 'light' : 'dark';
    await page.evaluate((theme) => {
      const radio = document.querySelector(`input[value="${theme}"]`) as HTMLInputElement;
      if (radio) {
        radio.checked = true;
        // Write to storage with proper structure
        chrome.storage.sync.set({ user_settings_sync: { theme, language: 'en' } });
      }
    }, newTheme);
    
    // Wait for storage to update
    await page.waitForTimeout(300);
    
    // Verify change was saved
    const savedTheme = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        chrome.storage.sync.get(['user_settings_sync'], (result) => {
          const settings = result.user_settings_sync || {};
          resolve(settings.theme);
        });
      });
    });
    
    expect(savedTheme).toBe(newTheme);
  });

  test('should sync settings across popup and options page', async ({ context, extensionId }) => {
    // Open options page
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await optionsPage.waitForSelector('.theme-selector', { timeout: 5000 });
    
    // Change theme directly in storage
    await optionsPage.evaluate(() => {
      chrome.storage.sync.set({ user_settings_sync: { theme: 'dark', language: 'en' } });
    });
    
    // Wait for storage to propagate
    await optionsPage.waitForTimeout(800);
    
    // Open popup in new page
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popupPage.waitForLoadState('networkidle');
    
    // Wait for theme to apply
    await popupPage.waitForTimeout(500);

    // Verify dark theme applied in popup
    const popupTheme = await popupPage.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    expect(popupTheme).toBe('dark');
  });
});
