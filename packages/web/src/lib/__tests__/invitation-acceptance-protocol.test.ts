/** @jest-environment node */
import {
  parseInvitationBody, parseStatusRow, parseAcceptanceRow,
  parseAcceptanceResponse, parseStatusResponse, isConfirmedProviderUser,
} from '@/lib/invitation-acceptance-protocol'
import {
  pendingRow, acceptedRow, acceptedStatusRow, fixtureToken, fixtureUser,
  otherUser, providerUser, acceptedHttp, pendingHttp,
} from '@/lib/server/test-support/invitation-fixture'

describe('invitation protocol', () => {
  test('body permits only canonical token and a UUID identity assertion', () => {
    expect(parseInvitationBody({ token: fixtureToken, user_id: fixtureUser })).toEqual({ token: fixtureToken, userId: fixtureUser })
    expect(parseInvitationBody({ token: fixtureToken })).toEqual({ token: fixtureToken })
  })
  test.each([
    null, [], {}, { token: 1 }, { token: fixtureToken, extra: true },
    { token: fixtureToken, user_id: null }, { token: fixtureToken, user_id: '' },
    { token: `${fixtureToken}\n` }, { token: ` ${fixtureToken}` },
    { token: fixtureToken.toUpperCase() }, { token: '%76' + fixtureToken.slice(1) },
    { token: 'old-token' },
  ])('rejects malformed body case %#', body => expect(parseInvitationBody(body)).toBeNull())

  test('status validates the token then omits it from the confirmed fields', () => {
    expect(parseStatusRow([{ ...pendingRow, email: 'private', bearer: 'private' }], fixtureToken, fixtureUser))
      .toEqual({ invitation_id: pendingRow.invitation_id, project_id: pendingRow.project_id, role: 'storyteller', status: 'pending', expires_at: pendingRow.expires_at, is_expired: false, user_id: null, member_id: null, joined_at: null })
    expect(parseStatusRow([acceptedStatusRow], fixtureToken, fixtureUser)?.member_id).toBe(acceptedRow.member_id)
  })
  test.each([
    null, {}, [], [pendingRow, pendingRow], [null],
    [{ ...pendingRow, invitation_id: null }], [{ ...pendingRow, project_id: 'bad' }],
    [{ ...pendingRow, token: 'v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
    [{ ...pendingRow, role: 'owner' }], [{ ...pendingRow, status: 'unknown' }],
    [{ ...pendingRow, is_expired: 'false' }], [{ ...pendingRow, expires_at: 'tomorrow' }],
    [{ ...pendingRow, expires_at: '2026-02-30T00:00:00Z' }],
    [{ ...pendingRow, expires_at: '2026-10-18' }],
    [{ ...pendingRow, user_id: fixtureUser }], [{ ...pendingRow, member_id: undefined }],
    [{ ...pendingRow, joined_at: '2026-10-18T00:00:00Z' }],
    [{ ...pendingRow, status: 'expired', is_expired: false }],
    [{ ...acceptedStatusRow, user_id: otherUser }], [{ ...acceptedStatusRow, member_id: null }],
    [{ ...acceptedStatusRow, joined_at: null }],
  ])('cannot confirm invalid status case %#', row => expect(parseStatusRow(row, fixtureToken, fixtureUser)).toBeNull())

  test.each(['pending', 'declined', 'expired'])('database %s is a confirmed read, not membership', status => {
    const parsed = parseStatusRow([{ ...pendingRow, status, is_expired: true }], fixtureToken, fixtureUser)
    expect(parsed).toMatchObject({ status, user_id: null, member_id: null })
  })
  test('acceptance uses only complete final row and established identifiers', () => {
    expect(parseAcceptanceRow([{ ...acceptedRow, email: 'private' }], pendingRow, fixtureUser)).toEqual(acceptedRow)
    expect(parseAcceptanceRow([{ ...acceptedRow, outcome: 'already_accepted' }], acceptedStatusRow, fixtureUser))
      .toEqual({ ...acceptedRow, outcome: 'already_accepted' })
  })
  test.each([
    null, {}, [], [acceptedRow, acceptedRow], [null],
    ...['invitation_id', 'project_id', 'user_id', 'member_id', 'role', 'status', 'joined_at', 'outcome'].map(key => [{ ...acceptedRow, [key]: undefined }]),
    [{ ...acceptedRow, invitation_id: otherUser }], [{ ...acceptedRow, project_id: otherUser }],
    [{ ...acceptedRow, user_id: otherUser }], [{ ...acceptedRow, role: 'facilitator' }],
    [{ ...acceptedRow, status: 'pending' }], [{ ...acceptedRow, outcome: 'unknown' }],
    [{ ...acceptedRow, joined_at: 1 }], [{ ...acceptedRow, member_id: null }],
  ])('never fills or confirms an invalid accept row case %#', row => expect(parseAcceptanceRow(row, pendingRow, fixtureUser)).toBeNull())
  test.each([
    acceptedRow, { ...acceptedRow, outcome: 'already_accepted', member_id: otherUser },
    { ...acceptedRow, outcome: 'already_accepted', joined_at: '2026-10-18T00:00:00Z' },
  ])('accepted pre-read cannot override final inconsistency case %#', row => expect(parseAcceptanceRow([row], acceptedStatusRow, fixtureUser)).toBeNull())

  test('only provider confirmed, candidate-compatible top-level identity qualifies', () => {
    expect(isConfirmedProviderUser(providerUser)).toBe(true)
    expect(isConfirmedProviderUser({ ...providerUser, email: ' \tRecipient@Example.invalid\r\n' })).toBe(true)
  })
  test.each([
    null, {}, { ...providerUser, id: 'invalid' },
    { ...providerUser, email: null }, { ...providerUser, email: '' },
    { ...providerUser, email: 'a@@b' }, { ...providerUser, email: 'a b@c' },
    { ...providerUser, email: '名字@example.invalid' },
    { ...providerUser, email: '\u00a0a@b' },
    { ...providerUser, email_confirmed_at: null }, { ...providerUser, email_confirmed_at: 'yesterday' },
    { id: fixtureUser, user_metadata: { email: providerUser.email, email_confirmed_at: providerUser.email_confirmed_at } },
  ])('self asserted or malformed provider identity fails case %#', user => expect(isConfirmedProviderUser(user)).toBe(false))
  test('HTTP response parsers allow only complete confirmation and strip extras', () => {
    expect(parseAcceptanceResponse({ ...acceptedHttp, debug: 'private' })).toEqual(acceptedHttp)
    expect(parseStatusResponse({ ...pendingHttp, token: fixtureToken })).toEqual(pendingHttp)
    expect(parseAcceptanceResponse({ ...acceptedHttp, success: false })).toBeNull()
    expect(parseAcceptanceResponse({ ...acceptedHttp, member_id: null })).toBeNull()
    expect(parseStatusResponse({ ...pendingHttp, outcome: 'accepted' })).toBeNull()
  })
})
