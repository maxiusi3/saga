declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: () => void
          renderButton: (element: HTMLElement, config: any) => void
          disableAutoSelect: () => void
        }
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void
          }
        }
      }
    }
    AppleID?: {
      auth: {
        init: (config: any) => void
        signIn: () => Promise<any>
      }
    }
  }
}

export interface GoogleOAuthConfig {
  clientId: string
  onSuccess: (accessToken: string) => void
  onError: (error: string) => void
}

export interface AppleOAuthConfig {
  clientId: string
  redirectURI: string
  onSuccess: (idToken: string, user?: any) => void
  onError: (error: string) => void
}

export class OAuthUtils {
  private static googleScriptLoaded = false
  private static appleScriptLoaded = false

  static async loadGoogleScript(): Promise<void> {
    if (this.googleScriptLoaded) return

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        this.googleScriptLoaded = true
        resolve()
      }
      script.onerror = () => reject(new Error('Failed to load Google OAuth script'))
      document.head.appendChild(script)
    })
  }

  static async loadAppleScript(): Promise<void> {
    if (this.appleScriptLoaded) return

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.async = true
      script.onload = () => {
        this.appleScriptLoaded = true
        resolve()
      }
      script.onerror = () => reject(new Error('Failed to load Apple OAuth script'))
      document.head.appendChild(script)
    })
  }

  static async initializeGoogleOAuth(config: GoogleOAuthConfig): Promise<void> {
    await this.loadGoogleScript()

    if (!window.google) {
      throw new Error('Google OAuth library not loaded')
    }

    // Initialize OAuth2 client for access token
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: 'openid email profile',
      callback: (response: any) => {
        if (response.error) {
          config.onError(response.error)
          return
        }
        config.onSuccess(response.access_token)
      },
    })

    return client
  }

  static async initializeAppleOAuth(config: AppleOAuthConfig): Promise<void> {
    await this.loadAppleScript()

    if (!window.AppleID) {
      throw new Error('Apple OAuth library not loaded')
    }

    window.AppleID.auth.init({
      clientId: config.clientId,
      scope: 'name email',
      redirectURI: config.redirectURI,
      usePopup: true,
    })
  }

  static async signInWithGoogle(config: GoogleOAuthConfig): Promise<void> {
    const client = await this.initializeGoogleOAuth(config)
    client.requestAccessToken()
  }

  static async signInWithApple(config: AppleOAuthConfig): Promise<void> {
    await this.initializeAppleOAuth(config)

    try {
      const data = await window.AppleID!.auth.signIn()
      config.onSuccess(data.authorization.id_token, data.user)
    } catch (error: any) {
      config.onError(error.error || 'Apple sign in failed')
    }
  }

  static renderGoogleButton(
    element: HTMLElement,
    config: GoogleOAuthConfig & {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
    }
  ): void {
    this.loadGoogleScript().then(() => {
      if (!window.google) return

      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: (response: any) => {
          if (response.error) {
            config.onError(response.error)
            return
          }
          // For ID token flow, we need to exchange for access token
          // For simplicity, we'll use the OAuth2 flow instead
        },
      })

      window.google.accounts.id.renderButton(element, {
        theme: config.theme || 'outline',
        size: config.size || 'large',
        text: config.text || 'signin_with',
        shape: config.shape || 'rectangular',
        width: element.offsetWidth,
      })
    })
  }
}

// Environment variables
export const OAUTH_CONFIG = {
  google: {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  },
  apple: {
    clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || '',
    redirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || (typeof window !== 'undefined' ? `${window.location.origin}/auth/apple/callback` : ''),
  },
}