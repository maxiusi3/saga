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
        console.log('Auth callback started')
        console.log('Current URL:', window.location.href)
        console.log('Hash:', window.location.hash)
        console.log('Search:', window.location.search)

        // Handle the auth callback using Supabase's built-in method
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          router.push('/auth/signin?error=session_error')
          return
        }

        // Check if there are auth tokens in the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        console.log('Auth tokens found:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          type 
        })

        if (accessToken && refreshToken) {
          // Set the session with the tokens from the URL
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error('Set session error:', sessionError)
            router.push('/auth/signin?error=session_error&message=' + encodeURIComponent(sessionError.message))
            return
          }

          if (sessionData.session) {
            console.log('Session established successfully:', sessionData.session.user.email)
            
            // Check if this is email verification
            if (type === 'signup') {
              router.push('/dashboard?verified=true&welcome=true')
            } else {
              router.push('/dashboard')
            }
            return
          }
        }

        // If we have an existing session, redirect to dashboard
        if (data.session) {
          console.log('Existing session found:', data.session.user.email)
          router.push('/dashboard')
        } else {
          console.log('No session found, redirecting to signin')
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        router.push('/auth/signin?error=unexpected_error&message=' + encodeURIComponent(String(error)))
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