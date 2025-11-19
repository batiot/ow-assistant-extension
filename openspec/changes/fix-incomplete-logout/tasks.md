## 1. Implementation

- [x] 1.1 Modify `AuthService.logout()` in `src/auth/service.ts`
  - After calling backend signout endpoint
  - Add `chrome.cookies.remove()` call to remove the `token` cookie from main browser profile
  - Ensure cleanup happens in the "always clear local state" section (after line 371)
  - Parameters: `{ url: this.config.baseUrl, name: 'token' }`

- [x] 1.2 Update unit tests in `test/unit/auth/service-extended.test.ts`
  - Add mock for `chrome.cookies.remove` in test setup
  - Verify `chrome.cookies.remove` is called with correct parameters during logout
  - Verify cookie removal happens even when server logout fails
  - Verify cookie removal happens when no valid token exists

- [x] 1.3 Update E2E tests in `test/e2e/auth.e2e.ts`
  - Add verification that cookie is removed after logout
  - Add test case: logout with browser tab open should not re-authenticate
  - Ensure no automatic re-authentication occurs after logout

## 2. Verification

- [x] 2.1 Run unit tests
  - Command: `npm run test:unit -- test/unit/auth/service-extended.test.ts`
  - Verify all logout tests pass
  - Verify new cookie removal assertions pass

- [ ] 2.2 Run E2E tests
  - Command: `npm run test:e2e -- test/e2e/auth.e2e.ts`
  - Verify logout flow tests pass
  - Verify no re-authentication after logout
  - Note: E2E tests currently skipped, will run when unskipped

- [ ] 2.3 Manual verification
  - Load extension in browser
  - Open `http://localhost:8080` in a browser tab and login
  - Open extension popup - should auto-authenticate from browser session
  - Click logout in extension
  - Verify extension shows login button (logged out)
  - Verify browser tab session is still active (can use OpenWebUI)
  - Close and reopen extension popup
  - Verify extension does NOT auto-authenticate (stays logged out)
  - Verify browser tab session is still active
