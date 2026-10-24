'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClientSupabase } from '@/lib/supabase'
import { defaultLocale, locales } from '@/i18n/config'
import {
  acceptInvitationOverHttp, getInvitationStatusOverHttp, InvitationHttpError,
} from '@/lib/invitation-acceptance-client'
import {
  isAccessToken, isInvitationToken, isRecord, isUuid,
  type InvitationStatusResponse,
} from '@/lib/invitation-acceptance-protocol'

type SessionIdentity = { userId: string; accessToken: string }
type Identity = SessionIdentity & { generation: number }
type LinkKind = 'path' | 'query'

function sessionIdentity(session: unknown): SessionIdentity | null {
  if (!isRecord(session) || !isAccessToken(session.access_token)
    || !isRecord(session.user) || !isUuid(session.user.id)) return null
  // Browser session supplies the Bearer only. The server verifies eligibility.
  return { userId: session.user.id, accessToken: session.access_token }
}
function failureMessage(error: unknown) {
  if (error instanceof InvitationHttpError && error.outcome === 'rejected') {
    return 'This invitation request was denied. Confirm your email and sign in with the invited account.'
  }
  if (error instanceof InvitationHttpError && error.status === 401) {
    return 'Your sign-in could not be verified. Sign in again to view this invitation.'
  }
  return 'Invitation status is unavailable. You can query its status again.'
}

export function InvitationRecipient({ token, locale, linkKind }: { token: string | null; locale: string; linkKind: LinkKind }) {
  const safeLocale = locales.find(value => value === locale) ?? defaultLocale
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Project invitation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isInvitationToken(token) ? (
            <RecipientSession key={`${safeLocale}:${token}`} token={token} locale={safeLocale} linkKind={linkKind} />
          ) : (
            <p role="alert">This invitation link is missing or unavailable. Reopen the original invitation link.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function RecipientSession({ token, locale, linkKind }: { token: string; locale: string; linkKind: LinkKind }) {
  const [identity, setIdentity] = useState<Identity | null>()
  const [authUnavailable, setAuthUnavailable] = useState(false)
  const currentIdentity = useRef<Identity | null>(null)
  const identityGeneration = useRef(0)
  // Preserve uncertainty if the same account refreshes or leaves and returns.
  const writeLocks = useRef(new Set<string>())
  const isCurrentAccount = useCallback((userId: string, generation: number) =>
    currentIdentity.current?.userId === userId && currentIdentity.current.generation === generation, [])
  const returnPath = linkKind === 'path' ? `/${locale}/invite/${token}` : `/${locale}/accept-invitation?token=${token}`
  const signInPath = `/${locale}/auth/signin?next=${encodeURIComponent(returnPath)}`

  useEffect(() => {
    let active = true
    let authEventSeen = false
    let unsubscribe: (() => void) | undefined
    const receive = (session: unknown) => {
      if (!active) return
      const next = sessionIdentity(session)
      // Record every real departure immediately, even when React batches a return
      // to the same account. A credential refresh alone keeps this generation.
      if (currentIdentity.current?.userId !== next?.userId) identityGeneration.current += 1
      const snapshot = next ? { ...next, generation: identityGeneration.current } : null
      currentIdentity.current = snapshot
      setIdentity(snapshot)
      setAuthUnavailable(false)
    }
    const unavailable = () => {
      if (!active || authEventSeen) return
      if (currentIdentity.current) identityGeneration.current += 1
      currentIdentity.current = null
      setIdentity(null)
      setAuthUnavailable(true)
    }
    try {
      const supabase = createClientSupabase()
      const { data } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
        authEventSeen = true
        receive(session)
      })
      unsubscribe = () => data.subscription.unsubscribe()
      Promise.resolve(supabase.auth.getSession()).then((result: { data: { session: unknown }; error: unknown }) => {
        if (!active || authEventSeen) return
        if (result.error) unavailable()
        else receive(result.data.session)
      }).catch(unavailable)
    } catch { unavailable() }
    return () => {
      active = false
      identityGeneration.current += 1
      currentIdentity.current = null
      unsubscribe?.()
    }
  }, [])

  if (identity === undefined) return <p role="status">Checking sign-in…</p>
  if (!identity) return (
    <>
      {authUnavailable ? <p role="alert">Sign-in status is unavailable. Sign in again to continue.</p>
        : <p role="status">Sign in to view and respond to this invitation.</p>}
      <Button asChild className="w-full"><Link href={signInPath}>Sign in or create an account</Link></Button>
    </>
  )
  return <RecipientActions key={`${identity.userId}:${identity.generation}`} token={token} locale={locale} identity={identity}
    signInPath={signInPath} isCurrentAccount={isCurrentAccount} writeLocks={writeLocks.current} />
}

function RecipientActions({ token, locale, identity, signInPath, isCurrentAccount, writeLocks }: {
  token: string; locale: string; identity: Identity; signInPath: string
  isCurrentAccount: (userId: string, generation: number) => boolean; writeLocks: Set<string>
}) {
  const router = useRouter()
  const { userId, generation } = identity
  const bearer = useRef(identity.accessToken)
  bearer.current = identity.accessToken
  const active = useRef(false)
  const inFlight = useRef<'status' | 'accept' | null>(null)
  const [busy, setBusy] = useState<'status' | 'accept' | null>('status')
  const [status, setStatus] = useState<InvitationStatusResponse | null>(null)
  const [error, setError] = useState('')
  const [unknown, setUnknown] = useState(writeLocks.has(userId))
  // Every request and action in this mounted flow captures its identity generation.
  const isCurrent = useCallback(() => active.current && isCurrentAccount(userId, generation), [isCurrentAccount, userId, generation])

  const queryStatus = useCallback(async () => {
    if (!isCurrent() || inFlight.current) return
    inFlight.current = 'status'
    setBusy('status')
    setError('')
    try {
      const result = await getInvitationStatusOverHttp(token, bearer.current)
      if (!isCurrent()) return
      if (result.status === 'accepted' && result.user_id !== userId) throw new InvitationHttpError('unknown')
      setStatus(result)
    } catch (failure) {
      if (!isCurrent()) return
      setStatus(null)
      setError(failureMessage(failure))
    } finally {
      if (isCurrent()) {
        inFlight.current = null
        setBusy(null)
      }
    }
  }, [isCurrent, token, userId])

  useEffect(() => {
    active.current = true
    // Returning to an account with an uncertain write still requires an explicit read.
    if (writeLocks.has(userId)) setBusy(null)
    else void queryStatus()
    return () => { active.current = false }
  }, [queryStatus, userId, writeLocks])

  const accept = async () => {
    if (!isCurrent() || inFlight.current || writeLocks.has(userId)
      || !status || status.status !== 'pending' || status.is_expired) return
    const expected = status
    inFlight.current = 'accept'
    // Lock synchronously, including if this account leaves before the response arrives.
    writeLocks.add(userId)
    setBusy('accept')
    setError('')
    try {
      const result = await acceptInvitationOverHttp(token, bearer.current)
      if (!isCurrent()) return
      if (result.invitation_id !== expected.invitation_id || result.project_id !== expected.project_id
        || result.role !== expected.role || result.user_id !== userId) throw new InvitationHttpError('unknown')
      setStatus({ ...expected, ...result, outcome: 'confirmed' })
      router.push(`/${locale}/dashboard/projects/${result.project_id}`)
    } catch (failure) {
      if (!isCurrent()) return
      if (!(failure instanceof InvitationHttpError) || failure.outcome === 'unknown') {
        setUnknown(true)
      } else {
        writeLocks.delete(userId)
        setStatus(null)
        setError(failureMessage(failure))
      }
    } finally {
      if (isCurrent()) {
        inFlight.current = null
        setBusy(null)
      }
    }
  }

  const accepted = status?.status === 'accepted' && status.user_id === userId
  const pending = status?.status === 'pending' && !status.is_expired
  const stateMessage = accepted ? 'This invitation is already accepted.'
    : status?.status === 'declined' ? 'This invitation was declined.'
    : status?.is_expired ? 'This invitation has expired.' : 'This invitation is pending.'
  return (
    <>
      {busy && <p role="status">{busy === 'accept' ? 'Accepting invitation…' : 'Checking invitation status…'}</p>}
      {status && <div className="space-y-2" aria-live="polite">
        <p>Role: {status.role === 'storyteller' ? 'Storyteller' : 'Facilitator'}</p>
        <p>{stateMessage}</p>
      </div>}
      {unknown && <p role="alert">We could not confirm the acceptance result. Query status to check whether you can enter the project. Accepting again is disabled on this page.</p>}
      {error && <p role="alert">{error}</p>}
      {pending && <Button className="w-full" disabled={Boolean(busy) || writeLocks.has(userId)} onClick={() => void accept()}>
        Accept invitation
      </Button>}
      {(unknown || error) && <Button className="w-full" variant="outline" disabled={Boolean(busy)} onClick={() => void queryStatus()}>
        Query status
      </Button>}
      {accepted && <Button className="w-full" disabled={Boolean(busy)} onClick={() => {
        if (isCurrent() && !inFlight.current) router.push(`/${locale}/dashboard/projects/${status.project_id}`)
      }}>Enter project</Button>}
      {error && <Button asChild variant="outline" className="w-full"><Link href={signInPath}>Sign in with another account</Link></Button>}
    </>
  )
}
