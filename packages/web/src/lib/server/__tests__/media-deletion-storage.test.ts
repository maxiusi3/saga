/** @jest-environment node */
import { createDeletionStorage } from '../media-deletion-storage'
const object={bucket:'audio-recordings',objectKey:'owner/projects/project/sessions/session/0'}
const opts={storageUrl:'https://storage.invalid',serviceRoleKey:'synthetic',ioTimeoutMs:50}
it('observes missing objects only on explicit not-found responses, never permission failures',async()=>{
  for(const response of [new Response('',{status:404}),Response.json({statusCode:'404',error:'not_found'},{status:400})]) {
    expect(await createDeletionStorage({...opts,fetch:async()=>response}).exists(object)).toBe(false)
  }
  for(const status of [401,403,500])await expect(createDeletionStorage({...opts,fetch:async()=>new Response('',{status})}).exists(object)).rejects.toThrow('media_deletion_storage_unavailable')
})
it('validates delete acknowledgment identity and records explicit absent versus deleted',async()=>{
  expect(await createDeletionStorage({...opts,fetch:async()=>Response.json([{name:object.objectKey}])}).remove(object)).toBe('deleted')
  expect(await createDeletionStorage({...opts,fetch:async()=>Response.json([])}).remove(object)).toBe('not_found')
  await expect(createDeletionStorage({...opts,fetch:async()=>Response.json([{name:'another/object'}])}).remove(object)).rejects.toThrow()
})
it('rejects path traversal and unsafe origins before any HTTP call',async()=>{
  const request=jest.fn()
  for(const objectKey of ['../foreign','owner/../foreign','owner/%2e%2e/foreign','owner/a?other','owner//file']) {
    await expect(createDeletionStorage({...opts,fetch:request}).remove({...object,objectKey})).rejects.toThrow()
  }
  expect(request).not.toHaveBeenCalled()
  expect(()=>createDeletionStorage({...opts,storageUrl:'https://storage.invalid/other',fetch:request})).toThrow()
})
it('bounds ignored cancellation and does not retry destructive requests',async()=>{
  const request=jest.fn(()=>new Promise<Response>(()=>{}))
  await expect(createDeletionStorage({...opts,fetch:request,ioTimeoutMs:15}).remove(object)).rejects.toThrow()
  expect(request).toHaveBeenCalledTimes(1)
})
it('requires a complete canonical flat chunk inventory',async()=>{
  const request=jest.fn(async()=>Response.json([{name:'0',id:'one'},{name:'12',id:'two'}]))
  const prefix={...object,objectKey:object.objectKey.slice(0,-2)}
  expect(await createDeletionStorage({...opts,fetch:request}).list(prefix)).toEqual([{...object,objectKey:prefix.objectKey+'/0'},{...object,objectKey:prefix.objectKey+'/12'}])
  for(const name of ['../x','sub/file','00','folder'])await expect(createDeletionStorage({...opts,fetch:async()=>Response.json([{name,id:null}])}).list(prefix)).rejects.toThrow()
})
