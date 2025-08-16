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

// 验证必要的环境变量
export function validateConfig() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

// 在应用启动时验证配置
if (typeof window === 'undefined') {
  validateConfig()
}
