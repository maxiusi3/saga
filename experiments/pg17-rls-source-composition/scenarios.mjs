import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { root, digest } from '../pg17-routines/runtime.mjs'
import * as rls from '../rls-rehearsal/scenarios.mjs'
import * as entitlement from '../pg17-entitlement-events/scenarios.mjs'
import { sources, manage } from '../pg17-invitation-management/scenarios.mjs'
import { adaptedClient, adaptSql, adaptations, rlsCandidate } from './compatibility.mjs'
const require=createRequire(import.meta.url)
const oldLedger=require('../t02-source-ledger/scenarios.cjs')
const {createLedger}=require('../t02-source-ledger/ledger.cjs')
export const ts=require('typescript')

export async function compatibilityRed(h) {
  const db=h.db, u=randomUUID(), p=randomUUID(), u2=randomUUID(), p2=randomUUID(), s=randomUUID()
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[u,u2])
  await db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'RED synthetic family',$2)",[p,u])
  await db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'RED synthetic family 2',$2)",[p2,u2])
  h.report.compatibilityRed=[]
  for(const [id,sql,args,expected] of [
    ['rls_projects_columns',adaptations[0][1],[randomUUID(),'RED A',u,randomUUID(),'RED B',u],'23502'],
    ['rls_roles_columns',adaptations[1][1],[randomUUID(),p,u,'storyteller','active'],'23503'],
    ['ledger_project_name',adaptations[2][1],[randomUUID(),randomUUID(),u,u],'23502'],
    ['ledger_roles_columns',adaptations[3][1],[p,u,p2,u2],'23503'],
    ['storage_partial_conflict_target',adaptations[5][1],[randomUUID(),'saga',`${u}/red.jpg`,u],'42P10'],
  ]) await h.scenario('compatibility_RED_'+id,async()=>{
    const r=await entitlement.result(db.query(sql,args))
    h.report.compatibilityRed.push({id,sqlstate:r.sqlstate,expected,statementSha256:digest(sql),independentSetup:true})
    h.eq(r.sqlstate,expected,'old assumption fails independently of setup')
  })
  await h.scenario('full_story_trigger_RED_and_business_columns_proof',async()=>{
    await db.query("INSERT INTO stories(id,project_id,storyteller_id,title,updated_at,images) VALUES($1,$2,$3,'RED story','2000-01-01',ARRAY['null'::jsonb,NULL])",[s,p,u])
    const query="SELECT row_to_json(s)::text AS whole,(to_jsonb(s)-'updated_at')::text AS business,updated_at FROM stories s WHERE id=$1"
    const before=(await db.query(query,[s])).rows[0]
    await db.query('UPDATE stories SET title=title WHERE id=$1',[s])
    const after=(await db.query(query,[s])).rows[0]
    h.ok(digest(before.whole)!==digest(after.whole),'old whole-row hash RED changed after harmless update')
    h.eq(after.business,before.business,'every column except updated_at is exactly retained')
    h.ok(after.updated_at>before.updated_at,'real reviewed trigger advanced timestamp')
    h.report.compatibilityRed.push({id:'story_hash_excludes_only_updated_at',oldInvariantFailed:true,businessColumnsUnchanged:true,updatedAtAdvanced:true,beforeSha256:digest(before.whole),afterSha256:digest(after.whole)})
  })
  await db.query('DELETE FROM stories WHERE id=$1',[s])
  await db.query('DELETE FROM projects WHERE id=ANY($1)',[[p,p2]])
  await db.query('DELETE FROM auth.users WHERE id=ANY($1)',[[u,u2]])
}

export async function rlsMatrix(h) {
  h.report.phase='old_rls_matrix'
  for(const u of Object.values(rls.U))await h.db.query('INSERT INTO auth.users(id) VALUES($1)',[u])
  const db=adaptedClient(h,h.db)
  await rls.seed(db)
  const adapter={db,eq:h.eq.bind(h),ok:h.ok.bind(h),scenario:h.scenario.bind(h),
    observe:async(name,fn)=>{h.report.observations.push({name,...await fn()})},
    actor:async(role,user,sql,args=[])=>{
      const r=await h.actor(role,user,adaptSql(h,sql),args,role,true)
      return r.sqlstate==='00000'?{rows:r.rows,rowCount:r.rowCount}:{error:r.sqlstate}
    },
    client:()=>h.actorClient('authenticated',null)
  }
  await rls.characterize(adapter)
  for(const t of ['projects','project_roles','project_members','stories'])await h.db.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`)
  const sql=await rlsCandidate(h)
  await h.scenario('rls_candidate_wrong_marker_and_transaction_rollback',async()=>{
    const inventory='SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname'
    const before=(await h.db.query(inventory)).rows
    await h.db.query("SET saga.rls_rehearsal='wrong'")
    h.eq((await entitlement.result(h.db.query(sql))).sqlstate,'42501','wrong marker rejected')
    await h.db.query('ROLLBACK')
    h.eq((await h.db.query(inventory)).rows,before,'wrong marker preserves policies')
    await h.db.query("SET saga.rls_rehearsal='only_synthetic_local'")
    h.eq((await entitlement.result(h.db.query(sql.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')))).sqlstate,'22012','actual SQL error after DDL')
    await h.db.query('ROLLBACK')
    h.eq((await h.db.query(inventory)).rows,before,'DDL rolled back completely')
    h.eq((await h.db.query("SELECT to_regnamespace('saga_rls_guard') AS ns")).rows[0].ns,null,'helper DDL rolled back')
  })
  await h.db.query(sql)
  await h.scenario('rls_candidate_reapplication',async()=>{
    const inventory='SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname'
    const before=(await h.db.query(inventory)).rows
    await h.db.query(sql)
    h.eq((await h.db.query(inventory)).rows,before,'candidate idempotent')
  })
  await rls.verifyCandidate(adapter)
}

export async function projector(h) {
  const outputs=[]
  for(const name of ['legacy-media-reference','legacy-story-media']) {
    const source=await readFile(join(root,`packages/web/src/lib/${name}.ts`),'utf8')
    const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    const path=join(h.scratch,name+'.cjs')
    // The real projector imports ./legacy-media-reference; retain its .js resolution.
    await writeFile(join(h.scratch,name+'.js'),out,{flag:'wx'})
    outputs.push({source:`packages/web/src/lib/${name}.ts`,sourceSha256:digest(source),generatedSha256:digest(out)})
  }
  h.report.projector={typescript:ts.version,outputs}
  return require(join(h.scratch,'legacy-story-media.js')).planLegacyStoryMedia
}

export async function ledgerMatrix(h,planLegacyStoryMedia) {
  h.report.phase='old_source_ledger_matrix'
  h.report.matrixPhases={ledger:'Full historical source ledger run on PG17/full metadata fixture before candidate RLS immutable identity trigger; administrative adapter unchanged.',rls:'Complete frozen RLS characterization and candidate run, using separate synthetic IDs and actual low privilege sessions.',combined:'Own end-to-end seed with all RLS, entitlement, invitation, management and ledger candidates active in the same database.',observedReverseOrderFailure:{path:'docs/research/evidence/2026-10-22-pg17-rls-source-composition/run-2026-10-23T01-49-34.634Z-1143fc6b-a88b-4ad9-a3a3-c70b7920cb02.json',code:'42501',ledgerChecksCompleted:181,lastCompleted:'source version changed during wait: rejection leaves no binding',cause:'The next source-project mutation is rejected by the candidate immutable-story-identity trigger.'}}
  const db=adaptedClient(h,h.db)
  await oldLedger.seed(db)
  await h.scenario('complete_frozen_source_ledger_run',()=>oldLedger.run({db,connect:()=>h.client(),planLegacyStoryMedia,
    checkpoint:()=>h.check(),report:h.report,
    check:(name,actual,expected)=>{h.eq(actual,expected,name);h.report.checks.push(name)}
  }))
  h.report.ledgerPhaseCounts=h.report.finalCounts
  delete h.report.finalCounts
  await h.scenario('ledger_actual_low_privilege_table_refusals',async()=>{
    for(const role of ['saga_anon','saga_authenticated']) {
      const c=await h.client(role)
      try {
        const id=(await c.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
        h.eq(id,{current_user:role,session_user:role,rolsuper:false,rolbypassrls:false},'actual ledger low privilege identity')
        h.report.actorConnections.push(id)
        for(const table of ['source_observations','source_reviews','source_bindings','fixture_assets','fixture_verifications']) {
          h.eq((await entitlement.result(c.query('SELECT * FROM t02.'+table))).sqlstate,'42501','ledger direct read denied')
          h.eq((await entitlement.result(c.query('INSERT INTO t02.'+table+' DEFAULT VALUES'))).sqlstate,'42501','ledger direct write denied')
        }
      } finally {await h.close(c)}
    }
  })
  h.report.digestExamples=(await h.db.query(`SELECT source_field,source_path,source_type,digest_algorithm,source_digest,source_payload FROM t02.source_observations WHERE source_row_id=$1 ORDER BY id LIMIT 12`,[oldLedger.ids.story])).rows
  h.report.digestScope='Observed PostgreSQL 17.4 canonical representation only; no universal PG14/PG17 digest stability claim.'
}

export async function combined(h,planLegacyStoryMedia) {
  h.report.phase='same_fixture_rls_entitlement_invitation_management_ledger'
  await entitlement.prepare(h)
  await h.db.query("SET saga.entitlement_events='only_synthetic_local'")
  await h.db.query(await readFile(join(root,'experiments/pg17-entitlement-events/candidate.sql'),'utf8'))
  await h.db.query("SET saga.invitation_management='only_synthetic_local'")
  await h.db.query(await readFile(join(root,'experiments/pg17-invitation-management/candidate.sql'),'utf8'))
  const {U,P}=entitlement
  for(const [name,id] of Object.entries(U))await h.db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)',[id,name+'@example.test','2020-01-01'])
  for(const [p,owner] of [[P.one,U.owner],[P.two,U.other]])await h.db.query("INSERT INTO projects(id,name,facilitator_id,owner_id) VALUES($1,'Synthetic composed family',$2,$2)",[p,owner])
  const story=randomUUID(), object=randomUUID(), key=`${U.invitee}/projects/${P.one}/stories/${story}/photo.jpg`
  await h.db.query("INSERT INTO stories(id,project_id,storyteller_id,user_id,title,photo_url) VALUES($1,$2,$3,$3,'Composed story',$4)",[story,P.one,U.invitee,key])
  await h.db.query("INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES($1,'saga',$2,$3)",[object,key,U.invitee])
  const read='SELECT id FROM public.stories WHERE id=$1',readObject='SELECT id FROM storage.objects WHERE id=$1'
  const checkedRead=async(user,expected)=>{
    for(const [sql,id] of [[read,story],[readObject,object]]) {
      const r=await h.actor('authenticated',user,sql,[id])
      h.eq(r.sqlstate,'00000','read must evaluate RLS without unrelated SQL failure')
      h.eq(r.rows.length,expected,'current membership controls story and object rows')
    }
  }
  await h.scenario('combined_trusted_grant_accept_read_revoke_read_and_bind',async()=>{
    await checkedRead(U.invitee,0)
    const sourceKey=randomUUID(),granted=await entitlement.grant(h,entitlement.payload(randomUUID(),sourceKey,'grant','storyteller_seat',1))
    const available=await h.actor('authenticated',U.owner,sources,[P.one,'storyteller'])
    h.eq(available.sqlstate,'00000','management available sources succeeds against same live fixture')
    h.eq(available.rows.map(x=>x.source_id),[granted.source_id],'only event backed source available')
    const sent=await h.actor('authenticated',U.owner,entitlement.send,[P.one,randomUUID(),'invitee@example.test','storyteller',granted.source_id,null])
    h.eq(sent.sqlstate,'00000','invitation send against current composed RLS')
    const accepted=await h.actor('authenticated',U.invitee,entitlement.accept,[sent.rows[0].token])
    h.eq(accepted.sqlstate,'00000','invitation acceptance grants actual membership')
    const management=await h.actor('authenticated',U.owner,manage,[P.one,null])
    h.eq(management.sqlstate,'00000','management reads same accepted history')
    h.eq(management.rows[0].status,'accepted','accepted audit is live')
    await checkedRead(U.invitee,1)
    await checkedRead(U.other,0)
    h.eq((await h.actor('authenticated',U.invitee,'UPDATE public.stories SET id=$2 WHERE id=$1 RETURNING id',[story,randomUUID()])).sqlstate,'42501','final combined fixture keeps story identity immutable')
    h.eq((await h.db.query('SELECT id FROM stories WHERE id=$1',[story])).rows.length,1,'refused identity change retains original story')
    const ledger=createLedger({planLegacyStoryMedia})
    const observation=(await ledger.observeStory(h.db,{storyId:story,actorId:U.invitee}))[0]
    h.eq(observation.locator_status,'mapped','actual projector maps composed source')
    const asset=randomUUID(),verification=randomUUID()
    await h.db.query(`INSERT INTO t02.fixture_assets(id,project_id,story_id,created_by,kind,bucket,object_key,version,object_version,byte_size,sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,1,'synthetic-object-v1',120,$8,'ready')`,[asset,P.one,story,U.invitee,observation.kind,observation.bucket,observation.object_key,'a'.repeat(64)])
    await h.db.query(`INSERT INTO t02.fixture_verifications(id,asset_id,project_id,story_id,kind,bucket,object_key,asset_version,object_version,byte_size,sha256,evidence_kind) SELECT $2,id,project_id,story_id,kind,bucket,object_key,version,object_version,byte_size,sha256,'synthetic_fixture_only' FROM t02.fixture_assets WHERE id=$1`,[asset,verification])
    const ongoing=await h.actorClient('authenticated',U.invitee)
    try {
      await ongoing.query('BEGIN ISOLATION LEVEL READ COMMITTED')
      h.eq((await ongoing.query(read,[story])).rows.length,1,'same live session reads before source revocation')
      h.eq((await ongoing.query(readObject,[object])).rows.length,1,'same live session reads object before source revocation')
      await entitlement.grant(h,entitlement.payload(randomUUID(),sourceKey,'revoke','storyteller_seat',1))
      h.eq((await h.db.query('SELECT status FROM project_roles WHERE project_id=$1 AND user_id=$2',[P.one,U.invitee])).rows[0].status,'inactive','trusted revoke deactivates membership')
      h.eq((await ongoing.query(read,[story])).rows.length,0,'next statement in same READ COMMITTED transaction hides story')
      h.eq((await ongoing.query(readObject,[object])).rows.length,0,'next statement in same READ COMMITTED transaction hides object')
    } finally {await ongoing.query('ROLLBACK');await h.close(ongoing)}
    await checkedRead(U.invitee,0)
    let code
    try {await ledger.bind(h.db,{observationId:observation.id,verificationId:verification,actorId:U.invitee})}catch(e){code=e.code}
    h.eq(code,'access_denied','unchanged ledger bind checks actual revoked membership')
    h.eq((await h.db.query('SELECT count(*)::int AS n FROM t02.source_bindings WHERE observation_id=$1',[observation.id])).rows[0].n,0,'revoked bind leaves no partial history')
    h.report.combined={sameDatabase:true,project:P.one,story,object,source:granted.source_id,sourceRevoked:true,membership:'inactive',nextStatementReads:0,ledgerBind:'access_denied'}
  })
  await h.scenario('combined_retains_all_seven_RPC_and_wallet_member_bypass_denials',async()=>{
    h.report.retainedRpcDenials=[]
    for(const [identity,sql,args] of entitlement.unsafe) {
      h.ok((await h.db.query('SELECT to_regprocedure($1) AS identity',[identity])).rows[0].identity,'reviewed RPC exists')
      const r=await h.actor('authenticated',U.invitee,sql,args)
      h.eq(r.sqlstate,'42501','retained RPC execute refusal '+identity)
      h.report.retainedRpcDenials.push({identity,sqlstate:r.sqlstate})
    }
    for(const [sql,args] of [
      ['UPDATE public.user_resource_wallets SET storyteller_seats=99 WHERE user_id=$1',[U.owner]],
      ["INSERT INTO public.project_roles(user_id,project_id,role,status) VALUES($1,$2,'storyteller','active')",[U.invitee,P.two]],
      ["UPDATE public.project_roles SET status='active' WHERE user_id=$1",[U.invitee]],
      ["INSERT INTO public.project_members(project_id,user_id,role) VALUES($1,$2,'storyteller')",[P.one,U.invitee]]
    ])h.eq((await h.actor('authenticated',U.invitee,sql,args)).sqlstate,'42501','wallet or membership table bypass remains denied')
  })
}
