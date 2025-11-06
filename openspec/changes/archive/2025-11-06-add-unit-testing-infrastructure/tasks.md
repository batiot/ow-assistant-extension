# Implementation Tasks

## Phase 1: Configuration and Infrastructure
- [x] Install Vitest and related dependencies
  - Add `vitest` as devDependency
  - Add `@vitest/ui` for test UI
  - Add `@vitest/coverage-v8` for coverage reporting
  - Add `happy-dom` for browser environment simulation
  - Validation: Run `npm install` successfully

- [x] Create `vitest.config.ts`
  - Configure TypeScript path aliases (`@/` -> `src/`)
  - Set test environment to `happy-dom`
  - Configure coverage reporting (output to `coverage/`, formats: html, json, text)
  - Set pragmatic coverage thresholds (50% overall, 70% for pure utilities)
  - Exclude E2E tests and build artifacts from test discovery
  - Validation: Configuration loads without errors

- [x] Add npm scripts to `package.json`
  - Add `test:unit` script: `vitest run`
  - Add `test:unit:watch` script: `vitest watch`
  - Add `test:unit:coverage` script: `vitest run --coverage`
  - Add `test:unit:ui` script: `vitest --ui`
  - Validation: Each script executes without errors

- [x] Update `.gitignore`
  - Add `coverage/` directory
  - Add `.vitest/` directory
  - Validation: Git status shows these directories ignored

## Phase 2: Chrome API Mocking Utilities (Minimal)
- [x] Create minimal test utilities for Chrome API mocks
  - Create `test/unit/mocks/chrome-storage.ts` for basic storage mocks (only if needed by existing tests)
  - Create `test/unit/mocks/index.ts` to export mocks
  - Keep mocks simple and minimal (avoid over-engineering)
  - Validation: Existing tests can import and use basic mocks

- [x] Create global test setup file (optional)
  - Create `test/unit/setup.ts` only if shared setup is needed
  - Configure minimal Chrome API mocks if required by existing tests
  - Validation: Tests run without Chrome API errors

## Phase 3: Validate Existing Tests
- [x] Run existing auth unit tests
  - Execute `test/unit/auth/retry.test.ts`
  - Execute `test/unit/auth/storage.test.ts`
  - Execute `test/unit/auth/service.test.ts`
  - Fix any configuration or import issues
  - Validation: All auth tests pass

- [x] Run existing settings unit tests
  - Execute `test/unit/settings/manager.test.ts`
  - Fix any configuration or import issues
  - Validation: All settings tests pass

- [x] Fix any failing tests
  - Add missing Chrome API mocks where needed
  - Update import paths if necessary
  - Ensure proper test isolation
  - Validation: `npm run test:unit` passes with 0 failures

## Phase 4: Add New Unit Tests

### Core Utilities and Services
- [x] Add auth crypto unit tests
  - Create `test/unit/auth/crypto.test.ts`
  - Test encryption key generation and storage
  - Test token encryption and decryption
  - Test error handling for corrupted keys
  - Mock crypto.subtle and chrome.storage APIs
  - Validation: Tests pass and achieve >70% coverage for `src/auth/crypto.ts`

- [x] Add API client unit tests (keep focused on error handling)
  - Create `test/unit/api/client.test.ts`
  - Test ApiError class construction and properties
  - Test basic request header construction
  - Test error response parsing
  - Mock fetch API minimally (E2E already tests full API flows)
  - Validation: Tests pass and achieve >50% coverage for `src/api/client.ts` (focus on error logic only)

- [x] Add config manager unit tests (minimal - E2E covers most scenarios)
  - Create `test/unit/config/manager.test.ts`
  - Test configuration validation logic only
  - Test default value handling
  - Skip storage integration tests (already covered by E2E)
  - Validation: Tests pass and achieve >40% coverage for `src/config/manager.ts`

- [x] Add settings theme unit tests
  - Create `test/unit/settings/theme.test.ts`
  - Test theme detection and resolution (light/dark/system)
  - Test theme application to document
  - Test system theme preference detection
  - Test watchSystemTheme listener and cleanup
  - Mock window.matchMedia
  - Validation: Tests pass and achieve >70% coverage for `src/settings/theme.ts`

### Skip: React Contexts and Components
**Note**: React contexts and components are heavily integration-dependent and already thoroughly tested by E2E tests. Unit testing them would require complex mocking of Chrome APIs, React hooks, and provider hierarchies, providing minimal additional value. Focus unit tests on pure business logic and utilities instead.

## Phase 5: Documentation
- [x] Create unit testing guide
  - Create `docs/UNIT_TESTING.md`
  - **Emphasize when NOT to unit test**: Skip React components, contexts, Chrome API integration
  - Document when to use unit tests vs E2E tests (decision tree/flowchart)
  - Provide examples of good unit test targets (pure functions, utilities, error handling)
  - Document minimal Chrome API mocking patterns
  - Explain pragmatic coverage expectations (~50% overall, >70% for pure logic)
  - Include troubleshooting section
  - Validation: Documentation clearly guides developers to avoid over-testing

- [x] Update main README
  - Add section on running unit tests
  - Link to unit testing guide
  - Validation: README accurately reflects test commands

## Phase 6: CI Integration
- [x] Update CI workflow
  - Add unit test execution step in CI pipeline
  - Run tests before E2E tests (fail fast)
  - Generate and upload coverage reports
  - Add coverage reporting to PR comments (if possible)
  - Validation: CI runs unit tests successfully

- [x] Verify coverage thresholds
  - Run full test suite with coverage
  - Adjust coverage thresholds to realistic levels (~50% overall)
  - Accept lower coverage for integration-heavy modules (E2E covers them)
  - Document which modules are intentionally excluded from unit testing
  - Validation: Coverage report meets pragmatic thresholds without forcing over-testing

## Phase 7: Final Validation
- [x] Run complete test suite
  - Execute `npm run test:unit` - should pass
  - Execute `npm run test:unit:coverage` - should meet thresholds
  - Execute `npm run test:unit:watch` - should enter watch mode
  - Execute `npm run test:unit:ui` - should open UI
  - Validation: All test commands work as expected

- [x] Verify test performance
  - Measure unit test execution time
  - Ensure complete suite runs in under 10 seconds
  - Validation: Performance targets met

- [x] Check test isolation and reliability
  - Run tests 5 times consecutively
  - Verify no flaky failures
  - Verify no order dependencies
  - Validation: 100% consistent results across runs

## Dependencies
- Phase 2 depends on Phase 1 (need config before utilities)
- Phase 3 depends on Phases 1 and 2 (need config and mocks)
- Phase 4 depends on Phases 1 and 2 (need config and mocks)
- Phase 5 can be done in parallel with Phase 4
- Phase 6 depends on Phases 3 and 4 (need working tests)
- Phase 7 depends on all previous phases (final validation)

## Parallelization Opportunities
- Phase 4 tasks can be done in any order (independent test files)
- Phase 5 can be started during Phase 4
- Individual component tests within Phase 4 are independent
