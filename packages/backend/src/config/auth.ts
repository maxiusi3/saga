import jwt from 'jsonwebtoken'
import { User } from '@saga/shared'

export interface JWTPayload {
  userId: string
  email?: string
  name: string
  iat?: number
  exp?: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class AuthConfig {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'
  private static readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

  static generateTokens(user: User): TokenPair {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
    }

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    })

    const refreshToken = jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN,
    })

    // Calculate expiration time in seconds
    const expiresIn = this.parseExpirationTime(this.JWT_EXPIRES_IN)

    return {
      accessToken,
      refreshToken,
      expiresIn,
    }
  }

  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload
    } catch (error) {
      throw new Error('Invalid access token')
    }
  }

  static verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_REFRESH_SECRET) as JWTPayload
    } catch (error) {
      throw new Error('Invalid refresh token')
    }
  }

  static refreshAccessToken(refreshToken: string): string {
    const payload = this.verifyRefreshToken(refreshToken)
    
    // Create new access token with fresh expiration
    const newPayload: JWTPayload = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    }

    return jwt.sign(newPayload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    })
  }

  private static parseExpirationTime(expiration: string): number {
    // Convert expiration string to seconds
    const match = expiration.match(/^(\d+)([smhd])$/)
    if (!match) return 900 // Default 15 minutes

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 60 * 60
      case 'd': return value * 60 * 60 * 24
      default: return 900
    }
  }
}