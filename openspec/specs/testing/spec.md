# testing Specification

## Purpose
TBD - created by archiving change add-initial-e2e. Update Purpose after archive.
## Requirements
### Requirement: Initial E2E smoke test
The project SHALL include a minimal end-to-end smoke test harness that can be executed in CI and locally. The harness at this stage is a placeholder that verifies the E2E pipeline is wired and runnable without product functionality.

#### Scenario: Placeholder E2E passes
- **WHEN** the test harness is executed (no product backend required)
- **THEN** the harness exits successfully (exit code 0) indicating the pipeline is wired

### Requirement: Extension Testing Environment Setup
The system SHALL provide a consistent and isolated testing environment for running E2E tests.
#### Scenario: Setting up a test browser with the extension
Given a clean browser profile
When the test environment is initialized
Then the extension should be loaded automatically
And the extension should be in a known good state

#### Scenario: Mocking backend services
Given the test environment is running
When the extension makes API calls
Then they should be intercepted by mock services
And the mocks should provide predictable test data

### Requirement: Basic Extension Functionality Testing
The system SHALL validate core extension functionality through automated tests.
#### Scenario: Extension loads successfully
Given a test browser instance
When the extension is loaded
Then no console errors should be present
And the extension should be visible in the browser toolbar

#### Scenario: Popup UI verification
Given the extension is loaded
When the user clicks the extension icon
Then the popup should open
And required UI elements should be present and visible

#### Scenario: Sidepanel functionality
Given the extension is loaded
When the sidepanel is opened
Then it should render without errors
And core UI components should be interactive

#### Scenario: Content script injection
Given a test webpage is loaded
When the extension is active
Then the content script should be injected
And required functionality should be available in the page context

### Requirement: Test Infrastructure Management
The system SHALL provide robust infrastructure for running and managing tests.
#### Scenario: Running tests locally
Given the development environment is set up
When running npm test:e2e
Then all e2e tests should execute
And results should be clearly reported

#### Scenario: CI test execution
Given a CI environment
When tests are triggered by a pull request
Then they should run automatically
And results should be reported in the PR

#### Scenario: Test debugging
Given a failing test
When running in debug mode
Then developers should have access to Playwright's debugging tools
And test state should be inspectable

### Requirement: Test Documentation Management
The system SHALL provide comprehensive documentation for test development.
#### Scenario: Writing new tests
Given the testing documentation
When a developer needs to add new tests
Then they should find clear guidelines and examples
And common patterns should be well documented

### Requirement: Test Helper Functions
The system SHALL provide reusable test utilities to simplify test creation and maintenance.
#### Scenario: Loading extension in tests
Given test utilities are available
When setting up a test
Then helpers should simplify extension loading
And provide consistent initialization

#### Scenario: Common testing operations
Given test utilities are implemented
When writing new tests
Then common operations should be abstracted
And reduce duplicate code across tests

### Requirement: Backend Service Mocking
The system SHALL provide reliable mock services for testing without real backend dependencies.
#### Scenario: Backend service mocking
Given mock utilities are available
When tests require backend responses
Then mocks should be easy to configure
And provide realistic test data

### Requirement: Test Results Reliability
The system SHALL provide consistent and reliable test results.
#### Scenario: Test stability
Given the e2e test suite
When run multiple times
Then results should be consistent
And flaky tests should be identified and fixed

### Requirement: Test Maintenance
The system SHALL be maintainable and support easy addition of new tests.
#### Scenario: Adding new tests
Given the testing infrastructure
When new features need test coverage
Then adding tests should follow established patterns
And leverage existing utilities

### Requirement: Test Performance
The system SHALL execute tests in a reasonable timeframe.
#### Scenario: Test execution time
Given the complete test suite
When running all tests
Then they should complete in a reasonable time
And not block development workflow

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

