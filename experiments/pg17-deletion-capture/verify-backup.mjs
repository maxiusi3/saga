import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, fresh, prepareCandidate, materialize, capture, snapshot, USER, PROJECT } from './fixture.mjs'

// This is a manifest/restore-set compatibility check, not pg_dump/pg_restore or Storage I/O.
const directory = join(root, 'docs/research/evidence/2026-11-06-g1-deletion-capture', `native-backup-${Date.now()}-${randomUUID()}`)
const report = {
  status: 'running', assertions: 0, actorConnections: [], scenarios: [], sources: {}, artifacts: {},
  command: 'node experiments/pg17-deletion-capture/verify-backup.mjs',
  qualification: {
    scope: 'candidate manifest and computed restore-set compatibility',
    dump: 'synthetic PGDMP header and payload, not a restorable custom archive',
    objects: 'local synthetic files only; byte/hash fields computed by fixture, not verified by backup validators',
    pgRestoreExecuted: false, storageDownloadsVerified: false, backupLedgerQualified: false,
    physicalDeletionComplete: false, referenceSafeGcQualified: false, fullMigrationChainQualified: false,
    cloudOrDeviceQualified: false, g1MilestoneSatisfied: false, pushReady: false,
  },
}
const h = new Harness(report)
const require = createRequire(import.meta.url)
await mkdir(directory, { recursive: true })

async function source(path) {
  const bytes = await readFile(join(root, path))
  report.sources[path] = digest(bytes)
  return bytes.toString()
}

async function artifact(name, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n')
  await writeFile(join(directory, name), bytes, { flag: 'wx' })
  report.artifacts[name] = { sha256: digest(bytes), byteSize: bytes.length }
}

function outcome(fn) {
  try { return { ok: true, value: fn() } }
  catch (error) { return { ok: false, error: error.message } }
}

try {
  for (const path of [
    'experiments/pg17-deletion-capture/verify-backup.mjs',
    'experiments/pg17-deletion-capture/fixture.mjs',
    'experiments/pg17-routines/runtime.mjs',
    'experiments/pg17-routines/runtime-pins.json',
    'experiments/pg17-recording-flow/fixture.mjs',
    'experiments/pg17-recording-worker/fixture.mjs',
    'experiments/pg17-recording-candidates/fixture.mjs',
    'experiments/pg17-recording-finalization/fixture.mjs',
    'experiments/pg17-recording-status/fixture.mjs',
    'scripts/verify-scheme-b-backup.cjs',
  ]) await source(path)
  await h.start()
  await setup(h, source)
  const service = await h.actorClient('service_role', USER)
  const { prepareRecordingSessionSeal } = await compileModules(h, source)
  const ts = require('typescript')
  const compiled = ts.transpileModule(await source('packages/web/src/lib/server/scheme-b-backup.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  })
  h.eq(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'actual backup TypeScript transpiles')
  const compiledPath = join(h.scratch, 'scheme-b-backup.cjs')
  await writeFile(compiledPath, compiled.outputText)
  const typescript = require(compiledPath)
  const standalone = require(join(root, 'scripts/verify-scheme-b-backup.cjs'))

  let manifest, tombstones, dump
  await h.scenario('actual published capture supplies durable candidate addresses to a mixed manifest', async () => {
    const selected = await fresh(h, service, prepareRecordingSessionSeal)
    const retained = await fresh(h, service, prepareRecordingSessionSeal, false)
    await prepareCandidate(h, service, retained, 'reserved')
    await materialize(h, selected)
    await materialize(h, retained)

    // A separate synthetic legacy object has no relationship to the deleted story.
    const legacyKey = `projects/${PROJECT}/legacy/${randomUUID()}.jpg`
    const legacyBytes = Buffer.from('synthetic-legacy-object-not-a-family-photo')
    await h.db.query("INSERT INTO storage.buckets(id,name) VALUES('saga','saga') ON CONFLICT DO NOTHING")
    const legacy = (await h.db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('saga',$1,$2::jsonb) RETURNING *", [
      legacyKey, JSON.stringify({ synthetic: true, byteSize: legacyBytes.length, sha256: digest(legacyBytes) }),
    ])).rows[0]
    const legacyPath = join(h.scratch, 'synthetic-legacy-object')
    await writeFile(legacyPath, legacyBytes)
    h.syntheticFiles.set(`saga:${legacyKey}`, legacyPath)

    const before = await snapshot(h)
    const selectedCandidate = before.recording_output_candidates.find(c => c.id === selected.candidateId)
    const retainedCandidate = before.recording_output_candidates.find(c => c.id === retained.candidateId)
    const retainedChunk = before.recording_chunks.find(c => c.session_id === retained.sessionId)
    const selectedAsset = before.media_assets.find(a => a.id === selected.assetId)
    h.eq([selectedAsset.bucket, selectedAsset.object_key], [selectedCandidate.bucket, selectedCandidate.object_key], 'published asset uses actual candidate address')
    h.eq(retainedCandidate.state, 'reserved', 'retained candidate has actual reserved evidence')
    h.ok(selected.storyId !== retained.storyId, 'survivors belong to an unrelated story')

    dump = Buffer.concat([Buffer.from('PGDMP'), Buffer.from([1, 15, 0, 4, 8, 1, 0]), Buffer.from('SYNTHETIC_HEADER_ONLY_NOT_A_RESTORABLE_DUMP')])
    const freezeTimestamp = (await service.query('SELECT clock_timestamp() AS frozen')).rows[0].frozen.toISOString()
    const inputs = [
      { id: 'retained-original-chunk', bucket: retainedChunk.bucket, key: retainedChunk.object_key },
      { id: 'published-candidate-manifest-id', bucket: selectedCandidate.bucket, key: selectedCandidate.object_key },
      { id: 'retained-reserved-candidate', bucket: retainedCandidate.bucket, key: retainedCandidate.object_key },
      { id: legacy.id, bucket: legacy.bucket_id, key: legacy.name },
    ]
    const objects = []
    for (const entry of inputs) {
      const bytes = await readFile(h.syntheticFiles.get(`${entry.bucket}:${entry.key}`))
      objects.push({ ...entry, byteSize: bytes.length, sha256: digest(bytes) })
    }
    manifest = { freezeTimestamp, dumpSha256: digest(dump), dumpSizeBytes: dump.length, objects }
    await artifact('synthetic-header.dump', dump)
    await artifact('manifest.json', manifest)

    const receipt = await capture(service, { subjectId: selected.storyId, requestId: randomUUID() })
    const after = await snapshot(h)
    const request = after.deletion_requests.find(r => r.id === receipt.id)
    const targets = after.deletion_targets.filter(t => t.deletion_request_id === receipt.id)
    const storageTargets = targets.filter(t => t.kind === 'storage_object')
    const candidateTarget = storageTargets.find(t => t.bucket === selectedCandidate.bucket && t.object_key === selectedCandidate.object_key)
    h.ok(candidateTarget, 'capture persisted exact published candidate address')
    h.eq(storageTargets.length, 2, 'actual capture includes selected candidate and its original chunk')
    h.eq(storageTargets.filter(t => t.bucket === selectedCandidate.bucket && t.object_key === selectedCandidate.object_key).length, 1, 'published physical alias is deduplicated')
    h.eq(receipt.physicalDeletionComplete, false, 'capture does not claim physical deletion')
    const tombstonedAt = new Date(request.tombstone_at).toISOString()
    h.ok(Date.parse(tombstonedAt) > Date.parse(freezeTimestamp), 'durable capture is strictly after manifest freeze')
    tombstones = storageTargets.map(target => ({
      targetType: 'storage_object', targetId: target.target_id, bucket: target.bucket, key: target.object_key,
      tombstonedAt, reason: 'actual_durable_capture_storage_target',
    }))
    h.ok(tombstones.every(t => manifest.objects.every(o => t.targetId !== o.id)), 'replay must match captured bucket/key rather than fabricated object IDs')
    h.eq(after.synthetic_files, before.synthetic_files, 'capture preserves all local synthetic bytes')
    h.eq(after['storage.objects'], before['storage.objects'], 'capture preserves all synthetic Storage metadata')
    report.capture = {
      receipt, request, targets, selectedFixture: selected, retainedFixture: retained,
      candidateTarget, before, after,
      selection: 'Four-object subset: selected published candidate, unrelated original chunk, unrelated reserved candidate, standalone legacy object. The selected story original chunk is captured but absent from this manifest subset.',
      timestampConversion: 'Durable UTC microsecond timestamp retained in request; tombstone adapter normalizes to ISO UTC milliseconds required by existing Scheme B contract.',
    }
    await artifact('capture.json', report.capture)
    await artifact('tombstones.json', tombstones)
  })

  await h.scenario('actual TypeScript, CJS and CLI file mode agree on captured candidate exclusion', async () => {
    const inputBefore = JSON.stringify({ manifest, tombstones })
    const tsDump = typescript.verifyPgDumpCustomArchive(dump)
    const cjsDump = standalone.verifyPgDumpCustomArchiveBuffer(dump)
    h.eq(tsDump, cjsDump, 'synthetic header inspection parity')
    const tsManifest = outcome(() => typescript.verifyStorageManifest(manifest, tsDump.dumpSha256))
    const cjsManifest = outcome(() => standalone.verifyStorageManifestObject(manifest, cjsDump.dumpSha256))
    const tsReplay = typescript.replayTombstonesAndComputeSurvivingSet(manifest, tombstones)
    const cjsReplay = standalone.replayTombstones(manifest, tombstones)
    const cliArgs = ['scripts/verify-scheme-b-backup.cjs', '--dump', join(directory, 'synthetic-header.dump'), '--manifest', join(directory, 'manifest.json'), '--tombstones', join(directory, 'tombstones.json')]
    const cli = spawnSync(process.execPath, cliArgs, { cwd: root, encoding: 'utf8', timeout: 10000 })
    report.compatibility = { tsManifest, cjsManifest, tsReplay, cjsReplay,
      cli: { command: [process.execPath, ...cliArgs], status: cli.status, signal: cli.signal, stdout: cli.stdout, stderr: cli.stderr } }
    await artifact('compatibility.json', report.compatibility)
    h.eq(tsManifest, cjsManifest, 'TypeScript/CJS manifest result parity')
    h.eq(tsManifest, { ok: true, value: { valid: true, objectCount: 4, totalBytes: manifest.objects.reduce((n, o) => n + o.byteSize, 0) } }, 'candidate mixed manifest accepted')
    const survivors = [manifest.objects[0], manifest.objects[2], manifest.objects[3]]
    h.eq(tsReplay, { purgedCount: 1, survivingObjects: survivors, survivingTotalBytes: survivors.reduce((n, o) => n + o.byteSize, 0) }, 'exactly selected candidate excluded; unrelated records unchanged')
    h.eq(tsReplay, cjsReplay, 'TypeScript/CJS full restore-set parity')
    h.eq(cli.status, 0, 'actual file CLI exit status')
    h.eq(cli.stderr, '', 'actual file CLI stderr empty')
    h.eq(JSON.parse(cli.stdout), { mode: 'file_verification', status: 'pass', report: { verified: true, dump: tsDump, manifest: tsManifest.value, tombstoneReplay: tsReplay } }, 'actual file CLI complete output parity')
    h.eq(JSON.stringify({ manifest, tombstones }), inputBefore, 'validation and replay leave inputs unchanged')
    const after = await snapshot(h)
    h.eq(after, report.capture.after, 'backup compatibility run does not mutate database or physical bytes')
    await artifact('after-replay.json', after)
  })

  await h.scenario('candidate corruption is rejected identically and pre-freeze ledger behavior is unchanged', async () => {
    const candidate = manifest.objects[1]
    const cases = [
      ['unknown_bucket', { ...candidate, bucket: 'unknown-candidates' }, 'DISALLOWED_BUCKET_NAME'],
      ['path_traversal', { ...candidate, key: '../escape' }, 'INVALID_STORAGE_KEY'],
      ['absolute_key', { ...candidate, key: '/escape' }, 'INVALID_STORAGE_KEY'],
      ['backslash_key', { ...candidate, key: 'bad\\key' }, 'INVALID_STORAGE_KEY'],
      ['control_key', { ...candidate, key: 'bad\0key' }, 'INVALID_STORAGE_KEY'],
      ['empty_id', { ...candidate, id: '' }, 'INVALID_OBJECT_ID'],
      ['malformed_entry', null, 'INVALID_STORAGE_OBJECT_ENTRY'],
      ['invalid_hash', { ...candidate, sha256: 'bad' }, 'INVALID_SHA256_FORMAT'],
      ['zero_size', { ...candidate, byteSize: 0 }, 'INVALID_OBJECT_SIZE'],
      ['fractional_size', { ...candidate, byteSize: 1.5 }, 'INVALID_OBJECT_SIZE'],
      ['unsafe_size', { ...candidate, byteSize: Number.MAX_SAFE_INTEGER + 1 }, 'INVALID_OBJECT_SIZE'],
    ].map(([name, entry, error]) => ({ name, value: { ...manifest, objects: [entry] }, error }))
    cases.push({ name: 'duplicate_candidate_address', value: { ...manifest, objects: [...manifest.objects, { ...candidate, id: 'other-id' }] }, error: 'DUPLICATE_STORAGE_OBJECT_KEY' })
    cases.push({ name: 'total_bytes_overflow', value: { ...manifest, objects: [{ ...candidate, byteSize: Number.MAX_SAFE_INTEGER }, manifest.objects[0]] }, error: 'TOTAL_BYTES_OVERFLOW' })
    cases.push({ name: 'dump_hash_mismatch', value: { ...manifest, dumpSha256: '0'.repeat(64) }, error: 'DUMP_HASH_MANIFEST_MISMATCH' })
    report.validationParity = []
    for (const { name, value, error } of cases) {
      const tsResult = outcome(() => typescript.verifyStorageManifest(value, manifest.dumpSha256))
      const cjsResult = outcome(() => standalone.verifyStorageManifestObject(value, manifest.dumpSha256))
      report.validationParity.push({ name, tsResult, cjsResult })
      h.eq(tsResult, { ok: false, error }, `${name} rejected by TypeScript`)
      h.eq(cjsResult, tsResult, `${name} CJS parity`)
    }
    const preFreeze = tombstones.map(t => ({ ...t, tombstonedAt: new Date(Date.parse(manifest.freezeTimestamp) - 1).toISOString() }))
    const expected = { purgedCount: 0, survivingObjects: manifest.objects, survivingTotalBytes: manifest.objects.reduce((n, o) => n + o.byteSize, 0) }
    h.eq(typescript.replayTombstonesAndComputeSurvivingSet(manifest, preFreeze), expected, 'TypeScript historical tombstones retain all four objects')
    h.eq(standalone.replayTombstones(manifest, preFreeze), expected, 'CJS historical tombstones retain all four objects')
    h.eq(typescript.evaluateSchemeBBackupStatus(null), { status: 'unverified', verified: false, reason: 'scheme_b_backup_not_rehearsed_or_verified' }, 'no qualified backup ledger created by this rehearsal')
    await artifact('validation-parity.json', report.validationParity)
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message, where: error.where }
  process.exitCode = 1
} finally {
  await h.cleanup()
  if (report.status !== 'passed') process.exitCode = 1
  await writeFile(join(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ directory, status: report.status, assertions: report.assertions, error: report.error, cleanup: report.cleanup }, null, 2))
}
