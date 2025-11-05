/**
 * Playwright Global Teardown
 * 
 * Stops the mock OpenWebUI server after running E2E tests.
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🛑 Stopping mock OpenWebUI server...');
  
  // Retrieve the server instance from global
  const mockServer = (global as any).__MOCK_SERVER__;
  
  if (mockServer) {
    await mockServer.stop();
    console.log('✅ Mock server stopped');
  } else {
    console.log('⚠️  No mock server found to stop');
  }
  
  // Clean up environment variables
  delete process.env.MOCK_SERVER_URL;
  delete process.env.MOCK_SERVER_PORT;
  delete (global as any).__MOCK_SERVER__;
}

export default globalTeardown;
