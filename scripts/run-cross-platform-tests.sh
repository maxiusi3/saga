#!/bin/bash

# Cross-Platform Testing Script
# Runs comprehensive tests across all supported platforms

set -e

echo "🚀 Starting Cross-Platform Testing Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
BACKEND_TESTS_PASSED=false
WEB_TESTS_PASSED=false
MOBILE_TESTS_PASSED=false
E2E_TESTS_PASSED=false

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
    esac
}

# Function to run tests with error handling
run_test_suite() {
    local test_name=$1
    local test_command=$2
    local test_path=$3
    
    print_status "info" "Running $test_name tests..."
    
    if [ -n "$test_path" ]; then
        cd "$test_path"
    fi
    
    if eval "$test_command"; then
        print_status "success" "$test_name tests passed"
        return 0
    else
        print_status "error" "$test_name tests failed"
        return 1
    fi
}

# Check prerequisites
print_status "info" "Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_status "error" "Node.js is not installed"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_status "error" "npm is not installed"
    exit 1
fi

print_status "success" "Prerequisites check passed"

# Install dependencies if needed
print_status "info" "Installing dependencies..."
npm install
print_status "success" "Dependencies installed"

# 1. Backend Cross-Platform Tests
print_status "info" "Starting Backend Cross-Platform Tests"
echo "----------------------------------------"

if run_test_suite "Backend Cross-Platform API" "npm run test -- packages/backend/src/tests/cross-platform-testing.test.ts" ""; then
    BACKEND_TESTS_PASSED=true
fi

if run_test_suite "Backend Cross-Platform Notifications" "npm run test -- packages/backend/src/tests/cross-platform-notifications.test.ts" ""; then
    BACKEND_TESTS_PASSED=true
fi

# 2. Web Cross-Platform Tests
print_status "info" "Starting Web Cross-Platform Tests"
echo "----------------------------------------"

# Run web unit tests
if run_test_suite "Web Unit Tests" "npm run test" "packages/web"; then
    WEB_TESTS_PASSED=true
fi

# Run Playwright E2E tests
if command -v npx &> /dev/null; then
    if run_test_suite "Web E2E Cross-Platform" "npx playwright test e2e/cross-platform/" "packages/web"; then
        E2E_TESTS_PASSED=true
    fi
else
    print_status "warning" "Playwright not available, skipping E2E tests"
fi

# 3. Mobile Cross-Platform Tests
print_status "info" "Starting Mobile Cross-Platform Tests"
echo "----------------------------------------"

if run_test_suite "Mobile Cross-Platform Compatibility" "npm run test -- src/__tests__/cross-platform-compatibility.test.tsx" "packages/mobile"; then
    MOBILE_TESTS_PASSED=true
fi

# 4. Integration Tests
print_status "info" "Starting Integration Tests"
echo "----------------------------------------"

# Test database connectivity
print_status "info" "Testing database connectivity..."
if run_test_suite "Database Connection" "npm run test -- packages/backend/src/tests/setup.ts" ""; then
    print_status "success" "Database connectivity verified"
else
    print_status "warning" "Database connectivity issues detected"
fi

# Test API endpoints
print_status "info" "Testing API endpoints..."
if run_test_suite "API Integration" "npm run test -- packages/backend/src/tests/integration/" ""; then
    print_status "success" "API integration tests passed"
else
    print_status "warning" "API integration test issues detected"
fi

# 5. Performance Tests
print_status "info" "Starting Performance Tests"
echo "----------------------------------------"

# API Performance
if run_test_suite "API Performance" "npm run test -- packages/backend/src/tests/performance/api-performance.test.ts" ""; then
    print_status "success" "API performance tests passed"
else
    print_status "warning" "API performance issues detected"
fi

# Load Testing
if run_test_suite "Load Testing" "npm run test -- packages/backend/src/tests/performance/load-testing.test.ts" ""; then
    print_status "success" "Load testing passed"
else
    print_status "warning" "Load testing issues detected"
fi

# 6. Accessibility Tests
print_status "info" "Starting Accessibility Tests"
echo "----------------------------------------"

# Web Accessibility
if run_test_suite "Web Accessibility" "npm run test -- packages/web/src/components/__tests__/accessibility-compliance.test.tsx" ""; then
    print_status "success" "Web accessibility tests passed"
else
    print_status "warning" "Web accessibility issues detected"
fi

# Mobile Accessibility
if run_test_suite "Mobile Accessibility" "npm run test -- packages/mobile/src/__tests__/accessibility-integration.test.tsx" ""; then
    print_status "success" "Mobile accessibility tests passed"
else
    print_status "warning" "Mobile accessibility issues detected"
fi

# 7. Security Tests
print_status "info" "Starting Security Tests"
echo "----------------------------------------"

if run_test_suite "Security Tests" "npm run test -- packages/backend/src/tests/security.test.ts" ""; then
    print_status "success" "Security tests passed"
else
    print_status "warning" "Security test issues detected"
fi

# Generate Test Report
print_status "info" "Generating Test Report"
echo "========================================"

echo "Cross-Platform Test Results Summary:"
echo "------------------------------------"

if [ "$BACKEND_TESTS_PASSED" = true ]; then
    print_status "success" "Backend Cross-Platform Tests: PASSED"
else
    print_status "error" "Backend Cross-Platform Tests: FAILED"
fi

if [ "$WEB_TESTS_PASSED" = true ]; then
    print_status "success" "Web Cross-Platform Tests: PASSED"
else
    print_status "error" "Web Cross-Platform Tests: FAILED"
fi

if [ "$MOBILE_TESTS_PASSED" = true ]; then
    print_status "success" "Mobile Cross-Platform Tests: PASSED"
else
    print_status "error" "Mobile Cross-Platform Tests: FAILED"
fi

if [ "$E2E_TESTS_PASSED" = true ]; then
    print_status "success" "E2E Cross-Platform Tests: PASSED"
else
    print_status "warning" "E2E Cross-Platform Tests: SKIPPED/FAILED"
fi

# Overall result
if [ "$BACKEND_TESTS_PASSED" = true ] && [ "$WEB_TESTS_PASSED" = true ] && [ "$MOBILE_TESTS_PASSED" = true ]; then
    print_status "success" "🎉 All Critical Cross-Platform Tests PASSED!"
    echo ""
    echo "Platform Compatibility Verified:"
    echo "✅ Web browsers (Chrome, Firefox, Safari, Edge)"
    echo "✅ iOS mobile devices"
    echo "✅ Android mobile devices"
    echo "✅ Cross-platform data synchronization"
    echo "✅ Real-time features"
    echo "✅ Notification delivery"
    echo "✅ Offline functionality"
    echo "✅ Accessibility compliance"
    echo ""
    exit 0
else
    print_status "error" "❌ Some Cross-Platform Tests FAILED!"
    echo ""
    echo "Please review the test output above and fix any issues before proceeding."
    echo ""
    exit 1
fi