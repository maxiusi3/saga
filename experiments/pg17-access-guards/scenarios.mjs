import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, digest, failure } from '../pg17-routines/runtime.mjs'

export const U={owner:'11000000-0000-0000-0000-000000000001',invitee:'11000000-0000-0000-0000-000000000002',other:'11000000-0000-0000-0000-000000000003',next:'11000000-0000-0000-0000-000000000004'}
export const P={one:'21000000-0000-0000-0000-000000000001',two:'21000000-0000-0000-0000-000000000002',missing:'21000000-0000-0000-0000-000000000099'}
export const I='31000000-0000-0000-0000-000000000001'
export const accept='SELECT * FROM public.accept_project_invitation($1::uuid,$2::uuid)'
export const create='SELECT public.create_project_with_role($1::text,$2::text,$3::uuid,$4::text) AS project_id'
export const tables=['projects','project_roles','user_resource_wallets','seat_transactions','project_members','export_requests','notifications']
export const identity=['public.accept_project_invitation(uuid,uuid)','public.create_project_with_role(text,text,uuid,text)']
export async function seed(db){
  await db.query('TRUNCATE '+tables.map(t=>'public.'+t).join(',')+',auth.users')
  for(const id of Object.values(U))await db.query('INSERT INTO auth.users(id) VALUES($1)',[id])
  for(const id of [P.one,P.two])await db.query("INSERT INTO public.projects(id,name,facilitator_id,owner_id,updated_at) VALUES($1,'Synthetic history',$2,$2,'2001-01-01')",[id,U.owner])
  await db.query("INSERT INTO public.project_roles(id,user_id,project_id,role,status,invited_by,updated_at) VALUES($1,$2,$3,'storyteller','pending',$4,'2001-01-01')",[I,U.invitee,P.one,U.owner])
  await db.query("INSERT INTO public.project_roles(user_id,project_id,role,status,invited_by,joined_at,updated_at) VALUES($1,$2,'facilitator','active',$1,'2001-01-01','2001-01-01')",[U.owner,P.one])
  for(const id of [U.owner,U.invitee])await db.query("INSERT INTO public.user_resource_wallets(user_id,project_vouchers,facilitator_seats,storyteller_seats,last_payment_reference,updated_at) VALUES($1,3,4,5,'synthetic-history-reference','2001-01-01')",[id])
  await db.query("INSERT INTO public.seat_transactions(user_id,transaction_type,resource_type,amount,project_id,metadata) VALUES($1,'purchase','package',1,$2,'{\"syntheticHistory\":true}')",[U.owner,P.one])
  await db.query("INSERT INTO public.export_requests(project_id,user_id,status) VALUES($1,$2,'completed')",[P.one,U.owner])
}
export async function snapshot(db){const s={};for(const t of tables)s[t]=(await db.query(`SELECT * FROM public.${t} ORDER BY ${t==='user_resource_wallets'?'user_id':'id'}`)).rows;return s}
export const fingerprint=s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,{rows:v.length,sha256:digest(JSON.stringify(v))}]))
export async function catalog(db){return (await db.query(`SELECT p.oid::regprocedure::text AS identity,pg_catalog.pg_get_function_arguments(p.oid) AS arguments,pg_catalog.pg_get_function_result(p.oid) AS result,p.proargnames,p.proargmodes,p.pronargdefaults,pg_catalog.pg_get_expr(p.proargdefaults,0) AS defaults,p.prosecdef,p.proconfig,p.provolatile,p.proisstrict,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl FROM pg_catalog.pg_proc p WHERE p.oid=ANY($1::regprocedure[]) ORDER BY p.proname`,[identity])).rows}
export async function originalRed(h){
  h.report.red=[]
  for(const [name,claim] of [['missing_caller',null],['forged_caller',U.other]]){
    await seed(h.db);const before=await snapshot(h.db)
    const r=await h.actor('authenticated',claim,accept,[I,U.invitee]);const after=await snapshot(h.db)
    const entry={name,sqlstate:r.sqlstate,expectedSqlstate:'42501',before:fingerprint(before),after:fingerprint(after),invitationBecameActive:after.project_roles.find(x=>x.id===I)?.status==='active'}
    h.report.red.push(entry)
    try{await h.scenario(`original_red_accept_${name}`,async()=>{h.eq(r.sqlstate,'42501','missing or forged caller cannot activate invitation');h.eq(after,before,'identity denial has no writes')})}catch(e){if(e.code!=='ASSERT_FAILED')throw e;entry.expectedAssertionFailed=true}
  }
  await seed(h.db);await h.db.query('UPDATE public.user_resource_wallets SET project_vouchers=0 WHERE user_id=$1',[U.owner]);const before=await snapshot(h.db)
  const r=await h.actor('authenticated',U.owner,create,['Synthetic zero voucher','',U.owner,'facilitator']);const after=await snapshot(h.db)
  const entry={name:'zero_voucher_creation',sqlstate:r.sqlstate,expectedSqlstate:'42501',before:fingerprint(before),after:fingerprint(after),projectsAdded:after.projects.length-before.projects.length,rolesAdded:after.project_roles.length-before.project_roles.length};h.report.red.push(entry)
  try{await h.scenario('original_red_zero_voucher_creates_no_project_or_role',async()=>{h.eq(after.projects,before.projects,'zero vouchers cannot create project');h.eq(after.project_roles,before.project_roles,'zero vouchers cannot create role');h.eq(r.sqlstate,'42501','insufficient resources denied')})}catch(e){if(e.code!=='ASSERT_FAILED')throw e;entry.expectedAssertionFailed=true}
  h.eq(h.report.red.filter(x=>x.expectedAssertionFailed).length,3,'all three intended original regressions reproduced')
  throw failure('EXPECTED_RED','original routines violate three access/resource assertions')
}

export async function invariant(h,before,label){
  const after=await snapshot(h.db)
  h.eq(after,before,label)
  h.report.stateChecks??=[]
  h.report.stateChecks.push({label,before:fingerprint(before),after:fingerprint(after),unchanged:true})
}
export async function denied(h,{name,sql=accept,args=[I,U.invitee],role='authenticated',claim=U.invitee,code='42501',setup}){
  await h.scenario(name,async()=>{
    await seed(h.db);if(setup)await setup(h.db)
    const before=await snapshot(h.db),r=await h.actor(role,claim,sql,args,'authenticated')
    h.eq(r.sqlstate,code,'expected access or validation denial')
    await invariant(h,before,name+' preserves all seven tables')
  })
}
async function definitionState(db){return digest(JSON.stringify((await db.query(`SELECT p.oid::regprocedure::text,pg_catalog.pg_get_functiondef(p.oid),p.proacl::text FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid`)).rows))}
export async function applyCandidate(h){
  const sql=await readFile(join(root,'experiments/pg17-access-guards/candidate.sql'),'utf8')
  await h.scenario('independent_local_marker_required',async()=>{
    const before=await definitionState(h.db),rows=await snapshot(h.db)
    // The previous export marker alone must never authorize this batch.
    await h.db.query("SET saga.pg17_rehearsal='only_synthetic_local'")
    let code;try{await h.db.query(sql)}catch(e){code=e.code}finally{await h.db.query('ROLLBACK')}
    h.eq(code,'42501','new marker mandatory');h.eq(await definitionState(h.db),before,'marker rejection restores all definitions and ACLs');await invariant(h,rows,'marker rejection preserves history')
  })
  await h.db.query("SET saga.pg17_access_guards='only_synthetic_local'")
  await h.scenario('candidate_ddl_failure_rolls_back_functions_acls_and_history',async()=>{
    const before=await definitionState(h.db),rows=await snapshot(h.db)
    let code;try{await h.db.query(sql.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;'))}catch(e){code=e.code}finally{await h.db.query('ROLLBACK')}
    h.eq(code,'22012','injected actual SQL error');h.eq(await definitionState(h.db),before,'transaction restores original definitions and ACLs');await invariant(h,rows,'DDL rollback preserves history')
  })
  const unrelated=async()=> (await h.db.query(`SELECT p.oid::regprocedure::text AS identity,pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS md5,p.proacl::text AS acl FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT p.oid=ANY($1::regprocedure[]) ORDER BY p.oid`,[identity])).rows
  const untouched=await unrelated(),rows=await snapshot(h.db)
  await h.db.query(sql)
  h.eq(await unrelated(),untouched,'other eleven replayed definitions and ACLs unchanged')
  await invariant(h,rows,'initial candidate apply preserves every historical row')
  await h.scenario('repeat_apply_has_no_business_replay',async()=>{
    const before=await definitionState(h.db),rows=await snapshot(h.db)
    await h.db.query(sql);h.eq(await definitionState(h.db),before,'repeat candidate stable');await invariant(h,rows,'repeat apply preserves history')
  })
}
async function checkCatalog(h){
  await h.scenario('exact_signatures_defaults_results_owner_and_acl',async()=>{
    const rows=await catalog(h.db);h.eq(rows.length,2,'exact two target signatures')
    const immutable=['identity','arguments','result','proargnames','proargmodes','pronargdefaults','defaults','prosecdef','provolatile','proisstrict','owner']
    for(const [i,r] of rows.entries()){
      for(const k of immutable)h.eq(r[k],h.report.originalCatalog[i][k],'captured declaration '+k+' retained')
      h.eq(r.proconfig,['search_path=""'],'fixed empty search path')
      const acl=(await h.db.query(`SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure ORDER BY grantee`,[r.identity])).rows
      h.eq(acl,[{grantee:'authenticated',privilege_type:'EXECUTE',is_grantable:false},{grantee:'fixture_owner',privilege_type:'EXECUTE',is_grantable:false}],'only owner and authenticated execute')
      for(const role of ['authenticated','anon','metadata_reader','service_role'])h.eq((await h.db.query("SELECT pg_catalog.has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,r.identity])).rows[0].allowed,role==='authenticated','effective role execute boundary')
    }
    h.report.candidateCatalog=rows
  })
}
export async function assertAccepted(h,before,result){
  h.eq(result.sqlstate,'00000','self acceptance succeeds');h.eq(result.rows.length,1,'exactly one returned member');h.eq(Object.keys(result.rows[0]).sort(),['joined_at','project_id','role','status','user_id'],'restricted TABLE result')
  const after=await snapshot(h.db),target=after.project_roles.find(r=>r.id===I),prior=before.project_roles.find(r=>r.id===I)
  h.eq(result.rows[0],{project_id:target.project_id,user_id:target.user_id,role:target.role,status:target.status,joined_at:target.joined_at},'return is exact persisted member state')
  h.eq(target.status,'active','only pending becomes active');h.ok(target.joined_at instanceof Date,'joined time recorded')
  h.eq({...target,status:prior.status,joined_at:prior.joined_at,updated_at:prior.updated_at},prior,'other invitation fields retained')
  h.eq({...after,project_roles:after.project_roles.map(r=>r.id===I?prior:r)},before,'no other member/project/wallet/log changes')
  h.report.accepted??=[];h.report.accepted.push({role:target.role,before:fingerprint(before),after:fingerprint(after),restrictedReturn:true})
}
export async function assertCreated(h,before,result,role='facilitator',description=null,name='Synthetic created'){
  h.eq(result.sqlstate,'00000','funded self creation succeeds');h.eq(result.rows.length,1,'one UUID result');h.eq(Object.keys(result.rows[0]),['project_id'],'restricted UUID return')
  const id=result.rows[0].project_id;h.ok(/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id),'UUID result shape')
  const after=await snapshot(h.db),p=after.projects.find(r=>r.id===id),member=after.project_roles.filter(r=>r.project_id===id)
  h.ok(p,'returned project exists');h.eq({name:p.name,description:p.description,facilitator_id:p.facilitator_id,owner_id:p.owner_id,status:p.status,payment_status:p.payment_status},{name,description,facilitator_id:U.owner,owner_id:U.owner,status:'active',payment_status:'unverified'},'owned active project explicitly unverified')
  h.eq(member.length,1,'exact one creator member');h.eq({user:member[0].user_id,role:member[0].role,status:member[0].status},{user:U.owner,role,status:'active'},'correct active creator role');h.ok(member[0].joined_at instanceof Date,'creator joined time present')
  const wallet=after.user_resource_wallets.find(r=>r.user_id===U.owner),prior=before.user_resource_wallets.find(r=>r.user_id===U.owner),seat=role==='facilitator'?'facilitator_seats':'storyteller_seats'
  h.eq(wallet.project_vouchers,prior.project_vouchers-1,'exactly one voucher consumed');h.eq(wallet[seat],prior[seat]-1,'exact corresponding role seat consumed')
  h.eq({...wallet,project_vouchers:prior.project_vouchers,[seat]:prior[seat],updated_at:prior.updated_at},prior,'all other balances and payment reference retained')
  const logs=after.seat_transactions.filter(r=>r.project_id===id)
  h.eq(logs.map(r=>({user:r.user_id,type:r.transaction_type,resource:r.resource_type,amount:r.amount,project:r.project_id})).sort((a,b)=>a.resource.localeCompare(b.resource)),[{user:U.owner,type:'consume',resource:'project_voucher',amount:-1,project:id},{user:U.owner,type:'consume',resource:role+'_seat',amount:-1,project:id}].sort((a,b)=>a.resource.localeCompare(b.resource)),'exact two consume logs belong to same project')
  h.eq({...after,projects:after.projects.filter(r=>r.id!==id),project_roles:after.project_roles.filter(r=>r.project_id!==id),seat_transactions:after.seat_transactions.filter(r=>r.project_id!==id),user_resource_wallets:after.user_resource_wallets.map(r=>r.user_id===U.owner?prior:r)},before,'every historical row and unrelated table retained')
  h.report.created??=[];h.report.created.push({role,before:fingerprint(before),after:fingerprint(after),consumption:{project_voucher:1,[role+'_seat']:1},paymentStatus:'unverified',restrictedReturn:true})
  return id
}
async function acceptance(h){
  for(const role of ['facilitator','storyteller'])await h.scenario('accept_positive_'+role,async()=>{
    await seed(h.db);await h.db.query('UPDATE public.project_roles SET role=$1 WHERE id=$2',[role,I])
    const before=await snapshot(h.db),r=await h.actor('authenticated',U.invitee,accept,[I,U.invitee]);await assertAccepted(h,before,r)
    const committed=await snapshot(h.db),again=await h.actor('authenticated',U.invitee,accept,[I,U.invitee]);h.eq(again.sqlstate,'42501','second accept explicitly denied');await invariant(h,committed,'repeat acceptance never overwrites joined_at')
  })
  await h.scenario('accept_committed_valid_rebinding_has_no_prior_version_fact',async()=>{
    await seed(h.db)
    h.eq((await h.db.query('SELECT project_id,user_id FROM public.project_roles WHERE id=$1',[I])).rows,[{project_id:P.one,user_id:U.invitee}],'original synthetic binding established')
    await h.db.query('UPDATE public.project_roles SET project_id=$1,user_id=$2 WHERE id=$3',[P.two,U.other,I])
    const before=await snapshot(h.db),r=await h.actor('authenticated',U.other,accept,[I,U.other])
    await assertAccepted(h,before,r)
    h.eq({project_id:r.rows[0].project_id,user_id:r.rows[0].user_id},{project_id:P.two,user_id:U.other},'current valid committed binding is the only binding available to this signature')
    h.report.compatibilityBoundary={scenario:'accept_committed_valid_rebinding_has_no_prior_version_fact',preInvocationRebindCommitted:true,sqlstate:r.sqlstate,returnedCurrentBinding:true,limitation:'The first observed (project_id,user_id) tuple is compared with the locked tuple; mismatches are denied. A valid committed binding before the first lookup is current fact. This signature does not prove lifetime binding immutability or detect a change and restoration to the same tuple between reads (ABA).'}
  })
  for(const [name,claim,user,id] of [['missing_identity',null,U.invitee,I],['forged_identity',U.other,U.invitee,I],['null_user',U.invitee,null,I],['both_null',null,null,I],['foreign_member',U.other,U.other,I],['null_id',U.invitee,U.invitee,null],['missing_id',U.invitee,U.invitee,P.missing]])await denied(h,{name:'accept_deny_'+name,claim,args:[id,user]})
  for(const [name,sql,args] of [
    ['active',"UPDATE public.project_roles SET status='active',joined_at='2001-01-01' WHERE id=$1",[I]],
    ['inactive',"UPDATE public.project_roles SET status='inactive' WHERE id=$1",[I]],
    ['null_status','UPDATE public.project_roles SET status=NULL WHERE id=$1',[I]],
    ['deleted','DELETE FROM public.project_roles WHERE id=$1',[I]],
    ['rebound_user','UPDATE public.project_roles SET user_id=$1 WHERE id=$2',[U.other,I]],
    ['missing_inviter','UPDATE public.project_roles SET invited_by=NULL WHERE id=$1',[I]],
    ['stale_inviter','UPDATE public.project_roles SET invited_by=$1 WHERE id=$2',[U.other,I]],
    ['transferred_project','UPDATE public.projects SET facilitator_id=$1 WHERE id=$2',[U.next,P.one]],
    ['inactive_project',"UPDATE public.projects SET status='inactive' WHERE id=$1",[P.one]],
    ['null_project_status','UPDATE public.projects SET status=NULL WHERE id=$1',[P.one]],
    ['deleted_project','DELETE FROM public.projects WHERE id=$1',[P.one]]
  ])await denied(h,{name:'accept_deny_'+name,setup:db=>db.query(sql,args)})
  // Isolated malformed legacy role: remove the fixture CHECK only for this case;
  // test the function's own eligibility check, then restore the exact CHECK.
  await h.db.query('ALTER TABLE public.project_roles DROP CONSTRAINT project_roles_role_check')
  try{await denied(h,{name:'accept_deny_invalid_legacy_role',setup:db=>db.query("UPDATE public.project_roles SET role='invalid' WHERE id=$1",[I])})}
  finally{await seed(h.db);await h.db.query("ALTER TABLE public.project_roles ADD CONSTRAINT project_roles_role_check CHECK (role = ANY (ARRAY['facilitator'::text,'storyteller'::text]))")}
}
async function creation(h){
  for(const role of ['facilitator','storyteller'])for(const desc of ['',null,'Synthetic description'])await h.scenario(`create_positive_${role}_${desc===null?'null':desc===''?'empty':'text'}_description`,async()=>{
    await seed(h.db);const before=await snapshot(h.db),r=await h.actor('authenticated',U.owner,create,['Synthetic created',desc,U.owner,role]);await assertCreated(h,before,r,role,desc||null)
  })
  await h.scenario('create_omitted_role_preserves_original_default',async()=>{await seed(h.db);const before=await snapshot(h.db),r=await h.actor('authenticated',U.owner,'SELECT public.create_project_with_role($1::text,$2::text,$3::uuid) AS project_id',['Synthetic created','',U.owner]);await assertCreated(h,before,r)})
  for(const [name,claim,user] of [['missing_identity',null,U.owner],['forged_identity',U.other,U.owner],['null_user',U.owner,null],['both_null',null,null]])await denied(h,{name:'create_deny_'+name,sql:create,claim,args:['Synthetic created','',user,'facilitator']})
  for(const value of [null,'','invalid','FACILITATOR','storyteller '])await denied(h,{name:'create_invalid_role_'+String(value),sql:create,claim:U.owner,args:['Synthetic created','',U.owner,value],code:'22023'})
  for(const [i,name] of [null,'',' ','\t\r\n ','\n'].entries())await denied(h,{name:'create_invalid_name_'+i,sql:create,claim:U.owner,args:[name,'',U.owner,'facilitator'],code:'22023'})
  for(const role of ['facilitator','storyteller']){
    const seat=role==='facilitator'?'facilitator_seats':'storyteller_seats'
    await denied(h,{name:'create_missing_wallet_'+role,sql:create,claim:U.owner,args:['Synthetic created','',U.owner,role],setup:db=>db.query('DELETE FROM public.user_resource_wallets WHERE user_id=$1',[U.owner])})
    for(const col of ['project_vouchers',seat])for(const value of [0,null])await denied(h,{name:`create_insufficient_${role}_${col}_${value}`,sql:create,claim:U.owner,args:['Synthetic created','',U.owner,role],setup:db=>db.query(`UPDATE public.user_resource_wallets SET ${col}=$1 WHERE user_id=$2`,[value,U.owner])})
    await h.scenario('create_does_not_require_other_seat_'+role,async()=>{
      await seed(h.db);const other=role==='facilitator'?'storyteller_seats':'facilitator_seats';await h.db.query(`UPDATE public.user_resource_wallets SET ${other}=NULL WHERE user_id=$1`,[U.owner]);const before=await snapshot(h.db)
      await assertCreated(h,before,await h.actor('authenticated',U.owner,create,['Synthetic created','',U.owner,role]),role)
    })
  }
  await h.scenario('no_idempotency_key_two_funded_calls_each_consume',async()=>{
    await seed(h.db);await h.db.query('UPDATE public.user_resource_wallets SET project_vouchers=2,storyteller_seats=2 WHERE user_id=$1',[U.owner]);const ids=[]
    for(let i=0;i<2;i++){const before=await snapshot(h.db);ids.push(await assertCreated(h,before,await h.actor('authenticated',U.owner,create,['Synthetic created','',U.owner,'storyteller']),'storyteller'))}
    h.eq(new Set(ids).size,2,'same request arguments create distinct funded projects')
  })
}
async function failures(h){
  for(const role of ['facilitator','storyteller'])for(const [table,condition] of [
    ['projects','false'],['project_roles','false'],['user_resource_wallets','false'],
    ['seat_transactions',"resource_type <> 'project_voucher'"],['seat_transactions',`resource_type <> '${role}_seat'`]
  ])await h.scenario(`create_${role}_injected_${table}_${condition}`,async()=>{
    await seed(h.db);const before=await snapshot(h.db)
    await h.db.query(`ALTER TABLE public.${table} ADD CONSTRAINT access_synthetic_failure CHECK (${condition}) NOT VALID`)
    try{const r=await h.actor('authenticated',U.owner,create,['Synthetic created','',U.owner,role]);h.eq(r.sqlstate,'23514','real constraint failure surfaced');await invariant(h,before,'injected '+table+' failure rolls back wallet project member and logs')}
    finally{await h.db.query(`ALTER TABLE public.${table} DROP CONSTRAINT access_synthetic_failure`)}
  })
  await h.scenario('accept_update_constraint_failure_atomic',async()=>{
    await seed(h.db);const before=await snapshot(h.db);await h.db.query('ALTER TABLE public.project_roles ADD CONSTRAINT access_synthetic_failure CHECK (false) NOT VALID')
    try{const r=await h.actor('authenticated',U.invitee,accept,[I,U.invitee]);h.eq(r.sqlstate,'23514','actual acceptance update failure');await invariant(h,before,'failed acceptance retains pending state and all history')}
    finally{await h.db.query('ALTER TABLE public.project_roles DROP CONSTRAINT access_synthetic_failure')}
  })
  for(const role of ['facilitator','storyteller'])for(const kind of ['create','accept'])await h.scenario(`${kind}_${role}_explicit_caller_rollback`,async()=>{
    await seed(h.db);await h.db.query('UPDATE public.project_roles SET role=$1 WHERE id=$2',[role,I]);const before=await snapshot(h.db)
    const r=await h.actor('authenticated',kind==='accept'?U.invitee:U.owner,kind==='accept'?accept:create,kind==='accept'?[I,U.invitee]:['Synthetic created','',U.owner,role],'authenticated',true)
    h.eq(r.sqlstate,'00000','RPC succeeds inside caller transaction');await invariant(h,before,'caller rollback removes every '+kind+' write')
  })
}
async function boundaries(h){
  for(const role of ['anon','metadata_reader','service_role'])for(const claim of [null,U.invitee])await denied(h,{name:`accept_acl_${role}_${claim===null?'absent':'forged'}`,role,claim})
  for(const role of ['anon','metadata_reader','service_role'])for(const claim of [null,U.owner])await denied(h,{name:`create_acl_${role}_${claim===null?'absent':'forged'}`,role,claim,sql:create,args:['Synthetic created','',U.owner,'facilitator']})
  await h.scenario('actual_roles_cannot_escalate_or_write_tables',async()=>{
    await seed(h.db);const before=await snapshot(h.db)
    for(const role of ['authenticated','anon','metadata_reader','service_role']){
      for(const t of tables.slice(0,4)){
        h.eq((await h.actor(role,U.owner,`UPDATE public.${t} SET ${t==='user_resource_wallets'?'user_id=user_id':'id=id'}`)).sqlstate,'42501','synthetic direct-table update denied');await invariant(h,before,role+' direct '+t+' denial has no writes')
      }
      h.eq((await h.actor(role,U.owner,'SET ROLE fixture_owner')).sqlstate,'42501','caller cannot become definer owner');await invariant(h,before,role+' owner escalation denial has no writes')
      if(role!=='authenticated'){h.eq((await h.actor(role,U.owner,'SET ROLE authenticated')).sqlstate,'42501','claim cannot change database role');await invariant(h,before,role+' authenticated escalation denial has no writes')}
    }
    await invariant(h,before,'local boundary probes leave no writes')
  })
  await h.scenario('caller_temp_search_path_cannot_shadow_guards',async()=>{
    await seed(h.db);let before=await snapshot(h.db);const a=await h.actorClient('authenticated',U.invitee)
    try{await a.query('CREATE TEMP TABLE projects(id uuid); CREATE TEMP TABLE project_roles(id uuid); SET search_path=pg_temp');const r=await a.query(accept,[I,U.invitee]);await assertAccepted(h,before,{...r,sqlstate:'00000'})}finally{await h.close(a)}
    before=await snapshot(h.db);const c=await h.actorClient('authenticated',U.owner)
    try{await c.query('CREATE TEMP TABLE projects(id uuid); CREATE TEMP TABLE project_roles(id uuid); CREATE TEMP TABLE user_resource_wallets(user_id uuid); CREATE TEMP TABLE seat_transactions(id uuid); SET search_path=pg_temp');const r=await c.query(create,['Synthetic created','',U.owner,'storyteller']);await assertCreated(h,before,{...r,sqlstate:'00000'},'storyteller')}finally{await h.close(c)}
  })
}
async function combinedExport(h){
  await h.db.query(await readFile(join(root,'experiments/pg17-routines/candidate.sql'),'utf8'))
  for(const kind of ['table','uuid'])await h.scenario('combined_accept_export_revoke_'+kind,async()=>{
    await seed(h.db)
    const sql=kind==='table'?'SELECT * FROM public.request_data_export($1::uuid,$2::uuid,true,false)':'SELECT public.request_data_export($2::uuid,$1::uuid,$3::jsonb) AS export_id',args=kind==='table'?[U.invitee,P.one]:[U.invitee,P.one,{}]
    let before=await snapshot(h.db)
    for(const [role,claim] of [['anon',null],['authenticated',null],['authenticated',U.other]]){
      h.eq((await h.actor(role,claim,accept,[I,U.invitee])).sqlstate,'42501','unauthorized accept denied before export');await invariant(h,before,'forged accept cannot manufacture active member')
    }
    h.eq((await h.actor('authenticated',U.invitee,sql,args)).sqlstate,'42501','pending member cannot export');await invariant(h,before,'pending export denial preserves all history')
    await assertAccepted(h,before,await h.actor('authenticated',U.invitee,accept,[I,U.invitee]))
    const result=await h.actor('authenticated',U.invitee,sql,args);h.eq(result.sqlstate,'00000','legal accepted member can register export')
    h.eq((await h.db.query('SELECT user_id,project_id,status FROM public.export_requests WHERE id=$1',[result.rows[0].export_id])).rows,[{user_id:U.invitee,project_id:P.one,status:'pending'}],'export registration durable and bound to accepted project')
    await h.db.query("UPDATE public.project_roles SET status='inactive' WHERE id=$1",[I]);before=await snapshot(h.db)
    h.eq((await h.actor('authenticated',U.invitee,sql,args)).sqlstate,'42501','revoked member denied new export');await invariant(h,before,'revoked export cannot change prior completed or pending requests')
  })
}
export async function candidates(h){await checkCatalog(h);await acceptance(h);await creation(h);await failures(h);await boundaries(h);await combinedExport(h)}
