# ui Specification Delta

This delta documents changes to the `ui` specification for change `add-icon-status-badge`.

## ADDED Requirements

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
