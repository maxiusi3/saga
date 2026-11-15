import { randomUUID } from 'node:crypto'
export async function storyDeletionScenarios({h,source,evidence}) {
  const owner=randomUUID(),other=randomUUID(),project=randomUUID(),story=randomUUID(),survivor=randomUUID(),request=randomUUID()
  const version=randomUUID(),segment=randomUUID(),revision=randomUUID(),run=randomUUID(),interview=randomUUID(),contribution=randomUUID(),cluster=randomUUID(),snapshot=randomUUID()
  const legacy=randomUUID(),recordingSession=randomUUID()
  const marker='G1_PURGE_PRIVATE_PROSE',hash='a'.repeat(64)
  await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$3),($2,$4)',[owner,other,'g1-owner@example.invalid','g1-other@example.invalid'])
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'G1 story deletion',owner])
  await h.db.query(`INSERT INTO stories(id,project_id,user_id,storyteller_id,title,content,transcript,ai_summary) VALUES($1,$3,$4,$4,$5,$5,$5,$5),($2,$3,$4,$4,'Survivor','keep me','keep me','keep me')`,[story,survivor,project,owner,marker])
  await h.db.query(`INSERT INTO transcript_versions(id,project_id,story_id,version,provider,model,content_sha256,full_text,created_by) VALUES($1,$2,$3,1,'synthetic','synthetic',$4,$5,$6)`,[version,project,story,hash,marker,owner])
  await h.db.query(`INSERT INTO transcript_segments(id,project_id,transcript_version_id,segment_index,text) VALUES($1,$2,$3,0,$4)`,[segment,project,version,marker])
  await h.db.query(`INSERT INTO story_revisions(id,project_id,story_id,transcript_version_id,revision_number,status,title,body,summary,content_sha256,created_by) VALUES($1,$2,$3,$4,1,'approved',$5,$5,$5,$6,$7)`,[revision,project,story,version,marker,hash,owner])
  await h.db.query(`INSERT INTO story_assertions(project_id,story_id,transcript_version_id,segment_id,assertion_type,subject,claim_text) VALUES($1,$2,$3,$4,'event',$5,$5)`,[project,story,version,segment,marker])
  await h.db.query(`INSERT INTO search_index_entries(project_id,story_id,transcript_version_id,story_revision_id,segment_id,searchable_text,start_ms,end_ms) VALUES($1,$2,$3,$4,$5,$6,0,1000)`,[project,story,version,revision,segment,marker])
  await h.db.query(`INSERT INTO interview_sessions(id,project_id,storyteller_id,prompt_text,recording_mode,intervention_level) VALUES($1,$2,$3,$4,'chat','low')`,[interview,project,owner,marker])
  await h.db.query(`INSERT INTO agent_runs(id,agent_type,project_id,story_id,interview_session_id,input,created_by) VALUES($1,'editor_librarian',$2,$3,$4,$5,$6)`,[run,project,story,interview,JSON.stringify({text:marker}),owner])
  await h.db.query(`INSERT INTO agent_artifacts(agent_run_id,project_id,artifact_type,payload) VALUES($1,$2,'story_summary',$3)`,[run,project,JSON.stringify({text:marker})])
  await h.db.query(`INSERT INTO story_elements(project_id,story_id,agent_run_id,element_type,value,source_quote) VALUES($1,$2,$3,'event',$4,$4)`,[project,story,run,marker])
  await h.db.query(`INSERT INTO interview_events(interview_session_id,project_id,storyteller_id,event_kind,intervention_level,trigger_reason,prompt_text,transcript_window) VALUES($1,$2,$3,'closing','low','test',$4,$4)`,[interview,project,owner,marker])
  await h.db.query(`INSERT INTO interactions(story_id,user_id,type,content) VALUES($1,$2,'comment',$3)`,[story,owner,marker])
  await h.db.query(`INSERT INTO recording_story_intents(session_id,project_id,actor_id,story_id,metadata) VALUES($1,$2,$3,$4,$5)`,[recordingSession,project,owner,story,JSON.stringify({content:marker})])
  await h.db.query(`INSERT INTO story_artifacts(project_id,story_id,artifact_type,payload) VALUES($1,$2,'test',$3)`,[project,story,JSON.stringify({text:marker})])
  await h.db.query(`INSERT INTO public_archive_entries(project_id,story_id,slug,title,summary) VALUES($1,$2,$3,$4,$4)`,[project,story,randomUUID(),marker])
  await h.db.query(`INSERT INTO notifications(recipient_id,type,title,message,data) VALUES($1,'story_added',$2,$2,$3)`,[owner,marker,JSON.stringify({story_id:story,project_id:project})])
  await h.db.query(`INSERT INTO public_contributions(id,source_project_id,source_story_id,source_user_id,source_story_hash,source_content_hash,consent_copy_version,anonymized_title,anonymized_text,anonymized_summary) VALUES($1,$2,$3,$4,$5,$5,'test',$6,$6,$6)`,[contribution,project,story,owner,hash,marker])
  await h.db.query(`INSERT INTO public_event_clusters(id,event_label,timeframe,place_scope,historical_context_summary,perspective_summary,uncertainty_notes,source_contribution_ids) VALUES($1,$2,$2,$2,$2,$2,$2,ARRAY[$3::uuid])`,[cluster,marker,contribution])
  await h.db.query(`INSERT INTO public_event_contributions(public_event_cluster_id,public_contribution_id,perspective_summary) VALUES($1,$2,$3)`,[cluster,contribution,marker])
  await h.db.query(`INSERT INTO public_archive_audit_events(event_type,public_contribution_id,public_event_cluster_id,metadata) VALUES('opted_in',$1,$2,$3)`,[contribution,cluster,JSON.stringify({text:marker})])
  await h.db.query(`INSERT INTO publication_snapshots(id,project_id,snapshot_version,story_revision_ids,chapter_outline,manifest_json,pdf_sha256,retention_expires_at,reminder_90d_at,reminder_30d_at) VALUES($1,$2,1,ARRAY[$3::uuid],$4,$4,$5,now()+interval '1 year',now(),now())`,[snapshot,project,revision,JSON.stringify({text:marker}),hash])
  await h.db.query("INSERT INTO stories(id,project_id,title,audio_url) VALUES($1,$2,'legacy','https://unknown.invalid/audio.webm')",[legacy,project])
  const wikiRun=randomUUID()
  await h.db.query(`INSERT INTO agent_runs(id,agent_type,input,output,created_by) VALUES($1,'wiki_editor',$2,$3,$4)`,[wikiRun,JSON.stringify({contributionId:contribution}),JSON.stringify({eventClusterId:cluster,text:marker}),owner])
  await h.db.query(`INSERT INTO agent_artifacts(agent_run_id,project_id,artifact_type,payload,source_refs) VALUES($1,$2,'wiki_event_draft',$3,$4)`,[wikiRun,project,JSON.stringify({activeContributionIds:[contribution],text:marker}),JSON.stringify([{source_type:'story',source_id:contribution}])])
  const unlinkedSnapshot=randomUUID()
  await h.db.query(`INSERT INTO publication_snapshots(id,project_id,snapshot_version,manifest_json,pdf_sha256,retention_expires_at,reminder_90d_at,reminder_30d_at) VALUES($1,$2,2,$3,$4,now(),now(),now())`,[unlinkedSnapshot,project,JSON.stringify({stories:[{id:story,text:marker}]}),hash])
  const unboundInterview=randomUUID(),interviewRun=randomUUID()
  await h.db.query(`INSERT INTO interview_sessions(id,project_id,storyteller_id,prompt_text,recording_mode,intervention_level) VALUES($1,$2,$3,$4,'chat','low')`,[unboundInterview,project,owner,marker])
  await h.db.query(`INSERT INTO agent_runs(id,agent_type,project_id,interview_session_id,input,created_by) VALUES($1,'interview',$2,$3,$4,$5)`,[interviewRun,project,unboundInterview,JSON.stringify({recordingSessionId:recordingSession,recentTranscript:marker}),owner])
  const question=randomUUID()
  await h.db.query(`INSERT INTO interactions(id,story_id,user_id,type,content,answer_story_id,answered_at,status) VALUES($1,$2,$3,'followup','Keep question',$4,now(),'answered')`,[question,survivor,owner,story])
  await h.db.query(`INSERT INTO notifications(recipient_id,type,title,message,data) VALUES($1,'answer',$2,$2,$3)`,[owner,marker,JSON.stringify({interaction_id:question})])
  const before=(await h.db.query('SELECT to_jsonb(s) AS value FROM stories s WHERE id=$1',[survivor])).rows[0].value
  const rpc='SELECT public.request_story_deletion($1,$2,$3,$4) AS receipt'
  const denied=await h.actor('service_role',owner,rpc,[other,project,story,request]); h.eq(denied.sqlstate,'42501','non-owner rejected without tombstone')
  h.eq((await h.db.query('SELECT count(*)::int n FROM deletion_requests WHERE id=$1',[request])).rows[0].n,0,'denied request rolled back')
  const receipt=await h.actor('service_role',owner,rpc,[owner,project,story,request]);if(receipt.sqlstate!=='00000'){const c=await h.actorClient('service_role',owner);try{await c.query(rpc,[owner,project,story,request])}catch(e){h.report.purgeDebug={code:e.code,message:e.message,where:e.where};throw e}finally{await h.close(c)}};h.eq(receipt.sqlstate,'00000','whole story request accepted')
  const tombstones=(await h.db.query('SELECT to_jsonb(d) AS value FROM deletion_requests d WHERE id=$1',[request])).rows
  const targets=(await h.db.query('SELECT to_jsonb(d) AS value FROM deletion_targets d WHERE deletion_request_id=$1 ORDER BY id',[request])).rows
  const repeat=await h.actor('service_role',owner,rpc,[owner,project,story,randomUUID()]);h.eq(repeat.sqlstate,'00000','subject replay after purge')
  h.eq((await h.db.query('SELECT to_jsonb(d) AS value FROM deletion_requests d WHERE id=$1',[request])).rows,tombstones,'capture request immutable')
  h.eq((await h.db.query('SELECT to_jsonb(d) AS value FROM deletion_targets d WHERE deletion_request_id=$1 ORDER BY id',[request])).rows,targets,'capture targets immutable')
  h.eq((await h.db.query('SELECT to_jsonb(s) AS value FROM stories s WHERE id=$1',[survivor])).rows[0].value,before,'survivor unchanged')
  for(const {tablename} of (await h.db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows) {
    const rows=await h.db.query(`SELECT count(*)::int n FROM public."${tablename}" t WHERE to_jsonb(t)::text LIKE $1`,['%'+marker+'%'])
    h.eq(rows.rows[0].n,0,'no private prose remains in '+tablename)
  }
  h.eq((await h.db.query('SELECT content,answer_story_id,answered_at,status FROM interactions WHERE id=$1',[question])).rows[0],{content:'Keep question',answer_story_id:null,answered_at:null,status:'pending'},'survivor question retained and answer link cleared')
  for(const [label,sql,args] of [
    ['late recording interview',"INSERT INTO agent_runs(agent_type,project_id,input,created_by) VALUES('interview',$1,$2,$3)",[project,JSON.stringify({recordingSessionId:recordingSession,recentTranscript:marker}),owner]],
    ['late answer link',"UPDATE interactions SET answer_story_id=$1 WHERE id=$2",[story,question]],
    ['late parent link',"UPDATE stories SET parent_story_id=$1 WHERE id=$2",[story,survivor]],
    ['story rewrite','UPDATE stories SET content=$2 WHERE id=$1',[story,marker]],
    ['late interaction',"INSERT INTO interactions(story_id,user_id,type,content) VALUES($1,$2,'comment',$3)",[story,owner,marker]],
    ['late version',"INSERT INTO transcript_versions(project_id,story_id,version,provider,model,content_sha256,full_text,created_by) VALUES($1,$2,2,'x','x',$3,$4,$5)",[project,story,hash,marker,owner]],
    ['rebound version identity',"INSERT INTO transcript_versions(id,project_id,story_id,version,provider,model,content_sha256,full_text,created_by) VALUES($1,$2,$3,1,'x','x',$4,$5,$6)",[version,project,survivor,hash,marker,owner]],
    ['late indirect artifact',"INSERT INTO agent_artifacts(agent_run_id,project_id,artifact_type,payload) VALUES($1,$2,'story_summary',$3)",[run,project,JSON.stringify({text:marker})]],
    ['late snapshot',"INSERT INTO publication_snapshots(project_id,snapshot_version,story_revision_ids,pdf_sha256,retention_expires_at,reminder_90d_at,reminder_30d_at) VALUES($1,2,ARRAY[$2::uuid],$3,now(),now(),now())",[project,revision,hash]],
  ]) h.eq((await h.actor('service_role',owner,sql,args)).sqlstate,'23505',label+' fenced for BYPASSRLS writer')
  h.eq((await h.actor('service_role',owner,`INSERT INTO public_event_clusters(event_label,timeframe,place_scope,historical_context_summary,perspective_summary,uncertainty_notes) VALUES($1,$1,$1,$1,$1,$1)`,[marker])).sqlstate,'23505','late unprovenanced cluster cannot persist erased content')
  h.eq((await h.actor('service_role',owner,`INSERT INTO public_event_clusters(event_label,timeframe,place_scope,historical_context_summary,perspective_summary,uncertainty_notes,source_contribution_ids) VALUES($1,$1,$1,$1,$1,$1,ARRAY[$2::uuid])`,[marker,contribution])).sqlstate,'23505','late cluster carrying deleted source is denied before link insert')
  for(const role of ['anon','authenticated']) h.eq((await h.actor(role,owner,rpc,[owner,project,survivor,randomUUID()])).sqlstate,'42501',role+' cannot invoke service RPC')
  h.eq((await h.actor('service_role',owner,"INSERT INTO story_deletion_context(transaction_id,story_id) VALUES(txid_current(),$1)",[story])).sqlstate,'42501','caller cannot spoof purge context')
  // Deliberately permissive policy must still be constrained by the restrictive tombstone gate.
  await h.db.query('CREATE POLICY g1_permissive_story_read ON stories FOR SELECT TO authenticated USING(true); GRANT SELECT ON stories TO authenticated')
  const visible=await h.actor('authenticated',owner,'SELECT id FROM stories WHERE id=$1',[story]);h.eq(visible.rows,[],'RLS hides deleted story even with permissive policy')
  h.eq((await h.db.query('SELECT count(*)::int n FROM story_deletion_context')).rows[0].n,0,'transaction authority fully cleared')
  h.eq((await h.actor('service_role',owner,rpc,[owner,project,legacy,randomUUID()])).sqlstate,'23505','unknown legacy media fails closed')
  h.eq((await h.db.query('SELECT count(*)::int n FROM deletion_requests WHERE subject_id=$1',[legacy])).rows[0].n,0,'legacy failure rolls capture back')
  await h.db.query('DROP POLICY g1_permissive_story_read ON stories')
  const withdrawal=randomUUID(),withdrawCluster=randomUUID()
  await h.db.query(`INSERT INTO public_contributions(id,source_project_id,source_story_id,source_user_id,source_story_hash,source_content_hash,consent_copy_version,anonymized_title,anonymized_text,anonymized_summary) VALUES($1,$2,$3,$4,$5,$5,'test','title','text','summary')`,[withdrawal,project,survivor,owner,hash])
  await h.db.query(`INSERT INTO public_event_clusters(id,status,event_label,timeframe,place_scope,historical_context_summary,perspective_summary,uncertainty_notes,source_contribution_ids) VALUES($1,'approved','event','time','place','history','withdrawn perspective','notes',ARRAY[$2::uuid])`,[withdrawCluster,withdrawal])
  await h.db.query(`INSERT INTO public_event_contributions(public_event_cluster_id,public_contribution_id,perspective_summary) VALUES($1,$2,'withdrawn perspective')`,[withdrawCluster,withdrawal])
  h.eq((await h.actor('service_role',owner,"UPDATE public_contributions SET status='withdrawn',withdrawn_at=now() WHERE id=$1",[withdrawal])).sqlstate,'00000','existing withdrawal succeeds')
  h.eq((await h.actor('service_role',owner,"UPDATE public_event_clusters SET status='needs_reprocessing',updated_at=now() WHERE id=$1",[withdrawCluster])).sqlstate,'00000','withdrawn cluster can be invalidated')
  h.eq((await h.actor('service_role',owner,"UPDATE public_event_clusters SET status='needs_reprocessing',perspective_summary='smuggled' WHERE id=$1",[withdrawCluster])).sqlstate,'23505','invalidation cannot smuggle replacement content')
  h.eq((await h.actor('service_role',owner,"UPDATE public_event_contributions SET removed_at=now() WHERE public_contribution_id=$1",[withdrawal])).sqlstate,'00000','withdrawn links can be removed')
  h.eq((await h.actor('service_role',owner,`UPDATE public_event_clusters SET status='rejected',event_label='',timeframe='',place_scope='',source_contribution_ids='{}',perspective_summary='',historical_context_summary='',representative_excerpts='[]',uncertainty_notes='All contributions were withdrawn; no active perspectives remain.',updated_at=now() WHERE id=$1`,[withdrawCluster])).sqlstate,'00000','empty reprocess removes all withdrawn cluster text')
  h.eq((await h.db.query('SELECT perspective_summary,event_label,status FROM public_event_clusters WHERE id=$1',[withdrawCluster])).rows[0],{perspective_summary:'',event_label:'',status:'rejected'},'withdrawal finishes with empty rejected cluster')
  h.report.storyDeletion={status:'passed',owner,other,project,story,survivor,request,version,marker}
  if(process.argv.includes('--chrome')) {await source('experiments/pg17-story-deletion/chrome.mjs');const {storyDeletionChrome}=await import('./chrome.mjs');await storyDeletionChrome({h,source,evidence,owner,other,project})}
}
