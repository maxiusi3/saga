export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data)
  },
  
  error: (message: string, error?: Error, data?: any) => {
    console.error(`[ERROR] ${message}`, error, data)
    
    // 发送到Sentry（仅在浏览器环境）
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error || new Error(message), {
          extra: data
        })
      }).catch(() => {
        // Sentry未配置时忽略错误
      })
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data)
  }
}
