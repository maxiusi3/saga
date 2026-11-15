/** @jest-environment jsdom */
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {StoryTranscriptionControl} from '../StoryTranscriptionControl'
import {readTranscriptionReadiness,transcribeStory} from '@/lib/story-transcription-client'
jest.mock('@/lib/story-transcription-client',()=>({readTranscriptionReadiness:jest.fn(),transcribeStory:jest.fn()}))
const read=jest.mocked(readTranscriptionReadiness),write=jest.mocked(transcribeStory)
const ready={ready:true,provider:'elevenlabs',model:'scribe_v2',region:'us',policyVersion:'account-policy-v1',requiresConsent:true,pendingRequestId:null}
beforeEach(()=>{jest.clearAllMocks();read.mockResolvedValue(ready);Object.defineProperty(global.crypto,'randomUUID',{value:()=> '44444444-4444-4444-8444-444444444444',configurable:true})})
it('requires explicit consent bound to the displayed policy',async()=>{
 render(<StoryTranscriptionControl storyId="story" actorId="actor" locale="en" onSaved={jest.fn()}/>)
 const button=await screen.findByRole('button',{name:'Transcribe saved audio'})
 expect(button).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox'));expect(button).toBeEnabled()
 write.mockImplementation(()=>new Promise(()=>{}));fireEvent.click(button);fireEvent.click(button)
 await waitFor(()=>expect(write).toHaveBeenCalledTimes(1))
 expect(write).toHaveBeenCalledWith('story',expect.objectContaining({consent:true,policyVersion:'account-policy-v1'}))
})
it('does not issue a new call after a pending request survives reload',async()=>{
 read.mockResolvedValue({...ready,pendingRequestId:'pending'})
 render(<StoryTranscriptionControl storyId="story" actorId="actor" locale="en" onSaved={jest.fn()}/>)
 await screen.findByText(/A transcription request is unresolved/)
 expect(screen.queryByRole('button',{name:'Transcribe saved audio'})).not.toBeInTheDocument()
 expect(write).not.toHaveBeenCalled()
})
it('offers only the SQL-approved pre-send retry and reuses its request identity after explicit consent',async()=>{
 const retryId='77777777-7777-4777-8777-777777777777'
 read.mockResolvedValue({...ready,pendingRequestId:retryId,retryableRequestId:retryId})
 render(<StoryTranscriptionControl storyId="story" actorId="actor" locale="en" onSaved={jest.fn()}/>)
 const button=await screen.findByRole('button',{name:'Retry transcription'})
 expect(button).toBeDisabled();expect(write).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('checkbox'));write.mockImplementation(()=>new Promise(()=>{}));fireEvent.click(button)
 await waitFor(()=>expect(write).toHaveBeenCalledWith('story',expect.objectContaining({requestId:retryId,consent:true})))
})
