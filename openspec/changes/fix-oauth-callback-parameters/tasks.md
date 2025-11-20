# Tasks: Fix OAuth Callback Query Parameter Preservation

## Prerequisites
- [ ] 0.1 Review Chrome declarativeNetRequest documentation for regexFilter and regexSubstitution
- [ ] 0.2 Determine extension ID handling strategy (build-time generation vs relative path)
- [ ] 0.3 Test if Chrome supports relative paths in declarativeNetRequest redirects

## Phase 1: Update DeclarativeNetRequest Rule
- [ ] 1.1 Update `public/rules.json` to use `regexFilter` instead of `urlFilter`
  - Replace `"urlFilter": "*/oauth/*/callback*"` with `"regexFilter": "^(https?://[^/]+)/oauth/([^/]+)/callback(.*)$"`
  - Change redirect from `extensionPath` to `url` with `regexSubstitution`
  - Use pattern: `chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html?provider=\\2\\3`
  - Ensure capture groups correctly preserve provider name (\\2) and query string (\\3)
  - **Validation**: Manually inspect generated rules.json syntax
  - **Dependency**: Requires extension ID resolution (task 1.2)

- [ ] 1.2 Implement extension ID handling in declarativeNetRequest rule
  - **Option A**: Add Vite plugin to generate rules.json at build time with actual extension ID
  - **Option B**: Test relative path redirect (e.g., `/src/pages/oauth-callback.html?provider=\\2\\3`)
  - **Option C**: Document manual ID replacement process
  - **Validation**: Verify rule loads successfully in Chrome with correct extension ID
  - **Deliverable**: Working rules.json that correctly substitutes extension ID

- [ ] 1.3 Update manifest permissions if needed
  - Verify `declarativeNetRequest` permission is present (already exists)
  - Confirm `host_permissions` cover OAuth callback URLs
  - **Validation**: Extension loads without permission warnings

## Phase 2: Enhance OAuth Callback Page
- [ ] 2.1 Add JavaScript to `src/pages/oauth-callback.html`
  - Parse query parameters using `URLSearchParams`
  - Extract: `code`, `error`, `error_description`, `provider`, `state`, `session_state`
  - Implement parameter validation logic
  - **Validation**: Page correctly parses sample URLs in browser console
  - **Deliverable**: Functional parameter parsing script

- [ ] 2.2 Implement UI state management in callback page
  - Success state: Display when `code` parameter is present
  - Error state: Display when `error` parameter is present
  - Missing code state: Display when neither `code` nor `error` present
  - Update DOM with appropriate messages for each state
  - **Validation**: Manually test page with different query parameter combinations
  - **Deliverable**: Dynamic UI that responds to URL parameters

- [ ] 2.3 Add user feedback messages
  - Success: "Authentication Successful" + "Completing sign-in..." + "This window will close automatically"
  - Error: "Authentication Failed" + error description + "You can close this window"
  - Missing code: "Authentication Error" + "No authorization code received" + "Please try again"
  - **Validation**: All messages display correctly with appropriate styling
  - **Deliverable**: Complete user-facing feedback system

- [ ] 2.4 Add debug logging to callback page
  - Log presence of `code`, `provider`, `error`, and `state` parameters
  - Use console.log with clear prefix: `[OAuth Callback]`
  - Log object with boolean flags for parameter presence
  - **Validation**: Console shows expected logs when page loads
  - **Deliverable**: Debugging capability for troubleshooting OAuth issues

## Phase 3: Update Auth Service
- [ ] 3.1 Modify `AuthService.login()` to extract provider from callback URL
  - After `launchWebAuthFlow` returns, parse returned URL
  - Extract `provider` query parameter using `url.searchParams.get('provider')`
  - Validate provider parameter is present
  - Throw `AuthError` if provider is missing
  - **Validation**: Unit test verifies provider extraction
  - **Deliverable**: Provider extraction logic in login method

- [ ] 3.2 Update `exchangeCodeForToken()` signature and implementation
  - Add `provider` parameter to method signature
  - Remove hardcoded `provider = 'microsoft'` assumption
  - Remove complex provider-guessing logic based on config
  - Use provider parameter directly in callback URL construction
  - **Validation**: Token exchange uses correct provider-specific endpoint
  - **Deliverable**: Simplified token exchange with explicit provider

- [ ] 3.3 Add error handling for missing provider
  - Check if `provider` parameter exists in callback URL
  - Throw descriptive `AuthError` if missing
  - Include helpful error message for debugging
  - **Validation**: Unit test for missing provider scenario
  - **Deliverable**: Robust error handling

- [ ] 3.4 Remove TODO comments about provider detection
  - Clean up comments about regex rules and provider extraction
  - Remove references to unsupported approaches
  - Add clear documentation about how provider is passed
  - **Validation**: Code review shows no stale comments
  - **Deliverable**: Clean, documented code

## Phase 4: Update Tests
- [ ] 4.1 Update unit test mocks for `launchWebAuthFlow`
  - Change mock return value to include `provider` parameter
  - Format: `chrome-extension://testid/src/pages/oauth-callback.html?provider=microsoft&code=ABC&state=XYZ`
  - Update all test cases using `launchWebAuthFlow`
  - **Validation**: All unit tests pass
  - **Deliverable**: Realistic test mocks

- [ ] 4.2 Add unit tests for provider extraction
  - Test successful provider extraction from callback URL
  - Test error when provider parameter is missing
  - Test multiple provider scenarios (microsoft, google)
  - Test URL parsing edge cases
  - **Validation**: New tests pass and provide good coverage
  - **Deliverable**: Comprehensive provider extraction tests

- [ ] 4.3 Add unit tests for callback page
  - Create test HTML file or use jsdom to test page logic
  - Test parameter parsing with various URL combinations
  - Test DOM updates for each state (success, error, missing code)
  - Test console logging output
  - **Validation**: Callback page logic fully tested
  - **Deliverable**: Unit tests for callback page JavaScript

- [ ] 4.4 Update E2E tests for OAuth flow
  - Verify declarativeNetRequest rule intercepts callback correctly
  - Check that query parameters are preserved through redirect
  - Validate callback page renders with correct parameters
  - Confirm token exchange uses extracted provider
  - **Validation**: E2E tests pass with real OAuth flow
  - **Deliverable**: Updated E2E test suite

- [ ] 4.5 Add E2E test for multi-provider scenarios
  - Test OAuth flow with microsoft provider
  - Test OAuth flow with alternative provider if available
  - Verify provider-specific endpoints are called
  - **Validation**: Multi-provider flows work correctly
  - **Deliverable**: Provider-agnostic E2E tests

## Phase 5: Documentation & Validation
- [ ] 5.1 Update auth documentation
  - Document the declarativeNetRequest redirect behavior
  - Explain query parameter preservation mechanism
  - Add troubleshooting section for callback issues
  - **Validation**: Documentation is clear and accurate
  - **Deliverable**: Updated `src/auth/README.md`

- [ ] 5.2 Update API documentation
  - Document the provider parameter requirement
  - Update OAuth flow diagrams if present
  - Add examples of callback URLs with parameters
  - **Validation**: API docs match implementation
  - **Deliverable**: Updated documentation files

- [ ] 5.3 Manual testing with real OAuth provider
  - Test complete OAuth flow with Microsoft EntraID
  - Verify query parameters appear in callback URL
  - Confirm callback page displays success message
  - Validate token exchange succeeds
  - **Validation**: Real-world OAuth works end-to-end
  - **Deliverable**: Successful manual test results

- [ ] 5.4 Test error scenarios manually
  - User cancels authentication
  - OAuth provider returns error
  - Network failure during OAuth
  - Missing configuration
  - **Validation**: All error paths handled gracefully
  - **Deliverable**: Documented error handling behavior

- [ ] 5.5 Run full test suite
  - Execute all unit tests: `npm run test:unit`
  - Execute all E2E tests: `npm run test:e2e`
  - Check for regressions in other functionality
  - **Validation**: All tests pass
  - **Deliverable**: Green test suite

- [ ] 5.6 Validate with `openspec validate`
  - Run `openspec validate fix-oauth-callback-parameters --strict`
  - Resolve any validation issues
  - Ensure all requirements have corresponding scenarios
  - **Validation**: OpenSpec validation passes
  - **Deliverable**: Validated specification

## Phase 6: Polish & Cleanup
- [ ] 6.1 Code review and refactoring
  - Review all changed code for clarity
  - Remove debugging console.logs (keep essential ones)
  - Ensure consistent code style
  - Add TSDoc comments where needed
  - **Validation**: Code passes linting
  - **Deliverable**: Clean, maintainable code

- [ ] 6.2 Performance testing
  - Measure redirect overhead with performance API
  - Verify callback page load time is acceptable
  - Check memory usage during OAuth flow
  - **Validation**: No performance regressions
  - **Deliverable**: Performance metrics

- [ ] 6.3 Security review
  - Verify no sensitive data logged
  - Confirm authorization codes are not persisted
  - Check CSP headers on callback page
  - Validate HTTPS enforcement
  - **Validation**: Security best practices followed
  - **Deliverable**: Security review checklist

## Task Dependencies

```
0.1, 0.2, 0.3 (Prerequisites)
    ↓
1.1 → 1.2 → 1.3 (DeclarativeNetRequest)
    ↓
2.1 → 2.2 → 2.3 → 2.4 (Callback Page)
    ↓
3.1 → 3.2 → 3.3 → 3.4 (Auth Service)
    ↓
4.1, 4.2, 4.3 → 4.4, 4.5 (Tests)
    ↓
5.1, 5.2 → 5.3, 5.4 → 5.5 → 5.6 (Documentation & Validation)
    ↓
6.1 → 6.2, 6.3 (Polish)
```

## Parallelizable Work

- Tasks 2.1-2.4 (Callback Page) can be done in parallel with initial work on 3.1
- Tasks 4.1, 4.2, 4.3 can be done in parallel
- Tasks 5.1, 5.2 can be done in parallel
- Tasks 6.2, 6.3 can be done in parallel

## Estimated Timeline

- Phase 1: 2-4 hours (depending on extension ID strategy)
- Phase 2: 2-3 hours
- Phase 3: 1-2 hours
- Phase 4: 3-4 hours
- Phase 5: 2-3 hours
- Phase 6: 1-2 hours

**Total**: 11-18 hours
