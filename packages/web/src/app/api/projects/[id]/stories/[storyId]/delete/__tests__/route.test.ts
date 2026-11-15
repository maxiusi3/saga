/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'
const mockAuth=jest.fn(),mockRpc=jest.fn()
jest.mock('@/lib/server/auth',()=>({getAuthenticatedUser:(...a:unknown[])=>mockAuth(...a)}))
jest.mock('@/lib/supabase',()=>({getSupabaseAdmin:()=>({rpc:(...a:unknown[])=>mockRpc(...a)})}))
const actor='11111111-1111-4111-8111-111111111111',project='22222222-2222-4222-8222-222222222222',story='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444'
const receipt={id,projectId:project,subjectId:story,subjectType:'story',state:'requested',tombstoneAt:'2026-11-09T00:00:00Z',targetCount:1,physicalDeletionComplete:false}
const params={params:Promise.resolve({id:project,storyId:story})}
const request=(body:unknown={requestId:id})=>new NextRequest('http://localhost/api/delete',{method:'POST',body:JSON.stringify(body)})
function result(data:unknown,error:unknown=null){const q={abortSignal:()=>q,retry:async()=>({data,error})};return q}
beforeEach(()=>{jest.clearAllMocks();process.env.MEDIA_ASSETS_ENABLED='true';mockAuth.mockResolvedValue({ok:true,user:{id:actor},headers:new Headers({'Set-Cookie':'refreshed=1'})});mockRpc.mockReturnValue(result(receipt))})
afterEach(()=>delete process.env.MEDIA_ASSETS_ENABLED)
it('calls only the atomic capture-and-purge RPC and returns acceptance',async()=>{
  const r=await POST(request(),params);expect(r.status).toBe(202);expect(await r.json()).toEqual({deletionRequest:receipt})
  expect(mockRpc).toHaveBeenCalledWith('request_story_deletion',{p_actor_id:actor,p_project_id:project,p_story_id:story,p_request_id:id});expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('set-cookie')).toBe('refreshed=1')
})
it('keeps the feature gate before SQL',async()=>{delete process.env.MEDIA_ASSETS_ENABLED;expect((await POST(request(),params)).status).toBe(404);expect(mockRpc).not.toHaveBeenCalled()})
it('keeps authentication before SQL',async()=>{mockAuth.mockResolvedValue({ok:false,response:NextResponse.json({error:'auth'},{status:401})});expect((await POST(request(),params)).status).toBe(401);expect(mockRpc).not.toHaveBeenCalled()})
it.each([null,[],{requestId:null},{actorId:actor},{requestId:'invalid'}])('rejects malformed input %j',async body=>{expect((await POST(request(body),params)).status).toBe(400);expect(mockRpc).not.toHaveBeenCalled()})
it.each([['42501',403],['23505',409],['XX000',503]])('reports SQL %s safely',async(code,status)=>{mockRpc.mockReturnValue(result(null,{code,message:'PRIVATE_BODY'}));const r=await POST(request(),params);expect(r.status).toBe(status);expect(JSON.stringify(await r.json())).not.toContain('PRIVATE_BODY')})
it('rejects a mismatched receipt',async()=>{mockRpc.mockReturnValue(result({...receipt,subjectId:project}));expect((await POST(request(),params)).status).toBe(503)})
