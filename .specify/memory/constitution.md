<!--
Sync Impact Report

- Version change: 0.1.0 → 0.1.1
- Modified principles: Clarified authentication delegation to OpenWebUI (extension MUST NOT perform OIDC) and added CrxJS Tooling principle; existing principles refined (Security & Privacy; Minimal Permissions; Test-First Integration; Observability & Telemetry; Open Standards & Simplicity)
- Added sections: "Security & Compliance" and "Development Workflow"
- Removed sections: placeholder tokens replaced; no removals of substantive sections
- Templates requiring updates:
	- .specify/templates/plan-template.md: ✅ updated (Constitution Check aligned)
	- .specify/templates/spec-template.md: ✅ updated (requirements & testing alignment)
	- .specify/templates/tasks-template.md: ⚠ pending (task samples to be regenerated per new constitution)
	- .specify/templates/checklist-template.md: ✅ updated (security & testing checks clarified)
	- .specify/templates/agent-file-template.md: ✅ reviewed
- Follow-up TODOs:
	- TODO(RATIFICATION_DATE): original ratification date is unknown—owner must provide.
	- Manual review: update any automation that reads constitution keys (CI, bots) to use the new section names.
-->

# OpenWebUI Assistant Extension Constitution

## Core Principles

### Security & Privacy (NON-NEGOTIABLE)
All handling of authentication tokens, session data, and any user content MUST prioritize least-privilege and in-extension storage minimization. The extension MUST NOT implement primary OIDC authentication flows itself; authentication is delegated to the OpenWebUI webapp. The extension may rely on a short-lived session token or a documented, secure handshake exposed by the webapp (for example, postMessage or a scoped token endpoint). Any token the extension receives MUST be handled with strict lifetime limits, minimal persistence (prefer in-memory), and MUST never be exfiltrated to third-party analytics or persisted beyond the session unless explicitly consented by the user. Rationale: browser extensions have elevated privileges and user trust; mishandling tokens risks account compromise and legal exposure.

### Minimal Permissions
The extension MUST request the minimal set of permissions needed to deliver its functionality (e.g., activeTab, storage). Broad host permissions ("<all_urls>") are prohibited unless an explicit, documented justification is provided and approved by maintainers. Rationale: reduces attack surface and simplifies review for Edge/Chrome stores.

### Test-First & Integration Testing
Feature development MUST begin with automated tests that exercise the end-to-end user journey (happy path + key edge cases). Integration tests that cover OIDC authentication, token exchange, and agent calls are REQUIRED before a release. Unit tests are REQUIRED for core logic. Rationale: this project integrates with auth and remote LLMs—regression here is high-risk.

### CrxJS Tooling
The extension SHOULD be built using the crxjs chrome-extension-tools (https://github.com/crxjs/chrome-extension-tools). Use the recommended crxjs build and development patterns (Vite plugin, manifest generation) to ensure cross-browser compatibility and a predictable build pipeline. Rationale: crxjs simplifies Manifest V3 workflows and reduces tooling divergence across contributors.

### Observability & Telemetry (Limited)
Operational telemetry is ALLOWED only for crash reporting and essential error diagnostics; any telemetry that could include user content or identifiers MUST be opt-in and documented. Structured logging and reproducible error IDs MUST be used to triage issues without exposing sensitive data. Rationale: balance between debuggability and privacy.

### Open Standards & Simplicity
When integrating with external systems (OpenWebUI, OIDC/EntraID), prefer standards-based flows (OIDC Authorization Code with PKCE). Designs MUST favor simple, auditable flows over clever but opaque shortcuts. Rationale: standards reduce security risk and ease maintainability across browser vendors.

## Security & Compliance

The project MUST follow browser extension security best practices: use Manifest V3 where supported, avoid remotely-executed code, validate all message-passing boundaries, and limit CSP relaxations. Authentication is performed by the OpenWebUI webapp (OIDC with EntraID); the extension MUST NOT perform the primary OIDC flow. Any mechanism used to obtain a session token from the webapp (for example, a postMessage handshake or a short-lived token endpoint) MUST be documented, consented by maintainers, and proven in integration tests. Any change that increases permission scope or changes token handling MUST include a migration plan and an automated test demonstrating the new flow.

## Development Workflow

- Code changes MUST be introduced via pull requests with at least one approving review from a maintainer.
- All PRs that change authentication, token storage, or network flows MUST include updated integration tests and a short security rationale in the PR body.
- Continuous Integration MUST run unit tests and integration tests. Releases MUST be tagged and include the constitution version they conform to.

## Governance

Amendments to this constitution follow a documented approval process:

1. Proposed amendment opened as a pull request against `.specify/memory/constitution.md` with rationale and test plan.
2. The change MUST be reviewed and approved by at least two maintainers (or one maintainer + security reviewer for auth changes).
3. The PR MUST include updates to any affected templates listed in the Sync Impact Report and pass CI (including integration tests when relevant).

Versioning policy:

- MAJOR: Changes that remove or re-define existing non-negotiable principles, or introduce breaking governance changes.
- MINOR: Addition of a new principle or material expansion of guidance (e.g., new mandatory testing requirements).
- PATCH: Clarifications, typo fixes, or non-semantic wording changes.

**Version**: 0.1.1 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-11-01

