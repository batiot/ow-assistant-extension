OpenWebUI Assistant — Edge extension scaffold

This folder contains a minimal Edge/Chromium extension scaffold intended to be
used with the crxjs toolchain (https://github.com/crxjs/chrome-extension-tools).

Purpose
- Use an authenticated OpenWebUI session (OIDC via EntraID) to call remote LLM
  agents from the current page.
- Trigger agents with Alt+K.
- Example agents: reformulate selected text, correct focused textarea.

Important notes & TODOs
- OIDC configuration (client id, tenant, redirect URIs) is NOT included. You must
  configure `oidc_client_id`, `oidc_tenant`, and `openwebui_base` in
  `chrome.storage.local` (or implement an options page) before agent flows work.
- The content script contains a placeholder for the OIDC flow. Implement
  Authorization Code + PKCE with EntraID and store tokens securely with minimal lifetime.

Development
1. Install dependencies: `npm install`
2. Use crxjs / vite to build and load the extension into Edge for testing.

Tests
- A Playwright test scaffold is included under `tests/` to run integration checks
  against a test harness. See `package.json` `test` script.

Security
- Follow the project's constitution (`.specify/memory/constitution.md`) regarding
  token handling, permissions, and telemetry.
