import { BaseModel } from './base';
import { UserResourceWallet, SeatTransaction, ResourceBalance, ResourceUsage } from '@saga/shared';

export class ResourceWalletModel extends BaseModel {
  protected static tableName = 'user_resource_wallets';

  /**
   * Get user's resource wallet
   */
  static async getWallet(userId: string): Promise<UserResourceWallet | undefined> {
    return this.query().where('user_id', userId).first();
  }

  /**
   * Create initial resource wallet for new user
   */
  static async createWallet(userId: string, initialCredits?: Partial<ResourceBalance>): Promise<UserResourceWallet> {
    const walletData = {
      user_id: userId,
      project_vouchers: initialCredits?.project_vouchers || 0,
      facilitator_seats: initialCredits?.facilitator_seats || 0,
      storyteller_seats: initialCredits?.storyteller_seats || 0,
    };

    return this.create(walletData);
  }

  /**
   * Get current resource balance
   */
  static async getBalance(userId: string): Promise<ResourceBalance> {
    const wallet = await this.getWallet(userId);
    
    if (!wallet) {
      throw new Error('Resource wallet not found');
    }

    return {
      project_vouchers: wallet.project_vouchers,
      facilitator_seats: wallet.facilitator_seats,
      storyteller_seats: wallet.storyteller_seats,
    };
  }

  /**
   * Check if user has sufficient resources
   */
  static async hasResources(userId: string, required: ResourceUsage): Promise<boolean> {
    const balance = await this.getBalance(userId);
    
    switch (required.resource_type) {
      case 'project_voucher':
        return balance.project_vouchers >= Math.abs(required.amount);
      case 'facilitator_seat':
        return balance.facilitator_seats >= Math.abs(required.amount);
      case 'storyteller_seat':
        return balance.storyteller_seats >= Math.abs(required.amount);
      default:
        return false;
    }
  }

  /**
   * Consume resources atomically
   */
  static async consumeResources(userId: string, usage: ResourceUsage): Promise<UserResourceWallet> {
    return this.db.transaction(async (trx) => {
      // Get current wallet with row lock
      const wallet = await this.query(trx)
        .where('user_id', userId)
        .forUpdate()
        .first();

      if (!wallet) {
        throw new Error('Resource wallet not found');
      }

      // Check if sufficient resources
      const hasEnough = await this.hasResources(userId, usage);
      if (!hasEnough) {
        throw new Error(`Insufficient ${usage.resource_type.replace('_', ' ')}s`);
      }

      // Calculate new balance
      const updates: Partial<UserResourceWallet> = {};
      switch (usage.resource_type) {
        case 'project_voucher':
          updates.project_vouchers = wallet.project_vouchers - Math.abs(usage.amount);
          break;
        case 'facilitator_seat':
          updates.facilitator_seats = wallet.facilitator_seats - Math.abs(usage.amount);
          break;
        case 'storyteller_seat':
          updates.storyteller_seats = wallet.storyteller_seats - Math.abs(usage.amount);
          break;
      }

      // Update wallet
      const updatedWallet = await this.query(trx)
        .where('user_id', userId)
        .update(updates)
        .returning('*')
        .first();

      // Log transaction
      await SeatTransactionModel.logTransaction(trx, {
        user_id: userId,
        transaction_type: 'consume',
        resource_type: usage.resource_type,
        amount: -Math.abs(usage.amount), // Negative for consumption
        project_id: usage.project_id,
      });

      return updatedWallet;
    });
  }

  /**
   * Credit resources (for purchases or refunds)
   */
  static async creditResources(
    userId: string, 
    resourceType: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat',
    amount: number,
    transactionType: 'purchase' | 'refund' = 'purchase'
  ): Promise<UserResourceWallet> {
    return this.db.transaction(async (trx) => {
      // Get current wallet with row lock
      const wallet = await this.query(trx)
        .where('user_id', userId)
        .forUpdate()
        .first();

      if (!wallet) {
        throw new Error('Resource wallet not found');
      }

      // Calculate new balance
      const updates: Partial<UserResourceWallet> = {};
      switch (resourceType) {
        case 'project_voucher':
          updates.project_vouchers = wallet.project_vouchers + amount;
          break;
        case 'facilitator_seat':
          updates.facilitator_seats = wallet.facilitator_seats + amount;
          break;
        case 'storyteller_seat':
          updates.storyteller_seats = wallet.storyteller_seats + amount;
          break;
      }

      // Update wallet
      const updatedWallet = await this.query(trx)
        .where('user_id', userId)
        .update(updates)
        .returning('*')
        .first();

      // Log transaction
      await SeatTransactionModel.logTransaction(trx, {
        user_id: userId,
        transaction_type: transactionType,
        resource_type: resourceType,
        amount: amount, // Positive for credit
      });

      return updatedWallet;
    });
  }
}

export class SeatTransactionModel extends BaseModel {
  protected static tableName = 'seat_transactions';

  /**
   * Log a seat transaction
   */
  static async logTransaction(
    trx: any,
    transaction: Omit<SeatTransaction, 'id' | 'created_at'>
  ): Promise<SeatTransaction> {
    return this.query(trx).insert(transaction).returning('*').first();
  }

  /**
   * Get transaction history for user
   */
  static async getTransactionHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<SeatTransaction[]> {
    return this.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get transactions for a specific project
   */
  static async getProjectTransactions(projectId: string): Promise<SeatTransaction[]> {
    return this.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc');
  }
}