# testing Specification Delta

## ADDED Requirements

### Requirement: Unit Test Infrastructure Configuration
The project SHALL provide a complete Vitest-based unit testing infrastructure with proper TypeScript support and Chrome extension API mocking capabilities.

#### Scenario: Vitest configuration exists
GIVEN the project root directory
WHEN checking for test configuration files
THEN a `vitest.config.ts` file SHALL exist
AND it SHALL configure TypeScript path aliases matching the main build
AND it SHALL configure a browser-like test environment (happy-dom or jsdom)
AND it SHALL configure coverage reporting with appropriate thresholds
AND it SHALL exclude E2E tests from unit test execution

#### Scenario: Unit test execution scripts
GIVEN the package.json file
WHEN reviewing npm scripts
THEN a `test:unit` script SHALL exist to run all unit tests
AND a `test:unit:watch` script SHALL exist for watch mode during development
AND a `test:unit:coverage` script SHALL exist to generate coverage reports
AND all scripts SHALL execute successfully with exit code 0

#### Scenario: Chrome extension API mocking utilities
GIVEN the test utilities directory
WHEN writing unit tests that depend on Chrome APIs
THEN mock utilities SHALL be available for `chrome.storage` operations
AND mock utilities SHALL be available for `chrome.runtime` messaging
AND mock utilities SHALL be available for `chrome.tabs` operations
AND mocks SHALL provide realistic behavior and type safety

### Requirement: Unit Test Coverage for Core Modules
The project SHALL include unit tests for isolated business logic, utilities, and pure functions. Complex integration scenarios and UI flows are covered by E2E tests.

#### Scenario: Authentication module unit tests
GIVEN the authentication module at `src/auth/`
WHEN running unit tests
THEN `retry.test.ts` SHALL execute successfully and pass all assertions
AND `storage.test.ts` SHALL execute successfully and pass all assertions
AND `service.test.ts` SHALL execute successfully and pass all assertions
AND `crypto.test.ts` SHALL test encryption/decryption functionality
AND tests SHALL cover success paths, error conditions, and edge cases
AND tests SHALL achieve >70% code coverage for pure utility functions (crypto, retry)

#### Scenario: Settings module unit tests
GIVEN the settings module at `src/settings/`
WHEN running unit tests
THEN `manager.test.ts` SHALL execute successfully and pass all assertions
AND `theme.test.ts` SHALL test theme resolution logic (pure function)
AND tests SHALL cover theme switching calculation and system theme detection
AND tests SHALL NOT duplicate E2E coverage of persistence and UI integration
AND tests SHALL achieve >70% code coverage for theme.ts

#### Scenario: API client unit tests (focused on error handling)
GIVEN the API client at `src/api/`
WHEN running unit tests
THEN tests SHALL exist for ApiError class construction
AND tests SHALL exist for error response parsing
AND tests SHALL exist for request header construction
AND tests SHALL NOT duplicate E2E coverage of full API flows
AND tests SHALL achieve >50% code coverage (focus on error logic only)

#### Scenario: Config manager unit tests (validation logic only)
GIVEN the config manager at `src/config/`
WHEN running unit tests
THEN tests SHALL exist for configuration validation logic
AND tests SHALL exist for default value handling
AND tests SHALL NOT duplicate E2E coverage of storage integration
AND tests SHALL achieve >40% code coverage for validation functions

#### Scenario: Skip over-testing UI and integration layers
GIVEN React contexts at `src/contexts/` and components at `src/components/`
WHEN considering unit test coverage
THEN unit tests SHALL NOT be created for these modules
AND E2E tests already provide comprehensive coverage for UI flows
AND unit testing these would require complex mocking with minimal value
AND testing resources SHALL focus on isolated business logic instead

### Requirement: Unit Test Documentation and Patterns
The project SHALL provide clear documentation and examples for writing effective unit tests.

#### Scenario: Unit testing guidelines document
GIVEN the project documentation
WHEN a developer needs to write unit tests
THEN a unit testing guide SHALL exist
AND it SHALL explain when to use unit tests vs E2E tests
AND it SHALL provide examples of testing patterns (AAA, mocking, assertions)
AND it SHALL document Chrome API mocking patterns
AND it SHALL explain coverage expectations

#### Scenario: Test file organization
GIVEN the test directory structure
WHEN organizing unit tests
THEN unit tests SHALL be located in `test/unit/` directory
AND SHALL mirror the source directory structure
AND test files SHALL be named `*.test.ts` or `*.test.tsx`
AND each source module SHALL have a corresponding test file

### Requirement: Code Coverage Reporting
The project SHALL generate and track code coverage metrics for unit tests.

#### Scenario: Coverage report generation
GIVEN the unit test suite
WHEN running tests with coverage enabled
THEN a coverage report SHALL be generated
AND it SHALL include line, branch, function, and statement coverage
AND it SHALL output to a `coverage/` directory
AND it SHALL support HTML, JSON, and terminal output formats

#### Scenario: Coverage thresholds (pragmatic targets)
GIVEN the Vitest configuration
WHEN checking coverage settings
THEN minimum coverage thresholds SHALL be defined pragmatically
AND pure utility modules (crypto, retry, theme) SHALL require >70% coverage
AND modules with storage integration SHALL require >40% coverage (E2E covers the rest)
AND overall project coverage SHALL target >50% (focusing on testable logic)
AND failing to meet thresholds SHALL cause test runs to fail

#### Scenario: Coverage in CI
GIVEN the CI/CD pipeline
WHEN running tests
THEN unit test coverage SHALL be calculated and reported
AND coverage trends SHALL be tracked over time
AND pull requests SHALL display coverage changes

### Requirement: Unit Test Performance
Unit tests SHALL execute quickly to provide rapid feedback during development.

#### Scenario: Fast test execution
GIVEN the complete unit test suite
WHEN running all unit tests
THEN execution SHALL complete in under 10 seconds
AND individual test files SHALL complete in under 2 seconds
AND watch mode SHALL provide near-instant feedback on file changes

#### Scenario: Isolated test execution
GIVEN any single test file
WHEN running it in isolation
THEN it SHALL execute independently without setup from other tests
AND it SHALL not depend on execution order
AND it SHALL clean up all mocks and state after execution

### Requirement: Unit Test Maintenance and Quality
Unit tests SHALL be maintainable, reliable, and follow established patterns.

#### Scenario: Test reliability
GIVEN the unit test suite
WHEN run multiple times consecutively
THEN all tests SHALL pass consistently
AND no flaky behavior SHALL be observed
AND results SHALL be deterministic
AND tests SHALL not depend on timing or external state

#### Scenario: Test readability and structure
GIVEN any unit test file
WHEN reviewing the code
THEN tests SHALL follow the AAA (Arrange-Act-Assert) pattern
AND test descriptions SHALL clearly state the behavior being tested
AND tests SHALL be focused on a single behavior per test case
AND setup and teardown SHALL be clearly separated

#### Scenario: Mock hygiene
GIVEN tests that use mocks
WHEN the test completes
THEN all mocks SHALL be automatically cleared
AND no mock state SHALL leak between tests
AND `beforeEach` and `afterEach` hooks SHALL handle cleanup
AND mock utilities SHALL be type-safe
