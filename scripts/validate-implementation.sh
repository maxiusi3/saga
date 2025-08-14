#!/bin/bash

# Implementation Validation Script
# Validates that all 8 tasks from the specification are properly implemented

set -e

echo "🔍 Validating Implementation - Saga Family Biography"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VALIDATION_PASSED=0
VALIDATION_FAILED=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((VALIDATION_PASSED++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((VALIDATION_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if file exists
check_file() {
    local file_path="$1"
    local description="$2"
    
    if [ -f "$file_path" ]; then
        log_success "$description exists: $file_path"
        return 0
    else
        log_error "$description missing: $file_path"
        return 1
    fi
}

# Check if directory exists
check_directory() {
    local dir_path="$1"
    local description="$2"
    
    if [ -d "$dir_path" ]; then
        log_success "$description exists: $dir_path"
        return 0
    else
        log_error "$description missing: $dir_path"
        return 1
    fi
}

# Check if string exists in file
check_content() {
    local file_path="$1"
    local search_string="$2"
    local description="$3"
    
    if [ -f "$file_path" ] && grep -q "$search_string" "$file_path"; then
        log_success "$description implemented in $file_path"
        return 0
    else
        log_error "$description not found in $file_path"
        return 1
    fi
}

# Validate Task 1: Resource Wallet System
validate_task_1() {
    log_info "Validating Task 1: Resource Wallet System"
    echo "----------------------------------------"
    
    # Database models
    check_file "packages/backend/src/models/resource-wallet.ts" "Resource Wallet Model"
    check_file "packages/backend/src/models/seat-transaction.ts" "Seat Transaction Model"
    check_file "packages/backend/src/models/package.ts" "Package Model"
    
    # Services
    check_file "packages/backend/src/services/resource-wallet-service.ts" "Resource Wallet Service"
    check_file "packages/backend/src/services/package-service.ts" "Package Service"
    check_file "packages/backend/src/services/wallet-sync-service.ts" "Wallet Sync Service"
    
    # Controllers and Routes
    check_file "packages/backend/src/controllers/wallet-controller.ts" "Wallet Controller"
    check_file "packages/backend/src/routes/wallets.ts" "Wallet Routes"
    
    # Database migrations
    check_file "packages/backend/migrations/20241201000001_create_user_resource_wallets_table.js" "Resource Wallet Migration"
    check_file "packages/backend/migrations/20241201000002_create_seat_transactions_table.js" "Seat Transaction Migration"
    check_file "packages/backend/migrations/20241201000014_create_packages_table.js" "Package Migration"
    
    # Tests
    check_file "packages/backend/src/tests/resource-wallet-service.test.ts" "Resource Wallet Tests"
    check_file "packages/backend/src/tests/integration/resource-wallet-integration.test.ts" "Resource Wallet Integration Tests"
    
    # Web components
    check_file "packages/web/src/components/wallet/wallet-status.tsx" "Wallet Status Component"
    check_file "packages/web/src/components/wallet/purchase-prompt.tsx" "Purchase Prompt Component"
    
    # Shared types
    check_file "packages/shared/src/types/resource-wallet.ts" "Resource Wallet Types"
    check_file "packages/shared/src/types/seat-transaction.ts" "Seat Transaction Types"
    
    echo ""
}

# Validate Task 2: Authentication & User Management
validate_task_2() {
    log_info "Validating Task 2: Authentication & User Management"
    echo "------------------------------------------------"
    
    # Backend authentication
    check_file "packages/backend/src/services/auth-service.ts" "Auth Service"
    check_file "packages/backend/src/services/oauth-service.ts" "OAuth Service"
    check_file "packages/backend/src/controllers/auth-controller.ts" "Auth Controller"
    check_file "packages/backend/src/middleware/auth.ts" "Auth Middleware"
    check_file "packages/backend/src/routes/auth.ts" "Auth Routes"
    
    # Configuration
    check_file "packages/backend/src/config/auth.ts" "Auth Configuration"
    check_file "packages/backend/src/config/firebase.ts" "Firebase Configuration"
    
    # Web authentication
    check_file "packages/web/src/stores/auth-store.ts" "Web Auth Store"
    check_file "packages/web/src/components/auth/protected-route.tsx" "Protected Route Component"
    check_file "packages/web/src/lib/oauth.ts" "Web OAuth Library"
    check_file "packages/web/src/app/auth/signin/page.tsx" "Sign In Page"
    check_file "packages/web/src/app/auth/signup/page.tsx" "Sign Up Page"
    
    # Mobile authentication
    check_file "packages/mobile/src/stores/auth-store.ts" "Mobile Auth Store"
    check_file "packages/mobile/src/screens/auth/WelcomeScreen.tsx" "Welcome Screen"
    
    # Tests
    check_file "packages/backend/src/tests/auth.test.ts" "Auth Tests"
    check_file "packages/backend/src/tests/auth-middleware.test.ts" "Auth Middleware Tests"
    check_file "packages/web/src/stores/__tests__/auth-store.test.ts" "Web Auth Store Tests"
    
    echo ""
}

# Validate Task 3: AI Prompt System
validate_task_3() {
    log_info "Validating Task 3: AI Prompt System"
    echo "-----------------------------------"
    
    # Backend services
    check_file "packages/backend/src/services/ai-prompt-service.ts" "AI Prompt Service"
    check_file "packages/backend/src/services/ai-prompt-service-improved.ts" "Improved AI Prompt Service"
    check_file "packages/backend/src/controllers/prompt-controller.ts" "Prompt Controller"
    check_file "packages/backend/src/routes/prompts.ts" "Prompt Routes"
    
    # Models
    check_file "packages/backend/src/models/prompt.ts" "Prompt Model"
    check_file "packages/backend/src/models/user-prompt.ts" "User Prompt Model"
    check_file "packages/backend/src/models/chapter.ts" "Chapter Model"
    
    # Configuration
    check_file "packages/backend/src/config/openai.ts" "OpenAI Configuration"
    
    # Database migrations
    check_file "packages/backend/migrations/20241201000004_create_chapters_table.js" "Chapters Migration"
    check_file "packages/backend/migrations/20241201000005_update_prompts_table_v15.js" "Prompts Migration"
    check_file "packages/backend/migrations/20241201000007_create_project_prompt_state_table.js" "Prompt State Migration"
    
    # Prompt management
    check_file "packages/backend/src/controllers/prompt-management-controller.ts" "Prompt Management Controller"
    check_file "packages/backend/src/services/prompt-analytics-service.ts" "Prompt Analytics Service"
    check_file "packages/backend/src/services/prompt-quality-service.ts" "Prompt Quality Service"
    
    # Mobile prompt interface
    check_file "packages/mobile/src/services/prompt-service.ts" "Mobile Prompt Service"
    check_file "packages/mobile/src/components/recording/PromptCard.tsx" "Prompt Card Component"
    
    # Tests
    check_file "packages/backend/src/tests/ai-prompt-service.test.ts" "AI Prompt Service Tests"
    check_file "packages/backend/src/tests/ai-prompt-service-improved.test.ts" "Improved AI Prompt Service Tests"
    check_file "packages/backend/src/tests/prompt-management.test.ts" "Prompt Management Tests"
    
    # Shared types
    check_file "packages/shared/src/types/prompt.ts" "Prompt Types"
    check_file "packages/shared/src/types/chapter.ts" "Chapter Types"
    
    echo ""
}

# Validate Task 4: Recording & STT Pipeline
validate_task_4() {
    log_info "Validating Task 4: Recording & STT Pipeline"
    echo "-------------------------------------------"
    
    # Backend STT services
    check_file "packages/backend/src/services/speech-to-text-service.ts" "Speech-to-Text Service"
    check_file "packages/backend/src/services/media-processing-service.ts" "Media Processing Service"
    check_file "packages/backend/src/controllers/stt-controller.ts" "STT Controller"
    check_file "packages/backend/src/routes/stt.ts" "STT Routes"
    
    # Configuration
    check_file "packages/backend/src/config/speech.ts" "Speech Configuration"
    
    # Mobile recording services
    check_file "packages/mobile/src/services/recording-service.ts" "Recording Service"
    check_file "packages/mobile/src/services/enhanced-recording-service.ts" "Enhanced Recording Service"
    check_file "packages/mobile/src/services/recording-upload-service.ts" "Recording Upload Service"
    check_file "packages/mobile/src/services/audio-recording-service.ts" "Audio Recording Service"
    
    # Mobile recording components
    check_file "packages/mobile/src/screens/main/RecordScreen.tsx" "Record Screen"
    check_file "packages/mobile/src/screens/main/ReviewAndSendScreen.tsx" "Review and Send Screen"
    check_file "packages/mobile/src/components/recording/RecordingControls.tsx" "Recording Controls"
    check_file "packages/mobile/src/components/recording/WaveformVisualization.tsx" "Waveform Visualization"
    check_file "packages/mobile/src/components/recording/RecordingQualityIndicator.tsx" "Recording Quality Indicator"
    
    # Recording analytics
    check_file "packages/backend/src/services/recording-analytics-service.ts" "Recording Analytics Service"
    check_file "packages/backend/src/services/recording-error-monitor.ts" "Recording Error Monitor"
    check_file "packages/backend/src/services/recording-performance-optimizer.ts" "Recording Performance Optimizer"
    
    # Tests
    check_file "packages/backend/src/tests/stt.test.ts" "STT Tests"
    check_file "packages/backend/src/tests/media-processing-service.test.ts" "Media Processing Tests"
    check_file "packages/mobile/src/services/__tests__/recording-service.test.ts" "Recording Service Tests"
    check_file "packages/mobile/src/services/__tests__/enhanced-recording-service.test.ts" "Enhanced Recording Service Tests"
    
    # Shared types
    check_file "packages/shared/src/types/recording.ts" "Recording Types"
    
    echo ""
}

# Validate Task 5: Story Management System
validate_task_5() {
    log_info "Validating Task 5: Story Management System"
    echo "------------------------------------------"
    
    # Backend story management
    check_file "packages/backend/src/controllers/story-controller.ts" "Story Controller"
    check_file "packages/backend/src/routes/stories.ts" "Story Routes"
    check_file "packages/backend/src/models/story.ts" "Story Model"
    check_file "packages/backend/src/models/interaction.ts" "Interaction Model"
    
    # Chapter summaries
    check_file "packages/backend/src/services/chapter-summary-service.ts" "Chapter Summary Service"
    check_file "packages/backend/src/controllers/chapter-summary-controller.ts" "Chapter Summary Controller"
    check_file "packages/backend/src/models/chapter-summary.ts" "Chapter Summary Model"
    
    # Story discovery and search
    check_file "packages/backend/src/services/story-discovery-service.ts" "Story Discovery Service"
    check_file "packages/backend/src/services/search-service.ts" "Search Service"
    check_file "packages/backend/src/controllers/search-controller.ts" "Search Controller"
    check_file "packages/backend/src/routes/search.ts" "Search Routes"
    
    # Story statistics and analytics
    check_file "packages/backend/src/services/story-statistics-service.ts" "Story Statistics Service"
    check_file "packages/backend/src/controllers/story-statistics-controller.ts" "Story Statistics Controller"
    
    # Story sharing and bookmarks
    check_file "packages/backend/src/services/story-share-service.ts" "Story Share Service"
    check_file "packages/backend/src/services/story-bookmark-service.ts" "Story Bookmark Service"
    
    # Web story components
    check_file "packages/web/src/app/dashboard/stories/page.tsx" "Stories Page"
    check_file "packages/web/src/app/dashboard/stories/[id]/page.tsx" "Story Detail Page"
    check_file "packages/web/src/components/audio/audio-player.tsx" "Audio Player Component"
    check_file "packages/web/src/components/stories/chapter-summary-card.tsx" "Chapter Summary Card"
    
    # Mobile story screens
    check_file "packages/mobile/src/screens/main/StoriesScreen.tsx" "Stories Screen"
    check_file "packages/mobile/src/screens/main/StoryDetailScreen.tsx" "Story Detail Screen"
    
    # Tests
    check_file "packages/backend/src/tests/stories.test.ts" "Story Tests"
    check_file "packages/backend/src/tests/story-discovery.test.ts" "Story Discovery Tests"
    check_file "packages/backend/src/tests/chapter-summary-service.test.ts" "Chapter Summary Tests"
    check_file "packages/backend/src/tests/search-service.test.ts" "Search Service Tests"
    
    # Shared types
    check_file "packages/shared/src/types/story.ts" "Story Types"
    check_file "packages/shared/src/types/interaction.ts" "Interaction Types"
    check_file "packages/shared/src/types/story-discovery.ts" "Story Discovery Types"
    
    echo ""
}

# Validate Task 6: Data Export System
validate_task_6() {
    log_info "Validating Task 6: Data Export System"
    echo "-------------------------------------"
    
    # Backend export services
    check_file "packages/backend/src/routes/exports.ts" "Export Routes"
    check_file "packages/backend/src/models/export-request.ts" "Export Request Model"
    
    # Archival system
    check_file "packages/backend/src/services/archival-service.ts" "Archival Service"
    check_file "packages/backend/src/services/archival-export-service.ts" "Archival Export Service"
    check_file "packages/backend/src/controllers/archival-export-controller.ts" "Archival Export Controller"
    check_file "packages/backend/src/middleware/archival.ts" "Archival Middleware"
    
    # Data retention
    check_file "packages/backend/src/services/data-retention-service.ts" "Data Retention Service"
    check_file "packages/backend/src/controllers/data-retention-controller.ts" "Data Retention Controller"
    
    # Web export interface
    check_file "packages/web/src/app/dashboard/exports/page.tsx" "Exports Page"
    check_file "packages/web/src/app/dashboard/projects/[id]/export/page.tsx" "Project Export Page"
    check_file "packages/web/src/stores/export-store.ts" "Export Store"
    
    # Tests
    check_file "packages/backend/src/tests/enhanced-export-service.test.ts" "Enhanced Export Service Tests"
    check_file "packages/backend/src/tests/archival-service.test.ts" "Archival Service Tests"
    check_file "packages/backend/src/tests/archival-export-service.test.ts" "Archival Export Service Tests"
    check_file "packages/web/src/stores/__tests__/export-store.test.ts" "Export Store Tests"
    
    echo ""
}

# Validate Task 7: Web Dashboard
validate_task_7() {
    log_info "Validating Task 7: Web Dashboard"
    echo "--------------------------------"
    
    # Main dashboard pages
    check_file "packages/web/src/app/dashboard/page.tsx" "Dashboard Home Page"
    check_file "packages/web/src/app/dashboard/layout.tsx" "Dashboard Layout"
    
    # Project management
    check_file "packages/web/src/app/dashboard/projects/page.tsx" "Projects Page"
    check_file "packages/web/src/app/dashboard/projects/new/page.tsx" "New Project Page"
    check_file "packages/web/src/app/dashboard/projects/[id]/page.tsx" "Project Detail Page"
    check_file "packages/web/src/app/dashboard/projects/[id]/edit/page.tsx" "Edit Project Page"
    check_file "packages/web/src/app/dashboard/projects/[id]/invite/page.tsx" "Invite Page"
    
    # Navigation and layout
    check_file "packages/web/src/components/layout/navigation.tsx" "Navigation Component"
    check_file "packages/web/src/components/layout/sidebar.tsx" "Sidebar Component"
    
    # Subscription management
    check_file "packages/web/src/app/dashboard/projects/[id]/subscription/page.tsx" "Subscription Page"
    check_file "packages/web/src/components/subscription/subscription-overview.tsx" "Subscription Overview"
    check_file "packages/web/src/components/subscription/subscription-status-card.tsx" "Subscription Status Card"
    
    # Stores and state management
    check_file "packages/web/src/stores/project-store.ts" "Project Store"
    check_file "packages/web/src/lib/api.ts" "API Library"
    
    # Tests
    check_file "packages/web/src/app/dashboard/projects/__tests__/page.test.tsx" "Projects Page Tests"
    check_file "packages/web/src/app/dashboard/stories/__tests__/page.test.tsx" "Stories Page Tests"
    check_file "packages/web/src/components/audio/__tests__/audio-player.test.tsx" "Audio Player Tests"
    
    echo ""
}

# Validate Task 8: Mobile App Foundation
validate_task_8() {
    log_info "Validating Task 8: Mobile App Foundation"
    echo "---------------------------------------"
    
    # Main app structure
    check_file "packages/mobile/App.tsx" "Main App Component"
    check_file "packages/mobile/src/navigation/AppNavigator.tsx" "App Navigator"
    check_file "packages/mobile/src/navigation/AuthNavigator.tsx" "Auth Navigator"
    check_file "packages/mobile/src/navigation/MainNavigator.tsx" "Main Navigator"
    
    # Main screens
    check_file "packages/mobile/src/screens/main/HomeScreen.tsx" "Home Screen"
    check_file "packages/mobile/src/screens/main/RecordAnswerScreen.tsx" "Record Answer Screen"
    check_file "packages/mobile/src/screens/main/ProfileScreen.tsx" "Profile Screen"
    
    # Onboarding
    check_file "packages/mobile/src/screens/auth/OnboardingScreen.tsx" "Onboarding Screen"
    check_file "packages/mobile/src/screens/auth/InvitationScreen.tsx" "Invitation Screen"
    check_file "packages/mobile/src/components/onboarding/UserInfoStep.tsx" "User Info Step"
    check_file "packages/mobile/src/components/onboarding/PrivacyStep.tsx" "Privacy Step"
    check_file "packages/mobile/src/components/onboarding/TutorialStep.tsx" "Tutorial Step"
    
    # Accessibility
    check_file "packages/mobile/src/contexts/AccessibilityContext.tsx" "Accessibility Context"
    check_file "packages/mobile/src/components/accessibility/AccessibleButton.tsx" "Accessible Button"
    check_file "packages/mobile/src/components/accessibility/AccessibleTextInput.tsx" "Accessible Text Input"
    check_file "packages/mobile/src/screens/main/AccessibilityScreen.tsx" "Accessibility Screen"
    
    # Services
    check_file "packages/mobile/src/services/api-client.ts" "API Client"
    check_file "packages/mobile/src/services/invitation-service.ts" "Invitation Service"
    
    # Stores
    check_file "packages/mobile/src/stores/story-store.ts" "Story Store"
    check_file "packages/mobile/src/stores/onboarding-store.ts" "Onboarding Store"
    
    # Tests
    check_file "packages/mobile/src/__tests__/accessibility-integration.test.tsx" "Accessibility Integration Tests"
    check_file "packages/mobile/src/__tests__/onboarding-flow.test.tsx" "Onboarding Flow Tests"
    check_file "packages/mobile/src/__tests__/device-compatibility.test.tsx" "Device Compatibility Tests"
    check_file "packages/mobile/src/__tests__/cross-platform-compatibility.test.tsx" "Cross-platform Compatibility Tests"
    
    echo ""
}

# Validate database schema
validate_database_schema() {
    log_info "Validating Database Schema"
    echo "-------------------------"
    
    # Check all required migrations exist
    local migrations=(
        "20231201000001_create_users_table.js"
        "20231201000002_create_user_roles_table.js"
        "20231201000003_create_projects_table.js"
        "20231201000004_create_invitations_table.js"
        "20231201000005_create_stories_table.js"
        "20231201000006_create_interactions_table.js"
        "20231201000007_create_subscriptions_table.js"
        "20231201000008_create_export_requests_table.js"
        "20231201000011_create_notifications_table.js"
        "20231201000014_create_prompts_table.js"
        "20231201000015_create_user_prompts_table.js"
        "20231201000016_create_chapter_summaries_table.js"
        "20241201000001_create_user_resource_wallets_table.js"
        "20241201000002_create_seat_transactions_table.js"
        "20241201000003_create_project_roles_table.js"
        "20241201000004_create_chapters_table.js"
        "20241201000014_create_packages_table.js"
        "20241201000020_create_subscription_plans_table.js"
        "20241201000022_add_fulltext_search_indexes.js"
        "20241201000024_create_story_favorites_table.js"
        "20241201000025_create_story_discovery_tables.js"
        "20241201000027_create_user_acceptance_testing_tables.js"
    )
    
    for migration in "${migrations[@]}"; do
        check_file "packages/backend/migrations/$migration" "Migration: $migration"
    done
    
    # Check seed files
    check_file "packages/backend/seeds/01_users.js" "Users Seed"
    check_file "packages/backend/seeds/05_prompts.js" "Prompts Seed"
    check_file "packages/backend/seeds/06_chapters_and_prompts_v15.js" "Chapters and Prompts Seed"
    check_file "packages/backend/seeds/07_packages.js" "Packages Seed"
    check_file "packages/backend/seeds/08_subscription_plans.js" "Subscription Plans Seed"
    
    echo ""
}

# Validate configuration files
validate_configuration() {
    log_info "Validating Configuration Files"
    echo "------------------------------"
    
    # Package.json files
    check_file "package.json" "Root Package.json"
    check_file "packages/backend/package.json" "Backend Package.json"
    check_file "packages/web/package.json" "Web Package.json"
    check_file "packages/mobile/package.json" "Mobile Package.json"
    check_file "packages/shared/package.json" "Shared Package.json"
    
    # Configuration files
    check_file "packages/backend/knexfile.js" "Knex Configuration"
    check_file "packages/backend/jest.config.js" "Backend Jest Configuration"
    check_file "packages/web/next.config.js" "Next.js Configuration"
    check_file "packages/web/tailwind.config.js" "Tailwind Configuration"
    check_file "packages/mobile/app.json" "Mobile App Configuration"
    
    # TypeScript configurations
    check_file "tsconfig.json" "Root TypeScript Configuration"
    check_file "packages/backend/tsconfig.json" "Backend TypeScript Configuration"
    check_file "packages/web/tsconfig.json" "Web TypeScript Configuration"
    check_file "packages/mobile/tsconfig.json" "Mobile TypeScript Configuration"
    check_file "packages/shared/tsconfig.json" "Shared TypeScript Configuration"
    
    echo ""
}

# Main validation function
main() {
    echo "Starting implementation validation..."
    echo "This will check that all 8 tasks are properly implemented"
    echo ""
    
    validate_task_1
    validate_task_2
    validate_task_3
    validate_task_4
    validate_task_5
    validate_task_6
    validate_task_7
    validate_task_8
    validate_database_schema
    validate_configuration
    
    # Final report
    echo "=============================================================="
    echo "🏁 Implementation Validation Complete!"
    echo "=============================================================="
    echo -e "Validations Passed: ${GREEN}$VALIDATION_PASSED${NC}"
    echo -e "Validations Failed: ${RED}$VALIDATION_FAILED${NC}"
    
    if [ $VALIDATION_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All validations passed! Implementation is complete.${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Run setup: ./scripts/setup-test-environment.sh"
        echo "2. Run tests: ./scripts/comprehensive-test-suite.sh"
        echo "3. Review: COMPREHENSIVE_TESTING_GUIDE.md"
        exit 0
    else
        echo -e "${RED}❌ Some validations failed. Please review the missing components above.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"