'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'react-hot-toast'

function EmailVerificationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientSupabase()
  const { initialize } = useAuthStore()

  const getLocaleFromPath = () => {
    if (typeof window === 'undefined') return 'en'
    const first = (window.location.pathname.split('/')[1] || '').trim()
    const supported = ['en', 'zh-CN', 'zh-TW']
    return supported.includes(first) ? first : 'en'
  }

  const withLocale = (path: string) => {
    const locale = getLocaleFromPath()
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }

  useEffect(() => {
    const handleEmailVerification = async () => {
      // 确保在客户端环境中运行
      if (typeof window === 'undefined') {
        return
      }

      // 检查URL中是否有验证相关的参数
      let hasVerificationParams = false

      try {
        hasVerificationParams = searchParams.has('token') ||
                               searchParams.has('access_token') ||
                               searchParams.has('refresh_token') ||
                               (window.location.hash && window.location.hash.includes('access_token'))
      } catch (error) {
        console.error('Error checking verification params:', error)
        return
      }

      if (!hasVerificationParams) {
        return // 不是验证重定向，正常显示首页
      }

      console.log('=== 邮箱验证处理 ===')
      console.log('URL:', window.location.href)
      console.log('Search params:', Object.fromEntries(searchParams.entries()))
      console.log('Hash:', window.location.hash)

      try {
        // 方法1: 尝试从URL参数获取token
        let token = searchParams.get('token')
        let type = searchParams.get('type') || 'signup'

        // 方法2: 尝试从hash获取access_token
        if (!token && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('Found tokens in hash, setting session...')
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })

            if (error) {
              console.error('Set session error:', error)
              toast.error('邮箱验证失败：' + error.message)
              return
            }

            if (data.session) {
              console.log('Session set successfully:', data.session)
              toast.success('邮箱验证成功！欢迎使用Saga！')
              
              // 重新初始化认证状态
              await initialize()
              
              // 跳转到仪表板（带语言）
              router.push(withLocale('/dashboard'))
              return
            }
          }
        }

        // 方法3: 使用verifyOtp方法
        if (token) {
          console.log('Verifying token with verifyOtp...')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any
          })

          if (error) {
            console.error('Verify OTP error:', error)
            toast.error('邮箱验证失败：' + error.message)
            return
          }

          if (data.user) {
            console.log('OTP verification successful:', data)
            toast.success('邮箱验证成功！欢迎使用Saga！')
            
            // 重新初始化认证状态
            await initialize()
            
            // 跳转到仪表板（带语言）
            router.push(withLocale('/dashboard'))
            return
          }
        }

        // 如果所有方法都失败了
        console.log('No valid verification method found')
        toast.error('邮箱验证链接无效或已过期，请重新注册')
        
      } catch (error) {
        console.error('Email verification error:', error)
        toast.error('邮箱验证过程中发生错误')
      }
    }

    // 延迟执行，确保组件完全挂载和hydration完成
    const timer = setTimeout(handleEmailVerification, 500)
    return () => clearTimeout(timer)
  }, [searchParams, router, supabase.auth, initialize])

  return null // 这个组件不渲染任何内容
}

export function EmailVerificationHandler() {
  return (
    <Suspense fallback={null}>
      <EmailVerificationContent />
    </Suspense>
  )
}
