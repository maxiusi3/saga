import { openDB, DBSchema, IDBPDatabase } from 'idb'

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
        dbPromise = openDB<RecorderDB>(DB_NAME, DB_VERSION, {
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
        })
    }
    return dbPromise
}

export const recorderDB = {
    async saveSession(session: Omit<RecorderSessionRecord, 'updatedAt'> & { updatedAt?: number }) {
        const db = await getDB()
        const record: RecorderSessionRecord = { ...session, updatedAt: session.updatedAt ?? Date.now() }
        await db.put('sessions', record)
        return record
    },

    async getSession(sessionId: string) {
        const db = await getDB()
        return db.get('sessions', sessionId)
    },

    async updateSession(sessionId: string, patch: Partial<Omit<RecorderSessionRecord, 'id'>>) {
        const db = await getDB()
        const current = await db.get('sessions', sessionId)
        if (!current) return undefined
        const next: RecorderSessionRecord = { ...current, ...patch, id: current.id, updatedAt: Date.now() }
        await db.put('sessions', next)
        return next
    },

    async getSessionsByProject(projectId: string) {
        const db = await getDB()
        return db.getAllFromIndex('sessions', 'by-project', projectId)
    },

    async getRecoverableSessions(projectId: string, userId: string) {
        const sessions = (await this.getSessionsByProject(projectId))
            .filter(session => session.userId === userId && session.state !== 'confirmed')
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
        await tx.objectStore('chunks').put(record)
        const session = await tx.objectStore('sessions').get(sessionId)
        if (session) {
            await tx.objectStore('sessions').put({ ...session, lastPersistedIndex: Math.max(session.lastPersistedIndex, index), updatedAt: timestamp })
        }
        await tx.done
        return record
    },

    async markChunkUploaded(sessionId: string, index: number) {
        const db = await getDB()
        const id = `${sessionId}-${index}`
        const tx = db.transaction('chunks', 'readwrite')
        const chunk = await tx.store.get(id)
        if (!chunk) throw new Error('chunk must be persisted before upload')
        const next = { ...chunk, uploadStatus: 'uploaded' as const }
        await tx.store.put(next)
        await tx.done
        return next
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
        await db.delete('chunks', id)
    },

    async clearSession(sessionId: string) {
        const db = await getDB()
        const tx = db.transaction(['chunks', 'sessions'], 'readwrite')
        const index = tx.objectStore('chunks').index('by-session')
        let cursor = await index.openCursor(sessionId)

        while (cursor) {
            await cursor.delete()
            cursor = await cursor.continue()
        }
        await tx.objectStore('sessions').delete(sessionId)
        await tx.done
    }
}

export function resetRecorderDBForTests() {
    dbPromise = null
}
