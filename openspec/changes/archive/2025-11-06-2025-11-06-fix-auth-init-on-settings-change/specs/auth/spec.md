# Auth Capability Spec Delta

## ADDED Requirements

### Requirement: AuthService Lifecycle Management
The AuthService SHALL support dynamic reconfiguration when the OpenWebUI instance URL changes at runtime.

#### Scenario: Reset AuthService Singleton
WHEN the extension needs to reconfigure the authentication base URL
THEN the AuthService SHALL provide a `resetInstance()` static method
AND calling this method SHALL clear the singleton instance
AND subsequent calls to `getInstance()` SHALL create a new instance with updated configuration

#### Scenario: Update AuthService Configuration
WHEN the AuthService configuration needs to be updated
THEN the AuthService SHALL provide an `updateConfig(config: AuthConfig)` method
AND calling this method SHALL update the internal base URL
AND the change SHALL take effect for all subsequent authentication operations

#### Scenario: Initialize AuthService with New URL at Runtime
WHEN the OpenWebUI instance URL is configured or changed after extension startup
THEN the background service worker SHALL detect the URL change via storage events
AND reset the existing AuthService singleton if present
AND create a new AuthService instance with the updated base URL
AND initialize the new instance
AND re-establish authentication state change listeners

### Requirement: Auth Service Availability
The AuthService SHALL be available immediately after the OpenWebUI URL is configured, without requiring an extension reload.

#### Scenario: Immediate Availability After Configuration
WHEN a user configures the OpenWebUI base URL in the options page
AND saves the settings
THEN the AuthService SHALL be initialized within the same browser session
AND the user SHALL be able to trigger authentication without reloading the extension
AND the popup or sidepanel SHALL display the login interface without errors

#### Scenario: Handle Missing Configuration
WHEN the OpenWebUI base URL is not configured or is removed
THEN the AuthService SHALL remain uninitialized (null)
AND any authentication attempts SHALL return a clear error message
AND the error message SHALL indicate that configuration is required
AND the UI SHALL display a prompt to configure the base URL

### Requirement: Background Service Storage Monitoring
The background service worker SHALL monitor storage changes to detect authentication configuration updates.

#### Scenario: Detect Instance URL Changes
WHEN the `user_settings_local` storage key changes
THEN the background worker SHALL compare the old and new `instanceUrl` values
AND if the URL has changed, trigger AuthService reinitialization
AND if the URL has not changed (only other settings changed), take no action

#### Scenario: Handle URL Removal
WHEN the instance URL is removed from settings
THEN the background worker SHALL set the AuthService reference to null
AND clear any existing authentication state
AND log the configuration change

#### Scenario: Preserve Auth State When Possible
WHEN the instance URL changes
THEN the background worker SHALL attempt to initialize the new AuthService
AND if a stored token exists, validate it against the new URL
AND only clear the token if validation against the new URL fails
AND notify all UI contexts of the authentication state change

## ADDED Requirements

### Requirement: Storage-Driven Initialization
The background service worker SHALL reactively initialize authentication services in response to configuration changes.

#### Scenario: Listen for Local Storage Changes
WHEN the extension is running
THEN the background worker SHALL have a `chrome.storage.onChanged` listener registered
AND the listener SHALL filter for changes to the `local` storage area
AND the listener SHALL specifically monitor the `user_settings_local` key

#### Scenario: Reinitialize on URL Configuration
WHEN the storage listener detects a new or changed instance URL
AND the URL is valid (not empty or undefined)
THEN the background worker SHALL:
1. Log the URL change for debugging
2. Call `AuthService.resetInstance()` to clear the singleton
3. Create a new instance with `AuthService.getInstance({ baseUrl: newUrl })`
4. Call `initialize()` on the new instance
5. Re-establish the `onAuthStateChanged` listener
6. Log successful reinitialization

#### Scenario: Handle Reinitialization Errors
WHEN reinitialization fails due to an error
THEN the background worker SHALL catch the error
AND log the error with context information
AND allow the extension to continue running
AND the auth service SHALL remain unavailable until the issue is resolved

## Implementation Notes

### Background Worker Changes
**File:** `src/background/index.ts`

Add storage change listener:
```typescript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['user_settings_local']) {
    const newLocalSettings = changes['user_settings_local'].newValue;
    const oldLocalSettings = changes['user_settings_local'].oldValue;
    
    if (newLocalSettings?.instanceUrl !== oldLocalSettings?.instanceUrl) {
      // Reinitialize logic here
    }
  }
});
```

### AuthService Changes
**File:** `src/auth/service.ts`

Add methods:
```typescript
static resetInstance(): void {
  AuthService.instance = undefined as any;
}

updateConfig(config: AuthConfig): void {
  this.config = config;
}
```

### Related Capabilities
- **settings:** Instance URL persistence and validation
- **ui:** Error display when auth service not initialized
- **openwebui-integration:** Base URL configuration for API calls
