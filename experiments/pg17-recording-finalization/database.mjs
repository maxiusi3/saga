import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { digest } from '../pg17-routines/runtime.mjs'
import { fixture, rpc as leaseRpc, USER, OTHER, PROJECT, STORY } from '../pg17-recording-worker/fixture.mjs'
import { candidateRpc } from '../pg17-recording-candidates/fixture.mjs'
import { args, rpc, outcome, state, WORKER, PERMANENT_CODES, SIGNATURE, RPC } from './fixture.mjs'

export async function databaseScenarios(h, prepare) {
  const service = await h.actorClient('service_role', USER)
  const receipts = h.report.receipts = []
  async function fresh({ ttl = 120000, candidate = 'prepared', running = true } = {}) {
    const f = await fixture(h, service, prepare)
    f.candidateId = randomUUID()
    f.output = { byteSize: f.bytes.length, sha256: digest(f.bytes), mimeType: f.mimeType, durationMs: 1250 }
    await leaseRpc(service, f.jobId, 'claim', WORKER, null, ttl)
    if (running) await leaseRpc(service, f.jobId, 'start', WORKER, 1)
    if (candidate) {
      await candidateRpc(service, [f.jobId, 'reserve', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
      if (candidate === 'prepared') await candidateRpc(service, [f.jobId, 'prepare', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
    }
    return f
  }
  function capture(label, before, after, extra = {}) { h.report.tuples.push({ label, before, after, ...extra }) }
  async function denied(f, values, expected = '23505', client = service, label = 'rejected finalization') {
    const before = await state(h, f), result = await outcome(client, values), after = await state(h, f)
    capture(label, before, after, { sqlstate: result.code })
    h.eq(result.code, expected, `${label}: expected SQLSTATE`)
    h.eq(after, before, `${label}: every asset/job/attempt/session/candidate/chunk field unchanged`)
  }
  function checkReceipt(f, value, action, code = null) {
    const publish = action === 'publish'
    const { finishedAt, ...fixed } = value
    h.eq(fixed, { schemaVersion: 1, jobId: f.jobId, projectId: PROJECT, assetId: f.assetId,
      sessionId: f.sessionId, manifestSha256: f.manifestSha256, workerId: WORKER, attempt: 1,
      state: publish ? 'succeeded' : 'failed', assetState: publish ? 'ready' : 'quarantined',
      sessionState: publish ? 'cloud_confirmed' : 'failed', candidateId: publish ? f.candidateId : null,
      bucket: publish ? 'recording-candidates' : null,
      objectKey: publish ? `jobs/${f.jobId}/attempts/1/${f.candidateId}` : null,
      byteSize: publish ? f.output.byteSize : null, sha256: publish ? f.output.sha256 : null,
      mimeType: publish ? f.output.mimeType : null, durationMs: publish ? f.output.durationMs : null,
      errorCode: code, canClearLocalDrafts: false }, 'receipt has exact closed terminal schema and values')
    h.ok(typeof finishedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?\+00:00$/.test(finishedAt) &&
      Number.isFinite(Date.parse(finishedAt)), 'receipt uses finite UTC database timestamp')
    receipts.push(value)
  }
  function checkTerminal(f, before, after, value, action, code = null) {
    const publish = action === 'publish', expected = structuredClone(before), at = value.finishedAt
    Object.assign(expected.asset, { state: publish ? 'ready' : 'quarantined', updated_at: at, verification_error: code })
    if (publish) Object.assign(expected.asset, { bucket: 'recording-candidates', object_key: value.objectKey,
      byte_size: f.output.byteSize, sha256: f.output.sha256, mime_type: f.output.mimeType, duration_ms: f.output.durationMs,
      verified_at: at, content_verified_at: at })
    Object.assign(expected.job, { state: publish ? 'succeeded' : 'failed', result_ref: publish ? f.assetId : null,
      lease_owner: null, lease_expires_at: null, not_before: null, error_code: code, updated_at: at })
    Object.assign(expected.attempts[0], { result_state: publish ? 'succeeded' : 'fatal_error', finished_at: at, error_code: code })
    Object.assign(expected.session, { state: publish ? 'cloud_confirmed' : 'failed',
      confirmed_asset_id: publish ? f.assetId : null, merge_job_id: publish ? f.jobId : null, confirmed_at: publish ? at : null })
    h.eq(after, expected, 'exact complete terminal tuple; unrelated fields/input/candidates remain immutable')
  }
  async function finish(f, action = 'publish', code = null, client = service) {
    const before = await state(h, f), value = await rpc(client, args(f, action, code)), after = await state(h, f)
    capture(action, before, after, { receipt: value })
    checkReceipt(f, value, action, code); checkTerminal(f, before, after, value, action, code)
    h.eq((await h.db.query('SELECT $1::timestamptz > $2::timestamptz AND $1::timestamptz < $3::timestamptz AS ordered',
      [value.finishedAt, before.job.updated_at, before.job.lease_expires_at])).rows[0].ordered, true,
    'timestamp ordered in PostgreSQL at microsecond precision within lease')
    if (action === 'publish') h.eq((await h.db.query('SELECT $1::timestamptz >= $2::timestamptz AS ordered',
      [value.finishedAt, before.candidates[0].prepared_at])).rows[0].ordered, true, 'finishedAt follows preparedAt without millisecond truncation')
    return value
  }
  async function waitLock(client, blocker = null) {
    for (let index = 0; index < 300; index++) {
      const row = (await h.db.query(`SELECT wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity WHERE pid=$1`, [client.processID])).rows[0]
      if (row?.wait_event_type === 'Lock' && (!blocker || row.blockers.includes(blocker.processID))) {
        ;(h.report.lockWaits ??= []).push({ pid: client.processID, ...row })
        h.ok(true, 'independent backend observed in actual lock wait'); return
      }
      await delay(5)
    }
    h.ok(false, 'backend must enter expected lock wait')
  }
  async function expires(f) {
    const ms = Number((await h.db.query('SELECT greatest(0,extract(epoch FROM (lease_expires_at-clock_timestamp()))*1000) AS ms FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].ms)
    h.ok(ms < 1600, 'expiry wait bounded')
    await delay(Math.ceil(ms) + 30)
    h.eq((await h.db.query('SELECT lease_expires_at <= clock_timestamp() AS expired FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].expired, true, 'real database clock expired')
  }
  const tombstoneSql = 'INSERT INTO public.deletion_requests(project_id,subject_id,requested_by,tombstone_at) VALUES($1,$2,$3,clock_timestamp())'
  const tombstoneArgs = (f, subject = f.assetId) => [PROJECT, subject, USER]
  const queryOutcome = async (client, sql, values) => { try { await client.query(sql, values); return '00000' } catch (error) { return error.code } }
  async function closeTransactions(...clients) {
    for (const client of clients) { await client.query('ROLLBACK'); await h.close(client) }
  }

  await h.scenario('Publish and every permanent pre-candidate failure atomically produce exact full tuples', async () => {
    await service.query("SET timezone='Pacific/Honolulu'; SET search_path=pg_temp")
    const success = await fresh(); await finish(success)
    h.eq((await service.query('SHOW timezone')).rows[0].TimeZone, 'Pacific/Honolulu', 'function UTC setting restores caller timezone')
    h.eq((await service.query('SHOW lock_timeout')).rows[0].lock_timeout, '4s', 'bounded function lock timeout restores caller timeout')
    await service.query("SET timezone='UTC'; SET search_path=pg_catalog,public,auth")
    for (const code of PERMANENT_CODES) await finish(await fresh({ candidate: null }), 'fail', code)
    for (const f of [success, await fresh({ candidate: null })]) {
      if (f !== success) await finish(f, 'fail', PERMANENT_CODES[0])
      await denied(f, args(f), '23505', service, 'terminal publication cannot replay')
      await denied(f, args(f, 'fail'), '23505', service, 'terminal failure cannot replay')
      const before = await state(h, f)
      const counts = (await h.db.query('SELECT (SELECT count(*) FROM media_assets)::int AS assets,(SELECT count(*) FROM processing_jobs)::int AS jobs,(SELECT count(*) FROM recording_sessions)::int AS sessions')).rows[0]
      h.eq(await queryOutcome(service, 'SELECT public.seal_recording_manifest($1::jsonb)', [f.manifest]), '23505', 'post-terminal seal exact replay fails')
      const after = await state(h, f); capture('terminal seal replay', before, after)
      h.eq(after, before, 'seal replay preserves complete terminal tuple')
      h.eq((await h.db.query('SELECT (SELECT count(*) FROM media_assets)::int AS assets,(SELECT count(*) FROM processing_jobs)::int AS jobs,(SELECT count(*) FROM recording_sessions)::int AS sessions')).rows[0], counts, 'seal replay creates no asset/job/session')
    }
  })

  await h.scenario('Closed branch inputs reject malformed metadata and stale fences without side effects', async () => {
    const f = await fresh(), base = args(f)
    for (const [index, value] of [[0, null], [1, null], [1, 'cancel'], [2, 'bad worker'], [2, null], [3, null], [3, 0],
      [4, null], [4, 'BAD'], [5, null], [6, null], [7, PERMANENT_CODES[0]]]) {
      const values = [...base]; values[index] = value; await denied(f, values, '22023', service, `invalid argument ${index}`)
    }
    for (const [index, value] of [[2, 'old-worker'], [3, 2], [4, 'f'.repeat(64)], [5, randomUUID()]]) {
      const values = [...base]; values[index] = value; await denied(f, values, '23505', service, `stale argument ${index}`)
    }
    for (const output of [{}, [], 'text', { ...f.output, extra: true }, { ...f.output, byteSize: '26' },
      { ...f.output, durationMs: 0 }, { ...f.output, durationMs: 86400001 }, { ...f.output, sha256: 'BAD' },
      { ...f.output, mimeType: 'text/plain' }, { ...f.output, byteSize: 104857601 }]) {
      const values = [...base]; values[6] = output; await denied(f, values, '22023', service, 'malformed output')
    }
    for (const [key, value] of [['byteSize', f.output.byteSize + 1], ['sha256', 'e'.repeat(64)], ['mimeType', 'audio/ogg'], ['durationMs', 1500]]) {
      const values = [...base]; values[6] = { ...f.output, [key]: value }; await denied(f, values, '23505', service, `mismatched ${key}`)
    }
    const failure = await fresh({ candidate: null })
    for (const [index, value] of [[5, randomUUID()], [6, {}], [7, null], [7, 'recording_processing_failed'],
      [7, 'recording_provider_unavailable'], [7, 'recording_cancelled'], [7, 'arbitrary diagnostic']]) {
      const values = args(failure, 'fail'); values[index] = value; await denied(failure, values, '22023', service, 'invalid permanent failure input')
    }
    const leased = await fresh({ candidate: null, running: false })
    await denied(leased, args(leased, 'fail'), '23505', service, 'undispatched leased state not finalizable')
  })

  await h.scenario('Reserved, foreign and persisted candidate drift cannot manufacture prepared publication evidence', async () => {
    const reserved = await fresh({ candidate: 'reserved' })
    await denied(reserved, args(reserved), '23505', service, 'reserved candidate stays reserved')
    const foreign = await fresh(), local = await fresh()
    const values = args(local); values[5] = foreign.candidateId
    const foreignBefore = await state(h, foreign)
    await denied(local, values, '23505', service, 'foreign candidate rejected')
    h.eq(await state(h, foreign), foreignBefore, 'foreign candidate entire job tuple unchanged')
    for (const change of ["worker_id='other-worker'", 'project_id=gen_random_uuid()', 'asset_id=gen_random_uuid()',
      'session_id=gen_random_uuid()', "manifest_sha256=repeat('f',64)", "sha256=repeat('f',64)",
      'byte_size=byte_size+1', "mime_type='audio/ogg'", 'duration_ms=duration_ms+1',
      "attempt_no=2,object_key='jobs/'||job_id::text||'/attempts/2/'||id::text",
      "prepared_at=clock_timestamp()+interval '1 hour'"]) {
      await h.db.query('BEGIN'); await h.db.query(`UPDATE recording_output_candidates SET ${change} WHERE id=$1`, [local.candidateId])
      const before = await state(h, local)
      await h.db.query('SAVEPOINT drift')
      h.eq((await outcome(h.db, args(local))).code, '23505', 'persisted prepared candidate drift rejected')
      await h.db.query('ROLLBACK TO SAVEPOINT drift')
      const after = await state(h, local); capture(`candidate drift ${change}`, before, after)
      h.eq(after, before, 'candidate drift failure has no partial writes'); await h.db.query('ROLLBACK')
    }
    for (const candidate of ['reserved', 'prepared']) {
      const f = await fresh({ candidate })
      await denied(f, args(f, 'fail'), '23505', service, `${candidate} candidate prevents permanent failure`)
      await h.db.query("UPDATE recording_output_candidates SET attempt_no=2,object_key='jobs/'||job_id::text||'/attempts/2/'||id::text WHERE id=$1", [f.candidateId])
      await denied(f, args(f, 'fail'), '23505', service, 'candidate on another attempt prevents permanent failure')
    }
  })

  await h.scenario('Full pinned manifest and access revocation guards apply to both terminal actions', async () => {
    for (const action of ['publish', 'fail']) {
      const f = await fresh({ candidate: action === 'publish' ? 'prepared' : null })
      for (const [sql, values, code, label] of [
        ["UPDATE project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER], '42501', 'inactive membership'],
        ["UPDATE project_roles SET role='facilitator' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER], '42501', 'changed role'],
        ['DELETE FROM project_roles WHERE project_id=$1 AND user_id=$2', [PROJECT, USER], '42501', 'removed membership'],
        ['UPDATE stories SET storyteller_id=$1 WHERE id=$2', [OTHER, STORY], '42501', 'story owner changed'],
        ['UPDATE processing_jobs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [f.jobId], '42501', 'cancelled'],
        ["UPDATE media_assets SET state='deleting' WHERE id=$1", [f.assetId], '42501', 'asset deleting'],
        ["UPDATE media_assets SET object_key='wrong' WHERE id=$1", [f.assetId], '23505', 'asset pointer changed'],
        ["UPDATE recording_chunks SET sha256=repeat('e',64) WHERE session_id=$1", [f.sessionId], '23505', 'chunk hash drift'],
        ["UPDATE recording_sessions SET manifest_sha256=repeat('e',64) WHERE id=$1", [f.sessionId], '23505', 'manifest hash drift'],
        ["UPDATE recording_sessions SET seal_input=seal_input||'{\"extra\":true}'::jsonb WHERE id=$1", [f.sessionId], '23505', 'manifest schema drift'],
        ["UPDATE processing_jobs SET idempotency_key='wrong' WHERE id=$1", [f.jobId], '23505', 'job identity drift'],
        ["UPDATE processing_attempts SET worker_id='different' WHERE job_id=$1", [f.jobId], '23505', 'attempt worker drift'],
      ]) {
        await h.db.query('BEGIN'); await h.db.query(sql, values)
        const before = await state(h, f); await h.db.query('SAVEPOINT guard')
        h.eq((await outcome(h.db, args(f, action))).code, code, `${action} rejects ${label}`)
        await h.db.query('ROLLBACK TO SAVEPOINT guard')
        const after = await state(h, f); capture(`${action} ${label}`, before, after)
        h.eq(after, before, 'guard rejection preserves every tuple'); await h.db.query('ROLLBACK')
      }
      for (const subject of [f.assetId, f.sessionId, PROJECT, STORY]) {
        await h.db.query(tombstoneSql, tombstoneArgs(f, subject))
        await denied(f, args(f, action), '42501', service, `${action} tombstone ${subject}`)
        await h.db.query('DELETE FROM deletion_requests WHERE project_id=$1 AND subject_id=$2', [PROJECT, subject])
      }
    }
  })

  await h.scenario('Every terminal DML error or suppressed update rolls back all previous writes', async () => {
    for (const action of ['publish', 'fail']) for (const table of ['media_assets', 'processing_jobs', 'processing_attempts', 'recording_sessions']) {
      const f = await fresh({ candidate: action === 'publish' ? 'prepared' : null })
      for (const mode of ['raise', 'suppress', 'tamper']) {
        const tamper = table === 'processing_attempts' ? "NEW.result_state := 'running';" :
          `NEW.state := '${table === 'media_assets' ? 'verifying' : table === 'recording_sessions' ? 'sealing' : 'running'}';`
        await h.db.query(`CREATE FUNCTION public.finalization_inject() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN ${mode === 'raise' ? "RAISE EXCEPTION 'synthetic DML failure';" : mode === 'suppress' ? 'RETURN NULL;' : `${tamper} RETURN NEW;`} END $$;
          CREATE TRIGGER finalization_inject BEFORE UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.finalization_inject()`)
        try { await denied(f, args(f, action), mode === 'raise' ? 'P0001' : '23505', service, `${action} ${table} ${mode}`) }
        finally { await h.db.query(`DROP TRIGGER finalization_inject ON public.${table}; DROP FUNCTION public.finalization_inject()`) }
      }
      const before = await state(h, f)
      await service.query('BEGIN'); await rpc(service, args(f, action)); await service.query('ROLLBACK')
      const after = await state(h, f); capture(`${action} explicit rollback`, before, after)
      h.eq(after, before, 'caller rollback preserves entire pre-finalization tuple')
    }
  })

  await h.scenario('Expiry during every terminal write rolls back success and permanent failure', async () => {
    for (const action of ['publish', 'fail']) for (const table of ['media_assets', 'processing_jobs', 'processing_attempts', 'recording_sessions']) {
      const f = await fresh({ ttl: 1000, candidate: action === 'publish' ? 'prepared' : null })
      await h.db.query(`CREATE FUNCTION public.finalization_delay() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_sleep(1.05); RETURN NEW; END $$;
        CREATE TRIGGER finalization_delay AFTER UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.finalization_delay()`)
      try { await denied(f, args(f, action), '23505', service, `${action} expiry inside ${table} DML`) }
      finally { await h.db.query(`DROP TRIGGER finalization_delay ON public.${table}; DROP FUNCTION public.finalization_delay()`) }
    }
  })

  await h.scenario('Lease expiry after table, job, candidate and asset-upgrade lock waits fails closed', async () => {
    for (const kind of ['deletion_requests', 'processing_jobs', 'recording_output_candidates', 'asset-upgrade']) {
      const f = await fresh({ ttl: 1000 }), active = await h.actorClient('service_role'), blocker = await h.client()
      const before = await state(h, f)
      try {
        await blocker.query('BEGIN')
        if (kind === 'deletion_requests') await blocker.query('LOCK TABLE deletion_requests IN ROW EXCLUSIVE MODE')
        else if (kind === 'asset-upgrade') await blocker.query('SELECT id FROM media_assets WHERE id=$1 FOR SHARE', [f.assetId])
        else await blocker.query(`SELECT id FROM ${kind} WHERE id=$1 FOR UPDATE`, [kind === 'processing_jobs' ? f.jobId : f.candidateId])
        const pending = outcome(active, args(f)); await waitLock(active, blocker); await expires(f); await blocker.query('COMMIT')
        h.eq((await pending).code, '23505', `${kind} expiry fence rejects`)
        const after = await state(h, f); capture(`expiry after ${kind} lock`, before, after)
        h.eq(after, before, 'post-lock expiry leaves no terminal writes')
      } finally { await closeTransactions(active, blocker) }
    }
  })

  await h.scenario('Deletion committed first is observed after waiting on absent-tombstone barrier', async () => {
    for (const action of ['publish', 'fail']) for (const subjectKind of ['asset', 'session', 'project', 'story']) {
      const f = await fresh({ candidate: action === 'publish' ? 'prepared' : null })
      const subject = { asset: f.assetId, session: f.sessionId, project: PROJECT, story: STORY }[subjectKind]
      const writer = await h.client(), active = await h.actorClient('service_role'), before = await state(h, f)
      try {
        await writer.query('BEGIN'); await writer.query(tombstoneSql, tombstoneArgs(f, subject))
        const pending = outcome(active, args(f, action)); await waitLock(active, writer)
        const locks = (await h.db.query(`SELECT mode,granted FROM pg_locks WHERE pid=$1 AND relation='public.deletion_requests'::regclass`, [active.processID])).rows
        h.ok(locks.some(row => row.mode === 'ShareLock' && !row.granted), 'finalizer waits on first deletion table SHARE lock')
        h.eq((await h.db.query("SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND locktype='advisory'", [active.processID])).rows[0].n, 0, 'no advisory lease lock before deletion barrier')
        await writer.query('COMMIT'); h.eq((await pending).code, '42501', 'fresh post-wait snapshot rejects committed tombstone')
        const after = await state(h, f); capture(`${action} deletion first ${subjectKind}`, before, after)
        h.eq(after, before, 'deletion-first race writes no terminal state')
      } finally { await closeTransactions(writer, active); await h.db.query('DELETE FROM deletion_requests WHERE project_id=$1 AND subject_id=$2', [PROJECT, subject]) }
    }
  })

  await h.scenario('Finalizer committed first blocks deletion insertion until whole terminal tuple is visible', async () => {
    for (const action of ['publish', 'fail']) {
      const f = await fresh({ candidate: action === 'publish' ? 'prepared' : null }), active = await h.actorClient('service_role'), writer = await h.client()
      const before = await state(h, f)
      try {
        await active.query('BEGIN'); const value = await rpc(active, args(f, action))
        const pending = queryOutcome(writer, tombstoneSql, tombstoneArgs(f)); await waitLock(writer, active)
        h.eq(await state(h, f), before, 'uncommitted finalizer invisible as a whole to observer')
        await active.query('COMMIT'); h.eq(await pending, '00000', 'ordinary tombstone writer resumes after finalization commit')
        const after = await state(h, f); capture(`${action} finalizer first`, before, after, { receipt: value })
        checkReceipt(f, value, action, action === 'fail' ? PERMANENT_CODES[0] : null)
        checkTerminal(f, before, after, value, action, action === 'fail' ? PERMANENT_CODES[0] : null)
        h.eq((await h.db.query('SELECT count(*)::int AS n FROM deletion_requests WHERE subject_id=$1', [f.assetId])).rows[0].n, 1, 'later tombstone retained for future deletion workflow')
      } finally { await closeTransactions(active, writer) }
    }
  })

  await h.scenario('Membership revoke races serialize in both orders', async () => {
    for (const first of ['revoke', 'finalize']) {
      const f = await fresh(), active = await h.actorClient('service_role'), writer = await h.client(), before = await state(h, f)
      try {
        if (first === 'revoke') {
          await writer.query('BEGIN'); await writer.query("UPDATE project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
          const pending = outcome(active, args(f)); await waitLock(active, writer); await writer.query('COMMIT')
          h.eq((await pending).code, '42501', 'revoke-first rejects waiting finalization')
          const after = await state(h, f); capture('revoke-first', before, after); h.eq(after, before, 'revoke-first has no finalization writes')
        } else {
          await active.query('BEGIN'); const value = await rpc(active, args(f))
          const pending = queryOutcome(writer, "UPDATE project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
          await waitLock(writer, active); h.eq(await state(h, f), before, 'revoke cannot observe partial finalization')
          await active.query('COMMIT'); h.eq(await pending, '00000', 'revoke proceeds only after commit')
          const after = await state(h, f); capture('finalize-before-revoke', before, after); checkTerminal(f, before, after, value, 'publish')
        }
      } finally { await closeTransactions(active, writer); await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER]) }
    }
  })

  await h.scenario('Reverse legacy project-lock then tombstone write safely deadlocks without partial finalization', async () => {
    const f = await fresh(), active = await h.actorClient('service_role'), legacy = await h.client(), before = await state(h, f)
    try {
      await legacy.query("SET deadlock_timeout='5s'; BEGIN")
      await legacy.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE', [PROJECT])
      const finalizing = outcome(active, args(f)); await waitLock(active, legacy)
      const inserting = queryOutcome(legacy, tombstoneSql, tombstoneArgs(f)); await waitLock(legacy, active)
      const result = await finalizing; h.eq(result.code, '40P01', 'finalizer detects reverse-lock deadlock and aborts')
      h.eq(await inserting, '00000', 'legacy writer proceeds only after finalizer abort')
      await legacy.query('COMMIT')
      const after = await state(h, f); capture('reverse-lock deadlock', before, after, { sqlstate: result.code })
      h.eq(after, before, 'deadlock abort leaves complete tuple unchanged')
    } finally { await closeTransactions(active, legacy) }
  })

  await h.scenario('Concurrent duplicate publishes produce one complete commit and one fenced loser', async () => {
    const f = await fresh(), first = await h.actorClient('service_role'), second = await h.actorClient('service_role'), before = await state(h, f)
    try {
      await first.query('BEGIN'); const value = await rpc(first, args(f))
      const pending = outcome(second, args(f)); await waitLock(second, first)
      h.eq(await state(h, f), before, 'waiting duplicate sees no partial terminal tuple')
      await first.query('COMMIT'); h.eq((await pending).code, '23505', 'duplicate fails active seal/lease fence after winner commits')
      const after = await state(h, f); capture('duplicate publish', before, after); checkTerminal(f, before, after, value, 'publish')
    } finally { await closeTransactions(first, second) }
  })

  await h.scenario('READ COMMITTED is mandatory and lock wait is bounded inside function', async () => {
    const f = await fresh()
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE', 'READ UNCOMMITTED']) {
      await service.query(`BEGIN ISOLATION LEVEL ${isolation}`)
      const before = await state(h, f)
      h.eq((await outcome(service, args(f))).code, '22023', `${isolation} rejected`)
      await service.query('ROLLBACK'); const after = await state(h, f)
      capture(`isolation ${isolation}`, before, after); h.eq(after, before, 'invalid isolation causes no writes')
    }
    const active = await h.actorClient('service_role'), blocker = await h.client(), before = await state(h, f)
    try {
      await active.query('SET lock_timeout=0')
      await blocker.query('BEGIN; LOCK TABLE deletion_requests IN ROW EXCLUSIVE MODE')
      const start = performance.now(), pending = outcome(active, args(f)); await waitLock(active, blocker)
      h.eq((await pending).code, '55P03', 'function-local lock timeout bounds even unbounded caller')
      const elapsedMs = performance.now() - start
      h.ok(elapsedMs >= 2500 && elapsedMs < 5000, 'lock timeout near configured three seconds')
      h.report.boundedLockTimeoutMs = elapsedMs
      const after = await state(h, f); capture('lock timeout', before, after); h.eq(after, before, 'timeout leaves no terminal writes')
      h.eq((await active.query('SHOW lock_timeout')).rows[0].lock_timeout, '0', 'caller timeout restored after failure')
    } finally { await closeTransactions(active, blocker) }
  })

  await h.scenario('Function ACL, fixed execution configuration and restrictive Storage policies remain private', async () => {
    const f = await fresh()
    for (const role of ['anon', 'authenticated', 'metadata_reader']) {
      const actor = await h.actorClient(role, USER, 'service_role')
      try { await denied(f, args(f), '42501', actor, `${role} cannot forge finalization execution authority`) }
      finally { await h.close(actor) }
    }
    const proc = (await h.db.query('SELECT prosecdef,provolatile,proconfig,proacl::text AS acl FROM pg_proc WHERE oid=$1::regprocedure', [SIGNATURE])).rows[0]
    h.eq(proc.prosecdef, true, 'SECURITY DEFINER function')
    h.eq(proc.provolatile, 'v', 'volatile function for fresh READ COMMITTED snapshots')
    h.eq(proc.proconfig.sort(), ['TimeZone=UTC', 'lock_timeout=3s', 'search_path=pg_catalog, pg_temp'].sort(), 'fixed trusted search path UTC and lock timeout')
    const grants = (await h.db.query('SELECT grantee::regrole::text AS role,privilege_type FROM pg_proc p,LATERAL aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure ORDER BY role', [SIGNATURE])).rows
    h.eq(grants, [{ role: 'rehearsal_admin', privilege_type: 'EXECUTE' }, { role: 'service_role', privilege_type: 'EXECUTE' }], 'only owner and service_role have execute grant')
    await service.query("INSERT INTO storage.objects(bucket_id,name) VALUES('recording-candidates','private-finalization-fixture')")
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['objects', 'buckets']) {
        const predicate = table === 'objects' ? "bucket_id='recording-candidates'" : "id='recording-candidates'"
        h.eq((await h.actor(role, USER, `SELECT * FROM storage.${table} WHERE ${predicate}`)).rows, [], 'restrictive policy hides candidate storage')
        h.eq((await h.actor(role, USER, `UPDATE storage.${table} SET name='changed' WHERE ${predicate}`)).rowCount, 0, 'restrictive policy prevents mutation')
        h.eq((await h.actor(role, USER, `DELETE FROM storage.${table} WHERE ${predicate}`)).rowCount, 0, 'restrictive policy prevents deletion')
      }
      h.eq((await h.actor(role, USER, "INSERT INTO storage.objects(bucket_id,name) VALUES('recording-candidates','new-client-object')")).sqlstate, '42501', 'candidate object insertion denied')
      h.eq((await h.actor(role, USER, "SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='control-public'")).rows[0].n, 1, 'unrelated broad bucket policy remains functional')
    }
    h.eq((await h.db.query("SELECT public,file_size_limit::int FROM storage.buckets WHERE id='recording-candidates'")).rows[0], { public: false, file_size_limit: 104857600 }, 'candidate bucket stays private and limited')
    h.eq(await queryOutcome(h.db, "UPDATE media_assets SET bucket='unapproved-bucket' WHERE id=$1", [f.assetId]), '23514', 'extended asset bucket constraint rejects unknown buckets')
    h.eq(receipts.every(value => value.canClearLocalDrafts === false), true, 'every recorded receipt withholds local cleanup authority')
  })
  await h.close(service)
}
