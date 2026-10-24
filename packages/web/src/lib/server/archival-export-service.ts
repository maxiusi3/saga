import { createHash, randomUUID } from 'crypto'
import JSZip from 'jszip'
import type { BookletChapterSection, FrozenPublicationSnapshot, HostingRetentionSchedule } from '@saga/shared/types/export'
import {
  addVerifiedMediaAssetsToZip,
  buildOfflineExportHtml,
  type ExportableMediaAsset,
  type OfflineExportStoryItem,
} from '@/lib/server/media-export'
import type { ExportManifest } from '@/lib/media-assets'

export interface ArchivalStoryInput extends OfflineExportStoryItem {
  revisionId?: string | null
  revisionVersion?: number | null
  chapterTitle?: string | null
  provenanceNotes?: string[]
  disputedVariants?: Array<{
    memberName: string
    statement: string
  }>
}

export interface BuildReadingBookletPdfInput {
  projectId: string
  projectName: string
  projectDescription?: string | null
  snapshotVersion: number
  exportedAt: string
  stories: readonly ArchivalStoryInput[]
  chapters?: readonly BookletChapterSection[]
  manifest: ExportManifest
}

export interface BuildPublicationSnapshotInput {
  snapshotId?: string
  projectId: string
  snapshotVersion: number
  createdBy: string
  exportedAt?: string
  hostingMonths?: number
  stories: readonly ArchivalStoryInput[]
  chapters?: readonly BookletChapterSection[]
  manifest: ExportManifest
  pdfBytes: Buffer
}

function sanitizePdfText(input: string | null | undefined): string {
  return String(input ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .trim()
}

export function computeHostingRetentionSchedule(
  exportedAtIso: string,
  hostingMonths = 12,
): HostingRetentionSchedule {
  const exportedDate = new Date(exportedAtIso)
  if (Number.isNaN(exportedDate.getTime())) {
    throw new Error('Invalid exportedAt timestamp for hosting schedule')
  }
  const expiresDate = new Date(exportedDate.getTime())
  expiresDate.setUTCMonth(expiresDate.getUTCMonth() + hostingMonths)

  const reminder90d = new Date(expiresDate.getTime() - 90 * 24 * 60 * 60 * 1000)
  const reminder30d = new Date(expiresDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    hostingMonths,
    exportedAt: exportedDate.toISOString(),
    retentionExpiresAt: expiresDate.toISOString(),
    reminder90dAt: reminder90d.toISOString(),
    reminder30dAt: reminder30d.toISOString(),
    offlineIndependentCopyIncluded: true,
  }
}

export function buildDefaultChapters(stories: readonly ArchivalStoryInput[]): BookletChapterSection[] {
  if (stories.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: 'Chapter 1: Family Memories',
        storyIds: [],
        summary: 'No approved stories in this snapshot yet.',
      },
    ]
  }

  const byChapter = new Map<string, ArchivalStoryInput[]>()
  for (const story of stories) {
    const key = (story.chapterTitle || 'Family Memories & Oral History').trim()
    const list = byChapter.get(key) ?? []
    list.push(story)
    byChapter.set(key, list)
  }

  const chapters: BookletChapterSection[] = []
  let idx = 1
  for (const [title, group] of byChapter.entries()) {
    chapters.push({
      chapterNumber: idx,
      title: `Chapter ${idx}: ${title}`,
      storyIds: group.map(s => s.id),
      summary: group
        .map(s => s.summary || s.title || s.id)
        .filter(Boolean)
        .join(' · ')
        .slice(0, 280),
    })
    idx += 1
  }
  return chapters
}

/**
 * Generates a standards-compliant, self-contained PDF 1.4 reading booklet
 * with zero external font/network dependencies so any device can open it offline.
 */
export function buildReadingBookletPdf(input: BuildReadingBookletPdfInput): Buffer {
  const chapters = input.chapters && input.chapters.length > 0
    ? input.chapters
    : buildDefaultChapters(input.stories)

  const lines: string[] = [
    `UR SAGA FAMILY BIOGRAPHY BOOKLET`,
    `Project: ${sanitizePdfText(input.projectName || 'Family Biography')}`,
    `Snapshot Version: v${input.snapshotVersion} | Exported: ${sanitizePdfText(input.exportedAt)}`,
    `Verified Original Media Assets: ${input.manifest.assets.length}`,
    `------------------------------------------------------------------------`,
    `CHAPTER OUTLINE (${chapters.length})`,
  ]

  for (const ch of chapters) {
    lines.push(`  ${sanitizePdfText(ch.title)} (${ch.storyIds.length} stories)`)
    if (ch.summary) {
      lines.push(`    Summary: ${sanitizePdfText(ch.summary).slice(0, 90)}`)
    }
  }

  lines.push(`------------------------------------------------------------------------`)
  lines.push(`STORIES & PROVENANCE RECORD (${input.stories.length})`)

  for (const story of input.stories) {
    lines.push(`* Story [${sanitizePdfText(story.id)}]: ${sanitizePdfText(story.title || 'Untitled')}`)
    if (story.revisionId) {
      lines.push(`  Approved Revision: ${sanitizePdfText(story.revisionId)} (v${story.revisionVersion ?? 1})`)
    }
    if (story.summary) {
      lines.push(`  Summary: ${sanitizePdfText(story.summary).slice(0, 100)}`)
    }
    if (story.transcript) {
      lines.push(`  Excerpt: ${sanitizePdfText(story.transcript).slice(0, 110)}`)
    }
    if (story.provenanceNotes && story.provenanceNotes.length > 0) {
      for (const note of story.provenanceNotes) {
        lines.push(`  [Provenance] ${sanitizePdfText(note).slice(0, 100)}`)
      }
    }
    if (story.disputedVariants && story.disputedVariants.length > 0) {
      for (const v of story.disputedVariants) {
        lines.push(`  [Disputed Memory - ${sanitizePdfText(v.memberName)}]: ${sanitizePdfText(v.statement).slice(0, 90)}`)
      }
    }
  }

  lines.push(`------------------------------------------------------------------------`)
  lines.push(`MEDIA ASSET SHA-256 CHECKSUM LEDGER`)
  for (const asset of input.manifest.assets) {
    lines.push(`- ${sanitizePdfText(asset.filename)} (${asset.mimeType}, ${asset.byteSize}B) SHA256:${asset.sha256.slice(0, 24)}...`)
  }

  const contentLines = ['BT', '/F1 10 Tf', '50 760 Td', '13 TL']
  for (const line of lines.slice(0, 52)) {
    contentLines.push(`(${line}) Tj T*`)
  }
  contentLines.push('ET')
  const streamBody = contentLines.join('\n')

  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf8')} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'utf8')
}

export function buildFrozenPublicationSnapshot(
  input: BuildPublicationSnapshotInput,
): FrozenPublicationSnapshot {
  const exportedAt = input.exportedAt ?? new Date().toISOString()
  const chapters = input.chapters && input.chapters.length > 0
    ? [...input.chapters]
    : buildDefaultChapters(input.stories)
  const pdfSha256 = createHash('sha256').update(input.pdfBytes).digest('hex')
  const archiveManifestSha256 = createHash('sha256')
    .update(JSON.stringify(input.manifest))
    .digest('hex')

  return {
    snapshotId: input.snapshotId ?? randomUUID(),
    projectId: input.projectId,
    snapshotVersion: input.snapshotVersion,
    createdBy: input.createdBy,
    createdAt: exportedAt,
    storyRevisionIds: input.stories
      .map(s => s.revisionId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    chapters,
    pdfSha256,
    archiveManifestSha256,
    hostingRetention: computeHostingRetentionSchedule(exportedAt, input.hostingMonths ?? 12),
  }
}

export async function assembleCompleteArchivalPackage(
  zip: JSZip,
  params: {
    projectId: string
    projectName: string
    projectDescription?: string | null
    createdBy: string
    snapshotVersion?: number
    exportedAt?: string
    assets: ExportableMediaAsset[]
    stories: readonly ArchivalStoryInput[]
    readObject: (asset: ExportableMediaAsset) => Promise<Buffer>
  },
): Promise<{
  manifest: ExportManifest
  pdfBytes: Buffer
  snapshot: FrozenPublicationSnapshot
  offlineHtml: string
}> {
  const exportedAt = params.exportedAt ?? new Date().toISOString()
  const snapshotVersion = params.snapshotVersion ?? 1

  const manifest = await addVerifiedMediaAssetsToZip(zip, params.assets, params.readObject)
  const chapters = buildDefaultChapters(params.stories)
  const pdfBytes = buildReadingBookletPdf({
    projectId: params.projectId,
    projectName: params.projectName,
    projectDescription: params.projectDescription,
    snapshotVersion,
    exportedAt,
    stories: params.stories,
    chapters,
    manifest,
  })
  const snapshot = buildFrozenPublicationSnapshot({
    projectId: params.projectId,
    snapshotVersion,
    createdBy: params.createdBy,
    exportedAt,
    stories: params.stories,
    chapters,
    manifest,
    pdfBytes,
  })
  const offlineHtml = buildOfflineExportHtml({
    projectName: params.projectName,
    projectDescription: params.projectDescription,
    exportedAt,
    stories: params.stories,
    manifest,
  })

  zip.file('index.html', offlineHtml)
  zip.file('biography-booklet.pdf', pdfBytes)
  zip.file('chapters.json', JSON.stringify(chapters, null, 2))
  zip.file('publication-snapshot.json', JSON.stringify(snapshot, null, 2))

  return {
    manifest,
    pdfBytes,
    snapshot,
    offlineHtml,
  }
}
