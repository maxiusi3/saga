# Payment System Documentation

## Overview

The Saga Family Biography payment system handles package purchases, resource wallet crediting, payment method management, and comprehensive analytics. The system is built on Stripe for payment processing and integrates with the resource wallet system for automatic crediting.

## Architecture

### Core Components

1. **PaymentService** - Main payment processing logic
2. **PaymentMethodService** - Payment method management
3. **ReceiptService** - Receipt generation and purchase history
4. **PaymentAnalyticsService** - Analytics and tracking
5. **PaymentRetryService** - Payment failure handling and retries
6. **RefundService** - Refund processing

### Database Schema

#### Purchase Receipts
```sql
CREATE TABLE purchase_receipts (
  id UUID PRIMARY KEY,
  receipt_id VARCHAR UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  payment_intent_id VARCHAR NOT NULL,
  package_id VARCHAR NOT NULL,
  package_name VARCHAR NOT NULL,
  package_description TEXT,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR,
  resources JSON NOT NULL,
  metadata JSON DEFAULT '{}',
  purchase_date TIMESTAMP NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Payment Events (Analytics)
```sql
CREATE TABLE payment_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type VARCHAR NOT NULL, -- payment_intent_created, payment_succeeded, etc.
  payment_intent_id VARCHAR,
  amount INTEGER, -- in cents
  currency VARCHAR(3),
  package_id VARCHAR,
  error_code VARCHAR,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Payment Processing

#### Create Payment Intent
```http
POST /api/payments/create-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "packageId": "pkg_saga_package",
  "metadata": {
    "userId": "user123"
  }
}
```

**Response:**
```json
{
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "amount": 9999,
    "currency": "usd"
  },
  "message": "Payment intent created successfully"
}
```

#### Confirm Payment
```http
POST /api/payments/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx"
}
```

**Response:**
```json
{
  "data": {
    "success": true,
    "transactionId": "pi_xxx",
    "walletBalance": {
      "projectVouchers": 1,
      "facilitatorSeats": 2,
      "storytellerSeats": 2
    },
    "receipt": {
      "receiptId": "rcp_xxx",
      "amount": 9999,
      "currency": "USD",
      "formattedAmount": "$99.99"
    }
  },
  "message": "Payment processed successfully"
}
```

### Payment Methods

#### List Payment Methods
```http
GET /api/payment-methods
Authorization: Bearer <token>
```

#### Create Setup Intent
```http
POST /api/payment-methods/setup-intent
Authorization: Bearer <token>
```

#### Confirm Setup Intent
```http
POST /api/payment-methods/confirm-setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "setupIntentId": "seti_xxx"
}
```

#### Set Default Payment Method
```http
POST /api/payment-methods/{paymentMethodId}/set-default
Authorization: Bearer <token>
```

#### Remove Payment Method
```http
DELETE /api/payment-methods/{paymentMethodId}
Authorization: Bearer <token>
```

### Receipts and History

#### Get Purchase History
```http
GET /api/receipts/history?limit=20&offset=0
Authorization: Bearer <token>
```

#### Get Specific Receipt
```http
GET /api/receipts/{receiptId}
Authorization: Bearer <token>
```

#### Download Receipt PDF
```http
GET /api/receipts/{receiptId}/download
Authorization: Bearer <token>
```

### Analytics (Admin Only)

#### Get Payment Analytics
```http
GET /api/payment-analytics?startDate=2023-01-01&endDate=2023-12-31&groupBy=month
Authorization: Bearer <admin-token>
```

#### Get Payment Metrics
```http
GET /api/payment-analytics/metrics
Authorization: Bearer <admin-token>
```

#### Get Revenue Analytics
```http
GET /api/payment-analytics/revenue?groupBy=week
Authorization: Bearer <admin-token>
```

## Payment Flow

### Standard Purchase Flow

1. **Package Selection**: User selects a package from available options
2. **Payment Intent Creation**: Client creates payment intent via API
3. **Payment Method Collection**: Client collects payment method using Stripe Elements
4. **Payment Confirmation**: Client confirms payment intent
5. **Server Processing**: 
   - Verify payment success
   - Credit resource wallet
   - Generate receipt
   - Send confirmation email
6. **Client Update**: Update UI with success state and wallet balance

### Mobile Payment Flow (Apple Pay/Google Pay)

1. **Payment Request**: Create payment request with package details
2. **Native Payment Sheet**: Show Apple Pay/Google Pay sheet
3. **Payment Authorization**: User authorizes payment
4. **Token Processing**: Process payment token via Stripe
5. **Completion**: Same server processing as standard flow

## Error Handling

### Payment Failures

The system handles various payment failure scenarios:

- **Card Declined**: Retry with different payment method
- **Insufficient Funds**: Suggest alternative payment methods
- **Authentication Required**: Handle 3D Secure authentication
- **Network Errors**: Automatic retry with exponential backoff

### Retry Logic

```typescript
// Automatic retry for transient failures
const retryDelays = [
  1 * 60 * 1000,      // 1 minute
  5 * 60 * 1000,      // 5 minutes
  15 * 60 * 1000,     // 15 minutes
  60 * 60 * 1000,     // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
  24 * 60 * 60 * 1000 // 24 hours
]
```

### Refund Processing

Automatic refunds are processed for:
- Payment processing errors
- Duplicate charges
- System failures after successful payment

## Security

### PCI Compliance

- All payment data handled by Stripe (PCI DSS Level 1)
- No sensitive payment data stored on our servers
- Tokenization for stored payment methods

### API Security

- JWT authentication for all endpoints
- Rate limiting on payment endpoints
- Request validation and sanitization
- HTTPS only for all payment-related communications

### Webhook Security

```typescript
// Webhook signature verification
const signature = req.headers['stripe-signature']
const event = stripe.webhooks.constructEvent(
  req.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
)
```

## Testing

### Test Cards

Stripe provides test cards for different scenarios:

- **Success**: `4242424242424242`
- **Declined**: `4000000000000002`
- **Insufficient Funds**: `4000000000009995`
- **3D Secure**: `4000000000003220`

### Test Environment

```bash
# Set test environment
export STRIPE_PUBLISHABLE_KEY=pk_test_...
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Integration Tests

Run payment integration tests:

```bash
npm run test:integration -- --grep "Payment"
```

## Monitoring and Analytics

### Key Metrics

- **Conversion Rate**: Payment intent to successful payment
- **Average Order Value**: Mean purchase amount
- **Payment Method Distribution**: Breakdown by payment type
- **Failure Rate**: Percentage of failed payments
- **Refund Rate**: Percentage of refunded transactions

### Alerts

Set up monitoring for:
- High payment failure rates (>5%)
- Webhook delivery failures
- Unusual refund patterns
- API response time degradation

### Dashboards

Payment analytics dashboard includes:
- Real-time transaction volume
- Revenue trends over time
- Payment method performance
- Customer lifetime value
- Conversion funnel analysis

## Configuration

### Environment Variables

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Package Configuration
DEFAULT_PACKAGE_ID=pkg_saga_package
DEFAULT_PACKAGE_PRICE=9999  # in cents
DEFAULT_CURRENCY=USD

# Analytics
PAYMENT_ANALYTICS_RETENTION_DAYS=365
```

### Package Configuration

```typescript
// Default Saga Package
const SAGA_PACKAGE = {
  id: 'pkg_saga_package',
  name: 'The Saga Package',
  description: 'Complete family biography package',
  price: 99.99,
  currency: 'USD',
  resources: {
    projectVouchers: 1,
    facilitatorSeats: 2,
    storytellerSeats: 2
  }
}
```

## Troubleshooting

### Common Issues

#### Payment Intent Creation Fails
- Check Stripe API keys
- Verify package configuration
- Check user authentication

#### Payment Confirmation Fails
- Verify payment intent status
- Check webhook delivery
- Validate package pricing

#### Wallet Not Credited
- Check ResourceWalletService integration
- Verify transaction logging
- Check for race conditions

#### Receipt Generation Fails
- Verify package data availability
- Check database connectivity
- Validate receipt template

### Debug Commands

```bash
# Check payment intent status
curl -X GET "https://api.stripe.com/v1/payment_intents/pi_xxx" \
  -H "Authorization: Bearer sk_test_..."

# List customer payment methods
curl -X GET "https://api.stripe.com/v1/payment_methods?customer=cus_xxx&type=card" \
  -H "Authorization: Bearer sk_test_..."

# Check webhook events
curl -X GET "https://api.stripe.com/v1/events?type=payment_intent.succeeded" \
  -H "Authorization: Bearer sk_test_..."
```

## Best Practices

### Development

1. **Always use test mode** during development
2. **Validate all inputs** before processing
3. **Handle errors gracefully** with user-friendly messages
4. **Log all payment events** for debugging
5. **Test edge cases** thoroughly

### Production

1. **Monitor payment success rates** continuously
2. **Set up proper alerting** for failures
3. **Regular security audits** of payment flow
4. **Keep Stripe webhooks** up to date
5. **Backup payment data** regularly

### Performance

1. **Cache package data** to reduce API calls
2. **Use database indexes** for analytics queries
3. **Implement proper pagination** for large datasets
4. **Optimize webhook processing** for speed
5. **Monitor API response times**

## Support and Maintenance

### Regular Tasks

- Review payment failure patterns monthly
- Update test card numbers as needed
- Monitor Stripe API version updates
- Audit payment method security quarterly
- Review and update documentation

### Emergency Procedures

1. **Payment System Down**: Switch to maintenance mode
2. **High Failure Rate**: Investigate and alert team
3. **Security Breach**: Immediately revoke API keys
4. **Data Loss**: Restore from backups
5. **Webhook Failures**: Manual reconciliation process

For additional support, contact the development team or refer to the Stripe documentation at https://stripe.com/docs.