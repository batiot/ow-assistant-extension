# Proposal: Fix Fresh Install Configuration Load

## Why

Users installing the extension for the first time expect it to work immediately with reasonable defaults, especially in development scenarios where `localhost:8080` is the standard OpenWebUI port. Currently, the extension fails to initialize its authentication service reliably on fresh install because default configuration values exist only in JavaScript memory, not in persistent storage. This creates a fragile experience where the extension might work initially but break after the service worker restarts (a common occurrence in Manifest V3).

By persisting default values to storage on fresh install, we align with user expectations that "defaults should just work" and eliminate a class of service worker lifecycle bugs.

## Problem Statement

When the extension is first installed on a fresh browser profile (no prior storage data), the authentication service fails to initialize even though a default instance URL is defined in the code (`http://localhost:8080`). This creates a poor first-run experience where users see "Auth service not initialized" errors despite having a valid default configuration.

### Current Behavior

1. Extension is installed for the first time (no storage data exists)
2. `SettingsManager.initialize()` runs and merges empty storage with `DEFAULT_SETTINGS`
3. The default `instanceUrl: 'http://localhost:8080'` is loaded into memory
4. `ConfigManager.getOpenWebUIBaseUrl()` delegates to `SettingsManager` and returns the default URL
5. **Problem**: The background service initialization logic treats this as "not configured" because nothing was explicitly saved to storage
6. Auth service is not initialized
7. User sees "Auth service not initialized" error when trying to use the extension

### Root Cause

After detailed code review, the current implementation **theoretically works correctly** for fresh installs. The settings manager does load the default URL and provides it to the background service. However, there's a critical weakness:

**The default URL only exists in memory, not in storage.** This causes issues:

1. Service worker lifecycle: If the service worker restarts (common in MV3), settings reinitialize from storage
2. On fresh install: Storage is empty, so only defaults from code exist
3. If service worker restarts before user explicitly saves settings, the URL disappears
4. This creates inconsistent behavior between "works right after install" vs "breaks after service worker restart"

The root cause is that **defaults are not persisted to storage** on fresh install. They exist only in the JavaScript runtime memory of the settings manager.

### Impact

- Poor first-run experience for fresh installs
- Auth service may work initially but break after service worker restart
- Confusing debugging experience (works sometimes, not others)
- Inconsistent with user expectations (defaults should "just work" reliably)
- Service workers in MV3 are ephemeral - relying on in-memory state is fragile

## Proposed Solution

Write the default instance URL to storage on fresh install, ensuring it persists across service worker restarts and behaves identically to explicitly configured URLs.

The fix will modify `SettingsManager.initialize()` to:

1. Detect fresh install (migration complete but no settings in storage)
2. Write the default `instanceUrl` to `chrome.storage.local`
3. Continue with normal initialization (merge storage with defaults)

This ensures:
- Default URL persists across service worker restarts
- Behavior is consistent between fresh install and configured install  
- Auth service reliably initializes with default URL
- Easy debugging (inspect storage to see active configuration)

### Code Change

In `src/settings/manager.ts`, modify `initialize()` method:

```typescript
async initialize(): Promise<void> {
  try {
    await this.migrateFromLegacyConfig();
    
    const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.SYNC);
    const syncSettings: SyncSettings = syncResult[STORAGE_KEYS.SYNC] || {};
    
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.LOCAL);
    const localSettings: LocalSettings = localResult[STORAGE_KEYS.LOCAL] || {};
    
    // NEW: Detect fresh install and write default URL to storage
    const migrationResult = await chrome.storage.local.get(STORAGE_KEYS.MIGRATION);
    const isFreshInstall = migrationResult[STORAGE_KEYS.MIGRATION] && 
                          !syncResult[STORAGE_KEYS.SYNC] && 
                          !localResult[STORAGE_KEYS.LOCAL];
    
    if (isFreshInstall) {
      console.log('[Settings] Fresh install detected, writing default URL');
      await chrome.storage.local.set({
        [STORAGE_KEYS.LOCAL]: {
          instanceUrl: DEFAULT_SETTINGS.instanceUrl,
        },
      });
      localSettings.instanceUrl = DEFAULT_SETTINGS.instanceUrl;
    }
    
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...syncSettings,
      ...localSettings,
    };
  } catch (error) {
    console.error('Failed to initialize settings:', error);
    this.settings = DEFAULT_SETTINGS;
  }
}
```

### Alternative Considered and Rejected

**Keep defaults in memory only**: Continue current behavior and rely on in-memory defaults. This was rejected because MV3 service workers are ephemeral and defaults would be lost on restart.

## Success Criteria

1. ✅ Fresh install writes default URL to `chrome.storage.local` automatically
2. ✅ Auth service initializes with default URL on fresh install
3. ✅ Default URL persists across service worker restarts
4. ✅ Explicitly clearing the instance URL still disables auth service (null behavior)
5. ✅ Existing tests continue to pass (unaffected by storage writes on fresh install)
6. ✅ No breaking changes to existing installations or upgrade paths
7. ✅ Storage inspector shows default URL saved after fresh install

## Out of Scope

- Adding E2E tests specifically for fresh install scenario (as requested by user)
- Changing the default URL or making it configurable at build time
- Adding a first-run onboarding flow or setup wizard
- Validating whether the default URL is actually reachable on startup
