import {randomUUID,createHash} from 'node:crypto'
const sha=value=>createHash('sha256').update(value).digest('hex')
/** Regressions for corrected-source attribution and same-text family modification. */
export async function aiProvenanceScenarios({h,owner,member,project}){
 const outcomes=[]
 const raw='Um, I left school in 1972 and, well, began working at the mill.',edited='I left school in 1972 and began working at the mill.'
 const config={editor:{provider:'anthropic',model:'claude-opus-5-5',region:'us'},reviewer:{provider:'openai',model:'gpt-6-astra',region:'us'}},policy='g2-ai-'+'b'.repeat(64)
 async function setup(segmentCorrected=false){
  const story=randomUUID(),asset=randomUUID(),transcript=randomUUID();let state
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'Attribution regression',raw])
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/wav',$6,120,3000,'ready')",[asset,project,story,owner,`${owner}/${asset}.wav`,'a'.repeat(64)])
  await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'controlled','fixture','aligned',$5,$6,$7)",[transcript,project,story,asset,sha(raw),raw,member])
  await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text,start_ms,end_ms,is_human_corrected) VALUES($1,$2,0,$3,0,2000,$4)',[project,transcript,raw,segmentCorrected])
  const review=async(op,extra={},actor=owner)=>{const r=await h.actor('service_role',actor,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r',[actor,story,op,randomUUID(),state?.revision.edit_version??null,JSON.stringify({...state?{revision_id:state.revision.id}:{},...extra})]);h.eq(r.sqlstate,'00000','provenance review '+op);state=r.rows[0].r;return state}
  await review('prepare')
  const ai=async()=>{
   const id=randomUUID(),p={consent:true,configuration:config,policy_version:policy,revision_id:state.revision.id,expected_version:state.revision.edit_version,transcript_id:state.transcript.id,source_hash:state.revision.source_hash,source_fingerprint:state.revision.provenance_snapshot.source_fingerprint}
   const rpc=async(op,payload)=>{const r=await h.actor('service_role',owner,'SELECT story_ai_edit($1,$2,$3,$4,$5::jsonb) r',[owner,story,op,id,JSON.stringify(payload)]);h.eq(r.sqlstate,'00000','provenance AI '+op);return r.rows[0].r}
   const reservation=await rpc('reserve',p),lease={lease_token:reservation.leaseToken,policy_version:policy};await rpc('editor',lease);await rpc('reviewer',lease)
   const result={paragraphs:state.transcript.segments.map(s=>({text:edited,segmentId:s.id,sourceQuote:s.text,startMs:s.start_ms,endMs:s.end_ms})),verdicts:[{index:0,supported:true,severity:'none',risks:[]}],metadata:{editor:{...config.editor,responseId:'controlled-editor'},reviewer:{...config.reviewer,responseId:'controlled-reviewer'}}}
   state=(await rpc('complete',{...lease,result})).review;return state
  }
  const citations=async()=>{
   const semantic=await h.actor('service_role',owner,"SELECT semantic_source_snapshot($1,$2,$3,'us',true) r",[owner,project,'a'.repeat(64)])
   const literal=await h.actor('service_role',owner,"SELECT search_project_sources($1,$2,'began','','','') r",[owner,project])
   h.eq(semantic.sqlstate,'00000','corrected semantic snapshot');h.eq(literal.sqlstate,'00000','corrected literal search')
   return {semantic:semantic.rows[0].r.entries.filter(e=>e.storyId===story),literal:literal.rows[0].r.entries.filter(e=>e.storyId===story)}
  }
  return {story,review,ai,citations,state:()=>state}
 }
 const checkCitations=(results,author)=>{for(const mode of ['semantic','literal']){h.eq(results[mode].length,1,mode+' retains approved family supplement');const c=results[mode][0];h.eq(c.sourceKind,'family_supplement',mode+' retains corrected source kind');h.eq(c.attributedTo,author,mode+' retains original family author');h.eq(c.quotedText,edited,mode+' supplements project claim text');h.eq([c.mediaAssetId,c.startMs,c.endMs],[null,null,null],mode+' supplement cannot claim audio timing')}}
 for(const kind of ['correct_transcript','corrected_segment','same_text_modify']){
  try{
   const f=await setup(kind==='corrected_segment')
   if(kind==='correct_transcript')await f.review('correct_transcript',{text:raw},member)
   let state=await f.ai()
   if(kind==='same_text_modify'){
    state=await f.review('decide_assertion',{assertion_id:state.assertions[0].id,action:'modify',text:edited},member)
    h.eq(state.assertions[0].ai_review,null,'same text family modification drops displayed AI source support')
    h.eq((await h.db.query('SELECT story_ai_claim_supported(a) supported FROM story_assertions a WHERE id=$1',[state.assertions[0].id])).rows[0].supported,false,'cleared source links cannot retain AI support')
   }else{
    h.eq(state.assertions[0].memory_attribution,'family_supplement',kind+' AI keeps family source kind')
    h.eq(state.assertions[0].supplemented_by,member,kind+' AI keeps source author distinct from requester')
    h.eq(state.assertions[0].evidence_refs,[],kind+' AI has no original audio evidence')
    h.eq([state.assertions[0].start_ms,state.assertions[0].end_ms],[null,null],kind+' AI has no source playback timing')
    state=await f.review('decide_assertion',{assertion_id:state.assertions[0].id,action:'accept'})
   }
   state=await f.review('approve_revision');h.ok(state.revision.body.includes(`[Family supplement: ${member}]`),kind+' approved body names family source author')
   checkCitations(await f.citations(),member)
   outcomes.push({kind,status:'passed'})
  }catch(error){outcomes.push({kind,status:'failed',code:error.code,label:error.label??error.message})}
 }
 h.report.aiProvenanceRegressions=outcomes
 h.eq(outcomes.filter(r=>r.status==='failed'),[],'all AI attribution and same-text regressions pass')
}
