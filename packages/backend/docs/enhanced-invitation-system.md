# Enhanced Invitation System Documentation

## Overview

The Enhanced Invitation System implements role-specific invitations with seat consumption and proper status tracking for the Saga Family Biography platform. This system supports multi-facilitator collaboration while enforcing business rules around resource management.

## Key Features

### 1. Role-Specific Invitations
- **Facilitator Invitations**: Allow users to collaborate on project management
- **Storyteller Invitations**: Allow users to record and share stories
- Clear role descriptions in invitation emails and UI

### 2. Seat Consumption Model
- Seats are only consumed when invitations are **accepted**, not when created
- **Facilitator Seats**: Required to invite co-facilitators (siblings)
- **Storyteller Seats**: Required to invite storytellers (parents)
- Automatic refund if invitation fails or expires

### 3. Status Tracking
- **Pending**: Invitation created and waiting for acceptance
- **Accepted**: Invitation accepted and role assigned
- **Expired**: Invitation expired (72 hours) and no longer valid

### 4. Global Business Rules
- **One Storyteller per User**: Each user can only be a storyteller in one project globally
- **Multiple Facilitators**: Users can be facilitators in multiple projects
- **Project Storyteller Limit**: Each project can only have one storyteller

## API Endpoints

### Create Invitation
```http
POST /api/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "uuid",
  "role": "facilitator" | "storyteller"
}
```

### Get Invitation Details
```http
GET /api/invitations/:token
```

### Accept Invitation
```http
POST /api/invitations/:token/accept
Content-Type: application/json

{
  "name": "User Name",      // Required for new users
  "email": "user@email.com", // Required if no phone
  "phone": "+1234567890"     // Required if no email
}
```

### Resend Invitation
```http
POST /api/invitations/:invitationId/resend
Authorization: Bearer <token>
```

### Get Project Invitations
```http
GET /api/invitations/projects/:projectId
Authorization: Bearer <token>
```

### Get Invitation Analytics
```http
GET /api/invitations/analytics?projectId=uuid
Authorization: Bearer <token>
```

## Database Schema

### Invitations Table
```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  token VARCHAR(255) UNIQUE,
  role VARCHAR(20) CHECK (role IN ('facilitator', 'storyteller')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Project Roles Table
```sql
CREATE TABLE project_roles (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) CHECK (role IN ('facilitator', 'storyteller')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id, role)
);
```

## Business Logic Flow

### Invitation Creation
1. Validate user is facilitator of the project
2. Check if user has required seats in resource wallet
3. Validate role assignment rules (e.g., project doesn't already have storyteller)
4. Create invitation with 72-hour expiry
5. Send role-specific email invitation

### Invitation Acceptance
1. Validate invitation token and expiry
2. Create user account if needed
3. Validate role assignment (global storyteller limit, etc.)
4. Consume appropriate seat from project creator's wallet
5. Assign role to user in project
6. Mark invitation as accepted
7. Send confirmation notifications

### Seat Consumption
- **Project Voucher**: Consumed when creating a project
- **Facilitator Seat**: Consumed when facilitator invitation is accepted
- **Storyteller Seat**: Consumed when storyteller invitation is accepted

## Error Handling

### Common Error Codes
- `INSUFFICIENT_RESOURCES`: User lacks required seats
- `PROJECT_HAS_STORYTELLER`: Project already has a storyteller
- `INVALID_INVITATION`: Invitation token is invalid or expired
- `ROLE_ASSIGNMENT_INVALID`: Role cannot be assigned (e.g., user already storyteller elsewhere)
- `ACCESS_DENIED`: User lacks permission to perform action

### Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/invitations"
}
```

## Analytics and Tracking

### Invitation Metrics
- **Acceptance Rate**: Percentage of invitations accepted
- **Expiry Rate**: Percentage of invitations that expire
- **Average Acceptance Time**: Time between creation and acceptance
- **Role Distribution**: Breakdown by facilitator vs storyteller invitations

### Usage Analytics
```javascript
const analytics = await InvitationModel.getInvitationAnalytics(projectId)
// Returns:
{
  totalInvitations: 10,
  acceptedInvitations: 7,
  expiredInvitations: 2,
  pendingInvitations: 1,
  facilitatorInvitations: 6,
  storytellerInvitations: 4,
  acceptanceRate: 70.0,
  expiryRate: 20.0,
  averageAcceptanceTimeHours: 24.5
}
```

## Email Templates

### Role-Specific Content
The invitation email template includes conditional content based on the role:

**For Storytellers:**
- Emphasis on recording stories and sharing memories
- Instructions for mobile app usage
- Explanation of AI-guided prompts

**For Facilitators:**
- Focus on collaboration and project management
- Instructions for web dashboard usage
- Explanation of story interaction features

## Security Considerations

### Token Security
- Secure random token generation using crypto.randomBytes
- 72-hour expiry to limit exposure window
- Tokens are single-use and invalidated after acceptance

### Permission Validation
- All invitation operations require proper role validation
- Project facilitators can only manage their own project invitations
- Resource consumption is atomic and transaction-safe

### Data Privacy
- Invitation tokens don't expose sensitive project information
- User data is only shared with project members after acceptance
- Email addresses are validated and normalized

## Testing

### Test Coverage
- Unit tests for all invitation model methods
- Integration tests for complete invitation flows
- Role validation and business rule enforcement
- Seat consumption and wallet integration
- Error handling and edge cases

### Key Test Scenarios
1. **Role-specific invitation creation and acceptance**
2. **Seat consumption on acceptance**
3. **Global storyteller role enforcement**
4. **Invitation expiry and resending**
5. **Permission validation for all operations**
6. **Analytics and reporting accuracy**

## Future Enhancements

### Planned Features
- **Bulk Invitations**: Send multiple invitations at once
- **Custom Expiry Times**: Allow facilitators to set custom expiry periods
- **Invitation Templates**: Pre-written invitation messages
- **Advanced Analytics**: Detailed conversion funnel analysis
- **Integration Webhooks**: Notify external systems of invitation events

### Scalability Considerations
- **Invitation Queue**: Background processing for large invitation batches
- **Rate Limiting**: Prevent invitation spam
- **Caching**: Cache frequently accessed invitation data
- **Archival**: Archive old invitations for performance