import { prepareRecordingJobCandidateOutcome } from './recording-candidate-worker'
import { withRecordingJobLease } from './recording-job-worker'
import { publishRecordingJob, failRecordingJob, type RecordingJobFinalization } from './recording-job-finalization'
import { isRecordingProcessingError } from './recording-processing-error'

/** One supervised attempt; an unavailable response never authorizes replay or cleanup. */
export async function finalizeLeasedRecordingJob(jobId: string, options: Parameters<typeof withRecordingJobLease>[1]): Promise<RecordingJobFinalization> {
  try {
    // Retain the caller's original cancellation and settings across all awaits,
    // including the handoff after the supervisor aborts its own finished scope.
    const snapshot = { ...options, ffmpeg: { ...options.ffmpeg } }
    const result = await withRecordingJobLease(jobId, snapshot, async context => {
      const outcome = await prepareRecordingJobCandidateOutcome(jobId, snapshot, context)
      if (outcome.status === 'preparation_failed') {
        if (outcome.consumerStarted || !isRecordingProcessingError(outcome.error) || outcome.error.disposition !== 'permanent') {
          throw new Error('recording_worker_unavailable')
        }
        return { status: 'permanent_failure' as const, error: outcome.error, rpcTimeoutMs: context.rpcTimeoutMs }
      }
      return { ...outcome, rpcTimeoutMs: context.rpcTimeoutMs }
    })
    // Owned work, heartbeat drain and the final live-lease check have completed.
    // Terminal mutation must stay outside the supervisor: it invalidates the lease.
    const rpc = { admin: snapshot.admin, signal: snapshot.signal, timeoutMs: result.rpcTimeoutMs }
    return result.status === 'permanent_failure'
      ? await failRecordingJob(result.lease, result.error, rpc)
      : await publishRecordingJob(result.lease, result.candidate, rpc)
  } catch {
    throw new Error('recording_worker_unavailable')
  }
}
