# Design: Fix Fresh Install Configuration Load

## Problem Analysis

After detailed code review, the current implementation **should already work correctly** for fresh installs with the default URL. The code flow is:

1. `SettingsManager.initialize()` loads empty storage and merges with `DEFAULT_SETTINGS`
2. Default `instanceUrl: 'http://localhost:8080'` is in memory
3. `ConfigManager.initialize()` copies that URL to `this.config.openWebUIBaseUrl`  
4. `getOpenWebUIBaseUrl()` returns the URL correctly
5. `initializeServices()` checks `if (baseUrl)` - this passes with default URL
6. Auth service initializes

**The logic is sound.** However, there may be edge cases or misunderstandings:

### Hypothesis 1: User is testing in wrong mode
If the user built the extension in `test` mode, `VITE_OPENWEBUI_BASE_URL` gets set to the mock server URL (or empty if mock server isn't running). This could cause initialization to fail if the URL is empty.

### Hypothesis 2: User manually cleared storage
If the user went into DevTools and manually cleared `chrome.storage.local`, then later opened the extension without restarting the service worker, the settings might not reinitialize properly.

### Hypothesis 3: Actual bug exists but is subtle
There may be a race condition or subtle bug not visible in static code analysis.

## Solution Approach

Since the code appears correct, the fix is **defensive programming**:

1. **Add logging** to make the flow transparent and debuggable
2. **Ensure settings are written to storage on first run** so they persist across worker restarts  
3. **Add explicit check** that if instanceUrl exists in memory but auth service is null, log a warning

### Implementation

**Option A: Write defaults to storage on fresh install (RECOMMENDED)**

On first run, if no settings exist in storage, explicitly write the default URL to storage. This ensures:
- Defaults persist across service worker restarts
- Behavior is identical whether user explicitly configured URL or used default
- Easier debugging (can inspect storage to see what URL is active)

**Option B: Leave as-is, add better logging**

Just add clearer console logs to help users understand what's happening. This is minimal but doesn't address potential issues.

We'll go with **Option A** because it's more robust and aligns with user expectations that "configured" means "saved in storage".

## Trade-offs

### Writing defaults to storage

**Pros:**
- More explicit and predictable behavior
- Easier to debug (inspect storage to see active config)
- Survives service worker restarts
- Matches user mental model ("if it's configured, it's saved")

**Cons:**
- Slightly more code
- Writes to storage on first run (minimal overhead)
- Might be surprising if user expects defaults to remain "uncommitted"

**Decision:** Write defaults to storage. The pros outweigh the cons for this use case.

## Implementation Details

Modify `SettingsManager.initialize()` to detect fresh install and write defaults:

```typescript
async initialize(): Promise<void> {
  try {
    await this.migrateFromLegacyConfig();
    
    const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.SYNC);
    const syncSettings: SyncSettings = syncResult[STORAGE_KEYS.SYNC] || {};
    
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.LOCAL);
    const localSettings: LocalSettings = localResult[STORAGE_KEYS.LOCAL] || {};
    
    // Detect fresh install: migration complete but no settings saved
    const migrationResult = await chrome.storage.local.get(STORAGE_KEYS.MIGRATION);
    const isFreshInstall = migrationResult[STORAGE_KEYS.MIGRATION] && 
                          !syncResult[STORAGE_KEYS.SYNC] && 
                          !localResult[STORAGE_KEYS.LOCAL];
    
    if (isFreshInstall) {
      console.log('[Settings] Fresh install detected, writing default instance URL to storage');
      // Write default instance URL to storage so it persists
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

This ensures the default URL is explicitly saved on fresh install, making behavior consistent and debuggable.

## Testing Strategy

Manual testing is sufficient (per user request, no new automated tests):

1. **Fresh install test**: Load extension in fresh profile, verify URL saved to storage and auth initializes
2. **Migration test**: Upgrade from old version with legacy config, verify migration works
3. **Explicit config test**: User manually sets URL, verify it saves and works
4. **Empty URL test**: User clears URL, verify auth service becomes null

No automated tests needed as existing tests already cover the core flows and this is a defensive enhancement.
