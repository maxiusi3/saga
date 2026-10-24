import {
  seed,
  snapshot,
  invariant,
  fingerprint,
  U,
  P,
  R,
  payload,
  apply,
  send,
  accept,
  release,
  grant,
  writerClient,
  result,
  actor,
  invite,
  expire,
} from './scenarios.mjs'
const pause = ms => new Promise(r => setTimeout(r, ms))
const pid = async c => (await c.query('SELECT pg_catalog.pg_backend_pid() AS pid')).rows[0].pid
async function blocked(h, waiter, holder) {
  const until = Date.now() + 2500
  while (Date.now() < until) {
    const rows = (
      await h.db.query(
        `SELECT l.locktype,l.mode,l.granted,l.relation::regclass::text AS relation,a.wait_event_type,a.wait_event,pg_catalog.pg_blocking_pids(l.pid) AS blockers FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a ON a.pid=l.pid WHERE l.pid=$1 AND NOT l.granted`,
        [waiter]
      )
    ).rows
    if (rows.some(x => x.blockers.includes(holder))) {
      h.ok(
        rows.every(x => !x.granted && x.wait_event_type === 'Lock'),
        'actual pg_locks wait observed'
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
        ).rows,
      }
    }
    await pause(10)
  }
  h.ok(false, 'expected actual pg_locks blocking pid')
}
async function cleanup(h, first, second, pending) {
  await first.query('ROLLBACK').catch(() => {})
  await second.query('ROLLBACK').catch(() => {})
  if (pending) await pending
  await h.close(first)
  await h.close(second)
}
function record(h, name, locks, outcomes, before, after) {
  h.report.concurrency.push({
    name,
    observedLocks: locks,
    outcomes,
    before: fingerprint(before),
    after: fingerprint(after),
  })
}
async function grants(h) {
  for (const kind of [
    'same_event',
    'conflicting_event',
    'same_source_new_event',
    'conflicting_source',
    'shared_existing_wallet',
    'shared_new_wallet',
    'first_rollback',
    'grant_then_revoke',
    'revoke_then_grant',
  ])
    await h.scenario('concurrent_events_' + kind, async () => {
      await seed(h.db)
      const args = payload(),
        other = payload()
      let expected = '00000'
      if (kind === 'conflicting_event') {
        other[6] = 3
        expected = '22023'
      }
      if (kind === 'same_source_new_event') other[1] = 'e2'
      if (kind === 'conflicting_source') {
        other[1] = 'e2'
        other[6] = 3
        expected = '22023'
      }
      if (kind.startsWith('shared_')) {
        other[1] = 'e2'
        other[2] = 's2'
        if (kind === 'shared_new_wallet') args[4] = other[4] = U.next
      }
      if (kind === 'grant_then_revoke') {
        other[1] = 'e2'
        other[3] = 'revoke'
      }
      if (kind === 'revoke_then_grant') {
        args[3] = 'revoke'
        other[1] = 'e2'
      }
      const before = await snapshot(h.db),
        a = await writerClient(h),
        b = await writerClient(h)
      let pending
      try {
        await a.query('BEGIN')
        await b.query('BEGIN')
        const ap = await pid(a),
          bp = await pid(b)
        const first = await result(a.query(apply, args))
        h.eq(first.sqlstate, '00000', 'first event runs under held transaction')
        pending = result(b.query(apply, other))
        const locks = await blocked(h, bp, ap)
        await invariant(h, before, 'uncommitted first event invisible at observed wait')
        await a.query(kind === 'first_rollback' ? 'ROLLBACK' : 'COMMIT')
        const committed = await snapshot(h.db),
          second = await pending
        h.eq(second.sqlstate, expected, 'serialized second event outcome')
        await b.query(expected === '00000' ? 'COMMIT' : 'ROLLBACK')
        const after = await snapshot(h.db)
        if (expected !== '00000' || kind === 'same_event')
          await invariant(h, committed, 'duplicate/conflict adds zero writes')
        h.eq(
          after['entitlement_candidate.sources'].length,
          kind.startsWith('shared_') ? 2 : 1,
          'exact concurrent sources'
        )
        h.eq(
          after['entitlement_candidate.events'].length,
          expected !== '00000' || ['same_event', 'first_rollback'].includes(kind) ? 1 : 2,
          'exact concurrent event records'
        )
        const credits = after['public.seat_transactions'].filter(
          x => x.resource_type === 'storyteller_seat' && x.transaction_type === 'purchase'
        )
        h.eq(
          credits.length,
          kind.startsWith('shared_') ? 2 : kind === 'revoke_then_grant' ? 0 : 1,
          'exact concurrent credit count'
        )
        const wallet = after['public.user_resource_wallets'].find(x => x.user_id === args[4])
        h.eq(
          wallet.storyteller_seats,
          (kind === 'shared_new_wallet' ? 0 : 5) +
            (kind.startsWith('shared_') ? 4 : kind === 'revoke_then_grant' ? 0 : 2),
          'exact concurrent wallet arithmetic'
        )
        if (kind.includes('revoke'))
          h.eq(
            after['invitation_candidate.trusted_seat_sources'][0].revoked,
            true,
            'concurrent source terminal'
          )
        record(h, kind, locks, [first.sqlstate, second.sqlstate], before, after)
      } finally {
        await cleanup(h, a, b, pending)
      }
    })
}
async function invitationRaces(h) {
  for (const operation of ['send', 'accept', 'accept_repeat', 'cancel', 'expire'])
    for (const order of ['revoke_first', 'invitation_first'])
      await h.scenario('concurrent_revoke_' + operation + '_' + order, async () => {
        await seed(h.db)
        const g = await grant(h, payload('g', 's', 'grant', 'facilitator_seat', 3))
        let i
        if (operation === 'send') {
          const baseline = await invite(
            h,
            g.source_id,
            'facilitator',
            P.one,
            R,
            'other@example.test'
          )
          h.eq(
            (await actor(h, accept, [baseline.token], U.other)).sqlstate,
            '00000',
            'baseline source mapping'
          )
        } else {
          i = await invite(h, g.source_id, 'facilitator')
          if (operation === 'accept_repeat')
            h.eq(
              (await actor(h, accept, [i.token], U.invitee)).sqlstate,
              '00000',
              'repeat starts consumed'
            )
          if (operation === 'expire') await expire(h.db, i.invitation_id)
        }
        const sql = operation === 'send' ? send : operation.startsWith('accept') ? accept : release,
          args =
            operation === 'send'
              ? [
                  P.one,
                  '41000000-0000-0000-0000-000000000002',
                  'invitee@example.test',
                  'facilitator',
                  g.source_id,
                  null,
                ]
              : operation.startsWith('accept')
                ? [i.token]
                : [i.invitation_id, operation === 'cancel' ? 'cancelled' : 'expired']
        const before = await snapshot(h.db),
          revoker = await writerClient(h),
          caller = await h.actorClient(
            'authenticated',
            operation.startsWith('accept') ? U.invitee : U.owner
          )
        let pending
        const first = order === 'revoke_first' ? revoker : caller,
          second = order === 'revoke_first' ? caller : revoker
        try {
          await first.query('BEGIN')
          await second.query('BEGIN')
          const fp = await pid(first),
            sp = await pid(second)
          const firstResult = await result(
            first.query(
              order === 'revoke_first' ? apply : sql,
              order === 'revoke_first' ? payload('r', 's', 'revoke', 'facilitator_seat', 3) : args
            )
          )
          h.eq(firstResult.sqlstate, '00000', 'first serialized operation succeeds')
          pending = result(
            second.query(
              order === 'revoke_first' ? sql : apply,
              order === 'revoke_first' ? args : payload('r', 's', 'revoke', 'facilitator_seat', 3)
            )
          )
          const locks = await blocked(h, sp, fp)
          await invariant(h, before, 'revoke/invitation writes invisible while blocked')
          await first.query('COMMIT')
          const committed = await snapshot(h.db),
            secondResult = await pending,
            expected =
              order === 'revoke_first' && ['send', 'accept', 'accept_repeat'].includes(operation)
                ? '42501'
                : '00000'
          h.eq(secondResult.sqlstate, expected, 'revoke/invitation serialized outcome')
          await second.query(expected === '00000' ? 'COMMIT' : 'ROLLBACK')
          if (expected !== '00000')
            await invariant(h, committed, 'revoked waiter rejection adds no writes')
          const after = await snapshot(h.db)
          h.eq(
            after['invitation_candidate.trusted_seat_sources'][0].revoked,
            true,
            'terminal in both orders'
          )
          h.eq(after['entitlement_candidate.events'].length, 2, 'grant and one revoke event')
          h.eq(
            after['public.project_roles'].filter(
              x => x.user_id !== U.owner && x.status === 'active'
            ).length,
            0,
            'no mapped active member survives revoke'
          )
          const newReserves = operation === 'send' && order === 'invitation_first' ? 1 : 0
          h.eq(
            after['public.seat_transactions'].filter(x => x.transaction_type === 'reserve').length,
            1 + newReserves,
            'exact reservation effect'
          )
          h.eq(
            after['public.seat_transactions'].filter(x => x.transaction_type === 'release').length,
            ['cancel', 'expire'].includes(operation) ? 1 : 0,
            'exact release effect'
          )
          h.eq(
            after['public.seat_transactions'].filter(x => x.transaction_type === 'activate').length,
            operation === 'send' ||
              operation === 'accept_repeat' ||
              (operation === 'accept' && order === 'invitation_first')
              ? 1
              : 0,
            'exact activation effect'
          )
          record(
            h,
            operation + '_' + order,
            locks,
            [firstResult.sqlstate, secondResult.sqlstate],
            before,
            after
          )
        } finally {
          await cleanup(h, first, second, pending)
        }
      })
}
async function discovery(h) {
  await h.scenario('new_project_binding_after_discovery_safe_retry', async () => {
    await seed(h.db)
    const g = await grant(h, payload('g', 's', 'grant', 'facilitator_seat', 3)),
      i = await invite(h, g.source_id, 'facilitator')
    h.eq(
      (await actor(h, accept, [i.token], U.invitee)).sqlstate,
      '00000',
      'first committed source member'
    )
    const before = await snapshot(h.db),
      sender = await h.actorClient('authenticated', U.owner),
      revoker = await writerClient(h)
    let pending
    try {
      await sender.query('BEGIN')
      await revoker.query('BEGIN')
      const sp = await pid(sender),
        rp = await pid(revoker)
      const sent = await result(
        sender.query(send, [
          P.two,
          '41000000-0000-0000-0000-000000000002',
          'invitee@example.test',
          'facilitator',
          g.source_id,
          null,
        ])
      )
      h.eq(sent.sqlstate, '00000', 'uncommitted new project binding')
      await sender.query("SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,false)", [
        U.invitee,
      ])
      h.eq(
        (await result(sender.query(accept, [sent.rows[0].token]))).sqlstate,
        '00000',
        'uncommitted new project accepted member'
      )
      pending = result(revoker.query(apply, payload('r', 's', 'revoke', 'facilitator_seat', 3)))
      const locks = await blocked(h, rp, sp)
      await invariant(h, before, 'new project remains invisible during discovery wallet wait')
      await sender.query('COMMIT')
      const committed = await snapshot(h.db)
      h.eq((await pending).sqlstate, '40001', 'new project requires safe serialization retry')
      await revoker.query('ROLLBACK')
      await invariant(h, committed, 'discovery retry refusal zero extra writes')
      await grant(h, payload('r', 's', 'revoke', 'facilitator_seat', 3))
      const after = await snapshot(h.db)
      h.eq(
        after['public.project_roles'].filter(x => x.user_id === U.invitee).map(x => x.status),
        ['inactive', 'inactive'],
        'retry deactivates both mapped projects'
      )
      h.eq(after['invitation_candidate.bindings'].length, 2, 'both mappings retained')
      h.eq(after['entitlement_candidate.events'].length, 2, 'failed revoke never recorded event')
      record(h, 'new_project_discovery', locks, ['40001', '00000'], before, after)
    } finally {
      await cleanup(h, sender, revoker, pending)
    }
  })
}
export async function concurrency(h) {
  h.report.concurrency = []
  await grants(h)
  await invitationRaces(h)
  await discovery(h)
}
