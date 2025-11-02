# CI Workflow Change

This change adds a GitHub Actions workflow to run typechecking, build the extension package, and execute e2e tests.

## How to run CI locally

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Run TypeScript check:
   ```bash
   npx tsc -b --noEmit
   ```

3. Build extension package:
   ```bash
   npm run build
   ```
   The built extension zip will be in `release/crx-ow-assistant-extension-1.0.0.zip`

4. Run e2e tests:
   ```bash
   npm run test:e2e
   ```

## GitHub Actions Artifacts

After the workflow runs, two artifacts are available:

1. `extension-release-zip` - Contains the built extension package (`*.zip`)
2. `playwright-report` - Contains the Playwright test results and report

To download artifacts:
1. Go to the Actions tab in GitHub
2. Click on the workflow run
3. Scroll to the Artifacts section at the bottom
4. Click to download the zip or report