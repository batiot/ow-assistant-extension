# Proposal: Add Optional Fixed Extension ID

## Problem Statement

Chrome generates a new ephemeral extension ID for each unpacked extension load when no `key` field is present in the manifest. The ID is derived from a public key that Chrome generates per install context (profile + load path). This creates instability:

1. **Different IDs across environments**: Local dev, CI, and different developer machines get different extension IDs
2. **Rebuilds can change the ID**: Clearing build artifacts and rebuilding may generate a new ID
3. **Testing complexity**: E2E tests must dynamically discover the extension ID by polling service workers
4. **External integrations**: Any external service or configuration that hardcodes `chrome-extension://<id>` URLs becomes brittle

### Current Workaround

E2E tests already handle this by dynamically extracting the extension ID from the service worker URL pattern:

```typescript
const sw = context.serviceWorkers().find(w => w.url().startsWith('chrome-extension://'));
const match = sw.url().match(/^chrome-extension:\/\/([^\/]+)/);
```

This is resilient but adds complexity and polling delays to every test setup.

## Proposed Solution

Add an **optional** `key` field to `manifest.config.ts` that can be controlled via the `EXT_PUBLIC_KEY` environment variable. This:

- Stabilizes the extension ID when the variable is set
- Keeps tests working without any changes (they already handle dynamic IDs)
- Provides opt-in stability for developers who need it
- Remains compatible with Chrome Web Store publishing (the store ignores the key and assigns its own ID)

### Implementation Approach

**Minimal, opt-in change:**

```typescript
// manifest.config.ts
export default defineManifest({
  manifest_version: 3,
  // ... existing fields ...
  
  // Optional: Provide a stable extension ID via public key
  // Set EXT_PUBLIC_KEY env var to enable (base64-encoded public key from chrome --pack-extension)
  // IMPORTANT: Remove when publishing to Chrome Web Store
  ...(process.env.EXT_PUBLIC_KEY && { key: process.env.EXT_PUBLIC_KEY }),
})
```

**Documentation additions:**
- Add section to README explaining how to generate and use a fixed key
- Document that this is for development/testing only
- Warn about Chrome Web Store implications
- Update E2E testing docs to mention this option

## Scope

### In Scope
- Add conditional `key` field to manifest.config.ts based on `EXT_PUBLIC_KEY` env var
- Document key generation process (using `chrome --pack-extension`)
- Document when to use (dev/testing) and when not to use (Web Store publishing)
- Update E2E testing documentation to mention stability option
- Add inline code comments explaining the trade-offs

### Out of Scope
- Changing E2E test behavior (tests already handle dynamic IDs gracefully)
- Committing a default key to the repository (security risk for private keys)
- Auto-generating keys during build (adds complexity without clear benefit)
- Firefox-specific ID stabilization (uses different mechanism: `browser_specific_settings.gecko.id`)

## Trade-offs

### Benefits
1. **Stable development**: Same extension ID across rebuilds and machines
2. **Simplified debugging**: Consistent extension URLs in logs and error messages
3. **External integrations**: Reliable for services that need hardcoded extension URLs
4. **Optional**: Zero impact if not used; tests remain resilient

### Risks & Mitigations
1. **Security**: Private key leakage
   - **Mitigation**: Never commit private .pem key; only document public key usage
   
2. **Chrome Web Store conflict**: Published extension gets different ID
   - **Mitigation**: Clear documentation that `key` must be removed for store publishing
   
3. **Developer confusion**: May not understand when to use
   - **Mitigation**: Inline comments and dedicated docs section with use-case examples

## Success Criteria

1. Developers can optionally set `EXT_PUBLIC_KEY` to stabilize extension ID
2. Extension builds successfully with or without the env var
3. E2E tests continue to pass without modification (already handle dynamic IDs)
4. Documentation clearly explains when and how to use this feature
5. `openspec validate --strict` passes

## Non-Goals

- Making a fixed key mandatory (remains opt-in)
- Changing test infrastructure (already resilient)
- Supporting Firefox ID stabilization in this change (separate concern)
- Distributing a default key (each developer generates their own)

## Related Work

- Current E2E test ID detection: `test/e2e/utils/test-utils.ts`
- E2E testing documentation: `docs/E2E_TESTING.md`
- Manifest configuration: `manifest.config.ts`

## Open Questions

None. The approach is straightforward and well-scoped.
