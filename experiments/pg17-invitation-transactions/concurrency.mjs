import {
  seed,
  snapshot,
  invariant,
  fingerprint,
  U,
  P,
  S,
  R,
  payload,
  send,
  accept,
  release,
  status,
  sent,
  call,
  expire
} from './scenarios.mjs'
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const result = (p) =>
  p.then(
    (r) => ({ sqlstate: '00000', rows: r.rows, rowCount: r.rowCount }),
    (e) => ({ sqlstate: /^[A-Z0-9]{5}$/.test(e.code ?? '') ? e.code : 'QUERY_FAILED' })
  )
const pid = async (c) => (await c.query('SELECT pg_catalog.pg_backend_pid() AS pid')).rows[0].pid
async function blocked(h, waiter, holder) {
  const until = Date.now() + 2500
  while (Date.now() < until) {
    const rows = (
      await h.db.query(
        `SELECT l.locktype,l.mode,l.granted,l.relation::regclass::text AS relation,a.wait_event_type,a.wait_event,pg_catalog.pg_blocking_pids(l.pid) AS blockers FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a ON a.pid=l.pid WHERE l.pid=$1 AND NOT l.granted`,
        [waiter]
      )
    ).rows
    if (rows.some((x) => x.blockers.includes(holder))) {
      h.ok(
        rows.every((x) => !x.granted && x.wait_event_type === 'Lock'),
        'real lock waiter observed'
      )
      return {
        waiterPid: waiter,
        holderPid: holder,
        waiter: rows,
        holder: (
          await h.db.query(
            'SELECT locktype,mode,granted,relation::regclass::text AS relation FROM pg_catalog.pg_locks WHERE pid=$1 AND granted ORDER BY locktype,mode,relation',
            [holder]
          )
        ).rows
      }
    }
    await pause(10)
  }
  h.ok(false, 'expected actual pg_locks wait and blocking pid')
}
async function cleanup(h, a, b, pending) {
  await a.query('ROLLBACK').catch(() => {})
  await b.query('ROLLBACK').catch(() => {})
  if (pending) await pending
  await h.close(a)
  await h.close(b)
}
async function doubleSends(h) {
  for (const kind of [
    'same_key',
    'changed_payload_cross_project',
    'pending_alias',
    'last_wallet_seat',
    'last_source_seat',
    'first_rollback'
  ])
    await h.scenario('race_double_send_' + kind, async () => {
      await seed(h.db)
      const aArgs = payload(),
        bArgs = payload()
      if (!['same_key', 'changed_payload_cross_project'].includes(kind))
        bArgs[1] = '41000000-0000-0000-0000-000000000002'
      if (kind === 'changed_payload_cross_project') bArgs[0] = P.two
      if (['last_wallet_seat', 'last_source_seat', 'first_rollback'].includes(kind)) {
        bArgs[0] = P.two
        if (kind !== 'last_source_seat')
          await h.db.query(
            'UPDATE public.user_resource_wallets SET storyteller_seats=1 WHERE user_id=$1',
            [U.owner]
          )
        else
          await h.db.query(
            'UPDATE invitation_candidate.trusted_seat_sources SET remaining=1,issued=1 WHERE id=$1',
            [S.storyteller]
          )
      }
      const before = await snapshot(h.db),
        a = await h.actorClient('authenticated', U.owner),
        b = await h.actorClient('authenticated', U.owner)
      let pending
      try {
        await a.query('BEGIN')
        await b.query('BEGIN')
        const ap = await pid(a),
          bp = await pid(b),
          first = await result(a.query(send, aArgs))
        h.eq(first.sqlstate, '00000', 'first send reserves inside transaction')
        pending = result(b.query(send, bArgs))
        const locks = await blocked(h, bp, ap)
        await invariant(h, before, 'uncommitted reservation invisible during observed send wait')
        await a.query(kind === 'first_rollback' ? 'ROLLBACK' : 'COMMIT')
        const afterFirst = await snapshot(h.db),
          second = await pending,
          expected =
            kind === 'changed_payload_cross_project'
              ? '22023'
              : ['last_wallet_seat', 'last_source_seat'].includes(kind)
                ? '42501'
                : '00000'
        h.eq(second.sqlstate, expected, 'waiting send observes committed eligibility')
        await b.query(second.sqlstate === '00000' ? 'COMMIT' : 'ROLLBACK')
        const after = await snapshot(h.db)
        h.eq(after['public.invitations'].length, 1, 'one committed invitation')
        h.eq(
          after['public.seat_transactions'].filter((x) => x.transaction_type === 'reserve').length,
          1,
          'one reserve log'
        )
        h.eq(after['invitation_candidate.bindings'].length, 1, 'one protected reservation')
        h.eq(
          after['invitation_candidate.requests'].length,
          kind === 'pending_alias' ? 2 : 1,
          'durable request count'
        )
        if (expected !== '00000')
          await invariant(h, afterFirst, 'losing scarce send makes no writes')
        else if (kind === 'same_key')
          await invariant(h, afterFirst, 'waiting same request is read only')
        if (kind === 'first_rollback')
          h.eq(afterFirst, before, 'aborted first caller restored every table')
        if (['same_key', 'pending_alias'].includes(kind))
          h.eq(
            second.rows[0].invitation_id,
            first.rows[0].invitation_id,
            'same invitation under retry/alias race'
          )
        h.report.concurrency.push({
          name: kind,
          observedLocks: locks,
          outcomes: [first.sqlstate, second.sqlstate],
          firstTransaction: kind === 'first_rollback' ? 'rolled_back' : 'committed',
          before: fingerprint(before),
          after: fingerprint(after)
        })
      } finally {
        await cleanup(h, a, b, pending)
      }
    })
}
async function acceptanceRaces(h) {
  for (const kind of [
    'double_accept',
    'accept_then_cancel',
    'cancel_then_accept',
    'accept_then_expire',
    'expire_then_accept'
  ])
    await h.scenario('race_' + kind, async () => {
      await seed(h.db)
      const s = await sent(h)
      if (kind === 'expire_then_accept') await expire(h.db, s.invitation_id)
      const isReleaseFirst = ['cancel_then_accept', 'expire_then_accept'].includes(kind),
        a = await h.actorClient('authenticated', isReleaseFirst ? U.owner : U.invitee),
        b = await h.actorClient(
          'authenticated',
          kind === 'double_accept' || isReleaseFirst ? U.invitee : U.owner
        ),
        before = await snapshot(h.db)
      let pending
      try {
        await a.query('BEGIN')
        await b.query('BEGIN')
        const ap = await pid(a),
          bp = await pid(b)
        const first = await result(
          a.query(
            isReleaseFirst ? release : accept,
            isReleaseFirst
              ? [s.invitation_id, kind === 'expire_then_accept' ? 'expired' : 'cancelled']
              : [s.token]
          )
        )
        h.eq(first.sqlstate, '00000', 'first operation succeeds')
        pending = result(
          b.query(
            kind === 'double_accept' || isReleaseFirst ? accept : release,
            kind === 'double_accept' || isReleaseFirst
              ? [s.token]
              : [s.invitation_id, kind === 'accept_then_expire' ? 'expired' : 'cancelled']
          )
        )
        const locks = await blocked(h, bp, ap)
        await invariant(h, before, 'first transition hidden before commit')
        await a.query('COMMIT')
        const committed = await snapshot(h.db),
          second = await pending
        h.eq(
          second.sqlstate,
          kind === 'double_accept' ? '00000' : '42501',
          'serialized terminal outcome'
        )
        await b.query(second.sqlstate === '00000' ? 'COMMIT' : 'ROLLBACK')
        await invariant(h, committed, 'second terminal operation adds no writes')
        if (kind === 'double_accept')
          h.eq(second.rows[0].outcome, 'already_accepted', 'same durable membership returned')
        h.report.concurrency.push({
          name: kind,
          observedLocks: locks,
          outcomes: [first.sqlstate, second.sqlstate],
          before: fingerprint(before),
          after: fingerprint(await snapshot(h.db))
        })
      } finally {
        await cleanup(h, a, b, pending)
      }
    })
}
async function eligibilityRaces(h) {
  const mutations = [
    [
      'project_transfer',
      'UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',
      [U.next, P.one]
    ],
    ['project_inactive', "UPDATE public.projects SET status='inactive' WHERE id=$1", [P.one]],
    ['email_unconfirmed', 'UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [U.invitee]],
    ['email_changed', "UPDATE auth.users SET email='other@example.test' WHERE id=$1", [U.invitee]],
    [
      'source_revoked',
      'UPDATE invitation_candidate.trusted_seat_sources SET revoked=true WHERE id=$1',
      [S.storyteller]
    ],
    [
      'source_unverified',
      'UPDATE invitation_candidate.trusted_seat_sources SET verified=false WHERE id=$1',
      [S.storyteller]
    ],
    [
      'member_revoked',
      "UPDATE public.project_roles SET status='inactive' WHERE user_id=$1 AND project_id=$2",
      [U.invitee, P.one]
    ],
    [
      'member_role',
      "UPDATE public.project_roles SET role='facilitator' WHERE user_id=$1 AND project_id=$2",
      [U.invitee, P.one]
    ]
  ]
  for (const [name, sql, args] of mutations)
    for (const order of ['accept_first', 'change_first'])
      await h.scenario('race_' + name + '_' + order, async () => {
        await seed(h.db)
        const s = await sent(h)
        if (name.startsWith('member'))
          h.eq(
            (await call(h, accept, [s.token], U.invitee)).sqlstate,
            '00000',
            'accepted member fixture'
          )
        const before = await snapshot(h.db),
          caller = await h.actorClient('authenticated', U.invitee),
          changer = await h.client()
        let pending
        try {
          await caller.query('BEGIN')
          await changer.query('BEGIN')
          const cp = await pid(caller),
            mp = await pid(changer)
          let locks, outcome
          if (order === 'accept_first') {
            outcome = await result(caller.query(accept, [s.token]))
            h.eq(outcome.sqlstate, '00000', 'accept under current eligibility')
            pending = result(changer.query(sql, args))
            locks = await blocked(h, mp, cp)
            await invariant(h, before, 'mutation waits behind accepted locks')
            await caller.query('COMMIT')
            const changed = await pending
            h.eq(changed.sqlstate, '00000', 'later mutation executes')
            h.eq(changed.rowCount, 1, 'one later identity/source/project/member mutation')
            await changer.query('COMMIT')
            const committed = await snapshot(h.db),
              repeat = await call(h, accept, [s.token], U.invitee)
            h.eq(repeat.sqlstate, '42501', 'later revocation blocks repeat')
            await invariant(h, committed, 'repeat never restores revoked access')
          } else {
            h.eq((await changer.query(sql, args)).rowCount, 1, 'earlier mutation targets one row')
            pending = result(caller.query(accept, [s.token]))
            locks = await blocked(h, cp, mp)
            await invariant(
              h,
              before,
              'uncommitted mutation remains invisible while caller blocked'
            )
            await changer.query('COMMIT')
            const committed = await snapshot(h.db)
            outcome = await pending
            h.eq(outcome.sqlstate, '42501', 'locked current eligibility rejects earlier revocation')
            await caller.query('ROLLBACK')
            await invariant(h, committed, 'waiting rejection has zero extra writes')
          }
          h.report.concurrency.push({
            name,
            order,
            observedLocks: locks,
            outcome: outcome.sqlstate,
            before: fingerprint(before),
            after: fingerprint(await snapshot(h.db))
          })
        } finally {
          await cleanup(
            h,
            order === 'accept_first' ? caller : changer,
            order === 'accept_first' ? changer : caller,
            pending
          )
        }
      })
}
async function resourceAndClockWaits(h) {
  for (const target of ['wallet', 'source', 'clock'])
    await h.scenario('observed_' + target + '_wait', async () => {
      await seed(h.db)
      const s = target === 'clock' ? await sent(h) : null
      if (target === 'clock') {
        await h.db.query(
          "UPDATE public.invitations SET expires_at=clock_timestamp()+interval '400 milliseconds' WHERE id=$1",
          [s.invitation_id]
        )
        await h.db.query(
          'UPDATE invitation_candidate.bindings b SET expires_at=i.expires_at FROM public.invitations i WHERE b.invitation_id=i.id AND i.id=$1',
          [s.invitation_id]
        )
      }
      const before = await snapshot(h.db),
        a = await h.client(),
        b = await h.actorClient('authenticated', target === 'clock' ? U.invitee : U.owner)
      let pending
      try {
        await a.query('BEGIN')
        await b.query('BEGIN')
        const ap = await pid(a),
          bp = await pid(b)
        await a.query(
          target === 'wallet'
            ? 'UPDATE public.user_resource_wallets SET storyteller_seats=0 WHERE user_id=$1'
            : target === 'source'
              ? 'UPDATE invitation_candidate.trusted_seat_sources SET revoked=true WHERE id=$1'
              : 'SELECT id FROM public.projects WHERE id=$1 FOR UPDATE',
          [target === 'wallet' ? U.owner : target === 'source' ? S.storyteller : P.one]
        )
        pending = result(
          b.query(target === 'clock' ? accept : send, target === 'clock' ? [s.token] : payload())
        )
        const locks = await blocked(h, bp, ap)
        await invariant(h, before, 'real ' + target + ' lock wait has no leaked writes')
        if (target === 'clock') await pause(450)
        await a.query('COMMIT')
        const committed = await snapshot(h.db),
          outcome = await pending
        h.eq(outcome.sqlstate, '42501', 'eligibility checked after ' + target + ' wait')
        await b.query('ROLLBACK')
        await invariant(h, committed, 'denied ' + target + ' waiter no writes')
        h.report.concurrency.push({
          name: target + '_wait',
          observedLocks: locks,
          outcome: outcome.sqlstate,
          before: fingerprint(before),
          after: fingerprint(await snapshot(h.db))
        })
      } finally {
        await cleanup(h, a, b, pending)
      }
    })
}
export async function concurrency(h) {
  h.report.concurrency = []
  await doubleSends(h)
  await acceptanceRaces(h)
  await eligibilityRaces(h)
  await resourceAndClockWaits(h)
  await crossProjectForeignKey(h)
  await identityDeletion(h)
}
// Controlled fixture-only insertion gate exposes FK lock acquisition rather than
// guessing a race from sleeps. It is dropped even when the regression fails.
async function crossProjectForeignKey(h) {
  await h.scenario('cross_project_accept_send_auth_fk_lock_order', async () => {
    await seed(h.db)
    const s = await sent(h),
      before = await snapshot(h.db),
      gate = await h.client(),
      a = await h.actorClient('authenticated', U.invitee),
      b = await h.actorClient('authenticated', U.owner)
    let accepting, sending
    await h.db.query(
      `SET ROLE fixture_owner;CREATE FUNCTION invitation_candidate._test_member_gate() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN PERFORM pg_catalog.pg_advisory_xact_lock(860018);RETURN NEW;END $$;REVOKE EXECUTE ON FUNCTION invitation_candidate._test_member_gate() FROM PUBLIC;CREATE TRIGGER invitation_test_gate BEFORE INSERT ON public.project_roles FOR EACH ROW EXECUTE FUNCTION invitation_candidate._test_member_gate();RESET ROLE`
    )
    try {
      await gate.query('BEGIN')
      await gate.query('SELECT pg_catalog.pg_advisory_xact_lock(860018)')
      await a.query('BEGIN')
      await b.query('BEGIN')
      const gp = await pid(gate),
        ap = await pid(a),
        bp = await pid(b)
      accepting = result(a.query(accept, [s.token]))
      const insertionGate = await blocked(h, ap, gp)
      const args = payload()
      args[0] = P.two
      args[1] = '41000000-0000-0000-0000-000000000002'
      sending = result(b.query(send, args))
      const walletWait = await blocked(h, bp, ap)
      await invariant(
        h,
        before,
        'both cross-project operations uncommitted at actual insertion and wallet waits'
      )
      await gate.query('COMMIT')
      const accepted = await accepting
      await a.query(accepted.sqlstate === '00000' ? 'COMMIT' : 'ROLLBACK')
      const afterAccept = await snapshot(h.db),
        sent = await sending
      await b.query(sent.sqlstate === '00000' ? 'COMMIT' : 'ROLLBACK')
      if (accepted.sqlstate !== '00000')
        h.eq(afterAccept, before, 'failed accepting transaction has no writes')
      if (sent.sqlstate !== '00000')
        await invariant(h, afterAccept, 'failed sending transaction has no writes')
      h.report.concurrency.push({
        name: 'cross_project_accept_send_auth_fk_lock_order',
        observedLocks: [insertionGate, walletWait],
        outcomes: [accepted.sqlstate, sent.sqlstate],
        before: fingerprint(before),
        after: fingerprint(await snapshot(h.db))
      })
      h.eq(
        accepted.sqlstate,
        '00000',
        'independent funded acceptance completes without FK deadlock'
      )
      h.eq(
        sent.sqlstate,
        '00000',
        'independent funded cross-project send completes without FK deadlock'
      )
      const after = await snapshot(h.db)
      h.eq(
        after['invitation_candidate.bindings'].filter((x) => x.state === 'consumed').length,
        1,
        'original accepted once'
      )
      h.eq(
        after['invitation_candidate.bindings'].filter((x) => x.state === 'reserved').length,
        1,
        'other project reserves once'
      )
      h.eq(
        after['public.seat_transactions'].filter((x) => x.transaction_type === 'reserve').length,
        2,
        'two total reservations and no replay'
      )
      h.eq(
        after['public.seat_transactions'].filter((x) => x.transaction_type === 'activate').length,
        1,
        'one activation'
      )
    } finally {
      await gate.query('ROLLBACK').catch(() => {})
      await a.query('ROLLBACK').catch(() => {})
      await b.query('ROLLBACK').catch(() => {})
      if (accepting) await accepting
      if (sending) await sending
      await h.close(gate)
      await h.close(a)
      await h.close(b)
      await h.db.query(
        'DROP TRIGGER invitation_test_gate ON public.project_roles;DROP FUNCTION invitation_candidate._test_member_gate()'
      )
    }
  })
}
async function identityDeletion(h) {
  for (const order of ['accept_first', 'delete_first'])
    await h.scenario('auth_deletion_exclusion_' + order, async () => {
      await seed(h.db)
      const s = await sent(h),
        before = await snapshot(h.db),
        a = await h.actorClient('authenticated', U.invitee),
        b = await h.client()
      let pending
      try {
        await a.query('BEGIN')
        await b.query('BEGIN')
        const ap = await pid(a),
          bp = await pid(b)
        let locks, acceptance, deletion
        if (order === 'accept_first') {
          acceptance = await result(a.query(accept, [s.token]))
          h.eq(acceptance.sqlstate, '00000', 'acceptance locks identity')
          pending = result(b.query('DELETE FROM auth.users WHERE id=$1', [U.invitee]))
          locks = await blocked(h, bp, ap)
          await a.query('COMMIT')
          const committed = await snapshot(h.db)
          deletion = await pending
          h.eq(deletion.sqlstate, '23503', 'durable accepted identity FK prevents deletion')
          await b.query('ROLLBACK')
          await invariant(h, committed, 'failed identity deletion preserves committed acceptance')
        } else {
          deletion = await result(b.query('DELETE FROM auth.users WHERE id=$1', [U.invitee]))
          h.eq(deletion.sqlstate, '00000', 'unaccepted synthetic identity can be removed')
          pending = result(a.query(accept, [s.token]))
          locks = await blocked(h, ap, bp)
          await b.query('COMMIT')
          const committed = await snapshot(h.db)
          acceptance = await pending
          h.eq(acceptance.sqlstate, '42501', 'waiter rechecks deleted current identity')
          await a.query('ROLLBACK')
          await invariant(h, committed, 'deleted identity acceptance writes nothing')
        }
        h.report.concurrency.push({
          name: 'auth_deletion_exclusion',
          order,
          observedLocks: locks,
          outcomes: { acceptance: acceptance.sqlstate, deletion: deletion.sqlstate },
          before: fingerprint(before),
          after: fingerprint(await snapshot(h.db))
        })
      } finally {
        await cleanup(
          h,
          order === 'accept_first' ? a : b,
          order === 'accept_first' ? b : a,
          pending
        )
      }
    })
}
