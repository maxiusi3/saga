import { UserModel } from '../models/user'
import { ResourceWalletModel } from '../models/resource-wallet'
import { AuthConfig } from '../config/auth'
import { redisClient } from '../config/redis'
import { createError } from '../middleware/error-handler'
import { User, CreateUserInput, AuthResult, ResourceBalance } from '@saga/shared'
import { validateEmail, validatePhone, validatePassword } from '@saga/shared'

export class AuthService {
  static async signUp(userData: CreateUserInput): Promise<AuthResult> {
    // Validate input
    if (userData.email && !validateEmail(userData.email)) {
      throw createError('Invalid email format', 400, 'INVALID_EMAIL')
    }

    if (userData.phone && !validatePhone(userData.phone)) {
      throw createError('Invalid phone format', 400, 'INVALID_PHONE')
    }

    if (userData.password && !validatePassword(userData.password)) {
      throw createError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD')
    }

    if (!userData.name || userData.name.trim().length < 2) {
      throw createError('Name must be at least 2 characters', 400, 'INVALID_NAME')
    }

    // Check if user already exists
    if (userData.email) {
      const existingUser = await UserModel.findByEmail(userData.email)
      if (existingUser) {
        throw createError('User with this email already exists', 409, 'EMAIL_EXISTS')
      }
    }

    if (userData.phone) {
      const existingUser = await UserModel.findByPhone(userData.phone)
      if (existingUser) {
        throw createError('User with this phone already exists', 409, 'PHONE_EXISTS')
      }
    }

    try {
      // Create user and resource wallet in transaction
      const user = await UserModel.db.transaction(async (trx) => {
        // Create user
        const newUser = await UserModel.query(trx).insert({
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          oauth_provider: userData.oauthProvider,
          oauth_id: userData.oauthId,
          password_hash: userData.password ? await require('bcryptjs').hash(userData.password, 12) : undefined,
        }).returning('*').first();

        // Create resource wallet with default credits
        const defaultCredits = this.getDefaultCredits();
        await ResourceWalletModel.query(trx).insert({
          user_id: newUser.id,
          project_vouchers: defaultCredits.project_vouchers,
          facilitator_seats: defaultCredits.facilitator_seats,
          storyteller_seats: defaultCredits.storyteller_seats,
        });

        return newUser;
      });

      const tokens = AuthConfig.generateTokens(user)

      // Store refresh token in Redis
      await this.storeRefreshToken(user.id, tokens.refreshToken)

      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      }
    } catch (error: any) {
      // Handle database constraint errors
      if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.constraint?.includes('email') || error.message?.includes('email')) {
          throw createError('User with this email already exists', 409, 'EMAIL_EXISTS')
        }
        if (error.constraint?.includes('phone') || error.message?.includes('phone')) {
          throw createError('User with this phone already exists', 409, 'PHONE_EXISTS')
        }
        throw createError('User already exists', 409, 'USER_EXISTS')
      }
      throw error
    }
  }

  static async signIn(identifier: string, password: string): Promise<AuthResult> {
    // Find user by email or phone
    let user: User | undefined

    if (validateEmail(identifier)) {
      user = await UserModel.findByEmail(identifier)
    } else if (validatePhone(identifier)) {
      user = await UserModel.findByPhone(identifier)
    } else {
      throw createError('Invalid email or phone format', 400, 'INVALID_IDENTIFIER')
    }

    if (!user) {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(user, password)
    if (!isValidPassword) {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Generate tokens
    const tokens = AuthConfig.generateTokens(user)

    // Store refresh token in Redis
    await this.storeRefreshToken(user.id, tokens.refreshToken)

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    }
  }

  static async signInWithOAuth(
    provider: 'google' | 'apple',
    oauthId: string,
    userData: {
      name: string
      email?: string
    }
  ): Promise<AuthResult> {
    // Find existing user by OAuth credentials
    let user = await UserModel.findByOAuth(provider, oauthId)

    if (!user) {
      // Check if user exists with same email
      if (userData.email) {
        const existingUser = await UserModel.findByEmail(userData.email)
        if (existingUser) {
          throw createError(
            'An account with this email already exists. Please sign in with your password.',
            409,
            'EMAIL_EXISTS'
          )
        }
      }

      // Create new user with resource wallet
      user = await UserModel.db.transaction(async (trx) => {
        // Create user
        const newUser = await UserModel.query(trx).insert({
          name: userData.name,
          email: userData.email,
          oauth_provider: provider,
          oauth_id: oauthId,
        }).returning('*').first();

        // Create resource wallet with default credits
        const defaultCredits = this.getDefaultCredits();
        await ResourceWalletModel.query(trx).insert({
          user_id: newUser.id,
          project_vouchers: defaultCredits.project_vouchers,
          facilitator_seats: defaultCredits.facilitator_seats,
          storyteller_seats: defaultCredits.storyteller_seats,
        });

        return newUser;
      });
    }

    // Generate tokens
    const tokens = AuthConfig.generateTokens(user)

    // Store refresh token in Redis
    await this.storeRefreshToken(user.id, tokens.refreshToken)

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    }
  }

  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verify refresh token
      const payload = AuthConfig.verifyRefreshToken(refreshToken)

      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${payload.userId}`)
      if (!storedToken || storedToken !== refreshToken) {
        throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
      }

      // Verify user still exists
      const user = await UserModel.findById(payload.userId)
      if (!user) {
        throw createError('User not found', 401, 'USER_NOT_FOUND')
      }

      // Generate new access token
      const accessToken = AuthConfig.refreshAccessToken(refreshToken)
      const expiresIn = 900 // 15 minutes in seconds

      return {
        accessToken,
        expiresIn,
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('jwt expired')) {
        throw createError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED')
      }
      throw error
    }
  }

  static async signOut(userId: string, refreshToken?: string): Promise<void> {
    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${userId}`)

    // Optionally, add access token to blacklist (for immediate invalidation)
    // This would require storing all active access tokens, which might not be practical
    // Instead, we rely on short access token expiration times
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Validate new password
    if (!validatePassword(newPassword)) {
      throw createError('New password must be at least 8 characters', 400, 'WEAK_PASSWORD')
    }

    // Get user
    const user = await UserModel.findById(userId)
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND')
    }

    // Verify current password
    const isValidPassword = await UserModel.verifyPassword(user, currentPassword)
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD')
    }

    // Update password
    await UserModel.updatePassword(userId, newPassword)

    // Invalidate all refresh tokens for this user
    await redisClient.del(`refresh_token:${userId}`)
  }

  static async resetPassword(identifier: string): Promise<void> {
    // Find user
    let user: User | undefined

    if (validateEmail(identifier)) {
      user = await UserModel.findByEmail(identifier)
    } else if (validatePhone(identifier)) {
      user = await UserModel.findByPhone(identifier)
    } else {
      throw createError('Invalid email or phone format', 400, 'INVALID_IDENTIFIER')
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      return
    }

    // Generate reset token (implement email/SMS sending in production)
    const resetToken = AuthConfig.generateTokens(user).accessToken
    
    // Store reset token in Redis with short expiration (15 minutes)
    await redisClient.setEx(`reset_token:${user.id}`, 900, resetToken)

    // TODO: Send reset token via email or SMS
    console.log(`Password reset token for ${user.id}: ${resetToken}`)
  }

  static async confirmPasswordReset(resetToken: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const payload = AuthConfig.verifyAccessToken(resetToken)

      // Check if reset token exists in Redis
      const storedToken = await redisClient.get(`reset_token:${payload.userId}`)
      if (!storedToken || storedToken !== resetToken) {
        throw createError('Invalid or expired reset token', 401, 'INVALID_RESET_TOKEN')
      }

      // Validate new password
      if (!validatePassword(newPassword)) {
        throw createError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD')
      }

      // Update password
      await UserModel.updatePassword(payload.userId, newPassword)

      // Remove reset token
      await redisClient.del(`reset_token:${payload.userId}`)

      // Invalidate all refresh tokens for this user
      await redisClient.del(`refresh_token:${payload.userId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('jwt expired')) {
        throw createError('Reset token expired', 401, 'RESET_TOKEN_EXPIRED')
      }
      throw error
    }
  }

  /**
   * Get user profile with wallet information
   */
  static async getUserProfile(userId: string): Promise<any> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const wallet = await ResourceWalletModel.getWallet(userId);
    
    return {
      ...user,
      resource_wallet: wallet,
    };
  }

  /**
   * Get wallet balance for user
   */
  static async getWalletBalance(userId: string): Promise<ResourceBalance> {
    return ResourceWalletModel.getBalance(userId);
  }

  /**
   * Check if user has sufficient resources
   */
  static async hasResources(userId: string, resourceType: string, amount: number): Promise<boolean> {
    return ResourceWalletModel.hasResources(userId, {
      resource_type: resourceType as any,
      amount,
      project_id: '', // Not needed for balance check
    });
  }

  /**
   * Get default credits for new users
   */
  private static getDefaultCredits(): ResourceBalance {
    // These could be configurable via environment variables
    return {
      project_vouchers: parseInt(process.env.DEFAULT_PROJECT_VOUCHERS || '0'),
      facilitator_seats: parseInt(process.env.DEFAULT_FACILITATOR_SEATS || '0'),
      storyteller_seats: parseInt(process.env.DEFAULT_STORYTELLER_SEATS || '0'),
    };
  }

  private static async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Store refresh token in Redis with expiration matching JWT expiration
    const expirationSeconds = 7 * 24 * 60 * 60 // 7 days
    await redisClient.setEx(`refresh_token:${userId}`, expirationSeconds, refreshToken)
  }
}