import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here,digest } from './runtime.mjs'
export const U=Object.fromEntries(['a','b','c','d','e','f','g','h','i'].map((x,i)=>[x,`10000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`]))
export const P={one:'20000000-0000-0000-0000-000000000001',two:'20000000-0000-0000-0000-000000000002',missing:'20000000-0000-0000-0000-000000000099'}
const invitation='30000000-0000-0000-0000-000000000005'
const tables=['export_requests','notifications','seat_transactions','project_members','project_roles','projects','user_resource_wallets']
export const four='SELECT * FROM public.request_data_export($1::uuid,$2::uuid,$3::boolean,$4::boolean)'
export const three='SELECT public.request_data_export($1::uuid,$2::uuid,$3::jsonb) AS export_id'
export async function seed(db){
  await db.query('TRUNCATE '+tables.map(x=>'public.'+x).join(',')+',auth.users')
  for(const id of Object.values(U))await db.query('INSERT INTO auth.users(id) VALUES($1)',[id])
  for(const [id,fac,owner] of [[P.one,U.a,U.g],[P.two,U.d,U.d]])await db.query("INSERT INTO public.projects(id,name,facilitator_id,owner_id,updated_at) VALUES($1,'Synthetic Project',$2,$3,'2001-01-01')",[id,fac,owner])
  for(const [who,project,status,role] of [[U.a,P.one,'active','facilitator'],[U.b,P.one,'active','storyteller'],[U.d,P.two,'active','storyteller'],[U.e,P.one,'pending','storyteller'],[U.f,P.one,'inactive','storyteller']])
    await db.query("INSERT INTO public.project_roles(id,user_id,project_id,role,status,updated_at) VALUES($1,$2,$3,$4,$5,'2001-01-01')",[who===U.e?invitation:who.replace(/^1/,'3'),who,project,role,status])
  for(const [who,status] of [[U.b,'active'],[U.h,'active']])await db.query('INSERT INTO public.project_members(project_id,user_id,role,status) VALUES($1,$2,$3,$4)',[P.one,who,'storyteller',status])
  for(const who of [U.a,U.b])await db.query("INSERT INTO public.user_resource_wallets(user_id,project_vouchers,updated_at) VALUES($1,1,'2001-01-01')",[who])
  await db.query("INSERT INTO public.notifications(recipient_id,type,title,message) VALUES($1,'new_story','Synthetic','Synthetic')",[U.b])
  await db.query("INSERT INTO public.export_requests(id,project_id,user_id,status,options) VALUES('40000000-0000-0000-0000-000000000001',$1,$2,'completed','{\"includeAudio\":false}')",[P.one,U.b])
}
export async function snapshot(db){const data={};for(const t of tables)data[t]=(await db.query(`SELECT * FROM public.${t} ORDER BY ${t==='user_resource_wallets'?'user_id':'id'}`)).rows;return data}
const counts=s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v.length]))
function shape(result){
  if(!result.rows)return null
  const out={rowCount:result.rowCount,columns:[]}
  // Only approved public contract keys are ever emitted; arbitrary private JSON keys/values are suppressed.
  const allowed=new Set(['project_id','user_id','role','status','joined_at','export_id','created_at','updated_at','standard_hours','premium_hours','value','invitation_id','invitee_id','invited_at'])
  out.columns=Object.keys(result.rows[0]??{}).filter(k=>allowed.has(k)).sort()
  const value=result.rows[0]?.value
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    out.jsonObject=true;out.jsonFieldCount=Object.keys(value).length
    out.approvedTypes=Object.fromEntries(['success','error','message','url','sessionId','session_id'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]===null?'null':typeof value[k]]))
    if(typeof value.success==='boolean')out.success=value.success
    if(typeof value.error==='string')out.caughtErrorClassification=/ambiguous/i.test(value.error)?'ambiguous_reference':/does not exist/i.test(value.error)?'missing_object':'other_private_error'
    out.internalSqlstateAvailable=false
  }else out.scalarType=value===null?'null':typeof value
  if(result.rows[0]?.status==='queued')out.queued=true
  return out
}
const descriptors=h=>[
  {id:'F01',sql:'SELECT * FROM public.accept_project_invitation($1::uuid,$2::uuid)',args:[invitation,U.e],who:U.e,invalid:[P.missing,U.e]},
  {id:'F02',sql:'SELECT public.cleanup_expired_invitations() AS value',args:[],who:U.a,invalid:[]},
  {id:'F03',sql:'SELECT public.create_checkout_session($1::text,$2::uuid,$3::text) AS value',args:['synthetic@example.invalid',U.a,'Synthetic'],who:U.a,invalid:[null,null,null]},
  {id:'F04',sql:'SELECT public.create_project_with_role($1::text,$2::text,$3::uuid,$4::text) AS value',args:['Synthetic','Synthetic',U.c,'facilitator'],who:U.c,invalid:['Synthetic','Synthetic',null,'invalid']},
  {id:'F05',sql:'SELECT public.get_unread_notification_count($1::uuid) AS value',args:[U.b],who:U.b,invalid:[null]},
  {id:'F06',sql:'SELECT * FROM public.initialize_user_wallet($1::uuid)',args:[U.c],who:U.c,invalid:[null]},
  {id:'F07',sql:'SELECT public.mark_notifications_as_read($1::uuid,$2::uuid[]) AS value',args:[U.b,null],who:U.b,invalid:[null,[]]},
  {id:'F08',sql:'SELECT * FROM public.process_package_purchase($1::uuid,$2::text,$3::integer,$4::integer,$5::text)',args:[U.b,'synthetic-package',2,-1,'synthetic-reference'],who:U.b,invalid:[null,null,null,null,null]},
  {id:'F09',sql:'SELECT public.process_package_purchase($1::text,$2::text,$3::uuid) AS value',args:[h.privatePackages[0],'synthetic-payment',U.b],who:U.b,invalid:['synthetic-invalid-package',null,null]},
  {id:'F10',sql:four,args:[U.b,P.one,true,false],who:U.b,invalid:[null,null,null,null]},
  {id:'F11',sql:three,args:[P.one,U.b,{includeAudio:true}],who:U.b,invalid:[null,null,null]},
  {id:'F12',sql:'SELECT * FROM public.send_project_invitation($1::uuid,$2::uuid,$3::text,$4::uuid,$5::text)',args:[P.one,U.c,'storyteller',U.a,'Synthetic'],who:U.a,invalid:[P.one,U.c,'invalid',null,null]}
]
export async function baseline(h){
  h.report.baseline=[]
  for(const d of descriptors(h))for(const variation of ['valid','no_claim','spoofed_caller','invalid_arguments','anon_no_claim']){
    await h.scenario(`baseline_${d.id}_${variation}`,async()=>{
      await seed(h.db);const before=await snapshot(h.db)
      const who=variation==='no_claim'||variation==='anon_no_claim'?null:variation==='spoofed_caller'?(d.who===U.c?U.d:U.c):d.who
      const role=variation==='anon_no_claim'?'anon':'authenticated';const args=variation==='invalid_arguments'?d.invalid:d.args
      const r=await h.actor(role,who,d.sql,args);const after=await snapshot(h.db)
      const entry={id:d.id,case:variation,clientSqlstate:r.sqlstate,errorClassification:r.errorClassification,classificationSource:r.classificationSource,resultShape:shape(r),beforeCounts:counts(before),afterCounts:counts(after),changedTables:tables.filter(t=>digest(JSON.stringify(before[t]))!==digest(JSON.stringify(after[t])))}
      if(r.sqlstate!=='00000')h.eq(after,before,'failed statement leaves no partial rows')
      entry.failedStatementAtomic=r.sqlstate==='00000'?null:true
      if(d.id==='F01'&&r.sqlstate==='00000'){const row=after.project_roles.find(x=>x.id===invitation);h.eq(row.status,'active','invitation actually active');h.ok(row.joined_at instanceof Date,'invitation joined time recorded');entry.invitationBecameActive=true}
      if(['F05','F07'].includes(d.id)&&r.sqlstate==='00000'){h.eq(r.rows[0].value,variation==='invalid_arguments'?0:1,'synthetic notification result count');entry.syntheticCount=r.rows[0].value}
      if(d.id==='F07'&&r.sqlstate==='00000'&&variation!=='invalid_arguments'){h.eq(after.notifications[0].is_read,true,'foreign notification actually marked');entry.notificationMarked=true}
      if(d.id==='F04'&&after.projects.length>before.projects.length){entry.createdWithoutVoucher=true;entry.newProjectPaid=after.projects.some(x=>!before.projects.some(b=>b.id===x.id)&&x.payment_status==='paid')}
      if(d.id==='F10'&&r.sqlstate==='00000'){h.eq(after.export_requests,before.export_requests,'baseline queued response creates no durable request');entry.queuedWithoutRow=r.rows.length===1&&r.rows[0].status==='queued'}
      await seed(h.db);const rollbackBefore=await snapshot(h.db);const rr=await h.actor(role,who,d.sql,args,role,true)
      h.eq(rr.sqlstate,r.sqlstate,'same case within explicit rollback has same SQLSTATE');h.eq(await snapshot(h.db),rollbackBefore,'caller rollback restores all seven tables');entry.explicitRollbackVerified=true
      h.report.baseline.push(entry)
    })
  }
  // Exercise every reviewed package branch privately. Body may catch DB errors;
  // client SQLSTATE and boolean/error shape are reported separately.
  for(let i=1;i<h.privatePackages.length;i++)await h.scenario(`baseline_F09_private_branch_${i+1}`,async()=>{
    await seed(h.db);const before=await snapshot(h.db);const d=descriptors(h).find(x=>x.id==='F09');const r=await h.actor('authenticated',U.b,d.sql,[h.privatePackages[i],'synthetic-payment',U.b]);const after=await snapshot(h.db)
    h.report.baseline.push({id:'F09',case:`private_branch_${i+1}`,clientSqlstate:r.sqlstate,errorClassification:r.errorClassification,classificationSource:r.classificationSource,resultShape:shape(r),changedTables:tables.filter(t=>digest(JSON.stringify(before[t]))!==digest(JSON.stringify(after[t])))})
    h.eq(after,before,'caught purchase failure creates no partial resource or transaction rows')
  })
  await seed(h.db)
}
export async function applyCandidate(h){
  const candidate=await readFile(join(here,'candidate.sql'),'utf8')
  const state=async()=>digest(JSON.stringify((await h.db.query("SELECT oid::regprocedure::text,pg_catalog.pg_get_functiondef(oid) AS body,proacl::text FROM pg_catalog.pg_proc WHERE oid IN ('public.request_data_export(uuid,uuid,boolean,boolean)'::regprocedure,'public.request_data_export(uuid,uuid,jsonb)'::regprocedure) ORDER BY oid")).rows))
  await h.scenario('candidate_marker_guard_atomic',async()=>{const before=await state();let code;try{await h.db.query(candidate)}catch(e){code=e.code}finally{await h.db.query('ROLLBACK')}h.eq(code,'42501','local marker required');h.eq(await state(),before,'guard leaves prior function/ACL state')})
  await h.db.query("SET saga.pg17_rehearsal='only_synthetic_local'")
  await h.scenario('whole_candidate_DDL_rollback_restores_before_state',async()=>{const before=await state();const rows=await snapshot(h.db);let code;try{await h.db.query(candidate.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;'))}catch(e){code=e.code}finally{await h.db.query('ROLLBACK')}h.eq(code,'22012','actual injected SQL failure');h.eq(await state(),before,'both functions and ACLs rolled back');h.eq(await snapshot(h.db),rows,'all historical rows retained')})
  await h.db.query(candidate)
  await h.scenario('repeat_candidate_apply_preserves_existing_rows',async()=>{const before=await state();const rows=await snapshot(h.db);await h.db.query(candidate);h.eq(await state(),before,'repeat DDL stable');h.eq(await snapshot(h.db),rows,'history retained on repeat apply')})
}
const exportArgs=(kind,user=U.b,project=P.one,options)=>kind===4?[user,project,...(options??[true,false])]:[project,user,options??{includeAudio:false,includeTranscripts:false}]
export async function candidates(h,red=false){
  for(const kind of [4,3]){
    const sql=kind===4?four:three
    await h.scenario(`candidate_${kind}_durable_positive_member_and_facilitator`,async()=>{
      for(const user of [U.b,U.a]){
        const before=(await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests')).rows[0].n
        const result=await h.actor('authenticated',user,sql,exportArgs(kind,user));h.eq(result.sqlstate,'00000','authorized export succeeds');h.eq(result.rows.length,1,'exactly one returned row')
        const id=result.rows[0].export_id;h.ok(/^[0-9a-f-]{36}$/.test(id),'real uuid shape')
        const rows=(await h.db.query('SELECT * FROM public.export_requests WHERE id=$1',[id])).rows
        h.eq(rows.length,1,'returned id identifies one persistent request')
        const r=rows[0];h.eq(r.project_id,P.one,'persisted project');h.eq(r.user_id,user,'persisted user');h.eq(r.status,'pending','durable state pending');h.ok(r.created_at instanceof Date,'row timestamp present')
        h.eq(r.options,kind===4?{includeAudio:true,includePhotos:false}:{includeAudio:false,includePhotos:true,includeTranscripts:false,includeInteractions:true},'normalized bounded options persisted')
        h.eq((await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests')).rows[0].n,before+1,'exactly one durable insert')
        if(kind===4){h.eq(result.rows[0].status,'queued','queued means registered');h.eq(result.rows[0].created_at,r.created_at,'return timestamp is stored timestamp')}
        h.eq(r.download_url,null,'no fabricated download');h.eq(r.completed_at,null,'no fabricated completion')
      }
    })
    if(red)return
    for(const [name,role,claim,target,project] of [
      ['missing_identity','authenticated',null,U.b,P.one],['null_user','authenticated',U.b,null,P.one],['both_null','authenticated',null,null,P.one],['spoofed_user','authenticated',U.c,U.b,P.one],['null_project','authenticated',U.b,U.b,null],['missing_project','authenticated',U.b,U.b,P.missing],
      ['foreign_member','authenticated',U.d,U.d,P.one],['pending','authenticated',U.e,U.e,P.one],['inactive','authenticated',U.f,U.f,P.one],['deleted_member','authenticated',U.i,U.i,P.one],['owner_only','authenticated',U.g,U.g,P.one],['project_members_only','authenticated',U.h,U.h,P.one],
      ['anon','anon',null,U.b,P.one],['anon_fake_claim','anon',U.b,U.b,P.one],['metadata_fake_claim','metadata_reader',U.b,U.b,P.one],['service_fake_claim','service_role',U.b,U.b,P.one]
    ])await h.scenario(`candidate_${kind}_deny_${name}`,async()=>{
      if(name==='deleted_member'){
        const prior=await h.db.query("INSERT INTO public.project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active') RETURNING status",[project,target])
        h.eq(prior.rows,[{status:'active'}],'deleted-member fixture starts with active membership')
        const removed=await h.db.query('DELETE FROM public.project_roles WHERE project_id=$1 AND user_id=$2',[project,target])
        h.eq(removed.rowCount,1,'deleted-member fixture actually removes prior membership')
      }
      const before=await snapshot(h.db)
      if(name==='deleted_member'||name==='project_members_only')h.eq(before.project_roles.filter(r=>r.project_id===project&&r.user_id===target),[],'denied fixture has no authoritative membership')
      if(name==='project_members_only')h.eq(before.project_members.filter(r=>r.project_id===project&&r.user_id===target).map(r=>({status:r.status})),[{status:'active'}],'alternative membership is active but does not authorize')
      const result=await h.actor(role,claim,sql,exportArgs(kind,target,project),'authenticated');h.eq(result.sqlstate,'42501','export rejected');h.eq(await snapshot(h.db),before,'denial changes no state')
    })
    const invalidOptions=kind===4?[[null,true],[true,null],[null,null]]:[null,'null','[]','true','42','"text"',{unknown:true},{status:'completed'},{id:U.b},{user_id:U.a},{project_id:P.two},{includeAudio:'true'},{includePhotos:null},{includeTranscripts:0},{includeInteractions:{}},{includeAudio:[]}]
    for(const [i,options] of invalidOptions.entries())await h.scenario(`candidate_${kind}_invalid_options_${i+1}`,async()=>{const before=await snapshot(h.db);const args=kind===4?[U.b,P.one,...options]:[P.one,U.b,typeof options==='string'?options:options];const r=await h.actor('authenticated',U.b,sql,args);h.eq(r.sqlstate,'22023','invalid options rejected');h.eq(await snapshot(h.db),before,'invalid options do not insert')})
    await h.scenario(`candidate_${kind}_constraint_failure_atomic`,async()=>{const before=await snapshot(h.db);await h.db.query('ALTER TABLE public.export_requests ADD CONSTRAINT synthetic_insert_failure CHECK (false) NOT VALID');try{const r=await h.actor('authenticated',U.b,sql,exportArgs(kind));h.eq(r.sqlstate,'23514','real table constraint rejects insert');h.eq(await snapshot(h.db),before,'failed insert leaves no partial request')}finally{await h.db.query('ALTER TABLE public.export_requests DROP CONSTRAINT synthetic_insert_failure')}})
    await h.scenario(`candidate_${kind}_caller_rollback`,async()=>{const before=await snapshot(h.db);const r=await h.actor('authenticated',U.b,sql,exportArgs(kind),'authenticated',true);h.eq(r.sqlstate,'00000','inside transaction call returned successfully');h.eq(await snapshot(h.db),before,'caller rollback removes uncommitted registration')})
  }
  await h.scenario('three_option_normalization_empty_and_all_false',async()=>{
    for(const options of [{},{includeAudio:false,includePhotos:false,includeTranscripts:false,includeInteractions:false}]){const r=await h.actor('authenticated',U.b,three,[P.one,U.b,options]);h.eq(r.sqlstate,'00000','explicit option choice accepted');const expected=Object.fromEntries(['includeAudio','includePhotos','includeTranscripts','includeInteractions'].map(k=>[k,options[k]??true]));h.eq((await h.db.query('SELECT options FROM public.export_requests WHERE id=$1',[r.rows[0].export_id])).rows[0].options,expected,'all normalized choices durable')}
  })
  await h.scenario('exact_acl_owner_signature_and_search_path',async()=>{
    const rows=(await h.db.query("SELECT p.oid::regprocedure::text AS identity,p.prosecdef,p.proconfig,p.pronargdefaults,p.proargnames,p.prorettype::regtype::text AS return_type,pg_catalog.pg_get_userbyid(p.proowner) AS owner,EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_catalog.pg_proc p WHERE p.proname='request_data_export' ORDER BY p.pronargs DESC")).rows
    h.eq(rows.length,2,'only exact export pair')
    for(const r of rows){h.eq(r.prosecdef,true,'definer contract');h.eq(r.proconfig,['search_path=""'],'fixed empty safe search path');h.eq(r.owner,'fixture_owner','private owner retained');h.eq(r.public_execute,false,'PUBLIC execute revoked');h.eq(r.pronargdefaults,0,'captured signatures have no defaults')
      for(const role of ['authenticated','anon','metadata_reader','service_role'])h.eq((await h.db.query("SELECT pg_catalog.has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,r.identity])).rows[0].allowed,role==='authenticated','only authenticated exact execute')}
    h.eq(rows[0].proargnames,['p_user_id','p_project_id','p_include_audio','p_include_photos','export_id','status','created_at'],'four arg names and TABLE columns retained');h.eq(rows[0].return_type,'record','TABLE result retained');h.eq(rows[1].proargnames,['project_id','user_id','export_options'],'three arg names retained');h.eq(rows[1].return_type,'uuid','uuid result retained')
    h.eq((await h.db.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_catalog.pg_roles WHERE rolname='fixture_owner'")).rows[0],{rolsuper:false,rolbypassrls:false,rolcanlogin:false},'private owner not login or global bypass')
    h.report.exportCatalog=rows
  })
  await h.scenario('caller_table_privileges_and_role_escalation_denied',async()=>{
    for(const role of ['authenticated','anon','metadata_reader','service_role']){
      for(const t of ['export_requests','project_roles','projects'])for(const sql of [`SELECT * FROM public.${t}`,`DELETE FROM public.${t}`,`UPDATE public.${t} SET id=id`])h.eq((await h.actor(role,U.b,sql)).sqlstate,'42501','no direct local table grant')
      h.eq((await h.actor(role,U.b,'INSERT INTO public.export_requests(project_id,user_id) VALUES($1,$2)',[P.one,U.b])).sqlstate,'42501','direct insert denied')
      h.eq((await h.actor(role,U.b,'SET ROLE fixture_owner')).sqlstate,'42501','caller cannot assume definer owner')
      if(role!=='authenticated')h.eq((await h.actor(role,U.b,'SET ROLE authenticated')).sqlstate,'42501','fake claims cannot switch actual role')
    }
  })
  await h.scenario('temp_shadow_cannot_redirect_candidate',async()=>{
    const c=await h.actorClient('authenticated',U.b)
    try{await c.query('CREATE TEMP TABLE projects(id uuid,facilitator_id uuid); CREATE TEMP TABLE export_requests(id uuid); SET search_path=pg_temp');const r=await c.query(four,[U.b,P.one,false,true]);h.eq((await h.db.query('SELECT count(*)::integer AS n FROM public.export_requests WHERE id=$1',[r.rows[0].export_id])).rows[0].n,1,'qualified insert and auth survive caller temp path')}finally{await h.close(c)}
  })
  await h.scenario('captured_trigger_actual_update_on_all_three_tables',async()=>{
    for(const [table,key,id] of [['projects','id',P.one],['project_roles','user_id',U.b],['user_resource_wallets','user_id',U.b]]){const r=(await h.db.query(`UPDATE public.${table} SET updated_at='2001-01-01' WHERE ${key}=$1 RETURNING updated_at,pg_catalog.now() AS transaction_time`,[id])).rows;h.ok(r.length>0,'trigger has matching synthetic row');for(const row of r)h.eq(row.updated_at,row.transaction_time,'exact trigger writes transaction time')}
  })
}

export async function checkDomains(h){
  h.report.schema.domainTests=[]
  for(const [table,column,values,sql,args] of [
    ['notifications','type',['new_story','new_comment','new_follow_up_question','story_response','project_invitation','member_joined','chapter_completed','export_ready'],"INSERT INTO public.notifications(recipient_id,type,title,message) VALUES($1,$2,'Synthetic','Synthetic')",[U.b]],
    ['project_members','role',['facilitator','storyteller'],"INSERT INTO public.project_members(project_id,user_id,role) VALUES($1,$2,$3)",[P.two,U.c]]
  ])await h.scenario(`schema_${table}_check_domain_and_nullability`,async()=>{
    const codes=[]
    for(const value of [...values,'synthetic_invalid',null]){
      await h.db.query('BEGIN');let code='00000'
      try{await h.db.query(sql,[...args,value])}catch(e){code=e.code}finally{await h.db.query('ROLLBACK')}
      h.eq(code,value===null?'23502':value==='synthetic_invalid'?'23514':'00000','actual CHECK values and separate NOT NULL rejection');codes.push({value,sqlstate:code})
    }
    await h.db.query('BEGIN')
    try{await h.db.query(`ALTER TABLE public.${table} ALTER COLUMN ${column} DROP NOT NULL`);await h.db.query(sql,[...args,null]);h.ok(true,'CHECK permits SQL NULL when isolated from NOT NULL')}finally{await h.db.query('ROLLBACK')}
    h.report.schema.domainTests.push({table,column,observed:codes,checkAlonePermitsNull:true,nullabilityRestoredByRollback:true})
  })
}
