# Integration Testing Guide

This document provides comprehensive guidance on running and maintaining integration tests for the Saga backend API.

## Overview

Integration tests verify that different components of the system work together correctly. Our integration test suite covers:

- **API Integration**: End-to-end API endpoint testing
- **Database Integration**: Database operations and transactions
- **Third-Party Services**: External service integrations (OpenAI, AWS, Stripe, etc.)
- **WebSocket Integration**: Real-time communication testing
- **File Processing**: Audio upload and processing workflows
- **Payment Integration**: Subscription and billing workflows

## Test Structure

```
packages/backend/src/tests/integration/
├── index.test.ts                    # Main test suite runner
├── api-integration.test.ts          # API endpoint integration tests
├── database-integration.test.ts     # Database operation tests
├── third-party-integration.test.ts  # External service tests
├── websocket-integration.test.ts    # WebSocket communication tests
├── file-processing-integration.test.ts # File upload/processing tests
└── payment-integration.test.ts      # Payment and billing tests
```

## Running Integration Tests

### Prerequisites

1. **Test Database**: Ensure PostgreSQL is running with a test database
2. **Environment Variables**: Set up test environment variables
3. **External Services**: Configure test credentials for external services

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run integration tests with coverage
npm run test:integration:coverage

# Run specific integration test file
npm run test:integration -- --testPathPattern=api-integration

# Run integration tests in watch mode
npm run test:integration -- --watch

# Run both unit and integration tests
npm run test:all
```

### Environment Setup

Create a `.env.test` file in the backend directory:

```env
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/saga_test
JWT_SECRET=test-jwt-secret-key-for-integration-tests

# External Service Test Credentials
OPENAI_API_KEY=your-test-openai-key
AWS_ACCESS_KEY_ID=your-test-aws-key
AWS_SECRET_ACCESS_KEY=your-test-aws-secret
AWS_S3_BUCKET=your-test-s3-bucket
SENDGRID_API_KEY=your-test-sendgrid-key
STRIPE_SECRET_KEY=sk_test_your-test-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-test-webhook-secret
FIREBASE_PROJECT_ID=your-test-firebase-project

# Test-specific configurations
LOG_LEVEL=error
DISABLE_RATE_LIMITING=true
SKIP_EMAIL_VERIFICATION=true
MAX_FILE_SIZE=10MB
MAX_AUDIO_DURATION=300
```

## Test Categories

### 1. API Integration Tests

Tests complete API workflows including authentication, CRUD operations, and error handling.

**Coverage:**
- Authentication flow (signup, signin, OAuth)
- Project management lifecycle
- Story management and interactions
- Chapter summary generation
- Export functionality
- Notification system
- Subscription management
- Error handling and validation
- Rate limiting
- Permission checks

**Key Features:**
- Real HTTP requests using supertest
- Database state verification
- Authentication token management
- Multi-user scenarios
- Error condition testing

### 2. Database Integration Tests

Tests database operations, relationships, and data integrity.

**Coverage:**
- CRUD operations for all models
- Complex queries and relationships
- Transaction handling
- Database constraints and validation
- Performance under load
- Index effectiveness
- Data integrity checks
- Cascading deletes

**Key Features:**
- Direct database operations
- Transaction testing
- Performance benchmarks
- Constraint validation
- Large dataset handling

### 3. Third-Party Service Integration Tests

Tests integration with external services using mocked responses.

**Coverage:**
- OpenAI API integration
- Speech-to-Text services
- AWS S3 storage operations
- Email notifications (SendGrid)
- Push notifications (Firebase)
- Payment processing (Stripe)
- Service health checks
- Fallback mechanisms
- Rate limiting and quotas

**Key Features:**
- Service mocking for consistent testing
- Error scenario simulation
- Fallback mechanism testing
- Configuration validation
- Connection health checks

### 4. WebSocket Integration Tests

Tests real-time communication features.

**Coverage:**
- Connection and authentication
- Room management
- Real-time story updates
- Typing indicators
- User presence tracking
- Audio processing updates
- Error handling
- Performance under load

**Key Features:**
- Multiple client simulation
- Real-time event testing
- Connection resilience
- Performance benchmarks
- Memory usage monitoring

### 5. File Processing Integration Tests

Tests audio file upload and processing workflows.

**Coverage:**
- File upload validation
- Multiple audio format support
- Background processing jobs
- Progress tracking
- Error handling and retries
- Concurrent upload handling
- File cleanup
- Storage integration

**Key Features:**
- Real file upload simulation
- Background job testing
- Progress tracking verification
- Concurrent operation testing
- Cleanup verification

### 6. Payment Integration Tests

Tests subscription and billing workflows.

**Coverage:**
- Subscription creation and management
- Payment method handling
- Webhook processing
- Billing and invoicing
- Error handling (declined cards, etc.)
- Subscription analytics

**Key Features:**
- Stripe API mocking
- Webhook event simulation
- Payment error scenarios
- Billing cycle testing
- Security validation

## Test Data Management

### Database Setup

Integration tests use a separate test database that is:
- Created fresh for each test run
- Isolated from development/production data
- Automatically cleaned up after tests

### Test Data Creation

Use the provided helper functions for consistent test data:

```typescript
import { createTestUser, createTestProject, createTestStory } from '../setup';

// Create test user
const user = await createTestUser({
  email: 'test@example.com',
  name: 'Test User',
  password: 'TestPassword123!'
});

// Create test project
const project = await createTestProject({
  title: 'Test Project',
  facilitatorId: user.id
});
```

### Data Cleanup

Tests automatically clean up data between runs using:
- Database transaction rollbacks
- Explicit cleanup in `afterEach` hooks
- Global teardown procedures

## Performance Considerations

### Test Execution Time

Integration tests are designed to complete within reasonable timeframes:
- Individual tests: < 10 seconds
- Full integration suite: < 5 minutes
- Database operations: < 2 seconds
- API operations: < 5 seconds

### Resource Management

- Tests run serially to avoid conflicts
- Database connections are properly closed
- Temporary files are cleaned up
- Memory usage is monitored

### Optimization Tips

1. **Use transactions** for database tests when possible
2. **Mock external services** to avoid network delays
3. **Reuse test data** within test suites
4. **Clean up resources** in teardown hooks
5. **Use appropriate timeouts** for different test types

## Debugging Integration Tests

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is running
   - Check DATABASE_URL environment variable
   - Verify database permissions

2. **External Service Failures**
   - Check API credentials in .env.test
   - Verify service mocking is working
   - Review network connectivity

3. **Test Timeouts**
   - Increase timeout for slow operations
   - Check for hanging connections
   - Review async operation handling

4. **Port Conflicts**
   - Ensure test ports are available
   - Use dynamic port allocation
   - Check for running development servers

### Debugging Commands

```bash
# Run tests with verbose output
npm run test:integration -- --verbose

# Run specific test with debugging
npm run test:integration -- --testNamePattern="should create subscription"

# Run tests with coverage and open handles detection
npm run test:integration -- --coverage --detectOpenHandles

# Run tests with custom timeout
npm run test:integration -- --testTimeout=120000
```

### Logging

Integration tests use reduced logging by default. To enable detailed logging:

```bash
LOG_LEVEL=debug npm run test:integration
```

## Continuous Integration

### CI Configuration

Integration tests are configured to run in CI environments with:
- Separate test database setup
- Environment variable management
- Service dependency handling
- Parallel execution where safe

### Test Reports

CI generates:
- Test coverage reports
- Performance benchmarks
- Test result summaries
- Error logs and stack traces

## Best Practices

### Writing Integration Tests

1. **Test Real Scenarios**: Focus on actual user workflows
2. **Use Realistic Data**: Create data that mirrors production
3. **Test Error Conditions**: Include failure scenarios
4. **Verify Side Effects**: Check database state, notifications, etc.
5. **Keep Tests Independent**: Each test should be able to run in isolation

### Maintenance

1. **Regular Updates**: Keep tests updated with API changes
2. **Performance Monitoring**: Track test execution times
3. **Coverage Analysis**: Maintain high integration test coverage
4. **Documentation**: Update this guide with new test patterns

### Security

1. **Use Test Credentials**: Never use production credentials
2. **Isolate Test Data**: Ensure test data doesn't leak
3. **Validate Permissions**: Test authorization thoroughly
4. **Secure Test Environment**: Protect test infrastructure

## Troubleshooting

### Common Solutions

| Issue | Solution |
|-------|----------|
| Database connection timeout | Check PostgreSQL service and connection string |
| External service errors | Verify API keys and service mocking |
| WebSocket connection failures | Check port availability and CORS settings |
| File upload failures | Verify temp directory permissions |
| Memory leaks in tests | Check for unclosed connections and resources |

### Getting Help

1. Check test logs for specific error messages
2. Review this documentation for common issues
3. Examine similar working tests for patterns
4. Use debugging tools and verbose output
5. Consult team members for complex integration issues

## Future Enhancements

Planned improvements to the integration test suite:

1. **Visual Testing**: Screenshot comparison for UI components
2. **Load Testing**: Performance testing under high load
3. **Cross-Platform Testing**: Testing across different environments
4. **Automated Test Generation**: AI-powered test case generation
5. **Real-Time Monitoring**: Live test result dashboards