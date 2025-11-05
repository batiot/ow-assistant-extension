# Add E2E Authentication Tests with Mock OpenWebUI Server

## Why

The extension has authentication infrastructure integrated with UI, but lacks comprehensive E2E tests that validate the complete authentication flow. The existing `auth.e2e.ts` file contains only structural tests that verify UI elements exist, with a comment noting "Full OAuth flow testing requires mock server or test environment."

Without E2E tests that exercise the full authentication flow, we cannot:
- Verify the OAuth popup window creation and callback handling work correctly
- Ensure token storage and retrieval across extension contexts is reliable
- Test error scenarios (network failures, invalid tokens, 401 responses)
- Validate state synchronization between popup and sidepanel
- Catch regressions in the authentication flow before production

This change adds comprehensive E2E tests with a mock OpenWebUI server that simulates the OAuth flow, token validation, and API endpoints, enabling reliable automated testing of the authentication system.

## What Changes

### Mock OpenWebUI Server
- **ADDED** HTTP server that mimics OpenWebUI endpoints
- **ADDED** OAuth Microsoft login endpoint (`/oauth/microsoft/login`)
- **ADDED** OAuth callback endpoint (`/oauth/microsoft/callback`) with `code` parameter and `Set-Cookie` token
- **ADDED** Token validation endpoint (`/api/v1/auths/`) supporting both Bearer token and cookie authentication
- **ADDED** Cookie parser middleware for token extraction
- **ADDED** Configurable responses for success/error scenarios
- **ADDED** Request logging for debugging test failures

### E2E Test Infrastructure
- **MODIFIED** `playwright.config.ts` to support mock server startup
- **ADDED** Test fixtures for mock server lifecycle management
- **ADDED** Helper utilities for authentication test scenarios
- **ADDED** Configuration injection for tests to use mock server URL

### Comprehensive Authentication Tests
- **MODIFIED** `test/e2e/auth.e2e.ts` to implement full OAuth flow tests
- **ADDED** Complete login flow test (popup → OAuth → callback with Set-Cookie → token extraction → storage)
- **ADDED** Cookie-based token extraction test
- **ADDED** Logout flow test with state cleanup verification
- **ADDED** State persistence test across popup reopens
- **ADDED** State synchronization test between popup and sidepanel
- **ADDED** Error handling tests (network failures, invalid tokens, 401 responses)
- **ADDED** Token expiration and refresh scenario tests
- **ADDED** Dual authentication mode test (Bearer token vs cookie)

### Test Utilities
- **ADDED** `MockOpenWebUIServer` class for server management
- **ADDED** Cookie handling middleware for token extraction
- **ADDED** Authentication helper methods (login, logout, verify state)
- **ADDED** Token generation utilities with JWT-like format for test scenarios
- **ADDED** Cookie inspection utilities for debugging
- **ADDED** Request interceptor utilities for network testing

## Impact

### Affected Specs
- `testing` - Extends E2E testing requirements with authentication scenarios

### Affected Code
- `test/e2e/auth.e2e.ts` - Implements comprehensive auth tests
- `test/e2e/utils/mock-server.ts` - New mock OpenWebUI server
- `test/e2e/utils/auth-helper.ts` - New authentication test helpers
- `playwright.config.ts` - Add mock server configuration
- `package.json` - May need additional dependencies (express, cors)

### Breaking Changes
None - this is additive testing infrastructure

## Non-Goals

- Testing with real Microsoft OAuth (use mock OAuth flow)
- Load testing or performance benchmarking
- Unit tests for auth module (those should be separate)
- Integration tests with real OpenWebUI backend
- Testing chat/completion API flows (focus on auth only)
- Cross-browser testing (Chromium only for extension)

## Dependencies

- Node.js HTTP server with cookie support (express recommended for cookie-parser)
- Playwright test framework (already installed)
- Extension build must complete before tests run (already configured)
- Cookie parsing middleware (cookie-parser for express)

## Success Criteria

- [ ] Mock server starts/stops cleanly before/after tests
- [ ] Complete login flow test passes with mock OAuth
- [ ] Logout clears tokens and resets UI state
- [ ] State persists across popup reopens
- [ ] Popup and sidepanel show synchronized auth state
- [ ] Error scenarios are properly handled and displayed
- [ ] Tests are reliable (no flakiness) and run in CI
- [ ] Test execution time remains reasonable (<2 minutes for auth suite)
