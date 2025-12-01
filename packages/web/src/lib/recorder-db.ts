import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface RecorderDB extends DBSchema {
    chunks: {
        key: string
        value: {
            id: string
            sessionId: string
            index: number
            blob: Blob
            timestamp: number
        }
        indexes: { 'by-session': string }
    }
}

const DB_NAME = 'saga-recorder-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<RecorderDB>> | null = null

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<RecorderDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('chunks', {
                    keyPath: 'id',
                })
                store.createIndex('by-session', 'sessionId')
            },
        })
    }
    return dbPromise
}

export const recorderDB = {
    async saveChunk(sessionId: string, index: number, blob: Blob) {
        const db = await getDB()
        const id = `${sessionId}-${index}`
        await db.put('chunks', {
            id,
            sessionId,
            index,
            blob,
            timestamp: Date.now(),
        })
    },

    async getChunksBySession(sessionId: string) {
        const db = await getDB()
        return db.getAllFromIndex('chunks', 'by-session', sessionId)
    },

    async deleteChunk(id: string) {
        const db = await getDB()
        await db.delete('chunks', id)
    },

    async clearSession(sessionId: string) {
        const db = await getDB()
        const tx = db.transaction('chunks', 'readwrite')
        const index = tx.store.index('by-session')
        let cursor = await index.openCursor(sessionId)

        while (cursor) {
            await cursor.delete()
            cursor = await cursor.continue()
        }
        await tx.done
    }
}
