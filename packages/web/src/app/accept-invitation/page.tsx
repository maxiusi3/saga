'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

interface InvitationDetails {
  id: string
  project_name: string
  inviter_name: string
  role: 'facilitator' | 'storyteller'
  message?: string
  expires_at: string
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, supabase } = useAuthStore()
  
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsSignup, setNeedsSignup] = useState(false)
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  })

  const token = searchParams.get('token')
  const type = searchParams.get('type')

  useEffect(() => {
    console.log('Accept invitation: useEffect triggered', { token, type, user: !!user })

    if (token && type === 'invite') {
      console.log('Accept invitation: Loading invitation details with token')
      loadInvitationDetails()
    } else if (user) {
      // 如果没有 token 但用户已登录，检查待处理的邀请
      console.log('Accept invitation: Loading pending invitations for user')
      loadPendingInvitations()
    } else {
      console.log('Accept invitation: No token and no user, showing error')
      setError('Invalid invitation link')
      setLoading(false)
    }
  }, [token, type, user])

  const loadInvitationDetails = async () => {
    try {
      const response = await fetch(`/api/invitations/verify?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        setInvitation(data)

        // 检查用户是否已登录且邮箱匹配
        if (user && user.email === data.invitee_email) {
          // 用户已登录且邮箱匹配，可以直接接受邀请
          setNeedsSignup(false)
        } else if (user && user.email !== data.invitee_email) {
          // 用户已登录但邮箱不匹配
          setError('Please log out and use the correct email address to accept this invitation.')
        } else {
          // 用户未登录，需要注册或登录
          setNeedsSignup(true)
          setSignupData(prev => ({ ...prev, email: data.invitee_email }))
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Invalid or expired invitation')
      }
    } catch (error) {
      setError('Failed to load invitation details')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingInvitations = async () => {
    try {
      // 获取认证信息
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/invitations/check-pending', {
        credentials: 'include',
        headers
      })

      console.log('Accept invitation: API response', { status: response.status })

      if (response.ok) {
        const data = await response.json()
        console.log('Accept invitation: API data', data)

        if (data.hasPendingInvitations && data.invitations.length > 0) {
          // 如果有多个邀请，显示第一个
          const firstInvitation = data.invitations[0]
          console.log('Accept invitation: First invitation', firstInvitation)

          setInvitation({
            id: firstInvitation.id,
            invitee_email: user?.email || '',
            project_name: firstInvitation.project_name,
            project_id: firstInvitation.project_id,
            inviter_name: 'Project Owner',
            role: firstInvitation.role,
            message: firstInvitation.message,
            expires_at: firstInvitation.expires_at
          })
          setNeedsSignup(false)
        } else {
          console.log('Accept invitation: No pending invitations')
          setError('No pending invitations found')
        }
      } else {
        setError('Failed to load pending invitations')
      }
    } catch (error) {
      setError('Failed to load pending invitations')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (signupData.password !== signupData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (signupData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setAccepting(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName
          }
        }
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Account created! Please check your email to verify your account.')
        // 注册成功后，用户需要验证邮箱，然后再回到这个页面接受邀请
      }
    } catch (error) {
      toast.error('Failed to create account')
    } finally {
      setAccepting(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!user || !invitation) return

    setAccepting(true)
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          user_id: user.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Invitation accepted successfully!')
        router.push(`/dashboard/projects/${data.project_id}`)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to accept invitation')
      }
    } catch (error) {
      toast.error('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading invitation...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')} 
              className="w-full"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <CardTitle>Project Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a Saga project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p><strong>Project:</strong> {invitation.project_name}</p>
            <p><strong>Invited by:</strong> {invitation.inviter_name}</p>
            <p><strong>Role:</strong> {invitation.role}</p>
            <p><strong>Expires:</strong> {new Date(invitation.expires_at).toLocaleDateString()}</p>
            {invitation.message && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm italic">"{invitation.message}"</p>
              </div>
            )}
          </div>

          {needsSignup ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={signupData.email}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={signupData.fullName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                />
              </div>
              <Button 
                onClick={handleSignup} 
                disabled={accepting || !signupData.fullName || !signupData.password}
                className="w-full"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account & Accept Invitation
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleAcceptInvitation} 
              disabled={accepting}
              className="w-full"
            >
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Invitation
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading...</span>
          </CardContent>
        </Card>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}
