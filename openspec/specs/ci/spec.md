# ci Specification

## Purpose
TBD - created by archiving change 2025-11-02-add-ci-workflow. Update Purpose after archive.
## Requirements
### Requirement: The project SHALL provide automated CI validation

The project SHALL include a GitHub Actions workflow that validates extension changes through automated builds and tests.

#### Scenario: Run tests on pull request

GIVEN a pull request is opened against `develop` or `main`
WHEN the CI workflow runs
THEN the following steps SHALL complete successfully:
  - TypeScript compilation (`tsc -b --noEmit`)
  - Extension package build (`npm run build`)
  - Playwright e2e tests (`npm run test:e2e`)
AND the following artifacts SHALL be uploaded:
  - Extension package zip from the `release/` directory
  - Playwright test report from `playwright-report/`

#### Scenario: Manual workflow trigger

GIVEN a user triggers the workflow manually via `workflow_dispatch`
WHEN the CI workflow runs
THEN the same validation steps SHALL complete:
  - TypeScript compilation
  - Extension build
  - E2E tests
AND artifacts SHALL be uploaded:
  - Extension package
  - Test report

