import {randomUUID} from 'node:crypto'
export async function storyAiEditScenarios({h,source,evidence}){
 const owner=randomUUID(),member=randomUUID(),other=randomUUID(),project=randomUUID()
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,other,'ai-owner@example.invalid','ai-member@example.invalid','ai-other@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Synthetic AI family',owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 const review=async(story,operation='read',state=null,extra={},actor=owner)=>(await h.db.query('SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r',[actor,story,operation,operation==='read'?null:randomUUID(),state?.revision.edit_version??null,JSON.stringify({...state?{revision_id:state.revision.id}:{},...extra})])).rows[0].r
 const create=async()=>{const story=randomUUID();await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'Synthetic memory','Um, I left school in 1972 and, well, began working at the mill.']);return {story,state:await review(story,'prepare')}}
 const configuration={editor:{provider:'anthropic',model:'claude-opus-5-5',region:'us'},reviewer:{provider:'openai',model:'gpt-6-astra',region:'us'}},policy='g2-ai-'+'a'.repeat(64)
 const payload=state=>({consent:true,configuration,policy_version:policy,revision_id:state.revision.id,expected_version:state.revision.edit_version,transcript_id:state.transcript.id,source_hash:state.revision.source_hash,source_fingerprint:state.revision.provenance_snapshot.source_fingerprint})
 const rpc=async(story,op,id,p={},actor=owner,expected='00000')=>{const sql='SELECT story_ai_edit($1,$2,$3,$4,$5::jsonb) r',args=[actor,story,op,id,JSON.stringify(p)];const result=await h.actor('service_role',actor,sql,args);if(result.sqlstate!==expected){try{await h.db.query(sql,args)}catch(error){h.report.aiDebug={op,message:error.message,where:error.where,code:error.code}}}h.eq(result.sqlstate,expected,'AI '+op+' '+expected);return result.rows?.[0]?.r}
 const reserve=async fixture=>{const id=randomUUID(),p=payload(fixture.state),r=await rpc(fixture.story,'reserve',id,p);return {id,p,lease:{lease_token:r.leaseToken,policy_version:policy}}}
 const output=state=>({paragraphs:state.transcript.segments.map(s=>({text:'I left school in 1972 and began working at the mill.',segmentId:s.id,sourceQuote:s.text,startMs:s.start_ms,endMs:s.end_ms})),verdicts:state.transcript.segments.map((_,index)=>({index,supported:true,severity:'none',risks:[]})),metadata:{editor:{...configuration.editor,responseId:'controlled-msg',inputTokens:100,outputTokens:50},reviewer:{...configuration.reviewer,responseId:'controlled-response',inputTokens:100,outputTokens:50}}})
 const fixture=await create(),r=await reserve(fixture),result=output(fixture.state)
 for(const role of ['anon','authenticated'])h.eq((await h.actor(role,owner,'SELECT story_ai_edit($1,$2,\'status\',NULL,\'{}\')',[owner,fixture.story])).sqlstate,'42501','AI RPC private '+role)
 await rpc(fixture.story,'reserve',randomUUID(),payload(fixture.state),other,'42501')
 await rpc(fixture.story,'reserve',randomUUID(),{...payload(fixture.state),consent:false},owner,'22023')
 const duplicate=await rpc(fixture.story,'reserve',r.id,r.p);h.eq(duplicate.status,'prepared','reservation retry is pending');h.ok(!duplicate.leaseToken,'retry cannot acquire sender token')
 await rpc(fixture.story,'editor',r.id,r.lease);await rpc(fixture.story,'editor',r.id,r.lease,owner,'23505')
 await rpc(fixture.story,'complete',r.id,{...r.lease,result},owner,'23505')
 await rpc(fixture.story,'reviewer',r.id,r.lease)
 for(const change of [{segmentId:randomUUID()},{sourceQuote:'invented safe quote'},{startMs:42}]){
  const bad=structuredClone(result);Object.assign(bad.paragraphs[0],change);await rpc(fixture.story,'complete',r.id,{...r.lease,result:bad},owner,'23514')
 }
 const severe=structuredClone(result);severe.verdicts[0].severity='severe';await rpc(fixture.story,'complete',r.id,{...r.lease,result:severe},owner,'23514')
 const unsupported=structuredClone(result);unsupported.verdicts[0].supported=false;await rpc(fixture.story,'complete',r.id,{...r.lease,result:unsupported},owner,'23514')
 let complete=await rpc(fixture.story,'complete',r.id,{...r.lease,result:{...result,body:'ARBITRARY_UNREVIEWED_BODY'}})
 let state=complete.review;h.eq(state.revision.body,result.paragraphs[0].text,'actual edited paragraph is body');h.ok(state.revision.body!==fixture.state.revision.body,'editing differs visibly from source');h.ok(!state.revision.body.includes('ARBITRARY'),'unbound body ignored');h.eq(state.assertions[0].ai_review.supported,true,'model evidence displayed')
 h.eq((await rpc(fixture.story,'reserve',r.id,r.p)).status,'completed','completed retry returns durable result')
 h.eq((await h.actor('service_role',owner,'UPDATE story_assertions SET ai_evidence=\'{}\' WHERE id=$1',[state.assertions[0].id])).sqlstate,'23514','cannot forge AI evidence directly')
 h.eq((await h.actor('service_role',owner,'SELECT story_review($1,$2,\'approve_revision\',$3,$4,$5::jsonb)',[owner,fixture.story,randomUUID(),state.revision.edit_version,JSON.stringify({revision_id:state.revision.id})])).sqlstate,'23514','model does not autoapprove')
 state=await review(fixture.story,'decide_assertion',state,{assertion_id:state.assertions[0].id,action:'accept'})
 state=await review(fixture.story,'approve_revision',state);h.eq(state.revision.status,'approved','family can approve source-backed paraphrase');h.eq(state.revision.body,result.paragraphs[0].text,'approved body remains actual reviewed paragraph')
 const approved=state.revision.id,approvedBytes=(await h.db.query('SELECT to_jsonb(r) r FROM story_revisions r WHERE id=$1',[approved])).rows[0].r
 h.eq((await h.actor('service_role',owner,"UPDATE story_revisions SET body='background overwrite' WHERE id=$1",[approved])).sqlstate,'23514','approved AI draft immutable')
 const next=await reserve({story:fixture.story,state});await rpc(fixture.story,'editor',next.id,next.lease);await rpc(fixture.story,'reviewer',next.id,next.lease);await rpc(fixture.story,'complete',next.id,{...next.lease,result:output(state)})
 h.eq((await h.db.query('SELECT to_jsonb(r) r FROM story_revisions r WHERE id=$1',[approved])).rows[0].r,approvedBytes,'new AI draft preserves approved history')
 // Pending results revalidate membership, consent, source CAS and G1 tombstones.
 for(const kind of ['source','decision','consent','membership','deletion']){
  const f=await create(),actor=kind==='membership'?member:owner,id=randomUUID(),p=payload(f.state),res=await rpc(f.story,'reserve',id,p,actor),lease={lease_token:res.leaseToken,policy_version:policy}
  await rpc(f.story,'editor',id,lease,actor);await rpc(f.story,'reviewer',id,lease,actor)
  if(kind==='source')await review(f.story,'correct_transcript',f.state,{text:'Corrected source, no old model result.'})
  if(kind==='decision')await review(f.story,'decide_assertion',f.state,{assertion_id:f.state.assertions[0].id,action:'accept'})
  if(kind==='consent')await h.db.query("UPDATE consent_records SET withdrawn_at=clock_timestamp() WHERE subject_id=$1 AND provider='openai'",[f.story])
  if(kind==='membership')await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,member])
  if(kind==='deletion')await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,f.story,randomUUID()])
  await rpc(f.story,'complete',id,{...lease,result:output(f.state)},actor,['consent','membership'].includes(kind)?'42501':'23505')
  if(kind==='source'||kind==='decision'||kind==='consent'){const status=await rpc(f.story,'status',null);h.eq(status.status,'invalidated','readiness retires obsolete pending attempt');const current=await review(f.story);const replacement=await reserve({story:f.story,state:current});h.ok(replacement.lease.lease_token,'new source/CAS/consent can replace stale pending identity')}
  if(kind==='membership')await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",[project,member])
  if(kind==='deletion')h.eq((await h.db.query('SELECT count(*)::int n FROM story_ai_edit_requests WHERE story_id=$1',[f.story])).rows[0].n,0,'erasure removes pending identity')
 }
 await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,fixture.story,randomUUID()])
 for(const table of ['story_assertions','story_revisions','story_ai_edit_requests'])h.eq((await h.db.query(`SELECT count(*)::int n FROM ${table} WHERE story_id=$1`,[fixture.story])).rows[0].n,0,'AI approved erasure '+table)
 await rpc(fixture.story,'complete',r.id,{...r.lease,result},owner,'23505')
 await source('experiments/pg17-story-ai-edit/provenance-scenarios.mjs');const {aiProvenanceScenarios}=await import('./provenance-scenarios.mjs');await aiProvenanceScenarios({h,owner,member,project})
 h.report.storyAiEdit={status:'passed',checks:['RPC isolation','consent','deduplicated outbound','bound paragraphs','false citation and severe rejection','family approval','immutable history','source CAS','revoked membership and consent','G1 erasure','corrected source attribution','same-text family modification remains searchable'],boundary:'Complete native PG17 schema, synthetic families, direct service-role RPCs. No external model quality claim.'}
 if(process.argv.includes('--chrome')){await source('experiments/pg17-story-ai-edit/chrome.mjs');const {storyAiEditChrome}=await import('./chrome.mjs');await storyAiEditChrome({h,source,evidence,owner,member,other,project})}
}
