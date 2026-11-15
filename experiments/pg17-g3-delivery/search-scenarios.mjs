import { randomUUID, createHash } from 'node:crypto'
const sha = text => createHash('sha256').update(text).digest('hex')
export async function searchScenarios({ h, source, evidence }) {
  await source('experiments/pg17-g3-delivery/search-scenarios.mjs')
  h.ok((await h.db.query("SELECT to_regprocedure('public.search_project_sources(uuid,uuid,text,text,text,text)') rpc")).rows[0].rpc, 'authoritative search RPC exists')
  const owner = randomUUID(), member = randomUUID(), other = randomUUID(), project = randomUUID(), story = randomUUID(), asset = randomUUID()
  await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)', [owner,member,other,'search-owner@example.invalid','search-member@example.invalid','search-other@example.invalid'])
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'G3 authoritative source search',owner])
  await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
  await h.db.query("INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,'Search current sources','Initial')",[story,project,owner])
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,byte_size,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,120,9000,'ready')",[asset,project,story,owner,owner+'/projects/'+project+'/'+story+'/original.webm','a'.repeat(64)])
  const searchSql = 'SELECT search_project_sources($1,$2,$3,$4,$5,$6) result'
  const search = async (query,actor=owner,filters={},code='00000') => {
    const values=[actor,project,query,filters.person||'',filters.year||'',filters.place||'']
    const r=await h.actor('service_role',actor,searchSql,values)
    if(r.sqlstate!==code) {const c=await h.actorClient('service_role',actor);try{await c.query(searchSql,values)}catch(e){h.report.searchDebug={code:e.code,message:e.message,where:e.where}}finally{await h.close(c)}}
    h.eq(r.sqlstate,code,'search result '+code); return r.rows?.[0]?.result
  }
  for (const role of ['anon','authenticated']) h.eq((await h.actor(role,owner,searchSql,[owner,project,'Chicago','','',''])).sqlstate,'42501',role+' cannot spoof actor RPC')
  await search('Chicago',other,{},'42501')
  await search('x'.repeat(241),owner,{},'22023');await search('',owner,{},'22023')
  let review
  const reviewCall=async(op,payload={})=>{
    const r=await h.actor('service_role',owner,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r', [owner,story,op,randomUUID(),review?.revision?.edit_version??0,JSON.stringify(payload)])
    h.eq(r.sqlstate,'00000','G2 '+op);review=r.rows[0].r;return review
  }
  const texts=['In 1968 Grandma Eleanor moved to Chicago.','Original dispute in Boston.','Rejected original Paris.','Literal 100% underscore_value 王奶奶 in 臺北.']
  await reviewCall('ingest_transcript',{local_worker:true,source_hash:sha('Initial'),asset_id:asset,provider:'local_fixture',model:'controlled',language:'en',
    segments:texts.map((text,i)=>({text,start_ms:i*2000,end_ms:i*2000+1800,confidence:.9}))})
  const firstTranscript=review.transcript.id, firstSegments=review.transcript.segments.map(s=>s.id), firstRevision=review.revision.id
  const initial=await search('Chicago')
  if (!initial.entries.length) h.report.searchInitialDebug = (await h.db.query(`SELECT s.transcript, t.full_text, t.asset_id, t.project_id, t.is_current, r.source_hash, r.status, r.provenance_snapshot->>'source_fingerprint' expected, public.story_review_transcript_fingerprint(t.id) actual, current_setting('TimeZone') zone FROM stories s JOIN transcript_versions t ON t.story_id=s.id JOIN story_revisions r ON r.transcript_version_id=t.id WHERE s.id=$1`,[story])).rows
  h.ok(initial.entries.length,'new G2 source is searchable without index')
  h.eq(initial.entries[0].quotedText,texts[0],'quote is actual transcript text without any index seed')
  h.eq(initial.entries[0].reviewStatus,'source_only','draft transcript never claims approval')
  h.eq(initial.entries[0].segmentId,firstSegments[0],'exact source segment');h.eq(initial.entries[0].transcriptVersionId,firstTranscript,'exact version')
  h.eq(initial.entries[0].sourceHash,sha(texts.join('\n\n')),'actual current source hash')
  const ids=review.assertions.map(a=>a.id)
  const decision=async(index,action,text)=>reviewCall('decide_assertion',{revision_id:review.revision.id,assertion_id:ids[index],action,...(text?{text}:{})})
  await decision(0,'accept');await decision(1,'dispute','Family alternative Seattle.');await decision(2,'reject');await decision(3,'modify','Family supplement in Kyoto 1974.')
  h.eq((await search('Kyoto')).entries,[],'unapproved edited assertion is not active search prose')
  await reviewCall('approve_revision',{revision_id:firstRevision})
  const immutable=(await h.db.query('SELECT to_jsonb(r) r FROM story_revisions r WHERE id=$1',[firstRevision])).rows[0].r
  const approved=await search('',owner,{person:'Grandma Eleanor',year:'1968',place:'Chicago'})
  h.eq(approved.entries.length,1,'person/year/place are literal conjunctive filters')
  h.eq(approved.entries[0].storyRevisionId,firstRevision,'approved current revision bound');h.eq(approved.entries[0].reviewStatus,'approved','actual G2 approval searchable')
  const citationPayload=Object.fromEntries(['entryId','storyId','storyRevisionId','transcriptVersionId','segmentId','mediaAssetId','sourceHash','sourceFingerprint','startMs','endMs'].map(k=>[k,approved.entries[0][k]]))
  const resolveCitation=async(actor=owner,payload=citationPayload,code='00000')=>{const result=await h.actor('service_role',actor,'SELECT resolve_search_citation($1,$2,$3::jsonb) r',[actor,project,JSON.stringify(payload)]);h.eq(result.sqlstate,code,'current search citation '+code);return result.rows?.[0]?.r}
  h.eq((await resolveCitation()).mediaAssetId,asset,'playback resolves exact active source asset')
  await resolveCitation(owner,{...citationPayload,segmentId:randomUUID()},'23505')
  h.eq([approved.entries[0].startMs,approved.entries[0].endMs],[0,1800],'original exact audio timing')
  h.eq((await search('Paris')).entries,[],'rejected statement excluded from approved results')
  const family=(await search('Kyoto')).entries[0];h.eq([family.sourceKind,family.startMs,family.endMs,family.mediaAssetId],['family_supplement',null,null,null],'supplement cannot link invented audio')
  const dispute=(await search('Boston')).entries[0];h.eq([dispute.sourceKind,dispute.startMs,dispute.endMs],['disputed_memory',null,null],'dispute timing remains null')
  const alternative=(await search('Seattle')).entries[0];h.eq([alternative.sourceKind,alternative.attributedTo,alternative.segmentId],['dispute_alternative',owner,null],'alternative separately attributed')
  // A forged legacy index remains irrelevant, even when it points to real identifiers.
  await h.db.query("INSERT INTO search_index_entries(project_id,story_id,transcript_version_id,segment_id,index_version,is_active_index,searchable_text,start_ms,end_ms) VALUES($1,$2,$3,$4,999,true,'FORGED_SEMANTIC_CLAIM',7000,8000)",[project,story,firstTranscript,firstSegments[0]])
  h.eq((await search('FORGED_SEMANTIC_CLAIM')).entries,[],'forged index never supplies prose or timing')
  await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'b'.repeat(64)])
  h.eq((await search('Chicago')).entries,[],'source fingerprint detects changed asset hash')
  await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'a'.repeat(64)])
  await reviewCall('correct_transcript',{revision_id:firstRevision,text:'Corrected family record in Toronto 1978.'})
  await resolveCitation(owner,citationPayload,'23505')
  h.eq((await search('Chicago')).entries,[],'correction replaces active source without stale approved match')
  const corrected=(await search('Toronto')).entries[0]
  h.eq([corrected.reviewStatus,corrected.sourceKind,corrected.startMs,corrected.endMs],['source_only','family_supplement',null,null],'correction remains unapproved and unaligned')
  h.eq((await h.db.query('SELECT to_jsonb(r) r FROM story_revisions r WHERE id=$1',[firstRevision])).rows[0].r,immutable,'prior approved history remains immutable')
  await h.db.query("UPDATE stories SET transcript='Forged direct legacy edit' WHERE id=$1",[story])
  h.eq((await search('Toronto')).entries,[],'stale transcript/story relation fails closed')
  await h.db.query('UPDATE stories SET transcript=$2 WHERE id=$1',[story,'Corrected family record in Toronto 1978.'])
  await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,member])
  await search('Toronto',member,{},'42501')
  await resolveCitation(member,citationPayload,'42501')
  h.eq((await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,randomUUID()])).sqlstate,'00000','G1 deletion accepts searched history')
  h.eq((await search('Toronto')).entries,[],'deleted content has no active search copies')
  await sourceBoundaryScenarios(h,owner,project)
  h.report.authoritativeSearch={status:'passed',project,story,asset,firstTranscript,firstRevision,evidence,
    boundary:'Native PG17 full schema; G2 approval and correction; literal source search, no semantic model or provider claim.'}
}

async function sourceBoundaryScenarios(h,owner,project) {
  const story=randomUUID(),foreign=randomUUID(),asset=randomUUID(),transcript=randomUUID(),session=randomUUID()
  const texts=Array.from({length:55},(_,i)=>`Literal % underscore_ 王奶奶 in 臺北 source ${i}.`),full=texts.join('\n\n')
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$3,$4,$5,$6),($2,$3,$4,$5,$6)',[story,foreign,project,owner,'Boundary source',full])
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,sha256,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/webm',$6,'ready')",[asset,project,story,owner,owner+'/projects/'+project+'/'+asset,'a'.repeat(64)])
  await h.db.query("INSERT INTO transcript_versions(id,project_id,story_id,asset_id,version,provider,model,alignment_status,content_sha256,full_text,created_by) VALUES($1,$2,$3,$4,1,'legacy','imported','legacy_unaligned',$5,$6,$7)",[transcript,project,story,asset,sha(full),full,owner])
  await h.db.query('INSERT INTO transcript_segments(project_id,transcript_version_id,segment_index,text,confidence) SELECT $1,$2,n-1,value,NULL FROM jsonb_array_elements_text($3::jsonb) WITH ORDINALITY a(value,n)',[project,transcript,JSON.stringify(texts)])
  const search=async(q='Literal',code='00000')=>{const r=await h.actor('service_role',owner,"SELECT search_project_sources($1,$2,$3,'','','') r",[owner,project,q]);h.eq(r.sqlstate,code,'boundary search status');return r.rows?.[0]?.r}
  const bounded=await search('Literal % underscore_ 王奶奶')
  h.eq(bounded.entries.length,50,'large match set returns fifty excerpts');h.eq(bounded.hasMore,true,'bounded response discloses additional matches')
  h.ok(bounded.entries.every(x=>x.startMs===null&&x.endMs===null&&x.mediaAssetId===null),'unaligned sources have no fabricated audio')
  h.eq((await search('missing%')).entries,[],'percent is a literal character, never a SQL wildcard')
  await search(Array(17).fill('a').join(' '),'22023')
  await h.db.query('UPDATE media_assets SET story_id=$2 WHERE id=$1',[asset,foreign]);h.eq((await search()).entries,[],'cross-story asset cannot supply citations')
  await h.db.query('UPDATE media_assets SET story_id=$2 WHERE id=$1',[asset,story])
  const otherProject=randomUUID();await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Foreign', $2)",[otherProject,owner])
  await h.db.query('UPDATE transcript_segments SET project_id=$2 WHERE transcript_version_id=$1 AND segment_index=0',[transcript,otherProject])
  h.eq((await search()).entries,[],'forged cross-project segment relationship is excluded')
  await h.db.query('UPDATE transcript_segments SET project_id=$2 WHERE transcript_version_id=$1',[transcript,project])
  await h.db.query("UPDATE transcript_segments SET text='forged excerpt' WHERE transcript_version_id=$1 AND segment_index=0",[transcript])
  h.eq((await search()).entries,[],'forged text breaks exact full source coverage')
  await h.db.query('UPDATE transcript_segments SET text=$2 WHERE transcript_version_id=$1 AND segment_index=0',[transcript,texts[0]])
  await h.db.query('UPDATE transcript_versions SET content_sha256=$2 WHERE id=$1',[transcript,'b'.repeat(64)])
  h.eq((await search()).entries,[],'unreviewed full text must match declared source hash')
  await h.db.query('UPDATE transcript_versions SET content_sha256=$2 WHERE id=$1',[transcript,sha(full)])
  await h.db.query("INSERT INTO recording_sessions(id,project_id,user_id,story_id,mime_type,confirmed_asset_id) VALUES($1,$2,$3,$4,'audio/webm',$5)",[session,project,owner,story,asset])
  await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[project,session,owner])
  h.eq((await search()).entries,[],'session tombstone denies legacy confirmed source before physical deletion')
}
