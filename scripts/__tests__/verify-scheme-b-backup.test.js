const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { createHash } = require('node:crypto')
const {
  verifyPgDumpCustomArchiveBuffer,
  verifyStorageManifestObject,
  replayTombstones,
  runSchemeBVerification,
} = require('../verify-scheme-b-backup.cjs')

const ROOT_DIR = path.resolve(__dirname, '../..')
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts/verify-scheme-b-backup.cjs')
const PG_DUMP_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50])

function createMockDump(content = 'TEST_PG17_RESTORE_DATA') {
  return Buffer.concat([
    PG_DUMP_MAGIC,
    Buffer.from([0x01, 0x0f, 0x00, 0x04, 0x08, 0x01, 0x00]),
    Buffer.from(content, 'utf8'),
  ])
}

test('Scheme B CLI & verification engine', async (t) => {
  await t.test('verifies custom pg_dump archive magic and hash', () => {
    const dump = createMockDump()
    const info = verifyPgDumpCustomArchiveBuffer(dump)
    assert.equal(info.valid, true)
    assert.equal(info.magic, 'PGDMP')
    assert.equal(info.dumpSizeBytes, dump.length)
    assert.equal(info.dumpSha256, createHash('sha256').update(dump).digest('hex'))

    assert.throws(
      () => verifyPgDumpCustomArchiveBuffer(Buffer.from('corrupted_header')),
      /INVALID_PG_DUMP_MAGIC_HEADER/,
    )
    assert.throws(
      () => verifyPgDumpCustomArchiveBuffer(Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50])),
      /DUMP_BUFFER_TOO_SMALL/,
    )
  })

  await t.test('validates storage manifest and enforces dump SHA-256 match', () => {
    const dump = createMockDump()
    const dumpSha = createHash('sha256').update(dump).digest('hex')
    const manifest = {
      freezeTimestamp: '2026-10-24T08:50:00.000Z',
      dumpSha256: dumpSha,
      dumpSizeBytes: dump.length,
      objects: [
        {
          id: 'obj-1',
          bucket: 'audio-recordings',
          key: 'user/recordings/audio.webm',
          byteSize: 4096,
          sha256: 'f'.repeat(64),
        },
      ],
    }

    const info = verifyStorageManifestObject(manifest, dumpSha)
    assert.equal(info.valid, true)
    assert.equal(info.objectCount, 1)

    assert.throws(
      () => verifyStorageManifestObject(manifest, '0'.repeat(64)),
      /DUMP_HASH_MANIFEST_MISMATCH/,
    )
    assert.throws(
      () =>
        verifyStorageManifestObject(
          { ...manifest, objects: [{ ...manifest.objects[0], key: '../bad.webm' }] },
          dumpSha,
        ),
      /INVALID_STORAGE_KEY/,
    )
    assert.throws(
      () =>
        verifyStorageManifestObject(
          { ...manifest, objects: [{ ...manifest.objects[0], key: 'bad/\0null.webm' }] },
          dumpSha,
        ),
      /INVALID_STORAGE_KEY/,
    )
    assert.throws(
      () =>
        verifyStorageManifestObject(
          { ...manifest, freezeTimestamp: '2026-02-30T00:00:00.000Z' },
          dumpSha,
        ),
      /INVALID_CALENDAR_DATE/,
    )
  })

  await t.test('replays post-freeze deletion tombstones and purges deleted objects', () => {
    const manifest = {
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

    const tombstones = [
      {
        targetType: 'storage_object',
        targetId: 'obj-deleted',
        storageObjectId: 'obj-deleted',
        tombstonedAt: '2026-10-24T08:55:00.000Z',
        reason: 'user_delete',
      },
    ]

    const result = replayTombstones(manifest, tombstones)
    assert.equal(result.purgedCount, 1)
    assert.equal(result.survivingObjects.length, 1)
    assert.equal(result.survivingObjects[0].id, 'obj-keep')
  })

  await t.test('CLI runs in --dry-run mode exiting 0 with structured output', () => {
    const output = execFileSync('node', [SCRIPT_PATH, '--dry-run'], {
      encoding: 'utf8',
    })
    const parsed = JSON.parse(output)
    assert.equal(parsed.mode, 'dry_run_self_check')
    assert.equal(parsed.status, 'pass')
    assert.equal(parsed.report.verified, true)
    assert.equal(parsed.report.dump.magic, 'PGDMP')
  })

  await t.test('CLI runs against valid files on disk and outputs verification report', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scheme-b-test-'))
    try {
      const dumpFile = path.join(tmpDir, 'backup.dump')
      const manifestFile = path.join(tmpDir, 'manifest.json')
      const tombstonesFile = path.join(tmpDir, 'tombstones.json')

      const dumpBuf = createMockDump('REAL_FILE_BACKUP')
      const dumpSha = createHash('sha256').update(dumpBuf).digest('hex')
      fs.writeFileSync(dumpFile, dumpBuf)

      const manifestData = {
        freezeTimestamp: '2026-10-24T08:50:00.000Z',
        dumpSha256: dumpSha,
        dumpSizeBytes: dumpBuf.length,
        objects: [
          {
            id: 'obj-live-1',
            bucket: 'saga',
            key: 'projects/p1/photo.jpg',
            byteSize: 2048,
            sha256: '3'.repeat(64),
          },
        ],
      }
      fs.writeFileSync(manifestFile, JSON.stringify(manifestData))
      fs.writeFileSync(tombstonesFile, JSON.stringify([]))

      const output = execFileSync(
        'node',
        [SCRIPT_PATH, '--dump', dumpFile, '--manifest', manifestFile, '--tombstones', tombstonesFile],
        { encoding: 'utf8' },
      )
      const parsed = JSON.parse(output)
      assert.equal(parsed.mode, 'file_verification')
      assert.equal(parsed.status, 'pass')
      assert.equal(parsed.report.verified, true)
      assert.equal(parsed.report.dump.dumpSha256, dumpSha)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('CLI exits with error code 1 when invoked with invalid arguments', () => {
    assert.throws(() => {
      execFileSync('node', [SCRIPT_PATH, '--dump', '/nonexistent/file.dump'], {
        encoding: 'utf8',
        stdio: 'pipe',
      })
    })
  })
})
