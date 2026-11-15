import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { validateRecordingSaveIdentity, validateRecordingSaveMetadata, validateRecordingSaveLookup, validateRecordingSaveReceipt, type RecordingSaveIdentity, type RecordingSaveMetadata, type RecordingSaveLookup, type RecordingSaveReceipt } from './recording-save-contract'
import { recordingBlobSha256 } from './recording-save-validation'

export type RecorderSessionState = 'recording' | 'interrupted' | 'confirmed'
export type RecorderChunkUploadStatus = 'pending' | 'uploaded'

export interface RecorderSessionRecord {
    id: string
    projectId: string
    userId: string
    mimeType: string
    startedAt: string
    state: RecorderSessionState
    lastPersistedIndex: number
    cloudConfirmedAssetId: string | null
    updatedAt: number
    saveIntent?: RecorderSaveIntent
}

export interface RecorderChunkRecord {
    id: string
    sessionId: string
    index: number
    blob: Blob
    byteSize: number
    sha256: string | null
    persistedAt: string
    uploadStatus: RecorderChunkUploadStatus
    timestamp: number
}

export interface RecorderSaveIntent {
    metadata: RecordingSaveMetadata
    chunkIdentity: string
    remote: RecordingSaveLookup['intent']
    confirmation: RecordingSaveReceipt | null
}
export interface RecorderSaveSnapshot { session: RecorderSessionRecord; chunks: RecorderChunkRecord[] }

function chunkIdentity(session: RecorderSessionRecord, chunks: RecorderChunkRecord[]) {
    return JSON.stringify([session.id, session.projectId, session.userId, session.mimeType, session.startedAt, session.lastPersistedIndex,
        chunks.map(c => [c.id, c.sessionId, c.index, c.byteSize, c.sha256, c.persistedAt, c.timestamp])])
}
function sameMetadata(a: RecordingSaveMetadata, b: RecordingSaveMetadata) {
    return Object.keys(a).every(key => a[key as keyof typeof a] === b[key as keyof typeof b])
}

/** Full byte scans protect freeze, final confirmation and cleanup. Intermediate checks use
 * readonly transactions and hash at most the selected upload chunk; metadata always stays pinned.
 * Pending IDB reads keep hashing continuations inside an active transaction (no network awaits).
 */
async function saveTransaction<T>(identity: RecordingSaveIdentity, isCurrent: () => boolean,
    action: (snapshot: RecorderSaveSnapshot, stores: {
        put(session: RecorderSessionRecord): Promise<unknown>; remove(chunks: RecorderChunkRecord[]): Promise<void>
    }) => Promise<T>, verification: 'all' | 'metadata' | number = 'all', mode: 'readonly' | 'readwrite' = 'readwrite') {
    validateRecordingSaveIdentity(identity)
    if (typeof verification === 'number' && (!Number.isSafeInteger(verification) || verification < 0 || verification >= 2000)) {
        throw new Error('recording_local_damaged')
    }
    const db = await getDB()
    const tx = db.transaction(['sessions', 'chunks'], mode)
    const hashInTransaction = async (blob: Blob) => {
        let complete = false, hash = '', failure: unknown
        void recordingBlobSha256(blob).then(value => { hash = value; complete = true }, error => { failure = error; complete = true })
        const deadline = Date.now() + 15000
        // Resume only inside an IDB request callback: a WebCrypto callback cannot write to an inactive transaction.
        do {
            await tx.objectStore('sessions').get(identity.sessionId)
            if (!isCurrent() || Date.now() > deadline) throw new Error('recording_scope_changed')
        } while (!complete)
        if (failure) throw failure
        return hash
    }
    return commitRecorderWrite(tx, async () => {
            const current = () => { if (!isCurrent()) throw new Error('recording_scope_changed') }
            current()
            const session = await tx.objectStore('sessions').get(identity.sessionId)
            if (!session || session.projectId !== identity.projectId || session.userId !== identity.actorId ||
                !['recording','interrupted','confirmed'].includes(session.state)) throw new Error('recording_local_changed')
            const chunks = (await tx.objectStore('chunks').index('by-session').getAll(identity.sessionId)).sort((a,b) => a.index-b.index)
            if (!chunks.length || chunks.length > 2000 || chunks.length !== session.lastPersistedIndex+1 ||
                !/^audio\/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$/.test(session.mimeType)) throw new Error('recording_local_damaged')
            if (typeof verification === 'number' && verification >= chunks.length) throw new Error('recording_local_damaged')
            let bytes = 0
            for (const [index, chunk] of chunks.entries()) {
                current()
                if (chunk.id !== `${session.id}-${index}` || chunk.index !== index || chunk.sessionId !== session.id ||
                    !Number.isSafeInteger(chunk.byteSize) || chunk.byteSize <= 0 || chunk.blob?.size !== chunk.byteSize ||
                    typeof chunk.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(chunk.sha256) ||
                    ((verification === 'all' || verification === index) && await hashInTransaction(chunk.blob) !== chunk.sha256)) throw new Error('recording_local_damaged')
                bytes += chunk.byteSize
            }
            if (bytes > 104857600) throw new Error('recording_local_damaged')
            current()
            if (session.saveIntent) {
                validateRecordingSaveMetadata(session.saveIntent.metadata)
                if (session.saveIntent.chunkIdentity !== chunkIdentity(session,chunks)) throw new Error('recording_local_changed')
                const remote = session.saveIntent.remote
                validateRecordingSaveLookup({schemaVersion:1,...identity,intent:remote,canClearLocalDrafts:false},identity)
                if (remote && !sameMetadata(remote.metadata,session.saveIntent.metadata)) throw new Error('recording_local_changed')
                if (session.saveIntent.confirmation) {
                    if (!remote?.assetId || !remote.manifestSha256) throw new Error('recording_local_changed')
                    validateRecordingSaveReceipt(session.saveIntent.confirmation,{...identity,storyId:remote.storyId,assetId:remote.assetId,manifestSha256:remote.manifestSha256})
                }
            }
            return await action({session,chunks}, {
                put: async value => {
                    current()
                    const store = tx.objectStore('sessions')
                    if (!store.put) throw new Error('recording_readonly')
                    await store.put(value)
                    current()
                },
                remove: async rows => {
                    const chunksStore = tx.objectStore('chunks'), sessionsStore = tx.objectStore('sessions')
                    if (!chunksStore.delete || !sessionsStore.delete) throw new Error('recording_readonly')
                    for (const chunk of rows) { current(); await chunksStore.delete(chunk.id) }
                    current(); await sessionsStore.delete(identity.sessionId); current()
                },
            })
    })
}

interface RecorderDB extends DBSchema {
    sessions: {
        key: string
        value: RecorderSessionRecord
        indexes: { 'by-project': string; 'by-user': string; 'by-state': RecorderSessionState }
    }
    chunks: {
        key: string
        value: RecorderChunkRecord
        indexes: { 'by-session': string }
    }
}

const DB_NAME = 'saga-recorder-db'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<RecorderDB>> | null = null

function getDB() {
    if (!dbPromise) {
        const forgetConnection = () => {
            // Late events from an old handle must not evict its replacement.
            if (dbPromise === opening) dbPromise = null
        }
        const opening = openDB<RecorderDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('chunks')) {
                    const store = db.createObjectStore('chunks', { keyPath: 'id' })
                    store.createIndex('by-session', 'sessionId')
                }
                if (!db.objectStoreNames.contains('sessions')) {
                    const store = db.createObjectStore('sessions', { keyPath: 'id' })
                    store.createIndex('by-project', 'projectId')
                    store.createIndex('by-user', 'userId')
                    store.createIndex('by-state', 'state')
                }
            },
            blocking(_currentVersion, _blockedVersion, event) {
                (event.target as IDBDatabase).close()
                forgetConnection()
            },
            terminated: forgetConnection,
        })
        dbPromise = opening
        // Reject this operation as-is; only a later explicit call opens again.
        void opening.catch(forgetConnection)
    }
    return dbPromise
}

async function commitRecorderWrite<T>(
    tx: { done: Promise<void>; abort(): void },
    write: () => Promise<T>,
): Promise<T> {
    // Observe aborts immediately, even when an earlier request rejects first.
    const completion = tx.done.then(
        () => ({ ok: true as const }),
        error => ({ ok: false as const, error }),
    )
    try {
        const result = await write()
        const status = await completion
        if (!status.ok) throw status.error
        return result
    } catch (error) {
        // Synchronous put errors do not automatically roll back earlier requests.
        try { tx.abort() } catch { /* The transaction may already have ended. */ }
        await completion
        throw error
    }
}

export const recorderDB = {
    async prepareSave(identity: RecordingSaveIdentity, metadata: RecordingSaveMetadata | undefined, isCurrent: () => boolean) {
        return saveTransaction(identity,isCurrent,async (snapshot,stores) => {
            if (!snapshot.session.saveIntent) {
                validateRecordingSaveMetadata(metadata)
                if (snapshot.session.state === 'confirmed' || snapshot.session.cloudConfirmedAssetId !== null) throw new Error('recording_local_changed')
                snapshot.session = {...snapshot.session,state:'interrupted',updatedAt:Date.now(),saveIntent:{metadata:{...metadata},
                    chunkIdentity:chunkIdentity(snapshot.session,snapshot.chunks),remote:null,confirmation:null}}
                await stores.put(snapshot.session)
            } else if (metadata && !sameMetadata(metadata,snapshot.session.saveIntent.metadata)) throw new Error('recording_metadata_changed')
            return snapshot
        })
    },
    async readSave(identity: RecordingSaveIdentity, isCurrent: () => boolean) {
        return saveTransaction(identity,isCurrent,async snapshot => {
            if (!snapshot.session.saveIntent) throw new Error('recording_intent_missing')
            return snapshot
        },'all','readonly')
    },
    /** Read only metadata between network calls, optionally hashing the next chunk to upload. */
    async readSaveState(identity: RecordingSaveIdentity, isCurrent: () => boolean, chunkIndex?: number) {
        return saveTransaction(identity,isCurrent,async snapshot => {
            if (!snapshot.session.saveIntent) throw new Error('recording_intent_missing')
            return snapshot
        },chunkIndex ?? 'metadata','readonly')
    },
    async recordSaveLookup(identity: RecordingSaveIdentity, lookup: RecordingSaveLookup, isCurrent: () => boolean) {
        const validated = validateRecordingSaveLookup(lookup,identity)
        return saveTransaction(identity,isCurrent,async (snapshot,stores) => {
            const intent = snapshot.session.saveIntent
            if (!intent || !validated.intent || !sameMetadata(intent.metadata,validated.intent.metadata)) throw new Error('recording_metadata_changed')
            const previous = intent.remote
            if (previous && (previous.storyId !== validated.intent.storyId ||
                (previous.assetId && previous.assetId !== validated.intent.assetId) ||
                (previous.manifestSha256 && previous.manifestSha256 !== validated.intent.manifestSha256))) throw new Error('recording_remote_changed')
            snapshot.session = {...snapshot.session,saveIntent:{...intent,remote:validated.intent}}
            await stores.put(snapshot.session)
            return snapshot
        },'metadata')
    },
    async recordSaveConfirmation(identity: RecordingSaveIdentity, value: RecordingSaveReceipt, isCurrent: () => boolean) {
        return saveTransaction(identity,isCurrent,async (snapshot,stores) => {
            const intent = snapshot.session.saveIntent, remote = intent?.remote
            if (!intent || !remote?.assetId || !remote.manifestSha256) throw new Error('recording_intent_missing')
            const receipt = validateRecordingSaveReceipt(value,{...identity,storyId:remote.storyId,assetId:remote.assetId,manifestSha256:remote.manifestSha256})
            snapshot.session = {...snapshot.session,saveIntent:{...intent,confirmation:receipt}}
            await stores.put(snapshot.session)
            return snapshot
        })
    },
    async clearConfirmedSave(identity: RecordingSaveIdentity, value: RecordingSaveReceipt, isCurrent: () => boolean) {
        return saveTransaction(identity,isCurrent,async (snapshot,stores) => {
            const intent = snapshot.session.saveIntent, remote = intent?.remote
            if (!intent?.confirmation || !remote?.assetId || !remote.manifestSha256) throw new Error('recording_confirmation_missing')
            const expected = {...identity,storyId:remote.storyId,assetId:remote.assetId,manifestSha256:remote.manifestSha256}
            validateRecordingSaveReceipt(value,expected)
            validateRecordingSaveReceipt(intent.confirmation,expected)
            await stores.remove(snapshot.chunks)
        })
    },
    async saveSession(session: Omit<RecorderSessionRecord, 'updatedAt'> & { updatedAt?: number }) {
        const db = await getDB()
        const record: RecorderSessionRecord = { ...session, updatedAt: session.updatedAt ?? Date.now() }
        await db.add('sessions', record)
        return record
    },

    async getSession(sessionId: string) {
        const db = await getDB()
        return db.get('sessions', sessionId)
    },

    async updateSession(sessionId: string, patch: Partial<Omit<RecorderSessionRecord, 'id'>>) {
        const db = await getDB()
        // Keep the read/patch atomic with concurrent chunk writes and session cleanup.
        const tx = db.transaction('sessions', 'readwrite')
        return commitRecorderWrite(tx, async () => {
            const current = await tx.store.get(sessionId)
            if (!current) return undefined
            if (current.saveIntent || current.state === 'confirmed') throw new Error('Recording session is frozen')
            const next: RecorderSessionRecord = { ...current, ...patch, id: current.id, updatedAt: Date.now() }
            await tx.store.put(next)
            return next
        })
    },

    async getSessionsByProject(projectId: string) {
        const db = await getDB()
        return db.getAllFromIndex('sessions', 'by-project', projectId)
    },

    async getRecoverableSessions(projectId: string, userId: string) {
        const sessions = (await this.getSessionsByProject(projectId))
            .filter(session => session.userId === userId && (session.state !== 'confirmed' || !!session.saveIntent))
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async saveChunk(sessionId: string, index: number, blob: Blob, metadata?: {
        byteSize?: number
        sha256?: string | null
        persistedAt?: string
        uploadStatus?: RecorderChunkUploadStatus
    }) {
        const db = await getDB()
        const timestamp = Date.now()
        const record: RecorderChunkRecord = {
            id: `${sessionId}-${index}`,
            sessionId,
            index,
            blob,
            byteSize: metadata?.byteSize ?? blob.size,
            sha256: metadata?.sha256 ?? null,
            persistedAt: metadata?.persistedAt ?? new Date(timestamp).toISOString(),
            uploadStatus: metadata?.uploadStatus ?? 'pending',
            timestamp,
        }
        const tx = db.transaction(['chunks', 'sessions'], 'readwrite')
        return commitRecorderWrite(tx, async () => {
            const session = await tx.objectStore('sessions').get(sessionId)
            if (!session || !['recording', 'interrupted'].includes(session.state) || session.cloudConfirmedAssetId !== null || session.saveIntent) {
                throw new Error('Recording session is not writable')
            }
            // A repeated sequence number must never replace already persisted audio.
            await tx.objectStore('chunks').add(record)
            await tx.objectStore('sessions').put({ ...session, lastPersistedIndex: Math.max(session.lastPersistedIndex, index), updatedAt: timestamp })
            return record
        })
    },

    async markChunkUploaded(sessionId: string, index: number) {
        const db = await getDB()
        const id = `${sessionId}-${index}`
        const tx = db.transaction(['sessions','chunks'], 'readwrite')
        return commitRecorderWrite(tx, async () => {
            const session = await tx.objectStore('sessions').get(sessionId)
            if (!session || session.saveIntent) throw new Error('Recording session is frozen')
            const chunk = await tx.objectStore('chunks').get(id)
            if (!chunk) throw new Error('chunk must be persisted before upload')
            const next = { ...chunk, uploadStatus: 'uploaded' as const }
            await tx.objectStore('chunks').put(next)
            return next
        })
    },

    async getChunksBySession(sessionId: string) {
        const db = await getDB()
        const chunks = await db.getAllFromIndex('chunks', 'by-session', sessionId)
        return chunks
            .map(chunk => ({
                ...chunk,
                byteSize: chunk.byteSize ?? chunk.blob.size,
                sha256: chunk.sha256 ?? null,
                persistedAt: chunk.persistedAt ?? new Date(chunk.timestamp).toISOString(),
                uploadStatus: chunk.uploadStatus ?? 'pending',
            }))
            .sort((a, b) => a.index - b.index)
    },

    async deleteChunk(id: string) {
        const db = await getDB()
        const tx = db.transaction(['sessions','chunks'], 'readwrite')
        await commitRecorderWrite(tx, async () => {
            const chunk = await tx.objectStore('chunks').get(id)
            if (chunk && (await tx.objectStore('sessions').get(chunk.sessionId))?.saveIntent) throw new Error('Recording session is frozen')
            await tx.objectStore('chunks').delete(id)
        })
    },

    async clearSession(sessionId: string) {
        const db = await getDB()
        const tx = db.transaction(['chunks', 'sessions'], 'readwrite')
        return commitRecorderWrite(tx, async () => {
            if ((await tx.objectStore('sessions').get(sessionId))?.saveIntent) throw new Error('Use confirmed recording cleanup')
            const index = tx.objectStore('chunks').index('by-session')
            let cursor = await index.openCursor(sessionId)

            while (cursor) {
                await cursor.delete()
                cursor = await cursor.continue()
            }
            await tx.objectStore('sessions').delete(sessionId)
        })
    }
}

export function resetRecorderDBForTests() {
    dbPromise = null
}
