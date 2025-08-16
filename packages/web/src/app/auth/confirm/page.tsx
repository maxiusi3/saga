'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'

function EmailConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientSupabase()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        console.log('=== 邮箱确认调试信息 ===')
        console.log('Current URL:', window.location.href)
        console.log('Search params:', Object.fromEntries(searchParams.entries()))
        console.log('Hash:', window.location.hash)

        // 尝试多种方式获取验证参数
        let token: string | null = null
        let type: string | null = null

        // 方法1: 从URL参数获取
        token = searchParams.get('token') || searchParams.get('access_token')
        type = searchParams.get('type') || 'signup'

        // 方法2: 从hash获取
        if (!token && window.location.hash) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1))
            token = hashParams.get('access_token') || hashParams.get('token')
            type = hashParams.get('type') || 'signup'
          } catch (error) {
            console.error('Error parsing hash:', error)
          }
        }

        console.log('Extracted token exists:', !!token)
        console.log('Type:', type)

        if (!token) {
          setStatus('error')
          setMessage('验证链接无效。请检查邮箱中的完整链接。')
          return
        }

        // 使用Supabase的verifyOtp方法
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any || 'signup'
        })

        console.log('Verify OTP response:', { data, error })

        if (error) {
          console.error('Verification error:', error)
          setStatus('error')
          setMessage(`验证失败: ${error.message}`)
        } else if (data.user) {
          console.log('Verification successful:', data)
          setStatus('success')
          setMessage('邮箱验证成功！正在跳转到仪表板...')
          
          // 延迟跳转
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('验证失败，请重试或联系支持。')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        setStatus('error')
        setMessage('发生意外错误，请重试。')
      }
    }

    confirmEmail()
  }, [searchParams, router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">正在确认邮箱...</h2>
              <p className="mt-2 text-gray-600">请稍候</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-green-900">确认成功！</h2>
              <p className="mt-2 text-green-600">{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-red-900">确认失败</h2>
              <p className="mt-2 text-red-600">{message}</p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  重新注册
                </button>
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
                >
                  返回登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmailConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载...</p>
        </div>
      </div>
    }>
      <EmailConfirmContent />
    </Suspense>
  )
}
