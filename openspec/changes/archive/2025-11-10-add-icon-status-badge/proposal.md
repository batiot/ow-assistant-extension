# Proposal: Add Icon Status Badge

**Change ID**: `add-icon-status-badge`  
**Date**: 2025-11-10  
**Status**: Draft  
**Author**: AI Assistant

---

## Summary

Add visual status indication to the extension icon using Chrome's badge API to show authentication state at a glance. A red badge will indicate when the user has no valid authentication token, helping users quickly identify connection issues without opening the extension UI.

---

## Motivation

Currently, users must open the extension popup or sidepanel to determine their authentication status. This creates unnecessary friction when troubleshooting connectivity issues or verifying authentication state. Visual feedback directly on the extension icon provides immediate status awareness, aligning with common UX patterns in other extensions (e.g., ad blockers, VPNs, security tools).

**User pain points:**
- No way to quickly check auth status without opening the extension
- Users may not realize they're unauthenticated until attempting to use features
- Troubleshooting requires multiple clicks to verify connection state

**Business value:**
- Reduced support requests related to authentication confusion
- Improved user confidence in extension status
- Better alignment with enterprise security awareness (clear indication of connection state)

---

## Scope

### In Scope
- Badge indicator showing authentication state (red for unauthenticated/invalid token)
- Background service worker logic to update badge when auth state changes
- Badge updates on:
  - Extension startup/initialization
  - Authentication state changes (login/logout)
  - Server URL configuration changes
  - Token validation failures

### Out of Scope
- Multiple badge colors/states beyond auth validation (e.g., network status, feature flags)
- Badge text content (keeping it minimal with just color indication)
- Tooltip explanations (browser shows extension name on hover by default)
- Icon switching (keeping the same logo, only adding badge)
- User preferences to disable badge (can be added later if requested)

---

## Proposal

### Overview
Leverage the `chrome.action.setBadgeText()` and `chrome.action.setBadgeBackgroundColor()` APIs to display a small red indicator when authentication is invalid or missing. The badge will be managed by the background service worker, which already monitors auth state changes.

### Key Design Decisions

1. **Badge State Mapping**
   - No badge (default): User is authenticated with valid token
   - Red badge (`•`): User is not authenticated or token is invalid
   
2. **Update Triggers**
   - On `AuthService.initialize()` - check initial state
   - On `AuthService.onAuthStateChanged()` - react to state changes
   - On instance URL change - reflect reinitialization status
   
3. **Visual Design**
   - Badge text: `•` (single dot character for minimal visual noise)
   - Badge color: `#DC2626` (red-600, matches error states in UI)
   - Position: Browser-default (typically top-right corner of icon)

### Technical Approach

The implementation will:
1. Add a new `updateIconBadge(authState)` function in `src/background/index.ts`
2. Call this function whenever auth state changes (already centralized via `broadcastAuthState`)
3. Use Chrome's Action API to set/clear badge based on `authState.isAuthenticated`

**Pseudocode:**
```typescript
function updateIconBadge(authState: AuthState) {
  if (!authState.isAuthenticated) {
    chrome.action.setBadgeText({ text: '•' });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
  } else {
    chrome.action.setBadgeText({ text: '' }); // Clear badge
  }
}
```

### Integration Points
- **Background service worker**: Owns badge state management
- **AuthService**: Provides auth state via existing `onAuthStateChanged` callback
- **Settings**: Instance URL changes trigger reinit, which updates badge

---

## Alternatives Considered

### 1. Multiple Badge States
**Approach**: Different colors for various states (yellow for loading, green for connected, red for error)  
**Rejected**: Adds complexity without clear user benefit. Binary state (good/bad) is clearer.

### 2. Icon Switching
**Approach**: Swap entire icon to grayscale or different graphic when unauthenticated  
**Rejected**: More invasive visual change; badge is subtler and follows platform conventions.

### 3. Badge Text with Status Count
**Approach**: Show error count or state abbreviation (e.g., "ERR", "OK")  
**Rejected**: Text is harder to read at small sizes; color is sufficient signal.

---

## Success Criteria

1. **Visual Feedback**: Badge appears/disappears correctly based on auth state
2. **Performance**: No noticeable delay in badge updates (<100ms after state change)
3. **Reliability**: Badge state always matches actual authentication status
4. **User Understanding**: Users can identify unauthenticated state at a glance (validated via manual testing)

**Acceptance Tests:**
- [ ] Badge shows red dot when extension starts without valid token
- [ ] Badge clears when user successfully authenticates
- [ ] Badge appears when user logs out
- [ ] Badge updates when instance URL changes and auth becomes invalid
- [ ] Badge state persists across browser restarts (reflects stored auth state)

---

## Dependencies

- None. Uses existing `chrome.action` APIs available in Manifest V3.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Badge may confuse users who don't know its meaning | Medium | Clear documentation in README; consider adding tooltip in future iteration |
| Badge might not update if auth state callbacks fail | Low | Defensive coding; ensure badge update is called in all auth state transitions |
| Visual noise if users prefer minimal UI | Low | Badge only shows when there's an issue (red); default state is clean |

---

## Open Questions

- **Q**: Should we add a badge for "loading" state during authentication?  
  **A**: Not in initial implementation. Keep it simple with binary good/bad state.

- **Q**: Should badge color be customizable via settings?  
  **A**: Not initially. Can be added if users request it.

---

## Impact

### User-Facing Changes
- Extension icon will show a small red badge when not authenticated
- No changes to existing UI flows; purely additive feature

### Developer Impact
- Minimal code addition (~20-30 lines in background service)
- New E2E test scenarios for badge state verification
- Documentation update in README

### Performance Impact
- Negligible (single API call per auth state change)

---

## Timeline Estimate

- Implementation: 1-2 hours
- Testing: 1 hour (manual + automated)
- Documentation: 30 minutes
- **Total**: ~3-4 hours
