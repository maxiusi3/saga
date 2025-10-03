# Backend Development Plan for Modern UI Pages

## Overview
This document outlines the backend development needed to support the 6 modernized UI pages that have been implemented.

## Current Status
✅ **Completed Pages (Frontend Only)**:
1. Dashboard (`/dashboard`) - Modern resource management UI
2. Settings (`/dashboard/settings`) - Modern settings interface  
3. Project Management (`/dashboard/projects/[id]/settings`) - Modern project management
4. Purchase Page - Modern pricing interface
5. Stories List - Modern story browsing
6. Story Detail - Modern story viewing

❌ **Missing Backend Support**:
- Real data integration for all pages
- API endpoints for new features
- Database schema updates

## Phase 1: Core API Endpoints (Week 1-2)

### 1.1 Dashboard APIs
**Endpoints Needed:**
```typescript
GET /api/dashboard/overview
- User resource wallet status
- Project statistics
- Recent activity summary

GET /api/dashboard/projects
- User's owned projects
- Projects user participates in
- Project member counts and roles

GET /api/dashboard/quick-actions
- Role-based available actions
- Pending tasks/notifications
```

**Database Changes:**
```sql
-- Resource wallet tracking
CREATE TABLE user_resource_wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    project_vouchers INTEGER DEFAULT 0,
    facilitator_seats INTEGER DEFAULT 0,
    storyteller_seats INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage history tracking
CREATE TABLE resource_usage_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    resource_type VARCHAR(50),
    amount INTEGER,
    action VARCHAR(20), -- 'consume', 'purchase', 'refund'
    project_id UUID REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Settings APIs
**Endpoints Needed:**
```typescript
GET /api/settings/profile
- User profile information
- Avatar, bio, contact details

PUT /api/settings/profile
- Update user profile

GET /api/settings/notifications
- Notification preferences
- Email/push settings

PUT /api/settings/notifications
- Update notification settings

GET /api/settings/accessibility
- Accessibility preferences
- Font size, contrast, motion settings

PUT /api/settings/accessibility
- Update accessibility settings
```

**Database Changes:**
```sql
-- User settings
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    notification_weekly_digest BOOLEAN DEFAULT true,
    accessibility_font_size VARCHAR(20) DEFAULT 'standard',
    accessibility_high_contrast BOOLEAN DEFAULT false,
    accessibility_reduced_motion BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 1.3 Project Management APIs
**Endpoints Needed:**
```typescript
GET /api/projects/:id/management
- Project details and statistics
- Member list with roles and status
- Project settings

PUT /api/projects/:id/details
- Update project name/description

POST /api/projects/:id/members/invite
- Invite new members
- Consume appropriate seats

PUT /api/projects/:id/members/:memberId/role
- Update member role

DELETE /api/projects/:id/members/:memberId
- Remove member from project

GET /api/projects/:id/settings
- Project-specific settings

PUT /api/projects/:id/settings
- Update project settings

POST /api/projects/:id/export
- Generate and download project archive
```

**Database Changes:**
```sql
-- Project settings
CREATE TABLE project_settings (
    project_id UUID PRIMARY KEY REFERENCES projects(id),
    visibility_public BOOLEAN DEFAULT false,
    allow_comments BOOLEAN DEFAULT true,
    auto_transcription BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced project member tracking
ALTER TABLE project_members ADD COLUMN invited_at TIMESTAMP;
ALTER TABLE project_members ADD COLUMN accepted_at TIMESTAMP;
ALTER TABLE project_members ADD COLUMN invited_by UUID REFERENCES users(id);
```

## Phase 2: Advanced Features (Week 3-4)

### 2.1 Resource Management System
**Implementation:**
```typescript
// Service layer
class ResourceWalletService {
  async getUserWallet(userId: string): Promise<ResourceWallet>
  async consumeResource(userId: string, type: ResourceType, amount: number): Promise<boolean>
  async purchaseResources(userId: string, package: ResourcePackage): Promise<void>
  async getUsageHistory(userId: string): Promise<UsageHistory[]>
}
```

### 2.2 Enhanced Member Management
**Features:**
- Invitation token system with expiry
- Role-based permissions enforcement
- Member activity tracking
- Bulk member operations

### 2.3 Project Export System
**Implementation:**
```typescript
// Export service
class ProjectExportService {
  async generateArchive(projectId: string): Promise<string>
  async includeAudioFiles(projectId: string, archivePath: string): Promise<void>
  async includeTranscripts(projectId: string, archivePath: string): Promise<void>
  async includeMetadata(projectId: string, archivePath: string): Promise<void>
}
```

## Phase 3: Stories Integration (Week 5-6)

### 3.1 Stories List Page Backend
**Missing Implementation:**
```typescript
// Create stories list page
// File: packages/web/src/app/dashboard/projects/[id]/stories/page.tsx

GET /api/projects/:id/stories
- Paginated story list
- Filtering by storyteller, theme, date
- Chapter organization
- Story statistics

GET /api/projects/:id/stories/chapters
- Chapter summaries
- Story counts per chapter
```

### 3.2 Story Detail Page Backend
**Enhanced Features:**
```typescript
GET /api/stories/:id/detail
- Complete story information
- Audio player metadata
- Interaction history
- Related stories

POST /api/stories/:id/interactions
- Add comments/questions
- Follow-up story requests

PUT /api/stories/:id/transcript
- Edit transcript content
- Track edit history
```

## Phase 4: Purchase System Integration (Week 7-8)

### 4.1 Pricing and Packages
**Implementation:**
```typescript
GET /api/pricing/packages
- Available resource packages
- Current pricing
- Feature comparisons

POST /api/purchases/checkout
- Process resource purchases
- Stripe integration
- Seat allocation

GET /api/purchases/history
- Purchase history
- Invoice downloads
```

## Phase 5: Testing and Optimization (Week 9-10)

### 5.1 API Testing
- Unit tests for all new endpoints
- Integration tests for complex workflows
- Load testing for dashboard queries

### 5.2 Performance Optimization
- Database query optimization
- Caching strategy for dashboard data
- API response time monitoring

### 5.3 Security Audit
- Permission validation
- Input sanitization
- Rate limiting implementation

## Implementation Priority

### High Priority (Must Have)
1. ✅ Dashboard resource wallet APIs
2. ✅ Basic settings CRUD operations
3. ✅ Project management member operations
4. ✅ Stories list page creation

### Medium Priority (Should Have)
1. Advanced export functionality
2. Enhanced notification system
3. Detailed usage analytics
4. Bulk operations

### Low Priority (Nice to Have)
1. Advanced filtering options
2. Real-time updates
3. Mobile-specific optimizations
4. Advanced accessibility features

## Database Migration Strategy

### Migration 1: Core Tables
```sql
-- Add resource wallet tables
-- Add user settings tables
-- Add project settings tables
```

### Migration 2: Enhanced Features
```sql
-- Add usage history tracking
-- Add invitation system tables
-- Add export job tracking
```

### Migration 3: Optimization
```sql
-- Add indexes for performance
-- Add constraints for data integrity
-- Add triggers for audit logging
```

## API Documentation Requirements

### OpenAPI Specification
- Complete endpoint documentation
- Request/response schemas
- Authentication requirements
- Error response formats

### Integration Guide
- Frontend integration examples
- Error handling patterns
- Rate limiting guidelines
- Caching recommendations

## Monitoring and Analytics

### Key Metrics to Track
- Resource wallet usage patterns
- Member invitation success rates
- Project export frequency
- Settings update frequency
- API response times
- Error rates by endpoint

### Alerting Setup
- Failed resource consumption attempts
- High API error rates
- Slow query performance
- Failed export jobs

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1-2 | Core APIs | Dashboard, Settings, Project Management APIs |
| 3-4 | Advanced Features | Resource management, Enhanced member management |
| 5-6 | Stories Integration | Stories list/detail pages, Missing story endpoints |
| 7-8 | Purchase System | Pricing, Checkout, Purchase history |
| 9-10 | Testing & Optimization | Testing, Performance, Security audit |

## Success Criteria

### Functional Requirements
- ✅ All 6 modern pages fully functional with real data
- ✅ Resource wallet system operational
- ✅ Member management with proper permissions
- ✅ Project export functionality working
- ✅ Settings persistence across sessions

### Performance Requirements
- Dashboard loads in < 2 seconds
- API responses < 500ms average
- Export generation < 30 seconds
- 99.9% uptime for core endpoints

### Security Requirements
- All endpoints properly authenticated
- Role-based access control enforced
- Input validation on all endpoints
- Audit logging for sensitive operations

This plan provides a comprehensive roadmap for implementing the backend support needed for all 6 modernized UI pages.