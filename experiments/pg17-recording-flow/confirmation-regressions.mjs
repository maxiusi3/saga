import { isDeepStrictEqual } from 'node:util'
import { fresh, save, USER, PROJECT } from './fixture.mjs'

// PostgreSQL JSON preserves every column and microsecond. JS Date conversion
// would make full-row rollback observations lossy.
async function savedRows(h, f) {
  return (await h.db.query(`SELECT jsonb_build_object(
    'story',(SELECT to_jsonb(s) FROM stories s WHERE id=$1),
    'intent',(SELECT to_jsonb(i) FROM recording_story_intents i WHERE session_id=$2)) AS value`,
  [f.storyId, f.sessionId])).rows[0].value
}
const identity = f => ({ actorId: USER, projectId: PROJECT, sessionId: f.sessionId })
const confirm = (flow, admin, f) => flow.confirmRecordingStorySave({ ...identity(f), manifestSha256: f.manifestSha256 }, { admin })

export async function confirmationRegressions(h, service, prepare, flow, admin) {
  const report = h.report.confirmationConsistency = { controls: [], rejections: [], violations: [],
    schemaConstraintsRetained: ['attempt_no must be positive and unique per job', 'candidate created/prepared timestamps must be finite and prepared_at >= created_at'] }
  await h.scenario('real two- and three-attempt publication confirms and replays through the actual service', async () => {
    for (const attemptCount of [2, 3]) {
      const f = await fresh(h, service, prepare, true, { attemptCount })
      const baseline = await save(service, f.sessionId)
      const before = await savedRows(h, f), receipt = await confirm(flow, admin, f), confirmed = await savedRows(h, f)
      const replay = await confirm(flow, admin, f), afterReplay = await savedRows(h, f)
      report.controls.push({ attemptCount, leaseTransitions: f.leaseTransitions, baseline, before, receipt, confirmed, replay, afterReplay })
      h.eq(baseline.snapshot.attempts.map(a => a.attempt_no), Array.from({ length: attemptCount }, (_, i) => i + 1), 'actual routines construct consecutive attempts')
      h.eq(baseline.snapshot.attempts.map(a => a.result_state), [...Array(attemptCount - 1).fill('retryable_error'), 'succeeded'], 'only expired pre-dispatch leases precede success')
      h.eq([before.story.status, before.intent.confirmed_at], ['processing', null], 'valid multi-attempt story starts unconfirmed')
      h.eq([receipt.canClearLocalDrafts, receipt.storyId, confirmed.story.status], [true, f.storyId, 'ready'], 'actual service confirms valid multi-attempt chain')
      h.ok(confirmed.intent.confirmed_at, 'valid control commits confirmed intent')
      h.eq(replay, receipt, 'valid multi-attempt cleanup receipt replays identically')
      h.eq(afterReplay, confirmed, 'valid replay leaves entire story and intent unchanged')
    }
  })
  await h.scenario('finite early AD timestamps and non-UTC caller timezone remain compatible', async () => {
    const f = await fresh(h, service, prepare)
    for (const [table, field, key, column] of [
      ['recording_sessions', 'started_at', 'sessionId', 'id'], ['media_assets', 'created_at', 'assetId', 'id'],
      ['processing_jobs', 'created_at', 'jobId', 'id'], ['recording_chunks', 'persisted_at', 'sessionId', 'session_id'],
    ]) await h.db.query(`UPDATE ${table} SET ${field}='0001-01-01 00:00:00.000001+00' WHERE ${column}=$1`, [f[key]])
    await service.query("SET timezone='Asia/Taipei'")
    try {
      const receipt = await confirm(flow, admin, f), confirmed = await savedRows(h, f)
      const replay = await confirm(flow, admin, f)
      report.controls.push({ name: 'finite early AD timestamps / Asia-Taipei caller', receipt, replay, confirmed })
      h.eq(receipt.canClearLocalDrafts, true, 'four-digit early AD timestamp survives strict application round-trip')
      h.eq(replay, receipt, 'UTC-normalized receipt replays')
      h.eq(await savedRows(h, f), confirmed, 'early AD replay leaves full rows unchanged')
    } finally { await service.query("SET timezone='UTC'") }
  })

  const mutations = []
  // Exercise each historical position, including the second predecessor in a
  // three-attempt chain. Zero is deliberately non-null for usage/cost fields.
  for (const [attemptCount, attemptNo] of [[2, 1], [3, 1], [3, 2]]) {
    for (const [field, value, label] of [
      ['worker_id', 'invalid worker!', 'malformed worker'],
      ['worker_id', '', 'empty worker'],
      ['worker_id', 'w'.repeat(129), 'overlong worker'],
      ['provider', 'unexpected-provider', 'provider'],
      ['provider_request_id', 'unexpected-request', 'provider request'],
      ['usage_units', 0, 'usage units'],
      ['reserved_cost_usd', 0, 'reserved cost'],
      ['settled_cost_usd', 0, 'settled cost'],
    ]) mutations.push({ name: `${attemptCount} attempts / historical ${attemptNo} / ${label}`, attemptCount,
      mutate: (h, f) => h.db.query(`UPDATE processing_attempts SET ${field}=$3 WHERE job_id=$1 AND attempt_no=$2`, [f.jobId, attemptNo, value]) })
  }
  for (const [name, attemptCount, sql] of [
    ['numbering 2,3 with attempt_count=2', 2, 'UPDATE processing_attempts SET attempt_no=3 WHERE job_id=$1 AND attempt_no=1'],
    ['numbering 2,3,4 with attempt_count=3', 3, 'UPDATE processing_attempts SET attempt_no=4 WHERE job_id=$1 AND attempt_no=1'],
    ['missing historical attempt', 3, 'DELETE FROM processing_attempts WHERE job_id=$1 AND attempt_no=1'],
    ['missing latest attempt', 2, 'DELETE FROM processing_attempts WHERE job_id=$1 AND attempt_no=2'],
    ['extra out-of-range attempt', 2, `INSERT INTO processing_attempts(job_id,attempt_no,worker_id,dispatched_at,finished_at,result_state,error_code)
      SELECT job_id,4,worker_id,dispatched_at,finished_at,result_state,error_code FROM processing_attempts WHERE job_id=$1 AND attempt_no=1`],
    ['historical finish before job creation', 2, `UPDATE processing_attempts SET finished_at=(SELECT created_at-interval '1 microsecond' FROM processing_jobs WHERE id=$1) WHERE job_id=$1 AND attempt_no=1`],
    ['three-attempt reversed historical finish times', 3, `UPDATE processing_attempts SET finished_at=(SELECT finished_at+interval '1 microsecond' FROM processing_attempts WHERE job_id=$1 AND attempt_no=2) WHERE job_id=$1 AND attempt_no=1`],
    ['historical finish after latest dispatch', 2, `UPDATE processing_attempts SET finished_at=(SELECT dispatched_at+interval '1 microsecond' FROM processing_attempts WHERE job_id=$1 AND attempt_no=2) WHERE job_id=$1 AND attempt_no=1`],
    ['historical finish before seal', 2, `UPDATE processing_attempts SET finished_at=(SELECT s.sealed_at-interval '1 microsecond' FROM recording_sessions s JOIN processing_jobs j ON j.id=$1 AND s.merge_job_id=j.id) WHERE job_id=$1 AND attempt_no=1`],
    ['historical missing finish', 2, 'UPDATE processing_attempts SET finished_at=NULL WHERE job_id=$1 AND attempt_no=1'],
    ['historical dispatched', 2, 'UPDATE processing_attempts SET dispatched_at=finished_at WHERE job_id=$1 AND attempt_no=1'],
    ['historical wrong state', 2, "UPDATE processing_attempts SET result_state='succeeded' WHERE job_id=$1 AND attempt_no=1"],
    ['historical wrong retry code', 2, "UPDATE processing_attempts SET error_code='other' WHERE job_id=$1 AND attempt_no=1"],
    ['historical non-finite finish', 2, "UPDATE processing_attempts SET finished_at='-infinity' WHERE job_id=$1 AND attempt_no=1"],
  ]) mutations.push({ name, attemptCount, mutate: (h, f) => h.db.query(sql, [f.jobId]) })

  // Include every required successful-chain timestamp. Finite BC and five-
  // digit years also lie outside the application's serialized UTC domain.
  for (const [table, field, key] of [
    ['media_assets', 'created_at', 'assetId'], ['media_assets', 'updated_at', 'assetId'],
    ['media_assets', 'verified_at', 'assetId'], ['media_assets', 'content_verified_at', 'assetId'],
    ['processing_jobs', 'created_at', 'jobId'], ['processing_jobs', 'updated_at', 'jobId'],
    ['recording_sessions', 'started_at', 'sessionId'], ['recording_sessions', 'sealed_at', 'sessionId'],
    ['recording_sessions', 'confirmed_at', 'sessionId'],
    ['processing_attempts', 'dispatched_at', 'jobId'], ['processing_attempts', 'finished_at', 'jobId'],
    ['recording_chunks', 'persisted_at', 'sessionId'],
  ]) {
    for (const time of ['-infinity', 'infinity', '0001-01-01 00:00:00+00 BC', '10000-01-01 00:00:00+00']) {
      mutations.push({ name: `${table}.${field} = ${time}`, attemptCount: 1, mutate: async (h, f) => {
        const column = table === 'processing_attempts' ? 'job_id' : table === 'recording_chunks' ? 'session_id' : 'id'
        await h.db.query(`UPDATE ${table} SET ${field}=$2::timestamptz WHERE ${column}=$1`, [f[key], time])
        // Preserve asset <= job so invalid early job creation isn't rejected
        // merely by the already-existing relative-order predicate.
        if (table === 'processing_jobs' && field === 'created_at' && ['-infinity', '0001-01-01 00:00:00+00 BC'].includes(time)) {
          await h.db.query('UPDATE media_assets SET created_at=$2::timestamptz WHERE id=$1', [f.assetId, time])
        }
      } })
    }
  }
  // Candidate finite-time/order CHECKs remain enabled. Move the pair together
  // to exercise the remaining serialization-domain boundary they permit.
  for (const time of ['0001-01-01 00:00:00+00 BC', '10000-01-01 00:00:00+00']) {
    mutations.push({ name: `candidate created/prepared pair = ${time}`, attemptCount: 1,
      mutate: (h, f) => h.db.query('UPDATE recording_output_candidates SET created_at=$2::timestamptz,prepared_at=$2::timestamptz WHERE id=$1', [f.candidateId, time]) })
  }

  await h.scenario('all history and timestamp corruptions reject before story or intent writes', async () => {
    for (const { name, attemptCount, mutate } of mutations) {
      const f = await fresh(h, service, prepare, true, { attemptCount })
      // Validate every unmodified control via the real service before mutation.
      // A broken synthetic setup must never count as a successful rejection.
      const valid = await flow.lookupRecordingStorySave(identity(f), { admin })
      h.eq(valid.intent.confirmed, false, `${name}: published control passes application validation`)
      const baseline = await save(service, f.sessionId)
      await mutate(h, f)
      const corrupted = await save(service, f.sessionId), before = await savedRows(h, f)
      let receipt = null, apiStatus = null
      try { receipt = await confirm(flow, admin, f) } catch (error) { apiStatus = error.status ?? null }
      const after = await savedRows(h, f)
      const checks = { noReceipt: receipt === null, fullRowsUnchanged: isDeepStrictEqual(before, after),
        remainsUnconfirmed: after.story.status === 'processing' && after.story.audio_url === null && after.intent.confirmed_at === null,
        sqlConflict: apiStatus === 409 }
      const observation = { name, attemptCount, leaseTransitions: f.leaseTransitions, baseline, corrupted, before, after, receipt, apiStatus, checks }
      report.rejections.push(observation)
      // Collect all cases first, including every RED outcome, before asserting.
      for (const [check, passed] of Object.entries(checks)) if (!passed) report.violations.push({ name, check })
    }
    report.summary = { cases: report.rejections.length, rejectedWith409: report.rejections.filter(r => r.apiStatus === 409).length,
      rejectedWith503: report.rejections.filter(r => r.apiStatus === 503).length,
      noReceipt: report.rejections.filter(r => r.checks.noReceipt).length,
      unchangedRows: report.rejections.filter(r => r.checks.fullRowsUnchanged).length,
      changedRows: report.rejections.filter(r => !r.checks.fullRowsUnchanged).length }
    h.eq(report.violations, [], 'every corruption rejects with no receipt and exact story/intent equality')
    for (const observed of report.rejections) {
      h.eq(observed.receipt, null, `${observed.name}: no cleanup receipt`)
      h.eq(observed.after, observed.before, `${observed.name}: complete story/intent rows unchanged`)
      h.eq(observed.apiStatus, 409, `${observed.name}: SQL rejection reaches actual service`)
    }
  })
}
