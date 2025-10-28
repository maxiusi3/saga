'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const info = {
      currentOrigin: window.location.origin,
      currentHost: window.location.host,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      redirectUrl: `${window.location.origin}/auth/callback`,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }

    setDebugInfo(info)
  }, [])

  const testEmailAuth = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        console.error('Auth error:', error)
        alert(`Error: ${error.message}`)
      } else {
        alert('Test email sent (if email exists)')
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      alert(`Unexpected error: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Auth Debug Information</h1>
        
        <div className="bg-gray-100 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Configuration</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <button
          onClick={testEmailAuth}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test Email Auth
        </button>

        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Supabase Configuration Required:</h3>
          <p className="mb-2">In your Supabase project dashboard, go to:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Authentication → Settings</li>
            <li>Add these URLs to "Redirect URLs":</li>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><code>https://saga-web-livid.vercel.app/auth/callback</code></li>
              <li><code>http://localhost:3000/auth/callback</code> (for development)</li>
            </ul>
            <li>Set "Site URL" to: <code>https://saga-web-livid.vercel.app</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
