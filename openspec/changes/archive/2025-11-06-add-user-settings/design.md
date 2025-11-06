# Design Document: User Settings System

## Overview

This document outlines the architectural decisions and technical approach for implementing user settings in the OpenWebUI Assistant extension, focusing on Theme, Language, and Instance URL configuration.

## Architecture

### Storage Strategy

**Two-tier storage approach:**

1. **`chrome.storage.sync`** for user preferences (Theme, Language)
   - Syncs across user's devices automatically
   - 100KB quota limit (sufficient for settings)
   - Provides seamless cross-device experience
   - User preferences follow them everywhere

2. **`chrome.storage.local`** for instance configuration (OpenWebUI URL)
   - Device-specific storage
   - Security consideration: different devices may connect to different instances
   - 10MB quota (unlimited with permission)
   - Faster access, no network overhead

**Storage keys:**
```typescript
'user_settings_sync': { theme: 'dark', language: 'en' }
'user_settings_local': { instanceUrl: 'https://...' }
```

### Settings Manager Pattern

**Singleton manager class** similar to existing `ConfigManager`:

```typescript
class SettingsManager {
  private static instance: SettingsManager;
  private settings: UserSettings;
  
  async initialize(): Promise<void>
  async updateSettings(partial: Partial<UserSettings>): Promise<void>
  getSettings(): UserSettings
  validateSettings(settings: Partial<UserSettings>): ValidationResult
}
```

**Rationale:**
- Consistent with existing `ConfigManager` pattern
- Single source of truth for settings
- Easy to test and mock
- Centralized validation logic

### React Context Integration

**Settings Context** provides reactive settings access:

```typescript
interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  error: string | null;
}
```

**Benefits:**
- Settings updates automatically propagate to all components
- No prop drilling
- Consistent API across popup and sidepanel
- Easy to add new settings consumers

### Theme System

**Approach: CSS Custom Properties + HTML attribute**

```css
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #000000;
  /* ... */
}

:root[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --text-primary: #ffffff;
  /* ... */
}
```

**Theme Detection Flow:**
1. User selects theme: "Light" | "Dark" | "System"
2. If "System", detect using `window.matchMedia('(prefers-color-scheme: dark)')`
3. Apply theme by setting `document.documentElement.setAttribute('data-theme', resolvedTheme)`
4. Listen to system theme changes when in "System" mode

**Rationale:**
- CSS custom properties are well-supported
- HTML attribute approach is performant (no class recalculation)
- System theme detection respects OS preferences
- Easy to add new themes in future

### UI Component Structure

**Options Page (Full Tab):**

```
<OptionsPage>
  <PageHeader>
    <Title>OpenWebUI Assistant - Settings</Title>
    <Description>Configure your preferences</Description>
  </PageHeader>
  
  <PageBody>
    <SettingsSection label="Appearance">
      <SettingItem>
        <Label>Theme</Label>
        <ThemeSelector /> {/* Radio buttons: Light, Dark, System */}
        <Description>Choose your preferred color scheme</Description>
      </SettingItem>
    </SettingsSection>
    
    <SettingsSection label="Language">
      <SettingItem>
        <Label>Interface Language</Label>
        <LanguageSelector /> {/* Dropdown: English, Français */}
        <Description>Select your preferred language</Description>
      </SettingItem>
    </SettingsSection>
    
    <SettingsSection label="Connection">
      <SettingItem>
        <Label>OpenWebUI Instance URL</Label>
        <URLInput /> {/* Validated input */}
        <ValidationMessage /> {/* Error or success */}
        <Description>The URL of your OpenWebUI server</Description>
      </SettingItem>
    </SettingsSection>
  </PageBody>
  
  <PageFooter>
    <ResetButton>Reset to Defaults</ResetButton>
    <Spacer />
    <SaveButton>Save Changes</SaveButton>
  </PageFooter>
</OptionsPage>
```

**Design considerations:**
- Full-page layout with better space utilization
- Organized sections with clear labels and descriptions
- Standard browser extension pattern (accessible via right-click → Options)
- No UI clutter in popup/sidepanel (keeps them focused on core features)
- Can have multiple tabs/sections for future expansion
- Accessible keyboard navigation and screen reader support

### Configuration Migration

**Migration strategy for existing `ConfigManager.openWebUIBaseUrl`:**

1. On first load after upgrade, check if `extension_config` exists in storage
2. If exists and contains `openWebUIBaseUrl`, migrate to settings:
   ```typescript
   const oldConfig = await chrome.storage.local.get('extension_config');
   if (oldConfig.extension_config?.openWebUIBaseUrl) {
     await settingsManager.updateSettings({
       instanceUrl: oldConfig.extension_config.openWebUIBaseUrl
     });
     // Mark migration complete
     await chrome.storage.local.set({ 'settings_migration_v1': true });
   }
   ```
3. Update `ConfigManager.getOpenWebUIBaseUrl()` to delegate to `SettingsManager`:
   ```typescript
   getOpenWebUIBaseUrl(): string {
     return settingsManager.getSettings().instanceUrl;
   }
   ```

**Backward compatibility:**
- Keep `ConfigManager` API intact for existing code
- Delegate internally to `SettingsManager`
- No breaking changes to auth or API client code

### Language Support

**Initial languages:**
- English (en) - default
- French (fr)

**Future extensibility:**
```typescript
// src/settings/i18n.ts
const translations = {
  en: { settings: { title: 'Settings', ... } },
  fr: { settings: { title: 'Paramètres', ... } },
};

function t(key: string): string {
  const lang = settingsManager.getSettings().language;
  return translations[lang][key] || translations.en[key];
}
```

**Out of scope for this change:**
- Full i18n framework (consider react-i18next for future)
- Dynamic language loading
- RTL language support

### Validation

**Instance URL validation:**
```typescript
validateInstanceUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: false, error: 'URL is required' };
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

**Real-time validation:**
- Validate on blur for input fields
- Show error messages inline
- Disable save button if validation fails
- Clear errors on user correction

### Performance Considerations

1. **Debounced saves**: Avoid excessive storage writes when user types
2. **Cached settings**: Keep settings in memory, sync to storage on change only
3. **Lazy theme application**: Only update CSS when theme actually changes
4. **Minimal re-renders**: Use React.memo and useMemo for settings components
5. **Options page lifecycle**: Initialize settings context on page mount, cleanup on unmount

### Access Pattern

**Opening Options Page:**
```typescript
// From popup or sidepanel
const handleOpenSettings = () => {
  chrome.runtime.openOptionsPage();
};
```

**Manifest Configuration:**
```typescript
options_ui: {
  page: 'src/options/index.html',
  open_in_tab: true  // Opens in new tab for full-page experience
}
```

**Access methods:**
1. Right-click extension icon → "Options"
2. Chrome extensions page → Details → "Extension options"

### Security Considerations

1. **Instance URL**: Stored locally (not synced) to prevent accidental exposure
2. **Input sanitization**: Validate and sanitize all user inputs before storage
3. **URL validation**: Enforce HTTPS in production builds (allow HTTP in dev)
4. **No sensitive data**: Never store tokens or passwords in settings

## Open Questions / Future Considerations

1. **Should we support custom theme colors?** - Not in this phase, but architecture supports it
2. **More languages?** - Add as needed, structure supports easy expansion
3. **Settings export/import?** - Useful for backup, defer to future iteration
4. **Settings sync status indicator?** - Show when sync is in progress, defer for now
5. **Settings versioning?** - Add version field to handle future schema changes

## Testing Strategy

1. **Unit tests**: SettingsManager validation, storage, retrieval
2. **Integration tests**: Settings context with React components
3. **E2E tests**: Full user flow (open settings → change → save → verify persistence)
4. **Cross-context tests**: Verify sync between popup and sidepanel
5. **Theme tests**: Verify theme application and system theme detection
6. **Migration tests**: Verify old config migrates correctly

## Dependencies

- Existing `ConfigManager` (integration point)
- `AuthContext` pattern (similar context structure)
- Popup and Sidepanel UI components (integration points)
- Chrome Extension APIs: `chrome.storage.sync`, `chrome.storage.local`
