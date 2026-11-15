/** @jest-environment jsdom */
import {readStoryReview,writeStoryReview} from '../story-review-client'
import {readTranscriptionReadiness} from '../story-transcription-client'
import {useAuthStore} from '@/stores/auth-store'
jest.mock('@/stores/auth-store',()=>({useAuthStore:{getState:jest.fn()}}))
const getState=jest.mocked(useAuthStore.getState)
beforeEach(()=>{global.fetch=jest.fn()})
it('does not submit a previous actor intent under a replacement cookie session',async()=>{
 let resolve!:(token:string|null)=>void
 let actor='actor-a'
 getState.mockImplementation(()=>({user:{id:actor},getAccessToken:()=>new Promise(done=>{resolve=done})} as ReturnType<typeof useAuthStore.getState>))
 const request=writeStoryReview('story',{operation:'prepare',requestId:'id'})
 actor='actor-b';resolve(null)
 await expect(request).rejects.toThrow()
 expect(fetch).not.toHaveBeenCalled()
})
it('does not issue a read or readiness lookup with no validated token',async()=>{
 getState.mockReturnValue({user:{id:'actor'},getAccessToken:async()=>null} as ReturnType<typeof useAuthStore.getState>)
 await expect(readStoryReview('story')).rejects.toThrow()
 await expect(readTranscriptionReadiness('story')).rejects.toThrow()
 expect(fetch).not.toHaveBeenCalled()
})
