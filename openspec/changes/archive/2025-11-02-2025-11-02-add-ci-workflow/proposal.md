# Add CI Workflow

## Summary

Add a GitHub Actions workflow that performs a TypeScript typecheck, builds the extension (producing the release zip), runs Playwright e2e tests, and uploads artifacts (release zip and Playwright report).

## Motivation

Automate verification of builds and e2e tests on push/PRs and provide a packaged extension artifact for releases.

## What this change touches

- Adds a workflow file: `.github/workflows/ci.yml`
- Adds an OpenSpec change folder describing the change and tasks

## Acceptance criteria

- CI runs on push/PR and workflow_dispatch
- CI performs typecheck, build, and e2e tests
- Build step produces a zip artifact and it is uploaded as a workflow artifact
- Playwright report is uploaded as an artifact after e2e runs

## Assumptions

- The repo already defines `npm run build` and `npm run test:e2e` (confirmed in `package.json`).
- Playwright tests run headless on `ubuntu-latest` (no additional infra required).
