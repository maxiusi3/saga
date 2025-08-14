# Saga Notification System Documentation

## Overview

The Saga notification system provides a comprehensive, multi-channel notification infrastructure that supports push notifications, email notifications, and real-time WebSocket updates. The system is designed to be extensible, reliable, and user-configurable.

## Architecture

### Core Components

1. **NotificationService** - Main service orchestrating all notification operations
2. **PushNotificationService** - Handles Firebase Cloud Messaging (FCM) and Apple Push Notification Service (APNS)
3. **EmailNotificationService** - Manages transactional emails via SendGrid
4. **NotificationEventDispatcher** - Event-driven notification triggering system
5. **NotificationPreferencesModel** - User notification preferences and settings
6. **DeviceTokenModel** - Device token management for push notifications

### System Flow

```
Application Event → NotificationEventDispatcher → NotificationService → External Providers
                                                                      ↓
                                                    Database Storage ← User Preferences
```

## Key Features

### Multi-Channel Delivery
- **Push Notifications**: iOS (APNS) and Android (FCM)
- **Email Notifications**: Transactional emails via SendGrid
- **WebSocket**: Real-time in-app notifications

### User Preferences
- Per-notification-type delivery method configuration
- Global email/push enable/disable toggles
- Quiet hours support with timezone awareness
- Granular control over notification types

### Event-Driven Architecture
- Extensible event system for triggering notifications
- Type-safe event handlers
- Automatic retry and error handling
- Bulk notification support

## Usage

### Basic Notification Sending

```typescript
import { NotificationService } from '../services/notification-service'

// Send a single notification
const result = await NotificationService.createAndSendNotification({
  userId: 'user-123',
  type: 'story_uploaded',
  title: 'New Story Shared',
  body: 'John shared a new story about childhood memories',
  data: {
    storyId: 'story-456',
    projectId: 'project-789'
  }
})

if (result.success) {
  console.log('Notification sent successfully')
} else {
  console.error('Notification failed:', result.error)
}
```

### Event-Driven Notifications

```typescript
import { NotificationEvents } from '../services/notification-events'

// Trigger story upload notification
await NotificationEvents.storyUploaded({
  storyId: 'story-123',
  storytellerId: 'user-456',
  projectId: 'project-789',
  storyTitle: 'My Childhood Adventure',
  storyDuration: 180
})

// Trigger interaction notification
await NotificationEvents.interactionAdded({
  interactionId: 'interaction-123',
  storyId: 'story-456',
  storytellerId: 'user-789',
  facilitatorId: 'user-123',
  interactionType: 'follow_up_question',
  content: 'Can you tell us more about that day?'
})
```

### Bulk Notifications

```typescript
// Send notifications to multiple users
const result = await NotificationService.sendBulkNotifications({
  userIds: ['user-1', 'user-2', 'user-3'],
  type: 'system_maintenance',
  title: 'Scheduled Maintenance',
  body: 'Saga will be offline for maintenance from 2-4 AM EST',
  deliveryMethod: ['email', 'push']
})

console.log(`Sent ${result.successful} notifications, ${result.failed} failed`)
```

### Scheduled Notifications

```typescript
// Schedule a notification for future delivery
const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

await NotificationService.scheduleNotification({
  userId: 'user-123',
  type: 'reminder',
  title: 'Story Reminder',
  body: 'Don\'t forget to share your weekly story!',
  scheduledAt: scheduledTime
})
```

## Notification Types

### Story Notifications
- `story_uploaded` - New story shared by storyteller
- `story_processed` - Story transcription completed

### Interaction Notifications
- `interaction_added` - New comment on story
- `follow_up_question` - Follow-up question from facilitator

### Export Notifications
- `export_ready` - Project export completed
- `export_failed` - Export process failed

### Invitation Notifications
- `invitation_received` - Project invitation received
- `invitation_accepted` - Invitation accepted by invitee

### Subscription Notifications
- `subscription_expiring` - Subscription expiring soon
- `subscription_expired` - Subscription has expired
- `subscription_renewed` - Subscription renewed

### System Notifications
- `system_maintenance` - System maintenance alerts
- `user_registered` - Welcome message for new users

## User Preferences

### Default Preferences
```typescript
{
  storyUploaded: ['push', 'email'],
  storyProcessed: ['push'],
  interactionAdded: ['push', 'email'],
  followUpQuestion: ['push', 'email'],
  exportReady: ['push', 'email'],
  invitationReceived: ['push', 'email'],
  subscriptionExpiring: ['push', 'email'],
  subscriptionExpired: ['push', 'email'],
  emailEnabled: true,
  pushEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'UTC'
}
```

### Managing User Preferences

```typescript
import { NotificationPreferencesModel } from '../models/notification-preferences'

// Get user preferences
const preferences = await NotificationPreferencesModel.findOrCreateByUserId('user-123')

// Update preferences
await NotificationPreferencesModel.update('user-123', {
  storyUploaded: ['push'], // Only push notifications for story uploads
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'America/New_York'
})

// Check if user is in quiet hours
const isQuiet = await NotificationPreferencesModel.isInQuietHours('user-123')
```

## Push Notification Templates

### Template System
The system uses a template-based approach for consistent messaging:

```typescript
import { getPushNotificationTemplate } from '../templates/push/push-notification-templates'

const template = getPushNotificationTemplate('story_uploaded', {
  storytellerName: 'John Doe',
  storyTitle: 'My First Day at School',
  storyId: 'story-123',
  projectId: 'project-456'
})

// Returns:
// {
//   title: 'New Story Shared',
//   body: 'John Doe shared a new story: "My First Day at School"',
//   data: { type: 'story_uploaded', storyId: 'story-123', ... },
//   badge: 1,
//   sound: 'story_notification.wav',
//   category: 'STORY_CATEGORY'
// }
```

### Platform-Specific Features

#### iOS Categories
- Interactive notifications with action buttons
- Custom sounds for different notification types
- Badge count management

#### Android Channels
- Organized notification channels by type
- Channel-specific importance levels
- Custom notification sounds

## Email Templates

### Template Structure
Email templates are HTML-based with dynamic content injection:

```html
<!-- packages/backend/src/templates/email/story-uploaded.html -->
<!DOCTYPE html>
<html>
<head>
  <title>New Story Shared - Saga</title>
</head>
<body>
  <h1>{{storytellerName}} shared a new story</h1>
  <p>{{storytellerName}} just shared "{{storyTitle}}" in your {{projectName}} project.</p>
  <a href="{{storyUrl}}">Listen to the story</a>
</body>
</html>
```

### Email Service Usage

```typescript
import { EmailNotificationService } from '../services/email-notification-service'

await EmailNotificationService.sendNotification({
  to: 'user@example.com',
  subject: 'New Story Shared',
  template: 'story-uploaded',
  data: {
    storytellerName: 'John Doe',
    storyTitle: 'My Adventure',
    projectName: 'Family Stories',
    storyUrl: 'https://saga.app/stories/123'
  }
})
```

## Device Token Management

### Registering Device Tokens

```typescript
import { DeviceTokenModel } from '../models/device-token'

// Register new device token
await DeviceTokenModel.create({
  userId: 'user-123',
  token: 'fcm-token-or-apns-token',
  platform: 'ios', // or 'android'
  deviceId: 'device-unique-id'
})

// Update existing token
await DeviceTokenModel.updateToken('old-token', 'new-token')

// Deactivate token (on logout)
await DeviceTokenModel.deactivate('token-to-deactivate')
```

### Token Cleanup
The system automatically handles:
- Invalid token cleanup
- Duplicate token management
- Inactive token removal

## Error Handling

### Graceful Degradation
The notification system is designed to handle failures gracefully:

```typescript
// If push notification fails, email might still succeed
const result = await NotificationService.createAndSendNotification({
  userId: 'user-123',
  type: 'story_uploaded',
  title: 'New Story',
  body: 'A new story has been shared'
})

// Check individual delivery results
result.deliveryResults.forEach(delivery => {
  if (!delivery.success) {
    console.error(`${delivery.method} delivery failed:`, delivery.error)
  }
})
```

### Retry Logic
- Automatic retry for transient failures
- Exponential backoff for rate limiting
- Dead letter queue for persistent failures

### Error Monitoring
- Comprehensive error logging
- Integration with monitoring systems
- Alert thresholds for failure rates

## Performance Considerations

### Batch Processing
- Bulk notifications processed in batches
- Rate limiting to respect provider limits
- Queue-based processing for high volume

### Caching
- Template caching for improved performance
- User preference caching
- Device token caching

### Database Optimization
- Indexed queries for notification retrieval
- Efficient pagination for notification history
- Cleanup jobs for old notifications

## Security

### Data Protection
- Encrypted storage of sensitive data
- Secure token transmission
- PII handling compliance

### Access Control
- User-scoped notification access
- Admin-only bulk operations
- Rate limiting per user

### Privacy
- User consent for notification types
- Easy opt-out mechanisms
- Data retention policies

## Monitoring and Analytics

### Key Metrics
- Delivery success rates by channel
- User engagement with notifications
- Opt-out rates by notification type
- Performance metrics (latency, throughput)

### Logging
```typescript
// Structured logging for notifications
logger.info('Notification sent', {
  userId: 'user-123',
  type: 'story_uploaded',
  deliveryMethods: ['push', 'email'],
  success: true,
  duration: 150
})
```

### Dashboards
- Real-time notification metrics
- User preference analytics
- System health monitoring
- Error rate tracking

## Testing

### Unit Tests
Comprehensive test coverage with mocked external services:

```typescript
// Example test
describe('NotificationService', () => {
  it('should send notification with user preferences', async () => {
    mockPreferencesModel.getDeliveryMethods.mockResolvedValue(['push'])
    
    const result = await NotificationService.createAndSendNotification({
      userId: 'user-1',
      type: 'story_uploaded',
      title: 'Test',
      body: 'Test body'
    })
    
    expect(result.success).toBe(true)
    expect(mockPushService.sendNotification).toHaveBeenCalled()
    expect(mockEmailService.sendNotification).not.toHaveBeenCalled()
  })
})
```

### Integration Tests
- End-to-end notification flows
- External service integration
- Database transaction testing

### Load Testing
- High-volume notification scenarios
- Concurrent user testing
- Performance benchmarking

## Configuration

### Environment Variables
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=saga-production
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# SendGrid Configuration
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=notifications@saga.app
SENDGRID_FROM_NAME=Saga

# Notification Settings
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_RETRY_ATTEMPTS=3
NOTIFICATION_QUIET_HOURS_DEFAULT=false
```

### Feature Flags
- Enable/disable notification channels
- A/B testing for notification content
- Gradual rollout of new features

## Troubleshooting

### Common Issues

#### Push Notifications Not Delivered
1. Check device token validity
2. Verify Firebase/APNS configuration
3. Check user notification preferences
4. Verify app is not in quiet hours

#### Email Notifications Not Sent
1. Verify SendGrid API key
2. Check email template existence
3. Verify recipient email address
4. Check spam folder

#### High Failure Rates
1. Monitor external service status
2. Check rate limiting
3. Verify configuration
4. Review error logs

### Debug Mode
Enable detailed logging for troubleshooting:

```typescript
// Enable debug logging
process.env.NOTIFICATION_DEBUG = 'true'

// This will log detailed information about:
// - User preference resolution
// - Template rendering
// - External service calls
// - Error details
```

## API Reference

### NotificationService Methods

#### `createAndSendNotification(input: CreateNotificationInput)`
Creates and immediately sends a notification.

#### `sendBulkNotifications(input: BulkNotificationInput)`
Sends notifications to multiple users.

#### `scheduleNotification(input: CreateNotificationInput)`
Schedules a notification for future delivery.

#### `getUserNotifications(userId: string, options?: QueryOptions)`
Retrieves user's notification history.

#### `markAsRead(notificationId: string)`
Marks a notification as read.

#### `getUnreadCount(userId: string)`
Gets count of unread notifications for user.

### Event Methods

#### `NotificationEvents.storyUploaded(data)`
Triggers story upload notification.

#### `NotificationEvents.interactionAdded(data)`
Triggers interaction notification.

#### `NotificationEvents.exportReady(data)`
Triggers export completion notification.

## Best Practices

### Development
1. Always use typed interfaces for notification data
2. Test with mocked external services
3. Handle errors gracefully
4. Use event-driven approach for loose coupling

### Production
1. Monitor delivery rates and adjust accordingly
2. Respect user preferences and quiet hours
3. Implement proper retry logic
4. Use structured logging for debugging

### User Experience
1. Keep notification content concise and actionable
2. Provide clear opt-out mechanisms
3. Respect user preferences and timing
4. Use appropriate notification channels for content type

## Migration Guide

### From v1.0 to v1.5
The notification system has been significantly enhanced in v1.5:

1. **New Event System**: Replace direct service calls with event-driven approach
2. **Enhanced Preferences**: Update user preference handling
3. **Template System**: Migrate to new template-based messaging
4. **Multi-Channel**: Update to support multiple delivery methods

### Breaking Changes
- `NotificationService.send()` replaced with `createAndSendNotification()`
- User preferences now support per-type delivery methods
- Event handlers require registration with dispatcher

### Migration Steps
1. Update notification service calls to use new API
2. Migrate user preferences to new schema
3. Replace direct service calls with event triggers
4. Update templates to new format
5. Test thoroughly with new system

## Support

For questions or issues with the notification system:

1. Check this documentation first
2. Review error logs and monitoring dashboards
3. Test with debug mode enabled
4. Contact the development team with specific error details

## Changelog

### v1.5.0
- Added event-driven notification system
- Implemented user notification preferences
- Added push notification templates
- Enhanced error handling and retry logic
- Added bulk notification support
- Implemented scheduled notifications

### v1.0.0
- Initial notification system implementation
- Basic push and email support
- Simple notification storage