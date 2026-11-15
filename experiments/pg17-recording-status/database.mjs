import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { USER, OTHER, PROJECT, STORY } from '../pg17-recording-worker/fixture.mjs'
import { args as finalArgs, rpc as finalize, state } from '../pg17-recording-finalization/fixture.mjs'
import { SIGNATURE, args, snapshot, outcome, fresh, allState } from './fixture.mjs'

export async function databaseScenarios(h, prepare) {
  const service = await h.actorClient('service_role', USER)
  const make = options => fresh(h, service, prepare, options)
  async function observe(f, client = service) {
    const before = await allState(h), value = await snapshot(client, args(f)), after = await allState(h)
    h.eq(after, before, 'read leaves every full database tuple unchanged')
    h.report.tuples.push({ label: 'read-only full database comparison', before, after, snapshot: value })
    return value
  }
  async function denied(f, values = args(f), client = service, code = '42501') {
    const before = await allState(h), result = await outcome(client, values), after = await allState(h)
    h.eq(result.code, code, 'read rejects unavailable authorization or isolation')
    h.eq(result.message, 'recording_status_unavailable', 'authorization error has one non-disclosing message')
    h.eq(after, before, 'rejection leaves all complete tuples unchanged')
    h.report.tuples.push({ label: 'rejected read', before, after, error: result })
  }
  await h.scenario('STABLE service-only authority is read-only and does not acquire write/advisory locks', async () => {
    const proc = (await h.db.query(`SELECT prosecdef,provolatile,proconfig,prosrc,
      (SELECT count(*)::int FROM aclexplode(proacl) WHERE grantee=0) AS public_grants
      FROM pg_proc WHERE oid=$1::regprocedure`, [SIGNATURE])).rows[0]
    h.eq([proc.prosecdef, proc.provolatile, proc.public_grants], [true, 's', 0], 'stable security definer without public execution')
    h.eq(proc.proconfig, ['search_path=pg_catalog, pg_temp', 'TimeZone=UTC'], 'fixed trusted path and UTC')
    h.ok(!/\b(UPDATE|INSERT|DELETE|LOCK|PERFORM|EXECUTE)\b|pg_advisory|recording_job_lease\s*\(/i.test(proc.prosrc.replace(/--[^\n]*/g, '')), 'function body contains no write, lock or mutating helper')
    const f = await make()
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      const actor = await h.actorClient(role, USER, 'service_role')
      h.eq((await outcome(actor, args(f))).code, '42501', 'forged JWT cannot grant SQL execute')
      await h.close(actor)
    }
    await service.query("SET timezone='Pacific/Honolulu'; SET search_path=pg_temp")
    await service.query('BEGIN READ ONLY')
    const value = await observe(f)
    h.eq(Object.keys(value).sort(), ['schemaVersion', 'actorId', 'projectId', 'sessionId', 'manifestSha256', 'observedAt', 'matchingSessionCount', 'session', 'asset', 'jobs', 'attempts', 'candidates', 'chunks'].sort(), 'exact 13-key envelope')
    h.eq([value.schemaVersion, value.actorId, value.projectId, value.sessionId, value.manifestSha256, value.matchingSessionCount], [1, USER, PROJECT, f.sessionId, f.manifestSha256, 1], 'exact authorized identities')
    const complete = await state(h, f)
    h.eq([value.session, value.asset, value.jobs, value.attempts, value.candidates, value.chunks],
      [complete.session, complete.asset, [complete.job], complete.attempts, complete.candidates, complete.chunks], 'whole rows preserved in envelope')
    h.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?\+00:00$/.test(value.observedAt), 'observedAt UTC microseconds')
    const locks = (await h.db.query('SELECT locktype,mode FROM pg_locks WHERE pid=$1 AND granted AND locktype IN (\'relation\',\'advisory\',\'tuple\') ORDER BY 1,2', [service.processID])).rows
    h.ok(locks.length > 0 && locks.every(lock => lock.locktype === 'relation' && lock.mode === 'AccessShareLock'), 'only ordinary MVCC AccessShare locks')
    h.report.readLocks = locks
    h.eq((await service.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on', 'RPC executed inside explicit READ ONLY transaction')
    await service.query('COMMIT')
    h.eq((await service.query('SHOW timezone')).rows[0].TimeZone, 'Pacific/Honolulu', 'function restores caller timezone')
    await service.query("SET timezone='UTC'; SET search_path=pg_catalog,public,auth")
  })
  await h.scenario('Current actor identity, role/story ownership and all deletion subjects reject uniformly', async () => {
    const f = await make()
    for (const [index, value] of [[0, null], [0, OTHER], [0, randomUUID()], [1, randomUUID()], [2, randomUUID()], [3, 'f'.repeat(64)], [3, null], [3, 'BAD']]) {
      const values = args(f); values[index] = value; await denied(f, values)
    }
    for (const [sql, values] of [
      ["UPDATE project_roles SET status='inactive' WHERE user_id=$1 AND project_id=$2", [USER, PROJECT]],
      ["UPDATE project_roles SET role='facilitator' WHERE user_id=$1 AND project_id=$2", [USER, PROJECT]],
      ['DELETE FROM project_roles WHERE user_id=$1 AND project_id=$2', [USER, PROJECT]],
      ['UPDATE stories SET storyteller_id=$1 WHERE id=$2', [OTHER, STORY]],
      ['UPDATE recording_sessions SET user_id=$1 WHERE id=$2', [OTHER, f.sessionId]],
      ["UPDATE media_assets SET state='deleting' WHERE id=$1", [f.assetId]],
      ["UPDATE media_assets SET state='deleted' WHERE id=$1", [f.assetId]],
    ]) {
      await h.db.query('BEGIN'); await h.db.query(sql, values)
      await h.db.query('SAVEPOINT rejection')
      const result = await outcome(h.db, args(f))
      h.eq(result, { code: '42501', message: 'recording_status_unavailable' }, 'authorization mutation is visible to next statement')
      await h.db.query('ROLLBACK TO SAVEPOINT rejection'); await h.db.query('ROLLBACK')
    }
    for (const subject of [PROJECT, STORY, f.sessionId, f.assetId]) {
      await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)', [PROJECT, subject, USER])
      await denied(f)
      await h.db.query('DELETE FROM deletion_requests WHERE project_id=$1 AND subject_id=$2', [PROJECT, subject])
    }
    // Optional blocker columns emulate present/future fields without changing production schema.
    for (const [table, id] of [['auth.users', USER], ['projects', PROJECT], ['project_roles', null], ['stories', STORY], ['recording_sessions', f.sessionId], ['media_assets', f.assetId]]) {
      for (const key of ['tombstone_at', 'deletion_requested_at', 'deleted_at', 'cancel_requested_at']) {
        await h.db.query(`ALTER TABLE ${table} ADD COLUMN ${key} timestamptz`)
        await h.db.query(`UPDATE ${table} SET ${key}=clock_timestamp() WHERE ${id ? 'id=$1' : 'user_id=$1'}`, [id ?? USER])
        await denied(f)
        await h.db.query(`ALTER TABLE ${table} DROP COLUMN ${key}`)
      }
    }
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      const stale = await h.actorClient('service_role', USER)
      await stale.query(`BEGIN ISOLATION LEVEL ${isolation} READ ONLY`)
      await denied(f, args(f), stale, '22023')
      await stale.query('ROLLBACK'); await h.close(stale)
    }
  })
  await h.scenario('One statement snapshot remains consistent across real atomic publication; later reads see commit and revocation', async () => {
    const f = await make(), writer = await h.actorClient('service_role', USER), reader = await h.actorClient('service_role', USER)
    const before = await state(h, f)
    await writer.query('BEGIN')
    const publication = await finalize(writer, finalArgs(f))
    await reader.query('BEGIN READ ONLY')
    const pending = reader.query(`WITH first AS MATERIALIZED (
      SELECT public.read_recording_session_snapshot($1,$2,$3,$4) AS value
    ), pause AS MATERIALIZED (SELECT pg_sleep(0.8) FROM first)
    SELECT first.value AS first, public.read_recording_session_snapshot($1,$2,$3,$4) AS second FROM first,pause`, args(f))
    let sleeping = false
    for (let i = 0; i < 100; i++) {
      const row = (await h.db.query('SELECT wait_event,wait_event_type FROM pg_stat_activity WHERE pid=$1', [reader.processID])).rows[0]
      if (row.wait_event === 'PgSleep') { sleeping = true; break }
      await delay(5)
    }
    h.eq(sleeping, true, 'independent backend reached synchronization after first snapshot despite writer row locks')
    await writer.query('COMMIT')
    const pair = (await pending).rows[0]
    h.eq(pair.first, pair.second, 'STABLE calls inside one statement observe identical old snapshot despite intervening commit')
    h.eq([pair.first.jobs[0].state, pair.first.asset.state, pair.first.session.state], ['running', 'verifying', 'sealing'], 'no mixed terminal tuple')
    const after = await snapshot(reader, args(f))
    h.eq([after.jobs[0].state, after.asset.state, after.session.state], ['succeeded', 'ready', 'cloud_confirmed'], 'next explicit read in same READ COMMITTED transaction sees complete published tuple')
    const times = [after.jobs[0].updated_at, after.asset.updated_at, after.attempts[0].finished_at, after.session.confirmed_at]
    h.ok(times.every(value => value === publication.finishedAt), 'all atomic publication finish timestamps retain exact equality')
    h.eq((await h.db.query('SELECT $1::timestamptz < $2::timestamptz AS ordered', [pair.first.observedAt, after.observedAt])).rows[0].ordered, true, 'next statement advances observation at full database precision')
    h.report.snapshotRace = { before, publication, pair, after, persisted: await state(h, f) }
    await h.db.query("UPDATE project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
    await denied(f, args(f), reader)
    await reader.query('ROLLBACK')
    await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
    await reader.query('BEGIN READ ONLY'); await snapshot(reader, args(f))
    await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)', [PROJECT, f.sessionId, USER])
    await denied(f, args(f), reader)
    await reader.query('ROLLBACK')
    await h.db.query('DELETE FROM deletion_requests WHERE subject_id=$1', [f.sessionId])
    await h.close(reader); await h.close(writer)
  })
  await h.scenario('Bounded arrays expose extra or foreign identity rows without silently certifying truncated sets', async () => {
    const f = await make(), other = await make({ running: false, candidate: false })
    await h.db.query('BEGIN')
    try {
      // The authorized session is fixed, while corrupt related rows remain raw for the app validator.
      await h.db.query('UPDATE processing_jobs SET created_by=$1 WHERE id=$2', [OTHER, f.jobId])
      await h.db.query("UPDATE recording_output_candidates SET job_id=$1::uuid,object_key='jobs/'||$1::text||'/attempts/'||attempt_no::text||'/'||id::text WHERE id=$2", [other.jobId, f.candidateId])
      let value = await snapshot(h.db, args(f))
      h.eq(value.jobs[0].created_by, OTHER, 'foreign job ownership is not filtered away')
      h.eq(value.candidates[0].job_id, other.jobId, 'candidate linked through asset/session remains visible with foreign job')
      await h.db.query('INSERT INTO recording_sessions SELECT (jsonb_populate_record(NULL::recording_sessions,to_jsonb(s)||jsonb_build_object(\'id\',gen_random_uuid()))).* FROM recording_sessions s WHERE id=$1', [f.sessionId])
      await h.db.query('INSERT INTO recording_sessions SELECT (jsonb_populate_record(NULL::recording_sessions,to_jsonb(s)||jsonb_build_object(\'id\',gen_random_uuid()))).* FROM recording_sessions s WHERE id=$1', [f.sessionId])
      for (let i = 2; i <= 6; i++) await h.db.query("INSERT INTO processing_attempts SELECT (jsonb_populate_record(NULL::processing_attempts,to_jsonb(a)||jsonb_build_object('id',gen_random_uuid(),'attempt_no',$2::integer))).* FROM processing_attempts a WHERE job_id=$1 AND attempt_no=1", [f.jobId, i])
      h.eq((await snapshot(h.db, args(f))).attempts.length, 4, 'six persisted attempts expose bounded fourth-row sentinel')
      for (let i = 0; i < 3; i++) await h.db.query("INSERT INTO processing_jobs SELECT (jsonb_populate_record(NULL::processing_jobs,to_jsonb(j)||jsonb_build_object('id',gen_random_uuid(),'idempotency_key',gen_random_uuid()::text))).* FROM processing_jobs j WHERE id=$1", [f.jobId])
      // All clones retain the session link, so even jobs beyond the bounded job set cannot hide them.
      for (let i = 0; i < 5; i++) {
        const id = randomUUID(), jobId = randomUUID()
        await h.db.query("INSERT INTO recording_output_candidates SELECT (jsonb_populate_record(NULL::recording_output_candidates,to_jsonb(c)||jsonb_build_object('id',$2::uuid,'job_id',$3::uuid,'object_key','jobs/'||$3::text||'/attempts/1/'||$2::text))).* FROM recording_output_candidates c WHERE id=$1", [f.candidateId, id, jobId])
      }
      await h.db.query("INSERT INTO recording_chunks(session_id,project_id,chunk_index,bucket,object_key,byte_size,sha256) SELECT $1::uuid,$2::uuid,n,'audio-recordings','oversize-'||$1::text||'-'||n,1,repeat('a',64) FROM generate_series(3,2004) n", [f.sessionId, PROJECT])
      value = await snapshot(h.db, args(f))
      h.eq(value.matchingSessionCount, 2, 'duplicate sealed asset count capped at ambiguity sentinel two')
      h.eq(value.jobs.length, 2, 'jobs bounded at two, exposes unsupported multiplicity')
      h.ok(value.attempts.length <= 4, 'attempts globally bounded at four')
      h.eq(value.candidates.length, 4, 'candidates bounded at four even with corrupt foreign job ids')
      h.eq(value.chunks.length, 2001, 'chunks expose one over legal max rather than silently truncating at 2000')
      h.eq(value.chunks.map(row => row.chunk_index), Array.from({ length: 2001 }, (_, index) => index), 'chunk arrays sorted by index')
      h.report.boundedSnapshot = value
    } finally { await h.db.query('ROLLBACK') }
  })
  await h.close(service)
}
