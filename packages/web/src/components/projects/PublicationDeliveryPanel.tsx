'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicationDeliveryStatus } from '@saga/shared/types/export'
import { readPublication, requestPublication, retryPublication } from '@/lib/publication-client'

/** Remounted by ConnectedProjectHub when project/user/permission context changes. */
export function PublicationDeliveryPanel({ projectId, actorId }: { projectId: string; actorId: string }) {
  const [job, setJob] = useState<PublicationDeliveryStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef(new AbortController())
  const inFlight = useRef(false)
  useEffect(() => {
    const active = new AbortController()
    controller.current = active
    return () => active.abort()
  }, [projectId, actorId])

  async function perform(action: 'prepare' | 'read' | 'retry') {
    if (inFlight.current) return
    const signal = controller.current.signal
    inFlight.current = true
    setBusy(true); setError(null)
    try {
      const result = action === 'prepare' || !job ? await requestPublication(projectId, signal)
        : action === 'retry' ? await retryPublication(projectId, job.jobId, signal)
          : await readPublication(projectId, job.jobId, signal)
      if (!signal.aborted) setJob(result)
    } catch {
      if (!signal.aborted) setError('The archive status could not be confirmed. Check again; your source material is unchanged.')
    } finally {
      inFlight.current = false
      if (!signal.aborted) setBusy(false)
    }
  }

  return <section aria-label="Offline archive delivery" className="space-y-3 rounded-lg border border-stone-200 bg-white p-5">
    <h3 className="text-lg font-semibold">Your offline family archive</h3>
    <p className="text-sm text-stone-600">Includes original recordings and photos, approved stories, source transcripts, an offline reading page, and a complete PDF booklet.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => { void perform('prepare') }} className="min-h-[44px] rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Checking archive…' : job ? 'Prepare latest archive' : 'Prepare offline archive'}
      </button>
      {job && <button type="button" disabled={busy} onClick={() => { void perform('read') }} className="min-h-[44px] rounded border border-stone-300 px-4 py-2 disabled:opacity-50">Check archive status</button>}
      {job?.status === 'failed' && job.errorCode !== 'unsupported_text' && <button type="button" disabled={busy} onClick={() => { void perform('retry') }} className="min-h-[44px] rounded border border-stone-300 px-4 py-2 disabled:opacity-50">Retry archive preparation</button>}
    </div>
    {job && <p role="status" aria-atomic="true" className="text-sm">
      {error ? 'The latest archive status is unconfirmed. Check again before downloading.'
        : job.errorCode === 'unsupported_text' ? 'The PDF cannot render one or more characters. Update the unsupported text, then prepare a new archive.'
        : job.status === 'queued' ? 'Archive queued. You can leave this page and prepare again to recover its status.'
        : job.status === 'running' ? 'Your archive is being prepared. Check its status again shortly.'
          : job.status === 'ready' ? `Archive version ${job.snapshotVersion} is ready.`
            : job.status === 'revoked' ? 'This archive is unavailable because its source or access changed.'
              : 'Preparation did not finish. You can retry the same archive.'}
    </p>}
    {job?.status === 'ready' && !error && !busy && <a href={job.downloadUrl} download className="inline-flex min-h-[44px] items-center rounded bg-emerald-800 px-4 py-2 text-white">Download archive ZIP</a>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
