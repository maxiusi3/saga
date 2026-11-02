import type { getSupabaseAdmin } from '@/lib/supabase'
import type { SealedRecordingSessionBundle } from './recording-session-service'

export class RecordingSealRegistrationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'RecordingSealRegistrationError'
  }
}

type Row = Record<string, unknown>
type Admin = ReturnType<typeof getSupabaseAdmin>

function conflict(): never {
  throw new RecordingSealRegistrationError(409, 'Recording registration conflicts with the current capture')
}

function unavailable(): never {
  throw new RecordingSealRegistrationError(500, 'Recording registration is unavailable')
}

function assertAsset(asset: Row, expected: SealedRecordingSessionBundle['assetRecord']) {
  if (Object.entries(expected).some(([key, value]) => key !== 'state' && asset[key] !== value) ||
    !['verifying', 'ready'].includes(String(asset.state))) conflict()
}

function jobRecord(sealed: SealedRecordingSessionBundle) {
  const job = sealed.jobSnapshot
  return {
    id: job.id, project_id: job.projectId, asset_id: job.assetId, input_version: job.inputVersion,
    job_type: job.jobType, processor_version: job.processorVersion,
    model_config_version: job.modelConfigVersion, parameter_version: job.parameterVersion,
    idempotency_key: sealed.task.idempotencyKey, state: 'queued', attempt_count: 0,
    max_attempts: job.maxAttempts, created_by: sealed.assetRecord.created_by,
  }
}

function assertJob(job: Row, sealed: SealedRecordingSessionBundle) {
  const expected = jobRecord(sealed)
  const mutable = ['id', 'state', 'attempt_count']
  if (typeof job.id !== 'string' || !job.id || job.cancel_requested_at !== null ||
    Object.entries(expected).some(([key, value]) => !mutable.includes(key) && job[key] !== value)) conflict()
}

function assertCoherentState(asset: Row, job: Row) {
  if (asset.state === 'verifying') {
    if (!['queued', 'leased', 'running', 'retry_wait'].includes(String(job.state)) || job.result_ref !== null) conflict()
  } else if (job.state !== 'succeeded' || job.result_ref !== asset.id ||
    typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    typeof asset.duration_ms !== 'number' || !Number.isSafeInteger(asset.duration_ms) || asset.duration_ms <= 0 ||
    ![asset.verified_at, asset.content_verified_at].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))) {
    conflict()
  }
}

/** Recoverable two-write registration, not an atomic transaction or cloud confirmation. */
export async function registerRecordingSeal(
  admin: Admin,
  sealed: SealedRecordingSessionBundle,
  beforeJobInsert: (asset: Row) => Promise<void>,
) {
  const findAsset = async (): Promise<Row | null> => {
    const { data, error } = await admin.from('media_assets').select('*').eq('id', sealed.assetRecord.id).maybeSingle()
    if (error) unavailable()
    return data
  }
  let asset = await findAsset()
  let idempotentReplay = asset !== null
  if (!asset) {
    const { data, error } = await admin.from('media_assets').insert(sealed.assetRecord).select('*').single()
    if (error?.code === '23505') {
      asset = await findAsset()
      idempotentReplay = true
    } else {
      if (error) unavailable()
      asset = data
    }
    if (!asset) unavailable()
  }
  assertAsset(asset, sealed.assetRecord)

  const findJob = async (): Promise<Row | null> => {
    const { data, error } = await admin.from('processing_jobs').select('*')
      .eq('idempotency_key', sealed.task.idempotencyKey).maybeSingle()
    if (error) unavailable()
    return data
  }
  let job = await findJob()
  if (!job) {
    if (asset.state !== 'verifying') conflict()
    await beforeJobInsert(asset)
    const { data, error } = await admin.from('processing_jobs').insert(jobRecord(sealed)).select('*').single()
    if (error?.code === '23505') job = await findJob()
    else {
      if (error) unavailable()
      job = data
    }
    if (!job) unavailable()
  }
  assertJob(job, sealed)
  assertCoherentState(asset, job)
  // The separate durable session/manifest confirmation flow must authorize cleanup.
  return { asset, job, idempotentReplay, canClearLocalDrafts: false as const }
}
