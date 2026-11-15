import { randomUUID } from 'node:crypto'

export async function pilotScenarios({ h, source, evidence }) {
  for (const role of ['anon', 'authenticated']) {
    h.eq((await h.actor(role, null, "SELECT public.record_pilot_observation('{}'::jsonb)")).sqlstate, '42501', `${role} cannot write pilot observations`)
    h.eq((await h.actor(role, null, "SELECT public.read_pilot_cohort('test','synthetic')")).sqlstate, '42501', `${role} cannot read pilot observations`)
  }
  const user = randomUUID(), project = randomUUID(), household = randomUUID(), key = randomUUID()
  await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [user, 'g4-fixture@example.invalid'])
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [project, 'G4 synthetic', user])
  const cmd = { action: 'record', requestId: randomUUID(), expectedRevision: 0, householdId: household, householdKey: key, projectId: project, cohortKey: 'g4-test', cohortType: 'longitudinal_pilot', observationKind: 'synthetic', recordedBy: 'test-operator', reason: 'initial_observation', values: { pricingTier: 'free', supportMode: 'self_serve', country: 'US', acquisitionChannel: 'test', productVersion: 'g4', enrolledAt: '2026-01-01T00:00:00Z' }, evidence: { enrollment: { source: 'synthetic_fixture', reference: 'fixture:enrollment' } } }
  const rpc = async (c, client = h.db) => (await client.query('SELECT public.record_pilot_observation($1) AS r', [JSON.stringify(c)])).rows[0].r
  h.eq((await rpc(cmd)).revision, 1, 'initial observation persists')
  h.eq(await rpc(cmd), { householdId: household, revision: 1 }, 'idempotent retry returns original receipt')
  const conflict = async (command, expected, label) => { let state; try { await rpc(command) } catch (e) { state = e.code } h.eq(state, expected, label) }
  await conflict({ ...cmd, reason: 'different' }, '23505', 'same request id cannot carry a different observation')
  await conflict({ ...cmd, requestId: randomUUID() }, '40001', 'stale revision does not overwrite')
  await conflict({ ...cmd, requestId: randomUUID(), expectedRevision: 1, observationKind: 'observed' }, '22023', 'provenance cannot change from synthetic to observed')
  const next = { ...cmd, expectedRevision: 1, requestId: randomUUID(), reason: 'corrected_evidence' }
  const clients = await Promise.all([h.actorClient('service_role', user), h.actorClient('service_role', user)])
  try {
    const result = await Promise.allSettled(clients.map((client, i) => rpc({ ...next, requestId: randomUUID(), reason: 'revision_' + i }, client)))
    h.eq(result.filter(r => r.status === 'fulfilled').length, 1, 'only one concurrent correction wins')
    h.eq(result.filter(r => r.status === 'rejected').map(r => r.reason.code), ['40001'], 'concurrent loser reports revision conflict')
  } finally { for (const client of clients) await h.close(client) }
  const history = (await h.db.query('SELECT read_pilot_history($1) AS r', [household])).rows[0].r
  h.eq(history.length, 2, 'both revisions retain immutable operator/evidence trail')
  const close = { action: 'close_cohort', requestId: randomUUID(), cohortKey: cmd.cohortKey, observationKind: 'synthetic', recordedBy: 'test-operator', reason: 'recruitment_complete' }
  h.eq((await rpc(close)).closed, true, 'roster closure persists')
  await conflict({ ...cmd, requestId: randomUUID(), householdId: randomUUID(), householdKey: randomUUID() }, '55000', 'closed roster rejects new households')
  h.eq((await rpc({ ...next, requestId: randomUUID(), expectedRevision: 2 })).revision, 3, 'existing evidence may be corrected after closure')
  await h.db.query('DELETE FROM projects WHERE id=$1', [project])
  const erased = (await h.db.query('SELECT read_pilot_cohort($1,$2) AS r', [cmd.cohortKey, 'synthetic'])).rows[0].r
  h.eq(erased.entries, [], 'project deletion erases observation/evidence records')
  h.eq(erased.batch.erasedHouseholds, 1, 'anonymous loss count prevents survivor-only pass')
  h.eq((await h.db.query('SELECT read_pilot_history($1) AS r', [household])).rows[0].r, [], 'erasure removes prior revisions too')
  const project2 = randomUUID(), story = randomUUID(), household2 = randomUUID()
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [project2, 'G4 erasure fixture', user])
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)', [story, project2, user, 'Synthetic', 'Synthetic text'])
  const second = { ...cmd, requestId: randomUUID(), projectId: project2, householdId: household2, cohortKey: 'g4-erasure', householdKey: randomUUID() }
  await rpc(second)
  await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)', [user, project2, story, randomUUID()])
  h.eq((await h.db.query('SELECT read_pilot_history($1) AS r', [household2])).rows[0].r, [], 'actual G1 story soft purge erases pilot evidence')
  await conflict({ ...second, requestId: randomUUID() }, '55000', 'erased source cannot be reintroduced into a pilot roster')
  // Run both orderings with actual transactions, waiting for a real lock dependency.
  for (const ordering of ['write_first', 'purge_first']) {
    const p = randomUUID(), s = randomUUID(), hh = randomUUID()
    await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [p, 'G4 concurrency fixture', user])
    await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)', [s, p, user, 'Synthetic', 'Synthetic source'])
    const c = { ...cmd, projectId: p, householdId: hh, householdKey: randomUUID(), cohortKey: 'race-' + ordering, requestId: randomUUID() }
    const writer = await h.actorClient('service_role', user), purger = await h.actorClient('service_role', user)
    let pending
    try {
      await writer.query('BEGIN'); await purger.query('BEGIN')
      const write = () => rpc(c, writer), purge = () => purger.query('SELECT request_story_deletion($1,$2,$3,$4)', [user, p, s, randomUUID()])
      if (ordering === 'write_first') { await write(); pending = purge().then(() => 'ok', e => e.code) }
      else { await purge(); pending = write().then(() => 'ok', e => e.code) }
      const waiting = ordering === 'write_first' ? purger.processID : writer.processID
      let blocked = false
      for (let i = 0; i < 80 && !blocked; i++) {
        blocked = (await h.db.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked', [waiting])).rows[0].blocked
        if (!blocked) await new Promise(done => setTimeout(done, 10))
      }
      h.ok(blocked, ordering + ' actually waits on a PostgreSQL lock')
      await (ordering === 'write_first' ? writer : purger).query('COMMIT')
      h.eq(await pending, ordering === 'write_first' ? 'ok' : '55000', ordering + ' deletion wins over observation write')
      await (ordering === 'write_first' ? purger : writer).query(ordering === 'write_first' ? 'COMMIT' : 'ROLLBACK')
      h.eq((await h.db.query('SELECT read_pilot_history($1) AS r', [hh])).rows[0].r, [], ordering + ' leaves no resurrected evidence')
    } finally {
      await writer.query('ROLLBACK'); await purger.query('ROLLBACK'); await h.close(writer); await h.close(purger)
    }
  }
  h.report.pilotLedger = { status: 'passed', source: 'synthetic', boundary: 'Actual PostgreSQL roles, persisted revisions and roster closure; no real households.' }
  if (process.argv.includes('--chrome')) {
    await source('experiments/pg17-g4-pilot/chrome.mjs')
    const { pilotChrome } = await import('./chrome.mjs')
    await pilotChrome({ h, source, evidence })
  }
}
