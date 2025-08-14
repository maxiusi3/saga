# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Saga Family Biography Platform.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of multiple workflows that handle testing, building, and deployment of the application across different environments.

## Workflows

### 1. Main CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

This is the primary workflow that handles the complete CI/CD process for the backend and web applications.

#### Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

#### Jobs

##### Testing Jobs (Run in Parallel)
- **test-backend**: Tests the Node.js backend with PostgreSQL and Redis
- **test-web**: Tests the Next.js web frontend
- **test-mobile**: Tests the React Native mobile app
- **test-shared**: Tests the shared TypeScript package

##### Quality Assurance
- **test-e2e**: End-to-end tests using Playwright (runs after unit tests)
- **security-scan**: Security scanning with npm audit, Snyk, and CodeQL

##### Build and Deploy
- **build-and-push**: Builds and pushes Docker images to ECR (main branch only)
- **deploy-staging**: Deploys to staging environment (develop branch)
- **deploy-production**: Deploys to production environment (main branch)
- **rollback**: Manual rollback capability

### 2. Mobile App Deployment (`.github/workflows/mobile-deployment.yml`)

Handles the mobile application build and deployment process.

#### Features
- Expo/EAS build configuration
- App store submission automation
- Development, staging, and production builds
- Mobile E2E testing with Detox

### 3. Legacy CI (`.github/workflows/ci.yml`)

Deprecated workflow kept for backward compatibility.

## Environments

### Development
- **Trigger**: Feature branches and pull requests
- **Purpose**: Testing and validation
- **Database**: Ephemeral test databases
- **Deployment**: Not deployed, testing only

### Staging
- **Trigger**: Push to `develop` branch
- **Purpose**: Pre-production testing
- **Database**: Staging database with test data
- **URL**: `https://staging.saga.com`
- **Features**: 
  - Reduced infrastructure capacity
  - Internal testing builds for mobile
  - Automated smoke tests

### Production
- **Trigger**: Push to `main` branch
- **Purpose**: Live application
- **Database**: Production database with real data
- **URL**: `https://saga.com`
- **Features**:
  - Full infrastructure capacity
  - Database migrations
  - Blue-green deployment
  - App store submissions
  - Comprehensive monitoring

## Deployment Process

### Backend and Web Applications

1. **Code Quality Checks**
   - Linting with ESLint
   - Type checking with TypeScript
   - Unit tests with Jest
   - Integration tests

2. **Security Scanning**
   - npm audit for vulnerabilities
   - Snyk security analysis
   - CodeQL static analysis

3. **Build Process**
   - Docker image creation
   - Multi-stage builds for optimization
   - Image scanning and tagging

4. **Deployment**
   - Database migrations (production only)
   - ECS service updates
   - Health checks and validation
   - Rollback on failure

### Mobile Application

1. **Testing**
   - Unit tests with Jest
   - E2E tests with Detox (iOS simulator)

2. **Build Process**
   - EAS build for different environments
   - Platform-specific builds (iOS/Android)

3. **Distribution**
   - Internal distribution for staging
   - App store submission for production
   - Expo updates for OTA updates

## Scripts and Tools

### Database Management
- `scripts/migrate-database.sh`: Automated database migrations
- `scripts/rollback-deployment.sh`: Service rollback utility

### Deployment Tools
- `scripts/blue-green-deployment.sh`: Blue-green deployment strategy
- `scripts/build-and-deploy.sh`: Complete deployment automation

### Infrastructure
- `infrastructure/scripts/`: Infrastructure management scripts
- AWS CDK for infrastructure as code

## Configuration

### Required Secrets

#### AWS Configuration
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_ACCOUNT_ID`: AWS account ID
- `AWS_REGION`: AWS region (default: us-east-1)

#### Application Secrets
- `JWT_SECRET`: JWT signing secret
- `STRIPE_SECRET_KEY`: Stripe payment processing
- `OPENAI_API_KEY`: OpenAI API access
- `SENDGRID_API_KEY`: Email service
- `GOOGLE_CLOUD_SPEECH_KEY`: Speech-to-text service

#### Mobile App Secrets
- `EXPO_TOKEN`: Expo authentication token
- `EXPO_PROJECT_ID`: Expo project identifier
- `EXPO_APPLE_ID`: Apple Developer account
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
- `EXPO_ANDROID_SERVICE_ACCOUNT_KEY_PATH`: Google Play service account

#### Notification Secrets
- `SLACK_WEBHOOK_URL`: Slack notifications
- `SNYK_TOKEN`: Security scanning

### Environment Variables

#### Web Application
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket server URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe public key

#### Mobile Application
- `EXPO_PUBLIC_API_URL`: Backend API URL
- `EXPO_PUBLIC_ENVIRONMENT`: Environment identifier

## Monitoring and Alerts

### Health Checks
- API health endpoints (`/api/health`)
- Database connectivity tests
- Service stability verification

### Notifications
- Slack notifications for deployment status
- Email alerts for critical failures
- CloudWatch alarms integration

### Rollback Procedures
- Automatic rollback on health check failures
- Manual rollback capability
- Database backup before migrations

## Best Practices

### Code Quality
- All tests must pass before deployment
- Minimum 80% code coverage requirement
- Security scans must pass
- Type checking enforced

### Deployment Safety
- Database backups before migrations
- Blue-green deployment for zero downtime
- Comprehensive health checks
- Automatic rollback on failure

### Security
- Secrets stored in GitHub Secrets
- Container image scanning
- Dependency vulnerability scanning
- Regular security audits

## Troubleshooting

### Common Issues

#### Build Failures
1. Check test results and logs
2. Verify dependencies are up to date
3. Ensure environment variables are set
4. Check Docker build context

#### Deployment Failures
1. Verify AWS credentials and permissions
2. Check ECS service status
3. Review CloudWatch logs
4. Validate database connectivity

#### Mobile Build Issues
1. Check Expo configuration
2. Verify certificates and provisioning profiles
3. Review build logs in EAS
4. Test locally with Expo CLI

### Debugging Steps

1. **Check Workflow Logs**
   - Go to Actions tab in GitHub
   - Select the failed workflow
   - Review job logs for errors

2. **Verify Configuration**
   - Check secrets are properly set
   - Validate environment variables
   - Ensure AWS resources exist

3. **Test Locally**
   - Run tests locally
   - Build Docker images locally
   - Test deployment scripts

4. **Monitor Infrastructure**
   - Check AWS CloudWatch logs
   - Monitor ECS service health
   - Verify database connectivity

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate secrets quarterly
- Update base Docker images
- Monitor and optimize build times

### Scaling Considerations
- Increase ECS task capacity for high load
- Optimize Docker image sizes
- Consider parallel test execution
- Implement caching strategies

## Support

For CI/CD pipeline issues:
1. Check this documentation
2. Review workflow logs
3. Test locally when possible
4. Contact the development team

For infrastructure issues:
1. Check AWS CloudWatch
2. Review infrastructure scripts
3. Consult infrastructure documentation
4. Contact DevOps team