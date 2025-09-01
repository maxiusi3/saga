'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { HelpCircle, Home } from 'lucide-react'

export default function StorytellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      if (!user) {
        router.push('/auth/signin')
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/auth/signin')
        } else {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-furbridge-orange"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/storyteller" className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-furbridge-orange">Saga</div>
              <span className="text-sm text-gray-600">Storyteller</span>
            </Link>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              <Link href="/storyteller/help">
                <FurbridgeButton variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5" />
                </FurbridgeButton>
              </Link>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user.user_metadata?.full_name || user.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-gray-600 hover:text-gray-900"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex justify-around py-2">
          <Link 
            href="/storyteller" 
            className="flex flex-col items-center py-2 px-3 text-xs"
          >
            <Home className="h-5 w-5 mb-1" />
            <span>Home</span>
          </Link>
          <Link 
            href="/storyteller/record" 
            className="flex flex-col items-center py-2 px-3 text-xs text-gray-600"
          >
            <div className="h-5 w-5 mb-1 rounded-full bg-furbridge-orange flex items-center justify-center">
              <div className="h-2 w-2 bg-white rounded-full"></div>
            </div>
            <span>Record</span>
          </Link>
          <Link 
            href="/storyteller/help" 
            className="flex flex-col items-center py-2 px-3 text-xs text-gray-600"
          >
            <HelpCircle className="h-5 w-5 mb-1" />
            <span>Help</span>
          </Link>
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="sm:hidden h-16"></div>
    </div>
  )
}
