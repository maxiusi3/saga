/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StoryReviewPanel } from '../StoryReviewPanel'
import { readStoryReview, writeStoryReview } from '@/lib/story-review-client'
import type { ReviewState } from '@/lib/story-review-contract'

jest.mock('@/lib/story-review-client', () => ({ readStoryReview: jest.fn(), writeStoryReview: jest.fn() }))
jest.mock('../StoryTranscriptionControl', () => ({ StoryTranscriptionControl: ({onBusyChange}:{onBusyChange:(busy:boolean)=>void}) => <button onClick={()=>onBusyChange(true)}>Start test transcription</button> }))
const read = jest.mocked(readStoryReview), write = jest.mocked(writeStoryReview)
const owner = '11111111-1111-4111-8111-111111111111'
const revisionId = '22222222-2222-4222-8222-222222222222'
const assertionId = '33333333-3333-4333-8333-333333333333'
function fixture(): ReviewState {
  return { revision: {id:revisionId,story_id:owner,status:'draft',title:'Family memory',body:'Original account',summary:'',revision_number:1,edit_version:2,approved_at:null,approved_by:null,source_transcript_id:owner,source_hash:'a'.repeat(64),provenance_snapshot:{},content_sha256:'b'.repeat(64)},
    assertions:[{id:assertionId,revision_id:revisionId,claim_text:'Original account',assertion_type:'quote',review_decision:null,review_status:'verified',source_transcript_id:owner,source_segment_ids:[owner],evidence_refs:[],alternatives:[],confidence_score:null,ordinal:0,memory_attribution:'storyteller_memory',source_quote:'Original account',reviewed_by:null,start_ms:null,end_ms:null}],
    transcript:{id:owner,provider:'legacy',model:'imported-text',alignment_status:'legacy_unaligned',asset_id:null,segments:[{id:owner,text:'Original account',start_ms:null,end_ms:null,confidence:null,speaker_label:'storyteller'}]},approvedRevisions:[],sourceChanged:false,canApprove:true }
}
beforeEach(() => { jest.clearAllMocks(); read.mockResolvedValue(fixture()); Object.defineProperty(global.crypto,'randomUUID',{value:()=> '44444444-4444-4444-8444-444444444444',configurable:true}) })

it('blocks approval while any paragraph has not been reviewed and labels absent alignment', async () => {
  render(<StoryReviewPanel storyId={owner} actorId={owner} locale="en" />)
  await screen.findByText('Imported text · audio timing unavailable')
  expect(screen.getByRole('button',{name:'Approve this version'})).toBeDisabled()
  expect(screen.queryByRole('button',{name:/Listen/})).not.toBeInTheDocument()
})

it('sends an explicit attributed modification with revision CAS and prevents double submission', async () => {
  let resolve!: (value:ReviewState)=>void
  write.mockReturnValue(new Promise(done=>{resolve=done}))
  render(<StoryReviewPanel storyId={owner} actorId={owner} locale="en" />)
  fireEvent.click(await screen.findByRole('button',{name:'Modify'}))
  fireEvent.change(screen.getByLabelText('Family correction'),{target:{value:'It happened in 1972.'}})
  fireEvent.click(screen.getByRole('button',{name:'Save correction'}))
  fireEvent.click(screen.getByRole('button',{name:'Save correction'}))
  await waitFor(()=>expect(write).toHaveBeenCalledTimes(1))
  expect(write).toHaveBeenCalledWith(owner,expect.objectContaining({operation:'decide_assertion',revisionId,expectedVersion:2,assertionId,action:'modify',text:'It happened in 1972.'}))
  const updated=fixture();updated.assertions[0].claim_text='It happened in 1972.';updated.assertions[0].review_decision='modify';updated.assertions[0].memory_attribution='family_supplement'
  resolve(updated)
  expect(await screen.findByText('It happened in 1972.')).toBeInTheDocument()
})

it('retains an unknown request identity for explicit retry and locks new edits until refreshed', async () => {
  write.mockRejectedValueOnce(new TypeError('network disconnected'))
  render(<StoryReviewPanel storyId={owner} actorId={owner} locale="en" />)
  fireEvent.click(await screen.findByRole('button',{name:'Accept'}))
  await screen.findByText(/Could not confirm the result/)
  expect(screen.getByRole('button',{name:'Modify'})).toBeDisabled()
  const sent=write.mock.calls[0][1]
  write.mockResolvedValue(fixture())
  fireEvent.click(screen.getByRole('button',{name:'Retry same request'}))
  await waitFor(()=>expect(write).toHaveBeenCalledTimes(2))
  expect(write.mock.calls[1][1]).toEqual(sent)
})

it('ignores a late response after switching the active story', async () => {
  let resolve!: (value:ReviewState)=>void
  read.mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValueOnce({...fixture(),revision:null,assertions:[],transcript:null})
  const page=render(<StoryReviewPanel storyId={owner} actorId={owner} locale="en" />)
  page.rerender(<StoryReviewPanel storyId={revisionId} actorId={owner} locale="en" />)
  await screen.findByRole('button',{name:'Prepare review'})
  resolve(fixture())
  await waitFor(()=>expect(screen.queryByText('Original account')).not.toBeInTheDocument())
})

it('blocks parent review mutations and reload while transcription owns the source', async () => {
  render(<StoryReviewPanel storyId={owner} actorId={owner} />)
  fireEvent.click(await screen.findByRole('button',{name:'Start test transcription'}))
  expect(screen.getByRole('button',{name:'Accept'})).toBeDisabled()
  expect(screen.getByRole('button',{name:'Correct transcript'})).toBeDisabled()
  expect(screen.getByRole('button',{name:'Reload review'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Accept'}))
  expect(write).not.toHaveBeenCalled()
})

it('pauses source playback before reload detaches the audio element', async () => {
  const pause=jest.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  const state=fixture();state.transcript!.asset_id=assertionId
  read.mockResolvedValue(state)
  const page=render(<StoryReviewPanel storyId={owner} actorId={owner} />)
  await screen.findByRole('button',{name:'Modify'})
  const playing=page.container.querySelector('audio')!
  fireEvent.click(screen.getByRole('button',{name:'Reload review'}))
  expect(pause).toHaveBeenCalledTimes(1)
  expect(pause.mock.instances[0]).toBe(playing)
  await screen.findByRole('button',{name:'Modify'})
  page.unmount();pause.mockRestore()
})

it('discards an old actor response even when the story ID stays the same', async () => {
  let resolve!: (value:ReviewState)=>void
  read.mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValueOnce({...fixture(),revision:null,assertions:[],transcript:null})
  const page=render(<StoryReviewPanel storyId={owner} actorId={owner} />)
  page.rerender(<StoryReviewPanel storyId={owner} actorId={revisionId} />)
  await screen.findByRole('button',{name:'Prepare review'})
  resolve(fixture())
  await waitFor(()=>expect(screen.queryByText('Original account')).not.toBeInTheDocument())
})
