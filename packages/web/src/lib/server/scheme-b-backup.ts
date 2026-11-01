import { createHash } from 'node:crypto'

export interface StorageObjectEntry {
  id: string
  bucket: 'saga' | 'audio-recordings'
  key: string
  byteSize: number
  sha256: string
}

export interface SchemeBStorageManifest {
  freezeTimestamp: string
  dumpSha256: string
  dumpSizeBytes: number
  objects: readonly StorageObjectEntry[]
}

export interface SchemeBTombstoneRecord {
  targetType: 'story' | 'media_asset' | 'storage_object'
  targetId: string
  storageObjectId?: string
  bucket?: string
  key?: string
  tombstonedAt: string
  reason: string
}

export interface SchemeBBackupLedger {
  dumpSha256: string
  verifiedAt: string
  survivingObjectsCount: number
  tombstonesReplayed: number
  driftDetected: boolean
}

export type SchemeBBackupStatus =
  | {
      status: 'verified'
      verified: true
      dumpSha256: string
      verifiedAt: string
      survivingObjectsCount: number
      tombstonesReplayed: number
    }
  | {
      status: 'unverified'
      verified: false
      reason:
        | 'scheme_b_backup_not_rehearsed_or_verified'
        | 'invalid_backup_ledger'
        | 'storage_or_database_drift_detected'
    }

const ISO_UTC_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3})?Z$/
const HEX_SHA256_REGEX = /^[a-f0-9]{64}$/
const ALLOWED_BUCKETS = new Set(['saga', 'audio-recordings'])
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/
const PG_DUMP_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50]) // 'PGDMP'
const MIN_PG_DUMP_HEADER_BYTES = 12 // 5 bytes magic + 3 bytes version + int_size + off_t_size + format + flags
const MAX_OBJECT_ID_LENGTH = 128
const MAX_STORAGE_KEY_LENGTH = 512
const MAX_MANIFEST_OBJECTS = 100_000
const MAX_TOMBSTONES = 50_000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000 // 5 minutes

function validateIsoUtcTimestamp(timestamp: unknown): string {
  if (typeof timestamp !== 'string' || !ISO_UTC_REGEX.test(timestamp)) {
    throw new Error('INVALID_ISO_UTC_TIMESTAMP')
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_ISO_UTC_TIMESTAMP')
  }
  const [datePart] = timestamp.split('T')
  const [yearStr, monthStr, dayStr] = datePart.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('INVALID_CALENDAR_DATE')
  }
  return timestamp
}

export function verifyPgDumpCustomArchive(buffer: unknown): {
  valid: true
  magic: 'PGDMP'
  dumpSizeBytes: number
  dumpSha256: string
} {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('INVALID_DUMP_BUFFER')
  }
  if (buffer.length < MIN_PG_DUMP_HEADER_BYTES) {
    throw new Error('DUMP_BUFFER_TOO_SMALL')
  }
  if (!buffer.subarray(0, 5).equals(PG_DUMP_MAGIC)) {
    throw new Error('INVALID_PG_DUMP_MAGIC_HEADER')
  }

  const dumpSha256 = createHash('sha256').update(buffer).digest('hex')
  return {
    valid: true,
    magic: 'PGDMP',
    dumpSizeBytes: buffer.length,
    dumpSha256,
  }
}

export function verifyStorageManifest(
  manifest: unknown,
  expectedDumpSha256: string,
): {
  valid: true
  objectCount: number
  totalBytes: number
} {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('INVALID_STORAGE_MANIFEST')
  }

  if (typeof expectedDumpSha256 !== 'string' || !HEX_SHA256_REGEX.test(expectedDumpSha256)) {
    throw new Error('INVALID_EXPECTED_DUMP_SHA256')
  }

  const m = manifest as Record<string, unknown>
  validateIsoUtcTimestamp(m.freezeTimestamp)

  if (typeof m.dumpSha256 !== 'string' || !HEX_SHA256_REGEX.test(m.dumpSha256)) {
    throw new Error('INVALID_DUMP_SHA256_FORMAT')
  }
  if (m.dumpSha256 !== expectedDumpSha256) {
    throw new Error('DUMP_HASH_MANIFEST_MISMATCH')
  }

  if (
    typeof m.dumpSizeBytes !== 'number' ||
    !Number.isSafeInteger(m.dumpSizeBytes) ||
    m.dumpSizeBytes <= 0
  ) {
    throw new Error('INVALID_DUMP_SIZE')
  }

  if (!Array.isArray(m.objects)) {
    throw new Error('INVALID_OBJECTS_LIST')
  }
  if (m.objects.length > MAX_MANIFEST_OBJECTS) {
    throw new Error('STORAGE_MANIFEST_TOO_LARGE')
  }

  const seenKeys = new Set<string>()
  let totalBytes = 0

  for (const obj of m.objects) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('INVALID_STORAGE_OBJECT_ENTRY')
    }
    const o = obj as Record<string, unknown>
    if (
      typeof o.id !== 'string' ||
      o.id.trim().length === 0 ||
      o.id.length > MAX_OBJECT_ID_LENGTH ||
      CONTROL_CHAR_REGEX.test(o.id) ||
      o.id.includes('..')
    ) {
      throw new Error('INVALID_OBJECT_ID')
    }
    if (typeof o.bucket !== 'string' || !ALLOWED_BUCKETS.has(o.bucket)) {
      throw new Error('DISALLOWED_BUCKET_NAME')
    }
    if (
      typeof o.key !== 'string' ||
      o.key.trim().length === 0 ||
      o.key.length > MAX_STORAGE_KEY_LENGTH ||
      CONTROL_CHAR_REGEX.test(o.key) ||
      o.key.includes('..') ||
      o.key.includes('\\') ||
      o.key.startsWith('/') ||
      o.key.startsWith('./')
    ) {
      throw new Error('INVALID_STORAGE_KEY')
    }

    const compositeKey = `${o.bucket}::${o.key}`
    if (seenKeys.has(compositeKey)) {
      throw new Error('DUPLICATE_STORAGE_OBJECT_KEY')
    }
    seenKeys.add(compositeKey)

    if (
      typeof o.byteSize !== 'number' ||
      !Number.isSafeInteger(o.byteSize) ||
      o.byteSize <= 0
    ) {
      throw new Error('INVALID_OBJECT_SIZE')
    }
    totalBytes += o.byteSize
    if (!Number.isSafeInteger(totalBytes)) {
      throw new Error('TOTAL_BYTES_OVERFLOW')
    }

    if (typeof o.sha256 !== 'string' || !HEX_SHA256_REGEX.test(o.sha256)) {
      throw new Error('INVALID_SHA256_FORMAT')
    }
  }

  return {
    valid: true,
    objectCount: m.objects.length,
    totalBytes,
  }
}

export function replayTombstonesAndComputeSurvivingSet(
  manifest: SchemeBStorageManifest,
  tombstones: readonly SchemeBTombstoneRecord[],
): {
  purgedCount: number
  survivingObjects: StorageObjectEntry[]
  survivingTotalBytes: number
} {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.objects)) {
    throw new Error('INVALID_STORAGE_MANIFEST')
  }
  if (!Array.isArray(tombstones)) {
    throw new Error('INVALID_TOMBSTONES_LIST')
  }
  if (tombstones.length > MAX_TOMBSTONES) {
    throw new Error('TOMBSTONES_LIST_TOO_LARGE')
  }

  const freezeMs = new Date(validateIsoUtcTimestamp(manifest.freezeTimestamp)).getTime()

  // Only replay tombstones created on or after the freeze timestamp. Fail-closed on malformed records.
  const activePostFreezeTombstones: SchemeBTombstoneRecord[] = []
  for (const t of tombstones) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('INVALID_TOMBSTONE_ENTRY')
    }
    const tMs = new Date(validateIsoUtcTimestamp(t.tombstonedAt)).getTime()
    if (tMs >= freezeMs) {
      activePostFreezeTombstones.push(t)
    }
  }

  const tombstonedObjectIds = new Set<string>()
  const tombstonedCompositeKeys = new Set<string>()

  for (const t of activePostFreezeTombstones) {
    if (typeof t.storageObjectId === 'string' && t.storageObjectId.trim().length > 0) {
      tombstonedObjectIds.add(t.storageObjectId)
    }
    if (t.targetType === 'storage_object' && typeof t.targetId === 'string' && t.targetId.trim().length > 0) {
      tombstonedObjectIds.add(t.targetId)
    }
    if (
      typeof t.bucket === 'string' &&
      typeof t.key === 'string' &&
      t.bucket.trim().length > 0 &&
      t.key.trim().length > 0
    ) {
      tombstonedCompositeKeys.add(`${t.bucket}::${t.key}`)
    }
  }

  const survivingObjects: StorageObjectEntry[] = []
  let purgedCount = 0
  let survivingTotalBytes = 0

  for (const obj of manifest.objects) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('INVALID_STORAGE_OBJECT_ENTRY')
    }
    const compositeKey = `${obj.bucket}::${obj.key}`
    const isTombstoned =
      tombstonedObjectIds.has(obj.id) || tombstonedCompositeKeys.has(compositeKey)

    if (isTombstoned) {
      purgedCount += 1
    } else {
      if (
        typeof obj.byteSize !== 'number' ||
        !Number.isSafeInteger(obj.byteSize) ||
        obj.byteSize <= 0
      ) {
        throw new Error('INVALID_OBJECT_SIZE')
      }
      survivingObjects.push(obj)
      survivingTotalBytes += obj.byteSize
      if (!Number.isSafeInteger(survivingTotalBytes)) {
        throw new Error('TOTAL_BYTES_OVERFLOW')
      }
    }
  }

  return {
    purgedCount,
    survivingObjects,
    survivingTotalBytes,
  }
}

export function evaluateSchemeBBackupStatus(
  ledger?: unknown,
  options?: { now?: Date },
): SchemeBBackupStatus {
  let targetLedger = ledger
  if (
    targetLedger === undefined &&
    typeof process !== 'undefined' &&
    process.env?.SCHEME_B_BACKUP_LEDGER_JSON
  ) {
    try {
      targetLedger = JSON.parse(process.env.SCHEME_B_BACKUP_LEDGER_JSON)
    } catch {
      return {
        status: 'unverified',
        verified: false,
        reason: 'invalid_backup_ledger',
      }
    }
  }

  if (!targetLedger) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'scheme_b_backup_not_rehearsed_or_verified',
    }
  }

  if (typeof targetLedger !== 'object' || Array.isArray(targetLedger)) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  const l = targetLedger as Record<string, unknown>

  if (typeof l.dumpSha256 !== 'string' || !HEX_SHA256_REGEX.test(l.dumpSha256)) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  try {
    validateIsoUtcTimestamp(l.verifiedAt)
    const verifiedMs = new Date(l.verifiedAt as string).getTime()
    const nowMs = (options?.now ?? new Date()).getTime()
    if (verifiedMs > nowMs + MAX_CLOCK_SKEW_MS) {
      return {
        status: 'unverified',
        verified: false,
        reason: 'invalid_backup_ledger',
      }
    }
  } catch {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  if (
    typeof l.survivingObjectsCount !== 'number' ||
    !Number.isSafeInteger(l.survivingObjectsCount) ||
    l.survivingObjectsCount < 0
  ) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  if (
    typeof l.tombstonesReplayed !== 'number' ||
    !Number.isSafeInteger(l.tombstonesReplayed) ||
    l.tombstonesReplayed < 0
  ) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  if (typeof l.driftDetected !== 'boolean') {
    return {
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    }
  }

  if (l.driftDetected) {
    return {
      status: 'unverified',
      verified: false,
      reason: 'storage_or_database_drift_detected',
    }
  }

  return {
    status: 'verified',
    verified: true,
    dumpSha256: l.dumpSha256,
    verifiedAt: l.verifiedAt as string,
    survivingObjectsCount: l.survivingObjectsCount,
    tombstonesReplayed: l.tombstonesReplayed,
  }
}
