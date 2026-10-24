import {
  assertAssetTransition,
  buildAssetIdempotencyKey,
  buildAssetManifestEntry,
  buildExportManifest,
  safeExportFilename,
} from '@/lib/media-assets'

describe('media asset domain rules', () => {
  it('allows only the documented forward lifecycle transitions', () => {
    expect(() => assertAssetTransition('pending_upload', 'uploaded')).not.toThrow()
    expect(() => assertAssetTransition('uploaded', 'verifying')).not.toThrow()
    expect(() => assertAssetTransition('verifying', 'ready')).not.toThrow()
    expect(() => assertAssetTransition('verifying', 'quarantined')).not.toThrow()
    expect(() => assertAssetTransition('ready', 'deleted')).toThrow('Invalid asset state transition')
  })

  it('builds an idempotency key from project, object and processing version', () => {
    expect(buildAssetIdempotencyKey({
      projectId: 'project-a',
      bucket: 'audio-recordings',
      objectKey: 'u/projects/project-a/stories/temp/one.webm',
      version: 1,
    })).toBe('project-a:audio-recordings:u/projects/project-a/stories/temp/one.webm:v1')
  })

  it('creates a manifest entry with a safe filename and immutable integrity fields', () => {
    expect(buildAssetManifestEntry({
      id: 'asset-1',
      kind: 'original_audio',
      originalFilename: '../family recording.webm',
      mimeType: 'audio/webm',
      byteSize: 12,
      sha256: 'a'.repeat(64),
      state: 'ready',
    })).toEqual({
      assetId: 'asset-1',
      kind: 'original_audio',
      filename: 'family recording.webm',
      mimeType: 'audio/webm',
      byteSize: 12,
      sha256: 'a'.repeat(64),
      state: 'ready',
    })
    expect(safeExportFilename('')).toBe('unnamed-asset')
  })

  it('builds an export manifest only from ready assets with integrity metadata', () => {
    expect(buildExportManifest([{
      id: 'asset-1', kind: 'original_image', original_filename: 'photo.png', mime_type: 'image/png',
      byte_size: 12, sha256: 'a'.repeat(64), state: 'ready', version: 2,
    }])).toEqual({
      version: 1,
      assets: [{
        assetId: 'asset-1', kind: 'original_image', filename: 'photo.png', mimeType: 'image/png',
        byteSize: 12, sha256: 'a'.repeat(64), state: 'ready', assetVersion: 2,
      }],
    })
  })

  it.each([
    { state: 'quarantined', byte_size: 12, sha256: 'a'.repeat(64) },
    { state: 'ready', byte_size: null, sha256: 'a'.repeat(64) },
    { state: 'ready', byte_size: 12, sha256: null },
  ])('refuses incomplete assets in an export manifest: %j', asset => {
    expect(() => buildExportManifest([{
      id: 'asset-1', kind: 'original_image', original_filename: 'photo.png', mime_type: 'image/png',
      version: 1, ...asset,
    }])).toThrow('Asset is not complete for export')
  })
})
