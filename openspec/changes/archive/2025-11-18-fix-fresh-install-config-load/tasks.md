# Tasks: Fix Fresh Install Configuration Load

## Context
The authentication service should initialize with the default instance URL on fresh install, but currently treats compile-time defaults as "not configured". This is a minimal fix that only affects the initialization logic in the background worker.

## Implementation Tasks

### 1. Review Current Implementation
**Files:** `src/settings/manager.ts`, `src/config/manager.ts`, `src/background/index.ts`

- [x] Understand initialization flow from SettingsManager → ConfigManager → background
- [x] Confirm that default URL is available but may not persist across worker restarts
- [x] Identify that writing defaults to storage on fresh install is the robust solution

**Validation:**
- [x] Code review completed - logic is correct but can be made more defensive
- [x] Design document created explaining the approach

### 2. Detect Fresh Install in SettingsManager
**File:** `src/settings/manager.ts` (in `initialize()`)

- [x] After migration check, detect if this is a fresh install (migration complete but no settings in storage)
- [x] Check if both `STORAGE_KEYS.SYNC` and `STORAGE_KEYS.LOCAL` are empty
- [x] If fresh install, write default `instanceUrl` to `chrome.storage.local`
- [x] Add console log for debugging: `"[Settings] Fresh install detected, writing default instance URL to storage"`

**Code location:** Lines 46-70 (in `initialize()` method)

**Validation:**
- [x] Code review confirms fresh install detection is accurate
- [ ] Fresh install test: Verify default URL is written to storage on first run

### 3. Verify Default URL Persists
**File:** `src/settings/manager.ts`

- [x] Ensure the written default URL is immediately reflected in `this.settings`
- [x] Verify that subsequent calls to `getSettings()` return the default URL
- [x] Confirm that `ConfigManager.getOpenWebUIBaseUrl()` gets the default value

**Validation:**
- [x] Code review confirms that `localSettings.instanceUrl = DEFAULT_SETTINGS.instanceUrl` updates in-memory state
- [ ] Verify storage inspector shows the default URL saved

### 4. Add Debug Logging
**Files:** `src/settings/manager.ts`, `src/background/index.ts`

- [x] Add log when default URL is written to storage (already in task 2)
- [x] Logs clearly indicate source ("Fresh install detected" message)
- [x] Background service already has sufficient logging

**Validation:**
- [x] Code review confirms helpful logging without verbosity
- [ ] Review console logs during fresh install flow

## Testing Tasks

### 5. Manual Testing - Fresh Install
- [ ] Build extension: `npm run build`
- [ ] Load extension in fresh Chrome profile (clear all data first)
- [ ] Open Chrome DevTools → Application → Storage → Extension Storage
- [ ] Expected: See `user_settings_local` with `instanceUrl: "http://localhost:8080"`
- [ ] Open background worker console
- [ ] Expected: Log shows "[Settings] Fresh install detected, writing default instance URL to storage"
- [ ] Expected: Log shows "Fetching backend configuration..."
- [ ] Open extension popup
- [ ] Expected: Login button visible (or connection error if localhost:8080 not reachable)
- [ ] Expected: NO "Auth service not initialized" error

### 6. Manual Testing - Service Worker Restart  
- [ ] With extension still installed from test 5
- [ ] In Chrome extensions page, click "Service worker (Inactive)" or refresh service worker
- [ ] Open popup again
- [ ] Expected: Auth service still initialized (persists because URL is in storage)
- [ ] Expected: No errors

### 7. Manual Testing - Explicit URL Clear
- [ ] Open options page
- [ ] Clear instance URL field (make it empty)
- [ ] Save settings
- [ ] Check storage inspector
- [ ] Expected: `instanceUrl` is empty string or undefined
- [ ] Open popup
- [ ] Expected: "Auth service not initialized" error or prompt to configure
- [ ] Expected: Auth service is null (graceful degradation)
### 8. Regression Testing - Existing Tests
- [x] Run unit tests: `npm run test:unit`
- [x] Expected: All tests pass (fresh install logic doesn't affect existing tests) ✅ 182 tests passed
- [ ] Run E2E tests: `npm run test:e2e`  
- [ ] Expected: All tests pass (E2E tests clear storage then configure, unaffected)

**Note:** Per user request, we are NOT adding new E2E tests for fresh install scenario. The manual testing above provides sufficient validation.

## Deployment Tasks

### 9. Build and Package
- [x] Run `npm run build` successfully ✅ Built in 1.57s
- [x] Verify no TypeScript errors ✅ All 72 modules transformed
- [x] Verify no ESLint warnings ✅ Clean build
- [ ] Test extension in fresh Chrome profile
- [ ] Verify default URL is written to storage and auth initializes

### 10. Documentation
- [ ] Update CHANGELOG or release notes (if maintained)
- [ ] Note: "Fixed: Default instance URL now persists on fresh install, ensuring auth service initializes correctly"

## Task Dependencies

```
Task 1 (Review) → Task 2 (Detect Fresh Install) → Task 3 (Verify Persistence)
                                                           ↓
                         Task 4 (Logging) ←────────────────┘
                                ↓
       Task 5-8 (Testing) → Task 9-10 (Deploy)
```

All tasks are sequential. No parallelization needed for this focused fix.

## Estimated Effort

- Implementation: 30 minutes (modify SettingsManager initialization)
- Testing: 25 minutes (manual testing in fresh profile + storage inspection)
- Total: ~55 minutes

## Rollback Plan

If issues arise:
1. The change is minimal and localized to `SettingsManager.initialize()`
2. Revert the specific commit
3. Behavior returns to "defaults in memory only, not persisted"
4. No data loss - only affects fresh installs going forward
