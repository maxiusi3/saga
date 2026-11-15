/** One lock name is shared by capture, save, recovery and explicit cleanup. */
const held = new Set<string>()
export async function acquireRecordingSessionLock(sessionId: string, required = true): Promise<() => void> {
  if (held.has(sessionId)) throw new Error('recording_busy')
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) {
    if (required) throw new Error('recording_lock_unavailable')
    held.add(sessionId)
    return () => { held.delete(sessionId) }
  }
  held.add(sessionId)
  try {
    return await new Promise<() => void>((resolve, reject) => {
      void locks.request(`saga-recording:${sessionId}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('recording_busy')); return }
        await new Promise<void>(release => resolve(() => { held.delete(sessionId); release() }))
      }).catch(reject)
    })
  } catch (error) { held.delete(sessionId); throw error }
}
