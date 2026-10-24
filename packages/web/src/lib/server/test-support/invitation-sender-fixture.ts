import { fixtureInvitation, fixtureProject, fixtureToken, pendingRow } from './invitation-fixture'
export const requestId = '66666666-6666-4666-8666-666666666666'
export const sourceId = '77777777-7777-4777-8777-777777777777'
export const sendInput = { request_id: requestId, source_id: sourceId, email: 'invitee@example.invalid', role: 'storyteller' as const, message: null }
export const lookupInput = { request_id: requestId, project_id: fixtureProject, role: 'storyteller' as const }
export const releaseInput = { invitation_id: fixtureInvitation, reason: 'cancelled' as const }
export const sendRow = { invitation_id: fixtureInvitation, project_id: fixtureProject, token: fixtureToken, role: 'storyteller', status: 'pending', expires_at: '2030-01-01T00:00:00+00:00', outcome: 'created' }
export const releaseRow = { invitation_id: fixtureInvitation, project_id: fixtureProject, status: 'declined', outcome: 'released' }
export const sendHttp = { success: true, ...sendRow }
export const releaseHttp = { success: true, ...releaseRow }
export const lookupHttp = { success: true, outcome: 'confirmed', ...pendingRow }
