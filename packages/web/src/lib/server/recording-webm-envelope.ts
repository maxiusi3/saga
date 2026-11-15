/** Chrome MediaRecorder can flush a complete block followed by part of the next
 * Cluster header. Close only that container envelope for strict decoding. This
 * is deliberately a narrow parser, not a damaged-media repairer: unsupported
 * structures must take the unchanged strict decoder path.
 */
const MAX_BYTES = 100 * 1024 * 1024
const NEXT_CLUSTER = Buffer.from('1f43b67501ffffffffffffff', 'hex')

interface Element { id: string; sizeOffset: number; sizeWidth: number; body: number; end: number; unknown: boolean }

function width(byte: number, max: number): number {
  for (let n = 1; n <= max; n++) if (byte & (1 << (8 - n))) return n
  return 0
}

function element(bytes: Buffer, offset: number, limit: number): Element | null {
  if (offset >= limit) return null
  const idWidth = width(bytes[offset], 4), sizeOffset = offset + idWidth
  if (!idWidth || sizeOffset >= limit) return null
  const sizeWidth = width(bytes[sizeOffset], 8), body = sizeOffset + sizeWidth
  if (!sizeWidth || body > limit) return null
  let size = BigInt(bytes[sizeOffset] & ((1 << (8 - sizeWidth)) - 1))
  for (let n = 1; n < sizeWidth; n++) size = (size << BigInt(8)) | BigInt(bytes[sizeOffset + n])
  const unknown = size === (BigInt(1) << BigInt(7 * sizeWidth)) - BigInt(1)
  if (!unknown && size > BigInt(limit - body)) return null
  return { id: bytes.subarray(offset, sizeOffset).toString('hex'), sizeOffset, sizeWidth, body,
    end: unknown ? limit : body + Number(size), unknown }
}

function closeSize(bytes: Buffer, entry: Element, end: number) {
  let encoded = (BigInt(1) << BigInt(7 * entry.sizeWidth)) | BigInt(end - entry.body)
  for (let n = entry.sizeWidth - 1; n >= 0; n--) {
    bytes[entry.sizeOffset + n] = Number(encoded & BigInt(255))
    encoded >>= BigInt(8)
  }
}

export function closeWebmEnvelope(input: Buffer): {
  bytes: Buffer; removedContainerHeaderBytes: number; audioBlocks: number
} | null {
  if (input.length > MAX_BYTES) return null
  const header = element(input, 0, input.length)
  if (!header || header.id !== '1a45dfa3' || header.unknown) return null
  let docType = false
  for (let offset = header.body; offset < header.end;) {
    const child = element(input, offset, header.end)
    if (!child || child.unknown) return null
    if (child.id === '4282') {
      if (docType || input.subarray(child.body, child.end).toString() !== 'webm') return null
      docType = true
    }
    offset = child.end
  }
  const segment = element(input, header.end, input.length)
  if (!docType || !segment || segment.id !== '18538067' || !segment.unknown || segment.sizeWidth !== 8) return null
  const closures: Array<{ entry: Element; end: number }> = []
  let offset = segment.body, audioBlocks = 0, elements = 0, finalEnd = input.length
  let info = false, tracks = false
  while (offset < input.length) {
    if (++elements > 1000000) return null
    const entry = element(input, offset, input.length)
    if (!entry) return null
    if (entry.id === '1549a966' || entry.id === '1654ae6b') {
      if (audioBlocks || entry.unknown) return null
      if (entry.id === '1549a966') { if (info) return null; info = true }
      else { if (tracks) return null; tracks = true }
      offset = entry.end
      continue
    }
    if (!info || !tracks || entry.id !== '1f43b675' || !entry.unknown || entry.sizeWidth !== 8) return null
    offset = entry.body
    let clusterBlocks = 0, timestamp = false
    while (offset < input.length) {
      if (++elements > 1000000) return null
      const remaining = input.length - offset
      if (remaining < NEXT_CLUSTER.length && input.subarray(offset).equals(NEXT_CLUSTER.subarray(0, remaining))) {
        finalEnd = offset
        break
      }
      const child = element(input, offset, input.length)
      if (!child) return null
      if (child.id === '1f43b675') break
      if (child.unknown) return null
      if (child.id === 'e7') {
        if (timestamp || clusterBlocks || child.end - child.body < 1 || child.end - child.body > 8) return null
        timestamp = true
      } else if (child.id === 'a3') {
        const trackWidth = width(input[child.body], 8)
        // Chrome emits unlaced SimpleBlocks. Never trim within a block or infer
        // packets from a declared length that extends beyond the saved bytes.
        if (!timestamp || !trackWidth || child.end - child.body <= trackWidth + 3 ||
          (input[child.body + trackWidth + 2] & 6) !== 0) return null
        clusterBlocks++; audioBlocks++
      } else return null
      offset = child.end
    }
    if (!clusterBlocks) return null
    closures.push({ entry, end: offset })
    if (finalEnd < input.length) break
  }
  if (!audioBlocks) return null
  const bytes = Buffer.from(input.subarray(0, finalEnd))
  closeSize(bytes, segment, finalEnd)
  for (const closure of closures) closeSize(bytes, closure.entry, closure.end)
  return { bytes, audioBlocks, removedContainerHeaderBytes: input.length - finalEnd }
}
