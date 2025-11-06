# Implementation Tasks

## Phase 1: Settings Data Layer
- [x] Create `src/settings/types.ts` with `UserSettings`, `Theme`, `Language` types and defaults
- [x] Create `src/settings/manager.ts` with `SettingsManager` class
- [x] Implement settings storage (sync for theme/language, local for instance URL)
- [x] Implement settings validation (URL format, enum values)
- [x] Add settings change listeners and event dispatching
- [ ] Write unit tests for `SettingsManager` (validation, storage, retrieval)

## Phase 2: Settings Context & React Integration
- [x] Create `src/contexts/SettingsContext.tsx` with settings state management
- [x] Implement `useSettings` hook with getter/setter methods
- [x] Add settings initialization on context mount
- [x] Integrate settings context into popup and sidepanel apps
- [x] Test settings state updates propagate to consuming components

## Phase 3: Options Page Structure
- [x] Create `src/options/index.html` with proper meta tags and root element
- [x] Create `src/options/main.tsx` as entry point with React rendering
- [x] Create `src/options/App.tsx` with main options page layout
- [x] Add `src/options/index.css` for base styles
- [x] Add `src/options/App.css` for options page component styles
- [x] Update `manifest.config.ts` to register options page with `options_ui`
- [x] Set `open_in_tab: true` in manifest for full-page experience
- [x] Integrate SettingsContext into options page app

## Phase 4: Settings UI Components
- [x] Create page header with title and description
- [x] Implement Theme selector section with radio buttons (Light/Dark/System)
- [x] Implement Language selector section with dropdown (en, fr)
- [x] Implement Instance URL section with validated input and helper text
- [x] Add inline validation error/success messages for URL field
- [x] Add Save button with loading state in footer
- [x] Add Reset to Defaults button with confirmation dialog
- [x] Style all components for full-page layout with proper spacing

## Phase 5: Theme Application
- [x] Create theme utility to apply theme via `data-theme` attribute on `<html>`
- [x] Implement system theme detection with `prefers-color-scheme` media query
- [x] Add CSS custom properties for light and dark themes
- [x] Apply theme on settings change and extension load
- [x] Update existing component styles to use theme variables
- [x] Ensure theme applies to options page, popup, and sidepanel

## Phase 6: Configuration Migration
- [x] Add migration logic to move `ConfigManager` openWebUIBaseUrl to settings
- [x] Update `ConfigManager.getOpenWebUIBaseUrl()` to delegate to `SettingsManager`
- [x] Test backward compatibility with existing configurations
- [x] Document migration process in code comments

## Phase 7: Testing & Validation
- [x] Write E2E tests for opening options page via extension context menu
- [x] Write E2E tests for theme switching and persistence in options page
- [x] Write E2E tests for language selection
- [x] Write E2E tests for instance URL validation and save
- [x] Write E2E tests for settings reset functionality
- [x] Test settings sync across popup, sidepanel, and options page
- [x] Verify theme application across all UI components
- [x] Test right-click extension icon → Options menu item
- [x] Fix test infrastructure to use `--headless=new` with persistent context
- [x] Fix extension ID detection from service workers
- [x] Create comprehensive E2E test suite (14 tests, 8 passing, 6 with known issues)

**Test Results:** 8/14 passing. Remaining failures are due to state management bugs documented in docs/E2E_TESTING.md

## Phase 8: Documentation
- [x] Update README with settings feature description
- [x] Document supported themes and languages
- [x] Add developer notes on adding new settings
- [x] Create comprehensive E2E testing guide (docs/E2E_TESTING.md)
- [x] Document test infrastructure with headless Chrome setup
- [x] Document implementation bugs found during testing
- [x] Add debugging tips and CI/CD integration guide
