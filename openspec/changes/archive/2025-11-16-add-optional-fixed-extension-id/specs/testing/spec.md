# testing Specification Delta

## ADDED Requirements

### Requirement: Optional Fixed Extension ID for Testing
The extension manifest SHALL support an optional fixed extension ID via a configurable public key to stabilize the ID across development and testing environments.

#### Scenario: Build with fixed extension ID
GIVEN the `EXT_PUBLIC_KEY` environment variable is set to a valid base64-encoded public key
WHEN the extension is built via `npm run build`
THEN the manifest SHALL include a `key` field with the public key value
AND the extension SHALL load with a deterministic ID derived from that key
AND the extension ID SHALL remain stable across rebuilds
AND the extension ID SHALL be consistent across different developer machines using the same key

#### Scenario: Build without fixed extension ID (default behavior)
GIVEN the `EXT_PUBLIC_KEY` environment variable is not set
WHEN the extension is built via `npm run build`
THEN the manifest SHALL NOT include a `key` field
AND Chrome SHALL generate an ephemeral extension ID
AND E2E tests SHALL dynamically discover the ID via service worker polling
AND the existing test infrastructure SHALL continue to work without modification

#### Scenario: E2E tests remain resilient to ID changes
GIVEN an E2E test suite is running
WHEN the extension loads with or without a fixed `key`
THEN the test utilities SHALL detect the extension ID via service worker URL polling
AND tests SHALL navigate to extension pages using the discovered ID
AND test behavior SHALL be identical regardless of whether a fixed key is used
AND no test code changes SHALL be required to support both modes

## MODIFIED Requirements

None. Existing testing requirements remain unchanged; this is an additive capability.

## REMOVED Requirements

None.
