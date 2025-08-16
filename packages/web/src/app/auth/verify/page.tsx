'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'

function EmailVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientSupabase()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // 从URL参数中获取token
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        
        if (!accessToken || !refreshToken) {
          setStatus('error')
          setMessage('验证链接无效或已过期')
          return
        }

        // 设置session
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (error) {
          console.error('Verification error:', error)
          setStatus('error')
          setMessage('邮箱验证失败：' + error.message)
          return
        }

        if (data.session) {
          setStatus('success')
          setMessage('邮箱验证成功！正在跳转到仪表板...')
          
          // 延迟跳转，让用户看到成功消息
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('验证失败，请重试')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        setStatus('error')
        setMessage('发生意外错误，请重试')
      }
    }

    verifyEmail()
  }, [searchParams, router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">正在验证邮箱...</h2>
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
              <h2 className="mt-4 text-xl font-semibold text-green-900">验证成功！</h2>
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
              <h2 className="mt-4 text-xl font-semibold text-red-900">验证失败</h2>
              <p className="mt-2 text-red-600">{message}</p>
              <button
                onClick={() => router.push('/auth/signin')}
                className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                返回登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmailVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载...</p>
        </div>
      </div>
    }>
      <EmailVerifyContent />
    </Suspense>
  )
}
