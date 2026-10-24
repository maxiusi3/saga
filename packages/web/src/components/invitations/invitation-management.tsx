'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { InvitationHttpError } from '@/lib/invitation-acceptance-client'
import {
  sendInvitationOverHttp,
  lookupInvitationOverHttp,
  releaseInvitationOverHttp,
  prepareInvitationSend,
} from '@/lib/invitation-sender-client'
import { isCanonicalUuid } from '@/lib/invitation-sender-protocol'
import { loadInvitationSources, loadManagedInvitations } from '@/lib/invitation-management-client'
import type { InvitationSource, ManagedInvitation } from '@/lib/invitation-management-protocol'
import type { InvitationRole } from '@/lib/invitation-acceptance-protocol'
import {
  clearInvitationRecovery,
  readInvitationRecovery,
  saveInvitationRecovery,
  type InvitationRecovery,
} from '@/lib/invitation-recovery'

export function InvitationManagement({ projectId }: { projectId: string }) {
  const { user, getAccessToken } = useAuthStore()
  const identity = useRef({ actorId: user?.id, generation: 0 })
  const [generation, setGeneration] = useState(0)
  const isCurrentIdentity = useCallback(
    (actorId: string, version: number) =>
      identity.current.actorId === actorId && identity.current.generation === version,
    []
  )
  useEffect(() => {
    const receive = (state: ReturnType<typeof useAuthStore.getState>) => {
      if (state.user?.id !== identity.current.actorId) {
        identity.current = { actorId: state.user?.id, generation: identity.current.generation + 1 }
        setGeneration(identity.current.generation)
      }
    }
    // Observe every departure synchronously, even a batched return to the same account.
    const unsubscribe = useAuthStore.subscribe(receive)
    receive(useAuthStore.getState())
    return unsubscribe
  }, [])
  if (!user || !isCanonicalUuid(user.id) || !isCanonicalUuid(projectId))
    return <p>Sign in to manage invitations.</p>
  return (
    <ManagementSession
      key={`${user.id}:${projectId}:${generation}`}
      actorId={user.id}
      projectId={projectId}
      getAccessToken={getAccessToken}
      generation={generation}
      isCurrentIdentity={isCurrentIdentity}
    />
  )
}
function ManagementSession({
  actorId,
  projectId,
  getAccessToken,
  generation,
  isCurrentIdentity,
}: {
  actorId: string
  projectId: string
  getAccessToken: () => Promise<string | null>
  generation: number
  isCurrentIdentity: (actorId: string, generation: number) => boolean
}) {
  const locale = useLocale(),
    id = useId()
  const [role, setRole] = useState<InvitationRole>('storyteller')
  const [email, setEmail] = useState(''),
    [message, setMessage] = useState('')
  const [sourceId, setSourceId] = useState(''),
    [sources, setSources] = useState<InvitationSource[]>([])
  const [sourceLoading, setSourceLoading] = useState(true),
    [sourceError, setSourceError] = useState(false)
  const [items, setItems] = useState<ManagedInvitation[]>([]),
    [listLoading, setListLoading] = useState(true),
    [listError, setListError] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(),
    [refresh, setRefresh] = useState(0)
  const [ticket, setTicket] = useState<InvitationRecovery | null>(null),
    [storageBlocked, setStorageBlocked] = useState(false),
    [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const [link, setLink] = useState<{ url: string; invitationId: string } | null>(null)
  const active = useRef(false),
    locked = useRef(false),
    controllers = useRef(new Set<AbortController>())
  const isCurrent = useCallback(
    () => active.current && isCurrentIdentity(actorId, generation),
    [actorId, generation, isCurrentIdentity]
  )
  useEffect(() => {
    active.current = true
    const recovery = readInvitationRecovery(actorId, projectId)
    setTicket(recovery.ticket)
    setStorageBlocked(recovery.blocked)
    setReady(true)
    return () => {
      active.current = false
      for (const controller of controllers.current) controller.abort()
      controllers.current.clear()
    }
  }, [actorId, projectId])
  useEffect(() => {
    const controller = new AbortController()
    controllers.current.add(controller)
    setSources([])
    setSourceId('')
    setSourceLoading(true)
    setSourceError(false)
    void (async () => {
      try {
        const token = await getAccessToken()
        if (controller.signal.aborted || !isCurrent()) return
        const result = await loadInvitationSources(
          { project_id: projectId, role },
          token || '',
          controller.signal
        )
        if (!controller.signal.aborted && isCurrent()) setSources(result)
      } catch {
        if (!controller.signal.aborted && isCurrent()) setSourceError(true)
      } finally {
        if (!controller.signal.aborted && isCurrent()) setSourceLoading(false)
        controllers.current.delete(controller)
      }
    })()
    return () => {
      controller.abort()
      controllers.current.delete(controller)
    }
  }, [getAccessToken, projectId, role, refresh, isCurrent])
  useEffect(() => {
    const controller = new AbortController()
    controllers.current.add(controller)
    setItems([])
    setListLoading(true)
    setListError(false)
    void (async () => {
      try {
        const token = await getAccessToken()
        if (controller.signal.aborted || !isCurrent()) return
        const result = await loadManagedInvitations(
          { project_id: projectId, ...(cursor ? { after: cursor } : {}) },
          token || '',
          controller.signal
        )
        if (!controller.signal.aborted && isCurrent()) setItems(result)
      } catch {
        if (!controller.signal.aborted && isCurrent()) setListError(true)
      } finally {
        if (!controller.signal.aborted && isCurrent()) setListLoading(false)
        controllers.current.delete(controller)
      }
    })()
    return () => {
      controller.abort()
      controllers.current.delete(controller)
    }
  }, [getAccessToken, projectId, cursor, refresh, isCurrent])
  function showNotice(value: string, success = false) {
    setNotice(value)
    if (success) toast.success(value)
    else toast.error(value)
  }
  function begin() {
    if (locked.current || !isCurrent()) return null
    locked.current = true
    setBusy(true)
    setLink(null)
    setNotice('')
    const controller = new AbortController()
    controllers.current.add(controller)
    return controller
  }
  function end(controller: AbortController) {
    controllers.current.delete(controller)
    if (isCurrent()) {
      locked.current = false
      setBusy(false)
    }
  }
  function clear(ticketToClear: InvitationRecovery) {
    const cleared = clearInvitationRecovery(ticketToClear)
    if (isCurrent()) {
      if (cleared) setTicket(null)
      setStorageBlocked(!cleared)
    }
    return cleared
  }
  function confirmedLink(token: string, invitationId: string, status: string, expires: string) {
    if (status === 'pending' && Date.parse(expires) > Date.now())
      setLink({ url: `${window.location.origin}/${locale}/invite/${token}`, invitationId })
  }
  async function send() {
    if (
      !ready ||
      storageBlocked ||
      ticket ||
      sourceLoading ||
      !sources.some(source => source.source_id === sourceId && source.role === role)
    )
      return
    const controller = begin()
    if (!controller) return
    let recovery: InvitationRecovery | null = null
    let recoverySaved = false
    let dispatched = false
    function clearUndispatchedRecovery() {
      if (recoverySaved && !dispatched && recovery) {
        recoverySaved = false
        clear(recovery)
      }
    }
    // A token request may never settle. Clear only this unsent ticket on departure.
    controller.signal.addEventListener('abort', clearUndispatchedRecovery)
    try {
      const requestId = crypto.randomUUID()
      const input = prepareInvitationSend(projectId, {
        request_id: requestId,
        source_id: sourceId,
        email,
        role,
        message,
      })
      recovery = {
        version: 1,
        actor_id: actorId,
        project_id: projectId,
        request_id: requestId,
        role,
      }
      if (!saveInvitationRecovery(recovery)) {
        setStorageBlocked(true)
        showNotice('Recovery storage is unavailable. Invitation was not sent.')
        return
      }
      recoverySaved = true
      setTicket(recovery)
      const token = await getAccessToken()
      if (!isCurrent() || controller.signal.aborted) return
      dispatched = true
      const result = await sendInvitationOverHttp(projectId, input, token || '', controller.signal)
      if (!isCurrent()) return
      clear(recovery)
      confirmedLink(result.token, result.invitation_id, result.status, result.expires_at)
      setEmail('')
      setMessage('')
      setSourceId('')
      setCursor(undefined)
      setRefresh(value => value + 1)
      showNotice(
        'Invitation registered. Share the link with your invitee; email delivery is not confirmed.',
        true
      )
    } catch (error) {
      if (!isCurrent()) return
      const known =
        !dispatched || (error instanceof InvitationHttpError && error.outcome !== 'unknown')
      if (known && recoverySaved && recovery) {
        recoverySaved = false
        clear(recovery)
      }
      showNotice(
        known
          ? 'Invitation was not sent. Check the form and availability.'
          : 'Invitation result is unknown. Query the last invitation before sending again.'
      )
    } finally {
      clearUndispatchedRecovery()
      controller.signal.removeEventListener('abort', clearUndispatchedRecovery)
      end(controller)
    }
  }
  async function lookup(recovery: InvitationRecovery, expectedInvitation?: string) {
    const controller = begin()
    if (!controller) return
    try {
      const token = await getAccessToken()
      if (!isCurrent() || controller.signal.aborted) return
      const result = await lookupInvitationOverHttp(
        { request_id: recovery.request_id, project_id: projectId, role: recovery.role },
        token || '',
        controller.signal
      )
      if (!isCurrent()) return
      if (expectedInvitation && result.invitation_id !== expectedInvitation)
        throw new InvitationHttpError('unknown')
      if (ticket?.request_id === recovery.request_id) clear(recovery)
      confirmedLink(result.token, result.invitation_id, result.status, result.expires_at)
      setCursor(undefined)
      setRefresh(value => value + 1)
      showNotice(`Invitation confirmed: ${result.status}.`, true)
    } catch {
      if (isCurrent())
        showNotice(
          'Invitation could not be confirmed. Keep the recovery request and query again later.'
        )
    } finally {
      end(controller)
    }
  }
  async function release(item: ManagedInvitation) {
    const controller = begin()
    if (!controller) return
    const expired = Date.parse(item.expires_at) <= Date.now()
    try {
      const token = await getAccessToken()
      if (!isCurrent() || controller.signal.aborted) return
      const result = await releaseInvitationOverHttp(
        { invitation_id: item.invitation_id, reason: expired ? 'expired' : 'cancelled' },
        token || '',
        projectId,
        controller.signal
      )
      if (!isCurrent()) return
      setItems(current =>
        current.map(row =>
          row.invitation_id === item.invitation_id ? { ...row, status: result.status } : row
        )
      )
      setRefresh(value => value + 1)
      showNotice(expired ? 'Expired invitation released' : 'Invitation cancelled', true)
    } catch {
      if (isCurrent())
        showNotice(
          'Invitation cancellation could not be confirmed. Refresh its history to check the result.'
        )
    } finally {
      end(controller)
    }
  }
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Send New Invitation</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {ticket && (
            <div role='status'>
              <p>An earlier invitation needs confirmation before you send another.</p>
              <Button disabled={busy} onClick={() => lookup(ticket)}>
                Query last invitation
              </Button>
            </div>
          )}
          {storageBlocked && (
            <p role='alert'>
              Recovery storage is unavailable or contains an unresolved record. New invitations are
              blocked.
            </p>
          )}
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <Label htmlFor={`${id}-email`}>Email Address</Label>
              <Input
                id={`${id}-email`}
                type='email'
                value={email}
                disabled={busy}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-role`}>Role</Label>
              <select
                id={`${id}-role`}
                className='w-full rounded-md border p-2'
                value={role}
                disabled={busy}
                onChange={event => {
                  setSources([])
                  setSourceId('')
                  setLink(null)
                  setNotice('')
                  setRole(event.target.value as InvitationRole)
                }}
              >
                <option value='storyteller'>Storyteller</option>
                <option value='facilitator'>Facilitator</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-source`}>Seat source</Label>
            <select
              id={`${id}-source`}
              className='w-full rounded-md border p-2'
              value={sourceId}
              disabled={busy || sourceLoading}
              onChange={event => setSourceId(event.target.value)}
            >
              <option value=''>Select a seat source</option>
              {sources.map(source => (
                <option key={source.source_id} value={source.source_id}>
                  {source.remaining} seats available · {source.source_id}
                </option>
              ))}
            </select>
            <p className='text-sm text-muted-foreground'>
              {sourceLoading
                ? 'Loading available seats…'
                : sourceError
                  ? 'Seat sources could not be loaded.'
                  : sources.length === 0
                    ? 'No verified seats available for this role.'
                    : 'Availability is checked again when you send.'}
            </p>
          </div>
          <div>
            <Label htmlFor={`${id}-message`}>Message (optional)</Label>
            <Textarea
              id={`${id}-message`}
              maxLength={2000}
              value={message}
              disabled={busy}
              onChange={event => setMessage(event.target.value)}
            />
          </div>
          <Button
            disabled={
              busy ||
              !ready ||
              !!ticket ||
              storageBlocked ||
              sourceLoading ||
              !sourceId ||
              !email.trim()
            }
            onClick={send}
          >
            Send Invitation
          </Button>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => {
              setCursor(undefined)
              setRefresh(value => value + 1)
            }}
          >
            Refresh invitations
          </Button>
          {notice && <p role='status'>{notice}</p>}
          {link && (
            <div>
              <Label htmlFor={`${id}-link`}>Invitation link</Label>
              <Input id={`${id}-link`} readOnly value={link.url} />
              <Button
                variant='outline'
                disabled={busy}
                onClick={async () => {
                  if (!isCurrent()) return
                  const current = link
                  try {
                    await navigator.clipboard.writeText(current.url)
                    if (isCurrent()) showNotice('Invitation link copied', true)
                  } catch {
                    if (isCurrent()) showNotice('Could not copy the invitation link.')
                  }
                }}
              >
                Copy invitation link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invitation history</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {listLoading ? (
            <p>Loading invitation history…</p>
          ) : listError ? (
            <p role='alert'>Invitation history could not be loaded.</p>
          ) : items.length === 0 ? (
            <p>No invitations on this page.</p>
          ) : (
            items.map(item => (
              <div key={item.invitation_id} className='rounded-md border p-4 space-y-2'>
                <p>{item.invitee_email}</p>
                <p>
                  {item.role} · {item.status}
                </p>
                <p className='text-sm text-muted-foreground'>
                  Created {new Date(item.created_at).toLocaleDateString()} · Expires{' '}
                  {new Date(item.expires_at).toLocaleDateString()}
                </p>
                {item.request_id && (
                  <Button
                    variant='outline'
                    disabled={busy || !!ticket || storageBlocked}
                    onClick={() =>
                      lookup(
                        {
                          version: 1,
                          actor_id: actorId,
                          project_id: projectId,
                          request_id: item.request_id!,
                          role: item.role,
                        },
                        item.invitation_id
                      )
                    }
                  >
                    Recover invitation link
                  </Button>
                )}
                {item.status === 'pending' && (
                  <Button
                    variant='outline'
                    disabled={busy}
                    aria-label={
                      Date.parse(item.expires_at) <= Date.now()
                        ? 'Release expired invitation'
                        : 'Cancel invitation'
                    }
                    onClick={() => release(item)}
                  >
                    {Date.parse(item.expires_at) <= Date.now()
                      ? 'Release expired invitation'
                      : 'Cancel invitation'}
                  </Button>
                )}
              </div>
            ))
          )}
          {cursor && (
            <Button
              variant='outline'
              disabled={busy || listLoading}
              onClick={() => setCursor(undefined)}
            >
              First page
            </Button>
          )}
          {items.length === 50 && (
            <Button
              variant='outline'
              disabled={busy || listLoading}
              onClick={() => setCursor(items[items.length - 1].invitation_id)}
            >
              Next page
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
