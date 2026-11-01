#!/usr/bin/env node
/**
 * Scheme B Backup Verification Tool (P0/G0)
 *
 * Verifies PostgreSQL custom dump archives (pg_dump -Fc), Storage Object Manifests,
 * and post-freeze deletion tombstone replays per docs/2026-10-10-integrated-upgrade-plan.md §7.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const PG_DUMP_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4d, 0x50]); // 'PGDMP'
const MIN_PG_DUMP_HEADER_BYTES = 12;
const ISO_UTC_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3})?Z$/;
const HEX_SHA256_REGEX = /^[a-f0-9]{64}$/;
const ALLOWED_BUCKETS = new Set(['saga', 'audio-recordings']);
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;
const MAX_OBJECT_ID_LENGTH = 128;
const MAX_STORAGE_KEY_LENGTH = 512;
const MAX_MANIFEST_OBJECTS = 100_000;
const MAX_TOMBSTONES = 50_000;

function validateIsoUtcTimestamp(timestamp) {
  if (typeof timestamp !== 'string' || !ISO_UTC_REGEX.test(timestamp)) {
    throw new Error('INVALID_ISO_UTC_TIMESTAMP');
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_ISO_UTC_TIMESTAMP');
  }
  const [datePart] = timestamp.split('T');
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('INVALID_CALENDAR_DATE');
  }
  return timestamp;
}

function verifyPgDumpCustomArchiveBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('INVALID_DUMP_BUFFER');
  }
  if (buffer.length < MIN_PG_DUMP_HEADER_BYTES) {
    throw new Error('DUMP_BUFFER_TOO_SMALL');
  }
  if (!buffer.subarray(0, 5).equals(PG_DUMP_MAGIC)) {
    throw new Error('INVALID_PG_DUMP_MAGIC_HEADER');
  }
  const dumpSha256 = createHash('sha256').update(buffer).digest('hex');
  return {
    valid: true,
    magic: 'PGDMP',
    dumpSizeBytes: buffer.length,
    dumpSha256,
  };
}

function verifyStorageManifestObject(manifest, expectedDumpSha256) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('INVALID_STORAGE_MANIFEST');
  }
  if (!expectedDumpSha256 || typeof expectedDumpSha256 !== 'string' || !HEX_SHA256_REGEX.test(expectedDumpSha256)) {
    throw new Error('INVALID_EXPECTED_DUMP_SHA256');
  }
  validateIsoUtcTimestamp(manifest.freezeTimestamp);

  if (typeof manifest.dumpSha256 !== 'string' || !HEX_SHA256_REGEX.test(manifest.dumpSha256)) {
    throw new Error('INVALID_DUMP_SHA256_FORMAT');
  }
  if (manifest.dumpSha256 !== expectedDumpSha256) {
    throw new Error('DUMP_HASH_MANIFEST_MISMATCH');
  }

  if (
    typeof manifest.dumpSizeBytes !== 'number' ||
    !Number.isSafeInteger(manifest.dumpSizeBytes) ||
    manifest.dumpSizeBytes <= 0
  ) {
    throw new Error('INVALID_DUMP_SIZE');
  }

  if (!Array.isArray(manifest.objects)) {
    throw new Error('INVALID_OBJECTS_LIST');
  }
  if (manifest.objects.length > MAX_MANIFEST_OBJECTS) {
    throw new Error('STORAGE_MANIFEST_TOO_LARGE');
  }

  const seenKeys = new Set();
  let totalBytes = 0;

  for (const obj of manifest.objects) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('INVALID_STORAGE_OBJECT_ENTRY');
    }
    if (
      typeof obj.id !== 'string' ||
      obj.id.trim().length === 0 ||
      obj.id.length > MAX_OBJECT_ID_LENGTH ||
      CONTROL_CHAR_REGEX.test(obj.id) ||
      obj.id.includes('..')
    ) {
      throw new Error('INVALID_OBJECT_ID');
    }
    if (typeof obj.bucket !== 'string' || !ALLOWED_BUCKETS.has(obj.bucket)) {
      throw new Error('DISALLOWED_BUCKET_NAME');
    }
    if (
      typeof obj.key !== 'string' ||
      obj.key.trim().length === 0 ||
      obj.key.length > MAX_STORAGE_KEY_LENGTH ||
      CONTROL_CHAR_REGEX.test(obj.key) ||
      obj.key.includes('..') ||
      obj.key.includes('\\') ||
      obj.key.startsWith('/') ||
      obj.key.startsWith('./')
    ) {
      throw new Error('INVALID_STORAGE_KEY');
    }

    const compositeKey = `${obj.bucket}::${obj.key}`;
    if (seenKeys.has(compositeKey)) {
      throw new Error('DUPLICATE_STORAGE_OBJECT_KEY');
    }
    seenKeys.add(compositeKey);

    if (
      typeof obj.byteSize !== 'number' ||
      !Number.isSafeInteger(obj.byteSize) ||
      obj.byteSize <= 0
    ) {
      throw new Error('INVALID_OBJECT_SIZE');
    }
    totalBytes += obj.byteSize;
    if (!Number.isSafeInteger(totalBytes)) {
      throw new Error('TOTAL_BYTES_OVERFLOW');
    }

    if (typeof obj.sha256 !== 'string' || !HEX_SHA256_REGEX.test(obj.sha256)) {
      throw new Error('INVALID_SHA256_FORMAT');
    }
  }

  return {
    valid: true,
    objectCount: manifest.objects.length,
    totalBytes,
  };
}

function replayTombstones(manifest, tombstones) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.objects)) {
    throw new Error('INVALID_STORAGE_MANIFEST');
  }
  if (!Array.isArray(tombstones)) {
    throw new Error('INVALID_TOMBSTONES_LIST');
  }
  if (tombstones.length > MAX_TOMBSTONES) {
    throw new Error('TOMBSTONES_LIST_TOO_LARGE');
  }
  const freezeMs = new Date(validateIsoUtcTimestamp(manifest.freezeTimestamp)).getTime();

  const activePostFreezeTombstones = [];
  for (const t of tombstones) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('INVALID_TOMBSTONE_ENTRY');
    }
    const tMs = new Date(validateIsoUtcTimestamp(t.tombstonedAt)).getTime();
    if (tMs >= freezeMs) {
      activePostFreezeTombstones.push(t);
    }
  }

  const tombstonedObjectIds = new Set();
  const tombstonedCompositeKeys = new Set();

  for (const t of activePostFreezeTombstones) {
    if (typeof t.storageObjectId === 'string' && t.storageObjectId.trim().length > 0) {
      tombstonedObjectIds.add(t.storageObjectId);
    }
    if (t.targetType === 'storage_object' && typeof t.targetId === 'string' && t.targetId.trim().length > 0) {
      tombstonedObjectIds.add(t.targetId);
    }
    if (
      typeof t.bucket === 'string' &&
      typeof t.key === 'string' &&
      t.bucket.trim().length > 0 &&
      t.key.trim().length > 0
    ) {
      tombstonedCompositeKeys.add(`${t.bucket}::${t.key}`);
    }
  }

  const survivingObjects = [];
  let purgedCount = 0;
  let survivingTotalBytes = 0;

  for (const obj of manifest.objects) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('INVALID_STORAGE_OBJECT_ENTRY');
    }
    const compositeKey = `${obj.bucket}::${obj.key}`;
    const isTombstoned =
      tombstonedObjectIds.has(obj.id) || tombstonedCompositeKeys.has(compositeKey);

    if (isTombstoned) {
      purgedCount += 1;
    } else {
      if (
        typeof obj.byteSize !== 'number' ||
        !Number.isSafeInteger(obj.byteSize) ||
        obj.byteSize <= 0
      ) {
        throw new Error('INVALID_OBJECT_SIZE');
      }
      survivingObjects.push(obj);
      survivingTotalBytes += obj.byteSize;
      if (!Number.isSafeInteger(survivingTotalBytes)) {
        throw new Error('TOTAL_BYTES_OVERFLOW');
      }
    }
  }

  return {
    purgedCount,
    survivingObjects,
    survivingTotalBytes,
  };
}

function runSchemeBVerification(params = {}) {
  const { dumpBuffer, manifest, tombstones } = params;

  let dumpInfo;
  if (dumpBuffer) {
    dumpInfo = verifyPgDumpCustomArchiveBuffer(dumpBuffer);
  }

  let manifestInfo;
  if (manifest) {
    manifestInfo = verifyStorageManifestObject(manifest, dumpInfo ? dumpInfo.dumpSha256 : null);
  }

  let replayInfo;
  if (manifest) {
    replayInfo = replayTombstones(manifest, tombstones || []);
  }

  return {
    verified: Boolean(dumpInfo && manifestInfo),
    dump: dumpInfo || null,
    manifest: manifestInfo || null,
    tombstoneReplay: replayInfo || null,
  };
}

function main() {
  const args = process.argv.slice(2);
  const dumpArgIdx = args.indexOf('--dump');
  const manifestArgIdx = args.indexOf('--manifest');
  const tombstonesArgIdx = args.indexOf('--tombstones');
  const isDryRun = args.includes('--dry-run') || args.length === 0;

  if (isDryRun) {
    // Protocol self-check with synthetic fixture (12-byte valid header)
    const synthDump = Buffer.concat([
      PG_DUMP_MAGIC,
      Buffer.from([0x01, 0x0f, 0x00, 0x04, 0x08, 0x01, 0x00]), // v1.15.0 + int/offset/format/flags
      Buffer.from('SYNTH_DATA'),
    ]);
    const synthDumpSha = createHash('sha256').update(synthDump).digest('hex');
    const synthManifest = {
      freezeTimestamp: '2026-10-24T08:50:00.000Z',
      dumpSha256: synthDumpSha,
      dumpSizeBytes: synthDump.length,
      objects: [
        {
          id: 'synth-1',
          bucket: 'saga',
          key: 'projects/alpha/keep.jpg',
          byteSize: 1024,
          sha256: '0'.repeat(64),
        },
      ],
    };
    const report = runSchemeBVerification({
      dumpBuffer: synthDump,
      manifest: synthManifest,
      tombstones: [],
    });
    process.stdout.write(JSON.stringify({ mode: 'dry_run_self_check', status: 'pass', report }, null, 2) + '\n');
    process.exit(0);
  }

  try {
    const dumpPath = dumpArgIdx >= 0 ? args[dumpArgIdx + 1] : null;
    const manifestPath = manifestArgIdx >= 0 ? args[manifestArgIdx + 1] : null;
    const tombstonesPath = tombstonesArgIdx >= 0 ? args[tombstonesArgIdx + 1] : null;

    if (!dumpPath || !manifestPath) {
      throw new Error('Both --dump and --manifest are required for live verification');
    }

    const dumpBuffer = fs.readFileSync(dumpPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const tombstones = tombstonesPath ? JSON.parse(fs.readFileSync(tombstonesPath, 'utf8')) : [];

    const report = runSchemeBVerification({ dumpBuffer, manifest, tombstones });
    process.stdout.write(JSON.stringify({ mode: 'file_verification', status: 'pass', report }, null, 2) + '\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(JSON.stringify({ mode: 'verification_failed', error: err.message }) + '\n');
    process.exit(1);
  }
}

module.exports = {
  verifyPgDumpCustomArchiveBuffer,
  verifyStorageManifestObject,
  replayTombstones,
  runSchemeBVerification,
};

if (require.main === module) {
  main();
}
