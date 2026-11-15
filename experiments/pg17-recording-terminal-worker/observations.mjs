import { createRequire } from 'node:module'
import { once, getEventListeners } from 'node:events'
import { readdir } from 'node:fs/promises'

const require = createRequire(import.meta.url), cp = require('node:child_process'), fs = require('node:fs'), fsp = require('node:fs/promises')

/** Observe native resources without substituting processing or its results. */
export function observeResources(h, executable, tempRoot) {
  const original = { spawn: cp.spawn, read: fs.createReadStream, open: fsp.open, rm: fsp.rm }
  const children = new Set(), streams = new Set(), handles = new Set(), removals = new Set()
  const events = h.report.resources = []
  let current
  const event = details => { const value = { case: current?.name, at: performance.now(), ...details }; events.push(value); return value }
  cp.spawn = function (...args) {
    h.eq(args[0], executable, 'actual configured FFmpeg executable invoked')
    const child = original.spawn.apply(this, args), value = event({ kind: 'decoder', pid: child.pid, closed: false, pcmBytes: 0 })
    children.add(child)
    child.stdout.on('data', bytes => { value.pcmBytes += bytes.length })
    child.once('close', (code, signal) => { Object.assign(value, { code, signal, closed: true, closedAt: performance.now() }); children.delete(child) })
    return child
  }
  fs.createReadStream = function (...args) {
    const stream = original.read.apply(this, args), value = event({ kind: 'upload-stream', closed: false })
    streams.add(stream)
    stream.once('close', () => { value.closed = true; value.closedAt = performance.now(); streams.delete(stream) })
    return stream
  }
  fsp.open = async function (...args) {
    const handle = await original.open.apply(this, args)
    if (!String(args[0]).startsWith(`${tempRoot}/`)) return handle
    const value = event({ kind: 'merged-handle', closed: false })
    handles.add(handle)
    handle.once('close', () => { value.closed = true; value.closedAt = performance.now(); handles.delete(handle) })
    return handle
  }
  fsp.rm = async function (...args) {
    if (!String(args[0]).startsWith(`${tempRoot}/`)) return original.rm.apply(this, args)
    const value = event({ kind: 'merged-directory-removal', closed: false })
    removals.add(value)
    try {
      await original.rm.apply(this, args)
      value.closed = true; value.closedAt = performance.now()
      if (current?.mode === 'cancel-during-cleanup') { current.controller.abort(); value.callerCancelled = true }
    } finally { removals.delete(value) }
  }
  async function snapshot() {
    return { children: children.size, streams: streams.size, handles: handles.size, removals: removals.size,
      tempEntries: await readdir(tempRoot), callerAbortListeners: getEventListeners(current.controller.signal, 'abort').length }
  }
  return { events,
    configure(config) { current = config },
    async assertClean(terminal = false) {
      const value = await snapshot()
      h.eq(value, { children: 0, streams: 0, handles: 0, removals: 0, tempEntries: [], callerAbortListeners: terminal ? 1 : 0 },
        terminal ? 'local artifacts settled; only finalizer owns caller listener at terminal request' : 'all attempt resources and caller listeners released')
      return value
    },
    async close() {
      cp.spawn = original.spawn; fs.createReadStream = original.read; fsp.open = original.open; fsp.rm = original.rm
      const leakedBeforeRescue = { children: children.size, streams: streams.size, handles: handles.size, removals: removals.size }
      for (const child of children) { const closed = once(child, 'close'); child.kill('SIGKILL'); await closed }
      for (const stream of streams) { const closed = once(stream, 'close'); stream.destroy(); await closed }
      for (const handle of handles) await handle.close()
      h.report.applicationCleanup = { observersRestored: cp.spawn === original.spawn && fs.createReadStream === original.read && fsp.open === original.open && fsp.rm === original.rm,
        leakedBeforeRescue, childrenRemaining: children.size, streamsRemaining: streams.size, handlesRemaining: handles.size, removalsRemaining: removals.size }
      h.eq(leakedBeforeRescue, { children: 0, streams: 0, handles: 0, removals: 0 }, 'cleanup needed no rescue of live processing resources')
      for (const value of events.filter(value => value.kind === 'decoder')) {
        try { process.kill(value.pid, 0); value.pidGone = false } catch (error) { value.pidGone = error.code === 'ESRCH' }
        h.ok(value.closed && value.pidGone, 'every decoder process closed and PID is gone')
      }
    },
  }
}
