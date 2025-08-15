import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // 发送到Vercel Analytics
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('track', 'Web Vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    })
  }
  
  // 发送到控制台（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vital:', metric)
  }
}

export function reportWebVitals() {
  getCLS(sendToAnalytics)
  getFID(sendToAnalytics)
  getFCP(sendToAnalytics)
  getLCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}
