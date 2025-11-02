## Project Context

### Purpose — quick summary

This repository contains a Chromium/Edge extension that provides AI-powered writing assistance by integrating the OpenWebUI LLM agent. Primary user-facing features include:

- Text correction and reformulation
- Language translation
- Text summarization
- AI-generated responses and suggestions
- Contextual writing assistance (in-page & popup)

The extension is designed for enterprise use with single sign-on (SSO) via EntraID (Azure AD) and should prioritize security, minimal UX friction, and auditability.

---

### Tech stack

Core technologies

- TypeScript (strict mode) — primary language
- Vite + CRXJS — bundling and extension dev tooling
- Chrome Extension Manifest V3
- OpenWebUI — backend LLM agent service
- EntraID (Azure AD) — OIDC identity provider for SSO

Developer & testing tools

- ESLint (with TypeScript rules) and Prettier — linting and formatting
- Vitest / Jest — unit and integration tests
- Playwright — end-to-end tests (extension & webapp flows)
- OpenSpec — design and specification process for proposals

Key libraries / browser APIs

- @crxjs/vite-plugin — extension bundling/dev
- chrome.storage — persistent config and tokens (use chrome.storage.session where available)
- chrome.runtime / background service workers — orchestrate long-running tasks
- chrome.tabs — content script coordination
- chrome.cookies — read-only detection of OpenWebUI session cookie if required (prefer bearer tokens)

External service dependencies

- OpenWebUI completion APIs — documented at https://docs.openwebui.com/getting-started/api-endpoints

---

### Configuration & environment

Important configuration values (set via build-time or extension preferences):

- OPENWEBUI_BASE_URL — base URL of the OpenWebUI backend (e.g. https://openwebui.example.com)

Local development: prefer using a .env.local (gitignored) that documents these values. Do not commit secrets.

---

### Architecture & data flow

1. The extension is primarily a thin client that delegates LLM computation to the OpenWebUI backend.
2. User triggers a writing assistance action (popup or content script).
3. Extension background worker obtains/validates session token and calls OpenWebUI completion APIs.
4. OpenWebUI returns LLM responses; the extension surfaces results to the UI.

Auth flow (high-level)
- The recommended approach is for the extension to rely on the OpenWebUI webapp session
- Its OpenWebUI who manage the OIDC dance against EntraID.

Data & tokens
- Prefer bearer tokens stored in secure storage (chrome.storage.session when available) over persistent cookies. If OpenWebUI sets an `owui_token` cookie, the extension should treat it as ephemeral and exchange or copy into an in-extension session token instead of relying solely on cookie-based auth.
- Token validation endpoint: GET <OPENWEBUI_BASE_URL>/api/v1/auths/ — call to validate session token and retrieve user metadata.

---

### Authentication: recommended implementation details

Goal: seamless SSO using OpenWebui while keeping extension logic minimal and secure.

1. The extension checks for a valid session token in `chrome.storage` on startup or before API calls.
2. If there is no valid token, the extension opens the openwebui authentification flow:
   - Use <webview> or custom popup window
   - Load OpenWebUI  `${OPENWEBUI_BASE_URL}/oauth/microsoft/login` to initiate the OIDC first step
   - This opens the login window and returns the final redirect URL `${OPENWEBUI_BASE_URL}/oauth/microsoft/callback`. 
3. OpenWebUI's callback return should include a server-set cookie (owui_token)
5. Store the token in `chrome.storage.session` if available (or `chrome.storage.local` with encryption/obfuscation and short TTL), and mark the token expiry.

Notes / security

- Avoid embedding long-lived secrets directly in the extension. Prefer server-side client secrets and a short-lived session token model.
- If cookies are used by OpenWebUI, treat them as a server-side artifact; prefer a server-to-client token exchange to keep the extension logic clean.

---

### Project conventions

Code style

- TypeScript strict mode enabled.
- ESLint with TS rules + Prettier. Add an `.eslintrc.cjs` and `.prettierrc` to the repo.
- File naming: kebab-case for filenames, PascalCase for exported classes/React components.
- Keep one component per file; the file should export the primary component as default or named export matching the component name.
- Prefer small, pure functions and separate side-effects to background/service modules.

Imports

- Use explicit relative imports for local modules (./ or ../) and absolute imports only if the project defines a tsconfig path alias — document any alias in `tsconfig.json`.

Branching & Git

- Branch naming: feature/<short-description>, fix/<issue>, chore/<task>.
- Use Conventional Commits for commit messages (feat:, fix:, chore:, docs:, test:, refactor:).
- Create a PR for every non-trivial change and request at least one reviewer.

Pull requests

- PR template should include: summary, screenshot (if UI), steps to test, and checklist (lint/tests passing, E2E run, change documented if needed).

Issue & proposal process

- Use OpenSpec for feature proposals: requirements, user stories, security considerations, and migration concerns. Link proposals from PRs when relevant.

---

### Testing strategy

- Unit tests: Vitest or Jest for pure logic.
- Integration tests: test background scripts and API clients with mocked OpenWebUI responses.
- End-to-end: Playwright to run the extension in a real browser profile  (edge only) and validate the auth flows, API interactions, and UI.

Test examples & CI

- CI should run lint, unit tests, and at least one lightweight Playwright smoke test on each PR. Heavier E2E suites can run on a scheduled pipeline.

---

### Local development & scripts (recommendations)

- Install dependencies: `npm install` (or `pnpm`/`yarn` depending on repo conventions)
- Dev mode: `npm run dev` — start Vite + CRXJS dev server and load the extension as an unpacked extension in Chromium (CRXJS typically supports hot reload)
- Build: `npm run build` — produce a signed/unsigned extension package via CRXJS
- Test: `npm run test` (unit) and `npm run e2e` (Playwright)

Document the actual npm scripts in `package.json` and keep the README updated with step-by-step local dev instructions.

---

### Security & privacy notes

- Treat OpenWebUI session tokens as sensitive secrets. Minimize storage lifetime and scope. Do not use refresh token
- Log only non-sensitive telemetry and provide opt-out for telemetry.
- Follow least-privilege for extension permissions in the manifest. Request broad optional permissions only when required and justify them in the codebase/docs.

---

### Release & packaging

- Use CRXJS to produce a Manifest V3-compatible extension. Document the release steps (build, sign, publish) in a `RELEASE.md` or `openspec/changes` entry.



### External references

- OpenWebUI API docs: https://docs.openwebui.com/getting-started/api-endpoints
- CRXJS: https://github.com/crxjs/chrome-extension-tools
