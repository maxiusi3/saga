'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TwoEntryProjectHub } from './TwoEntryProjectHub'
import { PublicationDeliveryPanel } from './PublicationDeliveryPanel'
import {
  searchProjectArchive, getSearchCitationAudioUrl, importProjectAudio,
  type ArchiveSearchFilters,
} from '@/lib/project-hub-client'
import type { ProvenanceSearchCitation } from '@/lib/server/provenance-search'

interface ConnectedProjectHubProps {
  projectId: string
  projectName: string
  userId: string
  locale: string
  canUpload: boolean
  canRecord: boolean
  canInvite: boolean
}

export function ConnectedProjectHub(props: ConnectedProjectHubProps) {
  // A new family/session/permission context must never inherit private results,
  // pending imports, signed playback URLs, or callbacks from the previous one.
  const key = [props.projectId, props.userId, props.canUpload, props.canRecord, props.canInvite].join(':')
  return <ProjectHubSession key={key} {...props} />
}

function ProjectHubSession({ projectId, projectName, userId, locale, canUpload, canRecord, canInvite }: ConnectedProjectHubProps) {
  const lifetime = useRef(new AbortController())
  const input = useRef<HTMLInputElement>(null)
  const player = useRef<HTMLAudioElement>(null)
  const playbackVersion = useRef(0)
  const importInFlight = useRef(false)
  const [showCaptureChoices, setShowCaptureChoices] = useState(false)
  const [selection, setSelection] = useState<{ file: File; key: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [playback, setPlayback] = useState<{ url: string; citation: ProvenanceSearchCitation } | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const basePath = `/${encodeURIComponent(locale)}/dashboard/projects/${encodeURIComponent(projectId)}`

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => {
      controller.abort()
      playbackVersion.current += 1
    }
  }, [])

  useEffect(() => {
    const audio = player.current
    return () => {
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    }
  }, [playback])

  const search = useCallback((filters: ArchiveSearchFilters) => {
    playbackVersion.current += 1
    player.current?.pause()
    setPlayback(null)
    setAudioError(null)
    return searchProjectArchive(projectId, filters, lifetime.current.signal)
  }, [projectId])

  async function upload() {
    if (!selection || !canUpload || importInFlight.current) return
    const signal = lifetime.current.signal
    importInFlight.current = true
    setUploading(true)
    setUploadError(null)
    setUploadMessage(null)
    try {
      const result = await importProjectAudio(projectId, selection.file, selection.key, signal)
      if (signal.aborted) return
      setUploadMessage(result.state === 'ready'
        ? 'Original audio verified. Keep your own copy as well.'
        : 'Uploaded; audio verification is still pending. Keep your original file.')
    } catch {
      if (!signal.aborted) setUploadError('Upload was not confirmed. Your file is kept; you can retry.')
    } finally {
      importInFlight.current = false
      if (!signal.aborted) setUploading(false)
    }
  }

  async function seek(citation: ProvenanceSearchCitation) {
    if (citation.sourceKind !== 'original_transcript' || !citation.mediaAssetId || citation.startMs === null || citation.endMs === null) return
    const version = ++playbackVersion.current
    const signal = lifetime.current.signal
    player.current?.pause()
    setPlayback(null)
    setAudioError(null)
    try {
      const url = await getSearchCitationAudioUrl(projectId, citation, signal)
      if (!signal.aborted && version === playbackVersion.current) setPlayback({ url, citation })
    } catch {
      if (!signal.aborted && version === playbackVersion.current) setAudioError('Original audio is unavailable. Search again or try later.')
    }
  }

  return <section aria-label="Connected family archive" className="mb-8 space-y-4">
    <TwoEntryProjectHub
      projectId={projectId}
      projectName={projectName}
      onSelectUploadExisting={canUpload ? () => input.current?.click() : undefined}
      onSelectRecordOrInvite={canRecord || canInvite ? () => setShowCaptureChoices(true) : undefined}
      onSearch={search}
      showArchiveExport={false}
      onSeekAudioCitation={citation => { void seek(citation) }}
    />
    <PublicationDeliveryPanel projectId={projectId} actorId={userId} />
    {showCaptureChoices && <nav aria-label="Record or invite" className="flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-white p-4">
      {canRecord && <Link className="rounded px-4 py-3 font-medium underline" href={`${basePath}/record`}>Record a new story</Link>}
      {canInvite && <Link className="rounded px-4 py-3 font-medium underline" href={`${basePath}/invitations`}>Manage family invitations</Link>}
    </nav>}
    <input ref={input} type="file" accept="audio/*" aria-label="Select existing audio" className="sr-only"
      disabled={!canUpload || uploading}
      onChange={event => {
        const file = event.target.files?.[0]
        if (file && canUpload && !importInFlight.current) {
          setSelection({ file, key: `hub-${crypto.randomUUID()}` })
          setUploadMessage(null)
          setUploadError(null)
        }
      }} />
    {selection && <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <p className="break-all text-sm font-medium">{selection.file.name}</p>
      <p className="text-sm text-stone-600">Maximum 100 MiB. Import does not start AI processing. Do not remove your original while verification is pending.</p>
      <button type="button" disabled={uploading || !canUpload} onClick={() => { void upload() }}
        className="min-h-[44px] rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {uploading ? 'Uploading and checking...' : 'Upload selected audio'}
      </button>
      {uploadMessage && <p role="status" className="text-sm text-stone-800">{uploadMessage}</p>}
      {uploadError && <p role="alert" className="text-sm text-red-700">{uploadError}</p>}
    </div>}
    {playback && <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-medium">{playback.citation.storyTitle}</p>
      <audio key={playback.url} ref={player} src={playback.url} controls preload="metadata" crossOrigin="anonymous"
        aria-label="Cited original audio" className="w-full"
        onLoadedMetadata={event => {
          const audio = event.currentTarget
          if (playback.citation.startMs === null || playback.citation.endMs === null) return
          const start = playback.citation.startMs / 1000
          if (!Number.isFinite(audio.duration) || start >= audio.duration || playback.citation.endMs / 1000 > audio.duration) {
            setAudioError('This source time range could not be verified against the audio.')
            return
          }
          audio.currentTime = start
          void audio.play().catch(() => {
            if (!lifetime.current.signal.aborted) setAudioError('Use the audio play button to listen to this source.')
          })
        }}
        onTimeUpdate={event => {
          if (playback.citation.endMs !== null && event.currentTarget.currentTime >= playback.citation.endMs / 1000) event.currentTarget.pause()
        }}
        onError={() => setAudioError('Original audio is unavailable. Search again or try later.')} />
    </div>}
    {audioError && <p role="alert" className="text-sm text-red-700">{audioError}</p>}
  </section>
}
