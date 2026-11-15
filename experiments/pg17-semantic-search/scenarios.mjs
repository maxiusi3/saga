import {randomUUID,createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {databaseHttp} from '../recording-flow-browser/database-http.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
const require=createRequire(import.meta.url),{NextRequest}=require('next/server')
const sha=text=>createHash('sha256').update(text).digest('hex'),vec=(x,y)=>[x,y,...Array(1022).fill(0)]
export async function semanticScenarios({h,source,evidence}){
 await source('experiments/pg17-semantic-search/scenarios.mjs')
 const proof=join(evidence,'semantic');await mkdir(proof,{recursive:true})
 const owner=randomUUID(),member=randomUUID(),other=randomUUID(),project=randomUUID(),story=randomUUID(),asset=randomUUID(),transcript=randomUUID()
 const texts=['Grandmother moved overseas.','She cooked delicious soup.'],full=texts.join('\n\n')
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,other,'semantic-owner@example.invalid','semantic-member@example.invalid','semantic-other@example.invalid'])
 await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Semantic family', $2)",[project,owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 await h.db.query("INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,'Grandmother', $4)",[story,project,owner,full])
 const rate=8000,wav=Buffer.alloc(44+rate*2*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40)
 for(let i=44;i<wav.length;i+=2)wav.writeInt16LE(Math.round(Math.sin(i/2)*1000),i)
 const key=`${owner}/projects/${project}/${asset}.wav`
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/wav',$6,$7,4000,'ready')",[asset,project,story,owner,key,sha(wav),wav.length])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'controlled','fixture','aligned',$5,$6,$7)",[transcript,project,story,asset,sha(full),full,owner])
 for(let i=0;i<texts.length;i++)await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text,start_ms,end_ms) VALUES($1,$2,$3,$4,$5,$6)',[project,transcript,i,texts[i],i*2000,i*2000+1800])
 const sql='SELECT semantic_source_snapshot($1,$2,$3,$4,$5) r',policy='a'.repeat(64)
 for(const role of ['anon','authenticated'])h.eq((await h.actor(role,owner,sql,[owner,project,policy,'us',true])).sqlstate,'42501','cannot spoof semantic actor '+role)
 h.eq((await h.actor('service_role',other,sql,[other,project,policy,'us',true])).sqlstate,'42501','foreign family rejected')
 h.eq((await h.actor('service_role',owner,sql,[owner,project,policy,'us',false])).sqlstate,'42501','missing consent rejected')
 const first=await h.actor('service_role',owner,sql,[owner,project,policy,'us',true]);h.eq(first.sqlstate,'00000','explicit consent snapshot');h.eq(first.rows[0].r.entries.length,2,'entire current corpus')
 h.eq((await h.actor('service_role',owner,"SELECT search_project_sources($1,$2,'relocation','','','') r",[owner,project])).rows[0].r.entries,[],'zero lexical overlap baseline')
 const db=await databaseHttp(h,{allowedFunctions:['semantic_source_snapshot','search_project_sources','resolve_search_citation']});db.objects.set('audio-recordings/'+key,{bytes:wav,type:'audio/wav'})
 const calls=[];let mutation=null,malformed=false
 const provider=createServer(async(req,res)=>{try{const chunks=[];for await(const b of req)chunks.push(b);const body=JSON.parse(Buffer.concat(chunks).toString());calls.push({path:req.url,inputType:body.input_type??null,count:body.input?.length??body.documents?.length})
  let data
  if(body.input_type)data={model:body.model,data:body.input.map((text,index)=>({index,embedding:vec(text==='relocation'||text.includes('moved')?1:0,text==='relocation'||text.includes('moved')?0:1)}))}
  else data={model:body.model,data:body.documents.map((text,index)=>({index,relevance_score:text.includes('moved')?.99:.01}))}
  if(mutation){const fn=mutation;mutation=null;await fn()}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(malformed?'{}':JSON.stringify(data))
 }catch(e){res.writeHead(500);res.end()}})
 await new Promise(done=>provider.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${provider.address().port}`
 const saved=Object.fromEntries(['MEDIA_ASSETS_ENABLED','SEMANTIC_SEARCH_ENABLED','VOYAGE_API_KEY','VOYAGE_BASE_URL','VOYAGE_REGION','VOYAGE_EMBEDDING_MODEL','VOYAGE_RERANK_MODEL','PROVIDER_POLICY_EVIDENCE_JSON'].map(k=>[k,process.env[k]]))
 Object.assign(process.env,{MEDIA_ASSETS_ENABLED:'true',SEMANTIC_SEARCH_ENABLED:'true',VOYAGE_API_KEY:'synthetic-only',VOYAGE_BASE_URL:'https://api.voyageai.com/v1',VOYAGE_REGION:'us',VOYAGE_EMBEDDING_MODEL:'voyage-4-large',VOYAGE_RERANK_MODEL:'rerank-2.5',PROVIDER_POLICY_EVIDENCE_JSON:JSON.stringify(['voyage-4-large','rerank-2.5'].map(modelId=>({provider:'voyage',modelId,accountOrOrgId:'synthetic-only',allowedRegions:['us'],trainingOptOutConfirmed:true,zeroDataRetentionConfirmed:true,maxRetentionDaysAllowed:0,evidenceDate:new Date().toISOString(),evidenceReference:'controlled-transport-not-qualification'})))})
 const nativeFetch=globalThis.fetch
 globalThis.fetch=(url,init)=>nativeFetch(String(url).startsWith('https://api.voyageai.com/v1')?String(url).replace('https://api.voyageai.com',origin):url,init)
 globalThis.__semanticAdmin=db.admin
 const seam=join(h.scratch,'semantic-seam.cjs')
 await writeFile(seam,`const{NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__semanticAdmin;exports.getAuthenticatedUser=async r=>{const id=(r.headers.get('authorization')||'').replace('Bearer synthetic-semantic-','');return ${JSON.stringify([owner,member,other])}.includes(id)?{ok:true,user:{id},headers:new Headers()}:{ok:false,response:NextResponse.json({error:'Synthetic auth required'},{status:401})}};`)
 try{
  const seams={'@/lib/supabase':seam,'@/lib/server/auth':seam},compiled=join(h.scratch,'semantic-routes')
  const route=await compileModule('app/api/projects/[id]/search/route.ts',compiled,source,seams),sourceRoute=await compileModule('app/api/projects/[id]/search/source/route.ts',compiled,source,seams)
  const context={params:Promise.resolve({id:project})},get=(actor=owner)=>route.GET(new NextRequest(`http://localhost/api/projects/${project}/search?mode=semantic&readiness=1`,{headers:{authorization:`Bearer synthetic-semantic-${actor}`}}),context)
  const readiness=(await (await get()).json()).semantic;h.ok(readiness.ready,'actual readiness enabled')
  const body={query:'relocation',mode:'semantic',consent:true,policyVersion:readiness.policyVersion}
  const post=(actor=owner,changes={})=>route.POST(new NextRequest(`http://localhost/api/projects/${project}/search`,{method:'POST',headers:{authorization:`Bearer synthetic-semantic-${actor}`},body:JSON.stringify({...body,...changes})}),context)
  h.eq((await post(other)).status,403,'actual route denies other family');h.eq(calls.length,0,'foreign family no provider transmission')
  h.eq((await post(owner,{consent:false})).status,403,'explicit consent required');h.eq(calls.length,0,'no consent no provider transmission')
  const response=await post();const result=await response.json();h.eq(response.status,200,'actual route semantic success');h.eq(result.citations[0].quotedText,texts[0],'synonym retrieved with vector then rerank');h.eq(calls.length,3,'actual controlled provider HTTP calls')
  const identity=Object.fromEntries(['entryId','storyId','storyRevisionId','transcriptVersionId','segmentId','mediaAssetId','sourceHash','sourceFingerprint','startMs','endMs'].map(k=>[k,result.citations[0][k]]))
  const play=()=>sourceRoute.POST(new NextRequest('http://localhost/source',{method:'POST',headers:{authorization:`Bearer synthetic-semantic-${owner}`},body:JSON.stringify(identity)}),context)
  h.eq((await play()).status,200,'semantic citation resolves through real protected source route')
  mutation=()=>h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,member]);h.eq((await post(member)).status,403,'revoked while embedding denied before next provider call')
  mutation=()=>h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'b'.repeat(64)]);h.eq((await post()).status,409,'changed asset while embedding invalidates result');await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,sha(wav)])
  malformed=true;h.eq((await post()).status,502,'malformed provider rejected');malformed=false
  if(process.argv.includes('--chrome')){const {semanticChrome}=await import('./chrome.mjs');await semanticChrome({h,source,evidence:proof,owner,project,story,route,sourceRoute,db,calls})}
  mutation=()=>h.db.query('UPDATE consent_records SET withdrawn_at=now() WHERE project_id=$1 AND grantor_id=$2',[project,owner]);h.eq((await post()).status,403,'withdrawal during provider wait blocks return')
  await h.db.query("UPDATE transcript_segments SET text='Corrected family recollection.',is_human_corrected=true WHERE transcript_version_id=$1 AND segment_index=0",[transcript]);await h.db.query('UPDATE transcript_versions SET full_text=$2,content_sha256=$3,alignment_status=\'human_corrected\' WHERE id=$1',[transcript,'Corrected family recollection.\n\n'+texts[1],sha('Corrected family recollection.\n\n'+texts[1])]);await h.db.query('UPDATE stories SET transcript=$2 WHERE id=$1',[story,'Corrected family recollection.\n\n'+texts[1]])
  h.eq((await play()).status,409,'old semantic playback identity invalidated after correction')
  const corrected=await (await post()).json();h.ok(corrected.citations.some(c=>c.sourceKind==='family_supplement'&&c.mediaAssetId===null&&c.startMs===null),'corrected sources cannot invent timing')
  mutation=()=>h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[project,story,owner]);h.eq((await post()).status,409,'deletion during embedding invalidates result')
  const empty=await (await post()).json();h.eq(empty.citations,[],'deleted story never resends stale text')
  process.env.SEMANTIC_SEARCH_ENABLED='false';const before=calls.length;h.eq((await post()).status,503,'configuration off');h.eq(calls.length,before,'off mode no network')
  await limits(h,owner)
  await approvedAiSearch(h,owner)
  h.report.semantic={status:'passed',project,story,asset,providerCalls:calls,sdkRequests:db.requests.length,boundary:'Actual routes and Supabase SDK over controlled PostgREST/Storage and provider HTTP, native PG17. Synthetic vectors establish computation/wiring, not live Voyage retrieval quality.'}
  await writeFile(join(proof,'semantic.json'),JSON.stringify(h.report.semantic,null,2))
 }finally{globalThis.fetch=nativeFetch;delete globalThis.__semanticAdmin;for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}await new Promise(done=>provider.close(done));await db.close()}
}
async function limits(h,owner){
 const project=randomUUID(),story=randomUUID(),asset=randomUUID(),transcript=randomUUID();await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Semantic limits',$2)",[project,owner]);const texts=Array.from({length:257},(_,i)=>'Full source '+i),full=texts.join('\n\n')
 await h.db.query('INSERT INTO stories(id,project_id,transcript) VALUES($1,$2,$3)',[story,project,full]);await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,state) VALUES($1,$2,$3,$4,'audio-recordings',($1::uuid)::text,'original_audio','audio/wav',$5,'ready')",[asset,project,story,owner,'a'.repeat(64)]);await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'fixture','fixture','legacy_unaligned',$5,$6,$7)",[transcript,project,story,asset,sha(full),full,owner]);await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text) SELECT $1,$2,n-1,value FROM jsonb_array_elements_text($3::jsonb) WITH ORDINALITY a(value,n)',[project,transcript,JSON.stringify(texts)])
 h.eq((await h.actor('service_role',owner,"SELECT semantic_source_snapshot($1,$2,$3,'us',true)",[owner,project,'a'.repeat(64)])).sqlstate,'54000','reject 257 sources rather than lexical top50 truncation')
 const replace=async paragraphs=>{const full=paragraphs.join('\n\n');await h.db.query('DELETE FROM transcript_segments WHERE transcript_version_id=$1',[transcript]);await h.db.query('UPDATE stories SET transcript=$2 WHERE id=$1',[story,full]);await h.db.query('UPDATE transcript_versions SET full_text=$2,content_sha256=$3 WHERE id=$1',[transcript,full,sha(full)]);await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text) SELECT $1,$2,n-1,value FROM jsonb_array_elements_text($3::jsonb) WITH ORDINALITY a(value,n)',[project,transcript,JSON.stringify(paragraphs)])}
 const snap=()=>h.actor('service_role',owner,"SELECT semantic_source_snapshot($1,$2,$3,'us',true) r",[owner,project,'a'.repeat(64)])
 await replace(texts.slice(0,256));const bounded=await snap();h.eq(bounded.sqlstate,'00000','256 whole sources accepted');h.eq(bounded.rows[0].r.entries.length,256,'entire corpus not first50')
 await replace(['x'.repeat(1201)]);h.eq((await snap()).sqlstate,'54000','long source explicitly rejected without truncation')
 await replace(Array.from({length:65},()=> 'x'.repeat(1024)));h.eq((await snap()).sqlstate,'54000','UTF8 total byte cap explicit')

}

async function approvedAiSearch(h,owner){
 const project=randomUUID(),story=randomUUID(),asset=randomUUID(),sourceText='Um, she moved overseas.',paraphrase='She relocated abroad.'
 await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Approved AI source',$2)",[project,owner]);await h.db.query("INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,'AI supported source','Initial')",[story,project,owner]);await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',($1::uuid)::text,'original_audio','audio/wav',$5,120,3000,'ready')",[asset,project,story,owner,'a'.repeat(64)])
 let state
 const review=async(op,payload={})=>{const r=await h.actor('service_role',owner,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r',[owner,story,op,randomUUID(),state?.revision.edit_version??0,JSON.stringify(payload)]);h.eq(r.sqlstate,'00000','AI search review '+op);state=r.rows[0].r;return state}
 await review('ingest_transcript',{local_worker:true,source_hash:sha('Initial'),asset_id:asset,provider:'local_fixture',model:'controlled',language:'en',segments:[{text:sourceText,start_ms:0,end_ms:2000,confidence:.9}]})
 const configuration={editor:{provider:'anthropic',model:'claude-opus-5-5',region:'us'},reviewer:{provider:'openai',model:'gpt-6-astra',region:'us'}},policy='g2-ai-'+'a'.repeat(64),request=randomUUID()
 const ai=async(op,payload,expected='00000')=>{const r=await h.actor('service_role',owner,'SELECT story_ai_edit($1,$2,$3,$4,$5::jsonb) r',[owner,story,op,request,JSON.stringify(payload)]);h.eq(r.sqlstate,expected,'AI search '+op);return r.rows?.[0]?.r}
 const reserve=await ai('reserve',{consent:true,configuration,policy_version:policy,revision_id:state.revision.id,expected_version:state.revision.edit_version,transcript_id:state.transcript.id,source_hash:state.revision.source_hash,source_fingerprint:state.revision.provenance_snapshot.source_fingerprint}),lease={lease_token:reserve.leaseToken,policy_version:policy}
 await ai('editor',lease);await ai('reviewer',lease)
 const result={paragraphs:state.transcript.segments.map(s=>({text:paraphrase,segmentId:s.id,sourceQuote:s.text,startMs:s.start_ms,endMs:s.end_ms})),verdicts:[{index:0,supported:true,severity:'none',risks:[]}],metadata:{editor:{...configuration.editor,responseId:'controlled-editor',inputTokens:20,outputTokens:20},reviewer:{...configuration.reviewer,responseId:'controlled-reviewer',inputTokens:20,outputTokens:20}}}
 await ai('complete',{...lease,result:{...result,verdicts:[{index:0,supported:false,severity:'severe',risks:['unsupported']}] }},'23514')
 state=(await ai('complete',{...lease,result})).review
 const snap=async()=>{const r=await h.actor('service_role',owner,"SELECT semantic_source_snapshot($1,$2,$3,'us',true) r",[owner,project,'a'.repeat(64)]);h.eq(r.sqlstate,'00000','AI search snapshot');return r.rows[0].r}
 const pending=await snap();h.ok(pending.entries.every(c=>c.reviewStatus==='source_only'&&c.quotedText!==paraphrase),'unapproved AI never masquerades as approved original')
 await review('decide_assertion',{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action:'accept'});await review('approve_revision',{revision_id:state.revision.id})
 const approved=await snap();h.eq(approved.entries.length,1,'approved AI source is discoverable');h.eq(approved.entries[0].quotedText,sourceText,'AI citation quotes original wording, not paraphrase');h.eq([approved.entries[0].reviewStatus,approved.entries[0].startMs,approved.entries[0].endMs,approved.entries[0].storyRevisionId],['approved',0,2000,state.revision.id],'approved AI retains true source timing and revision')
 h.eq((await h.actor('service_role',owner,"SELECT search_project_sources($1,$2,$3,'','','') r",[owner,project,'moved'])).rows[0].r.entries[0].quotedText,sourceText,'literal search shares approved AI original quote')
}
