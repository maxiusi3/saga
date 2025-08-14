#!/bin/bash

# Comprehensive Test Suite for Saga Family Biography
# Tests all 8 completed tasks from the specification

echo "🚀 Starting Comprehensive Test Suite for Saga Family Biography"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo ""
    log_info "Running: $test_name"
    echo "----------------------------------------"
    
    ((TOTAL_TESTS++))
    
    if eval "$test_command"; then
        log_success "$test_name completed successfully"
    else
        log_error "$test_name failed"
        # Don't exit, continue with other tests
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup test environment
setup_environment() {
    log_info "Setting up test environment..."
    
    # Install dependencies
    run_test "Installing root dependencies" "npm install"
    run_test "Installing backend dependencies" "((cd packages/backend && npm install)"
    run_test "Installing web dependencies" "((cd packages/web && npm install)"
    run_test "Installing mobile dependencies" "((cd packages/mobile && npm install)"
    run_test "Installing shared dependencies" "(cd packages/shared && npm install)"
    
    # Setup test database
    run_test "Setting up test database" "((cd packages/backend && NODE_ENV=test npm run db:migrate)"
    run_test "Seeding test database" "((cd packages/backend && NODE_ENV=test npm run db:seed)"
}

# Task 1: Resource Wallet System Tests
test_resource_wallet() {
    log_info "Testing Task 1: Resource Wallet System"
    
    run_test "Resource Wallet Service Tests" "((cd packages/backend && npm test -- --testPathPattern=resource-wallet-service.test.ts))"
    run_test "Resource Wallet Integration Tests" "((cd packages/backend && npm test -- --testPathPattern=resource-wallet-integration.test.ts))"
    run_test "Wallet Transaction Flow Tests" "((cd packages/backend && npm test -- --testPathPattern=wallet-transaction-flows.test.ts))"
}

# Task 2: Authentication & User Management Tests
test_authentication() {
    log_info "Testing Task 2: Authentication & User Management"
    
    run_test "Authentication Service Tests" "(cd packages/backend && npm test -- --testPathPattern=auth.test.ts)"
    run_test "Authentication Middleware Tests" "(cd packages/backend && npm test -- --testPathPattern=auth-middleware.test.ts)"
    run_test "OAuth Service Tests" "(cd packages/backend && npm test -- --testPathPattern=auth-wallet.test.ts)"
    run_test "Web Auth Store Tests" "(cd packages/web && npm test -- --testPathPattern=auth-store.test.ts)"
    run_test "Mobile Auth Store Tests" "(cd packages/mobile && npm test -- --testPathPattern=auth-store.test.ts)"
}

# Task 3: AI Prompt System Tests
test_ai_prompt_system() {
    log_info "Testing Task 3: AI Prompt System"
    
    run_test "AI Prompt Service Tests" "(cd packages/backend && npm test -- --testPathPattern=ai-prompt-service.test.ts)"
    run_test "AI Prompt Service Improved Tests" "(cd packages/backend && npm test -- --testPathPattern=ai-prompt-service-improved.test.ts)"
    run_test "Prompt Management Tests" "(cd packages/backend && npm test -- --testPathPattern=prompt-management.test.ts)"
    run_test "Mobile Prompt Service Tests" "(cd packages/mobile && npm test -- --testPathPattern=prompt-service.test.ts)"
}

# Task 4: Recording & STT Pipeline Tests
test_recording_stt() {
    log_info "Testing Task 4: Recording & STT Pipeline"
    
    run_test "Speech-to-Text Service Tests" "(cd packages/backend && npm test -- --testPathPattern=stt.test.ts)"
    run_test "Media Processing Service Tests" "(cd packages/backend && npm test -- --testPathPattern=media-processing-service.test.ts)"
    run_test "Mobile Recording Service Tests" "(cd packages/mobile && npm test -- --testPathPattern=recording-service.test.ts)"
    run_test "Enhanced Recording Service Tests" "(cd packages/mobile && npm test -- --testPathPattern=enhanced-recording-service.test.ts)"
    run_test "Recording Analytics Tests" "(cd packages/backend && npm test -- --testPathPattern=recording-analytics-service.test.ts)"
}

# Task 5: Story Management System Tests
test_story_management() {
    log_info "Testing Task 5: Story Management System"
    
    run_test "Story Service Tests" "(cd packages/backend && npm test -- --testPathPattern=stories.test.ts)"
    run_test "Story Workflow Integration Tests" "(cd packages/backend && npm test -- --testPathPattern=story-workflow-integration.test.ts)"
    run_test "Chapter Summary Service Tests" "(cd packages/backend && npm test -- --testPathPattern=chapter-summary-service.test.ts)"
    run_test "Story Discovery Tests" "(cd packages/backend && npm test -- --testPathPattern=story-discovery.test.ts)"
    run_test "Search Service Tests" "(cd packages/backend && npm test -- --testPathPattern=search-service.test.ts)"
}

# Task 6: Data Export System Tests
test_data_export() {
    log_info "Testing Task 6: Data Export System"
    
    run_test "Enhanced Export Service Tests" "(cd packages/backend && npm test -- --testPathPattern=enhanced-export-service.test.ts)"
    run_test "Archival Service Tests" "(cd packages/backend && npm test -- --testPathPattern=archival-service.test.ts)"
    run_test "Archival Export Service Tests" "(cd packages/backend && npm test -- --testPathPattern=archival-export-service.test.ts)"
    run_test "Web Export Store Tests" "(cd packages/web && npm test -- --testPathPattern=export-store.test.ts)"
}

# Task 7: Web Dashboard Tests
test_web_dashboard() {
    log_info "Testing Task 7: Web Dashboard"
    
    run_test "Project Pages Tests" "(cd packages/web && npm test -- --testPathPattern=projects)"
    run_test "Stories Pages Tests" "(cd packages/web && npm test -- --testPathPattern=stories)"
    run_test "Export Pages Tests" "(cd packages/web && npm test -- --testPathPattern=exports)"
    run_test "Subscription Components Tests" "(cd packages/web && npm test -- --testPathPattern=subscription)"
    run_test "Audio Player Tests" "(cd packages/web && npm test -- --testPathPattern=audio-player.test.tsx)"
}

# Task 8: Mobile App Foundation Tests
test_mobile_app() {
    log_info "Testing Task 8: Mobile App Foundation"
    
    run_test "Mobile Recording Components Tests" "(cd packages/mobile && npm test -- --testPathPattern=recording)"
    run_test "Mobile Accessibility Tests" "(cd packages/mobile && npm test -- --testPathPattern=accessibility)"
    run_test "Mobile Onboarding Tests" "(cd packages/mobile && npm test -- --testPathPattern=onboarding)"
    run_test "Cross-platform Compatibility Tests" "(cd packages/mobile && npm test -- --testPathPattern=cross-platform-compatibility.test.tsx)"
    run_test "Device Compatibility Tests" "(cd packages/mobile && npm test -- --testPathPattern=device-compatibility.test.tsx)"
}

# Integration Tests
test_integration() {
    log_info "Running Integration Tests"
    
    run_test "Project Creation Integration" "(cd packages/backend && npm test -- --testPathPattern=project-creation-integration.test.ts)"
    run_test "Payment Flow Integration" "(cd packages/backend && npm test -- --testPathPattern=payment-flow-integration.test.ts)"
    run_test "WebSocket Integration" "(cd packages/backend && npm test -- --testPathPattern=websocket-integration.test.ts)"
    run_test "File Processing Integration" "(cd packages/backend && npm test -- --testPathPattern=file-processing-integration.test.ts)"
}

# Cross-platform Tests
test_cross_platform() {
    log_info "Running Cross-platform Tests"
    
    if [ -f "scripts/run-cross-platform-tests.sh" ]; then
        run_test "Cross-platform Test Suite" "bash scripts/run-cross-platform-tests.sh"
    else
        log_warning "Cross-platform test script not found, skipping"
    fi
}

# Performance Tests
test_performance() {
    log_info "Running Performance Tests"
    
    run_test "Load Testing" "(cd packages/backend && npm test -- --testPathPattern=load-testing.test.ts)"
    run_test "API Performance Tests" "(cd packages/backend && npm test -- --testPathPattern=api-performance.test.ts)"
}

# Security Tests
test_security() {
    log_info "Running Security Tests"
    
    run_test "Security Tests" "(cd packages/backend && npm test -- --testPathPattern=security.test.ts)"
}

# E2E Tests
test_e2e() {
    log_info "Running End-to-End Tests"
    
    # Start test servers in background
    log_info "Starting test servers..."
    (cd packages/backend && npm run start:test) &
    BACKEND_PID=$!
    
    (cd packages/web && npm run build && npm run start) &
    WEB_PID=$!
    
    # Wait for servers to start
    sleep 10
    
    # Run E2E tests
    run_test "Web E2E Tests" "(cd packages/web && npm run test:e2e)"
    run_test "Mobile E2E Tests" "(cd packages/mobile && npm run test:e2e)"
    
    # Clean up
    kill $BACKEND_PID $WEB_PID 2>/dev/null || true
}

# Main execution
main() {
    echo "Starting comprehensive test suite..."
    echo "This will test all 8 completed tasks from the Saga Family Biography specification"
    echo ""
    
    check_prerequisites
    setup_environment
    
    # Run all test suites
    test_resource_wallet
    test_authentication
    test_ai_prompt_system
    test_recording_stt
    test_story_management
    test_data_export
    test_web_dashboard
    test_mobile_app
    test_integration
    test_cross_platform
    test_performance
    test_security
    
    # Optional E2E tests (comment out if not needed)
    # test_e2e
    
    # Final report
    echo ""
    echo "=============================================================="
    echo "🏁 Test Suite Complete!"
    echo "=============================================================="
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! The system is ready for production.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"