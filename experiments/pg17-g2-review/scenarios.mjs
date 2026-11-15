import { randomUUID } from 'node:crypto'
export async function storyReviewScenarios({h,source,evidence}) {
 h.ok((await h.db.query("SELECT to_regprocedure('public.story_review(uuid,uuid,text,uuid,integer,jsonb)') AS rpc")).rows[0].rpc,'atomic review RPC exists')
 const owner=randomUUID(),member=randomUUID(),other=randomUUID(),project=randomUUID(),story=randomUUID()
 const raw='G2_PRIVATE_FIRST\n\nG2_PRIVATE_SECOND\n\nG2_PRIVATE_REJECT'
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,other,'g2-owner@example.invalid','g2-member@example.invalid','g2-other@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'G2 local review',owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'G2_PRIVATE_TITLE',raw])
 const sql='SELECT public.story_review($1,$2,$3,$4,$5,$6::jsonb) AS review'
 const args=(actor,op,requestId=null,version=null,payload={})=>[actor,story,op,requestId,version,JSON.stringify(payload)]
 const invoke=async(actor,op,id=null,version=null,payload={},expected='00000')=>{
   const values=args(actor,op,id,version,payload),r=await h.actor('service_role',actor,sql,values)
   if(r.sqlstate!==expected){ const c=await h.actorClient('service_role',actor);try{await c.query(sql,values)}catch(error){h.report.reviewDebug={op,code:error.code,message:error.message,where:error.where}}finally{await h.close(c)} }
   h.eq(r.sqlstate,expected,`${op} expected ${expected}`);return r.rows?.[0]?.review
 }
 for(const role of ['anon','authenticated'])h.eq((await h.actor(role,owner,sql,args(owner,'read'))).sqlstate,'42501',role+' no RPC execution')
 await invoke(other,'read',null,null,{},'42501')
 h.eq((await invoke(owner,'read')).revision,null,'read never invents a draft')
 const prepareId=randomUUID();let state=await invoke(owner,'prepare',prepareId)
 const first=state.revision.id;
 h.eq((await h.actor('service_role',owner,"UPDATE transcript_segments SET text='injected source' WHERE id=$1",[state.transcript.segments[0].id])).sqlstate,'23514','referenced segment cannot mutate')
 h.eq((await h.actor('service_role',owner,"UPDATE transcript_versions SET provider='invented' WHERE id=$1",[state.transcript.id])).sqlstate,'23514','referenced transcript metadata cannot mutate')
h.eq(state.assertions.length,3,'one assertion per paragraph');h.eq(state.transcript.provider,'legacy','no invented ASR provider')
 h.eq(state.transcript.model,'imported-text','imported model recorded');h.eq(state.transcript.alignment_status,'legacy_unaligned','legacy alignment explicit')
 h.ok(state.transcript.segments.every(s=>s.start_ms===null&&s.end_ms===null&&s.confidence===null),'unknown timing/confidence remain null')
 h.eq(await invoke(owner,'prepare',prepareId),state,'exact prepare retry');await invoke(owner,'prepare',prepareId,null,{text:'changed'},'23505')
 await invoke(owner,'approve_revision',randomUUID(),0,{revision_id:first},'23514')
 h.eq(state.revision.body,raw,'draft preview includes actual source before approval')
 const ids=state.assertions.map(x=>x.id)
 const decide=async(actor,index,action,text,id=randomUUID(),v=state.revision.edit_version)=>{const p={revision_id:state.revision.id,assertion_id:ids[index],action};if(text!==undefined)p.text=text;const next=await invoke(actor,'decide_assertion',id,v,p);state=next;return {next,id,p,v}}
 const mod=await decide(member,0,'modify','G2_PRIVATE_FAMILY')
 h.eq(state.assertions[0].memory_attribution,'family_supplement','modified text attributed to family');h.eq(state.assertions[0].review_status,'family_supplement','edited quote never audio verified');h.eq(state.assertions[0].evidence_refs,[],'modified statement loses audio evidence claims')
 h.eq(await invoke(member,'decide_assertion',mod.id,mod.v,mod.p),state,'exact decision retry');await invoke(member,'decide_assertion',mod.id,mod.v,{...mod.p,text:'different'},'23505')
 await decide(owner,0,'dispute','G2_PRIVATE_FAMILY_ALTERNATIVE')
 h.eq(state.assertions[0].memory_attribution,'family_supplement','dispute preserves primary supplement attribution')
 h.eq(state.assertions[0].supplemented_by,member,'dispute preserves supplement origin author')
 h.eq(state.assertions[0].reviewed_by,owner,'latest reviewer is tracked separately')
 h.eq(state.assertions[0].alternatives[0].actor_id,owner,'alternative attributed to disputing member')
 h.eq(state.assertions[0].evidence_refs,[],'disputed supplement never regains audio evidence')
 h.ok(state.revision.body.includes('[Family supplement: '+member+']')&&state.revision.body.includes('[Alternative: '+owner+'] G2_PRIVATE_FAMILY_ALTERNATIVE'),'draft renders both authors separately')
 await invoke(owner,'decide_assertion',randomUUID(),0,{revision_id:first,assertion_id:ids[1],action:'accept'},'23505')
 await decide(member,1,'dispute','G2_PRIVATE_ALTERNATIVE_ONE');await decide(owner,1,'dispute','G2_PRIVATE_ALTERNATIVE_TWO')
 h.eq(state.assertions[1].alternatives.map(a=>a.actor_id),[member,owner],'multiple dispute authors preserved')
 await decide(owner,2,'reject')
 h.ok(state.revision.body.includes('G2_PRIVATE_FAMILY')&&!state.revision.body.includes('G2_PRIVATE_REJECT'),'draft preview reflects modified and rejected claims')
 await invoke(member,'approve_revision',randomUUID(),state.revision.edit_version,{revision_id:first},'42501')
 const approvalId=randomUUID(),approvalVersion=state.revision.edit_version;state=await invoke(owner,'approve_revision',approvalId,approvalVersion,{revision_id:first})
 h.ok(state.revision.body.includes('G2_PRIVATE_FAMILY')&&!state.revision.body.includes('G2_PRIVATE_FIRST')&&!state.revision.body.includes('G2_PRIVATE_REJECT'),'body built from actual decisions')
 h.ok(state.revision.body.includes('G2_PRIVATE_ALTERNATIVE_ONE')&&state.revision.body.includes('G2_PRIVATE_ALTERNATIVE_TWO')&&state.revision.body.includes(member),'approved rendition includes attributed alternatives')
 h.eq(await invoke(owner,'approve_revision',approvalId,approvalVersion,{revision_id:first}),state,'approval retry stable')
 h.eq(state.revision.provenance_snapshot.assertions[0].supplemented_by,member,'approved provenance retains supplement author')
 h.eq(state.revision.provenance_snapshot.assertions[0].reviewed_by,owner,'approved provenance retains latest reviewer')
 const immutable=(await h.db.query('SELECT to_jsonb(r) AS r FROM story_revisions r WHERE id=$1',[first])).rows[0].r
 for(const statement of ["body='tampered'","title='tampered'","summary='tampered'","provenance_snapshot='{}'","provenance_links='[]'","approved_by=NULL","approved_at=NULL","source_hash=NULL"])
 h.eq((await h.actor('service_role',owner,`UPDATE story_revisions SET ${statement} WHERE id=$1`,[first])).sqlstate,'23514','approved mutation denied '+statement)
 h.eq((await h.actor('service_role',owner,'DELETE FROM story_revisions WHERE id=$1',[first])).sqlstate,'23514','approved delete denied outside G1 purge')
 h.eq((await h.actor('service_role',owner,"UPDATE story_assertions SET claim_text='tampered' WHERE id=$1",[ids[0]])).sqlstate,'23514','approved assertion cannot mutate')
 state=await invoke(owner,'correct_transcript',randomUUID(),state.revision.edit_version,{revision_id:first,text:'G2_PRIVATE_CORRECTED'})
 h.eq(state.transcript.alignment_status,'human_corrected','correction explicit');h.eq(state.assertions[0].review_decision,null,'new revision requires fresh decisions')
 h.eq((await h.db.query('SELECT to_jsonb(r) AS r FROM story_revisions r WHERE id=$1',[first])).rows[0].r,immutable,'approved history untouched by correction')
 const corrected=state.revision.id
 await h.db.query("UPDATE stories SET transcript='direct legacy edit' WHERE id=$1",[story])
 h.eq((await invoke(owner,'read')).sourceChanged,true,'direct legacy edit detected')
 await invoke(owner,'approve_revision',randomUUID(),state.revision.edit_version,{revision_id:corrected},'23505')
 await invoke(owner,'correct_transcript',randomUUID(),state.revision.edit_version,{revision_id:corrected,text:'overwrite'},'23505')
 await invoke(owner,'prepare',prepareId,null,{},'23505')
 state=await invoke(owner,'prepare',randomUUID());h.eq((await h.db.query('SELECT status FROM story_revisions WHERE id=$1',[corrected])).rows[0].status,'invalidated','new source invalidates old draft')
 await h.db.query("UPDATE project_roles SET status='removed' WHERE user_id=$1 AND project_id=$2",[member,project])
 await invoke(member,'read',null,null,{},'42501');await invoke(member,'decide_assertion',mod.id,mod.v,mod.p,'42501')
 // Both writes start with the same version; the story lock serializes them and only one succeeds.
 const concurrent=await Promise.all(['accept','reject'].map(action=>h.actor('service_role',owner,sql,args(owner,'decide_assertion',randomUUID(),state.revision.edit_version,{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action}))))
 h.eq(concurrent.map(r=>r.sqlstate).sort(),['00000','23505'],'simultaneous edit is CAS protected')
 // Superseded and malformed historical approvals remain protected even without approved_at.
 h.eq((await h.actor('service_role',owner,"UPDATE story_revisions SET status='superseded' WHERE id=$1",[first])).sqlstate,'00000','approved can be superseded')
 h.eq((await h.actor('service_role',owner,"UPDATE story_revisions SET body='tampered' WHERE id=$1",[first])).sqlstate,'23514','superseded snapshot remains immutable')
 // Arbitrary claims cannot acquire grounding merely by matching their own source_quote.
 state=await invoke(owner,'read')
 const ungrounded=state.assertions[0].id
 h.eq((await h.actor('service_role',owner,"UPDATE story_assertions SET claim_text='forged claim',source_quote='forged claim',review_decision='accepted',reviewed_by=$2 WHERE id=$1",[ungrounded,owner])).sqlstate,'23514','direct service claim spoof is denied before approval')
 h.eq((await h.actor('service_role',owner,'DELETE FROM story_assertions WHERE id=$1',[ungrounded])).sqlstate,'23514','cannot bypass review by removing source assertion')
 const legacyApproval=randomUUID()
 await h.db.query("INSERT INTO story_revisions(id,project_id,story_id,transcript_version_id,revision_number,status,title,body,summary,content_sha256,created_by) SELECT $1,project_id,story_id,transcript_version_id,100,'approved','legacy','legacy','legacy',content_sha256,created_by FROM story_revisions WHERE id=$2",[legacyApproval,first])
 h.eq((await h.actor('service_role',owner,"UPDATE story_revisions SET provenance_links='[{\"invented\":true}]' WHERE id=$1",[legacyApproval])).sqlstate,'23514','null approval markers do not bypass immutable status')
 // Real G1 authorized purge is the only deletion capability, and removes contentless retry identities too.
 const deletionId=randomUUID();h.eq((await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,deletionId])).sqlstate,'00000','G1 erases approved review without bypass flag')
 for(const table of ['story_review_requests','story_revisions','story_assertions','transcript_versions'])h.eq((await h.db.query(`SELECT count(*)::int AS n FROM ${table} WHERE story_id=$1`,[story])).rows[0].n,0,'purge removes '+table)
 await invoke(owner,'read',null,null,{},'23505');await invoke(owner,'prepare',prepareId,null,{},'23505')
 await transcriptionScenarios(h,owner,project)
 await legacyTimedTranscript(h,owner,project)
 await mediaSourceBinding(h,owner,project)
 await firstSourceCaptureRace(h,owner,project)
 await correctionSupplementAuthors(h,owner,project)
 h.eq((await h.db.query('SELECT count(*)::int n FROM story_review_context')).rows[0].n,0,'review transaction authority fully cleared')
 h.report.storyReview={status:'passed',owner,member,other,project,story,evidence,boundary:'Native full-schema PG17 synthetic users. No remote ASR or human quality claim.'}
 if(process.argv.includes('--chrome')) {await source('experiments/pg17-g2-review/chrome.mjs');const {storyReviewChrome}=await import('./chrome.mjs');await storyReviewChrome({h,source,evidence,owner,member,other,project})}
}

async function transcriptionScenarios(h,owner,project) {
 h.ok((await h.db.query("SELECT to_regprocedure('public.reserve_story_transcription(uuid,uuid,uuid,integer,jsonb)') AS rpc")).rows[0].rpc,'durable transcription reservation exists')
 const story=randomUUID(),asset=randomUUID(),requestId=randomUUID(),initial='Before ASR',sourceHash=(await h.db.query("SELECT encode(sha256(convert_to($1,'UTF8')),'hex') h",[initial])).rows[0].h
 await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'ASR local',initial])
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,120,5000,'ready')",[asset,project,story,owner,owner+'/projects/'+project+'/'+story+'/original.webm','a'.repeat(64)])
 const payload={source_hash:sourceHash,asset_id:asset,provider:'elevenlabs',model:'scribe_v2',region:'us',policy_version:'v1',consent:true,asset_version:1,asset_sha256:'a'.repeat(64),asset_bucket:'audio-recordings',asset_object_key:owner+'/projects/'+project+'/'+story+'/original.webm'}
 const reserveSql='SELECT reserve_story_transcription($1,$2,$3,$4,$5::jsonb) AS r'
 const reserve=async(id=requestId,p=payload,expected='00000')=>{const result=await h.actor('service_role',owner,reserveSql,[owner,story,id,0,JSON.stringify(p)]);if(result.sqlstate!==expected){const c=await h.actorClient('service_role',owner);try{await c.query(reserveSql,[owner,story,id,0,JSON.stringify(p)])}catch(e){h.report.reservationDebug={message:e.message,where:e.where,code:e.code}}finally{await h.close(c)}}h.eq(result.sqlstate,expected,'reservation '+expected);return result.rows?.[0]?.r}
 await reserve(randomUUID(),{...payload,consent:false},'42501')
 await reserve(randomUUID(),{...payload,source_hash:'b'.repeat(64)},'23505')
 const reservation=await reserve();h.eq(reservation.status,'reserved','first caller owns provider invocation')
 await h.db.query('UPDATE stories SET audio_url=$2 WHERE id=$1',[story,`/api/media/assets/${asset}/play`])
 const permit=await h.actor('service_role',owner,'SELECT begin_story_transcription($1,$2,$3,$4) AS r',[owner,story,requestId,reservation.leaseToken]);h.eq(permit.sqlstate,'00000','atomic outbound permit');h.eq(permit.rows[0].r.started,true,'single provider invocation')
 h.eq((await reserve()).status,'pending','repeat never repeats provider call')
 h.eq((await reserve(randomUUID())).status,'pending','different request cannot bypass pending reservation')
 await reserve(requestId,{...payload,model:'changed'},'23505')
 const consentCount=await h.db.query("SELECT count(*)::int n FROM consent_records WHERE project_id=$1 AND subject_id=$2 AND purpose='cloud_ai'",[project,story]);h.eq(consentCount.rows[0].n,1,'explicit consent recorded once')
 const ingest={...payload,lease_token:reservation.leaseToken,language:'en',segments:[{text:'Actual first excerpt',start_ms:0,end_ms:1800,confidence:.91,speaker_label:'speaker_0'},{text:'Actual second excerpt',start_ms:2000,end_ms:4800,confidence:null,speaker_label:'speaker_0'}]};delete ingest.consent
 const ingestSql="SELECT story_review($1,$2,'ingest_transcript',$3,0,$4::jsonb) AS r"
 const run=async(p=ingest,id=requestId,expected='00000')=>{const r=await h.actor('service_role',owner,ingestSql,[owner,story,id,JSON.stringify(p)]);if(r.sqlstate!==expected){const c=await h.actorClient('service_role',owner);try{await c.query(ingestSql,[owner,story,id,JSON.stringify(p)])}catch(e){h.report.ingestDebug={message:e.message,where:e.where,code:e.code}}finally{await h.close(c)}}h.eq(r.sqlstate,expected,'ingest '+expected);return r.rows?.[0]?.r}
 await run(ingest,randomUUID(),'23505')
 for(const change of [{end_ms:6000},{start_ms:.1},{confidence:'NaN'},{confidence:1.1},{start_ms:null}])await run({...ingest,segments:[{...ingest.segments[0],...change}]},requestId,'22023')
 await h.db.query('UPDATE consent_records SET withdrawn_at=now() WHERE subject_id=$1',[story]);await run(ingest,requestId,'42501')
 await h.db.query('UPDATE consent_records SET withdrawn_at=NULL WHERE subject_id=$1',[story])
 await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'b'.repeat(64)]);await run(ingest,requestId,'23505')
 await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'a'.repeat(64)])
 const state=await run();h.eq(state.transcript.alignment_status,'aligned','provider timings persisted');h.eq(state.transcript.segments[1].confidence,null,'unknown provider confidence stays null')
 h.eq((await reserve()).status,'completed','completed reserve reconciles after source changes')
 h.eq(await run(),state,'same completed ingestion is idempotent')
 const persisted=await h.actor('service_role',owner,"SELECT story_review($1,$2,'prepare',$3,NULL,'{}') AS r",[owner,story,randomUUID()]);h.eq(persisted.sqlstate,'00000','prepare existing timed transcript');h.eq(persisted.rows[0].r.transcript,state.transcript,'prepare never downgrades actual timed provider transcript')
 const status=await h.actor('service_role',owner,'SELECT read_story_transcription_status($1,$2,$3) AS r',[owner,story,requestId]);h.eq(status.sqlstate,'00000','read transcription status');h.eq(status.rows[0].r.status,'completed','durable completed status available');h.eq(status.rows[0].r.pendingRequestId,null,'completed clears pending')
 h.eq((await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,randomUUID()])).sqlstate,'00000','G1 deletion with ASR ledger')
 h.eq((await h.db.query('SELECT count(*)::int n FROM story_transcription_requests WHERE story_id=$1',[story])).rows[0].n,0,'G1 purge clears transcription reservations')
 h.eq((await h.actor('service_role',owner,'SELECT read_story_transcription_status($1,$2,NULL) AS r',[owner,story])).sqlstate,'23505','status cannot bypass deleted source')
}

async function legacyTimedTranscript(h,owner,project) {
 const story=randomUUID(),transcript=randomUUID(),text='Source one\nSource two'
 await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'Legacy timed',text])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,1,'elevenlabs','scribe_v2','aligned',$4,$5,$6)",[transcript,project,story,'b'.repeat(64),text,owner])
 await h.db.query("INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,start_ms,end_ms,text,confidence) VALUES($1,$2,0,0,1000,'Source one',.9),($1,$2,1,1000,2000,'Source two',.9)",[project,transcript])
 const call=async(op,version,payload)=>{const r=await h.actor('service_role',owner,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) AS r',[owner,story,op,randomUUID(),version,JSON.stringify(payload)]);h.eq(r.sqlstate,'00000','legacy timed '+op);return r.rows[0].r}
 let state=await call('prepare',null,{})
 h.eq(state.transcript.id,transcript,'legacy canonical content hash does not cause transcript replacement')
 for(const a of state.assertions)state=await call('decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:a.id,action:'accept'})
 state=await call('approve_revision',state.revision.edit_version,{revision_id:state.revision.id});h.eq(state.revision.status,'approved','legacy canonical content hash can approve exact excerpts')
}

async function mediaSourceBinding(h,owner,project) {
 const story=randomUUID(),foreignStory=randomUUID(),asset=randomUUID(),transcript=randomUUID()
 await h.db.query("INSERT INTO stories(id,project_id,user_id,transcript) VALUES($1,$3,$4,'Bound quote'),($2,$3,$4,'Other story')",[story,foreignStory,project,owner])
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,'ready')",[asset,project,foreignStory,owner,owner+'/projects/'+project+'/'+asset,'a'.repeat(64)])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'provider','model','aligned',$5,'Bound quote',$6)",[transcript,project,story,asset,'b'.repeat(64),owner])
 await h.db.query("INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,start_ms,end_ms,text) VALUES($1,$2,0,0,1000,'Bound quote')",[project,transcript])
 const sql='SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) AS r'
 const call=(op,id=randomUUID(),v=null,p={})=>h.actor('service_role',owner,sql,[owner,story,op,id,v,JSON.stringify(p)])
 h.eq((await call('read',null)).sqlstate,'23505','foreign source asset unreadable')
 h.eq((await call('prepare')).sqlstate,'23505','foreign source asset cannot prepare')
 await h.db.query('UPDATE media_assets SET story_id=$2 WHERE id=$1',[asset,story])
 const requestId=randomUUID(),prepared=await call('prepare',requestId);h.eq(prepared.sqlstate,'00000','valid same-story source prepares')
 const state=prepared.rows[0].r
 const decision=await call('decide_assertion',randomUUID(),0,{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action:'accept'});h.eq(decision.sqlstate,'00000','valid source accepted')
 await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'c'.repeat(64)])
 h.eq((await call('read',null)).sqlstate,'23505','changed audio bytes fail closed on read')
 h.eq((await call('prepare',requestId)).sqlstate,'23505','changed audio bytes fail closed on replay')
 h.eq((await call('approve_revision',randomUUID(),1,{revision_id:state.revision.id})).sqlstate,'23505','changed audio bytes cannot approve old transcript')
 h.eq((await h.actor('service_role',owner,'INSERT INTO story_review_context(transaction_id,story_id) VALUES(txid_current(),$1)',[story])).sqlstate,'42501','review write authority cannot be forged')
}

async function firstSourceCaptureRace(h,owner,project) {
 const story=randomUUID(),transcript=randomUUID(),segment=randomUUID(),replacement=randomUUID(),original='Original capture source.'
 await h.db.query('INSERT INTO stories(id,project_id,user_id,transcript) VALUES($1,$2,$3,$4)',[story,project,owner,original])
 await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,version,provider,model,content_sha256,full_text,created_by) VALUES($1,$2,$3,1,'legacy','imported-text',$4,$5,$6)",[transcript,project,story,'b'.repeat(64),original,owner])
 await h.db.query('INSERT INTO transcript_segments(id,project_id,transcript_version_id,segment_index,text) VALUES($1,$2,$3,0,$4)',[segment,project,transcript,original])
 const locker=await h.client(),preparer=await h.actorClient('service_role',owner),mutator=await h.actorClient('service_role',owner)
 let pending
 try {
  const pid=(await preparer.query('SELECT pg_backend_pid() pid')).rows[0].pid
  await locker.query('BEGIN');await locker.query('LOCK TABLE story_revisions IN SHARE MODE')
  pending=preparer.query("SELECT story_review($1,$2,'prepare',$3,NULL,'{}') AS r",[owner,story,randomUUID()])
  let blocked=false
  for(let n=0;n<80;n++){blocked=(await h.db.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND relation='public.story_revisions'::regclass AND NOT granted) blocked",[pid])).rows[0].blocked;if(blocked)break;await new Promise(resolve=>setTimeout(resolve,10))}
  h.eq(blocked,true,'first prepare paused after source validation')
  await mutator.query("SET lock_timeout='150ms'")
  let mutation='00000';try{await mutator.query("UPDATE transcript_segments SET text='Concurrent injected text' WHERE id=$1",[segment])}catch(e){mutation=e.code}
  h.eq(mutation,'55P03','first capture locks the complete existing source segment set')
  await locker.query('ROLLBACK')
  const state=(await pending).rows[0].r;pending=null
  h.eq(state.revision.body,original,'source capture retains original excerpt under concurrent writer')
  await h.db.query('UPDATE transcript_versions SET is_current=false WHERE id=$1',[transcript])
  await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,version,provider,model,content_sha256,full_text,created_by) VALUES($1,$2,$3,2,'legacy','imported-text',$4,$5,$6)",[replacement,project,story,'c'.repeat(64),original,owner])
  h.eq((await h.actor('service_role',owner,"SELECT story_review($1,$2,'read',NULL,NULL,'{}')",[owner,story])).sqlstate,'23505','read never mixes a revision with another current transcript')
 } finally {await locker.query('ROLLBACK');if(pending)await pending.catch(()=>{});await h.close(locker);await h.close(preparer);await h.close(mutator)}
}

async function correctionSupplementAuthors(h,owner,project) {
 const reviewer=randomUUID(),story=randomUUID()
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[reviewer,'g2-supplement-reviewer@example.invalid'])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,reviewer])
 await h.db.query("INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,'Author attribution','Original transcript')",[story,project,owner])
 const invoke=async(actor,op,version=null,payload={})=>{const r=await h.actor('service_role',actor,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) AS r',[actor,story,op,randomUUID(),version,JSON.stringify(payload)]);h.eq(r.sqlstate,'00000','corrected source author '+op);return r.rows[0].r}
 let state=await invoke(owner,'prepare')
 state=await invoke(owner,'correct_transcript',state.revision.edit_version,{revision_id:state.revision.id,text:'Original author correction'})
 h.eq(state.assertions[0].supplemented_by,owner,'correction pins its human author')
 state=await invoke(reviewer,'decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action:'dispute',text:'Another family account'})
 h.eq(state.assertions[0].memory_attribution,'family_supplement','corrected source disputed without relabelling its origin')
 h.eq(state.assertions[0].supplemented_by,owner,'corrected source origin survives another reviewer')
 h.eq(state.assertions[0].reviewed_by,reviewer,'correction keeps latest reviewer distinct')
 state=await invoke(owner,'approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
 h.ok(state.revision.body.includes('[Family supplement: '+owner+']')&&state.revision.body.includes('[Alternative: '+reviewer+'] Another family account'),'corrected approval renders original and alternate authors')
 state=await invoke(reviewer,'prepare')
 h.eq(state.assertions[0].supplemented_by,owner,'new draft of corrected transcript retains transcript author')
 state=await invoke(reviewer,'decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action:'accept'})
 h.eq(state.assertions[0].supplemented_by,owner,'accept does not overwrite supplement origin')
 state=await invoke(owner,'approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
 h.eq(state.revision.provenance_snapshot.assertions[0].supplemented_by,owner,'immutable snapshot carries correction author')
 h.eq((await h.actor('service_role',owner,'UPDATE story_assertions SET supplemented_by=$2 WHERE id=$1',[state.assertions[0].id,reviewer])).sqlstate,'23514','approved supplement origin immutable')
 h.eq((await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,randomUUID()])).sqlstate,'00000','G1 purge still removes attributed supplements')
}
