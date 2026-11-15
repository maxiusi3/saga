/** @jest-environment node */
import {NextRequest,NextResponse} from 'next/server'
import {POST} from '../route'
const auth=jest.fn(),access=jest.fn(),rpc=jest.fn()
jest.mock('@/lib/server/auth',()=>({getAuthenticatedUser:(...args:unknown[])=>auth(...args)}))
jest.mock('@/lib/server/project-access',()=>({requireProjectAccess:(...args:unknown[])=>access(...args)}))
jest.mock('@/lib/supabase',()=>({getSupabaseAdmin:()=>({rpc})}))
const post=(body:unknown)=>POST(new NextRequest('http://localhost/api/projects/project/search',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}),{params:Promise.resolve({id:'project'})})
beforeEach(()=>{jest.clearAllMocks();process.env.MEDIA_ASSETS_ENABLED='true';auth.mockResolvedValue({ok:true,user:{id:'actor'},headers:new Headers({'Set-Cookie':'refreshed'})});access.mockResolvedValue({ok:true})})
afterEach(()=>{delete process.env.MEDIA_ASSETS_ENABLED})
it('authenticates semantic POST and preserves refreshed cookies with no-store',async()=>{
 const response=await post({query:'relocation',mode:'semantic',consent:true,policyVersion:'a'.repeat(64)})
 expect(response.status).toBe(503);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(response.headers.get('Set-Cookie')).toBe('refreshed');expect(rpc).not.toHaveBeenCalled()
})
it('authorizes before reading semantic requests',async()=>{
 access.mockResolvedValue({ok:false,response:NextResponse.json({error:'denied'},{status:403})});expect((await post('{bad-json')).status).toBe(403);expect(rpc).not.toHaveBeenCalled()
})
it.each(['{bad',JSON.stringify({query:'relocation',mode:'semantic',consent:'yes',policyVersion:'a'.repeat(64)}),JSON.stringify({query:'q',mode:'literal',consent:true,policyVersion:'a'.repeat(64)}),JSON.stringify({query:'x'.repeat(241),mode:'semantic',consent:true,policyVersion:'a'.repeat(64)}),JSON.stringify({query:'q',mode:'semantic',consent:true,policyVersion:'a'.repeat(64),extra:'attack'})])('rejects malformed or ambiguous POST %s',async body=>{expect((await post(body)).status).toBe(400);expect(rpc).not.toHaveBeenCalled()})
it('rejects oversized streamed body',async()=>{expect((await post(' '.repeat(5000))).status).toBe(413)})
