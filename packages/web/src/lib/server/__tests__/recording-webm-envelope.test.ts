/** @jest-environment node */
import { closeWebmEnvelope } from '../recording-webm-envelope'

const unknown = Buffer.from('01ffffffffffffff', 'hex')
const leaf = (id: string, bytes: Buffer) => Buffer.concat([Buffer.from(id, 'hex'), Buffer.from([0x80 | bytes.length]), bytes])
const header = leaf('1a45dfa3', leaf('4282', Buffer.from('webm')))
const segment = Buffer.from('18538067', 'hex')
const cluster = Buffer.from('1f43b675', 'hex')
const block = leaf('a3', Buffer.from('81000080010203', 'hex'))
const timestamp = leaf('e7', Buffer.from([0]))
const make = (tail = Buffer.from([0x1f])) => Buffer.concat([header, segment, unknown,
  leaf('1549a966', Buffer.alloc(0)), leaf('1654ae6b', Buffer.alloc(0)),
  cluster, unknown, timestamp, block, cluster, unknown, timestamp, block, tail])

it('closes unknown segment/clusters and removes only an incomplete next-cluster header in a detached copy', () => {
  const original = make(), copy = Buffer.from(original), result = closeWebmEnvelope(original)!
  expect(result).toBeDefined()
  expect(result.removedContainerHeaderBytes).toBe(1)
  expect(result.audioBlocks).toBe(2)
  expect(result.bytes.length).toBe(original.length - 1)
  expect(original).toEqual(copy)
  expect(result.bytes.subarray(-block.length)).toEqual(block)
  expect(result.bytes.includes(unknown)).toBe(false)
})

it('accepts a complete block boundary without pretending to recover missing audio', () => {
  expect(closeWebmEnvelope(make(Buffer.alloc(0)))?.removedContainerHeaderBytes).toBe(0)
})

it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])('allows only %i bytes of the exact Chrome next-cluster header', count => {
  const tail = Buffer.concat([cluster, unknown]).subarray(0, count)
  expect(closeWebmEnvelope(make(tail))?.removedContainerHeaderBytes).toBe(count)
})

it.each([2, 3, 4, 5, 6, 7, 8, 9])('rejects truncation %i bytes inside the final block/header', removed => {
  expect(closeWebmEnvelope(make().subarray(0, -removed))).toBeNull()
})

it.each(['1f44', 'a3', 'ec', '00', '1f43b67501000000000000'])('rejects arbitrary trailing data %s', tail => {
  expect(closeWebmEnvelope(make(Buffer.from(tail, 'hex')))).toBeNull()
})

it('rejects an empty stream, unknown cluster children and finite-size truncated segments', () => {
  expect(closeWebmEnvelope(Buffer.concat([header, segment, unknown]))).toBeNull()
  expect(closeWebmEnvelope(Buffer.concat([header, segment, unknown, cluster, unknown, leaf('81', Buffer.from([1]))]))).toBeNull()
  const finite = make(); finite[header.length + segment.length] = 0x81
  expect(closeWebmEnvelope(finite)).toBeNull()
})

it('leaves non-WebM, excessive input and short identifiers in the strict decoder path', () => {
  expect(closeWebmEnvelope(Buffer.from('synthetic bytes'))).toBeNull()
  expect(closeWebmEnvelope(Buffer.from('1a45', 'hex'))).toBeNull()
  expect(closeWebmEnvelope(Buffer.alloc(104857601))).toBeNull()
})
