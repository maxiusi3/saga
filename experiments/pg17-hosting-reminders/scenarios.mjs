import { randomUUID } from 'node:crypto'

export async function hostingReminderScenarios({ h, source, evidence }) {
  h.ok((await h.db.query("SELECT to_regprocedure('public.tick_hosting_reminders(integer,boolean)') IS NOT NULL AS exists")).rows[0].exists,
    'durable hosting reminder scheduler exists')
  const user = randomUUID(), other = randomUUID()
  await h.db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now()),($3,$4,now())',
    [user, 'reminder@example.invalid', other, 'other@example.invalid'])
  async function order(days, status = 'active') {
    const project = randomUUID(), id = randomUUID()
    await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [project, 'Private project title', user])
    await h.db.query("INSERT INTO payment_orders(id,payer_id,package_id,amount_cents,currency,mode,status,paid_at) VALUES($1,$2,'digital_project_59',5900,'usd','test','paid',now())", [id,user])
    await h.db.query("INSERT INTO payment_project_rights(order_id,payer_id,project_id,status,hosting_started_at,hosting_expires_at) VALUES($1,$2,$3,$4,now()-interval '1 year',now()+($5::text||' days')::interval)", [id,user,project,status,days])
    return { id, project }
  }
  const before = await order(91), ninety = await order(89), thirty = await order(29), expired = await order(-1), refunded = await order(20, 'refunded')
  const tick = (email = false, client = h.db) => client.query('SELECT tick_hosting_reminders(100,$1) AS r', [email]).then(r=>r.rows[0].r)
  for (const role of ['anon','authenticated']) {
    h.eq((await h.actor(role,user,'SELECT tick_hosting_reminders(100,false)')).sqlstate,'42501',role+' cannot schedule notifications')
    h.eq((await h.actor(role,user,'SELECT * FROM hosting_reminders')).sqlstate,'42501',role+' cannot read other payment reminders')
  }
  h.eq((await tick()).inAppSent,2,'only current 90/30-day windows deliver')
  h.eq((await tick()).inAppSent,0,'repeated pass does not duplicate')
  let rows = (await h.db.query('SELECT * FROM hosting_reminders ORDER BY days_before DESC')).rows
  h.eq(rows.map(r=>r.days_before),[90,30],'late startup skips obsolete 90-day reminder')
  h.eq(rows.map(r=>r.email_state),['disabled','disabled'],'in-app only never claims email delivery')
  h.eq((await h.db.query('SELECT count(*)::int AS n FROM notifications WHERE recipient_id=$1',[user])).rows[0].n,2,'notifications really persisted')
  const notices = (await h.db.query('SELECT * FROM notifications WHERE recipient_id=$1',[user])).rows
  h.ok(notices.every(n=>n.type==='hosting_expiry' && n.action_url.includes('/dashboard/projects/') && !n.message.includes('Private project title')),'notifications contain usable action with no project prose')
  const outsider = await h.actorClient('authenticated',other)
  try { h.eq((await outsider.query('SELECT * FROM notifications WHERE recipient_id=$1',[user])).rows,[],'notification RLS rejects cross-family read') }
  finally { await h.close(outsider) }
  // Removing a read notification must not reset delivery identity.
  await h.db.query('DELETE FROM notifications WHERE id=$1',[notices[0].id])
  h.eq((await tick()).inAppSent,0,'dismissed notification is not reissued')
  await h.db.query("UPDATE payment_project_rights SET hosting_expires_at=now()+interval '29 days' WHERE order_id=$1",[ninety.id])
  h.eq((await tick()).inAppSent,1,'new expiry version gets distinct current reminder')
  h.eq((await h.db.query('SELECT count(*)::int AS n FROM hosting_reminders WHERE order_id=$1',[ninety.id])).rows[0].n,2,'expiry version identity remains auditable')
  const concurrent = await order(50)
  const a = await h.actorClient('service_role',null), b = await h.actorClient('service_role',null)
  try {
    const results = await Promise.all([tick(false,a),tick(false,b)])
    h.eq(results.reduce((n,r)=>n+r.inAppSent,0),1,'concurrent workers deliver once')
  } finally { await h.close(a); await h.close(b) }
  h.eq((await h.db.query("SELECT count(*)::int AS n FROM notifications WHERE data->>'hosting_order_id'=$1",[concurrent.id])).rows[0].n,1,'concurrent delivery is one physical row')
  // Email is opt-in operator configuration; sending authorization is separately durable.
  const mail = await order(40)
  await tick(true)
  const claim = (await h.db.query('SELECT claim_hosting_reminder_email() AS r')).rows[0].r
  h.eq(claim.orderId,mail.id,'email queue claim uses the allocated order')
  h.eq(claim.email,'reminder@example.invalid','email recipient resolved from verified Auth identity')
  h.eq((await h.db.query('SELECT claim_hosting_reminder_email() AS r')).rows[0].r,null,'same pending delivery cannot be claimed concurrently')
  const begin = () => h.db.query('SELECT begin_hosting_reminder_email($1,$2) AS r',[claim.id,claim.token]).then(r=>r.rows[0].r)
  h.eq((await begin()).status,'outbound','single-use outbound permit established')
  h.eq((await begin()).status,'unknown','repeated begin cannot duplicate external send')
  await h.db.query("SELECT complete_hosting_reminder_email($1,$2,'sent','provider-synthetic-id')",[claim.id,claim.token])
  h.eq((await h.db.query('SELECT email_state FROM hosting_reminders WHERE id=$1',[claim.id])).rows[0].email_state,'sent','actual provider receipt persisted')
  // Source withdrawal between claim and send revokes authorization.
  const withdrawn = await order(35)
  await tick(true)
  const pending = (await h.db.query('SELECT claim_hosting_reminder_email() AS r')).rows[0].r
  await h.db.query("UPDATE payment_project_rights SET status='refunded' WHERE order_id=$1",[withdrawn.id])
  h.eq((await h.db.query('SELECT begin_hosting_reminder_email($1,$2) AS r',[pending.id,pending.token])).rows[0].r.status,'canceled','refund before outbound cancels email')
  const erased = await order(55)
  await tick(true)
  await h.db.query('DELETE FROM projects WHERE id=$1',[erased.project])
  h.eq((await h.db.query('SELECT count(*)::int AS n FROM hosting_reminders WHERE project_id=$1',[erased.project])).rows[0].n,0,'project removal purges reminder identity')
  h.eq((await h.db.query("SELECT count(*)::int AS n FROM notifications WHERE data->>'hosting_project_id'=$1",[erased.project])).rows[0].n,0,'project removal purges expiry notifications')
  // Invalid earlier rows must not occupy the candidate LIMIT forever.
  const blocked = []
  for (let i=0;i<101;i++) {
    const invalid = await order(2)
    await h.db.query('UPDATE projects SET facilitator_id=$2 WHERE id=$1',[invalid.project,other])
    blocked.push(invalid)
  }
  const afterInvalid = await order(3)
  h.eq((await h.db.query('SELECT tick_hosting_reminders(1,false) r')).rows[0].r.inAppSent,1,'ineligible first 101 projects cannot starve the next valid reminder')
  h.eq((await h.db.query('SELECT count(*)::int n FROM hosting_reminders WHERE order_id=$1',[afterInvalid.id])).rows[0].n,1,'eligible row beyond stale candidates delivered')
  // Prepared work can be reclaimed only before durable outbound permission.
  const recover = await order(45);await tick(true)
  const preparation=(await h.db.query('SELECT claim_hosting_reminder_email() r')).rows[0].r
  h.eq(preparation.orderId,recover.id,'preparation recovery fixture claimed')
  await h.db.query("UPDATE hosting_reminders SET email_lease_until=now()-interval '1 minute' WHERE id=$1",[preparation.id])
  const reclaimed=(await h.db.query('SELECT claim_hosting_reminder_email() r')).rows[0].r
  h.ok(reclaimed.token!==preparation.token,'expired preparation gets fresh single-use token')
  const staleActor=await h.actor('service_role',null,'SELECT begin_hosting_reminder_email($1,$2)',[preparation.id,preparation.token])
  h.eq(staleActor.sqlstate,'23505','stale preparation token cannot authorize email')
  await h.db.query('SELECT begin_hosting_reminder_email($1,$2)',[reclaimed.id,reclaimed.token])
  await h.db.query("UPDATE hosting_reminders SET email_outbound_at=now()-interval '25 hours' WHERE id=$1",[reclaimed.id])
  h.eq((await h.db.query('SELECT claim_hosting_reminder_email() r')).rows[0].r,null,'old outbound never returns to preparation beyond provider key lifetime')
  h.eq((await h.db.query('SELECT email_state FROM hosting_reminders WHERE id=$1',[reclaimed.id])).rows[0].email_state,'unknown','abandoned outbound surfaces as unknown')
  const revoke = await order(47);await tick(true)
  const revokeClaim=(await h.db.query('SELECT claim_hosting_reminder_email() r')).rows[0].r
  await h.db.query('UPDATE projects SET facilitator_id=$2 WHERE id=$1',[revoke.project,other])
  h.eq((await h.db.query('SELECT begin_hosting_reminder_email($1,$2) r',[revokeClaim.id,revokeClaim.token])).rows[0].r.status,'canceled','permission removal before send cancels outbound')
  const contention=await order(48),locking=await h.actorClient('service_role',null)
  try {
    // Owner uses administrative fixture to hold the source; RPC cannot deadlock with it.
    await h.db.query('BEGIN');await h.db.query('SELECT 1 FROM projects WHERE id=$1 FOR UPDATE',[contention.project])
    h.eq((await tick(true,locking)).inAppSent,0,'busy source is skipped without lock inversion')
    await h.db.query('COMMIT')
    h.eq((await tick()).inAppSent,1,'unlocked source becomes eligible next pass')
  } finally {await h.db.query('ROLLBACK');await h.close(locking)}
  await source('experiments/pg17-hosting-reminders/http.mjs')
  const { hostingReminderHttp } = await import('./http.mjs')
  await hostingReminderHttp({h,source,evidence})
  h.report.hostingReminders={status:'passed',boundary:'Actual PG roles, fixed expiry windows, persisted station delivery, synthetic email handshake; no messages to real recipients.'}
}
