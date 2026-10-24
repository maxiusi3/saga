import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, digest } from '../pg17-routines/runtime.mjs'
import {
  U,
  P,
  R,
  tables,
  owned,
  send,
  accept,
  release,
  status,
  lookup,
  expire,
} from '../pg17-invitation-transactions/scenarios.mjs'
export { U, P, R, send, accept, release, status, lookup, expire }
export const ledger = ['entitlement_candidate.sources', 'entitlement_candidate.events']
export const apply =
  'SELECT * FROM entitlement_candidate.apply_event($1::text,$2::text,$3::text,$4::text,$5::uuid,$6::text,$7::integer)'
export const eventLookup = 'SELECT * FROM entitlement_candidate.lookup_event($1::text,$2::text)'
export const payload = (
  event = 'e1',
  source = 's1',
  kind = 'grant',
  resource = 'storyteller_seat',
  quantity = 2,
  payer = U.owner
) => ['fixture', event, source, kind, payer, resource, quantity]
export async function result(p) {
  try {
    const r = await p
    return { sqlstate: '00000', rows: r.rows, rowCount: r.rowCount }
  } catch (e) {
    return { sqlstate: /^[A-Z0-9]{5}$/.test(e.code ?? '') ? e.code : 'QUERY_FAILED' }
  }
}
export async function writerClient(h) {
  const c = await h.client('entitlement_writer')
  const id = (
    await c.query(
      'SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user'
    )
  ).rows[0]
  h.eq(
    id,
    {
      current_user: 'entitlement_writer',
      session_user: 'entitlement_writer',
      rolsuper: false,
      rolbypassrls: false,
    },
    'real dedicated low privilege writer'
  )
  if (!h.report.actorConnections.some(x => x.current_user === id.current_user))
    h.report.actorConnections.push(id)
  return c
}
export async function write(h, args = payload(), sql = apply) {
  const c = await writerClient(h)
  try {
    return await result(c.query(sql, args))
  } finally {
    await h.close(c)
  }
}
export async function grant(h, args = payload()) {
  const r = await write(h, args)
  h.eq(r.sqlstate, '00000', 'trusted event succeeds')
  h.eq(r.rows.length, 1, 'one event result')
  return r.rows[0]
}
export async function actor(h, sql, args, user = U.owner) {
  return h.actor('authenticated', user, sql, args)
}
export async function snapshot(db) {
  const s = {}
  for (const t of [...tables, ...owned, ...ledger])
    if ((await db.query('SELECT pg_catalog.to_regclass($1) AS r', [t])).rows[0].r)
      s[t] = (
        await db.query(
          `SELECT pg_catalog.to_jsonb(t) AS row FROM ${t} t ORDER BY pg_catalog.to_jsonb(t)::text`
        )
      ).rows.map(x => x.row)
  return s
}
export const fingerprint = s =>
  Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, { rows: v.length, sha256: digest(JSON.stringify(v)) }])
  )
export async function invariant(h, before, label) {
  const after = await snapshot(h.db)
  h.eq(after, before, label)
  ;(h.report.stateChecks ??= []).push({
    label,
    before: fingerprint(before),
    after: fingerprint(after),
    unchanged: true,
  })
}
export async function reject(h, args, code = '22023', sql = apply) {
  const before = await snapshot(h.db)
  const r = await write(h, args, sql)
  h.eq(r.sqlstate, code, 'event rejection SQLSTATE')
  await invariant(h, before, 'event rejection all related tables unchanged')
}
export async function prepare(h) {
  const prior = JSON.parse(
    await readFile(join(root, 'experiments/pg17-invitation-transactions/input-pins.json'))
  )
  for (const f of [
    'experiments/pg17-routines/runtime.mjs',
    'experiments/pg17-routines/replay.mjs',
    'experiments/pg17-routines/candidate.sql',
    'experiments/pg17-invitation-transactions/fixture.sql',
    'experiments/pg17-invitation-transactions/candidate.sql',
    'experiments/pg17-invitation-transactions/scenarios.mjs',
  ])
    h.eq(
      digest(await readFile(join(root, f))),
      prior.sources[f],
      'reviewed imported source byte pin'
    )
  await h.db.query(
    await readFile(join(root, 'experiments/pg17-invitation-transactions/fixture.sql'), 'utf8')
  )
  await h.db.query(
    "SET saga.invitation_transactions='only_synthetic_local';SET saga.pg17_rehearsal='only_synthetic_local'"
  )
  await h.db.query(
    await readFile(join(root, 'experiments/pg17-invitation-transactions/candidate.sql'), 'utf8')
  )
  await h.db.query(await readFile(join(root, 'experiments/pg17-routines/candidate.sql'), 'utf8'))
  await h.db.query(
    await readFile(join(root, 'experiments/pg17-entitlement-events/fixture.sql'), 'utf8')
  )
}
export async function seed(db) {
  const present = []
  for (const t of [...tables, ...owned, ...ledger])
    if ((await db.query('SELECT pg_catalog.to_regclass($1) AS r', [t])).rows[0].r) present.push(t)
  await db.query('TRUNCATE ' + present.join(','))
  for (const [key, id] of Object.entries(U))
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)', [
      id,
      key + '@example.test',
      '2020-01-01',
    ])
  for (const id of [P.one, P.two])
    await db.query(
      "INSERT INTO public.projects(id,name,facilitator_id,owner_id,updated_at) VALUES($1,'Synthetic history',$2,$2,'2001-01-01')",
      [id, U.owner]
    )
  await db.query(
    "INSERT INTO public.project_roles(user_id,project_id,role,status,invited_by,joined_at,updated_at) VALUES($1,$2,'facilitator','active',$1,'2001-01-01','2001-01-01')",
    [U.owner, P.one]
  )
  await db.query(
    "INSERT INTO public.user_resource_wallets(user_id,project_vouchers,facilitator_seats,storyteller_seats,last_payment_reference,updated_at) VALUES($1,3,4,5,'synthetic-history-reference','2001-01-01')",
    [U.owner]
  )
  await db.query(
    "INSERT INTO public.seat_transactions(user_id,transaction_type,resource_type,amount,project_id,metadata) VALUES($1,'purchase','package',1,$2,'{\"syntheticHistory\":true}')",
    [U.owner, P.one]
  )
  await db.query(
    "INSERT INTO public.export_requests(project_id,user_id,status) VALUES($1,$2,'completed')",
    [P.one, U.owner]
  )
}
export async function originalRed(h) {
  try {
    await h.scenario('old_column_write_bypass_RED', async () => {
      const before = await snapshot(h.db)
      const r = await h.actor(
        'authenticated',
        U.other,
        'UPDATE public.user_resource_wallets SET storyteller_seats=storyteller_seats+1 WHERE user_id=$1',
        [U.owner]
      )
      h.eq(r.sqlstate, '00000', 'old hostile column grant executes')
      h.eq(r.rowCount, 1, 'old caller changed wallet')
      const after = await snapshot(h.db)
      h.eq(
        after['public.user_resource_wallets'][0].storyteller_seats,
        before['public.user_resource_wallets'][0].storyteller_seats + 1,
        'actual unauthorized credit retained'
      )
      h.report.redBypass = {
        expectedSqlstate: '42501',
        actualSqlstate: r.sqlstate,
        stateChanged: true,
        before: fingerprint(before),
        after: fingerprint(after),
      }
      h.eq(r.sqlstate, '42501', 'ordinary caller cannot credit wallet')
    })
  } catch (e) {
    if (e.code !== 'ASSERT_FAILED' || e.label !== 'ordinary caller cannot credit wallet') throw e
    // Continue only this expected ACL RED so the independent missing-interface
    // expectation also executes against the same privately retained state.
  }
  await h.scenario('grant_interface_expected_success_RED', async () => {
    const before = await snapshot(h.db)
    const r = await write(h)
    await invariant(h, before, 'missing interface zero writes')
    h.report.red = { expectedSqlstate: '00000', actualSqlstate: r.sqlstate }
    h.eq(r.sqlstate, '00000', 'event interface grant contract exists')
  })
}
export async function applyCandidate(h) {
  await installation(h)
}
export async function candidates(h) {
  await core(h)
  await tombstoneNoWallet(h)
  await permissions(h)
  await invitations(h)
  await faults(h)
  await defaults(h)
  await provenanceCases(h)
}
export async function core(h) {
  for (const resource of ['storyteller_seat', 'facilitator_seat'])
    await h.scenario('grant_idempotency_immutable_' + resource, async () => {
      await seed(h.db)
      const before = await snapshot(h.db)
      const args = payload('e1', 's1', 'grant', resource)
      const first = await grant(h, args)
      h.eq(first.outcome, 'granted', 'first grant credited')
      const after = await snapshot(h.db)
      h.eq(after[ledger[0]].length, 1, 'one ledger source')
      h.eq(after[ledger[1]].length, 1, 'one event')
      h.eq(after[owned[0]].length, 1, 'one trusted source')
      h.eq(after['public.seat_transactions'].length, 2, 'one history and one credit')
      h.eq(
        after['public.user_resource_wallets'][0][resource.replace('_seat', '_seats')],
        before['public.user_resource_wallets'][0][resource.replace('_seat', '_seats')] + 2,
        'exact credit'
      )
      for (const t of ['public.projects', 'public.project_roles', 'public.export_requests'])
        h.eq(after[t], before[t], 'historical rows preserved')
      h.eq(
        after['public.user_resource_wallets'][0].last_payment_reference,
        'synthetic-history-reference',
        'reference preserved'
      )
      h.eq(await grant(h, args), first, 'identical event result')
      await invariant(h, after, 'same event no writes')
      for (const [i, value] of [
        [2, 'different-source'],
        [3, 'revoke'],
        [4, U.other],
        [5, resource === 'storyteller_seat' ? 'facilitator_seat' : 'storyteller_seat'],
        [6, 3],
      ]) {
        const changed = [...args]
        changed[i] = value
        await reject(h, changed)
      }
      const alias = await grant(h, payload('e2', 's1', 'grant', resource))
      h.eq(alias.source_id, first.source_id, 'distinct event same source')
      h.eq(alias.outcome, 'already_granted', 'no double credit')
      const aliasState = await snapshot(h.db)
      h.eq(
        aliasState['public.user_resource_wallets'],
        after['public.user_resource_wallets'],
        'alias wallet unchanged'
      )
      h.eq(
        aliasState['public.seat_transactions'],
        after['public.seat_transactions'],
        'alias logs unchanged'
      )
      await reject(h, payload('e3', 's1', 'grant', resource, 3))
    })
  await h.scenario('new_wallet_zero_balances_and_unknown_commit_recovery', async () => {
    await seed(h.db)
    const before = await write(h, ['fixture', 'missing'], eventLookup)
    h.eq(before.rows, [], 'pre-read has no event success')
    const c = await writerClient(h)
    await c.query('BEGIN')
    await c.query(apply, payload('new', 'fresh', 'grant', 'facilitator_seat', 3, U.next))
    await c.query('COMMIT')
    await h.close(c)
    const recovered = await write(h, ['fixture', 'new'], eventLookup)
    h.eq(recovered.sqlstate, '00000', 'new connection recover committed event')
    h.eq(recovered.rows[0].outcome, 'granted', 'persistent outcome after discarded response')
    const state = await snapshot(h.db),
      w = state['public.user_resource_wallets'].find(x => x.user_id === U.next)
    h.eq(
      [w.project_vouchers, w.facilitator_seats, w.storyteller_seats, w.last_payment_reference],
      [0, 3, 0, null],
      'fresh wallet no legacy gifts'
    )
    const committed = await snapshot(h.db)
    h.eq(
      (await grant(h, payload('new', 'fresh', 'grant', 'facilitator_seat', 3, U.next))).source_id,
      recovered.rows[0].source_id,
      'retry same source'
    )
    await invariant(h, committed, 'recovery/retry no writes')
  })
  for (const first of ['grant', 'revoke'])
    await h.scenario('irreversible_source_' + first + '_first', async () => {
      await seed(h.db)
      const a = await grant(h, payload('e1', 's1', first))
      const before = await snapshot(h.db)
      const revoke = await grant(h, payload('e2', 's1', 'revoke'))
      h.eq(revoke.revoked, true, 'terminal revoked')
      const terminal = await snapshot(h.db)
      h.eq(
        terminal['public.user_resource_wallets'],
        before['public.user_resource_wallets'],
        'revoke never guesses mirror deduction'
      )
      h.eq(
        (await grant(h, payload('e3', 's1', 'grant'))).outcome,
        'grant_suppressed',
        'later grant suppressed'
      )
      h.eq(
        (await grant(h, payload('e4', 's1', 'revoke'))).outcome,
        'already_revoked',
        'repeat terminal'
      )
      h.eq(
        (await write(h, ['fixture', 'e1'], eventLookup)).rows[0].revoked,
        true,
        'old event lookup current revoked fact'
      )
      const state = await snapshot(h.db)
      h.eq(state[owned[0]].length, 1, 'one terminal source')
      h.eq(
        state['public.seat_transactions'].filter(
          x => x.transaction_type === 'purchase' && x.resource_type === 'storyteller_seat'
        ).length,
        first === 'grant' ? 1 : 0,
        'no post-terminal grant credit'
      )
      h.eq(a.source_id, revoke.source_id, 'stable source')
    })
  for (const column of ['storyteller_seats', 'facilitator_seats', 'project_vouchers'])
    await h.scenario('null_wallet_' + column, async () => {
      await seed(h.db)
      await h.db.query(`UPDATE public.user_resource_wallets SET ${column}=NULL WHERE user_id=$1`, [
        U.owner,
      ])
      await reject(h, payload(), '22023')
    })
  await h.scenario('wallet_overflow', async () => {
    await seed(h.db)
    await h.db.query(
      'UPDATE public.user_resource_wallets SET storyteller_seats=2147483647 WHERE user_id=$1',
      [U.owner]
    )
    await reject(h, payload(), '22003')
  })
  for (const [index, values] of [
    [0, [null, '', ' ', 'a b', 'é', 'a\n', 'a'.repeat(65)]],
    [1, [null, '', 'a\t', 'a'.repeat(129)]],
    [2, [null, '', 'a/'.repeat(70), '中']],
    [3, [null, 'GRANT', 'bad']],
    [4, [null]],
    [5, [null, 'project_voucher']],
    [6, [null, 0, -1]],
  ])
    for (const value of values)
      await h.scenario(
        'invalid_payload_' +
          index +
          '_' +
          String(value).length +
          '_' +
          digest(String(value)).slice(0, 6),
        async () => {
          await seed(h.db)
          const args = payload()
          args[index] = value
          await reject(h, args)
        }
      )
  await h.scenario('identifier_bounds_case_and_max_integer', async () => {
    await seed(h.db)
    const args = [
      'A'.repeat(64),
      'e'.repeat(128),
      's'.repeat(128),
      'grant',
      U.next,
      'storyteller_seat',
      2147483647,
    ]
    await grant(h, args)
    await grant(h, ['a', 'E', 'S', 'revoke', U.other, 'facilitator_seat', 1])
    await grant(h, ['A', 'E', 'S', 'revoke', U.other, 'facilitator_seat', 1])
    h.eq((await snapshot(h.db))[ledger[0]].length, 3, 'case-sensitive provider identity')
  })
  await h.scenario('caller_explicit_rollback', async () => {
    await seed(h.db)
    const before = await snapshot(h.db)
    const c = await writerClient(h)
    try {
      await c.query('BEGIN')
      h.eq((await result(c.query(apply, payload()))).sqlstate, '00000', 'caller grant executes')
      await c.query('ROLLBACK')
    } finally {
      await h.close(c)
    }
    await invariant(h, before, 'caller rollback all tables')
  })
}
export async function tombstoneNoWallet(h) {
  await h.scenario('revoke_first_without_wallet_then_grant', async () => {
    await seed(h.db)
    await grant(h, payload('r', 'absent', 'revoke', 'storyteller_seat', 2, U.next))
    const before = await snapshot(h.db)
    h.eq(
      (await grant(h, payload('g', 'absent', 'grant', 'storyteller_seat', 2, U.next))).outcome,
      'grant_suppressed',
      'wallet absent terminal source still suppresses grant'
    )
    h.eq(
      (await snapshot(h.db))['public.user_resource_wallets'],
      before['public.user_resource_wallets'],
      'suppressed grant creates no wallet'
    )
  })
}
export const unsafe = [
  [
    'public.accept_project_invitation(uuid,uuid)',
    'SELECT public.accept_project_invitation($1::uuid,$2::uuid)',
    [P.one, U.invitee],
  ],
  ['public.cleanup_expired_invitations()', 'SELECT public.cleanup_expired_invitations()', []],
  [
    'public.create_project_with_role(text,text,uuid,text)',
    'SELECT public.create_project_with_role($1,$2,$3::uuid,$4)',
    ['synthetic', 'synthetic', U.owner, 'facilitator'],
  ],
  [
    'public.initialize_user_wallet(uuid)',
    'SELECT public.initialize_user_wallet($1::uuid)',
    [U.owner],
  ],
  [
    'public.process_package_purchase(uuid,text,integer,integer,text)',
    'SELECT public.process_package_purchase($1::uuid,$2::text,$3::integer,$4::integer,$5::text)',
    [U.owner, 'synthetic', 1, 1, 'synthetic'],
  ],
  [
    'public.process_package_purchase(text,text,uuid)',
    'SELECT public.process_package_purchase($1::text,$2::text,$3::uuid)',
    ['synthetic', 'synthetic', U.owner],
  ],
  [
    'public.send_project_invitation(uuid,uuid,text,uuid,text)',
    'SELECT public.send_project_invitation($1::uuid,$2::uuid,$3,$4::uuid,$5)',
    [P.one, U.invitee, 'storyteller', U.owner, 'synthetic'],
  ],
]
export const exports = [
  ['SELECT * FROM public.request_data_export($1::uuid,$2::uuid,true,false)', [U.invitee, P.one]],
  ['SELECT public.request_data_export($1::uuid,$2::uuid,$3::jsonb)', [P.one, U.invitee, '{}']],
]
async function definitions(db) {
  return digest(
    JSON.stringify(
      (
        await db.query(
          "SELECT p.oid::regprocedure::text,pg_catalog.pg_get_functiondef(p.oid) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid"
        )
      ).rows
    )
  )
}
async function catalog(db) {
  return (
    await db.query(
      "SELECT p.oid::regprocedure::text AS identity,p.proacl::text,pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS md5,p.proconfig,pg_catalog.pg_get_userbyid(p.proowner) AS owner FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','entitlement_candidate','invitation_candidate') ORDER BY p.oid"
    )
  ).rows
}
export async function installation(h) {
  const sql = await readFile(
      join(root, 'experiments/pg17-entitlement-events/candidate.sql'),
      'utf8'
    ),
    before = await snapshot(h.db),
    defs = await definitions(h.db),
    beforeCatalog = await catalog(h.db)
  h.eq(before[owned[0]].length, 0, 'initial composition has no adopted source')
  for (const marker of [null, 'wrong'])
    await h.scenario('installer_marker_' + String(marker), async () => {
      await h.db.query(
        marker === null ? 'RESET saga.entitlement_events' : "SET saga.entitlement_events='wrong'"
      )
      const r = await result(h.db.query(sql))
      await h.db.query('ROLLBACK')
      h.eq(r.sqlstate, '42501', 'independent marker required')
      h.eq(await catalog(h.db), beforeCatalog, 'denied install catalog unchanged')
      await invariant(h, before, 'denied install no business writes')
    })
  await h.scenario('installer_wrong_database', async () => {
    const c = await h.client('rehearsal_admin', 'postgres')
    try {
      await c.query("SET saga.entitlement_events='only_synthetic_local'")
      h.eq((await result(c.query(sql))).sqlstate, '42501', 'database and marker both required')
      await c.query('ROLLBACK')
    } finally {
      await h.close(c)
    }
  })
  await h.db.query("SET saga.entitlement_events='only_synthetic_local'")
  await h.scenario('installer_ddl_rollback', async () => {
    h.eq(
      (await result(h.db.query(sql.replace(/COMMIT;\s*$/, 'SELECT 1/0;COMMIT;')))).sqlstate,
      '22012',
      'fault after all candidate DDL'
    )
    await h.db.query('ROLLBACK')
    h.eq(await catalog(h.db), beforeCatalog, 'DDL ACL and function rollback')
    await invariant(h, before, 'DDL tables and writes rollback')
  })
  await h.db.query(sql)
  h.eq(await definitions(h.db), defs, 'all public routine definitions byte preserved')
  await h.scenario('unbacked_source_installation_refuses', async () => {
    const clean = await snapshot(h.db)
    await h.db.query('BEGIN')
    await h.db.query(
      "INSERT INTO invitation_candidate.trusted_seat_sources VALUES('31000000-0000-0000-0000-000000000099',$1,'storyteller_seat',1,1,true,false)",
      [U.owner]
    )
    h.eq(
      (await result(h.db.query(sql))).sqlstate,
      '42501',
      'unbacked source never silently adopted'
    )
    await h.db.query('ROLLBACK')
    await invariant(h, clean, 'unbacked fixture and install fully rolled back')
  })
  await h.scenario('repeat_install_with_committed_business', async () => {
    await grant(h)
    const before = await snapshot(h.db),
      cat = await catalog(h.db)
    await h.db.query(sql)
    h.eq(await catalog(h.db), cat, 'repeat catalog byte hashes and ACLs')
    await invariant(h, before, 'repeat install no event replay')
  })
  h.report.closedRPCs = unsafe.map(x => x[0])
  h.report.publicDefinitionsUnchanged = true
}
export async function permissions(h) {
  await seed(h.db)
  const publicTables = [
    'projects',
    'project_roles',
    'project_members',
    'user_resource_wallets',
    'seat_transactions',
    'invitations',
  ].map(x => 'public.' + x)
  for (const role of [
    'anon',
    'authenticated',
    'service_role',
    'metadata_reader',
    'entitlement_writer',
  ])
    await h.scenario('real_role_acl_' + role, async () => {
      const c =
        role === 'entitlement_writer'
          ? await writerClient(h)
          : await h.actorClient(role, U.owner, 'entitlement_writer')
      try {
        const before = await snapshot(h.db)
        for (const [signature, sql, args] of unsafe)
          h.eq(
            (await result(c.query(sql, args))).sqlstate,
            '42501',
            'unsafe RPC denied ' + signature
          )
        for (const t of [...publicTables, ...owned, ...ledger]) {
          const cols = (
            await h.db.query(
              'SELECT a.attname FROM pg_catalog.pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum',
              [t]
            )
          ).rows
          for (const verb of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
            const sql =
              verb === 'INSERT'
                ? `INSERT INTO ${t} DEFAULT VALUES`
                : verb === 'UPDATE'
                  ? `UPDATE ${t} SET ${cols[0].attname}=NULL WHERE false`
                  : verb === 'DELETE'
                    ? `DELETE FROM ${t} WHERE false`
                    : `TRUNCATE ${t}`
            h.eq((await result(c.query(sql))).sqlstate, '42501', 'direct ' + verb + ' denied ' + t)
          }
          for (const { attname } of cols) {
            h.eq(
              (await result(c.query(`UPDATE ${t} SET ${attname}=NULL WHERE false`))).sqlstate,
              '42501',
              'column update denied ' + t + '.' + attname
            )
            h.eq(
              (await result(c.query(`INSERT INTO ${t}(${attname}) SELECT NULL WHERE false`)))
                .sqlstate,
              '42501',
              'column insert denied ' + t + '.' + attname
            )
          }
        }
        h.eq(
          (await result(c.query('SET ROLE fixture_owner'))).sqlstate,
          '42501',
          'cannot become definer owner'
        )
        h.eq(
          (await result(c.query('SET ROLE rehearsal_admin'))).sqlstate,
          '42501',
          'cannot become installer'
        )
        if (role !== 'entitlement_writer') {
          h.eq(
            (await result(c.query('SET ROLE entitlement_writer'))).sqlstate,
            '42501',
            'cannot become event writer'
          )
          h.eq(
            (await result(c.query(apply, payload('spoof', 'spoof')))).sqlstate,
            '42501',
            'spoofed writer JWT does not authorize event'
          )
          h.eq(
            (await result(c.query(eventLookup, ['fixture', 'e1']))).sqlstate,
            '42501',
            'ordinary event lookup denied'
          )
        } else {
          for (const sql of [
            'SELECT public.get_unread_notification_count(NULL::uuid)',
            'SELECT public.mark_notifications_as_read(NULL::uuid,NULL::uuid[])',
            'SELECT public.create_checkout_session(NULL::text,NULL::uuid,NULL::text)',
          ])
            h.eq(
              (await result(c.query(sql))).sqlstate,
              '42501',
              'writer cannot call unrelated public business RPC'
            )
          await c.query(
            "SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,false),pg_catalog.set_config('request.jwt.claim.role','authenticated',false)",
            [U.owner]
          )
          for (const [sql, args] of [
            [
              send,
              [
                P.one,
                R,
                'invitee@example.test',
                'storyteller',
                '31000000-0000-0000-0000-000000000001',
                null,
              ],
            ],
            ...exports,
          ])
            h.eq(
              (await result(c.query(sql, args))).sqlstate,
              '42501',
              'writer cannot spoof authenticated invitation/export'
            )
        }
        if (role !== 'authenticated')
          for (const [sql, args] of exports)
            h.eq(
              (await result(c.query(sql, args))).sqlstate,
              '42501',
              'export ACL retains authenticated only'
            )
        await invariant(h, before, 'denied ' + role + ' complete snapshots')
      } finally {
        await h.close(c)
      }
    })
  await h.scenario('precise_entitlement_catalog', async () => {
    const cat = (await catalog(h.db)).filter(x => x.identity.startsWith('entitlement_candidate.'))
    h.eq(cat.length, 3, 'two entries and private validator')
    for (const f of cat) {
      h.eq(f.proconfig, ['search_path=""'], 'empty function search path')
      h.eq(f.owner, 'fixture_owner', 'NOLOGIN definer')
      for (const role of [
        'anon',
        'authenticated',
        'service_role',
        'metadata_reader',
        'entitlement_writer',
      ])
        h.eq(
          (
            await h.db.query("SELECT pg_catalog.has_function_privilege($1,$2,'EXECUTE') AS ok", [
              role,
              f.identity,
            ])
          ).rows[0].ok,
          role === 'entitlement_writer' && !f.identity.includes('._'),
          'exact entry ACL'
        )
    }
    h.report.entitlementCatalog = cat
  })
}
export async function invite(
  h,
  source,
  role = 'storyteller',
  project = P.one,
  request = R,
  email = 'invitee@example.test'
) {
  const r = await actor(h, send, [project, request, email, role, source, null])
  h.eq(r.sqlstate, '00000', 'funded invitation send')
  return r.rows[0]
}
async function deniedActor(h, sql, args, user = U.invitee) {
  const before = await snapshot(h.db)
  h.eq((await actor(h, sql, args, user)).sqlstate, '42501', 'revoked authorization denied')
  await invariant(h, before, 'revoked operation writes nothing')
}
export async function invitations(h) {
  for (const role of ['storyteller', 'facilitator'])
    await h.scenario('grant_invite_accept_revoke_exports_' + role, async () => {
      await seed(h.db)
      const g = await grant(h, payload('g', 's', 'grant', role + '_seat'))
      const i = await invite(h, g.source_id, role)
      const reserved = await snapshot(h.db)
      h.eq(
        (await invite(h, g.source_id, role)).invitation_id,
        i.invitation_id,
        'same send request reused'
      )
      await invariant(h, reserved, 'same send no second reserve')
      const alias = await invite(
        h,
        g.source_id,
        role,
        P.one,
        '41000000-0000-0000-0000-000000000002'
      )
      h.eq(alias.invitation_id, i.invitation_id, 'same pending target reused')
      h.eq(
        (await snapshot(h.db))['public.seat_transactions'],
        reserved['public.seat_transactions'],
        'alias target no reserve'
      )
      const a = await actor(h, accept, [i.token], U.invitee)
      h.eq(a.sqlstate, '00000', 'accept funded invite')
      const accepted = await snapshot(h.db)
      h.eq(
        (await actor(h, accept, [i.token], U.invitee)).rows[0].outcome,
        'already_accepted',
        'accept durable retry'
      )
      await invariant(h, accepted, 'accept retry no writes')
      for (const [sql, args] of [
        [status, [i.token]],
        [lookup, [R]],
      ])
        h.eq(
          (await actor(h, sql, args, sql === status ? U.invitee : U.owner)).sqlstate,
          '00000',
          'invitation recovery port available'
        )
      for (const [sql, args] of exports)
        h.eq(
          (await actor(h, sql, args, U.invitee)).sqlstate,
          '00000',
          'legitimate member export before revoke'
        )
      const before = await snapshot(h.db)
      await grant(h, payload('r', 's', 'revoke', role + '_seat'))
      const revoked = await snapshot(h.db)
      h.eq(
        revoked['public.project_roles'].find(x => x.id === a.rows[0].member_id).status,
        'inactive',
        'only mapped member deactivated'
      )
      h.eq(
        revoked['public.project_roles'].find(x => x.user_id === U.owner),
        before['public.project_roles'].find(x => x.user_id === U.owner),
        'unrelated legitimate owner membership preserved'
      )
      for (const t of [
        'public.user_resource_wallets',
        'public.projects',
        'public.export_requests',
        'public.invitations',
        'invitation_candidate.bindings',
        'public.seat_transactions',
      ])
        h.eq(revoked[t], before[t], 'revoke preserves mirror/history ' + t)
      await deniedActor(h, accept, [i.token])
      for (const [sql, args] of exports) await deniedActor(h, sql, args)
      await deniedActor(
        h,
        send,
        [
          P.two,
          '41000000-0000-0000-0000-000000000003',
          'next@example.test',
          role,
          g.source_id,
          null,
        ],
        U.owner
      )
      const independent = await actor(h, exports[0][0], [U.owner, P.one], U.owner)
      h.eq(independent.sqlstate, '00000', 'independent project ownership remains authority')
    })
  for (const reason of ['cancelled', 'expired'])
    await h.scenario('revoked_reserved_release_' + reason, async () => {
      await seed(h.db)
      const g = await grant(h),
        i = await invite(h, g.source_id)
      if (reason === 'expired') await expire(h.db, i.invitation_id)
      await grant(h, payload('r', 's1', 'revoke'))
      await deniedActor(h, accept, [i.token])
      const before = await snapshot(h.db)
      h.eq(
        (await actor(h, release, [i.invitation_id, reason])).sqlstate,
        '00000',
        'revoked reservation can release'
      )
      const after = await snapshot(h.db)
      h.eq(
        after['public.user_resource_wallets'][0].storyteller_seats,
        before['public.user_resource_wallets'][0].storyteller_seats + 1,
        'one mirror refund'
      )
      h.eq(
        after[owned[0]][0].remaining,
        before[owned[0]][0].remaining + 1,
        'one original source refund'
      )
      h.eq(after[owned[0]][0].revoked, true, 'refund never unrevokes')
      h.eq((await actor(h, release, [i.invitation_id, reason])).sqlstate, '00000', 'release retry')
      await invariant(h, after, 'release retry exactly once')
    })
  for (const variant of ['inactive', 'deleted', 'mismatch'])
    await h.scenario('revoke_member_' + variant, async () => {
      await seed(h.db)
      const g = await grant(h),
        i = await invite(h, g.source_id),
        a = await actor(h, accept, [i.token], U.invitee)
      h.eq(a.sqlstate, '00000', 'member fixture accepted')
      const mid = a.rows[0].member_id
      await h.db.query(
        variant === 'deleted'
          ? 'DELETE FROM public.project_roles WHERE id=$1'
          : variant === 'inactive'
            ? "UPDATE public.project_roles SET status='inactive' WHERE id=$1"
            : "UPDATE public.project_roles SET role='facilitator' WHERE id=$1",
        [mid]
      )
      const before = await snapshot(h.db)
      if (variant === 'mismatch') await reject(h, payload('r', 's1', 'revoke'), '42501')
      else {
        await grant(h, payload('r', 's1', 'revoke'))
        h.eq(
          (await snapshot(h.db))['public.project_roles'],
          before['public.project_roles'],
          'never recreates or edits absent/inactive membership'
        )
      }
    })
  await h.scenario('shared_wallet_sources_cannot_overspend', async () => {
    await seed(h.db)
    await h.db.query(
      'UPDATE public.user_resource_wallets SET storyteller_seats=0 WHERE user_id=$1',
      [U.owner]
    )
    const g = await grant(h, payload('g', 's', 'grant', 'storyteller_seat', 1))
    await invite(h, g.source_id)
    await deniedActor(
      h,
      send,
      [
        P.two,
        '41000000-0000-0000-0000-000000000003',
        'next@example.test',
        'storyteller',
        g.source_id,
        null,
      ],
      U.owner
    )
  })
}
export async function faults(h) {
  const cases = [
    ['grant_new_wallet', 'public.user_resource_wallets', 'INSERT', 'grant', true],
    ['grant_source', 'invitation_candidate.trusted_seat_sources', 'INSERT', 'grant'],
    ['grant_ledger', 'entitlement_candidate.sources', 'INSERT', 'grant'],
    ['grant_wallet_credit', 'public.user_resource_wallets', 'UPDATE', 'grant'],
    ['grant_audit', 'public.seat_transactions', 'INSERT', 'grant'],
    ['grant_link', 'entitlement_candidate.sources', 'UPDATE', 'grant'],
    ['grant_event', 'entitlement_candidate.events', 'INSERT', 'grant'],
    ['revoke_source', 'invitation_candidate.trusted_seat_sources', 'UPDATE', 'revoke'],
    ['revoke_member', 'public.project_roles', 'UPDATE', 'revoke'],
    ['revoke_event', 'entitlement_candidate.events', 'INSERT', 'revoke'],
    ['tombstone_source', 'invitation_candidate.trusted_seat_sources', 'INSERT', 'tombstone'],
    ['tombstone_ledger', 'entitlement_candidate.sources', 'INSERT', 'tombstone'],
    ['tombstone_event', 'entitlement_candidate.events', 'INSERT', 'tombstone'],
  ]
  for (const [name, table, op, kind, newWallet] of cases)
    await h.scenario('atomic_fault_' + name, async () => {
      await seed(h.db)
      if (kind === 'revoke') {
        const g = await grant(h),
          i = await invite(h, g.source_id)
        h.eq(
          (await actor(h, accept, [i.token], U.invitee)).sqlstate,
          '00000',
          'consumed source fault setup'
        )
      }
      const before = await snapshot(h.db)
      await h.db.query(
        `CREATE FUNCTION entitlement_candidate._test_fault() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='synthetic injected fault';END $$;REVOKE EXECUTE ON FUNCTION entitlement_candidate._test_fault() FROM PUBLIC;CREATE TRIGGER entitlement_fault BEFORE ${op} ON ${table} FOR EACH ROW EXECUTE FUNCTION entitlement_candidate._test_fault()`
      )
      try {
        await reject(
          h,
          payload(
            kind === 'revoke' ? 'r' : 'e1',
            's1',
            kind === 'grant' ? 'grant' : 'revoke',
            'storyteller_seat',
            2,
            newWallet ? U.next : U.owner
          ),
          'P0001'
        )
        await invariant(h, before, 'fault ' + name + ' rolls back all stages')
      } finally {
        await h.db.query(
          `DROP TRIGGER entitlement_fault ON ${table};DROP FUNCTION entitlement_candidate._test_fault()`
        )
      }
    })
  await h.scenario('revoke_caller_rollback', async () => {
    await seed(h.db)
    const g = await grant(h),
      i = await invite(h, g.source_id)
    await actor(h, accept, [i.token], U.invitee)
    const before = await snapshot(h.db),
      c = await writerClient(h)
    try {
      await c.query('BEGIN')
      h.eq(
        (await result(c.query(apply, payload('r', 's1', 'revoke')))).sqlstate,
        '00000',
        'revoke executes in caller transaction'
      )
      await c.query('ROLLBACK')
    } finally {
      await h.close(c)
    }
    await invariant(h, before, 'caller rollback restores member source event')
  })
}
export async function defaults(h) {
  await h.scenario('new_candidate_function_not_public_by_default', async () => {
    await h.db.query(
      "SET ROLE fixture_owner;CREATE FUNCTION entitlement_candidate._default_probe() RETURNS integer LANGUAGE sql SET search_path='' AS $$SELECT 1$$;RESET ROLE"
    )
    try {
      h.eq(
        (
          await h.db.query(
            "SELECT pg_catalog.has_function_privilege('anon','entitlement_candidate._default_probe()','EXECUTE') AS ok"
          )
        ).rows[0].ok,
        false,
        'new private function has no default PUBLIC execute'
      )
    } finally {
      await h.db.query('DROP FUNCTION entitlement_candidate._default_probe()')
    }
  })
}
export async function provenanceCases(h) {
  await h.scenario('missing_payer_fk_and_lookup_input_validation', async () => {
    await seed(h.db)
    await reject(
      h,
      payload(
        'missing',
        'missing',
        'grant',
        'storyteller_seat',
        2,
        '11000000-0000-0000-0000-000000000099'
      ),
      '23503'
    )
    for (const args of [
      [null, 'e1'],
      ['fixture', null],
      ['fixture', ''],
      ['fixture', ' '.repeat(3)],
    ])
      await reject(h, args, '22023', eventLookup)
  })

  await h.scenario('source_cannot_rebind_payer_or_resource', async () => {
    await seed(h.db)
    await grant(h)
    await reject(h, payload('changed-payer', 's1', 'grant', 'storyteller_seat', 2, U.other))
    await reject(h, payload('changed-resource', 's1', 'grant', 'facilitator_seat'))
    await reject(h, payload('changed-revoke', 's1', 'revoke', 'storyteller_seat', 3))
  })
  await h.scenario('independent_source_membership_preserved', async () => {
    await seed(h.db)
    const one = await grant(h, payload('g1', 's1', 'grant', 'facilitator_seat', 2)),
      two = await grant(h, payload('g2', 's2', 'grant', 'facilitator_seat', 2))
    const i1 = await invite(h, one.source_id, 'facilitator'),
      i2 = await invite(
        h,
        two.source_id,
        'facilitator',
        P.one,
        '41000000-0000-0000-0000-000000000002',
        'other@example.test'
      )
    h.eq((await actor(h, accept, [i1.token], U.invitee)).sqlstate, '00000', 'first source accepted')
    const a2 = await actor(h, accept, [i2.token], U.other)
    h.eq(a2.sqlstate, '00000', 'independent source accepted')
    const before = await snapshot(h.db)
    await grant(h, payload('r1', 's1', 'revoke', 'facilitator_seat', 2))
    const after = await snapshot(h.db)
    h.eq(
      after['public.project_roles'].find(x => x.id === a2.rows[0].member_id),
      before['public.project_roles'].find(x => x.id === a2.rows[0].member_id),
      'independent granted member unchanged'
    )
    h.eq(
      (await actor(h, exports[0][0], [U.other, P.one], U.other)).sqlstate,
      '00000',
      'independent member can still export'
    )
  })
  await h.scenario('revoke_mapping_mismatch_after_prior_member_update_rolls_back', async () => {
    await seed(h.db)
    const g = await grant(h, payload('g', 's', 'grant', 'facilitator_seat', 3))
    for (const [p, r, u, email] of [
      [P.one, R, U.invitee, 'invitee@example.test'],
      [P.two, '41000000-0000-0000-0000-000000000002', U.other, 'other@example.test'],
    ]) {
      const i = await invite(h, g.source_id, 'facilitator', p, r, email)
      h.eq(
        (await actor(h, accept, [i.token], u)).sqlstate,
        '00000',
        'multi project consumed source'
      )
    }
    await h.db.query(
      "UPDATE public.project_roles SET role='storyteller' WHERE project_id=$1 AND user_id=$2",
      [P.two, U.other]
    )
    await reject(h, payload('r', 's', 'revoke', 'facilitator_seat', 3), '42501')
  })
}
