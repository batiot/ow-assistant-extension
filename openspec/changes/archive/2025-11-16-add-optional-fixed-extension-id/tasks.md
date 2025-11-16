# Implementation Tasks

## Overview
Add optional fixed extension ID support via configurable manifest key. This is an opt-in feature that stabilizes the extension ID for development and testing while maintaining full backward compatibility.

## Tasks

### 1. Update manifest configuration
- [x] Edit `manifest.config.ts` to add optional `key` field
- [x] Use spread operator to conditionally include key: `...(process.env.EXT_PUBLIC_KEY && { key: process.env.EXT_PUBLIC_KEY })`
- [x] Add inline comments explaining:
  - Purpose: Stable extension ID for development/testing
  - When to use: Optional for dev/testing stability
  - When not to use: Remove for Chrome Web Store publishing
  - How Chrome derives ID from the public key
- [x] Verify manifest builds correctly with and without env var set

**Validation:**
- Build succeeds: `npm run build` (without env var)
- Build succeeds: `EXT_PUBLIC_KEY="test" npm run build` (with env var)
- Check `dist/manifest.json` has no `key` field when env var unset
- Check `dist/manifest.json` has `key` field when env var is set

### 2. Document key generation process
- [x] Add new section to `README.md`: "Optional: Stabilize Extension ID for Development"
- [x] Include step-by-step key generation instructions:
  - Run `chrome --pack-extension=./dist` to generate `.pem` private key
  - Extract public key from generated `.crx` or manifest
  - Set `EXT_PUBLIC_KEY` environment variable with base64 public key
- [x] Document use cases:
  - When you need a stable ID (external integrations, debugging)
  - When you don't need it (default Chrome behavior works fine)
- [x] Add security warnings:
  - Never commit the private `.pem` key to version control
  - Add `.pem` to `.gitignore` if not already present
  - Public key is safe to share but private key must remain secret
- [x] Document Chrome Web Store implications:
  - Must remove `key` field before publishing to store
  - Store assigns its own authoritative ID
  - Use conditional env var to control presence

**Validation:**
- Documentation is clear and includes all necessary warnings
- Instructions are copy-paste ready
- Use cases and anti-patterns are explained

### 3. Update E2E testing documentation
- [x] Add section to `docs/E2E_TESTING.md`: "Optional: Using a Fixed Extension ID"
- [x] Explain that tests already handle dynamic IDs (no changes required)
- [x] Document when a fixed ID might be useful:
  - Debugging test failures with consistent URLs
  - External test tooling that hardcodes extension URLs
  - Reduce test setup polling time (marginal benefit)
- [x] Emphasize this is optional and tests work without it

**Validation:**
- E2E docs accurately reflect current test behavior
- Optional nature is clear
- No implication that tests require a fixed key

### 4. Add .gitignore entry for private keys
- [x] Check if `.gitignore` already excludes `*.pem` files
- [x] Add `*.pem` to `.gitignore` if missing
- [x] Add comment explaining: "Chrome extension private keys - never commit"

**Validation:**
- `.pem` files are ignored by git
- Comment explains why

### 5. Update CI workflow (optional)
- [x] Add optional `EXT_PUBLIC_KEY` secret documentation to CI docs
- [x] Document in `.github/workflows/ci.yml` comments or README that:
  - `EXT_PUBLIC_KEY` can be added as a repository secret
  - This makes CI builds have stable IDs
  - This is completely optional
- [x] No code changes needed (env var passthrough already works)

**Validation:**
- CI documentation mentions optional secret
- No breaking changes to CI workflow

### 6. Verify backward compatibility
- [x] Run E2E tests without `EXT_PUBLIC_KEY`: `npm run test:e2e`
- [x] Verify all tests pass (dynamic ID discovery works)
- [x] Generate a test key and run tests with `EXT_PUBLIC_KEY` set
- [x] Verify all tests pass (fixed ID works with existing test utils)
- [x] Confirm no test code changes are needed

**Validation:**
- All E2E tests pass without env var (baseline)
- All E2E tests pass with env var (compatibility)
- No test failures introduced

### 7. Final validation
- [x] Run `openspec validate add-optional-fixed-extension-id --strict`
- [x] Resolve any validation errors
- [x] Verify all task checkboxes can be completed
- [x] Commit changes with clear message

**Validation:**
- `openspec validate` passes with zero errors
- All documentation is accurate
- Code changes are minimal and focused

## Dependencies

- No blocking dependencies - all tasks can be completed independently
- Task 6 (testing) should be done after Task 1 (implementation)
- Documentation tasks (2, 3, 4, 5) can be done in parallel

## Verification Checklist

Before marking complete:
- [x] Manifest builds with and without env var
- [x] Documentation is complete and accurate
- [x] Security warnings are prominent
- [x] Tests pass in both modes
- [x] No breaking changes to existing behavior
- [x] `openspec validate --strict` passes
