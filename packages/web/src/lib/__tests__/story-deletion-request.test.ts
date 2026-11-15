/** @jest-environment node */
import { StoryService } from '../stories'
const mockSession=jest.fn()
jest.mock('../supabase',()=>({createClientSupabase:()=>({auth:{getSession:(...args: unknown[])=>mockSession(...args)}})}))
const story='11111111-1111-4111-8111-111111111111',project='22222222-2222-4222-8222-222222222222'
const receipt={id:'33333333-3333-4333-8333-333333333333',subjectId:story,projectId:project,subjectType:'story',state:'requested',physicalDeletionComplete:false}
const originalFetch=global.fetch
beforeEach(()=>{mockSession.mockResolvedValue({data:{session:{access_token:'synthetic'}}});global.fetch=jest.fn().mockResolvedValue({status:202,json:async()=>({deletionRequest:receipt})})})
afterAll(()=>{global.fetch=originalFetch})
it('accepts only a matching server receipt via the authenticated same-origin endpoint',async()=>{
  expect(await new StoryService().deleteStory(story,project)).toBe(true)
  expect(global.fetch).toHaveBeenCalledWith(`/api/projects/${project}/stories/${story}/delete`,expect.objectContaining({method:'POST',credentials:'include',headers:expect.objectContaining({Authorization:'Bearer synthetic'})}))
})
it.each([200,403,409,503])('does not infer acceptance from HTTP %s',async status=>{
  ;(global.fetch as jest.Mock).mockResolvedValue({status,json:async()=>({deletionRequest:receipt})})
  expect(await new StoryService().deleteStory(story,project)).toBe(false)
})
it.each([{subjectId:project},{projectId:story},{state:'completed'},{physicalDeletionComplete:true},{subjectType:'media_asset'}])('rejects mismatched receipt %j',async patch=>{
  ;(global.fetch as jest.Mock).mockResolvedValue({status:202,json:async()=>({deletionRequest:{...receipt,...patch}})})
  expect(await new StoryService().deleteStory(story,project)).toBe(false)
})
it('does not request deletion without valid project context',async()=>{
  expect(await new StoryService().deleteStory(story)).toBe(false);expect(global.fetch).not.toHaveBeenCalled()
})
