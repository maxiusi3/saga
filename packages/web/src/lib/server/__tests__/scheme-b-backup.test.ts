import { createHash } from 'node:crypto'
import {
  verifyPgDumpCustomArchive,
  verifyStorageManifest,
  replayTombstonesAndComputeSurvivingSet,
  evaluateSchemeBBackupStatus,
  type SchemeBStorageManifest,
  type SchemeBTombstoneRecord,
  type SchemeBBackupLedger,
} from '../scheme-b-backup'

describe('Scheme B Backup Verification Engine (P0/G0)', () => {
  const PG_DUMP_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50]) // 'PGDMP'
  const createMockDump = (content: string = 'MOCK_PG17_DUMP_TOC_DATA') => {
    // 5 bytes magic + 7 bytes header info = 12 bytes minimum header
    const versionHeader = Buffer.from([0x01, 0x0f, 0x00, 0x04, 0x08, 0x01, 0x00])
    const payload = Buffer.from(content, 'utf8')
    return Buffer.concat([PG_DUMP_MAGIC, versionHeader, payload])
  }

  const sha256Hex = (buf: Buffer | string) =>
    createHash('sha256').update(buf).digest('hex')

  describe('verifyPgDumpCustomArchive', () => {
    it('successfully verifies a valid pg_dump custom archive buffer', () => {
      const dumpBuf = createMockDump()
      const result = verifyPgDumpCustomArchive(dumpBuf)
      expect(result.valid).toBe(true)
      expect(result.dumpSizeBytes).toBe(dumpBuf.length)
      expect(result.dumpSha256).toBe(sha256Hex(dumpBuf))
      expect(result.magic).toBe('PGDMP')
    })

    it('rejects non-buffer or empty input', () => {
      expect(() => verifyPgDumpCustomArchive(null as any)).toThrow('INVALID_DUMP_BUFFER')
      expect(() => verifyPgDumpCustomArchive(Buffer.alloc(0))).toThrow('DUMP_BUFFER_TOO_SMALL')
      expect(() => verifyPgDumpCustomArchive(Buffer.from('tiny'))).toThrow('DUMP_BUFFER_TOO_SMALL')
    })

    it('rejects truncated archive headers containing only magic bytes (< 12 bytes)', () => {
      const truncatedHeader = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50]) // 'PGDMP' alone (5 bytes)
      expect(() => verifyPgDumpCustomArchive(truncatedHeader)).toThrow('DUMP_BUFFER_TOO_SMALL')
      expect(() =>
        verifyPgDumpCustomArchive(Buffer.concat([truncatedHeader, Buffer.from([0x01, 0x0f])])),
      ).toThrow('DUMP_BUFFER_TOO_SMALL')
    })

    it('rejects buffers missing the PGDMP magic bytes header', () => {
      const badMagic = Buffer.from('PK\x03\x04SOME_ZIP_HEADER_DATA_12BYTES')
      expect(() => verifyPgDumpCustomArchive(badMagic)).toThrow('INVALID_PG_DUMP_MAGIC_HEADER')
    })

    it('rejects plain text SQL dumps pretending to be custom archives', () => {
      const sqlDump = Buffer.from('-- PostgreSQL database dump\nCREATE TABLE foo();')
      expect(() => verifyPgDumpCustomArchive(sqlDump)).toThrow('INVALID_PG_DUMP_MAGIC_HEADER')
    })
  })

  describe('verifyStorageManifest', () => {
    const dumpBuf = createMockDump()
    const validDumpSha256 = sha256Hex(dumpBuf)

    const validManifest: SchemeBStorageManifest = {
      freezeTimestamp: '2026-10-24T08:50:00.000Z',
      dumpSha256: validDumpSha256,
      dumpSizeBytes: dumpBuf.length,
      objects: [
        {
          id: 'obj-1',
          bucket: 'saga',
          key: 'projects/proj-alpha/photos/photo1.jpg',
          byteSize: 1024,
          sha256: 'a'.repeat(64),
        },
        {
          id: 'obj-2',
          bucket: 'audio-recordings',
          key: 'user-1/projects/proj-alpha/recordings/audio1.webm',
          byteSize: 2048,
          sha256: 'b'.repeat(64),
        },
      ],
    }

    it('validates a compliant storage manifest', () => {
      const result = verifyStorageManifest(validManifest, validDumpSha256)
      expect(result.valid).toBe(true)
      expect(result.objectCount).toBe(2)
      expect(result.totalBytes).toBe(3072)
    })

    it('rejects manifest when dumpSha256 does not match actual dump hash', () => {
      expect(() =>
        verifyStorageManifest(validManifest, 'c'.repeat(64)),
      ).toThrow('DUMP_HASH_MANIFEST_MISMATCH')
    })

    it('rejects manifest with invalid or non-UTC timestamp', () => {
      const badTs = { ...validManifest, freezeTimestamp: '2026-10-24 08:50:00' }
      expect(() => verifyStorageManifest(badTs, validDumpSha256)).toThrow('INVALID_ISO_UTC_TIMESTAMP')

      const rolloverTs = { ...validManifest, freezeTimestamp: '2026-02-30T10:00:00.000Z' }
      expect(() => verifyStorageManifest(rolloverTs, validDumpSha256)).toThrow('INVALID_CALENDAR_DATE')
    })

    it('rejects disallowed buckets or path traversal keys', () => {
      const badBucket = {
        ...validManifest,
        objects: [
          {
            id: 'obj-x',
            bucket: 'secret-system-bucket' as any,
            key: 'file.txt',
            byteSize: 10,
            sha256: 'a'.repeat(64),
          },
        ],
      }
      expect(() => verifyStorageManifest(badBucket, validDumpSha256)).toThrow('DISALLOWED_BUCKET_NAME')

      const pathTraversal = {
        ...validManifest,
        objects: [
          {
            id: 'obj-y',
            bucket: 'saga' as const,
            key: '../../etc/passwd',
            byteSize: 10,
            sha256: 'a'.repeat(64),
          },
        ],
      }
      expect(() => verifyStorageManifest(pathTraversal, validDumpSha256)).toThrow('INVALID_STORAGE_KEY')
    })

    it('rejects null bytes and backslashes in storage keys', () => {
      const nullByteKey = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], key: 'projects/p1/\0bad.jpg' }],
      }
      expect(() => verifyStorageManifest(nullByteKey, validDumpSha256)).toThrow('INVALID_STORAGE_KEY')

      const backslashKey = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], key: 'projects\\p1\\bad.jpg' }],
      }
      expect(() => verifyStorageManifest(backslashKey, validDumpSha256)).toThrow('INVALID_STORAGE_KEY')
    })

    it('rejects invalid or oversized object ids', () => {
      const oversizedId = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], id: 'x'.repeat(129) }],
      }
      expect(() => verifyStorageManifest(oversizedId, validDumpSha256)).toThrow('INVALID_OBJECT_ID')

      const traversalId = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], id: '../secret-id' }],
      }
      expect(() => verifyStorageManifest(traversalId, validDumpSha256)).toThrow('INVALID_OBJECT_ID')
    })

    it('rejects duplicate object keys in the manifest', () => {
      const duplicates = {
        ...validManifest,
        objects: [
          validManifest.objects[0],
          { ...validManifest.objects[0], id: 'obj-duplicate' },
        ],
      }
      expect(() => verifyStorageManifest(duplicates, validDumpSha256)).toThrow('DUPLICATE_STORAGE_OBJECT_KEY')
    })

    it('rejects invalid sha256 format or non-positive sizes', () => {
      const badSha = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], sha256: 'not-hex' }],
      }
      expect(() => verifyStorageManifest(badSha, validDumpSha256)).toThrow('INVALID_SHA256_FORMAT')

      const zeroSize = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], byteSize: 0 }],
      }
      expect(() => verifyStorageManifest(zeroSize, validDumpSha256)).toThrow('INVALID_OBJECT_SIZE')

      const nanSize = {
        ...validManifest,
        objects: [{ ...validManifest.objects[0], byteSize: NaN }],
      }
      expect(() => verifyStorageManifest(nanSize, validDumpSha256)).toThrow('INVALID_OBJECT_SIZE')
    })
  })

  describe('replayTombstonesAndComputeSurvivingSet', () => {
    const manifest: SchemeBStorageManifest = {
      freezeTimestamp: '2026-10-24T08:50:00.000Z',
      dumpSha256: 'a'.repeat(64),
      dumpSizeBytes: 5000,
      objects: [
        {
          id: 'obj-keep',
          bucket: 'saga',
          key: 'projects/p1/keep.jpg',
          byteSize: 1000,
          sha256: '1'.repeat(64),
        },
        {
          id: 'obj-deleted',
          bucket: 'audio-recordings',
          key: 'projects/p1/deleted.webm',
          byteSize: 2000,
          sha256: '2'.repeat(64),
        },
      ],
    }

    const tombstones: SchemeBTombstoneRecord[] = [
      {
        targetType: 'storage_object',
        targetId: 'obj-deleted',
        storageObjectId: 'obj-deleted',
        bucket: 'audio-recordings',
        key: 'projects/p1/deleted.webm',
        tombstonedAt: '2026-10-24T08:55:00.000Z',
        reason: 'user_requested_deletion_after_backup',
      },
    ]

    it('purges tombstoned objects and returns only verified surviving objects', () => {
      const result = replayTombstonesAndComputeSurvivingSet(manifest, tombstones)
      expect(result.purgedCount).toBe(1)
      expect(result.survivingObjects.length).toBe(1)
      expect(result.survivingObjects[0].id).toBe('obj-keep')
      expect(result.survivingTotalBytes).toBe(1000)
    })

    it('ignores tombstones recorded BEFORE the freeze timestamp', () => {
      const preFreezeTombstones: SchemeBTombstoneRecord[] = [
        {
          targetType: 'storage_object',
          targetId: 'obj-keep',
          storageObjectId: 'obj-keep',
          bucket: 'saga',
          key: 'projects/p1/keep.jpg',
          tombstonedAt: '2026-10-24T08:00:00.000Z', // Before 08:50:00
          reason: 'historical_tombstone',
        },
      ]
      const result = replayTombstonesAndComputeSurvivingSet(manifest, preFreezeTombstones)
      expect(result.purgedCount).toBe(0)
      expect(result.survivingObjects.length).toBe(2)
    })

    it('purges tombstones created EXACTLY at the freeze timestamp (inclusive boundary)', () => {
      const exactBoundaryTombstone: SchemeBTombstoneRecord[] = [
        {
          targetType: 'storage_object',
          targetId: 'obj-keep',
          tombstonedAt: '2026-10-24T08:50:00.000Z', // exactly freezeTimestamp
          reason: 'boundary_tombstone',
        },
      ]
      const result = replayTombstonesAndComputeSurvivingSet(manifest, exactBoundaryTombstone)
      expect(result.purgedCount).toBe(1)
      expect(result.survivingObjects.length).toBe(1)
      expect(result.survivingObjects[0].id).toBe('obj-deleted')
    })

    it('fails closed on malformed tombstone entries', () => {
      const malformedTombstone = [
        {
          targetType: 'storage_object',
          targetId: 'obj-keep',
          tombstonedAt: 'not-a-timestamp',
          reason: 'bad_ts',
        } as any,
      ]
      expect(() =>
        replayTombstonesAndComputeSurvivingSet(manifest, malformedTombstone),
      ).toThrow('INVALID_ISO_UTC_TIMESTAMP')
    })

    it('detects and prevents ghost object resurrection', () => {
      // If a tombstoned key matches by bucket/key even with different id, it must still be purged
      const matchingByKey: SchemeBTombstoneRecord[] = [
        {
          targetType: 'media_asset',
          targetId: 'asset-999',
          bucket: 'audio-recordings',
          key: 'projects/p1/deleted.webm',
          tombstonedAt: '2026-10-24T08:52:00.000Z',
          reason: 'gdpr_deletion',
        },
      ]
      const result = replayTombstonesAndComputeSurvivingSet(manifest, matchingByKey)
      expect(result.purgedCount).toBe(1)
      expect(result.survivingObjects.map(o => o.id)).toEqual(['obj-keep'])
    })
  })

  describe('evaluateSchemeBBackupStatus', () => {
    it('returns unverified when no backup ledger is provided or configured', () => {
      const status = evaluateSchemeBBackupStatus(null)
      expect(status.status).toBe('unverified')
      expect(status.verified).toBe(false)
      expect(status.reason).toBe('scheme_b_backup_not_rehearsed_or_verified')
    })

    it('returns unverified when drift is flagged', () => {
      const ledger: SchemeBBackupLedger = {
        dumpSha256: 'a'.repeat(64),
        verifiedAt: '2026-10-24T08:55:00.000Z',
        survivingObjectsCount: 1,
        tombstonesReplayed: 1,
        driftDetected: true,
      }
      const status = evaluateSchemeBBackupStatus(ledger)
      expect(status.status).toBe('unverified')
      expect(status.verified).toBe(false)
      expect(status.reason).toBe('storage_or_database_drift_detected')
    })

    it('returns verified when ledger contains valid checksums and zero drift', () => {
      const ledger: SchemeBBackupLedger = {
        dumpSha256: 'a'.repeat(64),
        verifiedAt: '2026-10-24T08:55:00.000Z',
        survivingObjectsCount: 142,
        tombstonesReplayed: 3,
        driftDetected: false,
      }
      const status = evaluateSchemeBBackupStatus(ledger)
      expect(status.status).toBe('verified')
      expect(status.verified).toBe(true)
      expect(status.dumpSha256).toBe('a'.repeat(64))
      expect(status.survivingObjectsCount).toBe(142)
      expect(status.tombstonesReplayed).toBe(3)
    })

    it('fails closed when ledger fields are malformed or non-integers', () => {
      const badLedger = {
        dumpSha256: 'invalid-hex',
        verifiedAt: '2026-10-24T08:55:00.000Z',
        survivingObjectsCount: -5,
        tombstonesReplayed: 'many',
        driftDetected: false,
      } as any
      const status = evaluateSchemeBBackupStatus(badLedger)
      expect(status.status).toBe('unverified')
      expect(status.reason).toBe('invalid_backup_ledger')
    })

    it('rejects ledger timestamps with excessive future clock skew (> 5 min)', () => {
      const futureLedger: SchemeBBackupLedger = {
        dumpSha256: 'a'.repeat(64),
        verifiedAt: '2099-01-01T00:00:00.000Z',
        survivingObjectsCount: 10,
        tombstonesReplayed: 0,
        driftDetected: false,
      }
      const status = evaluateSchemeBBackupStatus(futureLedger, {
        now: new Date('2026-11-01T00:00:00.000Z'),
      })
      expect(status.status).toBe('unverified')
      expect(status.reason).toBe('invalid_backup_ledger')
    })

    it('parses valid ledger from process.env.SCHEME_B_BACKUP_LEDGER_JSON', () => {
      const originalEnv = process.env.SCHEME_B_BACKUP_LEDGER_JSON
      try {
        process.env.SCHEME_B_BACKUP_LEDGER_JSON = JSON.stringify({
          dumpSha256: 'b'.repeat(64),
          verifiedAt: '2026-10-24T08:55:00.000Z',
          survivingObjectsCount: 10,
          tombstonesReplayed: 2,
          driftDetected: false,
        })
        const status = evaluateSchemeBBackupStatus()
        expect(status.status).toBe('verified')
        expect(status.verified).toBe(true)

        // Corrupted JSON returns unverified fail-closed
        process.env.SCHEME_B_BACKUP_LEDGER_JSON = '{corrupted_json'
        const badStatus = evaluateSchemeBBackupStatus()
        expect(badStatus.status).toBe('unverified')
        expect(badStatus.reason).toBe('invalid_backup_ledger')
      } finally {
        process.env.SCHEME_B_BACKUP_LEDGER_JSON = originalEnv
      }
    })
  })
})
