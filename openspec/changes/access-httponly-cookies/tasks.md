# Implementation Tasks

## Task List

- [x] Add `getTokenCookie()` helper method to `src/auth/service.ts`
  - Create private async method that accepts no parameters (uses this.config.baseUrl)
  - Call `chrome.cookies.get({ url: this.config.baseUrl, name: "token" })`
  - Return cookie.value if found, null otherwise
  - Add try-catch with console.warn for errors
  - Add JSDoc explaining privileged access to HttpOnly cookies

- [x] Update `checkSessionAuth()` method in `src/auth/service.ts`
  - Call `getTokenCookie()` before making API request
  - If no cookie found, log and return null (don't make request)
  - If cookie found, include it in `Cookie` header: `Cookie: token=${tokenValue}`
  - Remove `credentials: 'include'` (doesn't work in extension context)
  - Update JSDoc to explain explicit cookie sending requirement
  - Add comment explaining why credentials: 'include' doesn't work

- [x] Update `extractTokenFromCallback()` method in `src/auth/service.ts`
  - Replace `chrome.cookies.getAll()` with call to `getTokenCookie()`
  - Remove array handling (getAll returns array, get returns single or null)
  - Keep separate `chrome.cookies.get()` call to get full cookie for expirationDate
  - Simplify error handling with clearer null check
  - Update JSDoc comments

- [x] Update existing auth spec in `openspec/specs/auth/spec.md`
  - Remove or update scenarios that incorrectly assume `credentials: 'include'` works
  - Update "HTTP-Only Cookie Limitation" scenario to explain extension context issue
  - Update "Session-Based Authentication Detection" scenarios with new approach
  - Reference that cookies must be explicitly read and sent in extensions

- [x] Add unit tests for cookie helper in `test/unit/auth/`
  - Mock `chrome.cookies.get()` to return test cookie
  - Test successful cookie retrieval returns value
  - Test missing cookie returns null
  - Test error handling (rejected promise)
  - Test with different baseUrl values

- [x] Update unit tests for `checkSessionAuth()`
  - Mock `getTokenCookie()` to return test token
  - Verify `Cookie` header is set correctly in fetch call
  - Verify no request made when getTokenCookie returns null
  - Test successful session check with cookie header
  - Test 401 response handling

- [x] Update unit tests for `extractTokenFromCallback()`
  - Update mocks for new implementation (get instead of getAll)
  - Test successful token extraction
  - Test missing cookie error
  - Test expiration calculation

- [x] Add E2E test for session detection with HttpOnly cookie
  - Set up test server with HttpOnly, Secure, SameSite=Strict cookie
  - Verify extension reads cookie via chrome.cookies.get()
  - Verify cookie is sent in Cookie header to /api/v1/auths/
  - Verify session detection succeeds
  - Confirm authentication state updates correctly

- [ ] Manual testing checklist
  - Clear all cookies and storage
  - Login via OAuth and verify cookie extraction works
  - Close extension popup and reopen - verify session detection works
  - Check browser DevTools Network tab: verify Cookie header is sent
  - Test with localhost backend (http://localhost:8080)
  - Verify no errors in browser console

## Dependencies
- None (all required permissions already in manifest)

## Validation
- All unit tests pass for cookie extraction and session check
- E2E test confirms HttpOnly cookie authentication works
- E2E test confirms session detection with explicit cookie header works
- No regression in existing auth flows
- Manual testing confirms both localhost and production scenarios work
