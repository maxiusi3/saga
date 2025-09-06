'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/navigation'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { BookOpen, Gem, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui'

export default function DashboardLayout({
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
        <div className="flex justify-around">
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard">
              <BookOpen className="w-5 h-5 mb-1" />
              <span className="font-medium">My Sagas</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard/resources">
              <Gem className="w-5 h-5 mb-1" />
              <span>Resources</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard/profile">
              <UserIcon className="w-5 h-5 mb-1" />
              <span>Profile</span>
            </Link>
          </Button>
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-20"></div>
    </div>
  )
}
