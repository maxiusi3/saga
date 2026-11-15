import {randomUUID,createHash} from 'node:crypto'
export async function reviewRecheck({h}) {
 const owner=randomUUID(),member=randomUUID(),project=randomUUID(),story=randomUUID(),asset=randomUUID()
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$3),($2,$4)',[owner,member,'review-owner@example.invalid','review-member@example.invalid'])
 await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Independent archive review',$2)",[project,owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 await h.db.query("INSERT INTO project_members(project_id,user_id,status) VALUES($1,$2,'active')",[project,member])
 await h.db.query("INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,'Review original','Before')",[story,project,owner])
 await h.db.query("INSERT INTO media_assets(id,project_id,story_id,created_by,bucket,object_key,kind,mime_type,byte_size,sha256,duration_ms,state) VALUES($1,$2,$3,$4,'audio-recordings',$5,'original_audio','audio/wav',64,$6,1000,'ready')",[asset,project,story,owner,owner+'/projects/'+project+'/'+asset,'a'.repeat(64)])
 let state
 const call=async(op,payload)=>{const result=await h.actor('service_role',owner,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r',[owner,story,op,randomUUID(),state?.revision.edit_version??0,JSON.stringify(payload)]);h.eq(result.sqlstate,'00000','independent G2 '+op);state=result.rows[0].r}
 await call('ingest_transcript',{local_worker:true,source_hash:createHash('sha256').update('Before').digest('hex'),asset_id:asset,provider:'controlled',model:'fixture',language:'en',segments:[{text:'Approved original source.',start_ms:0,end_ms:500,confidence:.9}]})
 await call('decide_assertion',{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action:'accept'})
 await call('approve_revision',{revision_id:state.revision.id})
 const source=(await h.db.query('SELECT publication_source_identity($1) r',[project])).rows[0].r
 const reserve=await h.actor('service_role',member,"SELECT publication_delivery($1,$2,'prepare',NULL,$3::jsonb) r",[member,project,JSON.stringify({source,subjects:[project,story,asset]})]);h.eq(reserve.sqlstate,'00000','member can reserve baseline')
 await h.db.query("UPDATE project_roles SET status='removed' WHERE user_id=$1 AND project_id=$2",[member,project])
 const revoked=await h.actor('service_role',member,"SELECT publication_delivery($1,$2,'validate',$3,'{}'::jsonb)",[member,project,reserve.rows[0].r.id])
 h.eq(revoked.sqlstate,'42501','legacy member row cannot bypass removed project role')
 await h.db.query('UPDATE media_assets SET sha256=$2 WHERE id=$1',[asset,'b'.repeat(64)])
 let fingerprintCode='00000'
 try {await h.db.query('SELECT publication_source_identity($1)',[project])}catch(error){fingerprintCode=error.code}
 h.eq(fingerprintCode,'23505','changed audio fingerprint rejects approved source identity')
 h.report.archiveIndependentReview={status:'passed',aclSqlstate:revoked.sqlstate,changedSourceSqlstate:fingerprintCode,scope:'Current fixed production SQL, actual G2 approval and ready media; independently confirms two P1 fixes. No source production files edited.'}
}
