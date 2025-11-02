## Why

We need a minimal, low-friction starting point for end-to-end tests so that future change proposals can include E2E coverage as part of the CI process. This change adds an initial E2E scaffold without implementing any product functionality (no auth, no backend integration).

This repository project must be scaffolded using https://github.com/crxjs/create-crxjs to create the Chrome extension project structure.

## What Changes

- Add a new OpenSpec change `add-initial-e2e` that documents the intent to add E2E scaffolding.
- Add a spec delta describing the requirement for an initial E2E smoke test.

## Impact

- Affects testing infrastructure and documentation only.
- No runtime or user-facing changes.
