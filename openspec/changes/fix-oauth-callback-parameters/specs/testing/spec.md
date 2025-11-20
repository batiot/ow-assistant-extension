# Testing Capability Spec Delta

## MODIFIED Requirements

### Requirement: Unit Testing

The extension SHALL have comprehensive unit test coverage for all authentication flows.

#### Scenario: Mock launchWebAuthFlow with Realistic URLs

**WHEN** unit tests mock `chrome.identity.launchWebAuthFlow`
**THEN** the mock SHALL return URLs that match the actual Chrome behavior after declarativeNetRequest redirect
**AND** the mocked URL SHALL include all query parameters: `code`, `state`, `session_state`, and `provider`
**AND** the URL format SHALL be: `chrome-extension://<id>/src/pages/oauth-callback.html?provider=<provider>&code=<code>&state=<state>`
**AND** the mock SHALL NOT return URLs with query parameters that wouldn't be preserved in reality
**AND** tests SHALL validate that the auth service correctly extracts all parameters from the returned URL

#### Scenario: Test Provider Extraction

**WHEN** testing the token exchange flow
**THEN** tests SHALL verify that the `provider` parameter is extracted from the callback URL
**AND** verify that the correct provider-specific token exchange endpoint is called
**AND** test multiple provider scenarios (microsoft, google, etc.)
**AND** validate error handling when provider parameter is missing
**AND** ensure no hardcoded provider assumptions in the code

## ADDED Requirements

### Requirement: Callback Page Testing

The OAuth callback page SHALL be testable in isolation to verify parameter handling and UI feedback.

#### Scenario: Callback Page Unit Tests

**WHEN** testing the callback page
**THEN** tests SHALL load the page with various query parameter combinations
**AND** verify correct DOM updates for success state (code present)
**AND** verify correct DOM updates for error state (error parameter present)
**AND** verify correct DOM updates for missing code state
**AND** validate that appropriate messages are displayed for each state
**AND** confirm that parameter parsing handles URL-encoded values correctly

#### Scenario: End-to-End OAuth Flow Testing

**WHEN** running E2E tests for authentication
**THEN** tests SHALL verify that the declarativeNetRequest rule correctly intercepts the callback
**AND** confirm that query parameters are preserved through the redirect
**AND** validate that the callback page renders with the correct parameters
**AND** verify that `launchWebAuthFlow` returns a complete URL with all parameters
**AND** confirm that token exchange uses the extracted provider name
**AND** ensure the entire flow completes successfully with a valid authentication token
