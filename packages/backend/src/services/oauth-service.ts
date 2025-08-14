import axios from 'axios'
import { createError } from '../middleware/error-handler'

export interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture?: string
  verified_email: boolean
}

export interface AppleUserInfo {
  sub: string
  email?: string
  name?: {
    firstName?: string
    lastName?: string
  }
  email_verified?: boolean
}

export class OAuthService {
  static async verifyGoogleToken(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      )

      const userInfo: GoogleUserInfo = response.data

      if (!userInfo.verified_email) {
        throw createError('Google email not verified', 400, 'EMAIL_NOT_VERIFIED')
      }

      return userInfo
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw createError('Invalid Google access token', 401, 'INVALID_GOOGLE_TOKEN')
        }
        throw createError('Failed to verify Google token', 500, 'GOOGLE_VERIFICATION_FAILED')
      }
      throw error
    }
  }

  static async verifyAppleToken(idToken: string): Promise<AppleUserInfo> {
    try {
      // In production, you would verify the Apple ID token using Apple's public keys
      // For now, we'll decode the JWT payload (this is NOT secure for production)
      const payload = this.decodeJWT(idToken)
      
      if (!payload.sub) {
        throw createError('Invalid Apple ID token', 401, 'INVALID_APPLE_TOKEN')
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name ? {
          firstName: payload.name.firstName,
          lastName: payload.name.lastName,
        } : undefined,
        email_verified: payload.email_verified,
      }
    } catch (error) {
      throw createError('Failed to verify Apple token', 500, 'APPLE_VERIFICATION_FAILED')
    }
  }

  static async exchangeGoogleCode(code: string): Promise<string> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      })

      return response.data.access_token
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw createError('Failed to exchange Google code', 400, 'GOOGLE_CODE_EXCHANGE_FAILED')
      }
      throw error
    }
  }

  static generateGoogleAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  static generateAppleAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID || '',
      redirect_uri: process.env.APPLE_REDIRECT_URI || '',
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'form_post',
    })

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`
  }

  private static decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )

      return JSON.parse(jsonPayload)
    } catch (error) {
      throw createError('Invalid JWT token', 400, 'INVALID_JWT')
    }
  }

  // Production implementation would use Apple's public keys to verify the signature
  static async verifyAppleTokenSignature(idToken: string): Promise<boolean> {
    // TODO: Implement proper Apple ID token verification
    // 1. Fetch Apple's public keys from https://appleid.apple.com/auth/keys
    // 2. Verify the token signature using the appropriate key
    // 3. Validate the token claims (iss, aud, exp, etc.)
    
    console.warn('Apple token signature verification not implemented - using placeholder')
    return true
  }
}