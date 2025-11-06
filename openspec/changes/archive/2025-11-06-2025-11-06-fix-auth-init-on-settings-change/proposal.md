# Proposal: Fix Auth Service Initialization on Settings Change

## Why

Users who configure the OpenWebUI instance URL in the extension options experience a broken authentication flow that requires manually reloading the extension to work. This is a critical usability issue because:

1. **Poor User Experience**: After saving the URL configuration, users immediately try to authenticate but encounter an error, creating confusion and requiring technical knowledge (reloading the extension) to fix.

2. **Breaks Expected Behavior**: Chrome extensions typically react to storage changes immediately without requiring reload, so users expect authentication to "just work" after configuration.

3. **Blocks First-Time Setup**: New users cannot complete the setup flow (configure URL → authenticate → use features) without an unexpected and undocumented manual intervention step.

4. **No Clear Error Guidance**: The error message doesn't explain that an extension reload is needed, leaving users stuck and frustrated.

The root cause is architectural: the background service worker only initializes the AuthService singleton during startup/installation events but doesn't listen for runtime configuration changes via `chrome.storage.onChanged`.

## Problem Statement

When users configure the OpenWebUI instance URL in the options page, the authentication service in the background worker is not reinitialized. This causes the following user-facing issue:

1. User opens options page and sets OpenWebUI base URL
2. User clicks save; settings are persisted to `chrome.storage.local`
3. User opens popup and attempts to login
4. Error displayed: "Auth service not initialized. Please configure OpenWebUI base URL first."

The root cause is that the background service worker only initializes `AuthService` during startup/installation events, but does not listen for storage changes that indicate the instance URL has been updated.

## What Changes

### AuthService Enhancements
- **ADDED** `resetInstance()` static method to clear singleton instance
- **ADDED** `updateConfig(config: AuthConfig)` instance method for future dynamic updates
- **ADDED** JSDoc comments explaining reconfiguration use cases

### Background Service Worker
- **ADDED** `chrome.storage.onChanged` listener monitoring `user_settings_local` key
- **ADDED** URL comparison logic to detect `instanceUrl` changes
- **ADDED** Automatic AuthService reinitialization when URL changes
- **ADDED** AuthService cleanup when URL is removed
- **ADDED** Error handling and logging for reinitialization process
- **MODIFIED** `initializeServices()` to explicitly handle missing URL case

### Testing Infrastructure
- **ADDED** `test/unit/auth/service.test.ts` - Unit tests for singleton management
- **ADDED** `test/e2e/auth-reinit.e2e.ts` - E2E tests for dynamic reinitialization
- **ADDED** Test scenarios covering URL configuration, change, and removal

### Documentation
- **ADDED** Inline comments explaining storage listener logic
- **ADDED** IMPLEMENTATION_SUMMARY.md documenting the fix
- **UPDATED** tasks.md marking all implementation tasks complete

## Goals

- Enable dynamic AuthService initialization when the OpenWebUI instance URL changes
- Maintain existing authentication state when possible during reconfiguration
- Provide immediate availability of auth functionality after URL configuration
- Ensure proper cleanup when URL is removed

## Non-Goals

- Modifying the settings UI or validation logic
- Changing the overall authentication flow or OAuth implementation
- Adding new configuration options beyond instance URL

## Proposed Solution

### Overview

Add a storage change listener in the background service worker that:
1. Detects when `user_settings_local.instanceUrl` changes
2. Reinitializes the AuthService singleton with the new base URL
3. Clears AuthService when URL is removed
4. Re-establishes auth state change broadcast listeners

### Implementation Approach

**Background Service Worker Changes:**
- Add `chrome.storage.onChanged` listener for `user_settings_local` key
- Compare old and new `instanceUrl` values to detect changes
- Reset and recreate AuthService singleton when URL changes
- Clear authService reference when URL is removed

**AuthService Changes:**
- Add static `resetInstance()` method to allow singleton reset
- Add `updateConfig()` instance method to update base URL (for future use)
- Maintain backward compatibility with existing initialization pattern

### Component Interaction

```
User → Options Page → SettingsManager → chrome.storage.local
                                              ↓
Background Worker ← storage.onChanged ← chrome.storage
       ↓
   Reset AuthService Singleton
       ↓
   Create New Instance with Updated URL
       ↓
   Initialize & Setup Listeners
       ↓
Popup/Sidepanel ← Ready for Authentication
```

## Impact Assessment

### User Impact
- **Positive:** Immediate auth service availability after URL configuration
- **Positive:** No extension reload required after settings change
- **Minimal disruption:** Existing auth sessions may be invalidated on URL change (expected behavior)

### Technical Impact
- **Low risk:** Changes are localized to background worker and AuthService
- **No breaking changes:** Existing initialization flow remains unchanged
- **Performance:** Negligible; listener only triggers on actual URL changes

### Testing Impact
- Existing E2E tests cover URL configuration and authentication
- May need additional test for dynamic reconfiguration scenario

## Alternatives Considered

### Alternative 1: Manual Extension Reload
- **Rejected:** Poor user experience; requires technical knowledge
- Users would need to manually reload extension after configuration

### Alternative 2: Message-Based Initialization
- **Rejected:** More complex; adds message passing overhead
- Would require options page to explicitly notify background worker

### Alternative 3: Polling for Configuration Changes
- **Rejected:** Inefficient; unnecessary resource usage
- Storage change listeners are the canonical Chrome extension pattern

## Dependencies

- Requires existing SettingsManager implementation (already in place)
- Requires existing AuthService singleton pattern (already in place)
- No external API or library dependencies

## Migration Strategy

No migration needed. Changes are purely additive:
- New storage listener added to background worker
- New methods added to AuthService (not breaking existing API)
- Existing initialization paths continue to work

## Success Criteria

1. User can configure OpenWebUI URL and immediately use authentication without reload
2. Auth service correctly reinitializes when URL changes
3. Auth service is cleared when URL is removed
4. Existing authentication flow continues to work unchanged
5. No new console errors or warnings introduced
