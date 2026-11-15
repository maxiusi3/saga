/** @jest-environment jsdom */
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {StoryAiEditControl} from '../StoryAiEditControl'
import {readAiEditReadiness,requestAiEdit} from '@/lib/story-ai-edit-client'
jest.mock('@/lib/story-ai-edit-client',()=>({readAiEditReadiness:jest.fn(),requestAiEdit:jest.fn()}))
const read=jest.mocked(readAiEditReadiness),write=jest.mocked(requestAiEdit)
const id='11111111-1111-4111-8111-111111111111'
const configuration={ready:true,requiresConsent:true as const,policyVersion:'policy',editor:{provider:'anthropic' as const,model:'claude-opus-5-5',region:'us'},reviewer:{provider:'openai' as const,model:'gpt-6-astra',region:'us'},status:null,pendingRequestId:null}
beforeEach(()=>{jest.clearAllMocks();read.mockResolvedValue(configuration);Object.defineProperty(global.crypto,'randomUUID',{value:()=>id,configurable:true})})
it('requires explicit dual-provider consent and sends the actual displayed revision CAS',async()=>{
 const saved=jest.fn();write.mockResolvedValue({} as never)
 render(<StoryAiEditControl storyId={id} actorId={id} locale="en" revision={{id,edit_version:7} as never} onSaved={saved}/>)
 const button=await screen.findByRole('button',{name:'Prepare AI edited draft'})
 expect(button).toBeDisabled();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button)
 await waitFor(()=>expect(write).toHaveBeenCalledWith(id,{requestId:id,revisionId:id,expectedVersion:7,consent:true,policyVersion:'policy'}));expect(saved).toHaveBeenCalled()
})
it('shows unavailable honestly without blocking manual review',async()=>{
 read.mockResolvedValue({...configuration,ready:false,policyVersion:null})
 render(<StoryAiEditControl storyId={id} actorId={id} locale="en" onSaved={()=>{}}/>)
 expect(await screen.findByText(/AI editing is unavailable/)).toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})
it('does not reissue an unknown request and lets the user check durable status',async()=>{
 write.mockRejectedValue(new Error('outcome_unknown'))
 render(<StoryAiEditControl storyId={id} actorId={id} locale="en" revision={{id,edit_version:7} as never} onSaved={()=>{}}/>)
 fireEvent.click(await screen.findByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Prepare AI edited draft'}))
 await screen.findByText(/AI request is unresolved/)
 expect(screen.queryByRole('button',{name:'Prepare AI edited draft'})).not.toBeInTheDocument();expect(write).toHaveBeenCalledTimes(1)
})
