/**
 * Playwright Global Setup
 * 
 * Starts the mock OpenWebUI server before running E2E tests.
 */

import { FullConfig } from '@playwright/test';
import { MockOpenWebUIServer } from './utils/mock-server';

let mockServer: MockOpenWebUIServer;

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting mock OpenWebUI server...');
  
  mockServer = new MockOpenWebUIServer();
  await mockServer.start();
  
  const baseUrl = mockServer.getBaseUrl();
  console.log(`✅ Mock server started at ${baseUrl}`);
  
  // Store server info in process.env for tests to access
  process.env.MOCK_SERVER_URL = baseUrl;
  process.env.MOCK_SERVER_PORT = mockServer.getPort().toString();
  
  // Also store the server instance globally for teardown
  (global as any).__MOCK_SERVER__ = mockServer;
  
  return () => {
    // This function is called if setup is interrupted
    console.log('⚠️  Setup interrupted, stopping mock server...');
    return mockServer.stop();
  };
}

export default globalSetup;
