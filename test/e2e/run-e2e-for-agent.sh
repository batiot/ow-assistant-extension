#!/usr/bin/env bash
# E2E Test Runner for Copilot Agents
# Runs E2E tests with timeout and generates a readable summary

set -euo pipefail

# Configuration
TIMEOUT=${E2E_TIMEOUT:-200}  # 200 seconds default (3min20s) - exceeds Playwright's 180s globalTimeout
RESULTS_FILE="test-results/test-results.json"
SUMMARY_FILE="test-results/summary.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Running E2E tests with ${TIMEOUT}s timeout..."
echo ""

# Run tests with timeout
if timeout ${TIMEOUT} npm run test:e2e -- "$@"; then
    EXIT_CODE=0
else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
        echo ""
        echo -e "${RED}⏱️  Tests timed out after ${TIMEOUT}s${NC}"
        EXIT_CODE=1
    fi
fi

# Generate summary if JSON results exist
if [ -f "$RESULTS_FILE" ]; then
    echo ""
    echo "📊 Test Results Summary:"
    echo "======================="
    
    # Extract key metrics using jq if available, fallback to grep
    if command -v jq &> /dev/null; then
        TOTAL=$(jq '.suites[].specs | length' "$RESULTS_FILE" | awk '{s+=$1} END {print s}')
        PASSED=$(jq '[.suites[].specs[].tests[] | select(.status == "expected")] | length' "$RESULTS_FILE")
        FAILED=$(jq '[.suites[].specs[].tests[] | select(.status == "unexpected")] | length' "$RESULTS_FILE")
        SKIPPED=$(jq '[.suites[].specs[].tests[] | select(.status == "skipped")] | length' "$RESULTS_FILE")
        
        echo "Total tests: $TOTAL"
        echo -e "${GREEN}✓ Passed: $PASSED${NC}"
        if [ "$FAILED" -gt 0 ]; then
            echo -e "${RED}✗ Failed: $FAILED${NC}"
        else
            echo "✗ Failed: 0"
        fi
        if [ "$SKIPPED" -gt 0 ]; then
            echo -e "${YELLOW}⊘ Skipped: $SKIPPED${NC}"
        fi
        
        # Show failed tests
        if [ "$FAILED" -gt 0 ]; then
            echo ""
            echo -e "${RED}Failed Tests:${NC}"
            jq -r '.suites[].specs[] | select(.tests[].status == "unexpected") | "  - " + .title' "$RESULTS_FILE"
        fi
        
        # Save summary to file
        {
            echo "E2E Test Summary"
            echo "==============="
            echo "Total: $TOTAL | Passed: $PASSED | Failed: $FAILED | Skipped: $SKIPPED"
            if [ "$FAILED" -gt 0 ]; then
                echo ""
                echo "Failed Tests:"
                jq -r '.suites[].specs[] | select(.tests[].status == "unexpected") | "  - " + .title' "$RESULTS_FILE"
            fi
        } > "$SUMMARY_FILE"
        
        echo ""
        echo "Summary saved to: $SUMMARY_FILE"
        echo "Full results: $RESULTS_FILE"
        echo "HTML report: npx playwright show-report"
    else
        echo "⚠️  jq not found - install it for detailed summary"
        echo "Full results available in: $RESULTS_FILE"
    fi
else
    echo "⚠️  No test results found at $RESULTS_FILE"
fi

exit $EXIT_CODE
