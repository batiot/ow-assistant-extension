# ui Specification

## Purpose
TBD - created by archiving change 2025-11-05-integrate-auth-ui. Update Purpose after archive.
## Requirements
### Requirement: Authentication Status Display
The UI SHALL display the current authentication status to users in all interfaces.

#### Scenario: Show Login Prompt When Unauthenticated
WHEN a user opens the popup or sidepanel
AND the user is not authenticated
THEN the UI SHALL display a login button
AND hide features requiring authentication

#### Scenario: Show User Profile When Authenticated
WHEN a user opens the popup or sidepanel
AND the user is authenticated
THEN the UI SHALL display the user's name and email
AND display the user's profile picture if available
AND show a logout button
AND enable authenticated features

#### Scenario: Display Loading State During Authentication
WHEN an authentication operation is in progress
THEN the UI SHALL display a loading indicator
AND disable interactive elements
AND show appropriate status text

### Requirement: Authentication Actions
The UI SHALL provide controls for users to authenticate and sign out.

#### Scenario: User Initiates Login
WHEN a user clicks the login button
THEN the system SHALL open a popup window for OAuth authentication
AND the popup SHALL display Microsoft's login pages (full HTML)
AND handle automatic redirects if user is already authenticated to Microsoft
AND display a loading state in the extension UI
AND show error messages if authentication fails
AND close the popup window upon successful authentication

#### Scenario: User Initiates Logout
WHEN a user clicks the logout button
THEN the system SHALL clear all authentication data
AND return to the unauthenticated state
AND display the login prompt

### Requirement: Error Handling in UI
The UI SHALL display clear error messages for authentication failures.

#### Scenario: Display Authentication Error
WHEN an authentication error occurs
THEN the UI SHALL display a user-friendly error message
AND provide a retry option when appropriate
AND maintain a functional UI state

#### Scenario: Handle Network Errors
WHEN a network error prevents authentication
THEN the UI SHALL display a connectivity error message
AND provide a retry button
AND suggest troubleshooting steps

### Requirement: Consistent State Across UI Components
Authentication state SHALL be consistent across all UI components.

#### Scenario: Sync State Between Popup and Sidepanel
WHEN authentication state changes in popup
THEN the sidepanel SHALL reflect the same state
AND vice versa
AND without requiring user refresh

#### Scenario: Persist State Across Popup Reopens
WHEN a user closes and reopens the popup
THEN the authentication state SHALL be restored
AND the UI SHALL display the correct state immediately

### Requirement: Settings Interface Access
The UI SHALL provide access to the settings interface through the standard extension menu.

#### Scenario: Options Page Accessible via Extension Menu
WHEN a user right-clicks the extension icon
AND selects "Options" from the browser's context menu
THEN the extension SHALL open the options page in a new browser tab

### Requirement: Options Page Layout
The UI SHALL provide a full-page settings interface with organized sections and clear navigation.

#### Scenario: Options Page Structure
WHEN the options page is opened
THEN the page SHALL display a header with the title "OpenWebUI Assistant - Settings"
AND organize settings into labeled sections (Appearance, Language, Connection)
AND provide a footer with action buttons
AND use a clean, readable layout with appropriate spacing

#### Scenario: Options Page Sections
WHEN viewing the options page
THEN each setting SHALL be in its own section with a clear label
AND include a description explaining the purpose of the setting
AND provide the appropriate input control (radio buttons, dropdown, text input)
AND show validation feedback inline when applicable

### Requirement: Theme Settings Control
The UI SHALL allow users to select and apply their preferred theme in the options page.

#### Scenario: Theme Selector Display
WHEN the options page is open
THEN a theme section SHALL be visible under "Appearance"
AND display current theme selection (Light, Dark, or System)
AND provide radio buttons for theme selection
AND indicate which theme is currently active
AND include a description of what each theme option does

#### Scenario: Theme Selection and Preview
WHEN a user selects a different theme
THEN the UI SHALL update immediately to show the selected theme
AND provide visual feedback that the theme is being applied
AND persist the selection when settings are saved

#### Scenario: System Theme Option
WHEN a user selects "System" theme
THEN the UI SHALL display "(Auto)" or "(Follows system)" indicator
AND apply the current system theme immediately
AND update automatically if system theme changes while settings are open

### Requirement: Language Settings Control
The UI SHALL allow users to select their preferred interface language in the options page.

#### Scenario: Language Selector Display
WHEN the options page is open
THEN a language section SHALL be visible under "Language"
AND display the current language selection
AND provide a dropdown with supported languages (English, French)
AND show language names in their native form (English, Français)
AND include a description explaining the impact of changing language

#### Scenario: Language Selection
WHEN a user selects a different language
THEN the UI text SHALL update to the selected language
AND apply to all open extension contexts
AND persist the selection when settings are saved

### Requirement: Instance URL Configuration Control
The UI SHALL allow users to configure their OpenWebUI instance URL in the options page.

#### Scenario: Instance URL Input Display
WHEN the options page is open
THEN an instance URL section SHALL be visible under "Connection"
AND display the current OpenWebUI instance URL
AND provide an input field for editing the URL
AND include a label and description explaining the purpose of this setting
AND show placeholder text with an example URL format

#### Scenario: Instance URL Validation Feedback
WHEN a user enters an instance URL
AND the URL format is invalid
THEN the UI SHALL display a validation error below the input
AND highlight the input field to indicate an error
AND prevent saving until the URL is valid

#### Scenario: Instance URL Validation Success
WHEN a user enters a valid instance URL
AND moves focus away from the input (blur)
THEN the UI SHALL display a success indicator or checkmark
AND remove any previous error messages
AND enable the save button

### Requirement: Settings Actions
The UI SHALL provide clear actions for saving and resetting settings in the options page.

#### Scenario: Save Settings Button
WHEN the options page is open
THEN a "Save Changes" button SHALL be visible in the page footer
AND the button SHALL be enabled when settings are valid and changed
AND disabled when settings are invalid or unchanged
AND clicking save SHALL persist changes and display confirmation
AND display a loading state during save operation
AND keep the page open after successful save

#### Scenario: Reset to Defaults Button
WHEN the options page is open
THEN a "Reset to Defaults" button SHALL be visible in the page footer
AND clicking reset SHALL prompt for confirmation with a dialog
AND upon confirmation, restore all default values
AND update the UI to show default values
AND require explicit save to persist the reset
AND the reset action SHALL be cancelable

### Requirement: Settings Visual Feedback
The UI SHALL provide visual feedback for settings operations in the options page.

#### Scenario: Settings Loading State
WHEN the options page is loading settings from storage
THEN the page SHALL display a loading indicator
AND disable all form controls
AND display a "Loading settings..." message

#### Scenario: Settings Save Success
WHEN settings are successfully saved
THEN the UI SHALL display a success message or banner notification
AND the message SHALL auto-dismiss after 2-3 seconds
AND keep the options page open for further changes
AND re-enable the save button for additional modifications

#### Scenario: Settings Save Error
WHEN settings fail to save due to storage error
THEN the UI SHALL display an error message or banner
AND explain the error in user-friendly terms
AND keep the options page open
AND allow the user to retry or make corrections

### Requirement: Settings Accessibility
The UI SHALL ensure settings controls in the options page are accessible to all users.

#### Scenario: Keyboard Navigation
WHEN a user navigates the options page using keyboard
THEN all form controls SHALL be reachable with Tab key
AND the current focus SHALL be clearly visible with focus indicators
AND Enter key SHALL activate buttons
AND Space key SHALL toggle radio buttons and checkboxes
AND the page SHALL have a logical tab order

#### Scenario: Screen Reader Support
WHEN a user accesses the options page with a screen reader
THEN all form labels SHALL be properly associated with inputs using label elements or aria-labels
AND error messages SHALL be announced when they appear using aria-live regions
AND the current theme and language SHALL be announced
AND button states (enabled/disabled) SHALL be conveyed
AND section headings SHALL use proper heading hierarchy (h1, h2, h3)

### Requirement: Extension Icon Status Badge
The extension SHALL display visual status indicators on the extension icon to communicate authentication state to users at a glance.

#### Scenario: Display Red Badge When Unauthenticated
WHEN the extension is running
AND the user does not have a valid authentication token
THEN the extension icon SHALL display a red badge indicator
AND the badge SHALL use a single dot character (`•`) as the badge text
AND the badge background color SHALL be `#DC2626` (red-600)

#### Scenario: Clear Badge When Authenticated
WHEN the extension is running
AND the user has a valid authentication token
THEN the extension icon SHALL display no badge
AND the icon SHALL return to its default visual state

#### Scenario: Update Badge on Authentication State Change
WHEN the authentication state changes from authenticated to unauthenticated
THEN the extension SHALL display the red badge within 100ms
AND WHEN the authentication state changes from unauthenticated to authenticated
THEN the extension SHALL clear the badge within 100ms

#### Scenario: Update Badge on Extension Initialization
WHEN the extension initializes on browser startup
AND the AuthService completes its initialization
THEN the badge SHALL reflect the current authentication state
AND display a red badge if no valid token is found
AND display no badge if a valid token is restored from storage

#### Scenario: Update Badge on Instance URL Change
WHEN the user changes the OpenWebUI instance URL in settings
AND the AuthService reinitializes with the new URL
AND the reinitialization results in an unauthenticated state
THEN the extension SHALL display the red badge
AND WHEN the user authenticates to the new instance
THEN the extension SHALL clear the badge

#### Scenario: Badge State Persists Across Browser Sessions
WHEN a user restarts their browser
AND the extension reloads
THEN the badge state SHALL reflect the persisted authentication state
AND match the actual token validity without requiring user interaction

