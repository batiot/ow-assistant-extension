import { test, expect } from './utils/test-utils';

test('extension loads successfully', async ({ context, extensionId }) => {
  // Verify we get a valid extension ID
  expect(extensionId).toBeDefined();
  expect(extensionId.length).toBe(32);

  // Open extension popup
  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl);

  // Wait for popup content to load
  await popupPage.waitForSelector('body');
  
  // Page should be accessible
  const title = await popupPage.title();
  expect(title).toBeTruthy();
});