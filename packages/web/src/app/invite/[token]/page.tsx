'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Heart, Users, Shield, Clock } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'

import { FurbridgeCard } from '@/components/ui'

interface Invitation {
  id: string
  project_name: string
  inviter_name: string
  inviter_avatar?: string
  role: 'facilitator' | 'storyteller'
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  project_description?: string
}

export default function InvitationLandingPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  // 统一使用单例 Supabase 客户端，避免与 signin 页使用 localStorage 的客户端不一致导致的会话读取失败
  const supabase = createClientSupabase()

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`)
        if (!response.ok) {
          throw new Error('Invalid or expired invitation')
        }

        const data = await response.json()
        setInvitation(data)
      } catch (err) {
        setError('Invalid or expired invitation link')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadInvitation()
    }
  }, [token])

  const handleAcceptInvitation = async () => {
    if (!invitation) return

    setAccepting(true)
    try {
      // 未登录则先跳转登录页，登录后回到邀请页
      const session = await supabase.auth.getSession()
      const nextPath = `/invite/${token}`
      if (!session.data.session) {
        window.location.href = `/auth/signin?next=${encodeURIComponent(nextPath)}`
        return
      }

      // 携带会话 token 以避免 401（移动端或跨域 cookie 被屏蔽时）
      const accessToken = session.data.session?.access_token
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        credentials: 'include', // 确保同源请求也附带 Cookie
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to accept invitation')
      }

      const result = await response.json()

      // Redirect to the project dashboard
      router.push(`/dashboard/projects/${result.project_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Invitation Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This invitation link is invalid or has expired.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            className="w-full"
          >
            Go to Homepage
          </Button>
        </Card>
      </div>
    )
  }

  const isExpired = new Date(invitation.expires_at) < new Date()
  const roleTitle = invitation.role === 'storyteller' ? 'Storyteller' : 'Co-Facilitator'
  const roleDescription = invitation.role === 'storyteller'
    ? 'Share your precious memories and stories'
    : 'Help manage and organize family stories'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Main Invitation Card */}
        <Card className="p-8 text-center">
          <div className="space-y-6">
            {/* Heart Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Heart className="h-8 w-8 text-primary" />
              </div>
            </div>

            {/* Invitation Message */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-foreground">
                You're Invited!
              </h1>

              <div className="flex items-center justify-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={invitation.inviter_avatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {invitation.inviter_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-lg text-foreground">
                    <span className="font-semibold">{invitation.inviter_name}</span> has invited you to join
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    "{invitation.project_name}"
                  </p>
                </div>
              </div>

              {invitation.project_description && (
                <p className="text-muted-foreground max-w-md mx-auto">
                  {invitation.project_description}
                </p>
              )}
            </div>

            {/* Role Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <Users className="h-4 w-4 mr-2" />
                Join as {roleTitle}
              </Badge>
            </div>

            {/* Role Description */}
            <p className="text-muted-foreground">
              {roleDescription}
            </p>

            {/* Action Button */}
            {isExpired ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 text-amber-600">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">This invitation has expired</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please contact {invitation.inviter_name} for a new invitation.
                </p>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full max-w-sm mx-auto"
                onClick={handleAcceptInvitation}
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Accept & Join'}
              </Button>
            )}
          </div>
        </Card>

        {/* Privacy & Security Note */}
        <FurbridgeCard className="p-6">
          <div className="flex items-start space-x-3">
            <Shield className="h-6 w-6 text-furbridge-teal mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Your Privacy is Protected
              </h3>
              <p className="text-sm text-gray-600">
                Everything you share is only visible to the family members in this project.
                Your stories are private, secure, and will never be shared with anyone outside your family.
              </p>
            </div>
          </div>
        </FurbridgeCard>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>
            Questions? <a href="mailto:support@saga.family" className="text-furbridge-orange hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  )
}
