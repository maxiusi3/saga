import type { getSupabaseAdmin } from '@/lib/supabase'
import { validateRecordingOutputCandidate } from './recording-output-candidate'

type Asset = {
  bucket?: unknown; object_key?: unknown; id?: unknown; project_id?: unknown; state?: unknown; kind?: unknown
  byte_size?: unknown; sha256?: unknown; mime_type?: unknown; duration_ms?: unknown
}
function unavailable(): never { throw new Error('recording_asset_lineage_unavailable') }

/** Resolve immutable published provenance before the caller's final deletion read. */
export async function recordingAssetDeletionSubjects(admin: ReturnType<typeof getSupabaseAdmin>, asset: Asset): Promise<readonly string[]> {
  if (asset.bucket !== 'recording-candidates') return Object.freeze([])
  try {
    if (typeof window !== 'undefined' || asset.kind !== 'original_audio' ||
      !['ready', 'deleting', 'deleted'].includes(String(asset.state)) || typeof asset.object_key !== 'string') unavailable()
    const { data: row, error } = await admin.from('recording_output_candidates')
      .select('id, job_id, project_id, asset_id, session_id, manifest_sha256, worker_id, attempt_no, state, bucket, object_key, byte_size, sha256, mime_type, duration_ms, created_at, prepared_at')
      .eq('bucket', asset.bucket).eq('object_key', asset.object_key).maybeSingle()
    if (error || !row || Array.isArray(row)) unavailable()
    const candidate = { schemaVersion: 1, candidateId: row.id, jobId: row.job_id, projectId: row.project_id,
      assetId: row.asset_id, sessionId: row.session_id, manifestSha256: row.manifest_sha256, workerId: row.worker_id,
      attempt: row.attempt_no, state: row.state, bucket: row.bucket, objectKey: row.object_key,
      byteSize: row.byte_size, sha256: row.sha256, mimeType: row.mime_type, durationMs: row.duration_ms,
      createdAt: row.created_at, preparedAt: row.prepared_at, canClearLocalDrafts: false }
    validateRecordingOutputCandidate(candidate)
    if (candidate.state !== 'prepared' || candidate.assetId !== asset.id || candidate.projectId !== asset.project_id ||
      candidate.bucket !== asset.bucket || candidate.objectKey !== asset.object_key || candidate.byteSize !== asset.byte_size ||
      candidate.sha256 !== asset.sha256 || candidate.mimeType !== asset.mime_type || candidate.durationMs !== asset.duration_ms) unavailable()
    return Object.freeze([candidate.sessionId])
  } catch { return unavailable() }
}
