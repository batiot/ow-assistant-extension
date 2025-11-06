# Tasks

## Implementation Order

Tasks are organized to build incrementally from infrastructure to complete tests.

1. **Create Mock OpenWebUI Server**
   - [ ] Create `test/e2e/utils/mock-server.ts` file
   - [ ] Implement HTTP server setup with dynamic port allocation
   - [ ] Add cookie-parser middleware for token extraction
   - [ ] Add OAuth login endpoint (`/oauth/microsoft/login`) with auto-redirect HTML
   - [ ] Add OAuth callback endpoint (`/oauth/microsoft/callback`) with `code` parameter
   - [ ] Implement `Set-Cookie` header with JWT token in callback response
   - [ ] Add token validation endpoint (`/api/v1/auths/`) supporting both Bearer and cookie auth
   - [ ] Implement token response in `/api/v1/auths/` when cookie is present
   - [ ] Implement error mode configuration (none, network, invalid_token, server_error)
   - [ ] Add request logging for debugging
   - [ ] Add server start/stop methods with proper cleanup

2. **Create Authentication Test Helpers**
   - [ ] Create `test/e2e/utils/auth-helper.ts` file
   - [ ] Implement `AuthTestHelper` class constructor
   - [ ] Add `openPopup()` method to open extension popup
   - [ ] Add `clickLogin()` method to trigger login flow
   - [ ] Add `waitForAuthComplete()` method to wait for OAuth completion
   - [ ] Add `waitForCallbackWithCookie()` method to detect callback with Set-Cookie
   - [ ] Add `extractTokenFromCookie()` helper to inspect cookies
   - [ ] Add `clickLogout()` method to trigger logout
   - [ ] Add `verifyAuthenticatedState()` method with assertions
   - [ ] Add `verifyUnauthenticatedState()` method with assertions
   - [ ] Add `getStoredToken()` method to inspect chrome.storage
   - [ ] Add `openSidepanel()` method for sidepanel tests

3. **Update Playwright Configuration**
   - [ ] Update `playwright.config.ts` to include global setup/teardown hooks
   - [ ] Create `test/e2e/global-setup.ts` to start mock server
   - [ ] Create `test/e2e/global-teardown.ts` to stop mock server
   - [ ] Add environment variable configuration for mock server URL
   - [ ] Store mock server port in global state
   - [ ] Ensure proper cleanup on test failures

4. **Update Build Configuration for Tests**
   - [ ] Update `vite.config.ts` to read mock server URL from environment
   - [ ] Ensure test build includes configuration for mock server
   - [ ] Add `VITE_OPENWEBUI_BASE_URL` environment variable support
   - [ ] Verify ConfigManager can read test configuration
   - [ ] Test that extension initializes with mock server URL

5. **Implement Complete Login Flow Test**
   - [ ] Replace placeholder test in `auth.e2e.ts` with real implementation
   - [ ] Add test setup with mock server initialization
   - [ ] Implement login button click and OAuth window detection
   - [ ] Add assertions for OAuth popup window creation
   - [ ] Wait for OAuth callback URL to be loaded with `code` parameter
   - [ ] Verify Set-Cookie header is present in callback response
   - [ ] Verify token extraction from cookie (not URL parameter)
   - [ ] Check token is stored in chrome.storage.session
   - [ ] Assert user profile is displayed with correct data
   - [ ] Verify login button is hidden and logout button is visible
   - [ ] Add cleanup to close any open windows

6. **Implement Logout Flow Test**
   - [ ] Create test that starts with authenticated state
   - [ ] Click logout button in extension popup
   - [ ] Wait for logout to complete
   - [ ] Verify token is removed from chrome.storage
   - [ ] Assert user profile is hidden
   - [ ] Check login button is visible and logout button is hidden
   - [ ] Verify auth state is properly reset

7. **Implement State Persistence Test**
   - [ ] Authenticate user in test setup
   - [ ] Close extension popup
   - [ ] Reopen extension popup
   - [ ] Verify authenticated state is immediately restored
   - [ ] Assert user profile is displayed without re-authentication
   - [ ] Check token is still present in storage
   - [ ] Verify no additional network requests are made

8. **Implement State Synchronization Test**
   - [ ] Open both popup and sidepanel in test setup
   - [ ] Trigger login from popup
   - [ ] Wait for authentication to complete
   - [ ] Verify sidepanel reflects authenticated state automatically
   - [ ] Trigger logout from sidepanel
   - [ ] Verify popup reflects unauthenticated state automatically
   - [ ] Assert no manual refresh is needed
   - [ ] Test broadcast message mechanism

9. **Implement Error Handling Tests**
   - [ ] Create test for network failure during login
   - [ ] Set mock server to error mode before login attempt
   - [ ] Verify error message is displayed to user
   - [ ] Check retry button is available
   - [ ] Assert no partial auth state (clean failure)
   - [ ] Create test for invalid token (401 response)
   - [ ] Set mock server to return 401 on token validation
   - [ ] Verify error handling and re-authentication prompt
   - [ ] Create test for server error (500 response)
   - [ ] Verify appropriate error message and user guidance
   - [ ] Create test for OAuth timeout scenario
   - [ ] Verify timeout error handling

10. **Add Token Expiration Test**
    - [ ] Authenticate user with valid token
    - [ ] Configure mock server to reject token as expired
    - [ ] Make API request that triggers token validation
    - [ ] Verify 401 response triggers re-authentication flow
    - [ ] Check user is prompted to log in again
    - [ ] Ensure old token is cleared from storage

11. **Update Package Dependencies**
    - [ ] Check if additional packages are needed (express, cookie-parser, cors)
    - [ ] Add dependencies to package.json if required (likely need express and cookie-parser)
    - [ ] Update package-lock.json
    - [ ] Verify dependencies install correctly in CI

12. **Documentation and Cleanup**
    - [ ] Update README with E2E test information
    - [ ] Document mock server architecture in comments
    - [ ] Add JSDoc comments to test helper methods
    - [ ] Update test/e2e/README.md with auth test examples
    - [ ] Document how to run auth tests in isolation
    - [ ] Add troubleshooting guide for common test failures

13. **Validation and CI Integration**
    - [ ] Run all auth tests locally and verify they pass
    - [ ] Test in CI environment
    - [ ] Verify tests are reliable (run 10 times, all pass)
    - [ ] Check test execution time is reasonable (<2 minutes)
    - [ ] Ensure proper cleanup (no leaked processes or files)
    - [ ] Add test coverage reporting if applicable

## Dependencies

- Task 1 (Mock Server) must complete before Task 5-10 (all test implementations)
- Task 2 (Test Helpers) must complete before Task 5-10
- Task 3 (Playwright Config) must complete before any tests run
- Task 4 (Build Config) must complete before tests run
- Tasks 5-10 can be implemented in parallel after Tasks 1-4 complete
- Task 11 can be done early or as dependencies are identified
- Task 12-13 should be done last

## Validation Criteria

- [ ] Mock server starts and stops cleanly without errors
- [ ] All OAuth endpoints return expected responses
- [ ] Complete login flow test passes consistently
- [ ] Logout properly clears all auth state
- [ ] State persists correctly across popup reopens
- [ ] Popup and sidepanel states are synchronized
- [ ] All error scenarios are handled gracefully
- [ ] Tests run successfully in CI
- [ ] No flaky tests (100% pass rate over 10 runs)
- [ ] Test suite completes in under 2 minutes
- [ ] Documentation is complete and accurate
