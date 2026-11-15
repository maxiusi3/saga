/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '../route'
const mockAuth = jest.fn(), mockRpc = jest.fn(), mockAdmin = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
const storyId='11111111-1111-4111-8111-111111111111', actorId='22222222-2222-4222-8222-222222222222'
const revisionId='33333333-3333-4333-8333-333333333333', requestId='44444444-4444-4444-8444-444444444444'
const state={revision:null,assertions:[],transcript:null,approvedRevisions:[],sourceChanged:false,canApprove:true}
const context={params:Promise.resolve({storyId})}
function request(body?:unknown) { return new NextRequest(`http://localhost/api/stories/${storyId}/review`, body===undefined?undefined:{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}}) }
function rpcResult(result:unknown) { const chain={abortSignal:()=>chain,retry:()=>Promise.resolve(result)}; return chain }
describe('atomic story review route',()=>{
 beforeEach(()=>{jest.clearAllMocks();process.env.MEDIA_ASSETS_ENABLED='true';mockAuth.mockResolvedValue({ok:true,user:{id:actorId},headers:new Headers({'Set-Cookie':'session=refreshed'})});mockAdmin.mockReturnValue({rpc:mockRpc});mockRpc.mockReturnValue(rpcResult({data:state,error:null}))})
 afterEach(()=>{delete process.env.MEDIA_ASSETS_ENABLED})
 it.each(['false','TRUE','1',''])('feature flag %s denies before auth or DB',async flag=>{process.env.MEDIA_ASSETS_ENABLED=flag;expect((await POST(request({operation:'prepare',requestId}),context)).status).toBe(404);expect(mockAuth).not.toHaveBeenCalled();expect(mockAdmin).not.toHaveBeenCalled()})
 it('reads durable state with one atomic RPC and refreshed headers',async()=>{const r=await GET(request(),context);expect(r.status).toBe(200);expect(await r.json()).toEqual({review:state});expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('set-cookie')).toBe('session=refreshed');expect(mockRpc).toHaveBeenCalledWith('story_review',{p_actor_id:actorId,p_story_id:storyId,p_operation:'read',p_request_id:null,p_expected_version:null,p_payload:{}})})
 it('passes typed identity and CAS into one mutation',async()=>{const r=await POST(request({operation:'decide_assertion',requestId,revisionId,expectedVersion:4,assertionId:storyId,action:'dispute',text:'Another account'}),context);expect(r.status).toBe(200);expect(await r.json()).toEqual({review:state,requestId});expect(mockRpc).toHaveBeenCalledWith('story_review',{p_actor_id:actorId,p_story_id:storyId,p_operation:'decide_assertion',p_request_id:requestId,p_expected_version:4,p_payload:{revision_id:revisionId,assertion_id:storyId,action:'dispute',text:'Another account'}})})
 it.each([
 {operation:'prepare',requestId:'bad'}, {operation:'prepare',requestId,revisionId:'bad'}, {operation:'prepare',requestId,expectedVersion:-1},
 {operation:'prepare',requestId,text:123}, {operation:'approve_revision',requestId,revisionId,expectedVersion:-1},
 {operation:'decide_assertion',requestId,revisionId,expectedVersion:0,assertionId:storyId,action:'modify',text:''},
 {operation:'correct_transcript',requestId,revisionId,expectedVersion:0,text:'x'.repeat(100001)},
 {operation:'ingest_transcript',requestId}, {operation:'prepare',requestId,actorId},
 ])('rejects malformed/client-only input without DB %#',async body=>{const r=await POST(request(body),context);expect(r.status).toBe(400);expect(mockAdmin).not.toHaveBeenCalled()})
 it('rejects invalid path UUID without DB',async()=>{expect((await GET(request(),{params:Promise.resolve({storyId:'invalid'})})).status).toBe(400);expect(mockAdmin).not.toHaveBeenCalled()})
 it.each([['42501',403],['P0002',404],['23505',409],['23514',409],['22023',400],['08006',503]])('maps %s without leaking DB details',async(code,status)=>{mockRpc.mockReturnValue(rpcResult({data:null,error:{code,message:'secret postgres url'}}));const r=await POST(request({operation:'prepare',requestId}),context);expect(r.status).toBe(status);expect(JSON.stringify(await r.json())).not.toContain('secret')})
 it('keeps auth failure and makes no DB call',async()=>{mockAuth.mockResolvedValue({ok:false,response:NextResponse.json({error:'Unauthorized'},{status:401})});expect((await GET(request(),context)).status).toBe(401);expect(mockAdmin).not.toHaveBeenCalled()})
 it('fails closed on malformed RPC state',async()=>{mockRpc.mockReturnValue(rpcResult({data:{},error:null}));expect((await GET(request(),context)).status).toBe(503)})
})
