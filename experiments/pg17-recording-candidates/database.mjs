import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { root, digest } from '../pg17-routines/runtime.mjs'
import { fixture, rpc as leaseRpc, USER, PROJECT } from '../pg17-recording-worker/fixture.mjs'
import { candidateRpc, candidateOutcome, candidateState, CANDIDATE_RPC, CANDIDATE_SIGNATURE } from './fixture.mjs'

export async function databaseScenarios(h, prepare, children) {
  const service = await h.actorClient('service_role', USER)
  const worker = 'candidate-worker-1'
  const receipts = h.report.receipts = []
  const events = h.report.childEvents = []
  async function fresh(ttl = 120000, running = true) {
    const f = await fixture(h, service, prepare)
    f.candidateId = randomUUID()
    f.output = { byteSize: f.bytes.length, sha256: digest(f.bytes), mimeType: f.mimeType, durationMs: 1250 }
    await leaseRpc(service, f.jobId, 'claim', worker, null, ttl)
    if (running) await leaseRpc(service, f.jobId, 'start', worker, 1)
    return f
  }
  const args = (f, action = 'reserve', id = f.candidateId, output = f.output) => [f.jobId, action, worker, 1, f.manifestSha256, id, output]
  async function denied(f, values, code = '23505', client = service) {
    const before = await candidateState(h, f.jobId)
    h.eq((await candidateOutcome(client, values)).code, code, 'candidate operation fails closed with expected SQLSTATE')
    h.eq(await candidateState(h, f.jobId), before, 'rejected operation leaves job/attempt/candidate byte-for-byte unchanged')
  }
  function receipt(f, value, state) {
    h.eq(Object.keys(value).sort(), ['schemaVersion', 'candidateId', 'jobId', 'projectId', 'assetId', 'sessionId',
      'manifestSha256', 'workerId', 'attempt', 'state', 'bucket', 'objectKey', 'byteSize', 'sha256', 'mimeType',
      'durationMs', 'createdAt', 'preparedAt', 'canClearLocalDrafts'].sort(), 'receipt exact closed fields')
    const { createdAt, preparedAt, ...fixed } = value
    h.eq(fixed, { schemaVersion: 1, candidateId: f.candidateId, jobId: f.jobId, projectId: PROJECT, assetId: f.assetId,
      sessionId: f.sessionId, manifestSha256: f.manifestSha256, workerId: worker, attempt: 1, state,
      bucket: 'recording-candidates', objectKey: `jobs/${f.jobId}/attempts/1/${f.candidateId}`, ...f.output, canClearLocalDrafts: false },
    'receipt binds fence, identity and immutable object metadata')
    h.ok(Number.isFinite(Date.parse(createdAt)) && /(Z|\+00:00)$/.test(createdAt), 'createdAt finite UTC')
    if (state === 'reserved') h.eq(preparedAt, null, 'reserved timestamp null')
    else h.ok(Number.isFinite(Date.parse(preparedAt)) && /(Z|\+00:00)$/.test(preparedAt) && Date.parse(preparedAt) >= Date.parse(createdAt), 'prepared timestamp finite UTC >= creation')
    receipts.push(value)
  }
  async function expires(f) {
    const ms = Number((await h.db.query('SELECT greatest(0,extract(epoch FROM (lease_expires_at-clock_timestamp()))*1000) AS ms FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].ms)
    h.ok(ms < 3000, 'real expiry wait bounded')
    await delay(Math.ceil(ms) + 50)
    h.eq((await h.db.query('SELECT lease_expires_at < clock_timestamp() AS expired FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].expired, true, 'actual database wall clock expired')
  }
  async function waitLock(pid) {
    for (let index = 0; index < 200; index++) {
      if ((await h.db.query("SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.waiting) return h.ok(true, 'independent backend reaches real lock wait')
      await delay(10)
    }
    h.ok(false, 'backend must reach real lock wait')
  }
  function message(child) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Candidate child checkpoint timeout')) }, 10000)
      const receive = event => { cleanup(); events.push(event); resolve(event) }
      const fail = error => { cleanup(); reject(error) }
      function cleanup() { clearTimeout(timer); child.off('message', receive); child.off('error', fail) }
      child.once('message', receive); child.once('error', fail)
    })
  }
  async function child() {
    const code = `const {Client}=require('./experiments/t05-durable-worker/node_modules/pg');let c;
      process.on('message',async m=>{try{if(m.type==='connect'){c=new Client(m.config);await c.connect();
        process.send({type:'ready',pid:process.pid,backendPid:c.processID});return;}
        if(m.type==='go'){if(m.transaction)await c.query('BEGIN');await c.query(m.sql,m.args);
          if(m.commit)await c.query('COMMIT');
          process.send({type:m.transaction&&!m.commit?'uncommitted':'committed-receipt-suppressed',pid:process.pid});}
      }catch(e){process.send({type:'error',code:e.code,pid:process.pid});}});`
    const processChild = spawn(process.execPath, ['-e', code], { cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { PATH: process.env.PATH, HOME: process.env.HOME } })
    children.add(processChild)
    processChild.stderr.on('data', () => {})
    processChild.once('exit', (code, signal) => { events.push({ type: 'exit', pid: processChild.pid, code, signal }); children.delete(processChild) })
    const ready = message(processChild)
    processChild.send({ type: 'connect', config: { ...h.config, user: 'service_role', database: 'saga_pg17_rehearsal' } })
    h.eq((await ready).type, 'ready', 'OS child connected to isolated PG')
    return processChild
  }

  await h.scenario('Reserve and prepare preserve publication state; exact prepared replay is unchanged', async () => {
    const f = await fresh(), before = await candidateState(h, f.jobId)
    const reserved = await candidateRpc(service, args(f)); receipt(f, reserved, 'reserved')
    await denied(f, args(f)); await denied(f, args(f, 'reserve', randomUUID()))
    const prepared = await candidateRpc(service, args(f, 'prepare')); receipt(f, prepared, 'prepared')
    h.eq(prepared.createdAt, reserved.createdAt, 'preparation preserves creation time')
    h.eq(await candidateRpc(service, args(f, 'prepare')), prepared, 'exact prepared replay retains every field and timestamp')
    const after = await candidateState(h, f.jobId)
    h.eq([after.job, after.attempts], [before.job, before.attempts], 'candidate operations do not mutate job or attempt')
    h.eq(after.job.state, 'running', 'job remains running')
    h.eq((await h.db.query('SELECT state FROM media_assets WHERE id=$1', [f.assetId])).rows[0].state, 'verifying', 'asset remains verifying')
    h.eq((await h.db.query('SELECT state FROM recording_sessions WHERE id=$1', [f.sessionId])).rows[0].state, 'sealing', 'session remains sealing')
  })
  await h.scenario('Closed arguments, sealed byte and MIME binding, running-only fence', async () => {
    const f = await fresh()
    const invalid = [[0, null], [1, null], [1, 'publish'], [2, null], [2, 'bad worker'], [3, 0], [3, null], [4, null],
      [4, 'A'.repeat(64)], [4, 'a'.repeat(63)], [5, null], [6, null], [6, []], [6, {}],
      [6, { ...f.output, extra: true }], [6, { ...f.output, byteSize: '25' }], [6, { ...f.output, byteSize: 0 }],
      [6, { ...f.output, byteSize: 104857601 }], [6, { ...f.output, byteSize: 2.5 }],
      [6, { ...f.output, sha256: 'A'.repeat(64) }], [6, { ...f.output, sha256: 42 }],
      [6, { ...f.output, durationMs: 0 }], [6, { ...f.output, durationMs: 86400001 }],
      [6, { ...f.output, durationMs: 2.5 }], [6, { ...f.output, durationMs: '1250' }],
      [6, { ...f.output, mimeType: null }], [6, { ...f.output, mimeType: 'text/plain' }]]
    for (const [index, value] of invalid) { const values = args(f); values[index] = value; await denied(f, values, '22023') }
    for (const key of Object.keys(f.output)) { const output = { ...f.output }; delete output[key]; await denied(f, args(f, 'reserve', f.candidateId, output), '22023') }
    for (const output of [{ ...f.output, byteSize: f.output.byteSize + 1 }, { ...f.output, mimeType: 'audio/ogg' }]) await denied(f, args(f, 'reserve', f.candidateId, output))
    const wrongDigest = args(f); wrongDigest[4] = 'f'.repeat(64); await denied(f, wrongDigest)
    for (const [index, value] of [[2, 'another-worker'], [3, 2]]) { const values = args(f); values[index] = value; await denied(f, values) }
    await denied(f, args(f, 'prepare'))
    const leased = await fresh(120000, false); await denied(leased, args(leased))
  })
  await h.scenario('Candidate least privilege, no client policies, immutable constraints', async () => {
    const f = await fresh(); await candidateRpc(service, args(f))
    const proc = (await h.db.query(`SELECT prosecdef,proconfig,(SELECT count(*)::int FROM aclexplode(proacl) WHERE grantee=0) AS public_grants
      FROM pg_proc WHERE oid=$1::regprocedure`, [CANDIDATE_SIGNATURE])).rows[0]
    h.eq(proc, { prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp', 'TimeZone=UTC'], public_grants: 0 }, 'security-definer uses fixed trusted path, UTC and no PUBLIC execute')
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      const rights = (await h.db.query(`SELECT has_table_privilege($1,'public.recording_output_candidates','SELECT') AS s,
        has_table_privilege($1,'public.recording_output_candidates','INSERT') AS i,has_table_privilege($1,'public.recording_output_candidates','UPDATE') AS u,
        has_table_privilege($1,'public.recording_output_candidates','DELETE') AS d,has_table_privilege($1,'public.recording_output_candidates','TRUNCATE') AS t`, [role])).rows[0]
      h.eq(rights, { s: role === 'service_role', i: false, u: false, d: false, t: false }, 'only service SELECT, no broad candidate mutation grants')
      const client = await h.actorClient(role, USER, 'service_role')
      if (role !== 'service_role') {
        await denied(f, args(f, 'prepare'), '42501', client)
        h.eq((await h.actor(role, USER, 'SELECT * FROM public.recording_output_candidates')).sqlstate, '42501', 'client SELECT denied even with forged JWT')
      }
      for (const sql of ['INSERT INTO public.recording_output_candidates(id) VALUES(gen_random_uuid())',
        "UPDATE public.recording_output_candidates SET state='prepared'", 'DELETE FROM public.recording_output_candidates', 'TRUNCATE public.recording_output_candidates']) {
        h.eq((await h.actor(role, USER, sql)).sqlstate, '42501', 'direct mutation rejected for every nonowner actor')
      }
      await h.close(client)
    }
    h.eq((await service.query('SELECT count(*)::int AS n FROM public.recording_output_candidates WHERE id=$1', [f.candidateId])).rows[0].n, 1, 'service SELECT policy works without BYPASSRLS')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM pg_policy WHERE polrelid='public.recording_output_candidates'::regclass AND polroles && ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid,0::oid]")).rows[0].n, 0, 'candidate table has no client/PUBLIC policies')
    await h.db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON public.recording_output_candidates TO anon,authenticated')
    for (const role of ['anon', 'authenticated']) h.eq((await h.actor(role, USER, 'SELECT * FROM public.recording_output_candidates')).rows, [], 'RLS independently denies clients even if accidental table grants exist')
    await h.db.query('REVOKE ALL ON public.recording_output_candidates FROM anon,authenticated')
    for (const change of ["byte_size=0", "duration_ms=86400001", "sha256='bad'", "bucket='audio-recordings'", "object_key='arbitrary'", "state='published'", "created_at='infinity'", "prepared_at=clock_timestamp()"] ) {
      let code; try { await h.db.query(`UPDATE public.recording_output_candidates SET ${change} WHERE id=$1`, [f.candidateId]) } catch (error) { code = error.code }
      h.eq(code, '23514', 'table constraint rejects invalid candidate metadata/state/time')
    }
  })
  await h.scenario('Restrictive Storage policies defeat broad client policies without blocking other buckets or service', async () => {
    const object = 'jobs/synthetic/attempts/1/control'
    await service.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)', ['recording-candidates', object])
    const expected = (await h.db.query("SELECT id,name,public,file_size_limit::int,allowed_mime_types FROM storage.buckets WHERE id='recording-candidates'")).rows[0]
    h.eq(expected, { id: 'recording-candidates', name: 'recording-candidates', public: false, file_size_limit: 104857600, allowed_mime_types: null }, 'private 100MiB bucket exact configuration')
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['buckets', 'objects']) {
        const predicate = table === 'buckets' ? "id='recording-candidates'" : "bucket_id='recording-candidates'"
        h.eq((await h.actor(role, USER, `SELECT * FROM storage.${table} WHERE ${predicate}`)).rows, [], 'candidate bucket and object metadata unreadable')
        h.eq((await h.actor(role, USER, `DELETE FROM storage.${table} WHERE ${predicate}`)).rowCount, 0, 'candidate rows cannot be deleted')
        h.eq((await h.actor(role, USER, `UPDATE storage.${table} SET name='altered' WHERE ${predicate}`)).rowCount, 0, 'candidate rows cannot be modified')
        h.eq((await h.actor(role, USER, `SELECT count(*)::int AS n FROM storage.${table}`)).rows[0].n, 1, 'unrelated broad client policy still operates')
      }
      for (const sql of ["INSERT INTO storage.objects(bucket_id,name) VALUES('recording-candidates','new-client-object')",
        "UPDATE storage.objects SET bucket_id='recording-candidates' WHERE bucket_id='control-public'",
        "UPDATE storage.buckets SET id='recording-candidates' WHERE id='control-public'"]) {
        h.eq((await h.actor(role, USER, sql)).sqlstate, '42501', 'WITH CHECK blocks cross-bucket creation and retargeting')
      }
      h.eq((await h.actor(role, USER, "INSERT INTO storage.buckets(id,name) VALUES('recording-candidates','recording-candidates')")).sqlstate, '42501', 'candidate bucket insert denied before conflict handling')
    }
    h.eq((await service.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='recording-candidates'")).rows[0].n, 1, 'service retains existing storage read authority')
    h.eq((await service.query("UPDATE storage.objects SET metadata='{}' WHERE bucket_id='recording-candidates'")).rowCount, 1, 'service retains existing storage mutation authority')
  })
  await h.scenario('Reserve and prepare transaction rollback and injected mutation failure leave no partial state', async () => {
    const f = await fresh(), before = await candidateState(h, f.jobId)
    await service.query('BEGIN'); await candidateRpc(service, args(f)); await service.query('ROLLBACK')
    h.eq(await candidateState(h, f.jobId), before, 'reserve transaction rollback leaves no candidate')
    await candidateRpc(service, args(f)); const reserved = await candidateState(h, f.jobId)
    await service.query('BEGIN'); await candidateRpc(service, args(f, 'prepare')); await service.query('ROLLBACK')
    h.eq(await candidateState(h, f.jobId), reserved, 'prepare transaction rollback preserves reserved state')
    await h.db.query(`CREATE FUNCTION public.candidate_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic candidate failure'; END $$;
      CREATE TRIGGER candidate_test_fail BEFORE INSERT OR UPDATE ON public.recording_output_candidates FOR EACH ROW EXECUTE FUNCTION public.candidate_test_fail()`)
    const other = await fresh(); await denied(other, args(other), 'P0001'); await denied(f, args(f, 'prepare'), 'P0001')
    await h.db.query('DROP TRIGGER candidate_test_fail ON public.recording_output_candidates; DROP FUNCTION public.candidate_test_fail()')
  })
  await h.scenario('Real simultaneous reserve duplicate-id/attempt races and exact prepare replay serialize', async () => {
    for (const mode of ['same-id', 'same-attempt', 'prepare']) {
      const f = await fresh(), a = await h.actorClient('service_role'), b = await h.actorClient('service_role'), blocker = await h.client()
      if (mode === 'prepare') await candidateRpc(service, args(f))
      await blocker.query('BEGIN'); await blocker.query('SELECT id FROM public.projects WHERE id=$1 FOR UPDATE', [PROJECT])
      const action = mode === 'prepare' ? 'prepare' : 'reserve'
      const pa = candidateOutcome(a, args(f, action)), pb = candidateOutcome(b, args(f, action, mode === 'same-attempt' ? randomUUID() : f.candidateId))
      await Promise.all([waitLock(a.processID), waitLock(b.processID)])
      await blocker.query('COMMIT')
      const results = await Promise.all([pa, pb])
      h.eq(results.map(r => r.code).sort(), mode === 'prepare' ? ['00000', '00000'] : ['00000', '23505'], 'concurrent actors persist one winner or replay exact prepare')
      if (mode === 'prepare') h.eq(results[0].receipt, results[1].receipt, 'concurrent prepare receipts identical')
      h.eq((await candidateState(h, f.jobId)).candidates.length, 1, 'unique job/attempt holds under real race')
      for (const client of [a, b, blocker]) await h.close(client)
    }
    const one = await fresh(), two = await fresh(); await candidateRpc(service, args(one))
    await denied(two, args(two, 'reserve', one.candidateId))
  })
  await h.scenario('Database clock recheck after job/candidate locks and stale prepared replay rejects expired fence', async () => {
    for (const lockTable of ['processing_jobs', 'recording_output_candidates']) {
      const f = await fresh(1000), active = await h.actorClient('service_role'), blocker = await h.client()
      if (lockTable === 'recording_output_candidates') await candidateRpc(service, args(f))
      const before = await candidateState(h, f.jobId)
      await blocker.query('BEGIN'); await blocker.query(`SELECT id FROM public.${lockTable} WHERE id=$1 FOR UPDATE`, [lockTable === 'processing_jobs' ? f.jobId : f.candidateId])
      const started = performance.now()
      const pending = candidateOutcome(active, args(f, lockTable === 'processing_jobs' ? 'reserve' : 'prepare'))
      await waitLock(active.processID); await expires(f); await blocker.query('COMMIT')
      h.eq((await pending).code, '23505', 'lock wait past expiry cannot reserve or prepare')
      h.eq(await candidateState(h, f.jobId), before, 'expiry rejection causes no writes')
      ;(h.report.lockWaits ??= []).push({ table: lockTable, elapsedMs: performance.now() - started })
      await h.close(active); await h.close(blocker)
    }
    const f = await fresh(1000); await candidateRpc(service, args(f)); await candidateRpc(service, args(f, 'prepare')); await expires(f)
    await denied(f, args(f, 'prepare'))
  })
  await h.scenario('Distinct jobs sharing an uncommitted candidate ID recheck expiry after the unique-index wait', async () => {
    for (const mode of ['expired-rollback', 'live-rollback', 'live-commit']) {
      const first = await fresh(), second = await fresh(mode === 'expired-rollback' ? 1000 : 120000)
      second.candidateId = first.candidateId
      const beforeFirst = await candidateState(h, first.jobId), beforeSecond = await candidateState(h, second.jobId)
      const writer = await h.actorClient('service_role'), waiter = await h.actorClient('service_role')
      try {
        await writer.query('BEGIN')
        await candidateRpc(writer, args(first))
        const started = performance.now()
        const pending = candidateOutcome(waiter, args(second))
        await waitLock(waiter.processID)
        const waiting = (await h.db.query(`SELECT wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers
          FROM pg_stat_activity WHERE pid=$1`, [waiter.processID])).rows[0]
        h.eq([waiting.wait_event_type, waiting.wait_event], ['Lock', 'transactionid'], 'uncommitted unique key causes a real transaction-ID wait after invisible-row lookup')
        h.ok(waiting.blockers.includes(writer.processID), 'first job transaction blocks second job candidate INSERT')
        if (mode === 'expired-rollback') await expires(second)
        else h.eq((await h.db.query('SELECT lease_expires_at > clock_timestamp() AS live FROM processing_jobs WHERE id=$1', [second.jobId])).rows[0].live, true, 'positive/collision control still has a live lease before release')
        await writer.query(mode === 'live-commit' ? 'COMMIT' : 'ROLLBACK')
        const result = await pending
        ;(h.report.uniqueIndexWaits ??= []).push({ mode, elapsedMs: performance.now() - started, ...waiting, code: result.code })
        h.eq(result.code, mode === 'live-rollback' ? '00000' : '23505', 'expired INSERT rolls back; live rollback allows one reserve; committed duplicate still rejects')
        if (mode === 'live-rollback') receipt(second, result.receipt, 'reserved')
        else h.eq(await candidateState(h, second.jobId), beforeSecond, 'rejected post-wait reserve leaves no partial candidate or job mutation')
        if (mode === 'live-commit') h.eq((await candidateState(h, first.jobId)).candidates.length, 1, 'original committed candidate remains intact')
        else h.eq(await candidateState(h, first.jobId), beforeFirst, 'original rollback leaves no candidate')
      } finally {
        await writer.query('ROLLBACK')
        await h.close(writer); await h.close(waiter)
      }
    }
  })
  await h.scenario('Revoked membership, tombstones, cancel and deletion reject both candidate actions', async () => {
    for (const kind of ['role-removed', 'role-inactive', 'tombstone', 'cancel', 'asset-deleting']) {
      for (const action of ['reserve', 'prepare']) {
        const f = await fresh(); if (action === 'prepare') await candidateRpc(service, args(f))
        if (kind === 'role-removed') await h.db.query('DELETE FROM project_roles WHERE project_id=$1 AND user_id=$2', [PROJECT, USER])
        if (kind === 'role-inactive') await h.db.query("UPDATE project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
        if (kind === 'tombstone') await h.db.query("INSERT INTO deletion_requests(project_id,subject_id,requested_by,tombstone_at) VALUES($1,$2,$3,clock_timestamp())", [PROJECT, f.assetId, USER])
        if (kind === 'cancel') await h.db.query('UPDATE processing_jobs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [f.jobId])
        if (kind === 'asset-deleting') await h.db.query("UPDATE media_assets SET state='deleting' WHERE id=$1", [f.assetId])
        await denied(f, args(f, action), '42501')
        if (kind === 'role-removed') await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')", [PROJECT, USER])
        if (kind === 'role-inactive') await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
      }
    }
  })
  await h.scenario('Prepare checks all supplied metadata and persisted identity; lease reuses pinned-input drift guards', async () => {
    const f = await fresh(); await candidateRpc(service, args(f))
    for (const [key, value] of [['byteSize', f.output.byteSize + 1], ['sha256', 'f'.repeat(64)], ['mimeType', 'audio/ogg'], ['durationMs', 500]]) {
      await denied(f, args(f, 'prepare', f.candidateId, { ...f.output, [key]: value }))
    }
    for (const change of ["worker_id='other-worker'", 'project_id=gen_random_uuid()', 'asset_id=gen_random_uuid()', 'session_id=gen_random_uuid()',
      "manifest_sha256=repeat('f',64)", "sha256=repeat('f',64)", 'byte_size=byte_size+1', "mime_type='audio/ogg'", 'duration_ms=duration_ms+1',
      "attempt_no=2,object_key='jobs/'||job_id::text||'/attempts/2/'||id::text",
      "job_id='99999999-9999-4999-8999-999999999999'::uuid,object_key='jobs/99999999-9999-4999-8999-999999999999/attempts/'||attempt_no::text||'/'||id::text",
      "created_at=clock_timestamp()+interval '1 hour'"]) {
      await h.db.query('BEGIN'); await h.db.query(`UPDATE public.recording_output_candidates SET ${change} WHERE id=$1`, [f.candidateId])
      // Same owner connection sees the deliberate uncommitted drift; full RPC
      // executes under a savepoint so failure cannot hide the unchanged record.
      const drifted = await candidateState(h, f.jobId)
      await h.db.query('SAVEPOINT candidate_drift')
      h.eq((await candidateOutcome(h.db, args(f, 'prepare'))).code, '23505', 'persisted metadata drift rejected')
      await h.db.query('ROLLBACK TO SAVEPOINT candidate_drift')
      h.eq(await candidateState(h, f.jobId), drifted, 'failed drift check has no side effects')
      await h.db.query('ROLLBACK')
    }
    await candidateRpc(service, args(f, 'prepare'))
    await h.db.query('BEGIN')
    await h.db.query("UPDATE recording_output_candidates SET prepared_at=clock_timestamp()+interval '1 hour' WHERE id=$1", [f.candidateId])
    await h.db.query('SAVEPOINT future_prepared')
    h.eq((await candidateOutcome(h.db, args(f, 'prepare'))).code, '23505', 'prepared replay rejects a future persisted timestamp')
    await h.db.query('ROLLBACK TO SAVEPOINT future_prepared'); await h.db.query('ROLLBACK')
    for (const change of ["UPDATE processing_jobs SET idempotency_key='wrong' WHERE id=$1",
      "UPDATE media_assets SET object_key='wrong' WHERE id=(SELECT asset_id FROM processing_jobs WHERE id=$1)",
      "UPDATE recording_chunks SET sha256=repeat('e',64) WHERE session_id=(SELECT session_id FROM recording_output_candidates WHERE job_id=$1)",
      "UPDATE recording_sessions SET manifest_sha256=repeat('e',64) WHERE id=(SELECT session_id FROM recording_output_candidates WHERE job_id=$1)",
      "UPDATE processing_attempts SET worker_id='different' WHERE job_id=$1"]) {
      await h.db.query('BEGIN'); await h.db.query(change, [f.jobId]); await h.db.query('SAVEPOINT input_drift')
      h.eq((await candidateOutcome(h.db, args(f, 'prepare'))).code, '23505', 'existing lease validator catches pinned ledger drift')
      await h.db.query('ROLLBACK TO SAVEPOINT input_drift'); await h.db.query('ROLLBACK')
    }
  })
  await h.scenario('Native process kill before commit rolls back; suppressed committed receipts preserve reserved/prepared evidence', async () => {
    h.report.responseLossBoundary = 'Actual PG commit and SIGKILL; child suppresses candidate receipt from its caller after commit. Not a dropped PostgreSQL wire COMMIT acknowledgement.'
    for (const action of ['reserve', 'prepare']) for (const committed of [false, true]) {
      const f = await fresh(); if (action === 'prepare') await candidateRpc(service, args(f))
      const before = await candidateState(h, f.jobId), processChild = await child(), checkpoint = message(processChild)
      processChild.send({ type: 'go', sql: CANDIDATE_RPC, args: args(f, action), transaction: true, commit: committed })
      h.eq((await checkpoint).type, committed ? 'committed-receipt-suppressed' : 'uncommitted', 'child stops at exact durable boundary without returning receipt')
      const exit = once(processChild, 'exit'); h.eq(processChild.kill('SIGKILL'), true, 'SIGKILL delivered')
      h.eq((await exit)[1], 'SIGKILL', 'OS child died by SIGKILL')
      const after = await candidateState(h, f.jobId)
      if (!committed) h.eq(after, before, 'killed transaction leaves no partial reserve/prepare')
      else {
        h.eq(after.candidates.length, 1, 'committed candidate survives process death/lost application receipt')
        h.eq(after.candidates[0].state, action === 'reserve' ? 'reserved' : 'prepared', 'exact committed state retained')
        await denied(f, args(f))
      }
    }
  })
  await h.scenario('Actual parent deletion preserves immutable candidate evidence and cannot prepare orphan', async () => {
    const f = await fresh(); await candidateRpc(service, args(f))
    const candidate = (await candidateState(h, f.jobId)).candidates
    await h.db.query('DELETE FROM processing_jobs WHERE id=$1', [f.jobId])
    await h.db.query('DELETE FROM media_assets WHERE id=$1', [f.assetId])
    await h.db.query('DELETE FROM recording_sessions WHERE id=$1', [f.sessionId])
    h.eq((await candidateState(h, f.jobId)).candidates, candidate, 'job, asset, session deletion does not delete or rewrite candidate')
    await denied(f, args(f, 'prepare'))
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.recording_output_candidates'::regclass AND contype='f'")).rows[0].n, 0, 'snapshot identities intentionally have no parent-delete foreign keys')
  })
  await h.scenario('Global publication and local-cleanup boundary remains closed', async () => {
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM media_assets WHERE state='ready'")).rows[0].n, 0, 'zero ready assets')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM processing_jobs WHERE state='succeeded' OR result_ref IS NOT NULL")).rows[0].n, 0, 'zero succeeded jobs/result references')
    h.eq((await h.db.query("SELECT count(*)::int AS n FROM recording_sessions WHERE confirmed_at IS NOT NULL OR state='cloud_confirmed'")).rows[0].n, 0, 'zero confirmed sessions')
    h.eq(receipts.every(value => value.canClearLocalDrafts === false), true, 'all receipts deny local cleanup')
    const candidates = (await h.db.query('SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS rows FROM recording_output_candidates c')).rows[0].rows
    await h.db.query('BEGIN')
    await h.db.query('DELETE FROM project_roles WHERE project_id=$1', [PROJECT])
    await h.db.query('DELETE FROM stories WHERE project_id=$1', [PROJECT])
    await h.db.query('DELETE FROM projects WHERE id=$1', [PROJECT])
    h.eq((await h.db.query('SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS rows FROM recording_output_candidates c')).rows[0].rows, candidates, 'actual project deletion cascade preserves every candidate snapshot')
    await h.db.query('ROLLBACK')
  })
  await h.close(service)
}
