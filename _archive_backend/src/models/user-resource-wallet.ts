import { BaseModel } from './base';

export interface UserResourceWallet {
  user_id: string;
  project_vouchers: number;
  facilitator_seats: number;
  storyteller_seats: number;
  created_at: Date;
  updated_at: Date;
}

export interface ResourceUsageHistory {
  id: string;
  user_id: string;
  resource_type: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';
  amount: number;
  action: 'consume' | 'purchase' | 'refund';
  project_id?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export class UserResourceWalletModel extends BaseModel {
  protected static tableName = 'user_resource_wallets';

  static async findByUserId(userId: string): Promise<UserResourceWallet | null> {
    return this.query.where('user_id', userId).first();
  }

  static async createForUser(userId: string, initialResources: Partial<UserResourceWallet> = {}): Promise<UserResourceWallet> {
    const defaultWallet: Partial<UserResourceWallet> = {
      user_id: userId,
      project_vouchers: 0,
      facilitator_seats: 0,
      storyteller_seats: 0,
      ...initialResources
    };

    const [result] = await this.query.insert(defaultWallet).returning('*');
    return result;
  }

  static async updateByUserId(userId: string, updates: Partial<UserResourceWallet>): Promise<UserResourceWallet> {
    const [result] = await this.query
      .where('user_id', userId)
      .update({ ...updates, updated_at: new Date() })
      .returning('*');
    return result;
  }

  static async upsertByUserId(userId: string, wallet: Partial<UserResourceWallet>): Promise<UserResourceWallet> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      return this.updateByUserId(userId, wallet);
    } else {
      return this.createForUser(userId, wallet);
    }
  }
}

export class ResourceUsageHistoryModel extends BaseModel {
  protected static tableName = 'resource_usage_history';

  static async findByUserId(userId: string, limit: number = 50): Promise<ResourceUsageHistory[]> {
    return this.query
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  static async logUsage(
    userId: string,
    resourceType: ResourceUsageHistory['resource_type'],
    amount: number,
    action: ResourceUsageHistory['action'],
    projectId?: string,
    description?: string
  ): Promise<ResourceUsageHistory> {
    const [result] = await this.query.insert({
      user_id: userId,
      resource_type: resourceType,
      amount,
      action,
      project_id: projectId,
      description
    }).returning('*');
    
    return result;
  }
}