/** @jest-environment node */
import { cosineSimilarity, searchSemanticSources, semanticReadiness } from '../semantic-search'
import { searchAuthoritativeSources } from '../authoritative-search'
const rpc = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc }) }))
const project = '11111111-1111-4111-8111-111111111111'
const citation = (text: string, index: number) => ({entryId:`segment:33333333-3333-4333-8333-${String(index).padStart(12,'0')}`,projectId:project,
 storyId:'22222222-2222-4222-8222-222222222222',storyTitle:'Current source',transcriptVersionId:'44444444-4444-4444-8444-444444444444',storyRevisionId:null,
 segmentId:`33333333-3333-4333-8333-${String(index).padStart(12,'0')}`,mediaAssetId:'55555555-5555-4555-8555-555555555555',startMs:0,endMs:1200,
 quotedText:text,sourceKind:'original_transcript',reviewStatus:'source_only',sourceHash:'a'.repeat(64),sourceFingerprint:'b'.repeat(64),attributedTo:null,excerptStart:0,excerptEnd:Array.from(text).length})
const sources=[citation('Grandmother moved overseas.',1),citation('She cooked delicious soup.',2)]
const now=()=>new Date('2026-11-13T12:00:00Z')
const env={SEMANTIC_SEARCH_ENABLED:'true',VOYAGE_API_KEY:'synthetic-key',PROVIDER_POLICY_EVIDENCE_JSON:JSON.stringify(['voyage-4-large','rerank-2.5'].map(modelId=>({provider:'voyage',modelId,accountOrOrgId:'synthetic',allowedRegions:['us'],trainingOptOutConfirmed:true,zeroDataRetentionConfirmed:true,maxRetentionDaysAllowed:0,evidenceDate:'2026-11-13T00:00:00Z',evidenceReference:'controlled-only'})))}
const vector=(x:number,y:number)=>[x,y,...Array(1022).fill(0)]
let snapshot:unknown, transport:jest.Mock
const query=(data:unknown,error:unknown=null)=>{const p=Promise.resolve({data,error});return Object.assign(p,{abortSignal:()=>p,retry:()=>p})}
beforeEach(()=>{
 snapshot={entries:structuredClone(sources),hasMore:false,consentId:'consent'}
 rpc.mockReset();rpc.mockImplementation(()=>{const p=query(snapshot);return {then:p.then.bind(p),abortSignal:()=>({retry:()=>p})}})
 transport=jest.fn(async(_url,init)=>{const body=JSON.parse(init.body)
  return new Response(JSON.stringify(body.input_type?{model:'voyage-4-large',data:(body.input_type==='query'?[vector(1,0)]:body.input.map((text:string)=>text.includes('moved')?vector(.9,.1):vector(0,1))).map((embedding,index)=>({index,embedding}))}:{model:'rerank-2.5',data:body.documents.map((_text:string,index:number)=>({index,relevance_score:index===0?.9:.1}))}),{headers:{'Content-Type':'application/json'}})
 })
})
const input=()=>({query:'relocation',mode:'semantic' as const,consent:true,policyVersion:semanticReadiness(env,now()).policyVersion!})
const run=(extra={})=>searchSemanticSources('alice',project,input(),{env,now,fetch:transport,...extra})
it('retrieves a synonym with zero lexical overlap through actual cosine ranking and rerank',async()=>{
 expect(sources.every(s=>!s.quotedText.toLowerCase().includes('relocation'))).toBe(true)
 snapshot={entries:[sources[1],sources[0]],hasMore:false,consentId:'consent'}
 const result=await run();expect(result.searchMode).toBe('semantic');expect(result.citations[0].quotedText).toBe(sources[0].quotedText)
 expect(cosineSimilarity(vector(1,0),vector(.9,.1))).toBeGreaterThan(cosineSimilarity(vector(1,0),vector(0,1)))
 expect(JSON.parse(transport.mock.calls[2][1].body).documents).toEqual(sources.map(s=>s.quotedText))
 expect(transport).toHaveBeenCalledTimes(3);expect(rpc).toHaveBeenCalledTimes(5)
})
it('literal search remains the default without policy or external requests',async()=>{
 rpc.mockResolvedValueOnce({data:{entries:[],hasMore:false},error:null})
 expect((await searchAuthoritativeSources('alice',project,{query:'relocation'})).searchMode).toBe('literal');expect(transport).not.toHaveBeenCalled()
})
it.each([{},{...env,SEMANTIC_SEARCH_ENABLED:'false'},{...env,PROVIDER_POLICY_EVIDENCE_JSON:'[]'},{...env,VOYAGE_BASE_URL:'https://evil.invalid/v1'}])('fails configured-off before reading or transmitting %j',async config=>{
 await expect(run({env:config})).rejects.toMatchObject({status:503});expect(transport).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled()
})
it('requires explicit consent and exact displayed policy',async()=>{
 await expect(searchSemanticSources('alice',project,{...input(),consent:false},{env,now,fetch:transport})).rejects.toMatchObject({status:403})
 await expect(searchSemanticSources('alice',project,{...input(),policyVersion:'old'},{env,now,fetch:transport})).rejects.toMatchObject({status:409})
 expect(transport).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled()
})
it.each(['42501','54000'])('fails closed on authorization/whole-corpus bound %s',async code=>{
 rpc.mockImplementation(()=>({abortSignal:()=>({retry:()=>Promise.resolve({data:null,error:{code}})})}))
 await expect(run()).rejects.toMatchObject({status:code==='42501'?403:422});expect(transport).not.toHaveBeenCalled()
})
it.each(['corrected','deleted','revoked','withdrawn','asset'])('rechecks %s after provider waits',async change=>{
 transport.mockImplementationOnce(async()=>{
  if(change==='revoked')rpc.mockImplementation(()=>({abortSignal:()=>({retry:()=>Promise.resolve({data:null,error:{code:'42501'}})})}))
  else snapshot=change==='deleted'?{entries:[],hasMore:false,consentId:'consent'}:change==='withdrawn'?{entries:sources,hasMore:false,consentId:'new-consent'}:{entries:[{...sources[0],sourceFingerprint:'c'.repeat(64)},sources[1]],hasMore:false,consentId:'consent'}
  return new Response(JSON.stringify({model:'voyage-4-large',data:[{index:0,embedding:vector(1,0)}]}),{headers:{'Content-Type':'application/json'}})
 })
 await expect(run()).rejects.toMatchObject({status:change==='revoked'?403:409});expect(transport).toHaveBeenCalledTimes(1)
})
it('rechecks after rerank before returning any citations',async()=>{
 const original=transport.getMockImplementation()!;transport.mockImplementation(async(...args)=>{const result=await original(...args);if(transport.mock.calls.length===3)snapshot={entries:[],hasMore:false,consentId:'consent'};return result})
 await expect(run()).rejects.toMatchObject({status:409})
})
it.each([{model:'wrong',data:[]},{model:'voyage-4-large',data:[{index:0,embedding:[1,2]}]},{model:'voyage-4-large',data:[{index:1,embedding:vector(1,0)}]}])('rejects malformed vector response %j',async value=>{
 transport.mockResolvedValueOnce(new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));await expect(run()).rejects.toMatchObject({status:502})
})
it('rejects cross-project sources before transmission',async()=>{
 snapshot={entries:[{...sources[0],projectId:'other'}],hasMore:false,consentId:'consent'};await expect(run()).rejects.toMatchObject({status:500});expect(transport).not.toHaveBeenCalled()
})
it('bounds a provider that ignores abort',async()=>{transport.mockImplementation(()=>new Promise(()=>{}));await expect(run({timeoutMs:5})).rejects.toMatchObject({status:503})})
it('bounds an unfinished response body',async()=>{transport.mockResolvedValue(new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}}));await expect(run({timeoutMs:5})).rejects.toMatchObject({status:503})})
it('embeds sources beyond fifty before selecting the cosine shortlist',async()=>{
 const corpus=Array.from({length:60},(_,index)=>citation(index===59?'Grandmother moved overseas.':`Soup recipe ${index}.`,index+1))
 snapshot={entries:corpus,hasMore:false,consentId:'consent'}
 const output=await run();expect(output.citations[0].entryId).toBe(corpus[59].entryId)
 expect(JSON.parse(transport.mock.calls[1][1].body).input).toHaveLength(60)
 expect(JSON.parse(transport.mock.calls[2][1].body).documents).toHaveLength(50)
})
it('rejects duplicate or out-of-range reranker indexes',async()=>{
 const original=transport.getMockImplementation()!;transport.mockImplementation(async(...args)=>transport.mock.calls.length===3?new Response(JSON.stringify({model:'rerank-2.5',data:[{index:0,relevance_score:.9},{index:0,relevance_score:.5}]}),{headers:{'Content-Type':'application/json'}}):original(...args))
 await expect(run()).rejects.toMatchObject({status:502})
})
