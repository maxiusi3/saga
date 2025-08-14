# Authentication System v1.5 Documentation

## Overview

The Saga v1.5 authentication system has been updated to support the unified user account model with automatic resource wallet creation and project-specific roles. This document outlines the key changes and new functionality.

## Key Changes from Previous Version

### 1. Unified User Account Model
- **Removed global role field**: Users no longer have a global role (facilitator/storyteller)
- **Project-specific roles**: Roles are now assigned per project through the `project_roles` table
- **Single identity**: One user account can have different roles across different projects

### 2. Automatic Resource Wallet Creation
- **Wallet creation**: Every new user automatically receives a resource wallet upon registration
- **Default credits**: New users can receive default package credits (configurable via environment variables)
- **Atomic operations**: User and wallet creation happens in a single database transaction

### 3. Enhanced Authentication Middleware
- **Project role checking**: New `requireProjectRole` middleware for project-specific authorization
- **Wallet information**: Optional `includeWallet` middleware to include wallet data in responses
- **Backward compatibility**: Existing middleware continues to work with updated logic

## API Endpoints

### User Profile Endpoints

#### GET /api/users/me/profile
Returns user profile with wallet information.

**Response:**
```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-01T00:00:00Z",
  "resource_wallet": {
    "project_vouchers": 1,
    "facilitator_seats": 2,
    "storyteller_seats": 2,
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /api/users/me/wallet
Returns wallet balance information.

**Response:**
```json
{
  "project_vouchers": 1,
  "facilitator_seats": 2,
  "storyteller_seats": 2
}
```

#### GET /api/users/me/transactions
Returns transaction history with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "transactions": [
    {
      "id": "transaction-uuid",
      "transaction_type": "consume",
      "resource_type": "project_voucher",
      "amount": -1,
      "project_id": "project-uuid",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

## Authentication Service Methods

### Core Methods

#### `AuthService.signup(userData: CreateUserInput): Promise<AuthResult>`
Creates a new user with automatic wallet creation.

**Features:**
- Atomic user and wallet creation
- Default credit assignment (if configured)
- OAuth integration support
- Comprehensive error handling

#### `AuthService.getUserProfile(userId: string): Promise<UserProfile>`
Returns user profile with wallet information.

#### `AuthService.getWalletBalance(userId: string): Promise<ResourceBalance>`
Returns current wallet balance.

#### `AuthService.hasResources(userId: string, resourceType: string, amount: number): Promise<boolean>`
Checks if user has sufficient resources.

**Resource Types:**
- `project_voucher`
- `facilitator_seat`
- `storyteller_seat`

## Middleware

### `requireProjectRole(roles: string[])`
Validates that the authenticated user has one of the specified roles in the project.

**Usage:**
```typescript
router.get('/api/projects/:id/stories', 
  requireAuth,
  requireProjectRole(['facilitator', 'storyteller']),
  storyController.getProjectStories
);
```

### `includeWallet(req: Request, res: Response, next: NextFunction)`
Optionally includes wallet information in the user object.

**Usage:**
```typescript
router.get('/api/users/me/profile',
  requireAuth,
  includeWallet,
  userController.getProfile
);
```

### `requireProjectAccess(req: Request, res: Response, next: NextFunction)`
Updated to use project-specific roles instead of global roles.

## Database Models

### ResourceWalletModel

#### Static Methods
- `createWallet(userId: string, initialCredits?: Partial<ResourceBalance>): Promise<ResourceWallet>`
- `getWallet(userId: string): Promise<ResourceWallet | null>`
- `updateBalance(userId: string, updates: Partial<ResourceBalance>): Promise<ResourceWallet>`
- `consumeResource(userId: string, resourceType: string, amount: number, projectId?: string): Promise<boolean>`
- `creditResource(userId: string, resourceType: string, amount: number, reason?: string): Promise<void>`

#### Instance Methods
- `getBalance(): ResourceBalance`
- `hasResource(resourceType: string, amount: number): boolean`
- `getTransactionHistory(options?: PaginationOptions): Promise<PaginatedResult<SeatTransaction>>`

### SeatTransactionModel

#### Static Methods
- `logTransaction(data: CreateTransactionData): Promise<SeatTransaction>`
- `getUserTransactions(userId: string, options?: PaginationOptions): Promise<PaginatedResult<SeatTransaction>>`

## Environment Variables

### Default Credits Configuration
```env
# Default credits for new users (optional)
DEFAULT_PROJECT_VOUCHERS=1
DEFAULT_FACILITATOR_SEATS=2
DEFAULT_STORYTELLER_SEATS=2
```

### Wallet Configuration
```env
# Maximum wallet limits (optional)
MAX_PROJECT_VOUCHERS=10
MAX_FACILITATOR_SEATS=20
MAX_STORYTELLER_SEATS=20
```

## Error Handling

### Common Error Types

#### `InsufficientResourcesError`
Thrown when user doesn't have enough resources for an operation.

```typescript
{
  "error": "INSUFFICIENT_RESOURCES",
  "message": "Insufficient project_voucher: need 1, have 0",
  "code": 400
}
```

#### `WalletNotFoundError`
Thrown when user's wallet cannot be found.

```typescript
{
  "error": "WALLET_NOT_FOUND",
  "message": "Resource wallet not found for user",
  "code": 404
}
```

## Testing

### Unit Tests
- Authentication service methods
- Resource wallet operations
- Middleware functionality
- Error handling scenarios

### Integration Tests
- User registration with wallet creation
- API endpoint responses
- Transaction logging
- Cross-platform compatibility

### Test Coverage
- Target: >80% coverage for authentication code
- Includes edge cases and error scenarios
- Mocks external dependencies

## Migration Guide

### From Previous Version

1. **Database Migration**: Run v1.5 migrations to update schema
2. **Code Updates**: Update imports to use new shared types
3. **API Changes**: Update client code to use new endpoint responses
4. **Role Checking**: Replace global role checks with project-specific ones

### Breaking Changes
- User model no longer includes global `role` field
- Authentication responses now include wallet information
- Project access requires project-specific role validation

## Security Considerations

### Resource Protection
- All wallet operations are atomic
- Transaction logging provides audit trail
- Resource consumption is validated before operations

### Access Control
- Project-specific role enforcement
- JWT token validation
- Rate limiting on sensitive endpoints

### Data Privacy
- Wallet information only accessible to user
- Transaction history is user-specific
- Secure token generation for invitations

## Performance Optimizations

### Database Queries
- Optimized indexes for wallet operations
- Efficient transaction history queries
- Cached wallet balance lookups

### API Response Times
- Wallet information included in single query
- Pagination for transaction history
- Minimal data transfer

## Monitoring and Analytics

### Key Metrics
- User registration success rate
- Wallet creation success rate
- Resource consumption patterns
- Authentication failure rates

### Logging
- All wallet operations logged
- Authentication events tracked
- Error rates monitored
- Performance metrics collected

## Future Enhancements

### Planned Features
- Wallet transfer between users
- Resource expiration dates
- Bulk resource operations
- Advanced analytics dashboard

### Scalability Considerations
- Horizontal scaling support
- Caching layer for wallet data
- Async processing for heavy operations
- Multi-region deployment support