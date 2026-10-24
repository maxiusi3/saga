import {
  readInvitationRecovery,
  saveInvitationRecovery,
  clearInvitationRecovery,
  invitationRecoveryKey,
} from '../invitation-recovery'

const actor = '11111111-1111-4111-8111-111111111111',
  project = '22222222-2222-4222-8222-222222222222'
const ticket = {
  version: 1 as const,
  actor_id: actor,
  project_id: project,
  request_id: '33333333-3333-4333-8333-333333333333',
  role: 'storyteller' as const,
}
beforeEach(() => sessionStorage.clear())
test('only exact minimal scoped ticket survives a refresh', () => {
  expect(saveInvitationRecovery(ticket)).toBe(true)
  expect(readInvitationRecovery(actor, project)).toEqual({ ticket, blocked: false })
  expect(JSON.parse(sessionStorage.getItem(invitationRecoveryKey(actor, project))!)).toEqual(ticket)
  expect(readInvitationRecovery('44444444-4444-4444-8444-444444444444', project)).toEqual({
    ticket: null,
    blocked: false,
  })
  expect(clearInvitationRecovery(ticket)).toBe(true)
  expect(readInvitationRecovery(actor, project)).toEqual({ ticket: null, blocked: false })
})
test.each([
  { ...ticket, token: 'secret' },
  { ...ticket, version: 2 },
  { ...ticket, actor_id: project },
  { ...ticket, request_id: 'bad' },
])('malformed/foreign recovery blocks writes without trusting data', value => {
  sessionStorage.setItem(invitationRecoveryKey(actor, project), JSON.stringify(value))
  expect(readInvitationRecovery(actor, project)).toEqual({ ticket: null, blocked: true })
})
test('storage failures never make unresolved writes look absent', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  expect(saveInvitationRecovery(ticket)).toBe(false)
  spy.mockRestore()
  saveInvitationRecovery(ticket)
  const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  expect(clearInvitationRecovery(ticket)).toBe(false)
  expect(readInvitationRecovery(actor, project).ticket).toEqual(ticket)
  remove.mockRestore()
})
test('late cleanup cannot delete a newer recovery ticket', () => {
  const newer = { ...ticket, request_id: '55555555-5555-4555-8555-555555555555' }
  saveInvitationRecovery(newer)
  expect(clearInvitationRecovery(ticket)).toBe(false)
  expect(readInvitationRecovery(actor, project).ticket).toEqual(newer)
})
