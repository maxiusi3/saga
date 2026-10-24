import { createHash } from 'crypto'
import JSZip from 'jszip'
import {
  assembleCompleteArchivalPackage,
  buildFrozenPublicationSnapshot,
  buildReadingBookletPdf,
  computeHostingRetentionSchedule,
} from '@/lib/server/archival-export-service'

describe('T09 Archival Export Service, Reading Booklet PDF & Frozen Publication Snapshot', () => {
  it('computes 12-month hosting retention schedule with 90-day and 30-day expiry reminders (D11/D12)', () => {
    const schedule = computeHostingRetentionSchedule('2026-10-24T00:00:00.000Z', 12)
    expect(schedule.hostingMonths).toBe(12)
    expect(schedule.retentionExpiresAt).toBe('2027-10-24T00:00:00.000Z')
    expect(new Date(schedule.reminder90dAt).getTime()).toBeLessThan(
      new Date(schedule.reminder30dAt).getTime(),
    )
    expect(new Date(schedule.reminder30dAt).getTime()).toBeLessThan(
      new Date(schedule.retentionExpiresAt).getTime(),
    )
    expect(schedule.offlineIndependentCopyIncluded).toBe(true)
  })

  it('builds a valid PDF 1.4 reading booklet and frozen publication snapshot in a complete ZIP archive', async () => {
    const zip = new JSZip()
    const audioBytes = Buffer.from('RIFF-fake-verified-audio-bytes', 'utf8')
    const audioSha = createHash('sha256').update(audioBytes).digest('hex')

    const result = await assembleCompleteArchivalPackage(zip, {
      projectId: 'proj-p3-1',
      projectName: 'Grandma Eleanor Saga',
      projectDescription: 'Oral histories from Chicago and Boston',
      createdBy: 'user-owner-1',
      snapshotVersion: 2,
      exportedAt: '2026-10-24T12:00:00.000Z',
      assets: [
        {
          id: 'asset-audio-1',
          kind: 'audio_master',
          original_filename: 'chicago-1968.webm',
          mime_type: 'audio/webm',
          byte_size: audioBytes.length,
          sha256: audioSha,
          state: 'ready',
          version: 1,
          bucket: 'audio-recordings',
          object_key: 'proj-p3-1/chicago-1968.webm',
        },
      ],
      stories: [
        {
          id: 'story-1',
          title: 'Moving to Chicago in 1968',
          summary: 'Grandma Eleanor moved to Chicago with Uncle Bob in 1968.',
          transcript: 'In 1968 Grandma Eleanor moved to Chicago with Uncle Bob.',
          revisionId: 'rev-approved-1',
          revisionVersion: 1,
          chapterTitle: 'Early Years in the Midwest',
          provenanceNotes: ['Family-supplemented note: street name confirmed from 1969 letter'],
          disputedVariants: [
            {
              memberName: 'Aunt Clara',
              statement: 'Remembers the move happening in late autumn 1969.',
            },
          ],
        },
      ],
      readObject: async () => audioBytes,
    })

    const pdfHeader = result.pdfBytes.subarray(0, 8).toString('utf8')
    const pdfTail = result.pdfBytes.subarray(result.pdfBytes.length - 16).toString('utf8')
    expect(pdfHeader).toContain('%PDF-1.4')
    expect(pdfTail).toContain('%%EOF')

    expect(result.snapshot.snapshotVersion).toBe(2)
    expect(result.snapshot.storyRevisionIds).toEqual(['rev-approved-1'])
    expect(result.snapshot.pdfSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.snapshot.chapters.length).toBe(1)

    expect(zip.file('index.html')).not.toBeNull()
    expect(zip.file('biography-booklet.pdf')).not.toBeNull()
    expect(zip.file('chapters.json')).not.toBeNull()
    expect(zip.file('publication-snapshot.json')).not.toBeNull()
    expect(zip.file('manifest.json')).not.toBeNull()
  })
})
