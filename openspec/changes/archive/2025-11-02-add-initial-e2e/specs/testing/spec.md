## ADDED Requirements

### Requirement: Initial E2E smoke test
The project SHALL include a minimal end-to-end smoke test harness that can be executed in CI and locally. The harness at this stage is a placeholder that verifies the E2E pipeline is wired and runnable without product functionality.

#### Scenario: Placeholder E2E passes
- **WHEN** the test harness is executed (no product backend required)
- **THEN** the harness exits successfully (exit code 0) indicating the pipeline is wired
