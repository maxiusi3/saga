import { createHash } from 'crypto'
import JSZip from 'jszip'
import { buildExportManifest, safeExportFilename, type ExportAssetRow, type ExportManifest } from '@/lib/media-assets'

export interface ExportableMediaAsset extends ExportAssetRow {
  bucket: 'saga' | 'audio-recordings'
  object_key: string
  story_id?: string | null
  tombstoned?: boolean
}

export interface OfflineExportStoryItem {
  id: string
  title?: string | null
  transcript?: string | null
  summary?: string | null
  created_at?: string | null
}

export interface OfflineExportHtmlInput {
  projectName: string
  projectDescription?: string | null
  exportedAt: string
  stories: readonly OfflineExportStoryItem[]
  manifest: ExportManifest
}

export function escapeHtmlText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function escapeEmbeddedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function buildOfflineExportHtml(input: OfflineExportHtmlInput): string {
  const safeTitle = escapeHtmlText(input.projectName || 'Saga Family Archive')
  const safeDesc = escapeHtmlText(input.projectDescription || '')
  const safeDate = escapeHtmlText(input.exportedAt)

  const storyCards = input.stories.map(story => {
    const title = escapeHtmlText(story.title || 'Untitled Story')
    const createdAt = escapeHtmlText(story.created_at || '')
    const summary = escapeHtmlText(story.summary || '')
    const transcript = escapeHtmlText(story.transcript || '')
    return `<article class="card story-card" data-story-id="${escapeHtmlText(story.id)}">
      <h3>${title}</h3>
      ${createdAt ? `<p class="meta">Recorded: ${createdAt}</p>` : ''}
      ${summary ? `<div class="section"><strong>Summary</strong><p>${summary}</p></div>` : ''}
      ${transcript ? `<div class="section"><strong>Transcript</strong><pre class="transcript">${transcript}</pre></div>` : ''}
    </article>`
  }).join('\n')

  const assetCards = input.manifest.assets.map(asset => {
    const relPath = `media/${encodeURIComponent(asset.assetId)}/${encodeURIComponent(asset.filename)}`
    const displayPath = escapeHtmlText(`media/${asset.assetId}/${asset.filename}`)
    const safeName = escapeHtmlText(asset.filename)
    const safeMime = escapeHtmlText(asset.mimeType)
    const safeSha = escapeHtmlText(asset.sha256)
    const mediaElement = asset.mimeType.startsWith('audio/')
      ? `<audio controls preload="metadata" src="${relPath}"></audio>`
      : asset.mimeType.startsWith('image/')
        ? `<img class="preview-image" src="${relPath}" alt="${safeName}" loading="lazy" />`
        : ''
    return `<div class="card asset-card" data-asset-id="${escapeHtmlText(asset.assetId)}">
      <h4>${safeName}</h4>
      <p class="meta">Kind: ${escapeHtmlText(asset.kind)} · MIME: ${safeMime} · Size: ${Number(asset.byteSize)} bytes · v${Number(asset.assetVersion)}</p>
      <p class="meta sha">SHA-256: <code>${safeSha}</code></p>
      ${mediaElement}
      <p><a href="${relPath}" download="${safeName}">Download (${displayPath})</a></p>
    </div>`
  }).join('\n')

  const embeddedPayload = escapeEmbeddedJson({
    projectName: input.projectName,
    exportedAt: input.exportedAt,
    storiesCount: input.stories.length,
    manifest: input.manifest,
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <title>${safeTitle} — Offline Archive</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem auto; max-width: 920px; padding: 0 1rem; color: #1f2937; background: #f9fafb; line-height: 1.5; }
    header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    .meta { color: #6b7280; font-size: 0.875rem; margin: 0.25rem 0; }
    .sha code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; word-break: break-all; }
    .transcript { white-space: pre-wrap; background: #f3f4f6; padding: 0.75rem; border-radius: 6px; font-family: inherit; }
    .preview-image { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5rem 0; }
    audio { width: 100%; margin: 0.5rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>${safeTitle}</h1>
    ${safeDesc ? `<p>${safeDesc}</p>` : ''}
    <p class="meta">Offline Self-Contained Archive · Exported ${safeDate}</p>
  </header>
  <main>
    <section>
      <h2>Verified Media Assets (${input.manifest.assets.length})</h2>
      ${assetCards || '<p class="meta">No verified media assets in this export.</p>'}
    </section>
    <section>
      <h2>Stories (${input.stories.length})</h2>
      ${storyCards || '<p class="meta">No stories in this export.</p>'}
    </section>
  </main>
  <script id="saga-archive-data" type="application/json">${embeddedPayload}</script>
</body>
</html>
`
}

export async function addVerifiedMediaAssetsToZip(
  zip: JSZip,
  assets: ExportableMediaAsset[],
  readObject: (asset: ExportableMediaAsset) => Promise<Buffer>,
): Promise<ExportManifest> {
  for (const asset of assets) {
    if (asset.tombstoned) {
      throw new Error(`Asset is tombstoned and blocked from export: ${asset.id}`)
    }
  }
  const manifest = buildExportManifest(assets)
  const files: Array<{ path: string; bytes: Buffer }> = []
  for (const asset of assets) {
    const bytes = await readObject(asset)
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (bytes.length !== asset.byte_size || hash !== asset.sha256) {
      throw new Error(`Media asset failed export verification: ${asset.id}`)
    }
    files.push({ path: `media/${asset.id}/${safeExportFilename(asset.original_filename)}`, bytes })
  }
  for (const file of files) zip.file(file.path, file.bytes)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  return manifest
}
