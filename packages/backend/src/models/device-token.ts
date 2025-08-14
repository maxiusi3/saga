import { BaseModel } from './base'
import type { DeviceToken, CreateDeviceTokenInput } from '@saga/shared/types'

export class DeviceTokenModel extends BaseModel {
  static tableName = 'device_tokens'

  private static transformDeviceToken(token: any): DeviceToken {
    return {
      id: token.id,
      userId: token.user_id,
      token: token.token,
      platform: token.platform,
      deviceId: token.device_id,
      isActive: token.is_active,
      lastUsedAt: token.last_used_at,
      createdAt: token.created_at,
      updatedAt: token.updated_at,
    }
  }

  static async create(data: CreateDeviceTokenInput): Promise<DeviceToken> {
    // First, deactivate any existing tokens for this user/device combination
    if (data.deviceId) {
      await this.db(this.tableName)
        .where('user_id', data.userId)
        .where('device_id', data.deviceId)
        .update({
          is_active: false,
          updated_at: new Date(),
        })
    }

    const [deviceToken] = await this.db(this.tableName)
      .insert({
        user_id: data.userId,
        token: data.token,
        platform: data.platform,
        device_id: data.deviceId,
        is_active: true,
        last_used_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['user_id', 'token'])
      .merge({
        is_active: true,
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')

    return this.transformDeviceToken(deviceToken)
  }

  static async findByUserId(userId: string, activeOnly = true): Promise<DeviceToken[]> {
    let query = this.db(this.tableName)
      .where('user_id', userId)
      .orderBy('last_used_at', 'desc')

    if (activeOnly) {
      query = query.where('is_active', true)
    }

    const tokens = await query
    return tokens.map(this.transformDeviceToken)
  }

  static async findActiveTokensByUserIds(userIds: string[]): Promise<DeviceToken[]> {
    const tokens = await this.db(this.tableName)
      .whereIn('user_id', userIds)
      .where('is_active', true)
      .orderBy('last_used_at', 'desc')

    return tokens.map(this.transformDeviceToken)
  }

  static async updateLastUsed(token: string): Promise<void> {
    await this.db(this.tableName)
      .where('token', token)
      .update({
        last_used_at: new Date(),
        updated_at: new Date(),
      })
  }

  static async deactivateToken(token: string): Promise<boolean> {
    const updatedCount = await this.db(this.tableName)
      .where('token', token)
      .update({
        is_active: false,
        updated_at: new Date(),
      })

    return updatedCount > 0
  }

  static async deactivateUserTokens(userId: string, platform?: 'ios' | 'android' | 'web'): Promise<number> {
    let query = this.db(this.tableName)
      .where('user_id', userId)

    if (platform) {
      query = query.where('platform', platform)
    }

    const updatedCount = await query.update({
      is_active: false,
      updated_at: new Date(),
    })

    return updatedCount
  }

  static async cleanupInactiveTokens(daysInactive = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

    const deletedCount = await this.db(this.tableName)
      .where('is_active', false)
      .where('updated_at', '<', cutoffDate)
      .del()

    return deletedCount
  }

  static async findByToken(token: string): Promise<DeviceToken | null> {
    const deviceToken = await this.db(this.tableName)
      .where('token', token)
      .where('is_active', true)
      .first()

    return deviceToken ? this.transformDeviceToken(deviceToken) : null
  }

  static async getTokensByPlatform(userIds: string[], platform: 'ios' | 'android' | 'web'): Promise<DeviceToken[]> {
    const tokens = await this.db(this.tableName)
      .whereIn('user_id', userIds)
      .where('platform', platform)
      .where('is_active', true)

    return tokens.map(this.transformDeviceToken)
  }

  static async bulkDeactivateTokens(tokens: string[]): Promise<number> {
    const updatedCount = await this.db(this.tableName)
      .whereIn('token', tokens)
      .update({
        is_active: false,
        updated_at: new Date(),
      })

    return updatedCount
  }
}