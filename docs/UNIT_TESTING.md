# Unit Testing Guide

## Overview

This project uses **Vitest** for unit testing isolated business logic and utilities. Unit tests complement our E2E tests by providing fast feedback on pure functions and error handling logic.

## When to Write Unit Tests vs E2E Tests

### ✅ Write Unit Tests For:
- **Pure functions** (no side effects, deterministic output)
  - Theme resolution logic
  - Data transformation/validation
  - Error handling classes
  - Utility functions (retry logic, crypto operations)
- **Business logic** that doesn't require browser/Chrome APIs
- **Error cases** that are hard to trigger in E2E tests

### ❌ DON'T Write Unit Tests For:
- **React components** - Use E2E tests instead
- **React contexts** (AuthContext, SettingsContext) - Too integration-heavy
- **Chrome extension API integrations** - E2E tests cover these thoroughly
- **Storage operations** - E2E tests provide better coverage
- **Full API request/response flows** - E2E tests are more valuable
- **UI rendering and interactions** - Use Playwright E2E tests

### Decision Tree

```
Is it a pure function with no dependencies?
├─ YES → Unit test ✅
└─ NO → Does it need Chrome APIs, React, or storage?
    ├─ YES → E2E test ✅
    └─ NO → Is it simple error handling logic?
        ├─ YES → Unit test ✅
        └─ NO → E2E test ✅
```

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode (for development)
npm run test:unit:watch

# Run tests with coverage report
npm run test:unit:coverage

# Open interactive test UI
npm run test:unit:ui
```

## Writing Unit Tests

### Basic Test Structure (AAA Pattern)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '@/path/to/module';

describe('Module Name', () => {
  beforeEach(() => {
    // Arrange: Setup before each test
    vi.clearAllMocks();
  });

  describe('functionName', () => {
    it('should do something when condition is met', () => {
      // Arrange: Prepare test data
      const input = 'test-input';

      // Act: Execute the function
      const result = myFunction(input);

      // Assert: Verify the result
      expect(result).toBe('expected-output');
    });
  });
});
```

### Mocking Chrome APIs (Minimal)

Chrome APIs are mocked globally in `test/unit/setup.ts`. For most tests, you don't need to do anything special.

```typescript
import { vi } from 'vitest';

// Chrome APIs are already mocked globally
// Just override specific methods as needed:

beforeEach(() => {
  chrome.storage.local.get = vi.fn(() => 
    Promise.resolve({ key: 'value' })
  );
});
```

**Important**: If you find yourself writing complex Chrome API mocks, that's a sign the code should be tested in E2E tests instead!

### Testing Pure Functions (Best Practice)

```typescript
// ✅ GOOD: Testing pure function
import { resolveTheme } from '@/settings/theme';

it('should resolve system theme to dark when system prefers dark', () => {
  // Mock window.matchMedia
  window.matchMedia = vi.fn(() => ({
    matches: true,
    media: '(prefers-color-scheme: dark)',
  } as any));

  expect(resolveTheme('system')).toBe('dark');
});
```

```typescript
// ❌ BAD: Over-mocking integration code
import { AuthContext } from '@/contexts/AuthContext';

it('should login user', async () => {
  // This requires mocking React, chrome.storage, auth service...
  // Use E2E tests instead!
});
```

### Testing Error Handling

```typescript
import { ApiError } from '@/api/types';

it('should create ApiError with status code', () => {
  const error = new ApiError('Unauthorized', 401, { detail: 'Invalid token' });

  expect(error).toBeInstanceOf(Error);
  expect(error.statusCode).toBe(401);
  expect(error.response.detail).toBe('Invalid token');
});
```

## Code Coverage

### Coverage Targets
- **Pure utilities** (crypto, retry, theme): >70%
- **Integration modules** (config, API client): >40%
- **Overall project**: ~50%

### Why Not 100% Coverage?

High coverage is **not** the goal. We prioritize:
1. **Testing what matters**: Pure logic and error handling
2. **Avoiding brittle tests**: Over-mocking makes tests fragile
3. **Leveraging E2E tests**: They provide better coverage for integration scenarios

### Viewing Coverage

```bash
npm run test:unit:coverage
open coverage/index.html  # View HTML report
```

## Common Patterns

### Testing Validation Logic

```typescript
describe('validateConfig', () => {
  it('should reject invalid URL', () => {
    const result = validateConfig({ url: 'not-a-url' });
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid URL format');
  });
});
```

### Testing Async Functions

```typescript
it('should encrypt data successfully', async () => {
  const encrypted = await encrypt('test-data');
  
  expect(encrypted).toBeDefined();
  expect(typeof encrypted).toBe('string');
});
```

### Testing Error Cases

```typescript
it('should throw on encryption error', async () => {
  mockCrypto.subtle.encrypt = vi.fn(() => 
    Promise.reject(new Error('Encryption failed'))
  );

  await expect(encrypt('test-data')).rejects.toThrow('Encryption failed');
});
```

## Troubleshooting

### Tests Fail with "Cannot find module"

Make sure path aliases are configured correctly in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Chrome API Not Mocked

Check that `test/unit/setup.ts` is loaded. It's configured in `vitest.config.ts`:

```typescript
test: {
  setupFiles: ['./test/unit/setup.ts'],
}
```

### Tests Are Too Slow

Unit tests should be fast (<10 seconds total). If tests are slow:
- Check if you're testing integration scenarios (move to E2E)
- Avoid unnecessary `await` statements
- Use `vi.fn()` instead of real implementations

### Mock Not Working

```typescript
// ❌ Wrong: Mocking after import
import { myFunction } from '@/module';
vi.fn(() => 'mocked');

// ✅ Correct: Mock before import
vi.mock('@/module', () => ({
  myFunction: vi.fn(() => 'mocked'),
}));
import { myFunction } from '@/module';
```

## Examples

Check these test files for patterns:
- **Pure functions**: `test/unit/settings/theme.test.ts`
- **Error handling**: `test/unit/api/client.test.ts`
- **Crypto/utilities**: `test/unit/auth/crypto.test.ts`
- **Validation logic**: `test/unit/config/manager.test.ts`

## Best Practices

1. **Keep tests simple** - If setup is complex, consider E2E testing
2. **Test behavior, not implementation** - Focus on inputs/outputs
3. **One assertion concept per test** - Tests should fail for one clear reason
4. **Use descriptive test names** - "should X when Y"
5. **Don't test third-party code** - Trust that libraries work
6. **Avoid testing private methods** - Test the public API

## Anti-Patterns

❌ **Testing everything** - Focus on what adds value
❌ **100% coverage goals** - Quality over quantity
❌ **Complex mocking** - Sign you need E2E tests
❌ **Testing implementation details** - Test public behavior
❌ **Duplicate E2E coverage** - Don't test the same thing twice

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- Project E2E tests: `test/e2e/`
