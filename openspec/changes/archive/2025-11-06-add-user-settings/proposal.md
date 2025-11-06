# Add User Settings

## Why

The extension currently lacks a user-facing settings interface for customizing core preferences. While the `ConfigManager` handles the OpenWebUI instance URL configuration, users have no UI to:
- Change the theme (light/dark mode)
- Select their preferred language for the interface
- Configure or modify the OpenWebUI instance URL after initial setup

Without a settings interface, users cannot personalize their experience, adapt the UI to their preferences, or reconfigure connection details without reinstalling or using developer tools. This creates friction for enterprise deployments where users may need to switch between OpenWebUI instances or prefer different UI themes.

This change adds a settings system with UI components for managing Theme, Language, and OpenWebUI Instance URL preferences, using `chrome.storage.sync` for cross-device synchronization where applicable.

## What Changes

### Settings Data Layer
- **ADDED** Settings types (`UserSettings`, `Theme`, `Language`) in `src/settings/types.ts`
- **ADDED** `SettingsManager` class for managing user preferences with validation
- **ADDED** Default settings with fallback values
- **ADDED** Settings storage using `chrome.storage.sync` for theme and language (cross-device)
- **ADDED** Settings storage using `chrome.storage.local` for instance URL (device-specific)
- **ADDED** Settings validation methods (URL format, enum values)
- **ADDED** Settings change event listeners for reactive updates

### Settings Context & Hooks
- **ADDED** `SettingsContext` React context in `src/contexts/SettingsContext.tsx`
- **ADDED** `useSettings` hook for accessing settings state and actions
- **ADDED** Settings provider with initialization on mount
- **ADDED** Real-time settings synchronization across extension contexts

### Options Page
- **ADDED** `src/options/index.html` as dedicated options page
- **ADDED** `src/options/App.tsx` as main options page component
- **ADDED** `src/options/main.tsx` as entry point
- **ADDED** Options page styles in `src/options/App.css` and `index.css`
- **MODIFIED** `manifest.config.ts` to register options page with `options_ui`

### Settings UI Components
- **ADDED** Theme selector (Light/Dark/System) with radio buttons or dropdown
- **ADDED** Language selector dropdown with supported languages
- **ADDED** OpenWebUI Instance URL input with validation feedback
- **ADDED** Save/Cancel buttons with loading states
- **ADDED** Reset to defaults option
- **ADDED** Error display for validation failures
- **ADDED** Responsive layout for full-page settings interface

### Theme Application
- **ADDED** Theme application utility that sets CSS variables or body classes
- **ADDED** System theme detection using `prefers-color-scheme` media query
- **ADDED** Theme persistence and restoration on extension load
- **MODIFIED** CSS to support light/dark theme variables

### Configuration Integration
- **MODIFIED** `ConfigManager` to delegate instance URL to `SettingsManager`
- **ADDED** Migration path for existing `openWebUIBaseUrl` config to settings
- **ADDED** Backward compatibility layer during transition period

## Relationships

- **Depends on**: `ui` spec (auth UI components, existing layout structure)
- **Modifies**: `ui` spec (adds settings requirement)
- **Integrates with**: Existing `config` module (instance URL management)

## Implementation Notes

1. **Options Page Pattern**: Use Chrome's built-in `options_ui` in manifest with `open_in_tab: true` for full-page experience
2. **Storage Strategy**: Use `chrome.storage.sync` for theme/language (100KB limit, syncs across devices) and `chrome.storage.local` for instance URL (device-specific, security consideration)
3. **Theme Application**: Apply theme by setting `data-theme` attribute on `<html>` element, use CSS custom properties for colors
4. **Language Support**: Start with English (en) and French (fr), structure for easy addition of more languages
5. **Validation**: Validate instance URL on blur and before save, provide immediate feedback
6. **Migration**: On first load after upgrade, migrate existing `ConfigManager` openWebUIBaseUrl to settings
7. **Access Method**: Options page accessible via right-click extension icon → Options (standard Chrome extension pattern)
8. **Minimal Scope**: Focus on three settings only (Theme, Language, Instance URL) - defer other preferences to future work

## Out of Scope

- Advanced settings (timeout, retry configuration, debug mode)
- Settings import/export functionality
- Settings synchronization status indicator
- Per-workspace/profile settings
- Settings search or categorization
- Keyboard shortcuts configuration
