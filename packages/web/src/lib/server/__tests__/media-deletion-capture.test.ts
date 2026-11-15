/** @jest-environment node */
import { submitMediaDeletionRequest, MediaDeletionCaptureError } from '../media-deletion-capture'
import type { getSupabaseAdmin } from '@/lib/supabase'
const input = { actorId: '11111111-1111-4111-8111-111111111111', projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', subjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', subjectType: 'media_asset' as const, requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
const receipt = { id: input.requestId, projectId: input.projectId, subjectId: input.subjectId, subjectType: input.subjectType, state: 'requested', tombstoneAt: '2026-11-06T00:00:00+00:00', targetCount: 4, physicalDeletionComplete: false }
function client(result: unknown = { data: receipt, error: null }) {
  const retry = jest.fn(() => Promise.resolve(result)), abortSignal = jest.fn(() => ({ retry })), rpc = jest.fn(() => ({ abortSignal }))
  return { rpc, retry, abortSignal, admin: { rpc } as unknown as ReturnType<typeof getSupabaseAdmin> }
}
describe('strict atomic deletion service', () => {
  it('uses bounded, single no-retry RPC and copies the validated receipt', async () => {
    const c = client(), value = await submitMediaDeletionRequest(input, c)
    expect(value).toEqual(receipt); expect(value).not.toBe(receipt)
    expect(c.rpc).toHaveBeenCalledWith('request_media_deletion', { p_actor_id: input.actorId, p_project_id: input.projectId, p_subject_id: input.subjectId, p_subject_type: 'media_asset', p_request_id: input.requestId })
    expect(c.retry).toHaveBeenCalledWith(false); expect(c.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
  })
  it.each(['actorId','projectId','subjectId','requestId','subjectType'])('rejects invalid primitive %s without SQL', async key => {
    for (const invalid of [null, undefined, 1, {}, '', ' invalid ']) {
      const c = client(); await expect(submitMediaDeletionRequest({ ...input, [key]: invalid }, c)).rejects.toMatchObject({ status: 400 }); expect(c.rpc).not.toHaveBeenCalled()
    }
  })
  it.each([{ extra: true }, { id: 'x' }, { projectId: input.actorId }, { subjectId: input.actorId }, { subjectType: 'story' }, { state: 'completed' }, { physicalDeletionComplete: true }, { targetCount: -1 }, { targetCount: 1.5 }, { targetCount: '4' }, { tombstoneAt: 'yesterday' }, { tombstoneAt: '2026-02-30T00:00:00Z' }, { bucket: 'private' }])('rejects invalid receipt %j', async mutation => {
    await expect(submitMediaDeletionRequest(input, client({ data: { ...receipt, ...mutation }, error: null }))).rejects.toMatchObject({ status: 503 })
  })
  it('rejects missing fields, legacy receipts and nonobjects', async () => {
    for (const data of [null, [], {}, { id: receipt.id }, ...Object.keys(receipt).map(key => Object.fromEntries(Object.entries(receipt).filter(([k])=>k!==key)))]) {
      await expect(submitMediaDeletionRequest(input, client({ data, error: null }))).rejects.toBeInstanceOf(MediaDeletionCaptureError)
    }
  })
  it.each([['42501',403],['23505',409],['23514',409],['22023',400],['22P02',400],['55P03',503],['XX000',503]])('categorizes %s without leaking details', async (code,status) => {
    const c = client({ data: null, error: { code, message: 'private storage/path' } })
    await expect(submitMediaDeletionRequest(input,c)).rejects.toMatchObject({ status, message: 'Media deletion request is unavailable' })
  })
  it('accepts the original durable id when replaying the same subject', async () => {
    expect(await submitMediaDeletionRequest({ ...input, requestId: input.actorId },client())).toEqual(receipt)
  })
  it('pins inputs while the response is pending', async () => {
    const identity = { ...input }, c = client(); let deliver!: (value: unknown) => void
    c.retry.mockImplementation(() => new Promise(resolve=>{ deliver=resolve }))
    const pending = submitMediaDeletionRequest(identity,c); identity.subjectId=input.actorId
    deliver({ data: { ...receipt, subjectId: input.actorId }, error: null })
    await expect(pending).rejects.toMatchObject({ status: 503 })
  })
  it('bounds timeouts and preaborted requests without starting SQL', async () => {
    for (const timeoutMs of [0,-1,60001,1.5,NaN]) { const c=client(); await expect(submitMediaDeletionRequest(input,{...c,timeoutMs})).rejects.toMatchObject({status:503});expect(c.rpc).not.toHaveBeenCalled() }
    const controller=new AbortController();controller.abort();const c=client()
    await expect(submitMediaDeletionRequest(input,{...c,signal:controller.signal})).rejects.toMatchObject({status:503});expect(c.rpc).not.toHaveBeenCalled()
  })
  it('timeout and caller abort reject a noncooperating SDK without fallback or retry', async () => {
    for(const useCaller of [false,true]) {
      const c=client(),controller=new AbortController();c.retry.mockImplementation(()=>new Promise(()=>{}))
      const pending=submitMediaDeletionRequest(input,{...c,timeoutMs:useCaller?1000:5,signal:controller.signal})
      if(useCaller)controller.abort()
      await expect(pending).rejects.toMatchObject({status:503});expect(c.rpc).toHaveBeenCalledTimes(1);expect(c.retry).toHaveBeenCalledTimes(1)
    }
  })
  it('a lost response fails closed and a later independent request can recover', async () => {
    const c=client();c.retry.mockRejectedValueOnce(new Error('network lost private details'))
    await expect(submitMediaDeletionRequest(input,c)).rejects.toMatchObject({status:503})
    expect(c.rpc).toHaveBeenCalledTimes(1);expect(await submitMediaDeletionRequest(input,c)).toEqual(receipt)
  })
})
