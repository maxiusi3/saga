# Subscription System Documentation

## Overview

The subscription system implements Stripe payment processing for "The Saga Package" - a one-time payment of $129 that provides one year of access to the family storytelling platform.

## Architecture

### Components

1. **Stripe Configuration** (`src/config/stripe.ts`)
   - Stripe client initialization
   - Configuration constants (price, URLs, etc.)

2. **Subscription Model** (`src/models/subscription.ts`)
   - Database operations for subscriptions
   - Data transformation between snake_case and camelCase

3. **Subscription Service** (`src/services/subscription-service.ts`)
   - Business logic for subscription management
   - Stripe integration (checkout sessions, webhooks)
   - Payment processing and subscription lifecycle

4. **Subscription Controller** (`src/controllers/subscription-controller.ts`)
   - HTTP request handlers
   - Input validation and error handling

5. **Middleware**
   - `src/middleware/subscription.ts` - User-level subscription checks
   - `src/middleware/project-subscription.ts` - Project-level subscription checks

## API Endpoints

### POST /api/subscriptions/checkout
Creates a Stripe checkout session for "The Saga Package".
- **Auth**: Required (facilitator only)
- **Response**: `{ sessionId, url }`

### POST /api/subscriptions/payment-success
Handles successful payment completion.
- **Body**: `{ sessionId }`
- **Response**: `{ success: true, subscription }`

### GET /api/subscriptions/status
Gets subscription status for authenticated facilitator.
- **Auth**: Required (facilitator only)
- **Response**: `{ hasActiveSubscription, subscription, daysRemaining }`

### POST /api/subscriptions/cancel
Cancels the facilitator's subscription.
- **Auth**: Required (facilitator only)
- **Response**: `{ success: true, message }`

### POST /api/subscriptions/webhook
Handles Stripe webhook events.
- **Auth**: None (verified via Stripe signature)
- **Body**: Raw Stripe webhook payload

## Middleware Usage

### requireActiveSubscription
Use for routes that require the current user to have an active subscription:
```typescript
router.post('/facilitator-only-route', authenticateToken, requireActiveSubscription, handler)
```

### requireProjectSubscription
Use for project-specific routes where the project's facilitator must have an active subscription:
```typescript
router.post('/projects/:projectId/stories', requireProjectSubscription, handler)
```

## Database Schema

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  facilitator_id UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(255),
  status ENUM('active', 'canceled', 'past_due', 'unpaid', 'incomplete'),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Webhook Events Handled

- `checkout.session.completed` - Creates subscription after successful payment
- `invoice.payment_succeeded` - Updates subscription status to active
- `invoice.payment_failed` - Updates subscription status to past_due
- `customer.subscription.updated` - Updates subscription details
- `customer.subscription.deleted` - Marks subscription as canceled

## Error Handling

The system provides detailed error responses with appropriate HTTP status codes:

- `401` - Authentication required
- `403` - Insufficient permissions or subscription required
- `404` - Resource not found
- `409` - Subscription already exists
- `422` - Business logic errors
- `500` - Internal server errors

## Testing

Comprehensive test suite covers:
- API endpoint functionality
- Service layer business logic
- Webhook event handling
- Error scenarios
- Authentication and authorization

Run tests with:
```bash
npm test -- --testPathPattern=subscriptions.test.ts
```

## Security Considerations

1. **Webhook Verification**: All webhook requests are verified using Stripe signatures
2. **Authentication**: All user-facing endpoints require valid JWT tokens
3. **Role-based Access**: Only facilitators can manage subscriptions
4. **Project-level Protection**: Story uploads require valid project facilitator subscription

## Usage Examples

### Creating a Checkout Session
```typescript
// Frontend code
const response = await fetch('/api/subscriptions/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { sessionId, url } = await response.json();
// Redirect user to Stripe checkout
window.location.href = url;
```

### Checking Subscription Status
```typescript
const response = await fetch('/api/subscriptions/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { hasActiveSubscription, daysRemaining } = await response.json();
```

## Integration Points

The subscription system integrates with:
- **Project Creation**: Requires active subscription
- **Story Upload**: Checks project facilitator subscription
- **User Authentication**: Extends auth middleware
- **Stripe Webhooks**: Handles payment lifecycle events

## Deployment Notes

1. Set up Stripe webhook endpoint in Stripe dashboard
2. Configure environment variables for production
3. Test webhook delivery in staging environment
4. Monitor subscription status and payment failures
5. Set up alerts for failed payments and subscription issues