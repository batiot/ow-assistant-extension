# Feature Specification: CRXJS Extension + Integration Tests

**Feature Branch**: `001-crxjs-extension`  
**Created**: 2025-11-01  
**Status**: Draft  
**Input**: Implement an Edge/Chromium extension built with crxjs (https://github.com/crxjs/chrome-extension-tools) that uses an authenticated OpenWebUI session (authentication delegated to the OpenWebUI webapp) and provides integration tests covering the end-to-end flow (selection/textarea → Alt+K → agent call → apply result).
The extension's OpenWebUI base URL is configurable via the extension preferences. To initiate authentication the extension must navigate the page (or open a tab/window) to `<openwebui_base>/oauth/login` and the OpenWebUI webapp will return the result at `<openwebui_base>/oauth/callback`. On successful authentication the webapp sets a session cookie named `owui_token` for the OpenWebUI origin. The extension must detect the cookie presence (or otherwise read the cookie from the page context) and may use it to call OpenWebUI APIs. Token validity can be checked using the OpenWebUI endpoint `GET <openwebui_base>/api/v1/auths/` (or equivalent documented path); if the token is invalid the extension must re-initiate authentication by calling `/oauth/login` again.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reformulate Selection (Priority: P1)
A user selects text on any web page, presses Alt+K, and receives a reformulated version of the selected text inserted back into the page.

**Why this priority**: Core workflow demonstrating the assistant's value on arbitrary pages.

**Independent Test**: Automated integration test that loads a test page, selects text programmatically, sends the Alt+K command to the extension, and asserts that the DOM selection is replaced with the expected reformulated text. The test MUST also verify that a valid `owui_token` session cookie is present for the OpenWebUI origin (or that the delegated exchange mechanism resulted in a usable token) before making agent assertions; if the cookie is absent the test should simulate the authentication sequence (navigate to `/oauth/login` and process `/oauth/callback`) or mock the cookie-setting behavior.

**Acceptance Scenarios**:
1. **Given** an authenticated OpenWebUI session available to the page (delegated by the webapp), **When** the user selects text and triggers Alt+K, **Then** the extension sends an agent call and the selection is replaced with the agent's returned text.
2. **Given** the agent fails, **When** the user triggers Alt+K, **Then** a non-blocking error is surfaced (console + optional user alert) and original text remains unchanged.

---

### User Story 2 - Correct Focused Textarea (Priority: P1)
A user focuses a textarea, presses Alt+K, and the extension replaces the textarea content with corrected text returned by the agent.

**Why this priority**: Common editing scenario; demonstrates textarea handling and DOM update safety.

**Independent Test**: Automated integration test that focuses a textarea in a test page, types text, sends the Alt+K command, and asserts the textarea value is updated with the expected corrected text. The test MUST also validate session token presence (`owui_token` cookie) or the documented delegated mechanism is used; if the token is invalid, the test should assert that the extension re-initiates authentication by navigating to `/oauth/login` (or that the test harness simulates a successful `/oauth/callback` setting the cookie).

**Acceptance Scenarios**:
1. **Given** an authenticated OpenWebUI session provided by the webapp, **When** the user triggers Alt+K with focus in a textarea, **Then** the extension posts an agent call and the textarea is updated with the returned corrected text.
2. **Given** no session token is available, **When** the user triggers Alt+K, **Then** an actionable error informs the user that authentication is required (no silent token acquisition by the extension).

---

### Edge Cases
- Page content is in an iframe from a different origin — the content script must not violate cross-origin rules; tests should include same-origin test and verify failure modes for cross-origin.
- Very large selections (>100k chars) — agent may reject or truncate; tests should verify graceful fallback (no page corruption).
- Multiple rapid Alt+K triggers — extension must debounce or queue requests to avoid overlapping DOM edits.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The extension MUST trigger agent invocation on the Alt+K command from the page context.
- **FR-002**: The extension MUST support two agent modes: `reformulate` (for selected text) and `correct` (for focused textarea).
-- **FR-003**: The extension MUST NOT implement the primary OIDC authentication flow; it MUST rely on a delegated session mechanism exposed by the OpenWebUI webapp. Concretely, the extension will initiate authentication by navigating to `<openwebui_base>/oauth/login` and the OpenWebUI webapp will callback to `<openwebui_base>/oauth/callback`. On success the webapp sets a session cookie named `owui_token` for the OpenWebUI origin; the extension may read this cookie from the page context (or rely on a documented exchange) and present it as the session token for authenticated API calls.
- **FR-004**: The extension MUST request only minimal permissions (at most `activeTab`, `storage`, and `scripting`) unless a documented justification is provided in the spec and approved.
- **FR-005**: Agent calls MUST include the short-lived session token obtained via the delegated mechanism and MUST be exercised by integration tests.
- **FR-006**: The extension SHOULD be built using crxjs tooling and follow crxjs recommended patterns for Vite and Manifest generation.

### Security & Testing Requirements (per constitution)
- **SEC-001**: Document the delegated token exchange mechanism (the OpenWebUI webapp's `/oauth/login` → `/oauth/callback` flow that sets the `owui_token` cookie) and include an integration test that verifies the extension consumes the token only via the documented mechanism. Tests MUST verify cookie presence for the OpenWebUI origin and that `GET <openwebui_base>/api/v1/auths/` can validate token freshness.
- **SEC-002**: Integration tests MUST validate token lifecycle behavior (token present → success; token absent or invalid → extension re-initiates authentication by navigating to `<openwebui_base>/oauth/login`, and the UI provides an actionable user-facing fallback).
- **TST-001**: Integration tests MUST validate the end-to-end agent flows for P1 stories: selection -> Alt+K -> agent -> DOM update.

## Key Entities *(include if feature involves data)*
- **Agent**: Remote LLM service invoked via OpenWebUI REST/agent endpoint; input: text, mode; output: structured response with `text` and optional metadata.
- **Session Token**: Short-lived token/session handle provided by OpenWebUI to the page; extension uses this token for authenticated agent calls.
- **Content Script (PageContext)**: Script injected into pages that coordinates selection/textarea detection and DOM updates.
- **Background Worker**: Listens for keyboard commands and forwards trigger messages to the active tab.

## Success Criteria *(mandatory)*
### Measurable Outcomes
- **SC-001**: Integration tests for the two primary flows (selection reformulation, textarea correction) pass in CI for the default test harness.
- **SC-002**: When tested in a representative environment, user-visible transformation completes within 3 seconds for 95% of tests (excluding network-induced latency to agent backend).
- **SC-003**: Extension requests no more than the allowed permissions in the manifest and any deviation is accompanied by an approved justification in the PR.
- **SC-004**: No automated tests or code paths in the extension perform the primary OIDC flow; tests assert that token acquisition is delegated.

## Assumptions
- OpenWebUI webapp will expose a documented, secure token exchange. The chosen mechanism (postMessage vs token endpoint) will be finalized in the implementation plan and documented in the spec's "Integration Contracts" section.
- The test CI environment can host a mock OpenWebUI endpoint or a lightweight test server that simulates the token handoff and agent responses.
- crxjs tooling is acceptable for this project and can generate the necessary build artifacts for local loading and CI-driven browser testing.

## Dependencies
- OpenWebUI webapp (for delegated authentication and agent endpoints)
- crxjs chrome-extension-tools for build pipeline
- Playwright (or equivalent) for integration testing

## Deliverables
- `specs/1-crxjs-extension/spec.md` (this file)
- Integration tests that verify delegated token exchange and agent flows
- A small test harness (test pages) used by CI to exercise the content script and background messaging

## Notes
- Keep implementation details out of this spec; the implementation plan will include the chosen delegated handshake pattern and concrete test harness details.

---

SUCCESS: spec ready for planning
