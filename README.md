# React + Vite + CRXJS

This template helps you quickly start developing Chrome extensions with React, TypeScript and Vite. It includes the CRXJS Vite plugin for seamless Chrome extension development.

## Features

- React with TypeScript
- TypeScript support
- Vite build tool
- CRXJS Vite plugin integration
- Chrome extension manifest configuration

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open Chrome and navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension from the `dist` directory.

4. Build for production:

```bash
npm run build
```

## Project Structure

- `src/popup/` - Extension popup UI
- `src/content/` - Content scripts
- `manifest.config.ts` - Chrome extension manifest configuration

## Testing

### End-to-End Tests

End-to-end tests use Playwright to validate the extension in a real browser environment. The tests cover:
- Extension loading and initialization
- Popup UI functionality
- Sidepanel interaction
- Content script injection
- API mocking and integration

To run the tests:

```bash
# Run all e2e tests
npm run test:e2e

# Run tests with UI mode
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Writing Tests

Tests are located in `test/e2e/`. Each test file should:
- Import test utilities from `test/e2e/utils/test-utils`
- Use the provided helper classes for common operations
- Follow the existing patterns for consistent test structure

Example test structure:
```typescript
import { test, expect } from '../utils/test-utils';
import { ExtensionHelper } from '../utils/extension-helper';

test.describe('Feature Tests', () => {
  test('should do something', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const helper = new ExtensionHelper(page, extensionId);
    // Test implementation
  });
});
```

## Documentation

- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
- [Playwright Documentation](https://playwright.dev/)

## Chrome Extension Development Notes

- Use `manifest.config.ts` to configure your extension
- The CRXJS plugin automatically handles manifest generation
- Content scripts should be placed in `src/content/`
- Popup UI should be placed in `src/popup/`
