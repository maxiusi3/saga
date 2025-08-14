# Comprehensive Testing Guide - Saga Family Biography

This guide provides everything you need to thoroughly test all 8 completed tasks from the Saga Family Biography specification.

## 🎯 Overview

The following systems have been implemented and are ready for testing:

1. **Resource Wallet System** - Package/seat management and billing
2. **Authentication & User Management** - OAuth, JWT, user registration
3. **AI Prompt System** - Chapter-based prompts with TTS integration
4. **Recording & STT Pipeline** - Speech-to-text processing and file handling
5. **Story Management System** - CRUD operations, interactions, summaries
6. **Data Export System** - PDF/JSON export with archival functionality
7. **Web Dashboard** - React-based facilitator interface
8. **Mobile App Foundation** - React Native storyteller interface

## 🚀 Quick Start

### 1. Automated Testing (Recommended)

Run the comprehensive test suite that covers all systems:

```bash
# Make the script executable
chmod +x scripts/comprehensive-test-suite.sh

# Run all tests
./scripts/comprehensive-test-suite.sh
```

This will:
- Set up the test environment
- Run unit tests for all 8 tasks
- Execute integration tests
- Perform cross-platform validation
- Generate a comprehensive report

### 2. Manual Testing Setup

If you prefer manual testing or need to debug specific issues:

```bash
# 1. Install dependencies
npm install
cd packages/backend && npm install
cd ../web && npm install
cd ../mobile && npm install
cd ../shared && npm install

# 2. Setup test database
cd packages/backend
npm run migrate:test
npm run seed:test

# 3. Start development servers
npm run dev:backend    # Terminal 1
npm run dev:web        # Terminal 2
npm run dev:mobile     # Terminal 3 (optional)
```

## 📋 Pre-Testing Checklist

### Environment Variables

Ensure these environment variables are set in `packages/backend/.env`:

```bash
# Database
DATABASE_URL=sqlite:./test.db
NODE_ENV=test

# Authentication
JWT_SECRET=your-jwt-secret-key
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# OpenAI (for AI Prompt System)
OPENAI_API_KEY=your-openai-api-key

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket

# Stripe (for payments)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# SendGrid (for emails)
SENDGRID_API_KEY=your-sendgrid-api-key

# Speech-to-Text
SPEECH_TO_TEXT_API_KEY=your-stt-api-key
```

### Dependencies

- Node.js 18+
- npm 8+
- SQLite (for test database)
- React Native CLI (for mobile testing)

## 🧪 Detailed Testing Scenarios

### Task 1: Resource Wallet System

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=resource-wallet
```

**Manual Testing:**
1. **User Registration with Initial Wallet**
   - Register a new user
   - Verify they receive initial package (1 project voucher, 2 facilitator seats, 2 storyteller seats)
   - Check wallet balance in database

2. **Project Creation (Consumes Project Voucher)**
   - Create a new project
   - Verify project voucher is decremented
   - Check transaction log

3. **Invitation System (Consumes Seats)**
   - Invite a facilitator (should consume facilitator seat)
   - Invite a storyteller (should consume storyteller seat)
   - Verify seats are only consumed when invitation is accepted

4. **Insufficient Resources Handling**
   - Try to create project with 0 project vouchers
   - Verify proper error message and purchase prompt

**API Endpoints to Test:**
- `GET /api/wallets/:userId` - Get wallet balance
- `POST /api/wallets/:userId/consume` - Consume resources
- `GET /api/wallets/:userId/transactions` - Get transaction history

### Task 2: Authentication & User Management

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=auth
cd ../web
npm test -- --testPathPattern=auth-store
```

**Manual Testing:**
1. **OAuth Registration**
   - Test Google OAuth flow
   - Test Apple OAuth flow
   - Verify user creation in database

2. **JWT Token Management**
   - Login and verify JWT token generation
   - Test token refresh
   - Test token expiration handling

3. **Protected Routes**
   - Access protected API endpoints without token (should fail)
   - Access with valid token (should succeed)
   - Access with expired token (should redirect to login)

4. **Cross-Platform Session Management**
   - Login on web, verify session persists
   - Test mobile app authentication

**API Endpoints to Test:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/profile` - Get user profile

### Task 3: AI Prompt System

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=ai-prompt-service
npm test -- --testPathPattern=prompt-management
```

**Manual Testing:**
1. **Chapter-Based Progression**
   - Create a new project
   - Verify first prompt is from Chapter 1
   - Record a story response
   - Verify next prompt continues in sequence

2. **User Follow-up Priority**
   - Add a user-generated follow-up question
   - Verify it takes priority over AI prompts
   - Complete follow-up, verify return to AI sequence

3. **Text-to-Speech Integration**
   - Request a prompt with audio
   - Verify TTS audio is generated and cached
   - Test audio playback in mobile app

4. **Chapter Completion & Summaries**
   - Complete all prompts in a chapter
   - Verify chapter summary is generated
   - Check summary quality and accuracy

**API Endpoints to Test:**
- `GET /api/prompts/next/:projectId` - Get next prompt
- `POST /api/prompts/user` - Create user prompt
- `GET /api/chapters/:chapterId/summary` - Get chapter summary
- `GET /api/prompts/:promptId/audio` - Get TTS audio

### Task 4: Recording & STT Pipeline

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=stt
npm test -- --testPathPattern=media-processing
cd ../mobile
npm test -- --testPathPattern=recording-service
```

**Manual Testing:**
1. **Audio Recording (Mobile)**
   - Test press-and-hold recording
   - Verify 10-minute limit enforcement
   - Test recording quality indicators
   - Test waveform visualization

2. **Review & Send Workflow**
   - Record audio, enter review screen
   - Test playback functionality
   - Test re-record option
   - Test send to family

3. **Speech-to-Text Processing**
   - Upload audio file
   - Verify STT processing starts
   - Check transcript accuracy
   - Test transcript editing

4. **File Processing Pipeline**
   - Test various audio formats
   - Verify file size limits (50MB)
   - Test compression and optimization
   - Check metadata extraction

**API Endpoints to Test:**
- `POST /api/uploads/audio` - Upload audio file
- `POST /api/stt/process` - Process speech-to-text
- `GET /api/stt/status/:jobId` - Check processing status
- `PUT /api/stories/:id/transcript` - Update transcript

### Task 5: Story Management System

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=stories
npm test -- --testPathPattern=story-workflow-integration
npm test -- --testPathPattern=chapter-summary-service
```

**Manual Testing:**
1. **Story CRUD Operations**
   - Create new story with audio and transcript
   - Read story details
   - Update story metadata
   - Delete story (soft delete)

2. **Story Interactions**
   - Add facilitator comment to story
   - Add follow-up question
   - Test real-time updates via WebSocket

3. **Chapter Organization**
   - Verify stories are organized by chapters
   - Test chapter progression logic
   - Validate chapter summary generation

4. **Story Discovery & Search**
   - Search stories by keyword
   - Filter by date range
   - Test full-text search functionality
   - Verify search analytics tracking

**API Endpoints to Test:**
- `POST /api/stories` - Create story
- `GET /api/stories/:id` - Get story details
- `PUT /api/stories/:id` - Update story
- `DELETE /api/stories/:id` - Delete story
- `GET /api/stories/search` - Search stories
- `POST /api/stories/:id/interactions` - Add interaction

### Task 6: Data Export System

**Automated Tests:**
```bash
cd packages/backend
npm test -- --testPathPattern=enhanced-export-service
npm test -- --testPathPattern=archival-service
cd ../web
npm test -- --testPathPattern=export-store
```

**Manual Testing:**
1. **PDF Export**
   - Request PDF export of project
   - Verify export includes all stories and metadata
   - Check PDF formatting and quality
   - Test download functionality

2. **JSON Export**
   - Request JSON export
   - Verify data completeness
   - Check JSON structure and validation
   - Test import capability

3. **Archival Mode**
   - Test subscription expiration
   - Verify project enters archival mode
   - Confirm read-only access
   - Test export availability in archival mode

4. **Export Analytics**
   - Track export requests
   - Monitor export success rates
   - Verify export notifications

**API Endpoints to Test:**
- `POST /api/exports/request` - Request export
- `GET /api/exports/:id/status` - Check export status
- `GET /api/exports/:id/download` - Download export
- `GET /api/projects/:id/archival-status` - Check archival status

### Task 7: Web Dashboard

**Automated Tests:**
```bash
cd packages/web
npm test -- --testPathPattern=projects
npm test -- --testPathPattern=stories
npm test -- --testPathPattern=exports
```

**Manual Testing:**
1. **Project Management**
   - Create new project
   - Edit project details
   - Invite facilitators and storytellers
   - Manage project settings

2. **Story Feed Interface**
   - View story timeline
   - Play audio stories
   - Add interactions and comments
   - Filter and search stories

3. **Dashboard Navigation**
   - Test sidebar navigation
   - Verify protected routes
   - Check responsive design
   - Test accessibility features

4. **Subscription Management**
   - View subscription status
   - Manage payment methods
   - Handle subscription renewal
   - Test archival mode UI

**Pages to Test:**
- `/dashboard` - Main dashboard
- `/dashboard/projects` - Project list
- `/dashboard/projects/new` - Create project
- `/dashboard/projects/[id]` - Project details
- `/dashboard/stories` - Story feed
- `/dashboard/exports` - Export management

### Task 8: Mobile App Foundation

**Automated Tests:**
```bash
cd packages/mobile
npm test -- --testPathPattern=recording
npm test -- --testPathPattern=accessibility
npm test -- --testPathPattern=onboarding
```

**Manual Testing:**
1. **Onboarding Flow**
   - Test welcome screen
   - Complete user information
   - Accept privacy terms
   - Complete tutorial

2. **Recording Interface**
   - Test prompt display with TTS
   - Record audio response
   - Use review and send workflow
   - Test accessibility features

3. **Story Viewing**
   - View received stories
   - Play audio with transcript
   - Navigate story timeline
   - Test offline capabilities

4. **Accessibility Compliance**
   - Test with screen reader
   - Verify WCAG 2.1 AA compliance
   - Test high contrast mode
   - Validate touch target sizes (44x44dp)

**Screens to Test:**
- Welcome/Onboarding screens
- Home screen with prompts
- Recording screen
- Review and send screen
- Story detail screens
- Profile and settings

## 🔄 Integration Testing Scenarios

### Cross-Platform Data Synchronization
1. Create project on web dashboard
2. Verify project appears in mobile app
3. Record story on mobile
4. Verify story appears on web dashboard
5. Add interaction on web
6. Verify notification on mobile

### End-to-End User Journey
1. **Facilitator Journey (Web)**
   - Register and create project
   - Invite storyteller
   - Monitor story submissions
   - Add follow-up questions
   - Export project data

2. **Storyteller Journey (Mobile)**
   - Accept invitation
   - Complete onboarding
   - Record first story
   - Respond to follow-ups
   - View family interactions

### Payment and Subscription Flow
1. Create project (consumes voucher)
2. Invite multiple users (consumes seats)
3. Run out of resources
4. Purchase additional package
5. Verify resource replenishment
6. Test subscription renewal

## 📊 Performance Testing

### Load Testing
```bash
cd packages/backend
npm test -- --testPathPattern=load-testing
```

**Manual Load Testing:**
- Simulate 100 concurrent users
- Test API response times under load
- Monitor database performance
- Check memory usage and leaks

### Mobile Performance
- Test app cold start time (< 3 seconds)
- Verify story feed load time (< 2 seconds)
- Test audio recording performance
- Monitor battery usage during recording

## 🔒 Security Testing

```bash
cd packages/backend
npm test -- --testPathPattern=security
```

**Manual Security Testing:**
- Test SQL injection protection
- Verify XSS prevention
- Check CSRF protection
- Test rate limiting
- Validate file upload security
- Test authentication bypass attempts

## 📱 Cross-Platform Testing

```bash
./scripts/run-cross-platform-tests.sh
```

**Device Testing Matrix:**
- iOS (iPhone 12+, iPad)
- Android (Pixel, Samsung Galaxy)
- Web browsers (Chrome, Safari, Firefox)
- Different screen sizes and orientations

## 🐛 Debugging and Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   cd packages/backend
   npm run migrate:test
   npm run seed:test
   ```

2. **Missing Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in required API keys

3. **Port Conflicts**
   - Backend: http://localhost:3001
   - Web: http://localhost:3000
   - Mobile: Metro bundler on 8081

4. **Test Failures**
   - Check test database is properly seeded
   - Verify all services are running
   - Check network connectivity for external APIs

### Logs and Monitoring

- Backend logs: `packages/backend/logs/`
- Test results: `packages/*/coverage/`
- Performance metrics: Available in test output

## 📈 Success Criteria

### Functional Requirements
- ✅ All 8 tasks pass automated tests
- ✅ Manual testing scenarios complete successfully
- ✅ Cross-platform synchronization works
- ✅ Performance meets requirements
- ✅ Security tests pass

### Performance Benchmarks
- App cold start: < 3 seconds
- Story feed load: < 2 seconds
- End-to-end latency: < 30 seconds
- API response time: < 500ms (95th percentile)

### Quality Metrics
- Test coverage: > 80%
- Accessibility: WCAG 2.1 AA compliant
- Security: No critical vulnerabilities
- Cross-platform: Works on all target devices

## 🎉 Next Steps

Once all tests pass:

1. **Production Deployment**
   - Use infrastructure scripts in `/infrastructure`
   - Deploy to staging environment first
   - Run production smoke tests

2. **User Acceptance Testing**
   - Recruit beta testers
   - Gather feedback on user experience
   - Iterate based on real user data

3. **Monitoring Setup**
   - Configure error tracking (Sentry)
   - Set up performance monitoring
   - Implement business metrics tracking

## 📞 Support

If you encounter issues during testing:

1. Check the troubleshooting section above
2. Review test logs for specific error messages
3. Verify all environment variables are set correctly
4. Ensure all dependencies are installed

The comprehensive test suite should give you confidence that all 8 tasks are working correctly and the system is ready for production deployment.