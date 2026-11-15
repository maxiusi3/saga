/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'
const mockAuth=jest.fn(), mockAccess=jest.fn(), mockRpc=jest.fn()
jest.mock('@/lib/server/auth',()=>({getAuthenticatedUser:(...args:unknown[])=>mockAuth(...args)}))
jest.mock('@/lib/supabase',()=>({getSupabaseAdmin:()=>({rpc:(...args:unknown[])=>mockRpc(...args)})}))
jest.mock('@/app/api/media/assets/[assetId]/access/route',()=>({GET:(...args:unknown[])=>mockAccess(...args)}))
const project='11111111-1111-4111-8111-111111111111'
const citation={ entryId:'segment:33333333-3333-4333-8333-333333333333',storyId:'22222222-2222-4222-8222-222222222222',
  transcriptVersionId:'44444444-4444-4444-8444-444444444444',segmentId:'33333333-3333-4333-8333-333333333333',
  mediaAssetId:'55555555-5555-4555-8555-555555555555',storyRevisionId:null,sourceHash:'a'.repeat(64),sourceFingerprint:'b'.repeat(64),startMs:0,endMs:1200 }
const run=(body:unknown=citation)=>POST(new NextRequest(`http://localhost/api/projects/${project}/search/source`,{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:project})})
beforeEach(()=>{jest.clearAllMocks();process.env.MEDIA_ASSETS_ENABLED='true'
  mockAuth.mockResolvedValue({ok:true,user:{id:'member'},headers:new Headers({'Set-Cookie':'refreshed'})})
  mockRpc.mockResolvedValue({data:{...citation,projectId:project},error:null})
  mockAccess.mockResolvedValue(NextResponse.json({signedUrl:'https://storage.example/private'}))
})
afterEach(()=>{delete process.env.MEDIA_ASSETS_ENABLED})
it('revalidates the exact current source before and after the protected media wait',async()=>{
  const response=await run();expect(response.status).toBe(200);expect(await response.json()).toEqual({signedUrl:'https://storage.example/private'})
  expect(mockRpc).toHaveBeenCalledTimes(2);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(response.headers.get('Set-Cookie')).toBe('refreshed')
})
it.each(['sourceHash','sourceFingerprint','transcriptVersionId','segmentId'])('never hands out audio for changed %s after access waits',async key=>{
  mockRpc.mockResolvedValueOnce({data:{...citation,projectId:project},error:null}).mockResolvedValueOnce({data:{...citation,projectId:project,[key]:'changed'},error:null})
  const response=await run();expect(response.status).toBe(409);expect(await response.text()).not.toContain('https://storage.example')
})
it.each(['42501','23505'])('fails closed on current permission/source rejection %s',async code=>{
  mockRpc.mockResolvedValueOnce({data:null,error:{code,message:'private detail'}})
  const response=await run();expect(response.status).toBe(code==='42501'?403:409);expect(mockAccess).not.toHaveBeenCalled();expect(await response.text()).not.toContain('private detail')
})
it('denies revocation while protected access is waiting',async()=>{
  mockRpc.mockResolvedValueOnce({data:{...citation,projectId:project},error:null}).mockResolvedValueOnce({data:null,error:{code:'42501'}})
  expect((await run()).status).toBe(403)
})
it.each([{startMs:null,endMs:null},{startMs:-1},{mediaAssetId:null},{sourceHash:'x'},{segmentId:null}])('rejects missing or forged audio evidence %j',async change=>{
  expect((await run({...citation,...change})).status).toBe(400);expect(mockRpc).not.toHaveBeenCalled()
})
it('propagates protected media denial instead of a source URL',async()=>{
  mockAccess.mockResolvedValueOnce(NextResponse.json({error:'Deleted'},{status:409}));expect((await run()).status).toBe(409)
})
