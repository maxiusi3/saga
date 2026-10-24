import { createHash } from 'crypto'
import JSZip from 'jszip'
import { buildExportManifest, safeExportFilename, type ExportAssetRow, type ExportManifest } from '@/lib/media-assets'

export interface ExportableMediaAsset extends ExportAssetRow {
  bucket: 'saga' | 'audio-recordings'
  object_key: string
}

export async function addVerifiedMediaAssetsToZip(
  zip: JSZip,
  assets: ExportableMediaAsset[],
  readObject: (asset: ExportableMediaAsset) => Promise<Buffer>,
): Promise<ExportManifest> {
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
