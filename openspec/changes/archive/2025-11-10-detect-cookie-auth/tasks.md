# Implementation Tasks: Detect Session-Based Authentication

## Prerequisites
- [x] Review current `AuthService` implementation in `src/auth/service.ts`
- [x] Review `/api/v1/auths/` endpoint behavior (returns token in JSON when HTTP-only cookie present)
- [x] Confirm `UserValidationResponse` type includes `token` field in `src/api/types.ts`
- [x] Understand that OpenWebUI uses HTTP-only cookies that cannot be read via `chrome.cookies`

## Implementation Tasks

### Phase 1: Core Session Detection Logic
- [x] Add `checkSessionAuth()` private method to `AuthService` class
  - Calls `GET ${baseUrl}/api/v1/auths/` **without** Authorization header
  - Browser automatically sends HTTP-only `token` cookie with request
  - Returns `AuthToken | null` based on API response
  - On 200 response: Extract `token` from response JSON (response.token)
  - Verify `token_type` is "Bearer" (optional validation)
  - Handle `expires_at: null` as session-based (no client-side expiry)
  - On 401/403: Return null (no session)
  - Handles errors gracefully, returning `null` on failure
  - Logs debug information for troubleshooting

- [x] Update `initialize()` method to check session as fallback
  - First check `TokenStorage.getToken()` (existing behavior)
  - If no stored token or invalid, call `checkSessionAuth()`
  - If API returns 200 with token, extract from `response.token`
  - Extract user info: `id`, `email`, `name`, `role`, `profile_image_url`
  - Create AuthToken with token value and session-based expiration
  - Store token in extension storage
  - Update auth state with complete user info from response
  - Preserve existing error handling and cleanup

- [x] Update `login()` method to check session before OAuth
  - Add session check before determining auth entry point
  - Call `/api/v1/auths/` without auth header
  - If response is 200, extract `response.token` from JSON
  - Extract user info from response
  - Return early (skip OAuth) if session is valid
  - Log successful session authentication with user email
  - Fall through to existing OAuth flow if session check fails (401/403)

### Phase 2: Testing
- [x] Add unit tests for `checkSessionAuth()` method
  - Mock `fetch()` to `/api/v1/auths/` with various responses
  - Test 200 response with complete JSON body (id, email, name, role, token, token_type, expires_at)
  - Test 200 response with `expires_at: null` (session-based)
  - Test 200 response without token field (edge case - should handle gracefully)
  - Test 200 response with `token_type: "Bearer"` validation
  - Test 401 Unauthorized response with `{ "detail": "Unauthorized" }`
  - Test 403 Forbidden (invalid session)
  - Test network errors and timeouts
  - Verify token extraction from response.token field
  - Verify user info extraction (id, email, name, role)

- [x] Add unit tests for updated `initialize()` flow
  - Test storage token takes priority over session check
  - Test session API fallback when storage is empty
  - Test session API fallback when storage token is invalid
  - Test behavior when both storage and session fail

- [x] Add unit tests for updated `login()` flow
  - Test early return when session is valid
  - Test OAuth fallback when no session exists (401 response)
  - Test OAuth fallback when session check fails (network error)

- [x] Add E2E test: Extension startup with existing browser session
  - Set up mock server with `/api/v1/auths/` endpoint
  - Configure endpoint to return 200 with complete response:
    ```json
    {
      "id": "test-user-id",
      "email": "test@example.com",
      "name": "Test User",
      "role": "user",
      "token": "mock-jwt-token",
      "token_type": "Bearer",
      "expires_at": null
    }
    ```
  - Load extension (trigger `initialize()`)
  - Verify extension shows authenticated state
  - Verify no login prompt appears
  - Verify user profile displays correctly (name, email)
  - Verify token stored in extension storage

- [x] Add E2E test: Login button with existing browser session
  - Set up extension in unauthenticated state
  - Configure mock `/api/v1/auths/` to return 200 with valid token response
  - Click "Login with Microsoft" button
  - Verify no OAuth popup window appears
  - Verify extension transitions to authenticated state
  - Verify token is stored in extension storage
  - Verify user info displayed matches API response

- [x] Add E2E test: Session expiration and fallback
  - Set up extension with session-based authentication
  - Configure mock to return 401 with `{ "detail": "Unauthorized" }`
  - Trigger authentication check (e.g., reload extension)
  - Verify extension shows unauthenticated state
  - Verify OAuth flow works correctly after session expires

### Phase 3: Documentation and Validation
- [x] Update JSDoc comments for modified methods
  - Document session check behavior in `initialize()`
  - Document session check behavior in `login()`
  - Document `checkSessionAuth()` method with API contract
  - Note that HTTP-only cookies cannot be read directly
  - Document expected API response structure

- [x] Update `src/auth/README.md` with session detection flow
  - Add section explaining session-based detection
  - Document OpenWebUI authentication mechanism:
    * HTTP-only cookie named `token` containing JWT
    * `/api/v1/auths/` returns token in JSON when cookie valid
    * Response includes: id, email, name, role, token, token_type, expires_at
    * `expires_at: null` means session-based authentication
  - Update authentication flow diagrams
  - Document priority: storage → session API → OAuth
  - Explain why `chrome.cookies` cannot be used (HTTP-only)
  - Add example API request/response

- [x] Update `UserValidationResponse` type in `src/api/types.ts`
  - Add missing fields: `expires_at`, `permissions`, `bio`, `gender`, `date_of_birth`
  - Document that `token` field is only present in certain responses
  - Add JSDoc comments explaining when each field is present

- [x] Run full test suite
  - Unit tests: `npm test`
  - E2E tests: `npm run test:e2e`
  - Verify all existing tests still pass

- [ ] Manual testing scenarios
  - Test fresh install with no prior authentication
  - Test with existing OpenWebUI web session in browser
  - Test login button behavior with active session
  - Test behavior when session expires during use
  - Test instance URL change clears old state properly
  - Verify API response structure matches documentation

### Phase 4: Polish and Edge Cases
- [x] Add error handling for API failures
  - Catch and log `fetch()` errors to `/api/v1/auths/`
  - Don't block authentication flow on API errors
  - Handle CORS issues if any
  - Handle malformed JSON responses

- [x] Add logging for debugging
  - Log when session check is attempted
  - Log API response status (200, 401, 403, etc.)
  - Log when session is valid (200) vs invalid (401/403)
  - Log token extraction from API response
  - Log user info extracted (email, role)
  - Log when OAuth flow is used vs skipped

- [x] Handle edge cases
  - API returns 200 but no `token` field in response
  - API returns 200 but `token` is empty string
  - API returns malformed JSON
  - Network timeout during session check
  - `token_type` is not "Bearer" (log warning but accept)
  - Ensure fallback to OAuth in all failure cases

- [x] Token expiration strategy
  - Since `expires_at: null`, token is session-based
  - Set AuthToken.expiresAt to far future (e.g., Date.now() + 365 days)
  - Or omit expiry check entirely for session tokens
  - Rely on backend to validate token freshness via 401 responses
  - Add TODO comment for potential JWT parsing if needed later
  - Document that backend is source of truth for token validity

## Validation

- [x] All unit tests pass
- [x] All E2E tests pass
- [x] No regressions in existing authentication flows
- [x] Extension detects existing browser sessions on startup
- [x] Login button skips popup when session exists
- [x] Silent authentication succeeds with existing sessions
- [x] Performance is acceptable (session check adds <100ms overhead)
- [x] Verify `/api/v1/auths/` called without Authorization header
- [x] Verify token extracted from `response.token` field

## Definition of Done

- [x] Code implemented and reviewed
- [x] Tests written and passing
- [x] Documentation updated
- [ ] Manual testing completed
- [x] No console errors or warnings in normal flows
- [ ] Ready for integration testing with real OpenWebUI instance
