import { parseSendInput, parseReleaseInput, parseLookupInput, parseSendRow, parseReleaseRow, parseLookupRow, parseSendResponse, parseReleaseResponse, parseLookupResponse, parseSenderFailure } from '../invitation-sender-protocol'
import { fixtureProject, fixtureInvitation, otherUser, pendingRow, acceptedStatusRow } from '../server/test-support/invitation-fixture'
import { sendInput, releaseInput, lookupInput, sendRow, releaseRow, sendHttp, releaseHttp, lookupHttp } from '../server/test-support/invitation-sender-fixture'

test('send normalizes only ASCII email edges and empty message, retaining message code points', () => {
  expect(parseSendInput({ ...sendInput, email: ' \tINVITEE@EXAMPLE.INVALID\r\n', message: '' })).toEqual(sendInput)
  expect(parseSendInput({ ...sendInput, message: ' text \n' })).toEqual({ ...sendInput, message: ' text \n' })
  expect(parseSendInput({ ...sendInput, message: '😀'.repeat(2000) })).not.toBeNull()
  const { message: _, ...withoutMessage } = sendInput
  expect(parseSendInput(withoutMessage)).toEqual(sendInput)
})
test.each([
  null, [], {}, { ...sendInput, extra: true }, { ...sendInput, source_id: undefined }, { ...sendInput, request_id: 4 },
  { ...sendInput, source_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, { ...sendInput, email: 'a@@b' },
  { ...sendInput, email: 'a@' }, { ...sendInput, email: '@b' }, { ...sendInput, email: '\u00a0a@b' },
  { ...sendInput, email: 'a @b' }, { ...sendInput, email: 'a@é' }, { ...sendInput, email: 'K@example.invalid' }, { ...sendInput, email: 'a'.repeat(253) + '@b' },
  { ...sendInput, role: 'owner' }, { ...sendInput, message: 1 }, { ...sendInput, message: '😀'.repeat(2001) },
])('send rejects invalid input case %#', value => expect(parseSendInput(value)).toBeNull())
test('release and lookup accept exactly their own command keys', () => {
  expect(parseReleaseInput(releaseInput)).toEqual(releaseInput)
  expect(parseReleaseInput({ ...releaseInput, reason: 'expired' })).not.toBeNull()
  expect(parseLookupInput(lookupInput)).toEqual(lookupInput)
  for (const value of [null, [], {}, { ...releaseInput, project_id: fixtureProject }, { ...releaseInput, request_id: lookupInput.request_id }, { ...releaseInput, reason: 'declined' }, { ...releaseInput, invitation_id: '%33' }]) expect(parseReleaseInput(value)).toBeNull()
  for (const value of [null, [], {}, { ...lookupInput, project_id: 'bad' }, { ...lookupInput, role: 'owner' }, { ...lookupInput, token: 'extra' }]) expect(parseLookupInput(value)).toBeNull()
})
test('send confirms both roles and only created pending or reused terminal rows, whitelisting fields', () => {
  expect(parseSendRow([{ ...sendRow, secret: 'discard' }], fixtureProject, 'storyteller')).toEqual(sendRow)
  for (const role of ['facilitator', 'storyteller'] as const) for (const status of ['pending', 'accepted', 'declined', 'expired']) {
    expect(parseSendRow([{ ...sendRow, role, status, outcome: 'reused' }], fixtureProject, role)).toEqual({ ...sendRow, role, status, outcome: 'reused' })
  }
})
test.each([
  [], null, sendRow, [sendRow, sendRow], [{}], [{ ...sendRow, project_id: otherUser }], [{ ...sendRow, role: 'facilitator' }],
  [{ ...sendRow, invitation_id: 'bad' }], [{ ...sendRow, token: 'v1_BAD' }], [{ ...sendRow, expires_at: '2026-02-30T00:00:00Z' }],
  [{ ...sendRow, expires_at: undefined }], [{ ...sendRow, status: 'accepted' }], [{ ...sendRow, outcome: 'confirmed' }],
])('send cannot confirm malformed/inconsistent SQL case %#', data => expect(parseSendRow(data, fixtureProject, 'storyteller')).toBeNull())
test('release binds invitation/reason, strips token, and accepts replay only for the requested final state', () => {
  expect(parseReleaseRow([{ ...releaseRow, token: 'discard' }], releaseInput)).toEqual(releaseRow)
  expect(parseReleaseRow([{ ...releaseRow, status: 'expired', outcome: 'already_released' }], { ...releaseInput, reason: 'expired' })).not.toBeNull()
  for (const data of [[], [releaseRow, releaseRow], [{}], [{ ...releaseRow, invitation_id: otherUser }], [{ ...releaseRow, project_id: 'bad' }], [{ ...releaseRow, status: 'expired' }], [{ ...releaseRow, outcome: 'created' }]]) expect(parseReleaseRow(data, releaseInput)).toBeNull()
})
test('sender lookup accepts a different accepted recipient identity and enforces nullable fields', () => {
  expect(parseLookupRow([{ ...acceptedStatusRow, user_id: otherUser }], lookupInput)).toEqual({ ...acceptedStatusRow, user_id: otherUser })
  for (const role of ['facilitator', 'storyteller'] as const) for (const status of ['pending', 'declined', 'expired']) {
    const row = { ...pendingRow, role, status, is_expired: status === 'expired' }
    expect(parseLookupRow([row], { ...lookupInput, role })).toEqual(row)
  }
  for (const data of [[], [pendingRow, pendingRow], pendingRow, [{}], [{ ...pendingRow, project_id: otherUser }], [{ ...pendingRow, role: 'facilitator' }], [{ ...pendingRow, token: 'bad' }], [{ ...pendingRow, is_expired: 'false' }], [{ ...pendingRow, status: 'expired' }], [{ ...pendingRow, member_id: fixtureInvitation }], [{ ...pendingRow, joined_at: undefined }], [{ ...acceptedStatusRow, user_id: null }], [{ ...acceptedStatusRow, joined_at: '2026-02-30T00:00:00Z' }]]) expect(parseLookupRow(data, lookupInput)).toBeNull()
})
test('HTTP parsers reject claimed success without full consistent confirmation', () => {
  expect(parseSendResponse(sendHttp, fixtureProject, 'storyteller')).toEqual(sendHttp)
  expect(parseReleaseResponse(releaseHttp, releaseInput, fixtureProject)).toEqual(releaseHttp)
  expect(parseLookupResponse(lookupHttp, lookupInput)).toEqual(lookupHttp)
  expect(parseReleaseResponse(releaseHttp, releaseInput, otherUser)).toBeNull()
  expect(parseSendResponse({ ...sendHttp, success: false }, fixtureProject, 'storyteller')).toBeNull()
  expect(parseLookupResponse({ ...lookupHttp, outcome: 'reused' }, lookupInput)).toBeNull()
})
test('failure parser requires compatible HTTP status, explicit failure, safe fields and recovery flag', () => {
  for (const [status, outcome] of [[400, 'rejected'], [403, 'rejected'], [409, 'rejected'], [401, 'not_attempted'], [503, 'not_attempted'], [503, 'unknown']] as const) {
    expect(parseSenderFailure({ success: false, outcome, error: 'safe', can_query_status: outcome === 'unknown' }, status)).toBe(outcome)
  }
  for (const [body, status] of [[{ success: true, outcome: 'not_attempted' }, 503], [{ success: false, outcome: 'not_attempted' }, 503], [{ success: false, outcome: 'rejected', error: 'safe', can_query_status: false }, 503], [{ success: false, outcome: 'unknown', error: 'safe', can_query_status: false }, 503]]) expect(parseSenderFailure(body, status as number)).toBeNull()
})
