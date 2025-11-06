## ADDED Requirements

### Requirement: Mock Backend Server for E2E Testing
The testing infrastructure SHALL provide a mock OpenWebUI server that simulates authentication and API endpoints without requiring a real backend.

#### Scenario: Mock server lifecycle management
GIVEN the E2E test suite is starting
WHEN the global setup runs
THEN the mock server SHALL start on a random available port
AND the server SHALL respond to health check requests
AND the base URL SHALL be made available to tests
AND WHEN the global teardown runs
THEN the mock server SHALL stop cleanly
AND all resources SHALL be released

#### Scenario: OAuth login endpoint simulation
GIVEN the mock server is running
WHEN a request is made to `/oauth/microsoft/login`
THEN the server SHALL return an HTML page
AND the page SHALL simulate the Microsoft login experience
AND the page SHALL automatically redirect to the callback URL after 100ms
AND include a test token in the callback parameters

#### Scenario: OAuth callback endpoint with Set-Cookie
GIVEN the mock server is running
WHEN a request is made to `/oauth/microsoft/callback` with a `code` parameter
THEN the server SHALL return a success page
AND set a `Set-Cookie` header with the JWT token
AND the extension SHALL be able to extract the token from the cookie
AND the page SHALL indicate successful authentication

#### Scenario: Token validation endpoint with dual auth support
GIVEN the mock server is running
WHEN a request is made to `/api/v1/auths/` with a Bearer token OR a cookie token
THEN the server SHALL validate the token format
AND return mock user data if the token is valid
AND include the token in the response if authenticated via cookie
AND return 401 Unauthorized if the token is invalid
AND return 500 Internal Server Error if configured for error mode

#### Scenario: Configurable error modes
GIVEN the mock server is running
WHEN tests need to simulate error conditions
THEN the server SHALL support error mode configuration
AND SHALL be able to return network errors
AND SHALL be able to return 401 unauthorized errors
AND SHALL be able to return 500 server errors
AND SHALL reset to normal mode between tests

### Requirement: Authentication E2E Test Coverage
The test suite SHALL include comprehensive end-to-end tests for the complete authentication flow.

#### Scenario: Complete login flow with OAuth and cookie-based token
GIVEN the extension is loaded and unauthenticated
WHEN the user clicks the login button
THEN an OAuth popup window SHALL open
AND load the mock Microsoft login page
AND automatically redirect to the callback with an OAuth `code` parameter
AND the callback response SHALL include a `Set-Cookie` header with the JWT token
AND the extension SHALL extract the token from the cookie
AND store the token in chrome.storage
AND validate the token against the mock server
AND display the user profile in the UI
AND close the OAuth popup window

#### Scenario: Logout flow with state cleanup
GIVEN the extension is authenticated
WHEN the user clicks the logout button
THEN the auth token SHALL be removed from storage
AND the user profile SHALL be hidden
AND the login button SHALL be displayed
AND the logout button SHALL be hidden
AND all auth state SHALL be cleared

#### Scenario: Authentication state persistence
GIVEN the extension is authenticated
WHEN the user closes and reopens the popup
THEN the authenticated state SHALL be restored immediately
AND the user profile SHALL be displayed
AND no re-authentication SHALL be required
AND the token SHALL still be present in storage

#### Scenario: State synchronization across UI contexts
GIVEN both popup and sidepanel are open
WHEN authentication state changes in the popup
THEN the sidepanel SHALL automatically reflect the new state
AND no manual refresh SHALL be required
AND WHEN authentication state changes in the sidepanel
THEN the popup SHALL automatically reflect the new state

#### Scenario: Network error handling during login
GIVEN the mock server is configured for network errors
WHEN the user attempts to login
THEN an appropriate error message SHALL be displayed
AND the UI SHALL remain functional
AND a retry option SHALL be available
AND no partial authentication state SHALL exist

#### Scenario: Invalid token error handling
GIVEN the mock server rejects tokens as invalid
WHEN the extension validates a stored token
THEN a 401 Unauthorized response SHALL be received
AND the user SHALL be prompted to re-authenticate
AND the old token SHALL be cleared from storage
AND the UI SHALL show the unauthenticated state

#### Scenario: Server error handling
GIVEN the mock server returns 500 errors
WHEN the extension makes API requests
THEN appropriate error messages SHALL be displayed
AND the UI SHALL guide the user on next steps
AND the extension SHALL not crash or hang

#### Scenario: OAuth timeout handling
GIVEN an OAuth flow is initiated
WHEN the OAuth callback is not received within the timeout period
THEN the authentication SHALL fail gracefully
AND an appropriate timeout error message SHALL be displayed
AND the OAuth popup window SHALL be closed
AND the user SHALL be able to retry authentication

### Requirement: Authentication Test Utilities
The test infrastructure SHALL provide reusable utilities for authentication testing.

#### Scenario: Authentication helper class
GIVEN the test utilities are available
WHEN writing authentication tests
THEN helper methods SHALL be available to open the popup
AND click the login button
AND wait for authentication to complete
AND verify authenticated state
AND verify unauthenticated state
AND inspect stored tokens
AND all helpers SHALL handle errors gracefully

#### Scenario: Mock server configuration in tests
GIVEN a test needs to simulate specific scenarios
WHEN configuring the mock server
THEN the test SHALL be able to set error modes
AND retrieve the mock server base URL
AND inspect request logs for debugging
AND reset configuration between tests

### Requirement: Test Configuration Management
The test infrastructure SHALL support configuration injection for testing with the mock server.

#### Scenario: Mock server URL configuration
GIVEN the extension is built for testing
WHEN the build completes
THEN the extension SHALL be configured with the mock server URL
AND the configuration SHALL override the default OpenWebUI URL
AND the extension SHALL use the mock server for all API calls
AND production builds SHALL not include test configuration

#### Scenario: Test environment detection
GIVEN the extension is running in a test environment
WHEN initializing services
THEN the extension SHALL use test-appropriate configuration
AND SHALL connect to the mock server
AND SHALL not attempt to connect to production services

### Requirement: Test Reliability and Maintenance
E2E authentication tests SHALL be reliable, maintainable, and execute in reasonable time.

#### Scenario: Test stability and consistency
GIVEN the authentication test suite
WHEN run multiple times consecutively
THEN all tests SHALL pass consistently
AND no flaky behavior SHALL be observed
AND results SHALL be deterministic
AND test failures SHALL be reproducible

#### Scenario: Test execution performance
GIVEN the complete authentication test suite
WHEN executed locally or in CI
THEN the suite SHALL complete in under 2 minutes
AND individual tests SHALL complete in under 30 seconds
AND no tests SHALL block indefinitely

#### Scenario: Test cleanup and isolation
GIVEN each test case
WHEN the test completes (pass or fail)
THEN all auth state SHALL be cleaned up
AND chrome.storage SHALL be cleared
AND no windows SHALL remain open
AND the mock server SHALL be reset to default state
AND subsequent tests SHALL not be affected

#### Scenario: Test debugging support
GIVEN a failing authentication test
WHEN debugging the failure
THEN request logs SHALL be available from the mock server
AND Playwright traces SHALL capture the failure
AND screenshots SHALL be available for failed tests
AND console logs SHALL be captured for analysis
