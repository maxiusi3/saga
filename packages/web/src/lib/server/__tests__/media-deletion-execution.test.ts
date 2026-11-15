/** @jest-environment node */
import { createDeletionExecution } from '../media-deletion-execution'
import { runMediaDeletion } from '../media-deletion-worker'
import type { getSupabaseAdmin } from '@/lib/supabase'
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',runId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
function fixture(override:Record<string,unknown>={}) {
  const now=Date.now()
  return {requestId,runId,state:'scanning',serverNow:new Date(now).toISOString(),leaseExpiresAt:new Date(now+120000).toISOString(),lastVerifiedAt:null,nextScanAt:new Date(now+120000).toISOString(),operationId:null,physicalDeletionComplete:false,unresolvedPhysicalCount:0,objects:[{bucket:'saga',objectKey:'owner/projects/project/file'}],prefixes:[],...override}
}
function client(data:unknown) {
  const retry=jest.fn(async()=>({data,error:null})),abortSignal=jest.fn(()=>({retry})),rpc=jest.fn(()=>({abortSignal}))
  return {admin:{rpc} as unknown as ReturnType<typeof getSupabaseAdmin>,rpc,retry}
}
it.each([{requestId:runId},{runId:requestId},{physicalDeletionComplete:true},{extra:true},{objects:[{bucket:'saga',objectKey:'owner/../foreign'}]},{prefixes:[{bucket:'saga',objectKey:'owner/projects/project'}]},{leaseExpiresAt:'2026-01-01T00:00:00Z'},{unresolvedPhysicalCount:-1}])('rejects forged or expired execution authority %j',async patch=>{
  await expect(createDeletionExecution(requestId,runId,client(fixture(patch)))('begin')).rejects.toThrow('media_deletion_execution_unavailable')
})
it('detaches transport coordinates and sends mutations without SDK retry',async()=>{
  const value=fixture(),c=client(value)
  const result=await createDeletionExecution(requestId,runId,c)('begin')
  value.objects[0].objectKey='owner/foreign'
  expect(result.objects[0].objectKey).toBe('owner/projects/project/file')
  expect(c.retry).toHaveBeenCalledWith(false)
  expect(c.rpc).toHaveBeenCalledWith('media_deletion_execute',{p_request_id:requestId,p_run_id:runId,p_action:'begin',p_payload:{}})
})
it('cannot dispatch Storage when begin has malformed authority',async()=>{
  const c=client(fixture({requestId:'forged'})),http=jest.fn()
  await expect(runMediaDeletion(requestId,{...c,storageUrl:'https://storage.invalid',serviceRoleKey:'synthetic',fetch:http})).rejects.toThrow()
  expect(http).not.toHaveBeenCalled()
})
it('ignored SQL transport cancellation is bounded without retry',async()=>{
  const c=client(fixture());c.retry.mockImplementation(()=>new Promise(()=>{}))
  await expect(createDeletionExecution(requestId,runId,{...c,rpcTimeoutMs:10})('begin')).rejects.toThrow()
  expect(c.rpc).toHaveBeenCalledTimes(1)
})
