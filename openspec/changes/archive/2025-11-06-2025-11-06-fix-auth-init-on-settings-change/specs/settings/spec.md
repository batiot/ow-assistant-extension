# Settings Capability Spec Delta

## MODIFIED Requirements

### Requirement: Settings Storage and Persistence
The extension SHALL store user settings persistently using Chrome storage APIs with appropriate storage tiers for different setting types, AND changes SHALL trigger appropriate initialization in dependent services.

#### Scenario: Store Instance URL in Local Storage (Enhanced)
WHEN a user changes the OpenWebUI instance URL
THEN the extension SHALL store the URL in `chrome.storage.local`
AND the URL SHALL remain device-specific
AND the storage SHALL use the key `user_settings_local`
AND the storage change event SHALL trigger authentication service reinitialization
AND the auth service SHALL become available for use without extension reload

#### Scenario: Instance URL Change Propagation
WHEN the instance URL is updated in settings
THEN the change SHALL propagate via `chrome.storage.onChanged` events
AND the background service worker SHALL detect the change
AND dependent services (e.g., AuthService) SHALL reinitialize with the new URL
AND all UI contexts SHALL reflect the updated configuration state

## ADDED Requirements

### Requirement: Settings Change Notification
The settings system SHALL notify dependent services when critical configuration changes occur.

#### Scenario: Notify Background Services of URL Changes
WHEN the instance URL changes in `user_settings_local`
THEN a storage change event SHALL be fired
AND the event SHALL contain both old and new values
AND listeners in the background worker SHALL receive the event
AND services SHALL react appropriately to the configuration change

#### Scenario: Distinguish URL Changes from Other Setting Changes
WHEN any setting in `user_settings_local` changes
THEN listeners SHALL be able to distinguish instance URL changes from other changes
AND listeners SHALL be able to compare old vs new URL values
AND listeners SHALL only trigger reinitialization when the URL actually changed

## Implementation Notes

### No Code Changes Required
The SettingsManager already correctly triggers storage events. The changes for this proposal are in the background worker and AuthService (see auth spec delta).

### Storage Event Structure
When instance URL changes, the event structure is:
```typescript
{
  changes: {
    'user_settings_local': {
      oldValue: { instanceUrl: 'https://old-url.com' },
      newValue: { instanceUrl: 'https://new-url.com' }
    }
  },
  areaName: 'local'
}
```

### Related Capabilities
- **auth:** AuthService initialization depends on instance URL
- **openwebui-integration:** API client configuration requires instance URL
- **ui:** Options page provides URL configuration interface

## Testing Considerations

### Existing Tests
The current settings E2E tests verify URL storage and retrieval. These tests should continue to pass without modification.

### Additional Test Scenarios (Future)
- Verify auth service availability after URL configuration
- Verify auth service reinitialization when URL changes
- Verify multiple rapid URL changes are handled correctly
- Verify URL removal clears auth service
