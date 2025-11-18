# Auth Capability Spec Delta

## MODIFIED Requirements

### Requirement: Storage-Driven Initialization
The background service worker SHALL reactively initialize authentication services in response to configuration changes **AND SHALL initialize on startup when a valid instance URL is present (from storage or defaults)**.

#### Scenario: Initialize on Startup with Default URL
**WHEN** the extension starts for the first time (fresh install)
**AND** no instance URL exists in storage
**AND** the settings manager returns the compile-time default URL (e.g., `http://localhost:8080`)
**AND** the default URL is not empty
**THEN** the background worker SHALL:
1. Retrieve the instance URL from `configManager.getOpenWebUIBaseUrl()`
2. Recognize the default URL as a valid configuration
3. Initialize the authentication service with `AuthService.getInstance({ baseUrl })`
4. Call `initialize()` on the auth service instance
5. Establish the `onAuthStateChanged` listener
6. Log the initialization with the default URL for debugging

#### Scenario: Distinguish Default URL from Explicitly Cleared URL
**WHEN** determining whether to initialize the auth service
**THEN** the system SHALL treat an empty string or undefined URL as "not configured"
**AND** SHALL treat any non-empty URL (including compile-time defaults) as "configured"
**AND** SHALL NOT initialize auth service when URL is explicitly empty
**AND** SHALL initialize auth service when URL contains the default value from code

#### Scenario: Reinitialize on URL Configuration (No Change)
**WHEN** the storage listener detects a new or changed instance URL
**AND** the URL is valid (not empty or undefined)
**THEN** the background worker SHALL:
1. Log the URL change for debugging
2. Call `AuthService.resetInstance()` to clear the singleton
3. Create a new instance with `AuthService.getInstance({ baseUrl: newUrl })`
4. Call `initialize()` on the new instance
5. Re-establish the `onAuthStateChanged` listener
6. Log successful reinitialization

*Note: This scenario is unchanged from the original spec but included for completeness.*
