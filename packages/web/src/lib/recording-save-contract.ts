/** Browser-safe, closed public save contracts. No Storage identities or SQL rows. */
export type RecordingSaveMetadata = Readonly<{ title: string; content: string; transcript: string; happenedAt: string;
  recordingMode: 'chat' | 'deep_dive'; isPublic: boolean }>
export type RecordingSaveIdentity = Readonly<{ actorId: string; projectId: string; sessionId: string }>
export type RecordingSaveLookup = Readonly<RecordingSaveIdentity & { schemaVersion: 1; intent: Readonly<{
  storyId: string; metadata: RecordingSaveMetadata; manifestSha256: string | null; assetId: string | null; confirmed: boolean
}> | null; canClearLocalDrafts: false }>
export type RecordingSaveConfirmationIdentity = Readonly<RecordingSaveIdentity & { storyId: string; assetId: string; manifestSha256: string }>
export type RecordingSaveReceipt = Readonly<RecordingSaveConfirmationIdentity & {
  schemaVersion: 1; playbackUrl: string; canClearLocalDrafts: true
}>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const IDENTITY = ['actorId', 'projectId', 'sessionId'] as const
function invalid(): never { throw new Error('invalid_recording_save') }
function closed(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) invalid()
  return row
}
export function isRecordingSaveUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
export function validateRecordingSaveMetadata(value: unknown): asserts value is RecordingSaveMetadata {
  const row = closed(value, ['title', 'content', 'transcript', 'happenedAt', 'recordingMode', 'isPublic'])
  for (const [key, bound] of [['title', 500], ['content', 200000], ['transcript', 200000]] as const) {
    if (typeof row[key] !== 'string' || row[key].length > bound || row[key].includes('\u0000')) invalid()
  }
  if (typeof row.happenedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.happenedAt) ||
    !Number.isFinite(Date.parse(row.happenedAt)) || new Date(row.happenedAt).toISOString() !== row.happenedAt ||
    typeof row.recordingMode !== 'string' || !['chat', 'deep_dive'].includes(row.recordingMode) || typeof row.isPublic !== 'boolean') invalid()
}
export function validateRecordingSaveIdentity(value: unknown): asserts value is RecordingSaveIdentity {
  const row = closed(value, IDENTITY)
  if (IDENTITY.some(key => !isRecordingSaveUuid(row[key]))) invalid()
}
export function validateRecordingSaveLookup(value: unknown, identity: RecordingSaveIdentity): RecordingSaveLookup {
  validateRecordingSaveIdentity(identity)
  const row = closed(value, ['schemaVersion', ...IDENTITY, 'intent', 'canClearLocalDrafts'])
  if (row.schemaVersion !== 1 || row.canClearLocalDrafts !== false || IDENTITY.some(key => row[key] !== identity[key])) invalid()
  let intent: RecordingSaveLookup['intent'] = null
  if (row.intent !== null) {
    const item = closed(row.intent, ['storyId', 'metadata', 'manifestSha256', 'assetId', 'confirmed'])
    validateRecordingSaveMetadata(item.metadata)
    if (!isRecordingSaveUuid(item.storyId) || typeof item.confirmed !== 'boolean' ||
      (item.manifestSha256 === null ? item.assetId !== null || item.confirmed :
        typeof item.manifestSha256 !== 'string' || !HASH.test(item.manifestSha256) || !isRecordingSaveUuid(item.assetId))) invalid()
    intent = Object.freeze({ storyId: item.storyId, metadata: Object.freeze({ ...item.metadata }),
      manifestSha256: item.manifestSha256 as string | null, assetId: item.assetId as string | null, confirmed: item.confirmed })
  }
  return Object.freeze({ schemaVersion: 1, ...identity, intent, canClearLocalDrafts: false })
}
export function validateRecordingSaveReceipt(value: unknown, identity: RecordingSaveConfirmationIdentity): RecordingSaveReceipt {
  validateRecordingSaveIdentity({ actorId: identity.actorId, projectId: identity.projectId, sessionId: identity.sessionId })
  const row = closed(value, ['schemaVersion', ...IDENTITY, 'storyId', 'assetId', 'manifestSha256', 'playbackUrl', 'canClearLocalDrafts'])
  if (!isRecordingSaveUuid(identity.storyId) || !isRecordingSaveUuid(identity.assetId) || !HASH.test(identity.manifestSha256) ||
    row.schemaVersion !== 1 || row.canClearLocalDrafts !== true ||
    [...IDENTITY, 'storyId', 'assetId', 'manifestSha256'].some(key => row[key] !== identity[key as keyof RecordingSaveConfirmationIdentity]) ||
    row.playbackUrl !== `/api/media/assets/${identity.assetId}/play`) invalid()
  return Object.freeze({ schemaVersion: 1, ...identity, playbackUrl: String(row.playbackUrl), canClearLocalDrafts: true })
}
