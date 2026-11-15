"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimMediaDeletionJob = claimMediaDeletionJob;
exports.startMediaDeletionJob = startMediaDeletionJob;
exports.heartbeatMediaDeletionJob = heartbeatMediaDeletionJob;
exports.checkMediaDeletionJobLease = checkMediaDeletionJobLease;
exports.recoverMediaDeletionJob = recoverMediaDeletionJob;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WORKER = /^[A-Za-z0-9_-]{1,128}$/;
const KEYS = ['schemaVersion', 'requestId', 'projectId', 'subjectId', 'subjectType', 'captureTargetsSha256',
    'targetCount', 'state', 'attempt', 'workerId', 'leaseExpiresAt', 'serverNow', 'canDeleteStorage', 'physicalDeletionComplete'];
const IDENTITY = ['requestId', 'projectId', 'subjectId', 'subjectType', 'captureTargetsSha256', 'targetCount', 'workerId', 'attempt'];
function unavailable() { throw new Error('media_deletion_lease_unavailable'); }
function uuid(value) { return typeof value === 'string' && UUID.test(value); }
function worker(value) { return typeof value === 'string' && WORKER.test(value); }
function duration(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 120000;
}
function exactObject(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Reflect.ownKeys(value).length !== keys.length ||
        keys.some(key => !Object.prototype.hasOwnProperty.call(value, key)))
        unavailable();
    // Read each field once and detach from caller/transport-owned mutable objects.
    return Object.fromEntries(keys.map(key => [key, value[key]]));
}
function utcMicroseconds(value) {
    if (typeof value !== 'string')
        unavailable();
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value);
    if (!match || value.startsWith('0000-'))
        unavailable();
    const milliseconds = Date.parse(`${match[1]}Z`);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== match[1])
        unavailable();
    // Whole-second Date parsing validates the calendar only. BigInt preserves
    // microseconds even for historical/future dates outside safe integer epochs.
    return BigInt(milliseconds) * BigInt(1000) + BigInt((match[2] ?? '').padEnd(6, '0'));
}
function parseReceipt(value) {
    const row = exactObject(value, KEYS);
    if (row.schemaVersion !== 1 || row.canDeleteStorage !== false || row.physicalDeletionComplete !== false ||
        !uuid(row.requestId) || !uuid(row.projectId) || !uuid(row.subjectId) ||
        (row.subjectType !== 'media_asset' && row.subjectType !== 'story') ||
        typeof row.captureTargetsSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.captureTargetsSha256) ||
        !Number.isSafeInteger(row.targetCount) || Number(row.targetCount) < 1 ||
        !Number.isSafeInteger(row.attempt) || Number(row.attempt) < 1 || Number(row.attempt) > 3)
        unavailable();
    const now = utcMicroseconds(row.serverNow);
    if (row.state === 'leased' || row.state === 'running') {
        if (!worker(row.workerId))
            unavailable();
        const ttl = utcMicroseconds(row.leaseExpiresAt) - now;
        if (ttl <= BigInt(0) || ttl > BigInt(120000000))
            unavailable();
    }
    else if ((row.state !== 'retry_wait' && row.state !== 'failed' && row.state !== 'outcome_unknown') ||
        (row.state === 'failed' && row.attempt !== 3) || (row.state === 'retry_wait' && row.attempt === 3) ||
        row.workerId !== null || row.leaseExpiresAt !== null)
        unavailable();
    return Object.freeze(row);
}
function pinLease(value) {
    const row = exactObject(value, [...KEYS, 'deadline']);
    const { deadline, ...fields } = row;
    const receipt = parseReceipt(fields);
    if ((receipt.state !== 'leased' && receipt.state !== 'running') || typeof deadline !== 'number' ||
        !Number.isFinite(deadline) || deadline <= performance.now())
        unavailable();
    return Object.freeze({ ...receipt, deadline });
}
async function request(requestId, action, workerId, attempt, leaseMs, options, expected) {
    const started = performance.now();
    if (typeof window !== 'undefined' || !uuid(requestId) ||
        (action !== 'recover' && !worker(workerId)) ||
        ((action === 'claim' || action === 'heartbeat') && !duration(leaseMs)))
        unavailable();
    // Options are also pinned: mutating an options object cannot replace the
    // original caller's cancellation signal while a transport is outstanding.
    const { admin, signal, timeoutMs = 5000 } = options;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || signal?.aborted)
        unavailable();
    const stopAt = Math.min(started + timeoutMs, expected?.deadline ?? Infinity);
    if (stopAt <= started)
        unavailable();
    const controller = new AbortController();
    const abort = () => controller.abort();
    let rejectAbort = () => { };
    const interrupted = new Promise((_, reject) => {
        rejectAbort = () => reject(new Error('media_deletion_lease_unavailable'));
        controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, Math.max(0, stopAt - performance.now()));
    try {
        const query = admin.rpc('media_deletion_job_lease', {
            p_request_id: requestId, p_action: action, p_worker_id: workerId, p_attempt: attempt, p_lease_ms: leaseMs,
        }).abortSignal(controller.signal).retry(false);
        const result = await Promise.race([query, interrupted]);
        if (controller.signal.aborted || signal?.aborted || performance.now() >= stopAt || !result || result.error)
            unavailable();
        const receipt = parseReceipt(result.data);
        if (receipt.requestId !== requestId || (expected && IDENTITY.some(key => receipt[key] !== expected[key])))
            unavailable();
        if (action === 'recover') {
            if (receipt.state === 'leased' || receipt.state === 'running' ||
                performance.now() >= stopAt || signal?.aborted)
                unavailable();
            return receipt;
        }
        if ((receipt.state !== 'leased' && receipt.state !== 'running') || receipt.workerId !== workerId ||
            (attempt !== null && receipt.attempt !== attempt) ||
            (action === 'claim' && receipt.state !== 'leased') ||
            ((action === 'start' || action === 'heartbeat') && receipt.state !== 'running') ||
            (action === 'check' && expected?.state === 'running' && receipt.state !== 'running'))
            unavailable();
        const expiry = utcMicroseconds(receipt.leaseExpiresAt);
        const ttl = expiry - utcMicroseconds(receipt.serverNow);
        if ((action === 'claim' && ttl > BigInt(leaseMs) * BigInt(1000)) ||
            (action === 'heartbeat' && expiry < utcMicroseconds(expected.leaseExpiresAt)))
            unavailable();
        // Start before transport/lock waits. Observation/start cannot extend the
        // caller's previous local deadline; only a heartbeat may renew it.
        const deadline = Math.min(started + Number(ttl) / 1000, action === 'heartbeat' ? Infinity : expected?.deadline ?? Infinity);
        if (deadline <= performance.now() || performance.now() >= stopAt || signal?.aborted)
            unavailable();
        return Object.freeze({ ...receipt, deadline });
    }
    catch {
        return unavailable();
    }
    finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        controller.signal.removeEventListener('abort', rejectAbort);
        controller.abort();
    }
}
async function claimMediaDeletionJob(requestId, workerId, leaseMs, options) {
    try {
        return await request(requestId, 'claim', workerId, null, leaseMs, options);
    }
    catch {
        unavailable();
    }
}
async function activeRequest(lease, action, leaseMs, options) {
    try {
        const pinned = pinLease(lease);
        if (action === 'heartbeat' && pinned.state !== 'running')
            unavailable();
        return await request(pinned.requestId, action, pinned.workerId, pinned.attempt, leaseMs, options, pinned);
    }
    catch {
        unavailable();
    }
}
async function startMediaDeletionJob(lease, options) {
    return activeRequest(lease, 'start', null, options);
}
async function heartbeatMediaDeletionJob(lease, leaseMs, options) {
    return activeRequest(lease, 'heartbeat', leaseMs, options);
}
async function checkMediaDeletionJobLease(lease, options) {
    return activeRequest(lease, 'check', null, options);
}
async function recoverMediaDeletionJob(requestId, options) {
    try {
        return await request(requestId, 'recover', null, null, null, options);
    }
    catch {
        unavailable();
    }
}
