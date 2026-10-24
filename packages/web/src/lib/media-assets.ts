export type MediaAssetState =
  | 'pending_upload'
  | 'uploaded'
  | 'verifying'
  | 'ready'
  | 'quarantined'
  | 'deleting'
  | 'deleted'

export interface AssetManifestInput {
  id: string
  kind: string
  originalFilename?: string | null
  mimeType: string
  byteSize: number
  sha256: string
  state: MediaAssetState
}

export interface AssetManifestEntry {
  assetId: string
  kind: string
  filename: string
  mimeType: string
  byteSize: number
  sha256: string
  state: MediaAssetState
}

export interface ExportAssetRow {
  id: string
  kind: string
  original_filename?: string | null
  mime_type: string
  byte_size?: number | null
  sha256?: string | null
  state: MediaAssetState
  version: number
}

export interface ExportManifest {
  version: 1
  assets: Array<AssetManifestEntry & { assetVersion: number }>
}

const transitions: Record<MediaAssetState, readonly MediaAssetState[]> = {
  pending_upload: ['uploaded', 'quarantined', 'deleting'],
  uploaded: ['verifying', 'quarantined', 'deleting'],
  verifying: ['ready', 'quarantined', 'deleting'],
  ready: ['deleting'],
  quarantined: ['deleting'],
  deleting: ['deleted'],
  deleted: [],
}

export function assertAssetTransition(from: MediaAssetState, to: MediaAssetState): void {
  if (!transitions[from]?.includes(to)) {
    throw new Error(`Invalid asset state transition: ${from} -> ${to}`)
  }
}

export function buildAssetIdempotencyKey(input: {
  projectId: string
  bucket: string
  objectKey: string
  version: number
}): string {
  return `${input.projectId}:${input.bucket}:${input.objectKey}:v${input.version}`
}

export function safeExportFilename(filename: string | null | undefined): string {
  const basename = (filename || '').split('\\').join('/').split('/').pop() || ''
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[^A-Za-z0-9._ ()-]/g, '_')
    .trim()
    .replace(/^\.+$/, '')
  return cleaned || 'unnamed-asset'
}

export function buildAssetManifestEntry(input: AssetManifestInput): AssetManifestEntry {
  return {
    assetId: input.id,
    kind: input.kind,
    filename: safeExportFilename(input.originalFilename),
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    sha256: input.sha256,
    state: input.state,
  }
}

export function buildExportManifest(rows: ExportAssetRow[]): ExportManifest {
  return {
    version: 1,
    assets: rows.map(row => {
      if (row.state !== 'ready' || typeof row.byte_size !== 'number' || row.byte_size < 0 ||
          typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256)) {
        throw new Error(`Asset is not complete for export: ${row.id}`)
      }
      return {
        ...buildAssetManifestEntry({
          id: row.id,
          kind: row.kind,
          originalFilename: row.original_filename,
          mimeType: row.mime_type,
          byteSize: row.byte_size,
          sha256: row.sha256,
          state: row.state,
        }),
        assetVersion: row.version,
      }
    }),
  }
}
