'use client'

import React, { useState } from 'react'
import type { ProvenanceSearchCitation } from '@/lib/server/provenance-search'

export interface TwoEntryProjectHubProps {
  projectId: string
  projectName: string
  hostingExpiresAt?: string | null
  onSelectUploadExisting?: () => void
  onSelectRecordOrInvite?: () => void
  onTriggerExport?: () => Promise<void> | void
  onSearch?: (params: {
    query: string
    person?: string
    date?: string
    place?: string
  }) => Promise<{
    status: 'grounded_answer' | 'no_matching_sources'
    answerText: string
    citations: ProvenanceSearchCitation[]
  }>
  onSeekAudioCitation?: (citation: ProvenanceSearchCitation) => void
}

export function TwoEntryProjectHub({
  projectId,
  projectName,
  hostingExpiresAt,
  onSelectUploadExisting,
  onSelectRecordOrInvite,
  onTriggerExport,
  onSearch,
  onSeekAudioCitation,
}: TwoEntryProjectHubProps) {
  const [query, setQuery] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [placeFilter, setPlaceFilter] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<{
    status: 'grounded_answer' | 'no_matching_sources'
    answerText: string
    citations: ProvenanceSearchCitation[]
  } | null>(null)
  const [exporting, setExporting] = useState(false)

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!onSearch) return
    setSearching(true)
    try {
      const res = await onSearch({
        query,
        person: personFilter || undefined,
        date: dateFilter || undefined,
        place: placeFilter || undefined,
      })
      setSearchResult(res)
    } finally {
      setSearching(false)
    }
  }

  async function handleExportClick() {
    if (!onTriggerExport) return
    setExporting(true)
    try {
      await onTriggerExport()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
      data-testid="two-entry-project-hub"
      data-project-id={projectId}
    >
      <header className="border-b border-stone-200 pb-4">
        <h2 className="text-2xl font-semibold text-stone-900">{projectName}</h2>
        <p className="mt-1 text-base text-stone-600">
          Choose how your family wants to preserve memories today — every original recording is checksum-verified and downloadable offline.
        </p>
      </header>

      {/* Two Primary Entry Paths (D04/D05 & T01/T09) */}
      <section aria-label="Primary story collection entries" className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-50 p-5">
          <div>
            <span className="inline-block rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
              Entry 1 · Existing Recordings
            </span>
            <h3 className="mt-2 text-lg font-semibold text-stone-900">
              Import &amp; Organize Existing Audio
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Upload family tapes, voice memos, or interview files. Original audio is preserved intact alongside time-aligned transcripts and provenance verification.
            </p>
          </div>
          <button
            type="button"
            onClick={onSelectUploadExisting}
            data-testid="entry-upload-existing-btn"
            className="mt-4 min-h-[48px] w-full rounded-lg bg-stone-900 px-4 py-3 text-base font-medium text-white hover:bg-stone-800"
          >
            Upload Existing Audio
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-50 p-5">
          <div>
            <span className="inline-block rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              Entry 2 · Guided Family Recording
            </span>
            <h3 className="mt-2 text-lg font-semibold text-stone-900">
              Record Together or Invite a Storyteller
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Record directly in the browser with local crash-recovery chunks, or send a one-tap question link to a parent or grandparent.
            </p>
          </div>
          <button
            type="button"
            onClick={onSelectRecordOrInvite}
            data-testid="entry-record-or-invite-btn"
            className="mt-4 min-h-[48px] w-full rounded-lg bg-emerald-800 px-4 py-3 text-base font-medium text-white hover:bg-emerald-700"
          >
            Record or Invite Family Member
          </button>
        </div>
      </section>

      {/* Permission-Filtered Provenance Search (T10) */}
      <section aria-label="Search family archive with provenance" className="rounded-lg border border-stone-200 p-5">
        <h3 className="text-lg font-semibold text-stone-900">
          Search Verified Memories (People, Years, Places)
        </h3>
        <form onSubmit={handleSearchSubmit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search keywords or questions..."
              aria-label="Search query"
              data-testid="provenance-search-query-input"
              className="min-h-[44px] rounded-md border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              type="text"
              value={personFilter}
              onChange={e => setPersonFilter(e.target.value)}
              placeholder="Person (e.g. Grandma Eleanor)"
              aria-label="Filter by person"
              data-testid="provenance-search-person-input"
              className="min-h-[44px] rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              placeholder="Year (e.g. 1968)"
              aria-label="Filter by year"
              data-testid="provenance-search-year-input"
              className="min-h-[44px] rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={placeFilter}
              onChange={e => setPlaceFilter(e.target.value)}
              placeholder="Place (e.g. Chicago)"
              aria-label="Filter by place"
              data-testid="provenance-search-place-input"
              className="min-h-[44px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching}
              data-testid="provenance-search-submit-btn"
              className="min-h-[44px] rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search Archive'}
            </button>
          </div>
        </form>

        {searchResult && (
          <div className="mt-4 rounded-md bg-stone-50 p-4" data-testid="provenance-search-results">
            <p className="text-sm font-medium text-stone-800" data-testid="provenance-search-answer">
              {searchResult.answerText}
            </p>
            {searchResult.citations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {searchResult.citations.map(citation => (
                  <li
                    key={citation.entryId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-200 bg-white p-3 text-sm"
                  >
                    <div>
                      <span className="font-semibold text-stone-900">{citation.storyTitle}</span>
                      <p className="text-stone-700">&ldquo;{citation.quotedText}&rdquo;</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSeekAudioCitation?.(citation)}
                      data-testid={`seek-citation-${citation.segmentId}`}
                      className="min-h-[40px] rounded bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
                    >
                      Play Audio ({(citation.startMs / 1000).toFixed(1)}s–{(citation.endMs / 1000).toFixed(1)}s)
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Complete Self-Contained Archive & Reading Booklet PDF Export (T09 / D11 / D12) */}
      <section
        aria-label="Offline archive and PDF booklet export"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50 p-5"
      >
        <div>
          <h3 className="text-lg font-semibold text-stone-900">
            Complete Offline Archive &amp; Printable Booklet PDF
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Includes SHA-256 verified original audio &amp; photos, offline browsable <code>index.html</code>, and <code>biography-booklet.pdf</code>.
            {hostingExpiresAt ? ` Server hosting active until ${hostingExpiresAt} (reminders at 90d & 30d).` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportClick}
          disabled={exporting}
          data-testid="export-complete-archive-btn"
          className="min-h-[48px] rounded-lg border border-stone-900 bg-white px-5 py-2.5 text-base font-medium text-stone-900 hover:bg-stone-100 disabled:opacity-50"
        >
          {exporting ? 'Preparing Archive...' : 'Download Complete Archive (.zip + .pdf)'}
        </button>
      </section>
    </div>
  )
}
