import { randomUUID } from 'node:crypto'
import { withVerifiedRecordingJobInput } from './recording-job-verifier'
import { withRecordingJobLease } from './recording-job-worker'
import { reserveRecordingOutputCandidate, prepareRecordingOutputCandidate } from './recording-output-candidate'
import { uploadAndVerifyRecordingCandidate } from './recording-candidate-storage'

/** Carries settled preparation evidence without deciding whether a failure is terminal. */
export async function prepareRecordingJobCandidateOutcome(jobId: string, options: Parameters<typeof withRecordingJobLease>[1],
  context: Parameters<Parameters<typeof withRecordingJobLease>[2]>[0]) {
  let consumerStarted = false
  try {
    const candidate = await withVerifiedRecordingJobInput(jobId, { ...options, lease: context.getLease(), signal: context.signal },
      async (artifact, input) => {
        // Once the callback begins even a branded processing error is uncertain:
        // reservation, storage, preparation or later cleanup may have run.
        consumerStarted = true
        const rpc = { admin: options.admin, signal: context.signal, timeoutMs: context.rpcTimeoutMs }
        const reserved = await reserveRecordingOutputCandidate(context.getLease(), randomUUID(), {
          byteSize: artifact.completion.outputByteSize, sha256: artifact.completion.outputSha256,
          mimeType: artifact.mimeType, durationMs: artifact.completion.durationMs,
        }, rpc)
        await uploadAndVerifyRecordingCandidate(artifact, reserved, { ...options, signal: context.signal, revalidate: input.revalidate })
        return await prepareRecordingOutputCandidate(context.getLease(), reserved, rpc)
      })
    return { status: 'candidate_prepared' as const, jobId, candidate, canClearLocalDrafts: false as const }
  } catch (error) {
    return { status: 'preparation_failed' as const, error, consumerStarted }
  }
}

/** Preparation is durable private storage, not publication or terminal success. */
export async function prepareLeasedRecordingJobCandidate(jobId: string, options: Parameters<typeof withRecordingJobLease>[1]) {
  const snapshot = { ...options, ffmpeg: { ...options.ffmpeg } }
  return withRecordingJobLease(jobId, snapshot, async context => {
    const outcome = await prepareRecordingJobCandidateOutcome(jobId, snapshot, context)
    if (outcome.status === 'preparation_failed') throw outcome.error
    return outcome
  })
}
