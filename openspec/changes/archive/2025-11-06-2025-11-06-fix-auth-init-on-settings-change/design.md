# Design: Auth Service Initialization on Settings Change

## Architecture Overview

### Current State

The extension uses a singleton pattern for `AuthService` managed by the background service worker:

```
Extension Startup → Background Worker → ConfigManager.initialize()
                                             ↓
                                  Get OpenWebUI Base URL
                                             ↓
                                  AuthService.getInstance(config)
                                             ↓
                                    authService.initialize()
```

**Problem:** The singleton is only created once during extension lifecycle (startup/install). When the user updates the OpenWebUI URL via settings, the singleton retains the old configuration (or remains uninitialized if no URL was set initially).

### Proposed Architecture

Add reactive initialization triggered by storage changes:

```
User Changes Settings → SettingsManager → chrome.storage.local.set()
                                                    ↓
Background Worker ← chrome.storage.onChanged ← Storage Update Event
       ↓
   Detect instanceUrl Change
       ↓
   AuthService.resetInstance()
       ↓
   AuthService.getInstance({ baseUrl: newUrl })
       ↓
   authService.initialize()
       ↓
   Setup Auth State Listeners
```

## Key Design Decisions

### Decision 1: Singleton Reset vs Config Update

**Options Considered:**
1. Add `updateConfig()` method and update existing instance
2. Reset singleton and create new instance
3. Maintain multiple instances keyed by URL

**Chosen:** Reset singleton and create new instance (#2)

**Rationale:**
- **Simplicity:** Clean slate approach avoids state management complexity
- **Safety:** Eliminates risk of stale tokens for previous URL
- **Minimal changes:** Reuses existing initialization logic
- **Clear semantics:** Configuration change = new auth context

The `updateConfig()` method was added for API completeness but is not used in the initial implementation. It may be useful for future scenarios where we want to update config without losing auth state.

### Decision 2: Storage Listener Location

**Options Considered:**
1. Add listener in AuthService itself
2. Add listener in background worker
3. Add listener in ConfigManager

**Chosen:** Add listener in background worker (#2)

**Rationale:**
- **Separation of concerns:** Background worker orchestrates services
- **Existing pattern:** Background worker already handles auth messages
- **Lifecycle management:** Worker controls when AuthService is instantiated
- **Broadcasting:** Worker already handles auth state broadcasting to UI

### Decision 3: Listener Trigger Condition

**Implementation:**
```typescript
if (areaName === 'local' && changes['user_settings_local']) {
  const newUrl = changes['user_settings_local'].newValue?.instanceUrl;
  const oldUrl = changes['user_settings_local'].oldValue?.instanceUrl;
  
  if (newUrl !== oldUrl) {
    // Reinitialize
  }
}
```

**Rationale:**
- **Efficiency:** Only trigger on actual URL changes, not theme/language
- **Correctness:** Avoid unnecessary reinitialization
- **Robustness:** Handle undefined/null cases (initial install, URL removal)

### Decision 4: Error Handling Strategy

**Approach:**
- Log errors but don't throw
- Allow extension to remain functional
- UI will display appropriate error when attempting auth operations

**Rationale:**
- **Resilience:** Configuration errors shouldn't crash background worker
- **User experience:** Users can correct configuration and try again
- **Debugging:** Console logs provide troubleshooting information

## Component Responsibilities

### AuthService (`src/auth/service.ts`)
- **Owns:** Authentication state, token management, OAuth flow
- **Provides:** Singleton access, initialization, login/logout operations
- **New capability:** Allows singleton reset for reconfiguration

### Background Worker (`src/background/index.ts`)
- **Owns:** Service orchestration, message routing, storage monitoring
- **Provides:** Auth state broadcasting, API request handling
- **New capability:** Reactive auth service initialization on config change

### SettingsManager (`src/settings/manager.ts`)
- **Owns:** Settings persistence and validation
- **Provides:** Settings CRUD operations, change notifications
- **Unchanged:** Already triggers storage events correctly

### ConfigManager (`src/config/manager.ts`)
- **Owns:** Legacy config compatibility, config validation
- **Provides:** Unified config access (delegates to SettingsManager)
- **Unchanged:** Already reads from SettingsManager

## Data Flow

### Scenario: User Configures URL for First Time

1. User opens options page
2. User enters OpenWebUI URL and saves
3. SettingsManager validates and writes to `chrome.storage.local['user_settings_local']`
4. Storage change event fires
5. Background worker listener detects new `instanceUrl`
6. Worker calls `AuthService.getInstance({ baseUrl: newUrl })`
7. Worker calls `authService.initialize()` (no token exists, returns immediately)
8. Worker sets up auth state listener
9. User opens popup
10. Popup displays login button (auth service now available)

### Scenario: User Changes URL

1. User opens options page with existing URL configured
2. User changes URL and saves
3. SettingsManager writes new URL to storage
4. Storage change event fires
5. Background worker detects URL changed (old ≠ new)
6. Worker calls `AuthService.resetInstance()` (clears singleton)
7. Worker calls `AuthService.getInstance({ baseUrl: newUrl })`
8. Worker reinitializes with new URL
9. Previous auth session (if any) is cleared by initialize() if token validation fails
10. UI contexts receive auth state update via broadcast

### Scenario: User Removes URL

1. User clears URL in options page
2. SettingsManager writes empty URL to storage
3. Background worker detects URL changed to empty/undefined
4. Worker sets `authService = null`
5. Subsequent auth operations return "not initialized" error
6. UI displays configuration prompt

## Security Considerations

### Token Handling
- **Issue:** URL change might invalidate existing auth session
- **Mitigation:** `initialize()` validates stored token against new URL, clears if invalid
- **Result:** No risk of token leakage between different OpenWebUI instances

### State Consistency
- **Issue:** Multiple UI contexts might have stale auth state during reinitialization
- **Mitigation:** Background worker broadcasts state changes via `broadcastAuthState()`
- **Result:** All contexts receive updated state via message passing

### Race Conditions
- **Issue:** User might attempt login during reinitialization
- **Mitigation:** `AuthService.getInstance()` is synchronous; `initialize()` is awaited before accepting requests
- **Result:** Auth service is always in a consistent state before handling requests

## Performance Considerations

### Initialization Overhead
- **Cost:** Creating new AuthService instance is negligible
- **Frequency:** Only on URL changes (rare user action)
- **Impact:** No noticeable performance impact

### Storage Listener Overhead
- **Cost:** Listener callback fires on any local storage change
- **Optimization:** Early return if change is not `user_settings_local`
- **Optimization:** Early return if `instanceUrl` unchanged
- **Impact:** Minimal CPU usage

### Memory Management
- **Old instance:** Garbage collected after reset (no references remain)
- **Listeners:** Re-established on each initialization
- **Tokens:** Cleared from storage if validation fails
- **Impact:** No memory leaks

## Testing Strategy

### Unit Tests (AuthService)
- `resetInstance()` clears singleton
- `getInstance()` after reset creates new instance
- `updateConfig()` updates internal config

### Integration Tests
- Storage change triggers reinitialization
- Auth state broadcast works after reinitialization
- Error handling for invalid URLs

### E2E Tests (Manual)
- Configure URL → immediate auth availability
- Change URL → successful reinitialization
- Remove URL → appropriate error message

### Regression Tests
- Existing auth flow unchanged
- Existing E2E tests pass
- No console errors

## Future Enhancements

### Potential Improvements
1. **Graceful token migration:** Attempt to validate existing token against new URL before clearing
2. **Config migration UI:** Warn user if changing URL will invalidate current session
3. **Multiple instance support:** Allow auth to multiple OpenWebUI instances simultaneously
4. **Hot reload indicator:** Show transient UI feedback during reinitialization

### Non-Requirements (Out of Scope)
- Token portability between instances
- Automatic token refresh across URL changes
- Offline auth capabilities
- Multi-tenant URL management
