import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, digest, failure } from '../pg17-routines/runtime.mjs'
export const U = {
  owner: '11000000-0000-0000-0000-000000000001',
  invitee: '11000000-0000-0000-0000-000000000002',
  other: '11000000-0000-0000-0000-000000000003',
  next: '11000000-0000-0000-0000-000000000004'
}
export const P = {
  one: '21000000-0000-0000-0000-000000000001',
  two: '21000000-0000-0000-0000-000000000002',
  missing: '21000000-0000-0000-0000-000000000099'
}
export const S = {
  storyteller: '31000000-0000-0000-0000-000000000001',
  facilitator: '31000000-0000-0000-0000-000000000002'
}
export const R = '41000000-0000-0000-0000-000000000001'
export const tables = [
  'auth.users',
  ...[
    'projects',
    'project_roles',
    'user_resource_wallets',
    'seat_transactions',
    'project_members',
    'export_requests',
    'notifications',
    'invitations'
  ].map((x) => 'public.' + x)
]
export const owned = [
  'invitation_candidate.trusted_seat_sources',
  'invitation_candidate.bindings',
  'invitation_candidate.requests'
]
export const send =
  'SELECT * FROM invitation_candidate.send($1::uuid,$2::uuid,$3::text,$4::text,$5::uuid,$6::text)'
export const accept = 'SELECT * FROM invitation_candidate.accept($1::text)'
export const release = 'SELECT * FROM invitation_candidate.release($1::uuid,$2::text)'
export const status = 'SELECT * FROM invitation_candidate.status($1::text)'
export const lookup = 'SELECT * FROM invitation_candidate.lookup($1::uuid)'
export const payload = (overrides = []) =>
  [P.one, R, 'invitee@example.test', 'storyteller', S.storyteller, null].map((x, i) =>
    i in overrides ? overrides[i] : x
  )
export async function snapshot(db) {
  const s = {}
  for (const t of [...tables, ...owned])
    if ((await db.query('SELECT pg_catalog.to_regclass($1) AS r', [t])).rows[0].r)
      s[t] = (
        await db.query(
          `SELECT pg_catalog.to_jsonb(t) AS row FROM ${t} t ORDER BY pg_catalog.to_jsonb(t)::text`
        )
      ).rows.map((x) => x.row)
  return s
}
export const fingerprint = (s) =>
  Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, { rows: v.length, sha256: digest(JSON.stringify(v)) }])
  )
export async function invariant(h, before, label) {
  const after = await snapshot(h.db)
  h.eq(after, before, label)
  h.report.stateChecks ??= []
  h.report.stateChecks.push({
    label,
    before: fingerprint(before),
    after: fingerprint(after),
    unchanged: true
  })
}
export async function seed(db) {
  const candidate = (
    await db.query("SELECT pg_catalog.to_regclass('invitation_candidate.bindings') AS r")
  ).rows[0].r
  await db.query('TRUNCATE ' + [...tables, ...(candidate ? owned : [])].join(','))
  for (const [key, id] of Object.entries(U))
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)', [
      id,
      key + '@example.test',
      '2020-01-01'
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
  for (const id of [U.owner, U.next])
    await db.query(
      "INSERT INTO public.user_resource_wallets(user_id,project_vouchers,facilitator_seats,storyteller_seats,last_payment_reference,updated_at) VALUES($1,3,4,5,'synthetic-history-reference','2001-01-01')",
      [id]
    )
  await db.query(
    "INSERT INTO public.seat_transactions(user_id,transaction_type,resource_type,amount,project_id,metadata) VALUES($1,'purchase','package',1,$2,'{\"syntheticHistory\":true}')",
    [U.owner, P.one]
  )
  await db.query(
    "INSERT INTO public.export_requests(project_id,user_id,status) VALUES($1,$2,'completed')",
    [P.one, U.owner]
  )
  if (candidate)
    for (const [role, id] of Object.entries(S))
      await db.query(
        'INSERT INTO invitation_candidate.trusted_seat_sources(id,payer_id,resource_type,issued,remaining,verified,revoked) VALUES($1,$2,$3,5,5,true,false)',
        [id, U.owner, role + '_seat']
      )
}
export async function originalRed(h) {
  await h.scenario('missing_token_signature_expected_success_RED', async () => {
    const before = await snapshot(h.db),
      r = await h.actor(
        'authenticated',
        U.invitee,
        'SELECT * FROM public.accept_project_invitation($1::text,$2::uuid)',
        ['synthetic-legacy-opaque', U.invitee]
      )
    await invariant(
      h,
      before,
      'missing token overload has zero writes across complete related tables'
    )
    h.report.red = {
      expectedSqlstate: '00000',
      actualSqlstate: r.sqlstate,
      classification: 'missing_token_feature',
      zeroWrites: true
    }
    h.eq(r.sqlstate, '00000', 'token acceptance contract is available')
  })
}
export async function call(h, sql, args, actor = U.owner) {
  return h.actor('authenticated', actor, sql, args)
}
export async function sent(h, args = payload()) {
  const r = await call(h, send, args)
  h.eq(r.sqlstate, '00000', 'send succeeds')
  h.eq(r.rows.length, 1, 'one send row')
  return r.rows[0]
}
export async function rejected(
  h,
  sql,
  args,
  actor = U.invitee,
  code = '42501',
  label = 'rejection'
) {
  const before = await snapshot(h.db),
    r = await call(h, sql, args, actor)
  h.eq(r.sqlstate, code, label + ' SQLSTATE')
  await invariant(h, before, label + ' makes zero writes')
  return r
}
export async function expire(db, id) {
  await db.query("UPDATE public.invitations SET expires_at='2000-01-01' WHERE id=$1", [id])
  await db.query(
    'UPDATE invitation_candidate.bindings b SET expires_at=i.expires_at FROM public.invitations i WHERE b.invitation_id=i.id AND i.id=$1',
    [id]
  )
}
async function positives(h) {
  for (const role of ['facilitator', 'storyteller'])
    await h.scenario('send_accept_repeat_release_recovery_' + role, async () => {
      await seed(h.db)
      const before = await snapshot(h.db),
        args = payload()
      args[3] = role
      args[4] = S[role]
      const s = await sent(h, args)
      h.eq(s.outcome, 'created', 'created outcome')
      h.ok(/^v1_[0-9a-f]{32}$/.test(s.token), 'SQL token canonical')
      const afterSend = await snapshot(h.db)
      await sendDelta(h, before, afterSend, s, role)
      const wallet = afterSend['public.user_resource_wallets'].find((x) => x.user_id === U.owner),
        prior = before['public.user_resource_wallets'].find((x) => x.user_id === U.owner)
      h.eq(wallet[role + '_seats'], prior[role + '_seats'] - 1, 'one wallet reservation')
      h.eq(wallet.project_vouchers, prior.project_vouchers, 'no voucher consumption')
      h.eq(
        wallet.last_payment_reference,
        prior.last_payment_reference,
        'payment reference unchanged'
      )
      h.eq(
        afterSend['invitation_candidate.trusted_seat_sources'].find((x) => x.id === S[role])
          .remaining,
        4,
        'one protected source reservation'
      )
      h.eq(
        (await sent(h, args)).invitation_id,
        s.invitation_id,
        'same request maps original invitation'
      )
      await invariant(h, afterSend, 'same request no writes')
      const r = await call(h, accept, [s.token], U.invitee)
      h.eq(r.sqlstate, '00000', 'accept reserved invitation')
      h.eq(r.rows[0].outcome, 'accepted', 'accepted result')
      const accepted = await snapshot(h.db)
      await acceptDelta(h, afterSend, accepted, s, r.rows[0])
      h.eq(
        accepted['public.user_resource_wallets'],
        afterSend['public.user_resource_wallets'],
        'accept never charges wallet again'
      )
      h.eq(
        accepted['public.seat_transactions'].filter((x) => x.transaction_type === 'activate')
          .length,
        1,
        'one activation log'
      )
      const again = await call(h, accept, [s.token], U.invitee)
      h.eq(again.sqlstate, '00000', 'repeat valid identity')
      h.eq(again.rows[0].outcome, 'already_accepted', 'durable repeat')
      h.eq(again.rows[0].joined_at, r.rows[0].joined_at, 'joined_at unchanged')
      await invariant(h, accepted, 'repeat acceptance read only')
      await rejected(
        h,
        release,
        [s.invitation_id, 'cancelled'],
        U.owner,
        '42501',
        'consumed reservation cannot refund'
      )
      for (const [sql, values, actor] of [
        [status, [s.token], U.invitee],
        [lookup, [args[1]], U.owner]
      ]) {
        const result = await call(h, sql, values, actor)
        h.eq(result.sqlstate, '00000', 'status recovery query')
        h.eq(result.rows[0].member_id, r.rows[0].member_id, 'persistent member mapping')
        await invariant(h, accepted, 'recovery query no writes')
      }
    })
  for (const reason of ['cancelled', 'expired'])
    await h.scenario('release_exact_original_source_once_' + reason, async () => {
      await seed(h.db)
      const before = await snapshot(h.db),
        s = await sent(h)
      if (reason === 'expired') await expire(h.db, s.invitation_id)
      const r = await call(h, release, [s.invitation_id, reason])
      h.eq(r.sqlstate, '00000', 'release succeeds')
      h.eq(
        r.rows[0].status,
        reason === 'expired' ? 'expired' : 'declined',
        'terminal invitation status'
      )
      const after = await snapshot(h.db)
      for (const key of [
        'storyteller_seats',
        'facilitator_seats',
        'project_vouchers',
        'last_payment_reference'
      ])
        h.eq(
          after['public.user_resource_wallets'].find((x) => x.user_id === U.owner)[key],
          before['public.user_resource_wallets'].find((x) => x.user_id === U.owner)[key],
          'original resource restored ' + key
        )
      h.eq(
        (await call(h, release, [s.invitation_id, reason])).rows[0].outcome,
        'already_released',
        'terminal repeat exact reason'
      )
      await invariant(h, after, 'repeat never double refunds')
      await rejected(
        h,
        release,
        [s.invitation_id, reason === 'expired' ? 'cancelled' : 'expired'],
        U.owner,
        '42501',
        'different terminal reason'
      )
      await rejected(h, accept, [s.token], U.invitee, '42501', 'released invitation cannot accept')
    })
}
export async function candidates(h) {
  await positives(h)
  await negatives(h)
  await additionalCases(h)
  await failures(h)
  await boundaries(h)
  await recovery(h)
  await combinedExport(h)
}
async function negatives(h) {
  for (const [name, index, value, code] of [
    ['missing_project', 0, P.missing, '42501'],
    ['missing_request', 1, null, '22023'],
    ['missing_source', 4, null, '22023'],
    ['unknown_source', 4, P.missing, '42501'],
    ['wrong_resource', 4, S.facilitator, '42501'],
    ['empty_email', 2, '', '22023'],
    ['email_non_ascii', 2, '邀请@example.test', '22023'],
    ['email_unicode_casefold', 2, 'K@example.test', '22023'],
    ['email_internal_space', 2, 'a b@example.test', '22023'],
    ['email_control', 2, 'a\u0001@example.test', '22023'],
    ['email_two_at', 2, 'a@@b', '22023'],
    ['email_missing_local', 2, '@b', '22023'],
    ['email_missing_domain', 2, 'a@', '22023'],
    ['email_missing_at', 2, 'ab', '22023'],
    ['invalid_role', 3, 'admin', '22023'],
    ['message_too_long', 5, 'x'.repeat(2001), '22023']
  ])
    await h.scenario('send_deny_' + name, async () => {
      await seed(h.db)
      const a = payload()
      a[index] = value
      await rejected(h, send, a, U.owner, code, name)
    })
  for (const [name, sql, args] of [
    [
      'source_unverified',
      'UPDATE invitation_candidate.trusted_seat_sources SET verified=false WHERE id=$1',
      [S.storyteller]
    ],
    [
      'source_revoked',
      'UPDATE invitation_candidate.trusted_seat_sources SET revoked=true WHERE id=$1',
      [S.storyteller]
    ],
    [
      'source_payer',
      'UPDATE invitation_candidate.trusted_seat_sources SET payer_id=$1 WHERE id=$2',
      [U.next, S.storyteller]
    ],
    [
      'source_empty',
      'UPDATE invitation_candidate.trusted_seat_sources SET remaining=0 WHERE id=$1',
      [S.storyteller]
    ],
    [
      'wallet_empty',
      'UPDATE public.user_resource_wallets SET storyteller_seats=0 WHERE user_id=$1',
      [U.owner]
    ],
    [
      'wallet_null',
      'UPDATE public.user_resource_wallets SET storyteller_seats=NULL WHERE user_id=$1',
      [U.owner]
    ],
    ['wallet_missing', 'DELETE FROM public.user_resource_wallets WHERE user_id=$1', [U.owner]],
    ['project_inactive', "UPDATE public.projects SET status='inactive' WHERE id=$1", [P.one]],
    [
      'project_transferred',
      'UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',
      [U.next, P.one]
    ],
    [
      'storyteller_active',
      "INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','active')",
      [U.other, P.one]
    ],
    [
      'storyteller_pending',
      "INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','pending')",
      [U.other, P.one]
    ]
  ])
    await h.scenario('send_deny_' + name, async () => {
      await seed(h.db)
      await h.db.query(sql, args)
      await rejected(h, send, payload(), U.owner, '42501', name)
    })
  for (const actor of [null, U.other])
    await h.scenario('send_identity_' + (actor ? 'other' : 'absent'), async () => {
      await seed(h.db)
      await rejected(h, send, payload(), actor)
    })
  await h.scenario('normalized_payload_aliases_and_conflicts', async () => {
    await seed(h.db)
    const a = payload()
    a[2] = ' \tINVITEE@EXAMPLE.TEST\r\n'
    a[5] = ''
    const s = await sent(h, a),
      before = await snapshot(h.db)
    const alias = payload()
    alias[1] = '41000000-0000-0000-0000-000000000002'
    h.eq(
      (await sent(h, alias)).invitation_id,
      s.invitation_id,
      'alias maps same pending reservation'
    )
    const after = await snapshot(h.db)
    h.eq(
      { ...after, 'invitation_candidate.requests': before['invitation_candidate.requests'] },
      before,
      'alias adds only request row'
    )
    h.eq(after['invitation_candidate.requests'].length, 2, 'two durable aliases')
    for (const [index, value] of [
      [0, P.two],
      [2, 'other@example.test'],
      [3, 'facilitator'],
      [4, S.facilitator],
      [5, 'changed']
    ]) {
      const changed = payload()
      changed[index] = value
      await rejected(h, send, changed, U.owner, '22023', 'same request changed payload')
    }
    for (const [index, value] of [
      [4, S.facilitator],
      [5, 'changed']
    ]) {
      const changed = [...alias]
      changed[1] = '41000000-0000-0000-0000-000000000003'
      changed[index] = value
      await rejected(h, send, changed, U.owner, '22023', 'pending target changed payload')
    }
    await expire(h.db, s.invitation_id)
    await rejected(h, send, alias, U.owner, '42501', 'expired pending no silent renewal')
    await call(h, release, [s.invitation_id, 'expired'])
    h.eq(
      (await sent(h, payload())).invitation_id,
      s.invitation_id,
      'original request forever maps terminal invitation'
    )
  })
  for (const token of [
    null,
    '',
    'legacy-opaque',
    'v1_0123456789abcdef0123456789abcdef ',
    'V1_0123456789ABCDEF0123456789ABCDEF',
    '%76%31_bad'
  ])
    await h.scenario(
      'accept_invalid_token_' + String(token === null ? 'null' : token.length),
      async () => {
        await seed(h.db)
        await rejected(h, accept, [token], U.invitee, '22023', 'noncanonical token')
      }
    )
  for (const [name, sql, args] of [
    ['email_unconfirmed', 'UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [U.invitee]],
    ['email_changed', "UPDATE auth.users SET email='other@example.test' WHERE id=$1", [U.invitee]],
    [
      'project_transfer',
      'UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',
      [U.next, P.one]
    ],
    ['project_inactive', "UPDATE public.projects SET status='inactive' WHERE id=$1", [P.one]],
    [
      'source_revoke',
      'UPDATE invitation_candidate.trusted_seat_sources SET revoked=true WHERE id=$1',
      [S.storyteller]
    ],
    [
      'source_unverified',
      'UPDATE invitation_candidate.trusted_seat_sources SET verified=false WHERE id=$1',
      [S.storyteller]
    ],
    [
      'source_payer',
      'UPDATE invitation_candidate.trusted_seat_sources SET payer_id=$1 WHERE id=$2',
      [U.next, S.storyteller]
    ],
    [
      'source_resource',
      "UPDATE invitation_candidate.trusted_seat_sources SET resource_type='facilitator_seat' WHERE id=$1",
      [S.storyteller]
    ],
    [
      'member_pending',
      "INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','pending')",
      [U.invitee, P.one]
    ],
    [
      'member_active',
      "INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','active')",
      [U.invitee, P.one]
    ],
    [
      'member_inactive',
      "INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','inactive')",
      [U.invitee, P.one]
    ]
  ])
    await h.scenario('accept_deny_' + name, async () => {
      await seed(h.db)
      const s = await sent(h)
      await h.db.query(sql, args)
      await rejected(h, accept, [s.token], U.invitee, '42501', name)
    })
  for (const [field, value] of [
    ['project_id', P.two],
    ['inviter_id', U.next],
    ['invitee_email', 'other@example.test'],
    ['role', 'facilitator'],
    ['token', 'v1_11111111111111111111111111111111'],
    ['expires_at', '2000-01-01'],
    ['message', 'changed'],
    ['status', 'accepted'],
    ['accepted_at', '2000-01-01']
  ])
    await h.scenario('invitation_field_corruption_' + field, async () => {
      await seed(h.db)
      const s = await sent(h)
      await h.db.query(`UPDATE public.invitations SET ${field}=$1 WHERE id=$2`, [
        value,
        s.invitation_id
      ])
      await rejected(
        h,
        accept,
        [s.token],
        U.invitee,
        '42501',
        'immutable/state field mismatch ' + field
      )
      await rejected(
        h,
        release,
        [s.invitation_id, 'cancelled'],
        U.owner,
        '42501',
        'corrupt invitation cannot refund'
      )
    })
  for (const [field, value] of [
    ['payer_id', U.next],
    ['source_id', S.facilitator],
    ['invitee_email', 'other@example.test'],
    ['message', 'changed']
  ])
    await h.scenario('binding_field_corruption_' + field, async () => {
      await seed(h.db)
      const s = await sent(h)
      await h.db.query(
        `UPDATE invitation_candidate.bindings SET ${field}=$1 WHERE invitation_id=$2`,
        [value, s.invitation_id]
      )
      await rejected(h, accept, [s.token], U.invitee, '42501', 'binding mismatch')
    })
  await h.scenario('reserve_log_typed_mismatch', async () => {
    await seed(h.db)
    const s = await sent(h)
    await h.db.query(
      "UPDATE public.seat_transactions SET amount=0 WHERE transaction_type='reserve'"
    )
    await rejected(h, accept, [s.token], U.invitee)
    await rejected(h, release, [s.invitation_id, 'cancelled'], U.owner)
  })
  await h.scenario('legacy_invitation_without_binding_never_adopted', async () => {
    await seed(h.db)
    const token = 'v1_0123456789abcdef0123456789abcdef'
    const i = (
      await h.db.query(
        "INSERT INTO public.invitations(project_id,inviter_id,invitee_email,role,token,expires_at) VALUES($1,$2,'invitee@example.test','storyteller',$3,now()+interval '1 day') RETURNING id",
        [P.one, U.owner, token]
      )
    ).rows[0].id
    await rejected(h, accept, [token], U.invitee)
    await rejected(h, release, [i, 'cancelled'], U.owner)
  })
  for (const mutation of [
    "status='inactive'",
    "role='facilitator'",
    `user_id='${U.other}'`,
    `project_id='${P.two}'`,
    'DELETE'
  ])
    await h.scenario('repeat_accept_never_restores_' + mutation.split('=')[0], async () => {
      await seed(h.db)
      const s = await sent(h),
        a = await call(h, accept, [s.token], U.invitee)
      h.eq(a.sqlstate, '00000', 'initial accept')
      await h.db.query(
        mutation === 'DELETE'
          ? 'DELETE FROM public.project_roles WHERE id=$1'
          : `UPDATE public.project_roles SET ${mutation} WHERE id=$1`,
        [a.rows[0].member_id]
      )
      await rejected(h, accept, [s.token], U.invitee)
      await rejected(h, status, [s.token], U.invitee)
    })
  await h.scenario('transfer_inactive_cleanup_refunds_original_revoked_source', async () => {
    await seed(h.db)
    const s = await sent(h)
    await h.db.query("UPDATE public.projects SET facilitator_id=$1,status='inactive' WHERE id=$2", [
      U.next,
      P.one
    ])
    await h.db.query(
      'UPDATE invitation_candidate.trusted_seat_sources SET revoked=true WHERE id=$1',
      [S.storyteller]
    )
    await rejected(h, release, [s.invitation_id, 'cancelled'], U.owner)
    const nextBefore = (await snapshot(h.db))['public.user_resource_wallets'].find(
      (x) => x.user_id === U.next
    )
    h.eq(
      (await call(h, release, [s.invitation_id, 'cancelled'], U.next)).sqlstate,
      '00000',
      'new facilitator can clean inactive project'
    )
    const after = await snapshot(h.db)
    h.eq(
      after['public.user_resource_wallets'].find((x) => x.user_id === U.next),
      nextBefore,
      'new facilitator never receives refund'
    )
    h.eq(
      after['invitation_candidate.trusted_seat_sources'].find((x) => x.id === S.storyteller)
        .revoked,
      true,
      'revoked status preserved'
    )
  })
  await h.scenario('expiration_requires_release_and_new_request', async () => {
    await seed(h.db)
    const s = await sent(h)
    await rejected(h, release, [s.invitation_id, 'expired'], U.owner)
    await expire(h.db, s.invitation_id)
    await rejected(h, accept, [s.token], U.invitee)
    const st = await call(h, status, [s.token], U.invitee)
    h.eq(st.sqlstate, '00000', 'pending expiration query')
    h.eq(st.rows[0].is_expired, true, 'expired fact does not imply refund')
    h.eq(st.rows[0].status, 'pending', 'still reserved pending')
    await call(h, release, [s.invitation_id, 'expired'])
    const a = payload()
    a[1] = '41000000-0000-0000-0000-000000000002'
    h.ok(
      (await sent(h, a)).invitation_id !== s.invitation_id,
      'new request after release creates new invitation'
    )
  })
}
async function failures(h) {
  const targets = {
    send: [
      'public.invitations',
      'public.user_resource_wallets',
      'public.seat_transactions',
      ...owned
    ],
    accept: [
      'public.invitations',
      'public.project_roles',
      'public.seat_transactions',
      'invitation_candidate.bindings'
    ],
    release: [
      'public.invitations',
      'public.user_resource_wallets',
      'public.seat_transactions',
      'invitation_candidate.trusted_seat_sources',
      'invitation_candidate.bindings'
    ]
  }
  for (const [op, list] of Object.entries(targets))
    for (const table of list)
      await h.scenario(op + '_actual_check_failure_' + table, async () => {
        await seed(h.db)
        const s = op === 'send' ? null : await sent(h)
        await h.db.query(
          `ALTER TABLE ${table} ADD CONSTRAINT invitation_injected_failure CHECK(false) NOT VALID`
        )
        try {
          await rejected(
            h,
            { send, accept, release }[op],
            op === 'send'
              ? payload()
              : op === 'accept'
                ? [s.token]
                : [s.invitation_id, 'cancelled'],
            op === 'accept' ? U.invitee : U.owner,
            '23514',
            'actual ' + table + ' check failure'
          )
        } finally {
          await h.db.query(`ALTER TABLE ${table} DROP CONSTRAINT invitation_injected_failure`)
        }
      })
  for (const op of ['send', 'accept', 'release'])
    await h.scenario(op + '_caller_transaction_rollback', async () => {
      await seed(h.db)
      const s = op === 'send' ? null : await sent(h),
        before = await snapshot(h.db)
      const r = await h.actor(
        'authenticated',
        op === 'accept' ? U.invitee : U.owner,
        { send, accept, release }[op],
        op === 'send' ? payload() : op === 'accept' ? [s.token] : [s.invitation_id, 'cancelled'],
        'authenticated',
        true
      )
      h.eq(r.sqlstate, '00000', 'operation works inside caller transaction')
      await invariant(h, before, 'caller rollback undoes all ' + op + ' writes')
    })
}
async function boundaries(h) {
  for (const role of ['anon', 'metadata_reader', 'service_role'])
    await h.scenario('execute_acl_' + role, async () => {
      await seed(h.db)
      const before = await snapshot(h.db)
      for (const [sql, args] of [
        [send, payload()],
        [accept, ['v1_0123456789abcdef0123456789abcdef']],
        [release, [P.one, 'cancelled']],
        [status, ['v1_0123456789abcdef0123456789abcdef']],
        [lookup, [R]]
      ]) {
        h.eq(
          (await h.actor(role, U.owner, sql, args)).sqlstate,
          '42501',
          'only authenticated can call candidate RPC'
        )
        await invariant(h, before, 'RPC ACL denies without writes')
      }
    })
  for (const role of ['authenticated', 'anon', 'metadata_reader', 'service_role'])
    await h.scenario('private_tables_' + role, async () => {
      await seed(h.db)
      const before = await snapshot(h.db)
      for (const table of [...owned, 'auth.users'])
        for (const sql of [`SELECT * FROM ${table}`, `DELETE FROM ${table}`]) {
          h.eq(
            (await h.actor(role, U.owner, sql)).sqlstate,
            '42501',
            'protected source identity and binding table ACL'
          )
          await invariant(h, before, 'private relation denial no writes')
        }
      h.eq(
        (await h.actor(role, U.owner, 'SET ROLE fixture_owner')).sqlstate,
        '42501',
        'private owner cannot be assumed'
      )
      await invariant(h, before, 'owner escalation denial no writes')
    })
  await h.scenario('fixed_search_path', async () => {
    await seed(h.db)
    const c = await h.actorClient('authenticated', U.owner)
    try {
      await c.query(
        'CREATE TEMP TABLE projects(id uuid);CREATE TEMP TABLE bindings(id uuid);SET search_path=pg_temp'
      )
      h.eq(
        (await c.query(send, payload())).rows.length,
        1,
        'caller temp tables cannot shadow qualified objects'
      )
    } finally {
      await h.close(c)
    }
  })
}
async function recovery(h) {
  await h.scenario('unregistered_recipient_later_confirmed', async () => {
    await seed(h.db)
    await h.db.query('DELETE FROM auth.users WHERE id=$1', [U.invitee])
    const s = await sent(h)
    h.eq(
      (await h.db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,
      3,
      'send never creates identity'
    )
    await rejected(h, accept, [s.token], U.invitee)
    await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [
      U.invitee,
      'invitee@example.test'
    ])
    await rejected(h, accept, [s.token], U.invitee)
    await h.db.query('UPDATE auth.users SET email_confirmed_at=clock_timestamp() WHERE id=$1', [
      U.invitee
    ])
    h.eq(
      (await call(h, accept, [s.token], U.invitee)).sqlstate,
      '00000',
      'registered confirmed identity accepts'
    )
  })
  await h.scenario('real_commits_discarded_then_durable_read_only_recovery', async () => {
    await seed(h.db)
    const c = await h.actorClient('authenticated', U.owner)
    try {
      await c.query('BEGIN')
      await c.query(send, payload())
      await c.query('COMMIT')
    } finally {
      await h.close(c)
    } // Deliberately discard RPC response, including the token and ID.
    const committed = await snapshot(h.db),
      found = await call(h, lookup, [R])
    h.eq(found.sqlstate, '00000', 'lookup recovers committed send without returned token')
    await invariant(h, committed, 'send recovery lookup is read only')
    const token = found.rows[0].token,
      id = found.rows[0].invitation_id,
      d = await h.actorClient('authenticated', U.invitee)
    try {
      await d.query('BEGIN')
      await d.query(accept, [token])
      await d.query('COMMIT')
    } finally {
      await h.close(d)
    } // Real commit, result deliberately discarded.
    const accepted = await snapshot(h.db),
      recovered = await call(h, status, [token], U.invitee)
    h.eq(recovered.sqlstate, '00000', 'status recovers committed acceptance')
    h.eq(recovered.rows[0].invitation_id, id, 'same original durable invitation')
    h.eq(recovered.rows[0].status, 'accepted', 'acceptance persisted')
    await invariant(h, accepted, 'accept recovery status is read only')
    h.report.unknownCommitRecovery = {
      send: { committed: true, responseDiscarded: true, recoveredBy: 'lookup' },
      accept: { committed: true, responseDiscarded: true, recoveredBy: 'status' },
      readOnlyRecovery: true
    }
  })
}
async function combinedExport(h) {
  await h.db.query("SET saga.pg17_rehearsal='only_synthetic_local'")
  await h.db.query(await readFile(join(root, 'experiments/pg17-routines/candidate.sql'), 'utf8'))
  for (const kind of ['table', 'uuid'])
    await h.scenario('prior_export_composition_' + kind, async () => {
      await seed(h.db)
      const s = await sent(h),
        sql =
          kind === 'table'
            ? 'SELECT * FROM public.request_data_export($1::uuid,$2::uuid,true,false)'
            : 'SELECT public.request_data_export($2::uuid,$1::uuid,$3::jsonb) AS export_id',
        args = kind === 'table' ? [U.invitee, P.one] : [U.invitee, P.one, {}]
      await rejected(h, accept, [s.token], U.other)
      await rejected(h, sql, args, U.invitee)
      const accepted = await call(h, accept, [s.token], U.invitee)
      h.eq(accepted.sqlstate, '00000', 'legal acceptance')
      h.eq(
        (await call(h, sql, args, U.invitee)).sqlstate,
        '00000',
        'legal accepted member registers export'
      )
      await h.db.query("UPDATE public.project_roles SET status='inactive' WHERE id=$1", [
        accepted.rows[0].member_id
      ])
      await rejected(h, sql, args, U.invitee)
      await rejected(h, accept, [s.token], U.invitee)
    })
}
const publicDefinitions = async (db) =>
  digest(
    JSON.stringify(
      (
        await db.query(
          "SELECT p.oid::regprocedure::text,pg_catalog.pg_get_functiondef(p.oid),p.proacl::text FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid"
        )
      ).rows
    )
  )
export async function applyCandidate(h) {
  const sql = await readFile(
      join(root, 'experiments/pg17-invitation-transactions/candidate.sql'),
      'utf8'
    ),
    original = await publicDefinitions(h.db),
    before = await snapshot(h.db)
  for (const name of ['missing', 'wrong'])
    await h.scenario('candidate_marker_' + name, async () => {
      await h.db.query(
        name === 'wrong'
          ? "SET saga.invitation_transactions='wrong'"
          : 'RESET saga.invitation_transactions'
      )
      let code
      try {
        await h.db.query(sql)
      } catch (e) {
        code = e.code
      } finally {
        await h.db.query('ROLLBACK')
      }
      h.eq(code, '42501', 'independent local marker')
      h.eq(
        (await h.db.query("SELECT pg_catalog.to_regnamespace('invitation_candidate') AS n")).rows[0]
          .n,
        null,
        'candidate schema not created'
      )
      await invariant(h, before, 'denied DDL no writes')
    })
  await h.scenario('candidate_wrong_database_gate', async () => {
    const c = await h.client('rehearsal_admin', 'postgres')
    try {
      await c.query("SET saga.invitation_transactions='only_synthetic_local'")
      let code
      try {
        await c.query(sql)
      } catch (e) {
        code = e.code
      } finally {
        await c.query('ROLLBACK')
      }
      h.eq(code, '42501', 'database-name gate independent of correct marker')
      await invariant(h, before, 'wrong database application leaves main fixture unchanged')
    } finally {
      await h.close(c)
    }
  })
  await h.db.query("SET saga.invitation_transactions='only_synthetic_local'")
  await h.scenario('candidate_ddl_failure_rollback', async () => {
    let code
    try {
      await h.db.query(sql.replace(/COMMIT;\s*$/, 'SELECT 1/0;COMMIT;'))
    } catch (e) {
      code = e.code
      h.report.ddlFailurePosition = e.position
      h.report.ddlInternalPosition = e.internalPosition
    } finally {
      await h.db.query('ROLLBACK')
    }
    h.report.ddlInjectedActualSqlstate = code
    h.eq(code, '22012', 'real failure after complete DDL')
    h.eq(
      (await h.db.query("SELECT pg_catalog.to_regnamespace('invitation_candidate') AS n")).rows[0]
        .n,
      null,
      'all new DDL rolled back'
    )
    h.eq(await publicDefinitions(h.db), original, 'original definitions unchanged')
    await invariant(h, before, 'DDL failure has zero business writes')
  })
  await h.db.query(sql)
  h.eq(await publicDefinitions(h.db), original, 'every original public RPC unchanged')
  await seed(h.db)
  await h.scenario('repeat_apply_preserves_catalog_and_all_business_rows', async () => {
    await sent(h)
    const before = await snapshot(h.db),
      catalog = await candidateCatalog(h.db)
    await h.db.query(sql)
    h.eq(await candidateCatalog(h.db), catalog, 'repeat same candidate definitions')
    await invariant(h, before, 'repeat DDL has no business replay')
  })
  await h.scenario('candidate_exact_acl_and_private_owner', async () => {
    const catalog = await candidateCatalog(h.db)
    h.eq(catalog.length, 9, 'five public operations and four private helpers')
    for (const f of catalog) {
      h.eq(f.owner, 'fixture_owner', 'NOLOGIN owner')
      h.eq(f.proconfig, ['search_path=""'], 'empty search_path')
      for (const role of ['anon', 'authenticated', 'service_role', 'metadata_reader'])
        h.eq(
          (
            await h.db.query("SELECT pg_catalog.has_function_privilege($1,$2,'EXECUTE') AS ok", [
              role,
              f.identity
            ])
          ).rows[0].ok,
          role === 'authenticated' && !f.name.startsWith('_'),
          'precise function privilege'
        )
    }
    h.report.candidateCatalog = catalog
  })
  await invitationMetadata(h)
}
async function candidateCatalog(db) {
  return (
    await db.query(
      "SELECT p.oid::regprocedure::text AS identity,p.proname AS name,pg_catalog.pg_get_function_result(p.oid) AS result,p.proconfig,p.prosecdef,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definitionMd5 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='invitation_candidate' ORDER BY p.proname"
    )
  ).rows
}
async function invitationMetadata(h) {
  await h.scenario('pinned_invitations_metadata_actual_catalog', async () => {
    const expected = JSON.parse(
      await readFile(
        join(root, 'experiments/pg17-invitation-transactions/invitation-metadata.json')
      )
    )
    const snapshot = JSON.parse(
      await readFile(
        join(
          root,
          'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json'
        )
      )
    ).sections
    for (const k of ['tables', 'columns', 'constraints', 'indexes', 'triggers'])
      h.eq(
        expected[k],
        snapshot[k].rows.filter((x) => (x.table_name ?? x.tablename) === 'invitations'),
        'exact pinned invitation metadata subset ' + k
      )
    await h.db.query('SET search_path=pg_catalog,public')
    const cols = (
      await h.db.query(
        "SELECT a.attname AS column_name,a.attnum::int AS ordinal_position,pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS not_null,pg_catalog.pg_get_expr(ad.adbin,ad.adrelid) AS default_expression FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum WHERE a.attrelid='public.invitations'::regclass AND a.attnum>0 ORDER BY a.attnum"
      )
    ).rows
    h.eq(
      cols,
      expected.columns.map(
        ({ column_name, ordinal_position, data_type, not_null, default_expression }) => ({
          column_name,
          ordinal_position,
          data_type,
          not_null,
          default_expression
        })
      ),
      'twelve actual columns'
    )
    const cons = (
      await h.db.query(
        "SELECT conname AS constraint_name,pg_catalog.pg_get_constraintdef(oid) AS definition FROM pg_catalog.pg_constraint WHERE conrelid='public.invitations'::regclass ORDER BY conname"
      )
    ).rows
    h.eq(
      cons,
      expected.constraints.map(({ constraint_name, definition }) => ({
        constraint_name,
        definition
      })),
      'six actual constraints'
    )
    h.eq(
      (
        await h.db.query(
          "SELECT * FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename='invitations' ORDER BY indexname"
        )
      ).rows.map(({ schemaname, tablename, indexname, indexdef }) => ({
        schemaname,
        tablename,
        indexname,
        indexdef
      })),
      expected.indexes,
      'nine actual indexes'
    )
    h.eq(
      (
        await h.db.query(
          "SELECT pg_catalog.md5(pg_catalog.pg_get_triggerdef(oid)) AS md5 FROM pg_catalog.pg_trigger WHERE tgrelid='public.invitations'::regclass AND NOT tgisinternal"
        )
      ).rows,
      [{ md5: expected.triggers[0].definition_hash_md5 }],
      'actual original updated_at trigger binding'
    )
    h.report.invitationMetadata = {
      columns: 12,
      constraints: 6,
      indexes: 9,
      triggerMatched: true,
      authExtension: 'synthetic email and email_confirmed_at; not JWT verification'
    }
  })
}
async function additionalCases(h) {
  for (const actor of [null, U.other])
    await h.scenario('recipient_and_sender_identity_' + (actor ? 'other' : 'missing'), async () => {
      await seed(h.db)
      const s = await sent(h)
      for (const [sql, args] of [
        [accept, [s.token]],
        [status, [s.token]],
        [lookup, [R]]
      ])
        await rejected(h, sql, args, actor)
    })
  await h.scenario('canonical_but_unknown_token_no_legacy_guess', async () => {
    await seed(h.db)
    for (const sql of [accept, status])
      await rejected(h, sql, ['v1_22222222222222222222222222222222'], U.invitee)
  })
  for (const reason of [null, '', 'invalid'])
    await h.scenario('release_invalid_reason_' + String(reason), async () => {
      await seed(h.db)
      const s = await sent(h)
      await rejected(h, release, [s.invitation_id, reason], U.owner, '22023')
    })
  await h.scenario('accepted_expiration_does_not_remove_member', async () => {
    await seed(h.db)
    const s = await sent(h)
    const first = await call(h, accept, [s.token], U.invitee)
    h.eq(first.sqlstate, '00000', 'original accept succeeds')
    await expire(h.db, s.invitation_id)
    const before = await snapshot(h.db),
      r = await call(h, accept, [s.token], U.invitee)
    h.eq(r.sqlstate, '00000', 'already accepted expiry is historical')
    h.eq(r.rows[0].joined_at, first.rows[0].joined_at, 'join time retained')
    const st = await call(h, status, [s.token], U.invitee)
    h.eq(st.rows[0].is_expired, true, 'expiry fact still reported')
    h.eq(st.rows[0].status, 'accepted', 'consumed binding remains accepted')
    await invariant(h, before, 'accepted expiration never revokes or rewrites member')
  })
  await h.scenario('lookup_current_facilitator_and_original_sender_required', async () => {
    await seed(h.db)
    const s = await sent(h)
    await h.db.query('UPDATE public.projects SET facilitator_id=$1 WHERE id=$2', [U.next, P.one])
    await rejected(h, lookup, [R], U.owner)
    await rejected(h, lookup, [R], U.next)
    await rejected(h, status, [s.token], U.invitee)
  })
  await h.scenario('different_target_storyteller_reservation_conflict', async () => {
    await seed(h.db)
    await sent(h)
    const a = payload()
    a[1] = '41000000-0000-0000-0000-000000000002'
    a[2] = 'other@example.test'
    await rejected(h, send, a, U.owner)
  })
  await h.scenario('new_facilitator_repeat_release_same_reason', async () => {
    await seed(h.db)
    const s = await sent(h)
    await call(h, release, [s.invitation_id, 'cancelled'])
    await h.db.query('UPDATE public.projects SET facilitator_id=$1 WHERE id=$2', [U.next, P.one])
    const before = await snapshot(h.db)
    const r = await call(h, release, [s.invitation_id, 'cancelled'], U.next)
    h.eq(r.sqlstate, '00000', 'current facilitator terminal cleanup repeat')
    h.eq(r.rows[0].outcome, 'already_released', 'no second refund')
    await invariant(h, before, 'new facilitator repeat retains original refund')
  })
  for (const field of [
    'reserve_transaction_id',
    'activation_transaction_id',
    'release_transaction_id'
  ])
    await h.scenario('typed_log_corruption_' + field, async () => {
      await seed(h.db)
      const s = await sent(h)
      if (field === 'activation_transaction_id') await call(h, accept, [s.token], U.invitee)
      if (field === 'release_transaction_id') await call(h, release, [s.invitation_id, 'cancelled'])
      await h.db.query(
        `UPDATE public.seat_transactions SET amount=9 WHERE id=(SELECT ${field} FROM invitation_candidate.bindings WHERE invitation_id=$1)`,
        [s.invitation_id]
      )
      await rejected(h, status, [s.token], U.invitee)
      await rejected(h, lookup, [R], U.owner)
    })
  await h.scenario('corrupt_request_payload_cannot_recover', async () => {
    await seed(h.db)
    await sent(h)
    await h.db.query("UPDATE invitation_candidate.requests SET message='corrupt'")
    await rejected(h, lookup, [R], U.owner)
    await rejected(h, send, payload(), U.owner, '22023')
  })
  await h.scenario('refund_null_wallet_atomic', async () => {
    await seed(h.db)
    const s = await sent(h)
    await h.db.query(
      'UPDATE public.user_resource_wallets SET storyteller_seats=NULL WHERE user_id=$1',
      [U.owner]
    )
    await rejected(h, release, [s.invitation_id, 'cancelled'], U.owner)
  })
}
function existingRows(after, before, key = 'id') {
  return after.filter((x) => before.some((y) => x[key] === y[key]))
}
async function sendDelta(h, before, after, s, role) {
  const b = after['invitation_candidate.bindings'].find((x) => x.invitation_id === s.invitation_id),
    i = after['public.invitations'].find((x) => x.id === s.invitation_id),
    r = after['invitation_candidate.requests'].find((x) => x.invitation_id === s.invitation_id)
  h.eq(
    {
      project: i.project_id,
      payer: i.inviter_id,
      email: i.invitee_email,
      role: i.role,
      status: i.status,
      token: i.token,
      expires: new Date(i.expires_at).toISOString(),
      message: i.message
    },
    {
      project: P.one,
      payer: U.owner,
      email: 'invitee@example.test',
      role,
      status: 'pending',
      token: s.token,
      expires: s.expires_at.toISOString(),
      message: null
    },
    'send persisted exact invitation payload'
  )
  h.eq(
    {
      id: b.invitation_id,
      payer: b.payer_id,
      project: b.project_id,
      source: b.source_id,
      state: b.state,
      quantity: b.quantity,
      token: b.token
    },
    {
      id: s.invitation_id,
      payer: U.owner,
      project: P.one,
      source: S[role],
      state: 'reserved',
      quantity: 1,
      token: s.token
    },
    'typed reservation facts match result'
  )
  h.eq(
    { actor: r.actor_id, key: r.request_id, source: r.source_id },
    { actor: U.owner, key: R, source: S[role] },
    'durable original request payload'
  )
  const log = after['public.seat_transactions'].find((x) => x.id === b.reserve_transaction_id)
  h.eq(
    {
      user: log.user_id,
      project: log.project_id,
      resource: log.resource_type,
      type: log.transaction_type,
      amount: log.amount
    },
    { user: U.owner, project: P.one, resource: role + '_seat', type: 'reserve', amount: -1 },
    'exact typed reserve log association'
  )
  const restored = { ...after }
  for (const t of ['public.invitations', 'public.seat_transactions'])
    restored[t] = existingRows(after[t], before[t])
  for (const t of owned)
    restored[t] = t.endsWith('trusted_seat_sources')
      ? after[t].map((x) => (x.id === S[role] ? { ...x, remaining: x.remaining + 1 } : x))
      : before[t]
  restored['public.user_resource_wallets'] = after['public.user_resource_wallets'].map((x) =>
    x.user_id === U.owner
      ? {
          ...x,
          [role + '_seats']: x[role + '_seats'] + 1,
          updated_at: before['public.user_resource_wallets'].find((y) => y.user_id === x.user_id)
            .updated_at
        }
      : x
  )
  h.eq(restored, before, 'send retains every historical field and unrelated table')
}
async function acceptDelta(h, before, after, s, r) {
  const i = after['public.invitations'].find((x) => x.id === s.invitation_id),
    b = after['invitation_candidate.bindings'].find((x) => x.invitation_id === s.invitation_id),
    m = after['public.project_roles'].find((x) => x.id === r.member_id)
  h.eq(
    {
      id: b.member_id,
      user: b.accepted_user_id,
      joined: new Date(b.joined_at).toISOString(),
      state: b.state
    },
    { id: r.member_id, user: U.invitee, joined: r.joined_at.toISOString(), state: 'consumed' },
    'member mapping persisted'
  )
  h.eq(
    {
      project: m.project_id,
      user: m.user_id,
      role: m.role,
      status: m.status,
      inviter: m.invited_by,
      joined: new Date(m.joined_at).toISOString()
    },
    {
      project: P.one,
      user: U.invitee,
      role: r.role,
      status: 'active',
      inviter: U.owner,
      joined: r.joined_at.toISOString()
    },
    'exact new active member'
  )
  const restored = {
    ...after,
    'public.project_roles': existingRows(
      after['public.project_roles'],
      before['public.project_roles']
    ),
    'public.seat_transactions': existingRows(
      after['public.seat_transactions'],
      before['public.seat_transactions']
    )
  }
  restored['public.invitations'] = after['public.invitations'].map((x) =>
    x.id === s.invitation_id
      ? {
          ...x,
          status: 'pending',
          accepted_at: null,
          updated_at: before['public.invitations'].find((y) => y.id === x.id).updated_at
        }
      : x
  )
  restored['invitation_candidate.bindings'] = after['invitation_candidate.bindings'].map((x) =>
    x.invitation_id === s.invitation_id
      ? {
          ...x,
          state: 'reserved',
          accepted_user_id: null,
          member_id: null,
          joined_at: null,
          activation_transaction_id: null
        }
      : x
  )
  h.eq(
    restored,
    before,
    'accept changes only invitation transition mapped member binding and activation log'
  )
}
