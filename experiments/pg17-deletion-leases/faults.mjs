import { lease, snapshot, PROJECT } from './fixture.mjs'
import { captured, replay, step, rejected, expire, WORKER } from './scenarios.mjs'

// Admin fixtures deliberately violate invariants only inside a rollback transaction.
// A savepoint preserves the malformed pre-call snapshot after the RPC aborts.
async function malformed(h, label, mutate, call) {
  await h.db.query('BEGIN')
  try {
    await mutate()
    await h.db.query('SAVEPOINT malformed_fixture')
    await rejected(h, async () => {
      try { await call() } catch (error) { await h.db.query('ROLLBACK TO malformed_fixture'); throw error }
    }, '23505', label)
  } finally { await h.db.query('ROLLBACK') }
}
async function triggerCase(h, service, f, table, event, body, action, label) {
  await h.db.query(`CREATE FUNCTION public.lease_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$;
    CREATE TRIGGER lease_fault BEFORE ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.lease_fault();`)
  try { await rejected(h, () => lease(service, f.requestId, action, action === 'recover' ? null : WORKER, action === 'claim' || action === 'recover' ? null : 1, action === 'claim' || action === 'heartbeat' ? 1000 : null), '23505', label) }
  finally { await h.db.query(`DROP TRIGGER lease_fault ON public.${table}; DROP FUNCTION public.lease_fault();`) }
}
export async function faults(h, service, prepare) {
  await h.scenario('legacy, identity, digest/count and closed target shape corruption cannot create jobs', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    const captureMutations = [
      ['legacy request', 'capture_version=NULL,subject_type=NULL,capture_target_count=NULL,capture_targets_sha256=NULL'],
      ['noncanonical subject', 'subject_id=upper(subject_id)'],
      ['capture state', "state='processing'"], ['capture attempt', 'attempt=1'],
      ['infinite capture timestamp', "requested_at='infinity',tombstone_at='infinity'"],
      ['future capture timestamp', "requested_at=clock_timestamp()+interval '1 day',tombstone_at=clock_timestamp()+interval '1 day'"],
      ['mismatched capture times', "requested_at=tombstone_at+interval '1 second'"],
      ['capture execution error', "error_code='tampered'"], ['capture execution time', 'processing_at=tombstone_at'],
      ['capture completion time', 'completed_at=tombstone_at'], ['digest drift', "capture_targets_sha256=repeat('a',64)"],
      ['count drift', 'capture_target_count=capture_target_count+1'],
    ]
    for (const [label, set] of captureMutations) await malformed(h, label, () => h.db.query(`UPDATE public.deletion_requests SET ${set} WHERE id=$1`, [f.requestId]), () => lease(h.db, f.requestId, 'claim', WORKER, null, 1000))
    const targetMutations = [
      ['unsafe traversal path', "object_key='x/../secret',target_id='storage:saga:x/../secret',bucket='saga'", "kind='storage_object'"],
      ['unsafe bucket', "bucket='private-backup'", "kind='storage_object'"],
      ['storage ID mismatch', "target_id='storage:saga:other/file'", "kind='storage_object'"],
      ['metadata contains storage', "bucket='saga',object_key='other/file'", "kind='story'"],
      ['unknown metadata kind', "kind='derived_artifact'", "kind='story'"],
      ['target state', "state='deleted'", "kind='story'"],
      ['target error', "error_code='tampered'", "kind='story'"],
      ['target time', "updated_at=updated_at+interval '1 second'", "kind='story'"],
      ['metadata identity', "target_id='story:00000000-0000-0000-0000-000000000000'", "kind='story'"],
      ['metadata ID suffix', "target_id=target_id||':suffix'", "kind='story'"],
      ['null storage path', 'object_key=NULL', "kind='storage_object'"],
    ]
    for (const [label, set, predicate] of targetMutations) await malformed(h, label, async () => {
      await h.db.query(`UPDATE public.deletion_targets SET ${set} WHERE id=(SELECT id FROM deletion_targets WHERE deletion_request_id=$1 AND ${predicate} LIMIT 1)`, [f.requestId])
      // An attacker recomputing the digest must still fail the independent shape check.
      await h.db.query("UPDATE public.deletion_requests SET capture_targets_sha256=(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(t) ORDER BY t.target_id)::text,'UTF8')),'hex') FROM deletion_targets t WHERE t.deletion_request_id=$1) WHERE id=$1", [f.requestId])
    }, () => lease(h.db, f.requestId, 'claim', WORKER, null, 1000))
    await malformed(h, 'ambiguous same-subject legacy tombstone', () => h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) SELECT project_id,subject_id,requested_by FROM deletion_requests WHERE id=$1', [f.requestId]), () => lease(h.db, f.requestId, 'claim', WORKER, null, 1000))
    await replay(h, service, f)
  })
  await h.scenario('INSERT suppression and alteration plus capture tampering roll back the whole claim', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
      await triggerCase(h, service, f, table, 'INSERT', 'RETURN NULL;', 'claim', `${table} INSERT suppression`)
      await triggerCase(h, service, f, table, 'INSERT', "NEW.worker_id:='changed-worker'; RETURN NEW;", 'claim', `${table} INSERT altered worker`)
      await triggerCase(h, service, f, table, 'INSERT', "UPDATE public.deletion_requests SET error_code='changed-by-trigger' WHERE id=NEW.request_id; RETURN NEW;", 'claim', `${table} INSERT mutates capture request`)
      await triggerCase(h, service, f, table, 'INSERT', "UPDATE public.deletion_targets SET error_code='changed-by-trigger' WHERE deletion_request_id=NEW.request_id; RETURN NEW;", 'claim', `${table} INSERT mutates capture targets`)
    }
    await replay(h, service, f)
  })
  await h.scenario('UPDATE suppression and alteration abort start heartbeat and recovery', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    await step(h, service, f, 'claim', WORKER, null, 120000)
    for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
      await triggerCase(h, service, f, table, 'UPDATE', 'RETURN NULL;', 'start', `${table} start suppression`)
      await triggerCase(h, service, f, table, 'UPDATE', "NEW.worker_id:='changed-worker'; RETURN NEW;", 'start', `${table} start altered worker`)
      await triggerCase(h, service, f, table, 'UPDATE', "UPDATE public.deletion_requests SET error_code='changed-by-trigger' WHERE id=NEW.request_id; RETURN NEW;", 'start', `${table} start mutates capture request`)
      await triggerCase(h, service, f, table, 'UPDATE', "UPDATE public.deletion_targets SET error_code='changed-by-trigger' WHERE deletion_request_id=NEW.request_id; RETURN NEW;", 'start', `${table} start mutates capture targets`)
    }
    await step(h, service, f, 'start')
    for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
      await triggerCase(h, service, f, table, 'UPDATE', 'RETURN NULL;', 'heartbeat', `${table} heartbeat suppression`)
      await triggerCase(h, service, f, table, 'UPDATE', "NEW.worker_id:='changed-worker'; RETURN NEW;", 'heartbeat', `${table} heartbeat altered worker`)
    }
    await replay(h, service, f)
    const expired = await captured(h, service, prepare)
    await replay(h, service, expired)
    await step(h, service, expired, 'claim', WORKER, null, 1000)
    await expire(h, expired)
    for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
      await triggerCase(h, service, expired, table, 'UPDATE', 'RETURN NULL;', 'recover', `${table} recovery suppression`)
      const body = table === 'media_deletion_jobs' ? "NEW.updated_at:=NEW.updated_at+interval '1 microsecond'; RETURN NEW;" : "NEW.finished_at:=NEW.finished_at+interval '1 microsecond'; RETURN NEW;"
      await triggerCase(h, service, expired, table, 'UPDATE', body, 'recover', `${table} recovery altered finish time`)
    }
    await step(h, service, expired, 'recover', null, null)
    await replay(h, service, expired)
  })
  await h.scenario('complete old attempts and current binding reject malformed history before every operation', async () => {
    const f = await captured(h, service, prepare)
    await replay(h, service, f)
    await step(h, service, f, 'claim', WORKER, null, 1000)
    await expire(h, f); await step(h, service, f, 'recover', null, null)
    const historyMutations = [
      ['old attempt worker', "worker_id='bad worker'"], ['old attempt number gap', 'attempt_no=3'],
      ['old attempt future claim', "claimed_at=clock_timestamp()+interval '1 day'"],
      ['old attempt infinite claim', "claimed_at='infinity'"], ['old attempt before tombstone', "claimed_at=claimed_at-interval '1 day'"],
      ['old attempt invalid state', "state='running'"], ['old attempt dispatched', 'started_at=claimed_at'],
      ['old attempt heartbeat', 'heartbeat_at=claimed_at'], ['old attempt missing finish', 'finished_at=NULL'],
      ['old attempt future finish', "finished_at=clock_timestamp()+interval '1 day'"],
      ['old attempt finish before expiry', "finished_at=lease_expires_at-interval '1 microsecond'"],
      ['old attempt inverted expiry', "lease_expires_at=claimed_at-interval '1 second'"],
    ]
    for (const [label, set] of historyMutations) await malformed(h, label, async () => {
      const constraints = (await h.db.query("SELECT conname FROM pg_constraint WHERE conrelid='media_deletion_attempts'::regclass AND contype='c'")).rows
      for (const { conname } of constraints) await h.db.query(`ALTER TABLE media_deletion_attempts DROP CONSTRAINT ${conname}`)
      await h.db.query(`UPDATE public.media_deletion_attempts SET ${set} WHERE request_id=$1`, [f.requestId])
    }, () => lease(h.db, f.requestId, 'claim', WORKER, null, 1000))
    for (const [label, set] of [
      ['job subject drift', "subject_id='00000000-0000-0000-0000-000000000000'"],
      ['job subject type drift', "subject_type='media_asset'"], ['job digest drift', "capture_targets_sha256=repeat('f',64)"],
      ['job count drift', 'target_count=target_count+1'], ['job created time drift', "created_at=created_at-interval '1 second'"],
      ['job updated time drift', "updated_at=updated_at+interval '1 microsecond'"],
    ]) await malformed(h, label, () => h.db.query(`UPDATE media_deletion_jobs SET ${set} WHERE request_id=$1`, [f.requestId]), () => lease(h.db, f.requestId, 'recover'))
    // Real second claim must preserve first attempt even if its INSERT trigger edits it.
    const prior = (await snapshot(h)).media_deletion_attempts.filter(a => a.request_id === f.requestId)
    await triggerCase(h, service, f, 'media_deletion_attempts', 'INSERT', "UPDATE public.media_deletion_attempts SET worker_id='altered-old-owner' WHERE request_id=NEW.request_id AND attempt_no<NEW.attempt_no; RETURN NEW;", 'claim', 'new attempt insertion must not rewrite old attempt')
    await step(h, service, f, 'claim', WORKER, null, 120000)
    h.eq((await snapshot(h)).media_deletion_attempts.filter(a => a.request_id === f.requestId && a.attempt_no === 1), prior, 'full first attempt remains unchanged after reassignment')
    for (const action of ['start', 'heartbeat', 'check', 'recover']) await malformed(h, `malformed prior state blocks ${action}`, async () => {
      await h.db.query('ALTER TABLE media_deletion_attempts DROP CONSTRAINT media_deletion_attempt_shape')
      await h.db.query("UPDATE public.media_deletion_attempts SET started_at=claimed_at WHERE request_id=$1 AND attempt_no=1", [f.requestId])
    }, () => lease(h.db, f.requestId, action, action === 'recover' ? null : WORKER, action === 'recover' ? null : 2, action === 'heartbeat' ? 1000 : null))
    await malformed(h, 'job project drift', async () => {
      await h.db.query("INSERT INTO projects(id,facilitator_id) SELECT '99999999-9999-9999-9999-999999999999',facilitator_id FROM projects WHERE id=$1", [PROJECT])
      await h.db.query("UPDATE media_deletion_jobs SET project_id='99999999-9999-9999-9999-999999999999' WHERE request_id=$1", [f.requestId])
    }, () => lease(h.db, f.requestId, 'check', WORKER, 2))
    await replay(h, service, f)
  })
}
