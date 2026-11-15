/** @jest-environment node */
import {NextRequest,NextResponse} from 'next/server'
import {GET,POST} from '../route'
const mockAuth=jest.fn(),mockAdmin=jest.fn(),mockRead=jest.fn(),mockEdit=jest.fn()
jest.mock('@/lib/server/auth',()=>({getAuthenticatedUser:(...args:unknown[])=>mockAuth(...args)}))
jest.mock('@/lib/supabase',()=>({getSupabaseAdmin:()=>mockAdmin()}))
jest.mock('@/lib/server/story-ai-edit-service',()=>({readStoryAiEditStatus:(...args:unknown[])=>mockRead(...args),editStoryWithAi:(...args:unknown[])=>mockEdit(...args)}))
const id='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222',context={params:Promise.resolve({storyId:id})}
const input={requestId:id,revisionId:id,expectedVersion:3,consent:true,policyVersion:'current-policy'}
const request=(body?:unknown)=>new NextRequest('http://localhost/api/stories/'+id+'/ai-edit',body?{method:'POST',body:JSON.stringify(body)}:undefined)
beforeEach(()=>{jest.clearAllMocks();process.env.MEDIA_ASSETS_ENABLED='true';mockAuth.mockResolvedValue({ok:true,user:{id:actor},headers:new Headers({'Set-Cookie':'refreshed'})});mockAdmin.mockReturnValue({});mockRead.mockResolvedValue({status:null,pendingRequestId:null});mockEdit.mockResolvedValue({revision:{id},assertions:[]})})
afterEach(()=>{delete process.env.MEDIA_ASSETS_ENABLED})
it('authenticates and reads authorized status before exposing unavailable configuration',async()=>{const r=await GET(request(),context);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('set-cookie')).toBe('refreshed');expect(await r.json()).toMatchObject({aiEdit:{ready:false,requiresConsent:true,pendingRequestId:null}});expect(mockRead).toHaveBeenCalledWith(actor,id,expect.any(Object))})
it.each([{...input,consent:false},{...input,actorId:actor},{...input,body:'arbitrary prose'},{...input,expectedVersion:-1}])('rejects caller controlled identity/prose or missing consent %#',async body=>{expect((await POST(request(body),context)).status).toBe(400);expect(mockEdit).not.toHaveBeenCalled();expect(mockAdmin).not.toHaveBeenCalled()})
it('threads authenticated actor and displayed CAS to production service',async()=>{expect((await POST(request(input),context)).status).toBe(200);expect(mockEdit).toHaveBeenCalledWith(actor,id,input,expect.any(Object))})
it('does not call service when authentication fails',async()=>{mockAuth.mockResolvedValue({ok:false,response:NextResponse.json({error:'unauthorized'},{status:401})});expect((await POST(request(input),context)).status).toBe(401);expect(mockEdit).not.toHaveBeenCalled()})
it('bounds input bytes',async()=>{expect((await POST(request({...input,policyVersion:'x'.repeat(5000)}),context)).status).toBe(400);expect(mockEdit).not.toHaveBeenCalled()})
