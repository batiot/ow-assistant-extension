# ci Specification Delta

## ADDED Requirements

### Requirement: Support Optional Extension Key in CI Builds
The CI workflow SHALL support building the extension with an optional fixed public key for stable extension ID across builds.

#### Scenario: CI build with optional extension key
GIVEN the CI workflow is running
WHEN the `EXT_PUBLIC_KEY` repository secret is defined
THEN the secret SHALL be passed to the build process as an environment variable
AND the built extension SHALL include the public key in the manifest
AND the extension ID SHALL be deterministic and stable across CI runs
AND the extension package artifact SHALL contain the keyed manifest

#### Scenario: CI build without extension key (default)
GIVEN the CI workflow is running
WHEN the `EXT_PUBLIC_KEY` repository secret is not defined
THEN the build SHALL proceed without a manifest key field
AND the extension SHALL load with a Chrome-generated ephemeral ID
AND E2E tests SHALL dynamically discover the extension ID
AND all tests SHALL pass without requiring a fixed key

#### Scenario: Documentation for CI key configuration
GIVEN a developer needs to configure a fixed extension ID in CI
WHEN they consult the CI documentation
THEN they SHALL find clear instructions for:
  - Generating a public key via `chrome --pack-extension`
  - Adding the `EXT_PUBLIC_KEY` secret to the GitHub repository
  - Understanding when to use a fixed key (optional for testing stability)
  - Removing the key for Chrome Web Store publishing

## MODIFIED Requirements

None. Existing CI requirements remain unchanged; this adds optional configuration.

## REMOVED Requirements

None.
