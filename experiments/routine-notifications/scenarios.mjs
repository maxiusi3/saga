// These assertions precede the candidate SQL. Each uses the real local database.
export const U = {
  a: '10000000-0000-0000-0000-000000000001',
  b: '10000000-0000-0000-0000-000000000002',
  outsider: '10000000-0000-0000-0000-000000000003',
}
export const N = {
  a1: '20000000-0000-0000-0000-000000000001',
  a2: '20000000-0000-0000-0000-000000000002',
  aRead: '20000000-0000-0000-0000-000000000003',
  aNull: '20000000-0000-0000-0000-000000000004',
  b1: '20000000-0000-0000-0000-000000000005',
  b2: '20000000-0000-0000-0000-000000000006',
}
export const countSql = 'SELECT public.get_unread_notification_count($1::uuid) AS n'
export const markSql = 'SELECT public.mark_notifications_as_read($1::uuid,$2::uuid[]) AS n'
const old = '2001-01-01T00:00:00.000Z'

export async function seed(db) {
  await db.query('TRUNCATE public.notifications, rehearsal.family_members, auth.users')
  for (const user of Object.values(U)) await db.query('INSERT INTO auth.users VALUES ($1)', [user])
  for (const [user, family] of [[U.a, '30000000-0000-0000-0000-000000000001'], [U.b, '30000000-0000-0000-0000-000000000002']])
    await db.query('INSERT INTO rehearsal.family_members VALUES ($1,$2)', [user, family])
  for (const [id, recipient, isRead, readAt] of [
    [N.a1, U.a, false, null], [N.a2, U.a, false, old],
    [N.aRead, U.a, true, old], [N.aNull, U.a, null, null],
    [N.b1, U.b, false, null], [N.b2, U.b, false, null],
  ]) await db.query('INSERT INTO public.notifications VALUES ($1,$2,$3,$4,$5)', [id, recipient, isRead, readAt, old])
}

const snapshot = async db => (await db.query('SELECT id,recipient_id,is_read,read_at,updated_at FROM public.notifications ORDER BY id')).rows
const row = async (db, id) => (await db.query('SELECT is_read,read_at,updated_at FROM public.notifications WHERE id=$1', [id])).rows[0]

export async function baseline(h) {
  const { db, actor, eq, scenario, report } = h
  await scenario('baseline_anonymous_count_discloses_another_recipient', async () => {
    eq((await actor('anon', null, countSql, [U.b])).rows, [{ n: 2 }], 'baseline anonymous sees two foreign unread notifications')
  })
  await scenario('baseline_forged_target_marks_another_family', async () => {
    eq((await actor('authenticated', U.a, markSql, [U.b, [N.b1]])).rows, [{ n: 1 }], 'baseline forged recipient mutates foreign notification')
    eq((await row(db, N.b1)).is_read, true, 'baseline unauthorized update actually persisted')
  })
  await scenario('baseline_metadata_claim_spoof_can_execute', async () => {
    eq((await actor('metadata_reader', U.b, countSql, [U.b], 'authenticated')).rows, [{ n: 1 }], 'baseline metadata role bypasses table ACL through definer')
  })
  report.baseline = { reproduced: true, anonymousForeignCount: 2, forgedTargetChangedRows: 1, metadataSpoofCount: 1 }
  await seed(db)
}

export async function verifyCandidate(h) {
  const { db, actor, eq, ok, scenario } = h
  const denied = async (role, who, target, ids = null, claimRole = role) => {
    eq((await actor(role, who, countSql, [target], claimRole)).error, '42501', 'unauthorized count rejects with insufficient_privilege')
    eq((await actor(role, who, markSql, [target, ids], claimRole)).error, '42501', 'unauthorized mark rejects with insufficient_privilege')
  }
  // Removing either ACL revocation or identity binding makes these fail.
  await scenario('anonymous_count_and_mark_rejected', () => denied('anon', null, U.a))
  await scenario('null_identity_and_null_target_rejected', async () => {
    for (const [who, target] of [[null, U.a], [null, null], [U.a, null]])
      await denied('authenticated', who, target)
  })
  await scenario('forged_recipient_and_nonmember_rejected_without_mutation', async () => {
    const before = await snapshot(db)
    await denied('authenticated', U.a, U.b, [N.b1])
    await denied('authenticated', U.outsider, U.a, [N.a1])
    eq(await snapshot(db), before, 'denials preserve both families')
  })
  await scenario('metadata_direct_login_spoofed_claim_still_denied_by_execute_acl', async () => {
    eq((await actor('metadata_reader', U.a, 'SELECT auth.uid() AS uid', [], 'authenticated')).rows, [{ uid: U.a }], 'spoof is real: test helper accepts the GUC')
    await denied('metadata_reader', U.a, U.a, [N.a1], 'authenticated')
    const r = await actor('metadata_reader', U.a, 'SET ROLE authenticated', [], 'authenticated')
    eq(r.error, '42501', 'metadata role cannot switch to authenticated')
  })
  await scenario('anonymous_spoof_and_service_role_are_not_fallback_callers', async () => {
    await denied('anon', U.a, U.a, null, 'authenticated')
    await denied('service_role', U.a, U.a, null, 'authenticated')
  })
  await scenario('actual_acl_definer_owner_and_fixed_search_path', async () => {
    const funcs = (await db.query("SELECT p.proname,p.prosecdef,p.proconfig,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prorettype::regtype::text AS result,pg_catalog.pg_get_function_arguments(p.oid) AS args,EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_catalog.pg_proc p WHERE p.oid IN ('public.get_unread_notification_count(uuid)'::regprocedure,'public.mark_notifications_as_read(uuid,uuid[])'::regprocedure) ORDER BY p.proname")).rows
    eq(funcs.length, 2, 'exact two routines present')
    for (const f of funcs) {
      eq(f.prosecdef, true, 'still SECURITY DEFINER')
      eq(f.owner, 'fixture_owner', 'non-login owner retained')
      eq(f.result, 'integer', 'integer result preserved')
      eq(f.proconfig, ['search_path=""'], 'fixed empty lookup path')
      eq(f.public_execute, false, 'PUBLIC execution revoked')
    }
    eq(funcs.map(f => f.args), ['user_id uuid', 'user_id uuid, notification_ids uuid[] DEFAULT NULL::uuid[]'], 'names and default contract preserved')
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role']) {
      const r = (await db.query("SELECT pg_catalog.has_function_privilege($1,'public.get_unread_notification_count(uuid)','EXECUTE') AS count,pg_catalog.has_function_privilege($1,'public.mark_notifications_as_read(uuid,uuid[])','EXECUTE') AS mark", [role])).rows[0]
      eq(r, { count: role === 'authenticated', mark: role === 'authenticated' }, 'effective privileges match intended exact role')
    }
    eq((await db.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_catalog.pg_roles WHERE rolname='fixture_owner'")).rows[0], { rolsuper: false, rolbypassrls: false, rolcanlogin: false }, 'owner has no global RLS bypass')
  })
  await scenario('direct_table_access_rejected_for_all_caller_roles', async () => {
    const before = await snapshot(db)
    for (const role of ['anon', 'authenticated', 'metadata_reader', 'service_role'])
      for (const sql of ['SELECT id FROM public.notifications', 'UPDATE public.notifications SET is_read=true', 'DELETE FROM public.notifications', 'INSERT INTO public.notifications(id,recipient_id) VALUES ($1,$2)'])
        eq((await actor(role, U.a, sql, sql.includes('$1') ? ['20000000-0000-0000-0000-000000000099', U.a] : [])).error, '42501', 'direct table ACL rejects')
    eq(await snapshot(db), before, 'direct attempts did not change data')
  })
  await scenario('own_count_excludes_already_read_and_null_flags', async () => {
    eq((await actor('authenticated', U.a, countSql, [U.a])).rows, [{ n: 2 }], 'two explicit false rows count')
    eq((await actor('authenticated', U.b, countSql, [U.b])).rows, [{ n: 2 }], 'second user positive control')
    eq((await actor('authenticated', U.outsider, countSql, [U.outsider])).rows, [{ n: 0 }], 'no family membership requirement invented for own empty inbox')
  })
  await scenario('empty_array_and_foreign_only_subset_change_nothing', async () => {
    const before = await snapshot(db)
    for (const ids of [[], [N.b1, N.b2]])
      eq((await actor('authenticated', U.a, markSql, [U.a, ids])).rows, [{ n: 0 }], 'empty or foreign subset filtered')
    eq(await snapshot(db), before, 'foreign-only subset preserves all fields')
  })
  await scenario('duplicate_mixed_subset_updates_own_once_and_preserves_other_family', async () => {
    const before = await snapshot(db)
    eq((await actor('authenticated', U.a, markSql, [U.a, [N.a1, N.a1, N.b1]])).rows, [{ n: 1 }], 'duplicate IDs do not inflate affected count')
    const after = await snapshot(db)
    eq(after.filter(r => r.id !== N.a1), before.filter(r => r.id !== N.a1), 'every unselected or foreign row unchanged')
    const changed = await row(db, N.a1)
    eq(changed.is_read, true, 'own selected row marked')
    ok(changed.read_at instanceof Date, 'read time populated')
    eq(changed.read_at, changed.updated_at, 'transaction now shared by both timestamps')
  })
  await scenario('already_read_is_noop_and_existing_read_timestamp_preserved', async () => {
    const before = await row(db, N.a1)
    eq((await actor('authenticated', U.a, markSql, [U.a, [N.a1, N.aRead, N.aNull]])).rows, [{ n: 0 }], 'already read and null flags ignored')
    eq(await row(db, N.a1), before, 'already-read timestamps unchanged')
    eq((await actor('authenticated', U.a, markSql, [U.a, [N.a2]])).rows, [{ n: 1 }], 'remaining own false row marked')
    const changed = await row(db, N.a2)
    eq(changed.read_at.toISOString(), old, 'existing read_at retained by COALESCE')
    ok(changed.updated_at.toISOString() > old, 'updated_at advances for newly marked row')
    eq((await actor('authenticated', U.a, countSql, [U.a])).rows, [{ n: 0 }], 'own unread count now zero')
  })
  await scenario('null_array_and_omitted_default_mark_all_own_unread_only', async () => {
    for (const omitted of [false, true]) {
      await seed(db)
      const foreignBefore = (await snapshot(db)).filter(r => r.recipient_id === U.b)
      const result = await actor('authenticated', U.a, omitted ? 'SELECT public.mark_notifications_as_read(user_id => $1::uuid) AS n' : markSql, omitted ? [U.a] : [U.a, null])
      eq(result.rows, [{ n: 2 }], 'NULL/default marks both own false rows')
      eq((await snapshot(db)).filter(r => r.recipient_id === U.b), foreignBefore, 'other family exactly unchanged')
      eq((await row(db, N.aNull)).is_read, null, 'NULL flag remains NULL')
    }
  })
  await scenario('caller_search_path_and_temp_shadow_do_not_redirect_target', async () => {
    await seed(db)
    const result = await actor('authenticated', U.a, `CREATE TEMP TABLE notifications (recipient_id uuid, is_read boolean); INSERT INTO notifications VALUES ('${U.a}',false); SET search_path=pg_temp; SELECT public.get_unread_notification_count('${U.a}'::uuid) AS n`)
    eq(result.rows, [{ n: 2 }], 'qualified real table wins over one-row temp shadow')
  })
}
