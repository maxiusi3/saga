import JSZip from 'jszip'
import { addVerifiedMediaAssetsToZip } from '@/lib/server/media-export'

const readyAsset = {
  id: 'asset-1',
  kind: 'original_image',
  original_filename: '../family photo.png',
  mime_type: 'image/png',
  byte_size: 11,
  sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  state: 'ready' as const,
  version: 1,
  bucket: 'saga' as const,
  object_key: 'alice/projects/family-a/assets/asset-1/original',
}

describe('verified media export', () => {
  it('writes the original bytes under a safe path and emits a manifest', async () => {
    const zip = new JSZip()
    const result = await addVerifiedMediaAssetsToZip(zip, [readyAsset], async asset => {
      expect(asset.bucket).toBe('saga')
      expect(asset.object_key).toBe(readyAsset.object_key)
      return Buffer.from('hello world')
    })
    expect(result).toEqual({ version: 1, assets: [expect.objectContaining({ assetId: 'asset-1', filename: 'family photo.png' })] })
    const files = Object.keys(zip.files)
    expect(files).toContain('media/asset-1/family photo.png')
    expect(files).toContain('manifest.json')
    expect(await zip.file('media/asset-1/family photo.png')!.async('string')).toBe('hello world')
  })

  it('fails closed when downloaded bytes do not match the stored hash or size', async () => {
    const zip = new JSZip()
    await expect(addVerifiedMediaAssetsToZip(zip, [readyAsset], async () => Buffer.from('wrong')))
      .rejects.toThrow('Media asset failed export verification')
    expect(Object.keys(zip.files)).toEqual([])
  })

  it('does not emit a partial archive when a later asset is incomplete', async () => {
    const zip = new JSZip()
    await expect(addVerifiedMediaAssetsToZip(zip, [readyAsset, { ...readyAsset, id: 'asset-2', state: 'quarantined' }], async () => Buffer.from('hello world')))
      .rejects.toThrow('Asset is not complete for export')
    expect(Object.keys(zip.files)).toEqual([])
  })
})
