import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isCanonicalToken,
  decodeSendResult,
  decodeAcceptResult,
  decodeReleaseResult,
  decodeStatusResult
} from './protocol.mjs'
const id = '10000000-0000-4000-8000-000000000001',
  project = '20000000-0000-4000-8000-000000000001',
  user = '30000000-0000-4000-8000-000000000001',
  member = '40000000-0000-4000-8000-000000000001'
const token = 'v1_0123456789abcdef0123456789abcdef',
  time = '2026-10-18T10:00:00.000Z'
const expected = {
  invitation_id: id,
  project_id: project,
  user_id: user,
  role: 'storyteller',
  token
}
const send = {
  invitation_id: id,
  project_id: project,
  token,
  role: 'storyteller',
  status: 'pending',
  expires_at: time,
  outcome: 'created'
}
const accept = {
  invitation_id: id,
  project_id: project,
  user_id: user,
  member_id: member,
  role: 'storyteller',
  status: 'accepted',
  joined_at: time,
  outcome: 'accepted'
}
const release = { invitation_id: id, project_id: project, status: 'declined', outcome: 'released' }
const status = {
  invitation_id: id,
  project_id: project,
  token,
  role: 'storyteller',
  status: 'pending',
  expires_at: time,
  is_expired: false,
  user_id: null,
  member_id: null,
  joined_at: null
}
test('token is exactly one decoded lowercase versioned identifier', () => {
  assert.equal(isCanonicalToken(token), true)
  for (const t of [
    null,
    42,
    '',
    token.toUpperCase(),
    ' ' + token,
    token + '\n',
    '%76' + token.slice(1),
    'legacy-opaque',
    'v2_' + token.slice(3),
    token + 'a',
    token.slice(1)
  ])
    assert.equal(isCanonicalToken(t), false)
})
for (const [name, decode, row, exp] of [
  ['send', decodeSendResult, send, { project_id: project, role: 'storyteller' }],
  ['accept', decodeAcceptResult, accept, expected],
  [
    'release',
    decodeReleaseResult,
    release,
    { invitation_id: id, project_id: project, reason: 'cancelled' }
  ],
  ['status', decodeStatusResult, status, expected]
]) {
  test(name + ' confirms exactly one complete matching row', () =>
    assert.equal(decode({ data: [row], error: null }, exp).kind, 'confirmed')
  )
  test(name + ' malformed or uncertain transport never succeeds', () => {
    for (const data of [null, [], [row, row], row, [null], [{}], [{ ...row, project_id: user }]])
      assert.equal(decode({ data, error: null }, exp).kind, 'unknown')
    for (const error of [
      { code: '08006', message: 'private' },
      { code: '57014' },
      { code: '55P03' },
      { code: 'XX000' },
      new Error('network')
    ])
      assert.deepEqual(decode({ data: [row], error }, exp), { kind: 'unknown' })
    for (const key of Object.keys(row)) {
      const copy = { ...row }
      delete copy[key]
      assert.equal(decode({ data: [copy], error: null }, exp).kind, 'unknown')
    }
    assert.equal(decode({ data: [row], error: null }, {}).kind, 'unknown')
  })
  test(name + ' only safe explicit database rejections classify rejected', () => {
    for (const code of ['42501', '22023', '23514', '23505', '23503'])
      assert.deepEqual(
        decode(
          { data: null, error: { code, message: token, details: 'private', hint: 'private' } },
          exp
        ),
        { kind: 'rejected', code }
      )
  })
}
test('state/result combinations and durable mapping are strict', () => {
  assert.equal(
    decodeSendResult(
      { data: [{ ...send, status: 'accepted' }], error: null },
      { project_id: project, role: 'storyteller' }
    ).kind,
    'unknown'
  )
  assert.equal(
    decodeAcceptResult({ data: [{ ...accept, status: 'active' }], error: null }, expected).kind,
    'unknown'
  )
  assert.equal(
    decodeAcceptResult({ data: [{ ...accept, joined_at: 'nonsense' }], error: null }, expected)
      .kind,
    'unknown'
  )
  assert.equal(
    decodeReleaseResult(
      { data: [release], error: null },
      { invitation_id: id, project_id: project, reason: 'expired' }
    ).kind,
    'unknown'
  )
  assert.equal(
    decodeStatusResult({ data: [{ ...status, user_id: user }], error: null }, expected).kind,
    'unknown'
  )
  assert.equal(
    decodeStatusResult(
      {
        data: [
          { ...status, status: 'accepted', user_id: user, member_id: member, joined_at: time }
        ],
        error: null
      },
      expected
    ).kind,
    'confirmed'
  )
  assert.equal(
    decodeStatusResult(
      { data: [{ ...status, status: 'expired', is_expired: false }], error: null },
      expected
    ).kind,
    'unknown'
  )
})
for (const [name, decode, row, exp] of [
  ['send', decodeSendResult, send, { project_id: project, role: 'storyteller' }],
  ['accept', decodeAcceptResult, accept, expected],
  [
    'release',
    decodeReleaseResult,
    release,
    { invitation_id: id, project_id: project, reason: 'cancelled' }
  ],
  ['status', decodeStatusResult, status, expected]
])
  test(name + ' rejects wrong field types and mismatched expected facts', () => {
    for (const key of Object.keys(row))
      if (row[key] !== null)
        assert.equal(decode({ data: [{ ...row, [key]: null }], error: null }, exp).kind, 'unknown')
    for (const key of ['project_id', 'role'])
      if (Object.hasOwn(exp, key))
        assert.equal(
          decode(
            { data: [row], error: null },
            { ...exp, [key]: key === 'role' ? 'facilitator' : user }
          ).kind,
          'unknown'
        )
    assert.equal(decode({ data: [row] }, exp).kind, 'unknown')
  })
