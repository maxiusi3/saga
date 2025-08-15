export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Vercel Analytics
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('track', event, properties)
    }
    
    // 开发环境日志
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event, properties)
    }
  },
  
  // 业务关键事件
  userRegistered: (userId: string) => {
    analytics.track('User Registered', { userId })
  },
  
  projectCreated: (projectId: string, userId: string) => {
    analytics.track('Project Created', { projectId, userId })
  },
  
  storyRecorded: (storyId: string, duration: number) => {
    analytics.track('Story Recorded', { storyId, duration })
  },
  
  paymentCompleted: (amount: number, currency: string) => {
    analytics.track('Payment Completed', { amount, currency })
  }
}
