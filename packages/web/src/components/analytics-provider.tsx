'use client'

import { useEffect, useState } from 'react'

/**
 * 安全的Analytics提供者，防止水合错误
 * 暂时禁用Vercel Analytics直到项目正确配置
 */
export function AnalyticsProvider() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // 基础的页面访问跟踪
    if (typeof window !== 'undefined') {
      console.log('Page loaded:', window.location.href)

      // 可以在这里添加其他分析代码
      // 例如：Google Analytics, 自定义分析等
    }
  }, [])

  // 只在客户端渲染
  if (!isClient) {
    return null
  }

  // 暂时返回空，避免Vercel Analytics错误
  // 当Vercel项目正确配置Analytics后，可以重新启用
  return null

  // 未来重新启用时使用：
  // return (
  //   <>
  //     <Analytics />
  //     <SpeedInsights />
  //   </>
  // )
}
