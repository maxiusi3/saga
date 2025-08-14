/**
 * Extended seat transaction system types
 * Handles advanced resource wallet transactions and operations
 */
import type { ResourceType, TransactionType, SeatTransaction } from './resource-wallet';

/**
 * Detailed seat transaction with user information
 */
export interface SeatTransactionWithUser {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  transactionType: TransactionType;
  resourceType: ResourceType;
  amount: number;
  projectId?: string;
  project?: {
    id: string;
    name: string;
  };
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Transaction history query parameters
 */
export interface TransactionHistoryQuery {
  userId?: string;
  projectId?: string;
  resourceType?: ResourceType;
  transactionType?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Transaction history response
 */
export interface TransactionHistoryResponse {
  transactions: SeatTransactionWithUser[];
  total: number;
  hasMore: boolean;
}