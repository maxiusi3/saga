import { createHash, randomUUID } from 'crypto'
import JSZip from 'jszip'
import PDFDocument from 'pdfkit'
import { existsSync } from 'fs'
import { resolve,isAbsolute } from 'path'
import type { BookletChapterSection, FrozenPublicationSnapshot, HostingRetentionSchedule } from '@saga/shared/types/export'
import {
  addVerifiedMediaAssetsToZip,
  buildOfflineExportHtml,
  type ExportableMediaAsset,
  type OfflineExportStoryItem,
} from '@/lib/server/media-export'
import type { ExportManifest } from '@/lib/media-assets'

export interface ArchivalStoryInput extends OfflineExportStoryItem {
  rawTranscript?: string | null
  rendition?: 'approved' | 'source_only'
  sourceTranscriptId?: string | null
  assertions?: unknown[]
  sourceTranscripts?: unknown[]
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

export class UnsupportedArchiveTextError extends Error { constructor(point:number){super(`Unsupported archive Unicode character U+${point.toString(16).toUpperCase()}`)} }

/** The bundled font is subset and embedded, so readers need no network/fonts. */
export function archiveFontPath(): string {
  const configured=process.env.ARCHIVE_FONT_PATH
  if(configured) {if(!isAbsolute(configured) || !existsSync(configured)) throw new Error('Archive Unicode font configuration is unavailable');return configured}
  const paths = [resolve(process.cwd(), 'assets/fonts/NotoSansCJKsc-Regular.otf'), resolve(process.cwd(), 'packages/web/assets/fonts/NotoSansCJKsc-Regular.otf')]
  const path = paths.find(existsSync)
  if (!path) throw new Error('Archive Unicode font is unavailable')
  return path
}

export function createReadingBookletPdfStream(input: BuildReadingBookletPdfInput): PDFKit.PDFDocument {
  const font = archiveFontPath()
  const doc = new PDFDocument({font, size:'A4', margin:54, pdfVersion:'1.4', info:{Title:input.projectName, Author:'UR Saga', CreationDate:new Date(input.exportedAt), ModDate:new Date(input.exportedAt)}})
  // PDFKit uses fontkit for embedded fonts. Validate every code point before
  // emitting text: a missing glyph must fail, never become an invisible .notdef.
  const embedded = (doc as unknown as {_font:{font:{hasGlyphForCodePoint:(point:number)=>boolean}}})._font.font
  const text = (value: string | null | undefined, size = 11) => {
    const content = String(value ?? '').replace(/\r\n?/g, '\n')
    for (const char of content) if (!'\n\t'.includes(char) && !embedded.hasGlyphForCodePoint(char.codePointAt(0)!)) {
      doc.destroy()
      throw new UnsupportedArchiveTextError(char.codePointAt(0)!)
    }
    doc.fontSize(size).text(content, {lineGap:4, paragraphGap:8}).moveDown(0.45)
  }
  let page=1
  doc.on('pageAdded', () => { page++ })
  text('UR SAGA / FAMILY BIOGRAPHY', 10)
  text(input.projectName, 24)
  text(input.projectDescription, 12)
  text(`Publication v${input.snapshotVersion} | ${input.exportedAt.slice(0,10)}`, 9)
  text('Approved biography and separately labelled original transcripts', 10)
  const chapters = input.chapters?.length ? input.chapters : buildDefaultChapters(input.stories)
  text('Contents',18)
  for (const chapter of chapters) text(chapter.title,12)
  for (const chapter of chapters) {
    doc.addPage(); text(chapter.title,19)
    for (const story of input.stories.filter(item=>chapter.storyIds.includes(item.id))) {
      text(story.title || 'Untitled story',16)
      text(story.revisionId ? `Approved rendition / revision ${story.revisionVersion ?? 1}` : 'Source only - not an approved biography',9)
      if(story.summary) {text('Summary',10);text(story.summary)}
      text(story.transcript)
      for (const note of story.provenanceNotes ?? []) text(`Provenance: ${note}`,9)
      for (const alternative of story.disputedVariants ?? []) text(`Alternative memory / ${alternative.memberName}: ${alternative.statement}`,10)
      if (story.rawTranscript != null && story.revisionId) {
        text('Original transcript (source record, separate from approved rendition)',12)
        text(story.rawTranscript,10)
      }
    }
  }
  doc.addPage(); text('Verified media and provenance',18)
  for (const asset of input.manifest.assets) {
    text(`${asset.filename} | ${asset.mimeType} | ${asset.byteSize} bytes`,10)
    text(`SHA-256 ${asset.sha256}`,8)
  }
  text(`End of complete publication / ${page} pages`,9)
  doc.end()
  return doc
}

export async function buildReadingBookletPdf(input: BuildReadingBookletPdfInput): Promise<Buffer> {
  const chunks:Buffer[]=[]
  for await (const chunk of createReadingBookletPdfStream(input)) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export function buildPublicationOfflineHtml(input: {projectName:string;projectDescription?:string|null;exportedAt:string;stories:readonly ArchivalStoryInput[];manifest:ExportManifest}): string {
  return buildOfflineExportHtml({...input, stories:input.stories.flatMap(story=>[
    {...story,title:`${story.title || 'Untitled'} (${story.revisionId ? 'Approved rendition' : 'Source only - unapproved'})`},
    ...(story.revisionId && story.rawTranscript != null ? [{id:`${story.id}-source`,title:'Original transcript (source record)',transcript:story.rawTranscript}] : []),
  ])})
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
    hostingRetention: input.hostingMonths ? computeHostingRetentionSchedule(exportedAt, input.hostingMonths) : null,
  }
}

export async function assembleCompleteArchivalPackage(
  zip: JSZip,
  params: {
    projectId: string
    projectName: string
    projectDescription?: string | null
    createdBy: string
    snapshotId?: string
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
  const pdfBytes = await buildReadingBookletPdf({
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
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    snapshotVersion,
    createdBy: params.createdBy,
    exportedAt,
    stories: params.stories,
    chapters,
    manifest,
    pdfBytes,
  })
  const offlineHtml = buildPublicationOfflineHtml({
    projectName: params.projectName,
    projectDescription: params.projectDescription,
    exportedAt,
    stories: params.stories,
    manifest,
  })

  zip.file('index.html', offlineHtml)
  zip.file('biography-booklet.pdf', pdfBytes)
  zip.file('sources-and-revisions.json', JSON.stringify(params.stories, null, 2))
  zip.file('chapters.json', JSON.stringify(chapters, null, 2))
  zip.file('publication-snapshot.json', JSON.stringify(snapshot, null, 2))

  return {
    manifest,
    pdfBytes,
    snapshot,
    offlineHtml,
  }
}
