import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['list']
  ],
  globalSetup: './test/e2e/global-setup.ts',
  globalTeardown: './test/e2e/global-teardown.ts',
  use: {
    baseURL: 'chrome-extension://[id]/',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('dist')}`,
            `--load-extension=${path.resolve('dist')}`,
          ],
        },
      },
    },
  ],
  testMatch: '**/*.e2e.ts',
  timeout: 10000,
  globalTimeout: 180000, // 3 minutes max for entire test run (for agent use)
  /* Run your local dev server before starting the tests */
  /* We handle building in the test:e2e script */
});