'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { createClientSupabase } from '@/lib/supabase'

interface InvitationDetails {
  id: string
  project_name: string
  inviter_name: string
  role: 'facilitator' | 'storyteller'
  message?: string
  expires_at: string
  token?: string
  invitee_email?: string
  project_id?: string
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('invitations.accept')
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsSignup, setNeedsSignup] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  })

  const token = searchParams.get('token')
  const type = searchParams.get('type')

  useEffect(() => {
    if (hasLoaded) return // 防止重复加载

    console.log('Accept invitation: useEffect triggered', { token, type, user: !!user })

    if (token && type === 'invite') {
      console.log('Accept invitation: Loading invitation details with token')
      setHasLoaded(true)
      loadInvitationDetails()
    } else if (user) {
      // 如果没有 token 但用户已登录，检查待处理的邀请
      console.log('Accept invitation: Loading pending invitations for user')
      setHasLoaded(true)
      loadPendingInvitations()
    } else {
      console.log('Accept invitation: No token and no user, showing error')
      setError(t('invalidDescription'))
      setLoading(false)
    }
  }, [token, type, user, hasLoaded])

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
          setError(t('wrongEmail'))
        } else {
          // 用户未登录，需要注册或登录
          setNeedsSignup(true)
          setSignupData(prev => ({ ...prev, email: data.invitee_email }))
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || t('invalidDescription'))
      }
    } catch (error) {
      setError(t('loadingFailed'))
    } finally {
      setLoading(false)
    }
  }

  const loadPendingInvitations = async () => {
    try {
      // 初始化 supabase 客户端
      const supabase = createClientSupabase()

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
            expires_at: firstInvitation.expires_at,
            token: firstInvitation.token
          })
          setNeedsSignup(false)
        } else {
          console.log('Accept invitation: No pending invitations')
          setError(t('noPendingInvitations'))
        }
      } else {
        console.log('Accept invitation: API call failed', { status: response.status, statusText: response.statusText })
        const errorText = await response.text()
        console.log('Accept invitation: Error response', errorText)
        setError(t('loadingFailed'))
      }
    } catch (error) {
      console.error('Accept invitation: Exception caught', error)
      setError(t('loadingFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (signupData.password !== signupData.confirmPassword) {
      toast.error(t('passwordMismatch'))
      return
    }

    if (signupData.password.length < 6) {
      toast.error(t('passwordTooShort'))
      return
    }

    setAccepting(true)
    try {
      const supabase = createClientSupabase()
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
        toast.success(t('accountCreated'))
        // 注册成功后，用户需要验证邮箱，然后再回到这个页面接受邀请
      }
    } catch (error) {
      toast.error(t('accountCreationFailed'))
    } finally {
      setAccepting(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!user || !invitation) return

    setAccepting(true)
    try {
      // 获取认证信息
      const supabase = createClientSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          token: (invitation as any).token, // 使用邀请的 token 字段
          user_id: user.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(t('acceptSuccess'))
        router.push(withLocale(`/dashboard/projects/${data.project_id}`))
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || t('acceptFailed'))
      }
    } catch (error) {
      toast.error(t('acceptFailed'))
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
            <span className="ml-2">{t('loading')}</span>
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
            <CardTitle>{t('invalidTitle')}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')} 
              className="w-full"
            >
              {t('goHome')}
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
          <CardTitle>{t('projectInvitation')}</CardTitle>
          <CardDescription>
            {t('invitedToJoin')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p><strong>{t('project')}:</strong> {invitation.project_name}</p>
            <p><strong>{t('invitedBy')}:</strong> {invitation.inviter_name}</p>
            <p><strong>{t('role')}:</strong> {invitation.role}</p>
            <p><strong>{t('expires')}:</strong> {new Date(invitation.expires_at).toLocaleDateString()}</p>
            {invitation.message && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm italic">"{invitation.message}"</p>
              </div>
            )}
          </div>

          {needsSignup ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={signupData.email}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('fullName')}</Label>
                <Input
                  id="fullName"
                  value={signupData.fullName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder={t('fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder={t('confirmPasswordPlaceholder')}
                />
              </div>
              <Button 
                onClick={handleSignup} 
                disabled={accepting || !signupData.fullName || !signupData.password}
                className="w-full"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('createAccountButton')}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleAcceptInvitation} 
              disabled={accepting}
              className="w-full"
            >
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('acceptButton')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  const t = useTranslations('invitations.accept')
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('loading')}</span>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AcceptInvitationContent />
    </Suspense>
  )
}
