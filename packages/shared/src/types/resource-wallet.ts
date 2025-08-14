/**
 * User resource wallet for package/seat business model
 * Tracks available resources for project creation and collaboration
 */
export interface UserResourceWallet {
  /** Unique wallet ID */
  id: string;
  /** User ID this wallet belongs to */
  userId: string;
  /** Number of project vouchers available */
  projectVouchers: number;
  /** Number of facilitator seats available */
  facilitatorSeats: number;
  /** Number of storyteller seats available */
  storytellerSeats: number;
  /** Wallet creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Input for creating a resource wallet
 */
export interface CreateResourceWalletInput {
  userId: string;
  projectVouchers?: number;
  facilitatorSeats?: number;
  storytellerSeats?: number;
}

/**
 * Input for updating a resource wallet
 */
export interface UpdateResourceWalletInput {
  projectVouchers?: number;
  facilitatorSeats?: number;
  storytellerSeats?: number;
}

/**
 * Resource types available in the wallet
 */
export type ResourceType = 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';

/**
 * Transaction types for seat operations
 */
export type TransactionType = 'purchase' | 'consume' | 'refund' | 'grant' | 'expire';

/**
 * Audit log for seat transactions
 * Tracks all resource wallet operations for transparency
 */
export interface SeatTransaction {
  /** Unique transaction ID */
  id: string;
  /** User ID who performed the transaction */
  userId: string;
  /** Type of transaction performed */
  transactionType: TransactionType;
  /** Type of resource affected */
  resourceType: ResourceType;
  /** Amount changed (positive for credit, negative for debit) */
  amount: number;
  /** Project ID if transaction is project-related */
  projectId?: string;
  /** Optional description of the transaction */
  description?: string;
  /** Additional metadata for the transaction */
  metadata?: Record<string, any>;
  /** Transaction timestamp */
  createdAt: Date;
}

/**
 * Input for creating a seat transaction
 */
export interface CreateSeatTransactionInput {
  userId: string;
  transactionType: TransactionType;
  resourceType: ResourceType;
  amount: number;
  projectId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Resource wallet balance summary
 */
export interface ResourceWalletBalance {
  projectVouchers: number;
  facilitatorSeats: number;
  storytellerSeats: number;
  totalValue: number;
}

/**
 * Resource consumption request
 */
export interface ResourceConsumptionRequest {
  resourceType: ResourceType;
  amount: number;
  projectId?: string;
  description?: string;
}

/**
 * Resource consumption result
 */
export interface ResourceConsumptionResult {
  success: boolean;
  remainingBalance: number;
  transactionId?: string;
  error?: string;
}

/**
 * Resource package definition
 */
export interface ResourcePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  resources: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Package purchase request
 */
export interface PackagePurchaseRequest {
  packageId: string;
  userId: string;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
}

/**
 * Package purchase result
 */
export interface PackagePurchaseResult {
  success: boolean;
  transactionId?: string;
  walletBalance?: ResourceWalletBalance;
  error?: string;
}

/**
 * Resource wallet statistics
 */
export interface ResourceWalletStats {
  totalUsers: number;
  totalVouchers: number;
  totalFacilitatorSeats: number;
  totalStorytellerSeats: number;
  totalTransactions: number;
  recentTransactions: SeatTransaction[];
}

// Legacy interfaces for backward compatibility
/** @deprecated Use UserResourceWallet instead */
export interface ResourceBalance {
  project_vouchers: number;
  facilitator_seats: number;
  storyteller_seats: number;
}

/** @deprecated Use ResourceConsumptionRequest instead */
export interface ResourceUsage {
  resource_type: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';
  amount: number;
  project_id: string;
}

/** @deprecated Use PackagePurchaseRequest instead */
export interface ResourcePurchaseRequest {
  resource_type: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';
  quantity: number;
}