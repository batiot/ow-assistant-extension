# Change: Implement Silent Authentication for Single Provider

## Why

The current authentication implementation always shows a popup window, even in scenarios where the user might already have a valid session with the OAuth provider or when no user interaction is required. This creates unnecessary friction in the user experience:

- Users see a popup flash even when already authenticated
- For single OAuth provider configurations without a login form, direct SSO flows could complete silently
- The popup-first approach doesn't take advantage of existing browser sessions

By implementing silent authentication attempts before showing the popup, we can:
- Reduce user friction by avoiding unnecessary popup windows
- Provide seamless re-authentication when the user already has a valid OAuth session
- Fall back gracefully to visible popup only when user interaction is actually required

The design for this feature was already documented in `add-backend-config-endpoint` change but the implementation was deferred as a TODO for future enhancement.

## What Changes

- **NEW**: Implement `attemptSilentAuth()` method that tries authentication in a hidden/background context
- **NEW**: Add timeout mechanism (2-3 seconds) for silent auth attempts
- **MODIFIED**: Update `login()` method to check authentication status first before showing any UI
- **MODIFIED**: Add strategy determination logic that decides between silent auth attempt vs immediate popup
- **MODIFIED**: Implement separate code paths for "definitely show popup" vs "try silent first" scenarios
- **NEW**: Add logging for silent auth attempts (success, timeout, failure)
- **NEW**: Document silent authentication behavior and timeout configuration

## Impact

### Affected Specs
- **auth**: Add silent authentication requirements and scenarios

### Affected Code
- `src/auth/service.ts` - Implement silent auth logic in `login()` method
- `src/auth/types.ts` - Add any new types for auth strategy or silent auth state (if needed)
- `src/auth/README.md` - Document silent authentication behavior and configuration

### Breaking Changes
None - this enhances existing authentication flow with backward-compatible improvements.

### User-Visible Changes
- Users with existing OAuth sessions will experience seamless authentication without seeing popup
- Popup only appears when user interaction is genuinely required (login, consent, provider selection)
- Faster authentication in cases where silent auth succeeds
