#!/usr/bin/env node
/**
 * E2E Test Runner for Copilot Agents
 * 
 * Runs E2E tests with automatic timeout and generates a readable summary.
 * This script is designed to be non-interactive and provide useful results
 * for AI agents without hanging the shell.
 * 
 * Usage:
 *   node test/e2e/run-e2e.js [test-filter]
 *   
 * Examples:
 *   node test/e2e/run-e2e.js                  # Run all tests
 *   node test/e2e/run-e2e.js httponly-cookie  # Run specific test file
 *   E2E_TIMEOUT=60 node test/e2e/run-e2e.js   # Custom timeout (seconds)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TIMEOUT = parseInt(process.env.E2E_TIMEOUT || '200', 10) * 1000; // Convert to ms (default 200s = 3min20s)
const RESULTS_FILE = path.join(__dirname, '../../test-results/test-results.json');
const SUMMARY_FILE = path.join(__dirname, '../../test-results/summary.txt');

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log('🧪 Running E2E tests with ' + (TIMEOUT / 1000) + 's timeout...\n');

// Build test command
const testArgs = ['run', 'test:e2e', '--'];
if (process.argv.length > 2) {
  testArgs.push(...process.argv.slice(2));
}

// Run tests with timeout
const testProcess = spawn('npm', testArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Capture output and detect HTML report server
let outputBuffer = '';
let reportServerDetected = false;

testProcess.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  outputBuffer += text;
  
  // Detect HTML report server starting
  if (!reportServerDetected && text.includes('Serving HTML report at')) {
    reportServerDetected = true;
    console.log('\n' + colors.blue + '📊 HTML report ready, stopping process...' + colors.reset);
    clearTimeout(timer);
    testProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!testProcess.killed) {
        testProcess.kill('SIGKILL');
      }
      // Force exit after killing the child process
      setTimeout(() => {
        generateSummary(1); // Will exit with code 1 for failures
      }, 500);
    }, 1000);
  }
});

testProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.log('\n' + colors.red + '⏱️  Tests timed out after ' + (TIMEOUT / 1000) + 's' + colors.reset);
  testProcess.kill('SIGTERM');
  
  setTimeout(() => {
    if (!testProcess.killed) {
      testProcess.kill('SIGKILL');
    }
  }, 5000);
}, TIMEOUT);

testProcess.on('close', (code) => {
  clearTimeout(timer);
  
  // Wait a moment for JSON file to be written
  setTimeout(() => {
    generateSummary(timedOut ? 124 : code);
  }, 500);
});

function generateSummary(exitCode) {
  console.log('\n📊 Test Results Summary:');
  console.log('=======================\n');

  if (!fs.existsSync(RESULTS_FILE)) {
    console.log('⚠️  No test results found at ' + RESULTS_FILE);
    process.exit(exitCode || 1);
    return;
  }

  try {
    const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    
    // Calculate statistics
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failedTests = [];

    results.suites.forEach(suite => {
      suite.specs.forEach(spec => {
        spec.tests.forEach(test => {
          total++;
          if (test.status === 'expected') {
            passed++;
          } else if (test.status === 'unexpected') {
            failed++;
            failedTests.push({
              file: spec.file,
              title: spec.title,
              error: test.results[0]?.error?.message || 'Unknown error'
            });
          } else if (test.status === 'skipped') {
            skipped++;
          }
        });
      });
    });

    // Display summary
    console.log('Total tests: ' + total);
    console.log(colors.green + '✓ Passed: ' + passed + colors.reset);
    
    if (failed > 0) {
      console.log(colors.red + '✗ Failed: ' + failed + colors.reset);
    } else {
      console.log('✗ Failed: 0');
    }
    
    if (skipped > 0) {
      console.log(colors.yellow + '⊘ Skipped: ' + skipped + colors.reset);
    }

    // Show failed tests
    if (failedTests.length > 0) {
      console.log('\n' + colors.red + 'Failed Tests:' + colors.reset);
      failedTests.forEach(test => {
        console.log('  - ' + test.title);
        const errorLines = test.error.split('\n').slice(0, 2);
        errorLines.forEach(line => {
          console.log('    ' + colors.yellow + line + colors.reset);
        });
      });
    }

    // Save summary to file
    const summaryText = `E2E Test Summary
===============
Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}

${failedTests.length > 0 ? 'Failed Tests:\n' + failedTests.map(t => `  - ${t.title}\n    ${t.error.split('\n')[0]}`).join('\n') : ''}
`;

    fs.writeFileSync(SUMMARY_FILE, summaryText);

    console.log('\nSummary saved to: ' + SUMMARY_FILE);
    console.log('Full results: ' + RESULTS_FILE);
    console.log('HTML report: npx playwright show-report');

    // Exit with failure if any tests failed
    process.exit(failed > 0 ? 1 : exitCode);
    
  } catch (error) {
    console.error('Error parsing results:', error.message);
    console.log('Full results available in: ' + RESULTS_FILE);
    process.exit(exitCode || 1);
  }
}
