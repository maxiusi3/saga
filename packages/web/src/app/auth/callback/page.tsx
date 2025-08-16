'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClientSupabase()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 首先尝试从URL hash中获取session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Auth callback error:', sessionError)
          router.push('/auth/signin?error=callback_error')
          return
        }

        // 如果URL中有token参数，处理它们
        let hashParams: URLSearchParams | null = null
        let accessToken: string | null = null
        let refreshToken: string | null = null

        try {
          if (window.location.hash && window.location.hash.length > 1) {
            hashParams = new URLSearchParams(window.location.hash.substring(1))
            accessToken = hashParams.get('access_token')
            refreshToken = hashParams.get('refresh_token')
          }
        } catch (error) {
          console.error('Error parsing URL hash:', error)
        }

        if (accessToken && refreshToken) {
          // 设置session
          const { data: authData, error: authError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (authError) {
            console.error('Set session error:', authError)
            router.push('/auth/signin?error=session_error')
            return
          }

          if (authData.session) {
            console.log('Email verification successful!')
            router.push('/dashboard?verified=true')
            return
          }
        }

        if (sessionData.session) {
          // 用户已登录，重定向到仪表板
          router.push('/dashboard')
        } else {
          // 没有会话，重定向到登录页面
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        router.push('/auth/signin?error=unexpected_error')
      }
    }

    handleAuthCallback()
  }, [router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">正在处理登录...</p>
      </div>
    </div>
  )
}