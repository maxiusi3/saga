import { constants } from 'node:fs';
import { lstat, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { finished } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire(import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const referencePattern = /^local-recording:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

async function privateDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) {
    throw new Error('Recording directory must be owned, private and not a symlink');
  }
}

function deadline(signal, milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Recording I/O timed out')), milliseconds);
  return { signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, timedOut: () => controller.signal.aborted, close: () => clearTimeout(timer) };
}

// Only regular private files are read. O_NONBLOCK also prevents an injected FIFO
// from hanging open before fstat can reject it. Same-user directory replacement
// races and non-preemptible kernel filesystem calls are outside this local PoC.
async function* readRegular(path, expectedBytes, maxBytes, signal, onPart = async () => {}, ProcessingError) {
  signal?.throwIfAborted();
  const failure = (code, message) => ProcessingError ? new ProcessingError(code, message) : new Error(message);
  // Only errors raised by filesystem operations are mapped, never checkpoint errors.
  const sourceOperation = async action => {
    try { return await action(); } catch (error) {
      signal?.throwIfAborted();
      if (!ProcessingError) throw error;
      if (error.code === 'ENOENT') throw failure('recording_source_missing', error.message);
      if (['ELOOP', 'EMLINK', 'ENOTDIR'].includes(error.code)) throw failure('recording_source_not_private_file', error.message);
      if (['EAGAIN', 'EINTR', 'EBUSY', 'ETIMEDOUT'].includes(error.code)) throw failure('recording_source_read_temporary', error.message);
      throw error;
    }
  };
  const handle = await sourceOperation(() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK));
  let stream;
  try {
    signal?.throwIfAborted();
    const stat = await sourceOperation(() => handle.stat());
    signal?.throwIfAborted();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.nlink !== 1) {
      throw failure('recording_source_not_private_file', 'Recording source must be a private regular file');
    }
    if (stat.size > maxBytes || (expectedBytes !== undefined && stat.size !== expectedBytes)) throw failure('recording_source_size_mismatch', 'Recording file size does not match its bound');
    stream = handle.createReadStream({ autoClose: true, highWaterMark: 64 * 1024, signal });
    // Attach before any injected checkpoint to avoid an unobserved stream error.
    const closed = finished(stream, { cleanup: true }).catch(error => error);
    let readError;
    try {
      let size = 0;
      const iterator = stream[Symbol.asyncIterator]();
      while (true) {
        const frame = await sourceOperation(async () => {
          try { return await iterator.next(); } catch (error) { readError = error; throw error; }
        });
        if (frame.done) break;
        const part = frame.value;
        signal?.throwIfAborted();
        size += part.length;
        if (size > maxBytes || (expectedBytes !== undefined && size > expectedBytes)) throw failure('recording_source_size_mismatch', 'Recording read exceeds its byte limit');
        await onPart(size, signal);
        signal?.throwIfAborted();
        yield part;
      }
      if (expectedBytes !== undefined && size !== expectedBytes) throw failure('recording_source_size_mismatch', 'Recording read size changed');
    } finally {
      const destroyedHere = !stream.destroyed;
      stream.destroy();
      const closingError = await closed;
      if (closingError && closingError !== readError && closingError.code !== 'ABORT_ERR' &&
          !(destroyedHere && closingError.code === 'ERR_STREAM_PREMATURE_CLOSE')) {
        throw new Error('Recording source cleanup failed', { cause: closingError });
      }
    }
  } finally {
    // Do not hide a close failure behind a known read failure.
    try { await handle.close(); } catch (error) { throw new Error('Recording source cleanup failed', { cause: error }); }
  }
}

/** Explicit local configuration only. No source/output path is accepted in a task. */
export async function createLocalRecordingMerge(config, scratch) {
  if (!config || config.root !== join(scratch, 'recording') || config.helpersDirectory !== join(scratch, 'helpers') ||
      typeof config.executable !== 'string' || !isAbsolute(config.executable)) {
    throw new Error('Recording adapter requires explicit paths within its private PoC directory and local FFmpeg');
  }
  const { root, helpersDirectory, executable, maxInputBytes, maxChunks, ioTimeoutMs, decodeTimeoutMs, maxDurationMs } = config;
  for (const [key, value] of Object.entries({ maxInputBytes, maxChunks, ioTimeoutMs, decodeTimeoutMs, maxDurationMs })) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) throw new Error(`Invalid recording ${key}`);
  }
  const roots = [scratch, helpersDirectory, root, join(root, 'sources'), join(root, 'outputs'), join(root, 'temp')];
  const checkRoots = async () => { for (const path of roots) await privateDirectory(path); };
  await checkRoots();
  const binary = await lstat(executable);
  if (!binary.isFile() || binary.isSymbolicLink() || !(binary.mode & 0o111)) throw new Error('FFmpeg must be an explicit executable regular local file');
  const { buildRecordingMergeTaskInput, verifyRecordingMergeCompletion } = require(join(helpersDirectory, 'recording-merge.js'));
  const { withVerifiedRecordingMerge } = require(join(helpersDirectory, 'recording-merge-executor.js'));
  const { RecordingProcessingError, isRecordingProcessingError } = require(join(helpersDirectory, 'recording-processing-error.js'));
  const { createFfmpegRecordingDecoder } = require(join(helpersDirectory, 'recording-audio-decoder.js'));
  const decode = createFfmpegRecordingDecoder({ executable, timeoutMs: decodeTimeoutMs, maxDurationMs });

  function freeze(id, task) {
    if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 512) throw new Error('Invalid recording job id');
    if (!task || !Array.isArray(task.chunks) || task.chunks.length > maxChunks) throw new Error('Recording chunk limit exceeded');
    const rebuilt = buildRecordingMergeTaskInput(task);
    if (!isDeepStrictEqual(rebuilt, task)) throw new Error('Recording input does not match its manifest');
    if (!Number.isSafeInteger(task.totalInputBytes) || task.totalInputBytes > maxInputBytes) throw new Error('Recording input exceeds the byte limit');
    const serialized = JSON.stringify([id, rebuilt]);
    if (Buffer.byteLength(serialized) > 1_048_576) throw new Error('Recording manifest exceeds its size limit');
    return { jobId: id, task: rebuilt, digest: sha(serialized) };
  }

  function assertBinding(row, expectedDigest) {
    if (!row?.frozen_input) throw new Error('Recording frozen input is missing');
    const frozen = freeze(row.id, row.frozen_input.task);
    if (!isDeepStrictEqual(frozen, row.frozen_input) || (expectedDigest !== undefined && frozen.digest !== expectedDigest)) {
      throw new Error('Recording frozen input changed');
    }
    const snapshot = row.snapshot;
    const identity = { id: row.id, projectId: frozen.task.projectId, sessionId: frozen.task.sessionId,
      assetId: frozen.task.assetId, inputVersion: frozen.task.inputVersion, jobType: 'recording_merge',
      processorVersion: frozen.task.processorVersion, parameterVersion: frozen.task.parameterVersion,
      modelConfigVersion: 'none', idempotencyKey: frozen.task.idempotencyKey };
    for (const [field, value] of Object.entries(identity)) if (snapshot[field] !== value) throw new Error(`Recording identity changed: ${field}`);
    if (row.review || snapshot.state === 'awaiting_review') throw new Error('Real recording merge does not support synthetic review');
    return frozen;
  }

  function sourceName(task, chunk) {
    // Full versioned task plus complete chunk identity; user IDs never form paths.
    return `chunk-${sha(JSON.stringify([task.idempotencyKey, chunk.index, chunk.chunkId, chunk.bucket, chunk.objectKey, chunk.byteSize, chunk.sha256]))}.bin`;
  }
  function outputName(ref) {
    const match = referencePattern.exec(ref);
    if (!match) throw new Error('Invalid private recording reference');
    return `result-${match[1]}.audio`;
  }
  function checkMetadata(prepared, frozen) {
    const m = prepared.metadata;
    outputName(prepared.ref);
    if (!m || m.schema !== 1 || m.jobId !== frozen.jobId || m.bindingDigest !== frozen.digest ||
        m.mimeType !== frozen.task.mimeType || m.byteSize !== frozen.task.totalInputBytes ||
        !Number.isSafeInteger(m.byteSize) || m.byteSize <= 0 || m.byteSize > maxInputBytes ||
        !Number.isSafeInteger(m.durationMs) || m.durationMs <= 0 || m.durationMs > maxDurationMs ||
        !/^[a-f0-9]{64}$/.test(m.sha256)) throw new Error('Recording artifact metadata does not match its input');
  }
  async function readOutput(prepared, frozen, { signal, collect = false } = {}) {
    checkMetadata(prepared, frozen);
    const bounded = deadline(signal, ioTimeoutMs);
    try {
      await checkRoots();
      bounded.signal.throwIfAborted();
      const hash = createHash('sha256');
      const parts = [];
      for await (const part of readRegular(join(root, 'outputs', outputName(prepared.ref)), prepared.metadata.byteSize, maxInputBytes, bounded.signal)) {
        hash.update(part);
        if (collect) parts.push(Buffer.from(part));
      }
      bounded.signal.throwIfAborted();
      if (hash.digest('hex') !== prepared.metadata.sha256) throw new Error('Recording output SHA256 does not match');
      return collect ? Buffer.concat(parts) : undefined;
    } finally { bounded.close(); }
  }

  async function prepare(frozen, { ref, signal, checkpoint = async () => {} } = {}) {
    outputName(ref);
    if (!isDeepStrictEqual(freeze(frozen.jobId, frozen.task), frozen)) throw new Error('Recording frozen input changed');
    await checkRoots();
    signal?.throwIfAborted();
    return withVerifiedRecordingMerge(frozen.task, {
      maxInputBytes, tempRoot: join(root, 'temp'), signal,
      readChunk: async (chunk, readSignal) => (async function* () {
        const bounded = deadline(readSignal, ioTimeoutMs);
        try {
          await checkRoots();
          yield* readRegular(join(root, 'sources', sourceName(frozen.task, chunk)), chunk.byteSize, maxInputBytes, bounded.signal,
            async (bytesRead, partSignal) => checkpoint('merge_read', { index: chunk.index, bytesRead }, partSignal), RecordingProcessingError);
        } catch (error) {
          readSignal?.throwIfAborted();
          // Only our own timer may make a timeout retryable. Resource cleanup
          // errors override cancellation, so they cannot become retryable here.
          if (bounded.timedOut() && (error === bounded.signal.reason || (error.name === 'AbortError' && error.code === 'ABORT_ERR' && error.cause === bounded.signal.reason))) {
            throw new RecordingProcessingError('recording_source_read_timeout', 'Recording I/O timed out');
          }
          throw error;
        } finally { bounded.close(); }
      })(),
      decodeAudio: async (path, mime, decodeSignal) => {
        await checkpoint('merge_decode', {}, decodeSignal);
        decodeSignal?.throwIfAborted();
        const result = await decode(path, mime, decodeSignal);
        decodeSignal?.throwIfAborted();
        await checkpoint('merge_decoded', { durationMs: result.durationMs }, decodeSignal);
        return result;
      },
    }, async artifact => {
      verifyRecordingMergeCompletion(frozen.task, artifact.completion);
      const destination = join(root, 'outputs', outputName(ref));
      const bounded = deadline(signal, ioTimeoutMs);
      let handle;
      let created = false;
      try {
        await checkRoots();
        bounded.signal.throwIfAborted();
        await checkpoint('merge_output_create', { ref }, bounded.signal);
        bounded.signal.throwIfAborted();
        handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        created = true;
        bounded.signal.throwIfAborted();
        for await (const part of readRegular(artifact.filePath, artifact.completion.outputByteSize, maxInputBytes, bounded.signal)) {
          for (let offset = 0; offset < part.length;) {
            const { bytesWritten } = await handle.write(part, offset, part.length - offset);
            bounded.signal.throwIfAborted();
            if (!bytesWritten) throw new Error('Recording output write made no progress');
            offset += bytesWritten;
          }
        }
        await handle.sync();
        bounded.signal.throwIfAborted();
        await handle.close();
        handle = undefined;
        const directory = await open(join(root, 'outputs'), constants.O_RDONLY | constants.O_NOFOLLOW);
        try { await directory.sync(); } finally { await directory.close(); }
        bounded.signal.throwIfAborted();
        const prepared = { ref, metadata: { schema: 1, jobId: frozen.jobId, bindingDigest: frozen.digest,
          mimeType: artifact.mimeType, byteSize: artifact.completion.outputByteSize,
          sha256: artifact.completion.outputSha256, durationMs: artifact.completion.durationMs } };
        await readOutput(prepared, frozen, { signal: bounded.signal });
        bounded.signal.throwIfAborted();
        return prepared;
      } catch (error) {
        const cleanup = await Promise.allSettled([handle?.close(), created ? unlink(destination) : undefined]);
        if (cleanup.some(result => result.status === 'rejected')) throw new Error('Recording output cleanup failed');
        throw error;
      } finally { bounded.close(); }
    });
  }
  return { freeze, assertBinding, checkMetadata, prepare, readOutput, sourceName, outputName, isProcessingError: isRecordingProcessingError, buildInput: buildRecordingMergeTaskInput };
}
