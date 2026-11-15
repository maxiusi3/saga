import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const configuration = { editor: { provider: 'anthropic', model: 'claude-opus-5-5', region: 'us' }, reviewer: { provider: 'openai', model: 'gpt-6-astra', region: 'us' } }
const policy = 'g2-ai-' + 'b'.repeat(64)
const ai = async (db, fixture, operation, payload = {}) => (await db.query(
  'SELECT story_ai_edit($1,$2,$3,$4,$5::jsonb) r', [fixture.owner, fixture.story, operation, fixture.request, JSON.stringify(payload)])).rows[0].r
const review = async (db, owner, story, operation, state, extra = {}) => (await db.query(
  'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r', [owner, story, operation, randomUUID(), state?.revision.edit_version ?? null,
    JSON.stringify({ ...(state ? { revision_id: state.revision.id } : {}), ...extra })])).rows[0].r

async function snapshot(db, fixture) {
  const result = {}
  for (const table of ['story_ai_edit_requests', 'story_revisions', 'story_assertions', 'transcript_versions']) {
    result[table] = (await db.query(`SELECT to_jsonb(t) r FROM ${table} t WHERE story_id=ANY($1::uuid[]) ORDER BY to_jsonb(t)::text`, [fixture.stories])).rows.map(row => row.r)
  }
  result.transcript_segments = (await db.query('SELECT to_jsonb(s) r FROM transcript_segments s JOIN transcript_versions t ON t.id=s.transcript_version_id WHERE t.story_id=ANY($1::uuid[]) ORDER BY s.id', [fixture.stories])).rows.map(row => row.r)
  result.consent_records = (await db.query('SELECT to_jsonb(c) r FROM consent_records c WHERE subject_id=ANY($1::text[]) ORDER BY c.id', [fixture.stories])).rows.map(row => row.r)
  result.hosting_reminders = (await db.query('SELECT to_jsonb(h) r FROM hosting_reminders h WHERE project_id=ANY($1::uuid[]) ORDER BY h.id', [fixture.projects])).rows.map(row => row.r)
  result.notifications = (await db.query("SELECT to_jsonb(n) r FROM notifications n WHERE data->>'hosting_project_id'=ANY($1::text[]) ORDER BY n.id", [fixture.projects])).rows.map(row => row.r)
  return result
}

// This is a durable-state rehearsal: model outputs and email receipts are explicit
// synthetic fixtures. Only the real SQL transition/erasure routines execute.
export async function prepareDurableRecordsBackup({ h, owner, stories, evidence }) {
  const fixture = { owner, stories, projects: [], ai: [], reminders: [] }
  const approve = async (story, state) => {
    for (const assertion of state.assertions) state = await review(h.db, owner, story, 'decide_assertion', state, { assertion_id: assertion.id, action: 'accept' })
    return review(h.db, owner, story, 'approve_revision', state)
  }
  for (const story of stories) {
    let state = await review(h.db, owner, story, 'prepare')
    // G3 publication needs an approved rendition even while a newer AI attempt
    // is pending. Family decisions, including approval, remain real RPCs.
    if (story === stories[1]) {
      await approve(story, state)
      state = await review(h.db, owner, story, 'prepare')
    }
    const q = { owner, story, request: randomUUID() }
    const reserved = await ai(h.db, q, 'reserve', { consent: true, configuration, policy_version: policy,
      revision_id: state.revision.id, expected_version: state.revision.edit_version, transcript_id: state.transcript.id,
      source_hash: state.revision.source_hash, source_fingerprint: state.revision.provenance_snapshot.source_fingerprint })
    q.lease = { lease_token: reserved.leaseToken, policy_version: policy }
    q.result = { paragraphs: state.transcript.segments.map(s => ({ text: s.text, segmentId: s.id, sourceQuote: s.text, startMs: s.start_ms, endMs: s.end_ms })),
      verdicts: state.transcript.segments.map((_, index) => ({ index, supported: true, severity: 'none', risks: [] })),
      metadata: { editor: { ...configuration.editor, responseId: 'synthetic-backup-editor' }, reviewer: { ...configuration.reviewer, responseId: 'synthetic-backup-reviewer' } } }
    h.eq((await ai(h.db, q, 'editor', q.lease)).status, 'dispatch_allowed', 'backup AI editing permitted once')
    h.eq((await ai(h.db, q, 'reviewer', q.lease)).status, 'dispatch_allowed', 'backup AI review permitted once')
    if (story === stories[0]) {
      state = (await ai(h.db, q, 'complete', { ...q.lease, result: q.result })).review
      h.eq(state.assertions[0].ai_review.supported, true, 'backup contains actual source-bound AI evidence')
      state = await approve(story, state)
    }
    q.state = state
    fixture.ai.push(q)
  }
  const mailOwner = randomUUID()
  fixture.mailOwner = mailOwner
  await h.db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [mailOwner, 'durable-backup@example.invalid'])
  for (const outcome of ['sent', 'unknown']) {
    const project = randomUUID(), order = randomUUID()
    fixture.projects.push(project)
    await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [project, 'Synthetic reminder backup', mailOwner])
    await h.db.query("INSERT INTO payment_orders(id,payer_id,package_id,amount_cents,currency,mode,status,paid_at) VALUES($1,$2,'digital_project_59',5900,'usd','test','paid',now())", [order, mailOwner])
    await h.db.query("INSERT INTO payment_project_rights(order_id,payer_id,project_id,status,hosting_started_at,hosting_expires_at) VALUES($1,$2,$3,'active',now()-interval '1 year',now()+interval '45 days')", [order, mailOwner, project])
    await h.db.query('SELECT tick_hosting_reminders(100,true)')
    const claim = (await h.db.query('SELECT claim_hosting_reminder_email() r')).rows[0].r
    h.eq(claim?.orderId, order, 'backup email claims this synthetic allocated order')
    h.eq((await h.db.query('SELECT begin_hosting_reminder_email($1,$2) r', [claim.id, claim.token])).rows[0].r.status, 'outbound', 'backup persists email outbound fence')
    await h.db.query('SELECT complete_hosting_reminder_email($1,$2,$3,$4)', [claim.id, claim.token, outcome, outcome === 'sent' ? 'synthetic_backup_receipt' : null])
    fixture.reminders.push(claim)
  }
  fixture.snapshot = await snapshot(h.db, fixture)
  await writeFile(join(evidence, 'durable-records-before-freeze.json'), JSON.stringify(fixture.snapshot, null, 2) + '\n')
  return fixture
}

export async function captureDurableProjectTombstone({ h, fixture, frozen, evidence }) {
  // The existing project-scope tombstone contract is a maintenance fixture;
  // request_media_deletion only implements story/media_asset capture today.
  const request = (await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by,tombstone_at) VALUES($1::uuid,$1::uuid::text,$2,clock_timestamp()) RETURNING to_jsonb(deletion_requests) r',
    [fixture.projects[0], fixture.mailOwner])).rows[0].r
  h.ok(Date.parse(request.tombstone_at) >= Date.parse(frozen), 'reminder project tombstone is captured after freeze')
  h.eq((await h.db.query('SELECT count(*)::int n FROM hosting_reminders WHERE project_id=$1', [fixture.projects[0]])).rows[0].n, 0, 'live project tombstone erases durable reminder')
  await writeFile(join(evidence, 'post-freeze-reminder-project-tombstone.json'), JSON.stringify(request, null, 2) + '\n')
  return request
}

async function rejects(h, db, run, expected, label) {
  let code = '00000'
  try { await run() } catch (error) { code = error.code }
  h.eq(code, expected, label)
}

export async function verifyDurableRecordsRestore({ h, restored, fixture }) {
  h.eq(await snapshot(restored, fixture), fixture.snapshot, 'AI source/revision/consent/lease/evidence and reminder notification/expiry/token/receipt rows restore exactly')
  const pending = fixture.ai[1]
  await rejects(h, restored, () => ai(restored, pending, 'complete', { ...pending.lease, lease_token: randomUUID(), result: pending.result }), '42501', 'restored AI rejects a different lease')
  await rejects(h, restored, () => ai(restored, pending, 'reviewer', pending.lease), '23505', 'restored unknown AI outbound is not redispatched')
  for (const [operation, extra, label] of [
    ['correct_transcript', { text: 'Synthetic corrected source after restore.' }, 'source'],
    ['decide_assertion', { assertion_id: pending.state.assertions[0].id, action: 'accept' }, 'revision'],
  ]) {
    await restored.query('BEGIN')
    try {
      await review(restored, pending.owner, pending.story, operation, pending.state, extra)
      await rejects(h, restored, () => ai(restored, pending, 'complete', { ...pending.lease, result: pending.result }), '23505', 'restored AI fences changed ' + label)
    } finally { await restored.query('ROLLBACK') }
  }
  await restored.query('BEGIN')
  try { h.eq((await ai(restored, pending, 'complete', { ...pending.lease, result: pending.result })).status, 'completed', 'restored unchanged AI source and lease can finish') }
  finally { await restored.query('ROLLBACK') }
  const mail = fixture.reminders[1]
  await rejects(h, restored, () => restored.query("SELECT complete_hosting_reminder_email($1,$2,'sent','synthetic_reconciled_receipt')", [mail.id, randomUUID()]), '23505', 'restored email completion rejects a different token')
  h.eq((await restored.query('SELECT begin_hosting_reminder_email($1,$2) r', [mail.id, mail.token])).rows[0].r.status, 'unknown', 'restored unknown email is not authorized again')
  await restored.query('BEGIN')
  try {
    await restored.query("UPDATE payment_project_rights SET hosting_expires_at=hosting_expires_at+interval '1 day' WHERE order_id=$1", [mail.orderId])
    h.eq((await restored.query('SELECT begin_hosting_reminder_email($1,$2) r', [mail.id, mail.token])).rows[0].r.status, 'canceled', 'restored email source expiry version remains fenced')
  } finally { await restored.query('ROLLBACK') }
}

export async function verifyDurableRecordsReplay({ h, restored, fixture, projectTombstone, result }) {
  // Called after the existing exact story capture has already been replayed.
  for (const table of ['story_ai_edit_requests', 'story_revisions', 'story_assertions']) {
    h.eq((await restored.query(`SELECT count(*)::int n FROM ${table} WHERE story_id=$1`, [fixture.stories[0]])).rows[0].n, 0, 'restored story tombstone erases AI ' + table)
  }
  await rejects(h, restored, () => ai(restored, fixture.ai[0], 'complete', { ...fixture.ai[0].lease, result: fixture.ai[0].result }), '23505', 'deleted restored AI cannot resurrect its completed draft')
  await restored.query('INSERT INTO deletion_requests SELECT * FROM jsonb_populate_record(NULL::deletion_requests,$1::jsonb)', [projectTombstone])
  h.eq((await restored.query('SELECT to_jsonb(d) r FROM deletion_requests d WHERE id=$1', [projectTombstone.id])).rows[0].r, projectTombstone, 'exact project tombstone restored before reminder delivery')
  h.eq((await restored.query('SELECT count(*)::int n FROM hosting_reminders WHERE project_id=$1', [fixture.projects[0]])).rows[0].n, 0, 'restored project tombstone removes reminder receipt and lease')
  h.eq((await restored.query("SELECT count(*)::int n FROM notifications WHERE data->>'hosting_project_id'=$1", [fixture.projects[0]])).rows[0].n, 0, 'restored project tombstone removes station notification')
  const erased = fixture.reminders[0]
  h.eq((await restored.query("SELECT complete_hosting_reminder_email($1,$2,'sent','synthetic_backup_receipt') r", [erased.id, erased.token])).rows[0].r.status, 'canceled', 'deleted reminder late callback cannot resurrect receipt')
  await restored.query('SELECT tick_hosting_reminders(100,false)')
  h.eq((await restored.query('SELECT count(*)::int n FROM hosting_reminders WHERE project_id=$1', [fixture.projects[0]])).rows[0].n, 0, 'restored project tombstone prevents scheduler reissue')
  const surviving = await snapshot(restored, { stories: [fixture.stories[1]], projects: [fixture.projects[1]] })
  for (const [table, rows] of Object.entries(surviving)) {
    const expected = fixture.snapshot[table].filter(row => table === 'notifications' ? row.data.hosting_project_id === fixture.projects[1]
      : table === 'hosting_reminders' ? row.project_id === fixture.projects[1]
        : table === 'consent_records' ? row.subject_id === fixture.stories[1]
          : table === 'transcript_segments' ? row.transcript_version_id === fixture.ai[1].state.transcript.id : row.story_id === fixture.stories[1])
    h.eq(rows, expected, 'unrelated durable backup survivor unchanged: ' + table)
  }
  result.durableRecords = { status: 'passed', tables: Object.keys(fixture.snapshot), storyIds: fixture.stories, reminderProjectIds: fixture.projects,
    checks: ['exact state restoration', 'AI lease/source/revision fences', 'unknown outbound not repeated', 'reminder expiry/token fences', 'story erasure and late completion blocked', 'project tombstone erasure and reissue blocked', 'unrelated state preserved'],
    boundary: 'Real native PG dump/restore and production SQL RPCs/triggers. Synthetic AI output, payment allocation and email receipt; project-scope tombstone inserted by local maintenance fixture. No external provider or real recipient.' }
}
