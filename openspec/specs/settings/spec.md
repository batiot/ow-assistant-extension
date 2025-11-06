# settings Specification

## Purpose
TBD - created by archiving change add-user-settings. Update Purpose after archive.
## Requirements
### Requirement: Settings Storage and Persistence
The extension SHALL store user settings persistently using Chrome storage APIs with appropriate storage tiers for different setting types.

#### Scenario: Store Theme and Language in Sync Storage
WHEN a user changes theme or language preferences
THEN the extension SHALL store these settings in `chrome.storage.sync`
AND the settings SHALL synchronize across the user's devices
AND the storage SHALL use the key `user_settings_sync`

#### Scenario: Store Instance URL in Local Storage
WHEN a user changes the OpenWebUI instance URL
THEN the extension SHALL store the URL in `chrome.storage.local`
AND the URL SHALL remain device-specific
AND the storage SHALL use the key `user_settings_local`

#### Scenario: Load Settings on Extension Startup
WHEN the extension initializes in any context (popup, sidepanel, background)
THEN the extension SHALL load settings from storage
AND apply default values for any missing settings
AND apply the theme immediately after loading

#### Scenario: Persist Settings Across Extension Restarts
WHEN a user restarts the browser or extension
THEN all previously saved settings SHALL be restored
AND the UI SHALL reflect the saved preferences immediately

### Requirement: Settings Validation
The extension SHALL validate all user settings before saving to prevent invalid configurations.

#### Scenario: Validate Instance URL Format
WHEN a user enters an OpenWebUI instance URL
THEN the extension SHALL validate the URL format
AND reject URLs that are not valid HTTP/HTTPS URLs
AND display an error message for invalid formats
AND prevent saving until the URL is valid

#### Scenario: Validate Theme Selection
WHEN a user selects a theme
THEN the extension SHALL accept only "light", "dark", or "system" values
AND reject any other values
AND default to "system" if an invalid value is encountered

#### Scenario: Validate Language Selection
WHEN a user selects a language
THEN the extension SHALL accept only supported language codes ("en", "fr")
AND reject unsupported language codes
AND default to "en" if an invalid code is encountered

### Requirement: Settings Management API
The extension SHALL provide a centralized settings manager with a consistent API for accessing and modifying settings.

#### Scenario: Get Current Settings
WHEN any extension component requests current settings
THEN the settings manager SHALL return a complete settings object
AND include all setting values (with defaults for missing values)
AND return the data synchronously from cache

#### Scenario: Update Settings
WHEN a component updates one or more settings
THEN the settings manager SHALL validate the new values
AND merge the changes with existing settings
AND persist the changes to appropriate storage
AND notify all listening contexts of the change
AND reject invalid updates with descriptive errors

#### Scenario: Reset Settings to Defaults
WHEN a user requests to reset settings
THEN the extension SHALL restore all settings to default values
AND clear stored settings from both sync and local storage
AND apply the default theme immediately
AND confirm the reset to the user

### Requirement: Theme Application
The extension SHALL apply the selected theme to all UI contexts and respond to system theme changes when appropriate.

#### Scenario: Apply Selected Theme
WHEN a user selects "light" or "dark" theme
THEN the extension SHALL set the `data-theme` attribute on the HTML root element
AND the attribute value SHALL be "light" or "dark" respectively
AND all UI components SHALL update to reflect the theme
AND the theme SHALL apply immediately without page refresh

#### Scenario: Detect and Apply System Theme
WHEN a user selects "system" theme
THEN the extension SHALL detect the OS theme preference using `prefers-color-scheme`
AND apply "light" theme when OS preference is light
AND apply "dark" theme when OS preference is dark
AND listen for OS theme changes and update automatically

#### Scenario: Persist Theme Across Contexts
WHEN the theme is changed in the popup
THEN the sidepanel SHALL reflect the same theme immediately
AND vice versa
AND all content scripts SHALL respect the selected theme

### Requirement: Settings Migration
The extension SHALL migrate existing configuration data to the new settings system to preserve user preferences during upgrades.

#### Scenario: Migrate Legacy Instance URL
WHEN the extension starts and detects legacy config data
AND the legacy config contains an `openWebUIBaseUrl`
AND settings migration has not been completed
THEN the extension SHALL copy the URL to the new settings system
AND mark the migration as complete
AND preserve the legacy config for backward compatibility

#### Scenario: Skip Migration if Already Complete
WHEN the extension starts and migration has been completed previously
THEN the extension SHALL skip the migration process
AND use settings directly from the new storage location

### Requirement: Settings UI Access
The extension SHALL provide accessible UI controls for users to view and modify their settings.

#### Scenario: Open Options Page via Extension Context Menu
WHEN a user right-clicks the extension icon
AND selects "Options" from the context menu
THEN the extension SHALL open the options page in a new browser tab

#### Scenario: Save Settings from Options Page
WHEN a user modifies settings in the options page and clicks save
AND all validation passes
THEN the extension SHALL persist the changes to storage
AND apply the changes immediately to all extension contexts
AND display a success confirmation
AND keep the page open for further changes

#### Scenario: Display Validation Errors in Options Page
WHEN a user enters invalid settings
AND attempts to save
THEN the extension SHALL display validation error messages inline
AND highlight the invalid fields
AND keep the options page open
AND prevent saving until errors are corrected

### Requirement: Language Support
The extension SHALL support multiple languages for the user interface based on user preference.

#### Scenario: Apply Selected Language
WHEN a user selects a language in settings
THEN the extension SHALL display all UI text in the selected language
AND update text immediately in all open contexts
AND persist the language preference for future sessions

#### Scenario: Default to English
WHEN the extension starts for the first time
OR when the stored language is invalid or unsupported
THEN the extension SHALL use English (en) as the default language
AND display all UI text in English

#### Scenario: Support French Language
WHEN a user selects French (fr) as their language
THEN the extension SHALL display all UI text in French
AND format dates and numbers according to French locale conventions

