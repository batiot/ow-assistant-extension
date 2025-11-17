# Implementation Tasks

## Preparation
- [x] 1.1 Review current `checkSessionAuth()` implementation in `src/auth/service.ts`
- [x] 1.2 Review existing test coverage in `test/e2e/httponly-cookie.e2e.ts`
- [x] 1.3 Review mock server implementation in `test/e2e/utils/mock-server.ts`
- [x] 1.4 Identify all Cookie header references in tests and mock server

## Core Implementation
- [x] 2.1 Update `checkSessionAuth()` method to use `Authorization: Bearer` header instead of `Cookie` header
  - Change header from `'Cookie': \`token=${tokenValue}\`` to `'Authorization': \`Bearer ${tokenValue}\``
  - Update inline comment explaining why Bearer header is used
  - Keep `chrome.cookies.get()` call unchanged (still needed to read HttpOnly cookie)
  - Verify error handling remains appropriate

- [x] 2.2 Update method documentation comments
  - Clarify that backend only accepts Bearer tokens
  - Document backend behavior (re-sets cookie when validating)
  - Note that chrome.cookies API is still needed despite using Bearer header

## Mock Server Alignment
- [x] 2.3 Update mock server in `test/e2e/utils/mock-server.ts` to match real backend
  - Modify `handleTokenValidation()` to only accept `Authorization: Bearer` header
  - Remove Cookie header extraction logic (`const cookieToken = req.cookies?.token`)
  - Remove `require-cookie-header` scenario from `AuthTestScenario` type
  - Remove `default` scenario's Cookie fallback (only check Bearer token)
  - Keep only Bearer token validation: `const token = req.headers.authorization?.replace('Bearer ', '')`
  - Update comments to reflect Bearer-only behavior

- [x] 2.4 Update mock server scenario handling
  - Remove `'require-cookie-header'` from valid scenarios list
  - Update switch statement to remove Cookie header case
  - Simplify to single token source: Authorization header only

## Testing & Validation
- [x] 3.1 Clean up E2E tests in `test/e2e/httponly-cookie.e2e.ts`
  - Remove all `require-cookie-header` scenario setup calls
  - Update all tests to use `require-bearer-token` scenario (or remove scenario setup since it's now default)
  - Rename tests to reflect Bearer token focus (e.g., "should read HttpOnly cookie as Bearer token")
  - Update test comments to explain real backend behavior
  - Verify all tests pass with Bearer-only mock server

- [x] 3.2 Update unit tests in `test/unit/auth/session-detection.test.ts`
  - Change fetch expectations from Cookie header to Authorization Bearer header
  - Update test assertions: `'Authorization': 'Bearer <token>'` instead of `'Cookie': 'token=<value>'`
  - Remove `'Content-Type': 'application/json'` from session check expectations (not needed)
  - Verify all session detection tests pass
  - Ensure no tests verify Cookie header behavior

- [x] 3.3 Update mock server documentation in `test/e2e/MOCK_SERVER_API.md`
  - Remove `require-cookie-header` scenario from documentation
  - Remove `default` scenario (Bearer-only is now the standard)
  - Update examples to show Bearer token authentication only
  - Add note that mock server matches real backend behavior (Bearer-only)
  - Simplify scenario table (remove Cookie-related scenarios)

- [x] 3.4 Run full test suite to verify cleanup
  - `npm run test:unit`
  - `npm run test:e2e`
  - Verify all tests pass with Bearer-only implementation
  - Confirm no Cookie header tests remain

## Documentation Updates
- [x] 4.1 Update code comments in `src/auth/service.ts`
  - Explain Bearer header requirement
  - Document actual backend behavior vs mock server
  - Clarify why chrome.cookies is still needed

- [x] 4.2 Review and update related documentation
  - Check `docs/API.md` for accuracy
  - Update `src/auth/README.md` if it references Cookie header
  - Ensure auth flow diagrams reflect Bearer token usage

## Verification
- [x] 5.1 Build extension and test manually against real OpenWebUI instance
  - Verify session detection succeeds when cookie exists
  - Confirm OAuth popup skipped when valid session present
  - Test that invalid/expired tokens trigger OAuth flow

- [x] 5.2 Run full test suite one final time
  - `npm run test:unit`
  - `npm run test:e2e`
  - Verify all tests pass
  - Confirm no Cookie header tests remain

- [x] 5.3 Code review checklist
  - Bearer header used consistently for session validation
  - Mock server only accepts Bearer tokens (matches real backend)
  - Comments accurately reflect backend behavior
  - No breaking changes to public API
  - Test suite only tests Bearer token scenarios
  - No Cookie header authentication logic remains

## Deployment Notes
- Extension behavior unchanged from user perspective (session detection still works)
- No database migrations or data migration needed
- Compatible with all supported OpenWebUI backend versions
- Mock server now matches real backend behavior exactly (Bearer-only)
