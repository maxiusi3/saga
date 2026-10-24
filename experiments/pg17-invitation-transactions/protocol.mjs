// The router has already decoded once. No normalization or compatibility guesses.
export const isCanonicalToken = (value) =>
  typeof value === 'string' && /^v1_[0-9a-f]{32}$/.test(value) && value.length === 35
const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const timestamp = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value))
const role = (value) => ['facilitator', 'storyteller'].includes(value)
const statuses = ['pending', 'accepted', 'declined', 'expired']
const unknown = () => ({ kind: 'unknown' })
const rejects = new Set(['42501', '22023', '23514', '23505', '23503', '23502'])
function decode(response, expected, required, validate) {
  if (!response || typeof response !== 'object') return unknown()
  if (response.error != null)
    return rejects.has(response.error.code)
      ? { kind: 'rejected', code: response.error.code }
      : unknown()
  if (
    !Object.hasOwn(response, 'error') ||
    !Array.isArray(response.data) ||
    response.data.length !== 1
  )
    return unknown()
  const row = response.data[0]
  if (
    !row ||
    typeof row !== 'object' ||
    Array.isArray(row) ||
    !expected ||
    required.some((k) => !uuid(expected[k]))
  )
    return unknown()
  for (const key of ['invitation_id', 'project_id', 'user_id', 'member_id', 'role', 'token'])
    if (
      expected[key] != null &&
      Object.hasOwn(row, key) &&
      row[key] != null &&
      row[key] !== expected[key]
    )
      return unknown()
  if (!uuid(row.invitation_id) || !uuid(row.project_id) || !validate(row, expected))
    return unknown()
  return { kind: 'confirmed', value: row }
}
export function decodeSendResult(response, expected) {
  return decode(
    response,
    expected,
    ['project_id'],
    (r) =>
      role(expected.role) &&
      r.role === expected.role &&
      isCanonicalToken(r.token) &&
      timestamp(r.expires_at) &&
      statuses.includes(r.status) &&
      ['created', 'reused'].includes(r.outcome) &&
      (r.outcome !== 'created' || r.status === 'pending')
  )
}
export function decodeAcceptResult(response, expected) {
  return decode(
    response,
    expected,
    ['project_id', 'user_id'],
    (r) =>
      uuid(r.user_id) &&
      uuid(r.member_id) &&
      role(expected.role) &&
      r.role === expected.role &&
      r.status === 'accepted' &&
      timestamp(r.joined_at) &&
      ['accepted', 'already_accepted'].includes(r.outcome)
  )
}
export function decodeReleaseResult(response, expected) {
  return decode(
    response,
    expected,
    ['invitation_id', 'project_id'],
    (r) =>
      ['cancelled', 'expired'].includes(expected.reason) &&
      r.status === (expected.reason === 'cancelled' ? 'declined' : 'expired') &&
      ['released', 'already_released'].includes(r.outcome)
  )
}
export function decodeStatusResult(response, expected) {
  return decode(response, expected, ['project_id'], (r) => {
    if (
      !isCanonicalToken(r.token) ||
      !role(expected.role) ||
      r.role !== expected.role ||
      !statuses.includes(r.status) ||
      !timestamp(r.expires_at) ||
      typeof r.is_expired !== 'boolean'
    )
      return false
    if (r.status === 'expired' && !r.is_expired) return false
    return r.status === 'accepted'
      ? uuid(r.user_id) && uuid(r.member_id) && timestamp(r.joined_at)
      : r.user_id === null && r.member_id === null && r.joined_at === null
  })
}
