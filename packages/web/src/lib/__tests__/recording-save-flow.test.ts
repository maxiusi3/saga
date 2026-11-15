/** @jest-environment node */
import { webcrypto } from 'node:crypto'
import { saveLocalRecording } from '../recording-save-flow'
import { recorderDB } from '../recorder-db'
import { identity, metadata, makeSnapshot, lookup, status, receipt, seal } from '../test-support/recording-save-fixture'

const mockUser = { id: identity.actorId }
const mockToken = jest.fn(async () => 'token')
const mockUpload = jest.fn()
const mockDownload = jest.fn()
jest.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: () => ({ user: mockUser, getAccessToken: mockToken }) } }))
jest.mock('../supabase', () => ({ createClientSupabase: () => ({ storage: { from: () => ({ upload: mockUpload, download: mockDownload }) } }) }))
jest.mock('../recorder-db', () => ({ recorderDB: { prepareSave: jest.fn(), readSave: jest.fn(), readSaveState: jest.fn(), recordSaveLookup: jest.fn(), recordSaveConfirmation: jest.fn(), clearConfirmedSave: jest.fn() } }))
let snapshot: Awaited<ReturnType<typeof makeSnapshot>>
let responses: Array<unknown | Error>
let calls: Array<{url:string; body: unknown}>

beforeEach(async () => {
  Object.defineProperty(globalThis, 'crypto', { configurable:true, value:webcrypto })
  Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{locks:{request:async (_name: string,_options:unknown,callback:(lock:unknown)=>unknown) => callback({})}} })
  mockUser.id = identity.actorId
  mockToken.mockReset().mockResolvedValue('token')
  snapshot = await makeSnapshot()
  jest.mocked(recorderDB.prepareSave).mockReset().mockImplementation(async () => snapshot)
  jest.mocked(recorderDB.readSave).mockReset().mockImplementation(async () => snapshot)
  jest.mocked(recorderDB.readSaveState).mockReset().mockImplementation(async () => snapshot)
  jest.mocked(recorderDB.recordSaveLookup).mockReset().mockImplementation(async (_i, value) => { snapshot.session.saveIntent!.remote = value.intent; return snapshot })
  jest.mocked(recorderDB.recordSaveConfirmation).mockReset().mockImplementation(async () => snapshot)
  mockUpload.mockReset().mockResolvedValue({data:{path:'stored'},error:null})
  mockDownload.mockReset().mockResolvedValue({data:snapshot.chunks[0].blob,error:null})
  responses = [lookup(),lookup(true),seal(),lookup(true,true),status(),receipt()]
  calls = []
  global.fetch = jest.fn(async (url, init) => {
    calls.push({url:String(url),body: init?.body ? JSON.parse(String(init.body)):null})
    const value = responses.shift()
    if (value instanceof Error) throw value
    return new Response(JSON.stringify(value), {status:200})
  })
})
const run = () => saveLocalRecording({ identity, metadata, isCurrent: () => true })
it('persists intent before reservation, saves only after confirmation and never clears implicitly', async () => {
  const result = await run()
  expect(result).toEqual({state:'saved',receipt:receipt()})
  expect(jest.mocked(recorderDB.prepareSave).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(global.fetch).mock.invocationCallOrder[0])
  expect(recorderDB.recordSaveConfirmation).toHaveBeenCalled()
  expect(recorderDB.clearConfirmedSave).not.toHaveBeenCalled()
})
it('retains unknown reservation response and resumes the same session after reopening', async () => {
  responses = [lookup(), new Error('lost reserve')]
  await expect(run()).rejects.toThrow()
  expect(recorderDB.recordSaveConfirmation).not.toHaveBeenCalled()
  responses = [lookup(true), seal(), lookup(true,true), status(), receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
  expect(calls.filter(call => (call.body as {action?:string})?.action === 'reserve')).toHaveLength(1)
})
it('recovers a lost committed seal using lookup and status without replaying it', async () => {
  responses = [lookup(),lookup(true),new Error('lost seal')]
  await expect(run()).rejects.toThrow()
  responses = [lookup(true,true),status(),receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
  expect(calls.filter(call => call.url.endsWith('/seal'))).toHaveLength(1)
})
it('registers the same manifest only after authorized unresolved status proves no job', async () => {
  responses = [lookup(true,true),status('unresolved',null),seal(),lookup(true,true),status(),receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
  expect(calls.filter(call => call.url.endsWith('/seal'))).toHaveLength(1)
})
it.each([new Error('offline'),{...status('unresolved',null),canClearLocalDrafts:true}])('does not replay seal on unknown or invalid status', async response => {
  responses = [lookup(true,true),response]
  await expect(run()).rejects.toThrow()
  expect(calls.some(call => call.url.endsWith('/seal'))).toBe(false)
})
it('returns honest pending with no worker and does not confirm', async () => {
  responses = [lookup(true,true),...Array.from({length:4},()=>status('unresolved'))]
  expect(await run()).toEqual({state:'pending'})
  expect(recorderDB.recordSaveConfirmation).not.toHaveBeenCalled()
})
it('rejects worker failure and keeps the local recording', async () => {
  responses = [lookup(true,true),status('failed')]
  await expect(run()).rejects.toThrow()
  expect(recorderDB.clearConfirmedSave).not.toHaveBeenCalled()
})
it('reconciles duplicate upload by full readback and refuses wrong bytes', async () => {
  mockUpload.mockResolvedValue({error:{message:'duplicate'}})
  mockDownload.mockResolvedValue({data:new Blob(['tampered']),error:null})
  await expect(run()).rejects.toThrow()
  expect(calls.some(call => call.url.endsWith('/seal'))).toBe(false)
})
it('accepts an uncertain upload only when readback verifies every byte', async () => {
  mockUpload.mockRejectedValue(new Error('lost upload'))
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
})
it('cancels on account change during token refresh before any remote call', async () => {
  mockToken.mockImplementation(async () => { mockUser.id='other'; return 'token' })
  await expect(run()).rejects.toThrow()
  expect(calls).toHaveLength(0)
})
it('cancels when current scope changes during upload, before readback or seal', async () => {
  mockUpload.mockImplementation(async () => { mockUser.id='other'; return {error:null} })
  await expect(run()).rejects.toThrow()
  expect(mockDownload).not.toHaveBeenCalled()
  expect(calls.some(call => call.url.endsWith('/seal'))).toBe(false)
})
it.each(['actorId','storyId','assetId','manifestSha256','playbackUrl','canClearLocalDrafts'])('refuses corrupt %s confirmation', async key => {
  responses[5] = {...receipt(),[key]:'wrong'}
  await expect(run()).rejects.toThrow()
  expect(recorderDB.recordSaveConfirmation).not.toHaveBeenCalled()
})
it('rejects concurrent clicks while first save is in progress', async () => {
  let release!:()=>void
  mockToken.mockImplementationOnce(() => new Promise(resolve => { release=()=>resolve('token') }))
  const first=run()
  await new Promise(resolve=>setTimeout(resolve,0))
  await expect(run()).rejects.toThrow()
  release()
  await first
  expect(calls.filter(call => (call.body as {action?:string})?.action === 'reserve')).toHaveLength(1)
})
it('does not trust stale local confirmation when current authorization is unavailable', async () => {
  snapshot.session.saveIntent!.confirmation=receipt()
  responses=[new Error('revoked')]
  await expect(run()).rejects.toThrow()
})

it('automatically reaches saved when a worker completes during bounded polling', async () => {
  responses=[lookup(true,true),status('unresolved'),status(),receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
})
it('resumes lost confirmation response without creating a second story', async () => {
  responses=[lookup(true,true),status(),new Error('lost confirm')]
  await expect(run()).rejects.toThrow()
  responses=[lookup(true,true),status(),receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
  expect(calls.filter(c=>(c.body as {action?:string})?.action==='reserve')).toHaveLength(0)
})
it('retains drafts when confirmation persistence fails and retries the same receipt', async () => {
  jest.mocked(recorderDB.recordSaveConfirmation).mockRejectedValueOnce(new Error('quota'))
  await expect(run()).rejects.toThrow('quota')
  expect(recorderDB.clearConfirmedSave).not.toHaveBeenCalled()
  responses=[lookup(true,true),status(),receipt()]
  expect(await run()).toEqual({state:'saved',receipt:receipt()})
})

it('fails closed without cross-tab locks before freezing or making remote calls', async () => {
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}})
  await expect(run()).rejects.toThrow('recording_lock_unavailable')
  expect(recorderDB.prepareSave).not.toHaveBeenCalled()
  expect(calls).toHaveLength(0)
})
it.each(['actorId','projectId','sessionId','canClearLocalDrafts'])('rejects corrupted %s lookup before any upload', async key => {
  responses=[{...lookup(true),[key]:'wrong'}]
  await expect(run()).rejects.toThrow()
  expect(mockUpload).not.toHaveBeenCalled()
})
it('refuses remote metadata different from the durable local intent', async () => {
  responses=[{...lookup(true),intent:{...lookup(true).intent,metadata:{...metadata,title:'changed'}}}]
  await expect(run()).rejects.toThrow()
  expect(mockUpload).not.toHaveBeenCalled()
})
it('refuses to mutate remotely after local integrity recheck fails', async () => {
  jest.mocked(recorderDB.readSaveState).mockRejectedValueOnce(new Error('recording_local_damaged'))
  await expect(run()).rejects.toThrow('recording_local_damaged')
  expect(calls).toHaveLength(0)
})
it('pins upload auth and immutable storage identity and disables overwrite', async () => {
  await run()
  expect(mockUpload).toHaveBeenCalledWith(`${identity.actorId}/projects/${identity.projectId}/sessions/${identity.sessionId}/0`,snapshot.chunks[0].blob,
    {upsert:false,contentType:'audio/webm',headers:{Authorization:'Bearer token'}})
  expect(mockDownload.mock.calls[0][2]).toEqual({signal:expect.any(AbortSignal),cache:'no-store'})
})
it('aborts a transport that ignores cancellation and makes no later mutation', async () => {
  const controller=new AbortController()
  global.fetch=jest.fn(()=>new Promise(()=>{}))
  const saving=saveLocalRecording({identity,metadata,isCurrent:()=>true,signal:controller.signal})
  await new Promise(resolve=>setTimeout(resolve,0))
  controller.abort()
  await expect(saving).rejects.toThrow()
  expect(mockUpload).not.toHaveBeenCalled()
})
it('does not poll after cancellation during the wait for a worker', async () => {
  responses=[lookup(true,true),status('unresolved')]
  const controller=new AbortController()
  const saving=saveLocalRecording({identity,metadata,isCurrent:()=>true,signal:controller.signal})
  await new Promise(resolve=>setTimeout(resolve,30))
  controller.abort()
  await expect(saving).rejects.toThrow()
  expect(calls.filter(c=>c.url.includes('/status?'))).toHaveLength(1)
})
