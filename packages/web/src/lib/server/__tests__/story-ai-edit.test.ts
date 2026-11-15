/** @jest-environment node */
import { getStoryAiEditConfiguration, parseStoryAiEditRequest, parseEditedParagraphs, parseFactReview, callStoryAiModels } from '../story-ai-edit'
const segment = { id: '11111111-1111-4111-8111-111111111111', text: 'Um, I left school in 1972, and then I worked at the mill.', start_ms: 0, end_ms: 6000, confidence: null, speaker_label: 'storyteller' }
const paragraphs = [{ text: 'I left school in 1972 and began working at the mill.', segmentId: segment.id, sourceQuote: segment.text, startMs: 0, endMs: 6000 }]
const now = new Date('2026-11-13T00:00:00Z')
const evidence = (provider:string, modelId:string) => JSON.stringify({ provider, modelId, accountOrOrgId:'synthetic-policy-account', allowedRegions:['us'], trainingOptOutConfirmed:true, zeroDataRetentionConfirmed:true, maxRetentionDaysAllowed:0, evidenceDate:now.toISOString(), evidenceReference:'controlled-local-evidence-only' })
const env = { MEDIA_ASSETS_ENABLED:'true', G2_AI_EDIT_ENABLED:'true', ANTHROPIC_API_KEY:'synthetic-anthropic', OPENAI_API_KEY:'synthetic-openai', G2_AI_EDITOR_POLICY_EVIDENCE:evidence('anthropic','claude-opus-5-5'), G2_AI_REVIEWER_POLICY_EVIDENCE:evidence('openai','gpt-6-astra') }
it('keeps unconfigured editing unavailable and never exposes credentials', () => {
  expect(getStoryAiEditConfiguration({env:{}})).toMatchObject({ready:false,policyVersion:null,requiresConsent:true})
  const config=getStoryAiEditConfiguration({env,now})
  expect(config).toMatchObject({ready:true,editor:{model:'claude-opus-5-5'},reviewer:{model:'gpt-6-astra'}})
  expect(JSON.stringify(config)).not.toContain('synthetic-')
})
it('binds consent to explicit versioned policy, revision and request identity', () => {
  expect(()=>parseStoryAiEditRequest({requestId:segment.id,revisionId:segment.id,expectedVersion:0,policyVersion:'p',consent:false})).toThrow()
  expect(()=>parseStoryAiEditRequest({requestId:segment.id,revisionId:segment.id,expectedVersion:0,policyVersion:'p',consent:true,body:'unreviewed arbitrary prose'})).toThrow()
})
it('accepts edited text with exact source identities but rejects invented citations, quote edits and false timing',()=>{
  expect(parseEditedParagraphs({paragraphs},[segment])).toEqual(paragraphs)
  for(const change of [{segmentId:'22222222-2222-4222-8222-222222222222'},{sourceQuote:'I left in 1992'},{startMs:10}])expect(()=>parseEditedParagraphs({paragraphs:[{...paragraphs[0],...change}]},[segment])).toThrow()
  expect(()=>parseEditedParagraphs({paragraphs,body:'Safety assertions hiding arbitrary body'},[segment])).toThrow()
})
it('requires exactly one independent support verdict for each actual ordered paragraph and blocks severe risk',()=>{
  expect(parseFactReview({paragraphs:[{index:0,supported:true,severity:'none',risks:[]}]},paragraphs)).toHaveLength(1)
  for(const value of [{paragraphs:[]},{paragraphs:[{index:0,supported:false,severity:'none',risks:[]}]},{paragraphs:[{index:0,supported:true,severity:'severe',risks:['invented event']}]}])expect(()=>parseFactReview(value,paragraphs)).toThrow()
})
it('sends separate bounded real HTTP shapes and reviews the edited paragraphs, not separate safe assertions',async()=>{
  const calls:Array<{url:string;body:Record<string,unknown>}>=[]
  const transport=async(url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));calls.push({url:String(url),body});return new Response(JSON.stringify(calls.length===1?{id:'msg_controlled',model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({paragraphs})}],usage:{input_tokens:80,output_tokens:50}}:{id:'resp_controlled',model:'gpt-6-astra',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({paragraphs:[{index:0,supported:true,severity:'none',risks:[]}]})}]}],usage:{input_tokens:100,output_tokens:30}}))}
  const stages:string[]=[]
  const result=await callStoryAiModels([segment],{env,now,fetch:transport as typeof fetch,beforeSend:async stage=>{stages.push(stage)}})
  expect(result.paragraphs[0].text).not.toBe(segment.text)
  expect(stages).toEqual(['editor','reviewer'])
  expect(calls.map(call=>call.url)).toEqual(['https://api.anthropic.com/v1/messages','https://api.openai.com/v1/responses'])
  expect(calls[1].body.store).toBe(false)
  expect(String(calls[1].body.input)).toContain(paragraphs[0].text)
  expect(result.metadata).toMatchObject({editor:{model:'claude-opus-5-5'},reviewer:{model:'gpt-6-astra'}})
})
it('does not send to a provider after a source/consent fence rejects',async()=>{
  const fetcher=jest.fn()
  await expect(callStoryAiModels([segment],{env,now,fetch:fetcher,beforeSend:async()=>{throw new Error('revoked')}})).rejects.toThrow('revoked')
  expect(fetcher).not.toHaveBeenCalled()
})
it('bounds response time even when a transport ignores abort',async()=>{
  await expect(callStoryAiModels([segment],{env,now,timeoutMs:5,fetch:()=>new Promise(()=>{}),beforeSend:async()=>{}})).rejects.toMatchObject({code:'outcome_unknown'})
})
it('rejects an unsupported model switch even when a legacy policy is supplied',()=>{
 expect(getStoryAiEditConfiguration({env:{...env,G2_AI_EDITOR_MODEL:'claude-opus-4-20250514',G2_AI_EDITOR_POLICY_EVIDENCE:evidence('anthropic','claude-opus-4-20250514')},now}).ready).toBe(false)
})
it('rejects editor truncation and reviewer refusal instead of saving partial prose',async()=>{
 for(const step of ['editor','reviewer']){
  let calls=0
  const transport=async()=>{calls++;return new Response(JSON.stringify(calls===1?{id:'msg_x',model:'claude-opus-5-5',stop_reason:step==='editor'?'max_tokens':'end_turn',content:[{type:'text',text:JSON.stringify({paragraphs})}]}:{id:'resp_x',model:'gpt-6-astra',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'cannot process'}]}]}))}
  await expect(callStoryAiModels([segment],{env,now,fetch:transport as typeof fetch,beforeSend:async()=>{}})).rejects.toMatchObject({status:502})
 }
})
it('rejects a response that exceeds the byte budget without parsing it',async()=>{
 await expect(callStoryAiModels([segment],{env,now,fetch:(async()=>new Response('x'.repeat(700001))) as typeof fetch,beforeSend:async()=>{}})).rejects.toMatchObject({code:'provider_invalid_response'})
})
