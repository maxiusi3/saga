'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listLocalRecordings, loadLocalRecording, RecordingRecoveryError } from '@/lib/recording-recovery'
import type { RecorderSessionRecord } from '@/lib/recorder-db'

type RecoveredRecording = Awaited<ReturnType<typeof loadLocalRecording>>

/** A new scope unmounts all old UI and invalidates its asynchronous reads. */
export function RecordingRecoveryPanel({ projectId, userId }: { projectId: string; userId?: string }) {
  if (!projectId || !userId) return null
  return <ScopedRecoveryPanel key={JSON.stringify([projectId, userId])} projectId={projectId} userId={userId} />
}

function ScopedRecoveryPanel({ projectId, userId }: { projectId: string; userId: string }) {
  const t = useTranslations('recording.recovery')
  const locale = useLocale()
  const [sessions, setSessions] = useState<RecorderSessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [recording, setRecording] = useState<RecoveredRecording | null>(null)
  const selectionVersion = useRef(0)

  useEffect(() => {
    let current = true
    setLoading(true)
    setListError(false)
    void listLocalRecordings(projectId, userId).then(rows => {
      if (current) setSessions(rows)
    }).catch(() => {
      if (current) setListError(true)
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [projectId, userId, refresh])

  useEffect(() => () => { selectionVersion.current += 1 }, [])

  const open = useCallback(async (sessionId: string) => {
    const version = ++selectionVersion.current
    setRecording(null)
    setSelectionError(null)
    setSelectedId(sessionId)
    try {
      const result = await loadLocalRecording(sessionId, projectId, userId)
      if (selectionVersion.current === version) setRecording(result)
    } catch (error) {
      if (selectionVersion.current === version) {
        setSelectionError(error instanceof RecordingRecoveryError ? `errors.${error.code}` : 'readError')
      }
    } finally {
      if (selectionVersion.current === version) setSelectedId(null)
    }
  }, [projectId, userId])

  if (!loading && !listError && sessions.length === 0) return null

  return (
    <Card className="mx-auto max-w-2xl p-6 space-y-4" aria-label={t('title')}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('notice')}</p>
      </div>
      {loading && <p role="status">{t('loading')}</p>}
      {listError && (
        <div className="space-y-2">
          <p role="alert">{t('listError')}</p>
          <Button type="button" variant="outline" onClick={() => setRefresh(value => value + 1)}>{t('retry')}</Button>
        </div>
      )}
      <ul className="space-y-3">
        {sessions.map((session, index) => {
          const date = new Date(session.startedAt)
          const label = t('draft', { number: index + 1 })
          return (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  {Number.isFinite(date.getTime()) ? <time dateTime={session.startedAt}>{date.toLocaleString(locale)}</time> : t('unknownDate')}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => void open(session.id)} aria-label={`${t('open')} ${label}`}>
                {t('open')}
              </Button>
            </li>
          )
        })}
      </ul>
      {selectedId && <p role="status">{t('opening')}</p>}
      {selectionError && <p role="alert" className="text-sm text-destructive">{t(selectionError)}</p>}
      {recording && (
        <RecoveredAudio key={recording.session.id} recording={recording} onClose={() => {
          selectionVersion.current += 1
          setRecording(null)
        }} />
      )}
    </Card>
  )
}

function RecoveredAudio({ recording, onClose }: { recording: RecoveredRecording; onClose: () => void }) {
  const t = useTranslations('recording.recovery')
  const audioRef = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState(false)
  const baseType = recording.blob.type.split(';')[0]
  const extension = baseType === 'audio/mp4' ? 'm4a' : baseType === 'audio/ogg' ? 'ogg' : 'webm'

  useEffect(() => {
    const objectUrl = URL.createObjectURL(recording.blob)
    const audio = audioRef.current
    setUrl(objectUrl)
    setPlaybackError(false)
    return () => {
      audio?.pause()
      audio?.removeAttribute('src')
      audio?.load()
      URL.revokeObjectURL(objectUrl)
    }
  }, [recording])

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-4">
      <h3 className="font-medium">{t('preview')}</h3>
      <audio ref={audioRef} controls preload="metadata" src={url ?? undefined} aria-label={t('preview')} className="w-full"
        onError={() => setPlaybackError(true)} />
      {playbackError && <p role="alert" className="text-sm">{t('playbackError')}</p>}
      <div className="flex flex-wrap items-center gap-4">
        {url && <a className="text-sm font-medium underline underline-offset-4" href={url} download={`saga-local-recording.${extension}`}>{t('download')}</a>}
        <Button type="button" variant="ghost" onClick={onClose}>{t('close')}</Button>
      </div>
    </div>
  )
}
