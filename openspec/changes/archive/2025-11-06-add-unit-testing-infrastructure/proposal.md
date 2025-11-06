# Change Proposal: add-unit-testing-infrastructure

## Summary
Establish a comprehensive unit testing infrastructure using Vitest to provide fast, isolated testing for business logic, utilities, and services across the extension. While E2E tests already exist for integration scenarios, unit tests will enable rapid feedback during development, improve code quality, and ensure individual components work correctly in isolation.

## Motivation
Currently, the project has:
- E2E tests using Playwright for integration testing
- Some unit test files that import from `vitest` but no test runner configuration
- No npm scripts to execute unit tests
- No clear documentation or patterns for writing unit tests

This gap means:
- Developers cannot quickly test individual functions or modules in isolation
- Test feedback is slow (E2E tests take minutes; unit tests should take seconds)
- Coverage gaps exist for utility functions, error handling, and edge cases
- Refactoring is riskier without fast unit test feedback

## Goals
1. Configure Vitest as the unit test runner with proper TypeScript and browser API support
2. Add npm scripts for running unit tests (`test:unit`, `test:unit:watch`, `test:unit:coverage`)
3. Provide test utilities and mocking patterns for Chrome extension APIs (where needed)
4. Document unit testing patterns and best practices (focus: when NOT to unit test)
5. Establish pragmatic code coverage baseline and reporting (~50% overall, focus on pure logic)
6. Ensure existing unit test files run successfully
7. Add unit tests ONLY for isolated business logic and utilities (crypto, theme resolution)
8. **Explicitly avoid over-testing**: Skip React contexts, components, and integration code already covered by E2E

## Non-Goals
- Replacing or modifying E2E tests (they serve a different purpose)
- Achieving high code coverage (pragmatic ~50% target, focused on pure logic)
- Testing visual/rendering aspects (use E2E tests for full UI flows)
- Testing React contexts or components (too integration-heavy, E2E covers these)
- Testing Chrome API integrations in detail (E2E tests cover storage, runtime, etc.)
- Adding integration tests (focus on isolated unit-level testing of pure functions)

## Scope
This change affects:
- **testing** spec (add pragmatic unit testing requirements)
- Project configuration (add `vitest.config.ts`)
- Package dependencies (ensure `vitest` and related packages are installed)
- Documentation (create unit testing guidelines with clear "when NOT to unit test" guidance)
- Existing unit test files (validate they run correctly)
- New unit tests for isolated utilities only (crypto, theme resolution, error handling)

## Dependencies
None - this is a foundational testing infrastructure change.

## Risks and Mitigations
1. **Risk**: Existing unit test files may fail due to missing mocks or configuration
   - **Mitigation**: Test each existing file, add necessary mocks and setup

2. **Risk**: Chrome extension APIs are difficult to mock in unit tests
   - **Mitigation**: Provide mock utilities and patterns for common APIs (chrome.storage, chrome.runtime)

3. **Risk**: Developers may not know when to write unit vs E2E tests
   - **Mitigation**: Document clear guidelines: unit tests for pure logic/utilities only, E2E for integration/UI/Chrome APIs

## Implementation Notes
- Use Vitest (consistent with modern TypeScript/Vite ecosystem)
- Configure happy-dom or jsdom for minimal browser environment simulation
- Use `vi` mocking utilities sparingly (prefer testing pure functions without mocks)
- Follow AAA (Arrange-Act-Assert) pattern in tests
- Group tests by module/feature
- Target ~50% overall code coverage, >70% for pure utility functions
- **Key principle**: If a test requires complex mocking of Chrome APIs or React, it belongs in E2E, not unit tests
