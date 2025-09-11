/**
 * 应用配置管理
 * 根据环境自动选择正确的URL和配置
 */

// 获取当前环境的基础URL
export function getBaseUrl(): string {
  // 在服务器端
  if (typeof window === 'undefined') {
    // 生产环境
    if (process.env.NODE_ENV === 'production') {
      // 优先使用自定义域名，否则使用Vercel域名
      return process.env.NEXT_PUBLIC_SITE_URL || 'https://saga-web.vercel.app'
    }
    // 开发环境
    return 'http://localhost:3000'
  }
  
  // 在客户端，使用当前域名
  return window.location.origin
}

// 获取认证回调URL
export function getAuthCallbackUrl(): string {
  return `${getBaseUrl()}/auth/callback`
}

// 获取邮箱验证URL
export function getEmailVerifyUrl(): string {
  return `${getBaseUrl()}/auth/verify`
}

// Supabase配置
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}

// 应用配置
export const appConfig = {
  name: 'Saga - 家族传记平台',
  description: '记录和分享您的家族故事',
  baseUrl: getBaseUrl(),
  authCallbackUrl: getAuthCallbackUrl(),
  emailVerifyUrl: getEmailVerifyUrl(),
}

// 环境变量配置验证
interface ConfigValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateConfig(): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 必需的环境变量
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  // 服务端必需的环境变量
  const serverRequiredEnvVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY',
  ]

  // 可选但推荐的环境变量
  const optionalEnvVars = [
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_ANALYTICS_ID',
    'NEXT_PUBLIC_SENTRY_DSN',
  ]

  // 检查必需的环境变量
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    } else if (process.env[envVar]?.includes('your_') || process.env[envVar]?.includes('_here')) {
      errors.push(`Environment variable ${envVar} contains placeholder value`)
    }
  })

  // 检查服务端必需的环境变量（仅在服务端）
  if (typeof window === 'undefined') {
    serverRequiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        errors.push(`Missing required server environment variable: ${envVar}`)
      } else if (process.env[envVar]?.includes('your_') || process.env[envVar]?.includes('_here')) {
        errors.push(`Server environment variable ${envVar} contains placeholder value`)
      }
    })
  }

  // 检查可选环境变量
  optionalEnvVars.forEach(envVar => {
    if (!process.env[envVar] || process.env[envVar]?.trim() === '') {
      warnings.push(`Optional environment variable ${envVar} is not configured`)
    }
  })

  // 验证 Supabase URL 格式
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL format is invalid (should be https://xxx.supabase.co)')
  }

  // 验证 OpenRouter API Key 格式
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey && !openrouterKey.startsWith('sk-or-v1-')) {
    errors.push('OPENROUTER_API_KEY format is invalid (should start with sk-or-v1-)')
  }

  // 检查环境特定配置
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production') {
    // 生产环境额外检查
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      warnings.push('NEXT_PUBLIC_SENTRY_DSN not configured for production error tracking')
    }
    if (!process.env.NEXT_PUBLIC_ANALYTICS_ID) {
      warnings.push('NEXT_PUBLIC_ANALYTICS_ID not configured for production analytics')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// 在应用启动时验证配置
export function validateConfigOnStartup() {
  const result = validateConfig()

  if (!result.isValid) {
    console.error('❌ Configuration validation failed:')
    result.errors.forEach(error => console.error(`  - ${error}`))
    throw new Error('Invalid configuration. Please check your environment variables.')
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:')
    result.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  console.log('✅ Configuration validation passed')
  return result
}

// 在应用启动时验证配置
if (typeof window === 'undefined') {
  validateConfig()
}
