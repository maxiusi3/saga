# Project Creation System Documentation

## Overview

The Saga Family Biography project creation system implements a resource-based model where users consume project vouchers to create new storytelling projects. Each project creation automatically initializes a 1-year subscription and establishes the creator as a facilitator.

## Architecture

### Core Components

1. **Resource Wallet System**: Manages project vouchers, facilitator seats, and storyteller seats
2. **Project Creation Service**: Handles atomic project creation with resource consumption
3. **Subscription Management**: Automatically initializes 1-year project subscriptions
4. **Role Management**: Assigns creator as facilitator with appropriate permissions
5. **Analytics Tracking**: Monitors project creation metrics and user behavior

### Database Schema

```sql
-- Projects table (updated for v1.5)
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Project roles (many-to-many relationship)
CREATE TABLE project_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    role VARCHAR(50) NOT NULL, -- 'facilitator' or 'storyteller'
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions (single source of truth for expiry)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    facilitator_id UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    plan_id VARCHAR(100),
    metadata JSON,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Project Creation Flow

### 1. Pre-Creation Validation

```typescript
// Check resource availability
const canCreate = await ResourceWalletService.canConsumeProjectVoucher(userId)
if (!canCreate.success) {
    throw new Error(canCreate.error)
}
```

**Validation Steps:**
- Verify user authentication
- Check project voucher availability (minimum 1 required)
- Validate project name (1-255 characters)
- Validate description (optional, max 500 characters)

### 2. Atomic Project Creation

The project creation process uses database transactions to ensure atomicity:

```typescript
const trx = await ProjectModel.db.transaction()

try {
    // 1. Create project
    const project = await ProjectModel.createProject(projectData, trx)
    
    // 2. Create facilitator role
    await trx('project_roles').insert({
        user_id: userId,
        project_id: project.id,
        role: 'facilitator',
        status: 'active'
    })
    
    // 3. Consume project voucher
    await ResourceWalletService.consumeProjectVoucher(userId, project.id, trx)
    
    // 4. Initialize subscription
    await SubscriptionModel.createProjectSubscription({
        projectId: project.id,
        facilitatorId: userId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        planId: 'saga-project-subscription'
    }, trx)
    
    await trx.commit()
} catch (error) {
    await trx.rollback()
    throw error
}
```

### 3. Post-Creation Analytics

```typescript
await ProjectAnalyticsService.trackProjectCreation({
    userId,
    projectId: project.id,
    projectName: name,
    hasDescription: !!description,
    creationSource: 'web' | 'mobile',
    walletBalanceBefore: previousBalance,
    walletBalanceAfter: currentBalance
})
```

## API Endpoints

### Create Project

**POST** `/api/projects`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
    "name": "Family Stories Project",
    "description": "Collecting stories from grandparents" // optional
}
```

**Success Response (201):**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "Family Stories Project",
        "description": "Collecting stories from grandparents",
        "status": "active",
        "userRole": "facilitator",
        "subscription": {
            "isActive": true,
            "endDate": "2025-12-01T00:00:00Z",
            "daysRemaining": 365
        },
        "createdAt": "2024-12-01T00:00:00Z",
        "updatedAt": "2024-12-01T00:00:00Z"
    },
    "message": "Project created successfully with 1-year subscription",
    "timestamp": "2024-12-01T00:00:00Z"
}
```

**Error Responses:**

**400 - Insufficient Resources:**
```json
{
    "success": false,
    "error": "You need at least 1 Project Voucher to create a project. Purchase a package to get more vouchers.",
    "code": "INSUFFICIENT_RESOURCES",
    "timestamp": "2024-12-01T00:00:00Z"
}
```

**400 - Validation Error:**
```json
{
    "success": false,
    "error": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
        {
            "field": "name",
            "message": "Project name must be between 1 and 255 characters"
        }
    ],
    "timestamp": "2024-12-01T00:00:00Z"
}
```

## Resource Management

### Project Voucher Consumption

Each project creation consumes exactly 1 project voucher from the user's resource wallet:

```typescript
// Before creation
const wallet = await ResourceWalletService.getWallet(userId)
console.log(wallet.projectVouchers) // e.g., 3

// After creation
const updatedWallet = await ResourceWalletService.getWallet(userId)
console.log(updatedWallet.projectVouchers) // e.g., 2
```

### Transaction Logging

All resource consumption is logged for audit purposes:

```sql
INSERT INTO seat_transactions (
    user_id,
    transaction_type,
    resource_type,
    amount,
    project_id,
    description,
    created_at
) VALUES (
    'user-uuid',
    'consume',
    'project_voucher',
    1,
    'project-uuid',
    'Project creation',
    NOW()
);
```

## Subscription Management

### Automatic Subscription Initialization

Every project automatically receives a 1-year subscription:

- **Duration**: 365 days from creation
- **Status**: Active
- **Plan**: `saga-project-subscription`
- **Features**: Full interactive service

### Subscription Lifecycle

1. **Active Phase (Year 1)**: Full functionality
   - Story recording and transcription
   - AI-powered prompts
   - Member invitations
   - Real-time collaboration

2. **Archival Phase (After Year 1)**: Read-only access
   - View existing stories
   - Export data
   - No new story creation
   - No new member invitations

### Subscription Status Checking

```typescript
const status = await SubscriptionModel.getProjectSubscriptionStatus(projectId)
console.log({
    isActive: status.isActive,
    daysRemaining: status.daysRemaining,
    isExpired: status.isExpired
})
```

## Role Management

### Facilitator Role Assignment

Project creators automatically receive the facilitator role:

```typescript
await trx('project_roles').insert({
    user_id: creatorId,
    project_id: projectId,
    role: 'facilitator',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date()
})
```

### Facilitator Permissions

Facilitators can:
- View and manage project settings
- Invite other facilitators (consumes facilitator seats)
- Invite storytellers (consumes storyteller seats)
- Edit story transcripts
- Export project data
- Delete the project

## Analytics and Tracking

### Project Creation Metrics

The system tracks comprehensive metrics for project creation:

```typescript
interface ProjectCreationMetrics {
    totalProjects: number
    projectsBySource: Array<{ source: string; count: number }>
    projectsWithDescription: number
    averageVouchersConsumed: number
    totalVouchersConsumed: number
    dailyTrend: Array<{ date: string; count: number }>
}
```

### Analytics Events

**Project Created Event:**
```json
{
    "eventType": "project_created",
    "userId": "user-uuid",
    "projectId": "project-uuid",
    "eventData": {
        "projectName": "Family Stories",
        "hasDescription": true,
        "creationSource": "web",
        "userAgent": "Mozilla/5.0...",
        "walletBalanceBefore": {
            "projectVouchers": 3,
            "facilitatorSeats": 5,
            "storytellerSeats": 5
        },
        "walletBalanceAfter": {
            "projectVouchers": 2,
            "facilitatorSeats": 5,
            "storytellerSeats": 5
        },
        "vouchersConsumed": 1
    },
    "createdAt": "2024-12-01T00:00:00Z"
}
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Project Vouchers**
   - **Cause**: User has 0 project vouchers
   - **Response**: 400 with clear error message
   - **Resolution**: Direct user to purchase package

2. **Invalid Project Data**
   - **Cause**: Missing/invalid name or description
   - **Response**: 400 with validation details
   - **Resolution**: Fix validation errors

3. **Database Transaction Failure**
   - **Cause**: Database connectivity or constraint issues
   - **Response**: 500 with generic error
   - **Resolution**: Automatic rollback, retry mechanism

4. **Concurrent Resource Consumption**
   - **Cause**: Multiple simultaneous project creations
   - **Response**: 400 for insufficient resources
   - **Resolution**: Database-level locking prevents overselling

### Error Recovery

The system implements comprehensive error recovery:

```typescript
try {
    // Project creation logic
} catch (error) {
    // Automatic rollback via transaction
    await trx.rollback()
    
    // Log error for monitoring
    console.error('Project creation failed:', error)
    
    // Return user-friendly error
    throw createError('Failed to create project', 500, 'PROJECT_CREATION_FAILED')
}
```

## Performance Considerations

### Database Optimization

- **Indexes**: Optimized queries on user_id, project_id, and created_at
- **Transactions**: Minimal transaction scope for atomicity
- **Connection Pooling**: Efficient database connection management

### Caching Strategy

- **Resource Wallets**: Cached for frequent access
- **Subscription Status**: Cached with TTL for performance
- **Analytics Data**: Aggregated and cached for dashboard display

### Rate Limiting

Project creation is rate-limited to prevent abuse:

```typescript
// Rate limit: 5 projects per hour per user
const rateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: (req) => req.user.id
})
```

## Testing Strategy

### Unit Tests

- Resource wallet operations
- Project model CRUD operations
- Subscription initialization
- Analytics event tracking

### Integration Tests

- End-to-end project creation flow
- Resource consumption atomicity
- Error handling and rollback
- Concurrent creation scenarios

### Performance Tests

- Creation time under load
- Database transaction performance
- Memory usage during bulk operations

## Monitoring and Alerting

### Key Metrics

- **Project Creation Rate**: Projects created per hour/day
- **Success Rate**: Percentage of successful creations
- **Error Rate**: Failed creation attempts
- **Resource Utilization**: Voucher consumption patterns

### Alerts

- **High Error Rate**: > 5% creation failures
- **Resource Depletion**: Users with 0 vouchers
- **Performance Degradation**: Creation time > 5 seconds
- **Database Issues**: Transaction rollback rate > 1%

## Security Considerations

### Authentication

- JWT token validation required
- User context attached to all operations
- Session management for security

### Authorization

- Users can only create projects for themselves
- Resource consumption tied to authenticated user
- Role-based access control for project management

### Data Validation

- Input sanitization for XSS prevention
- SQL injection protection via parameterized queries
- Rate limiting to prevent abuse

## Future Enhancements

### Planned Features

1. **Project Templates**: Pre-configured project types
2. **Bulk Creation**: Create multiple projects at once
3. **Project Sharing**: Share projects between users
4. **Advanced Analytics**: ML-powered insights
5. **Custom Subscription Plans**: Flexible subscription options

### Scalability Improvements

1. **Microservices**: Split into dedicated services
2. **Event Sourcing**: Audit trail and replay capabilities
3. **Horizontal Scaling**: Multi-instance deployment
4. **Caching Layer**: Redis for improved performance

## Troubleshooting Guide

### Common Issues

**Issue**: "Insufficient project vouchers" error
**Solution**: 
1. Check user's resource wallet balance
2. Verify recent transactions
3. Guide user to purchase package

**Issue**: Project creation hangs
**Solution**:
1. Check database connection
2. Monitor transaction locks
3. Review server logs for errors

**Issue**: Analytics not tracking
**Solution**:
1. Verify analytics service is running
2. Check database permissions
3. Review event data format

### Debug Commands

```bash
# Check user's resource wallet
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/wallets/me

# View recent transactions
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/wallets/transactions

# Check project creation metrics
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/analytics/projects/creation-metrics
```

## Conclusion

The Saga project creation system provides a robust, scalable foundation for family storytelling projects. By combining resource management, automatic subscription initialization, and comprehensive analytics, it ensures a smooth user experience while maintaining business model integrity.

The system's atomic transaction approach guarantees data consistency, while the analytics framework provides valuable insights for product improvement and user engagement optimization.