# Resource Wallet Service Documentation

## Overview

The Resource Wallet Service manages the package/seat business model for the Saga platform. It handles resource allocation, consumption, and transaction logging for project vouchers, facilitator seats, and storyteller seats.

## Architecture

### Core Concepts

- **Resource Wallet**: Each user has a wallet containing different types of resources
- **Project Vouchers**: Credits to create new Saga projects
- **Facilitator Seats**: Credits to invite co-facilitators (siblings)
- **Storyteller Seats**: Credits to invite storytellers (parents)
- **Atomic Operations**: All resource operations use database transactions for consistency

### Business Rules

1. **Project Creation**: Consumes 1 Project Voucher
2. **Facilitator Invitation**: Consumes 1 Facilitator Seat (only on acceptance)
3. **Storyteller Invitation**: Consumes 1 Storyteller Seat (only on acceptance)
4. **Refunds**: Failed or rejected invitations refund consumed seats
5. **Package Purchases**: Add multiple resource types atomically

## API Reference

### Core Methods

#### `createWallet(input: CreateResourceWalletInput): Promise<UserResourceWallet>`

Creates a new resource wallet for a user with initial resource allocation.

```typescript
const wallet = await ResourceWalletService.createWallet({
  userId: 'user-123',
  projectVouchers: 1,
  facilitatorSeats: 2,
  storytellerSeats: 2
})
```

#### `getOrCreateWallet(userId: string): Promise<UserResourceWallet>`

Retrieves an existing wallet or creates a new one with zero resources.

```typescript
const wallet = await ResourceWalletService.getOrCreateWallet('user-123')
```

#### `getWalletBalance(userId: string): Promise<WalletBalance>`

Returns the current balance summary for a user's wallet.

```typescript
const balance = await ResourceWalletService.getWalletBalance('user-123')
// Returns: { projectVouchers: 1, facilitatorSeats: 2, storytellerSeats: 2, totalValue: 150 }
```

### Resource Consumption

#### `consumeResources(request: ResourceConsumptionRequest): Promise<ResourceOperationResult>`

Generic method for consuming any type of resource with atomic transaction handling.

```typescript
const result = await ResourceWalletService.consumeResources({
  userId: 'user-123',
  resourceType: 'project_voucher',
  amount: 1,
  projectId: 'project-456',
  description: 'Project creation'
})

if (result.success) {
  console.log(`Remaining balance: ${result.remainingBalance}`)
  console.log(`Transaction ID: ${result.transactionId}`)
} else {
  console.error(`Error: ${result.error}`)
}
```

#### Convenience Methods

```typescript
// Project creation
const result = await ResourceWalletService.consumeProjectVoucher('user-123', 'project-456')

// Facilitator invitation
const result = await ResourceWalletService.consumeFacilitatorSeat('user-123', 'project-456')

// Storyteller invitation
const result = await ResourceWalletService.consumeStorytellerSeat('user-123', 'project-456')
```

### Resource Addition

#### `addResources(userId, resourceType, amount, transactionType, description?, projectId?): Promise<ResourceOperationResult>`

Adds resources to a user's wallet (for purchases, grants, refunds).

```typescript
// Package purchase
const result = await ResourceWalletService.addResources(
  'user-123',
  'project_voucher',
  1,
  'purchase',
  'Saga Package Purchase'
)

// Admin grant
const result = await ResourceWalletService.addResources(
  'user-123',
  'facilitator_seat',
  5,
  'grant',
  'Admin granted additional seats'
)
```

### Package Management

#### `purchasePackage(request: PackagePurchaseRequest): Promise<PackagePurchaseResult>`

Processes a complete package purchase including payment and resource allocation.

```typescript
const result = await ResourceWalletService.purchasePackage({
  packageId: 'saga-package-v1',
  userId: 'user-123',
  paymentMethodId: 'pm_1234567890'
})

if (result.success) {
  console.log(`Purchase successful: ${result.transactionId}`)
  console.log('New wallet balance:', result.walletBalance)
} else {
  console.error(`Purchase failed: ${result.error}`)
}
```

### Refunds

#### `refundResources(userId, resourceType, amount, description, projectId?): Promise<ResourceOperationResult>`

Refunds resources to a user's wallet (typically for failed invitations).

```typescript
const result = await ResourceWalletService.refundResources(
  'user-123',
  'facilitator_seat',
  1,
  'Invitation rejected by invitee',
  'project-456'
)
```

### Transaction History

#### `getTransactionHistory(userId: string, options?: TransactionHistoryOptions): Promise<SeatTransaction[]>`

Retrieves transaction history with optional filtering.

```typescript
// Get all transactions
const allTransactions = await ResourceWalletService.getTransactionHistory('user-123')

// Get filtered transactions
const recentPurchases = await ResourceWalletService.getTransactionHistory('user-123', {
  transactionType: 'purchase',
  limit: 10,
  offset: 0
})

// Get project voucher transactions only
const voucherTransactions = await ResourceWalletService.getTransactionHistory('user-123', {
  resourceType: 'project_voucher'
})
```

#### `getWalletStats(userId: string): Promise<WalletStats>`

Returns comprehensive wallet statistics including balance, transaction history, and metadata.

```typescript
const stats = await ResourceWalletService.getWalletStats('user-123')
console.log('Current balance:', stats.currentBalance)
console.log('Total value:', stats.totalValue)
console.log('Recent transactions:', stats.recentTransactions)
console.log('Wallet created:', stats.createdAt)
console.log('Last updated:', stats.lastUpdated)
```

### Utility Methods

#### Permission Checks

```typescript
// Check if user can create a project
const canCreate = await ResourceWalletService.canCreateProject('user-123')

// Check if user can invite a facilitator
const canInviteFacilitator = await ResourceWalletService.canInviteFacilitator('user-123')

// Check if user can invite a storyteller
const canInviteStoryteller = await ResourceWalletService.canInviteStoryteller('user-123')

// Generic resource check
const hasSufficient = await ResourceWalletService.hasSufficientResources(
  'user-123',
  'project_voucher',
  2
)
```

#### Validation

```typescript
// Validate resource types
const isValidResource = ResourceWalletService.validateResourceType('project_voucher') // true
const isInvalidResource = ResourceWalletService.validateResourceType('invalid_type') // false

// Validate transaction types
const isValidTransaction = ResourceWalletService.validateTransactionType('purchase') // true

// Validate amounts
const isValidAmount = ResourceWalletService.validateAmount(5) // true
const isInvalidAmount = ResourceWalletService.validateAmount(0) // false (must be positive integer)
```

## Data Models

### UserResourceWallet

```typescript
interface UserResourceWallet {
  id: string
  userId: string
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
  createdAt: Date
  updatedAt: Date
}
```

### SeatTransaction

```typescript
interface SeatTransaction {
  id: string
  userId: string
  transactionType: 'purchase' | 'consume' | 'refund' | 'grant' | 'expire'
  resourceType: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat'
  amount: number // Positive for credits, negative for debits
  projectId?: string
  description?: string
  createdAt: Date
}
```

### Request/Response Types

```typescript
interface ResourceConsumptionRequest {
  userId: string
  resourceType: ResourceType
  amount: number
  projectId?: string
  description?: string
}

interface ResourceOperationResult {
  success: boolean
  remainingBalance?: number
  transactionId?: string
  error?: string
}

interface PackagePurchaseRequest {
  packageId: string
  userId: string
  paymentMethodId?: string
  billingAddress?: BillingAddress
}

interface PackagePurchaseResult {
  success: boolean
  transactionId?: string
  walletBalance?: WalletBalance
  error?: string
}
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Resources**
   ```typescript
   {
     success: false,
     error: "Insufficient project_voucher resources. Required: 1, Available: 0"
   }
   ```

2. **Wallet Not Found**
   ```typescript
   {
     success: false,
     error: "Wallet not found"
   }
   ```

3. **Database Transaction Failure**
   ```typescript
   {
     success: false,
     error: "Failed to consume resources"
   }
   ```

4. **Payment Processing Failure**
   ```typescript
   {
     success: false,
     error: "Payment declined by card issuer"
   }
   ```

### Error Recovery

- All operations use database transactions for atomicity
- Failed operations automatically rollback changes
- Retry logic is implemented for transient failures
- Comprehensive logging for debugging and audit trails

## Integration Examples

### Project Creation Flow

```typescript
// Check if user can create project
const canCreate = await ResourceWalletService.canCreateProject(userId)
if (!canCreate) {
  return res.status(402).json({ 
    error: 'Insufficient project vouchers',
    code: 'INSUFFICIENT_RESOURCES'
  })
}

// Create project
const project = await ProjectModel.create(projectData)

// Consume voucher
const consumptionResult = await ResourceWalletService.consumeProjectVoucher(userId, project.id)
if (!consumptionResult.success) {
  // Rollback project creation
  await ProjectModel.delete(project.id)
  return res.status(500).json({ error: consumptionResult.error })
}

// Return success with updated balance
const walletBalance = await ResourceWalletService.getWalletBalance(userId)
res.json({ project, walletBalance, transactionId: consumptionResult.transactionId })
```

### Invitation Flow

```typescript
// Check if user has seats available
const canInvite = await ResourceWalletService.canInviteFacilitator(userId)
if (!canInvite) {
  return res.status(402).json({ 
    error: 'Insufficient facilitator seats',
    code: 'INSUFFICIENT_RESOURCES'
  })
}

// Create invitation
const invitation = await InvitationModel.create(invitationData)

// Consume seat (only on acceptance)
invitation.onAccepted(async () => {
  const result = await ResourceWalletService.consumeFacilitatorSeat(userId, projectId)
  if (!result.success) {
    console.error('Failed to consume seat after invitation acceptance:', result.error)
  }
})

// Handle rejection with refund
invitation.onRejected(async () => {
  await ResourceWalletService.refundResources(
    userId,
    'facilitator_seat',
    1,
    'Invitation rejected',
    projectId
  )
})
```

### Package Purchase Flow

```typescript
// Process package purchase
const purchaseResult = await ResourceWalletService.purchasePackage({
  packageId: 'saga-package-v1',
  userId: req.user.id,
  paymentMethodId: req.body.paymentMethodId
})

if (!purchaseResult.success) {
  return res.status(402).json({ 
    error: purchaseResult.error,
    code: 'PURCHASE_FAILED'
  })
}

// Return success with updated wallet
res.json({
  success: true,
  transactionId: purchaseResult.transactionId,
  walletBalance: purchaseResult.walletBalance
})
```

## Performance Considerations

### Database Optimization

- Indexes on frequently queried columns (userId, resourceType, transactionType)
- Connection pooling for concurrent operations
- Transaction isolation levels to prevent race conditions

### Caching Strategy

- Wallet balances cached with Redis for frequently accessed users
- Cache invalidation on wallet updates
- Transaction history pagination for large datasets

### Monitoring

- Transaction success/failure rates
- Resource consumption patterns
- Payment processing metrics
- Database performance metrics

## Security

### Access Control

- All operations require authenticated user context
- Admin operations require elevated permissions
- API rate limiting to prevent abuse

### Data Protection

- Sensitive payment data handled via secure payment processors
- Transaction logs encrypted at rest
- Audit trails for all financial operations

### Validation

- Input validation for all parameters
- Resource type and amount validation
- Transaction type validation
- User permission validation

## Testing

### Unit Tests

- Mock all external dependencies
- Test all success and failure scenarios
- Validate transaction atomicity
- Test concurrent operations

### Integration Tests

- Real database transactions
- End-to-end workflow testing
- Performance testing under load
- Error recovery testing

### Test Coverage

- Minimum 80% code coverage required
- Critical paths have 100% coverage
- Edge cases and error scenarios covered

## Deployment

### Environment Configuration

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/saga_db

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis Cache
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://...
```

### Migration Strategy

- Database migrations for schema changes
- Backward compatibility for API changes
- Gradual rollout for major updates
- Rollback procedures for failed deployments

## Troubleshooting

### Common Issues

1. **Race Conditions**: Use database transactions and proper isolation levels
2. **Inconsistent Balances**: Check transaction logs and run balance reconciliation
3. **Payment Failures**: Verify Stripe configuration and webhook handling
4. **Performance Issues**: Monitor database queries and optimize indexes

### Debugging

- Enable detailed logging for transaction flows
- Use transaction IDs to trace operations
- Monitor database connection pools
- Check Redis cache hit rates

### Support Tools

- Admin interface for wallet management
- Transaction history export
- Balance reconciliation scripts
- Performance monitoring dashboards