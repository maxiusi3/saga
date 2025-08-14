# Package/Seat Business Model Implementation Guide

## Business Logic Overview

The Saga platform uses a **Package/Seat model** to enable flexible family collaboration while maintaining clear resource management and billing.

## Core Concepts

### Resource Wallet
Each User Account has a Resource Wallet containing:
- **Project Vouchers**: Credits to create new Saga projects
- **Facilitator Seats**: Credits to invite co-facilitators (siblings)
- **Storyteller Seats**: Credits to invite storytellers (parents)

### Seat Consumption Rules
1. **Creating a project** consumes 1 Project Voucher
2. **Inviting a co-facilitator** consumes 1 Facilitator Seat
3. **Inviting a storyteller** consumes 1 Storyteller Seat
4. **Seats are consumed only upon successful acceptance** of invitations

## Implementation Patterns

### Database Schema
```sql
-- User resource tracking
CREATE TABLE user_resource_wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    project_vouchers INTEGER DEFAULT 0,
    facilitator_seats INTEGER DEFAULT 0,
    storyteller_seats INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transaction log for seat usage
CREATE TABLE seat_transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    transaction_type VARCHAR(50), -- 'purchase', 'consume', 'refund'
    resource_type VARCHAR(50), -- 'project_voucher', 'facilitator_seat', 'storyteller_seat'
    amount INTEGER, -- positive for credit, negative for debit
    project_id UUID REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Service Layer Implementation
```typescript
class ResourceWalletService {
  async consumeProjectVoucher(userId: string): Promise<boolean> {
    // Check availability, consume voucher, log transaction
    // Return false if insufficient resources
  }
  
  async consumeFacilitatorSeat(userId: string, projectId: string): Promise<boolean> {
    // Check availability, consume seat, log transaction
    // Only consume on successful invitation acceptance
  }
  
  async consumeStorytellerSeat(userId: string, projectId: string): Promise<boolean> {
    // Check availability, consume seat, log transaction
    // Only consume on successful invitation acceptance
  }
  
  async creditResources(userId: string, package: PurchasedPackage): Promise<void> {
    // Credit wallet based on purchased package
    // Log all transactions for audit trail
  }
}
```

### UI/UX Patterns

#### Resource Display
- **Dashboard**: Show available resources prominently
- **Action Gating**: Disable buttons when resources unavailable
- **Purchase Prompts**: Clear CTAs to buy more seats when needed

#### Invitation Flow
```typescript
// Before sending invitation
if (!await resourceWallet.hasAvailableSeats(userId, seatType)) {
  showPurchasePrompt();
  return;
}

// Generate invitation but don't consume seat yet
const invitation = await generateInvitation(projectId, role);

// Consume seat only on successful acceptance
invitation.onAccepted(() => {
  resourceWallet.consumeSeat(userId, seatType, projectId);
});
```

## Package Definitions

### MVP Package: "The Saga Package"
- **Price**: $99-149 USD (TBD based on market research)
- **Includes**:
  - 1 Project Voucher
  - 2 Facilitator Seats (for sibling collaboration)
  - 2 Storyteller Seats (for multiple family members)
  - 1 year of interactive service
  - Permanent archival mode access
  - Full data export capability

### A La Carte Pricing (Future)
- **Additional Project**: $X
- **Additional Facilitator Seat**: $Y
- **Additional Storyteller Seat**: $Z

## Business Rules

### Collaboration Constraints
- **One Storyteller per user per project**: Maintains authentic individual narratives
- **Multiple Facilitators allowed**: Enables sibling collaboration
- **Project ownership**: Creator maintains admin privileges

### Subscription Model
- **Year 1**: Full interactive service
- **Post-subscription**: Archival mode (read-only, export available)
- **Renewal**: Option to reactivate interactive features

## Error Handling

### Insufficient Resources
```typescript
class InsufficientResourcesError extends Error {
  constructor(resourceType: string, required: number, available: number) {
    super(`Insufficient ${resourceType}: need ${required}, have ${available}`);
  }
}
```

### UI Messaging
- **Clear explanations**: "You need 1 Facilitator Seat to invite a co-facilitator"
- **Purchase options**: Direct links to buy additional seats
- **Resource status**: Always visible in UI

## Analytics & Metrics

### Business Intelligence
- **Seat utilization rates**: Track usage patterns
- **Collaboration metrics**: Multi-facilitator project success
- **Purchase conversion**: From resource depletion to purchase

### User Behavior
- **Resource awareness**: Do users understand the model?
- **Purchase timing**: When do users buy additional seats?
- **Collaboration patterns**: How do families use multiple facilitators?

## Testing Strategy

### Unit Tests
- Resource wallet operations
- Seat consumption logic
- Package credit calculations

### Integration Tests
- End-to-end invitation flows
- Payment to resource credit flow
- Multi-user collaboration scenarios

### Business Logic Tests
- Edge cases: expired invitations, failed payments
- Concurrency: simultaneous seat consumption
- Audit trail: transaction logging accuracy