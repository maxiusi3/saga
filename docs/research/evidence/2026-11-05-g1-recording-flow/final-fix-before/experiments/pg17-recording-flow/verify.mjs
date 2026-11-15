import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, save, fresh, compileFlow, USER, OTHER, PROJECT, METADATA } from './fixture.mjs'
const red = process.argv.includes('--without-migration')
const beforeFix = process.argv.includes('--before-fix-1')
const directory = join(root, 'docs/research/evidence/2026-11-05-g1-recording-flow', `native-${red ? 'red-' : ''}${Date.now()}-${randomUUID()}`)
const report = { status:'running', assertions:0, actorConnections:[], scenarios:[], sources:{}, command:`node experiments/pg17-recording-flow/verify.mjs ${process.argv.slice(2).join(' ')}`.trim(), g1MilestoneSatisfied:false }
const h = new Harness(report)
await mkdir(directory, { recursive:true })
async function source(path) {
  const actual=beforeFix && path==='supabase/migrations/20261106000001_recording_story_save.sql'
    ? `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/fix-1-before/${path}` : path
  const bytes=await readFile(join(root,actual));report.sources[actual]=digest(bytes);return bytes.toString()
}
async function waiting(client) {
  for(let n=0;n<200;n++) {
    const row=(await h.db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[client.processID])).rows[0]
    if(row.wait_event_type==='Lock')return
    await delay(5)
  }
  h.ok(false,'independent backend must reach actual lock wait')
}
async function denied(client, args, code) {
  let result = '00000'
  try { await save(client, ...args) } catch (error) { result = error.code }
  h.eq(result,code,'save rejected with expected SQLSTATE')
}
try {
  for(const path of ['experiments/pg17-recording-flow/fixture.mjs','experiments/pg17-recording-flow/verify.mjs','experiments/pg17-recording-flow/README.md'])await source(path)
  await h.start(); await setup(h,source,!red)
  const service = await h.actorClient('service_role',USER)
  await h.scenario('atomic reservation exists and replays one story with immutable metadata', async () => {
    const id = randomUUID(), first = await save(service,id,'reserve',METADATA)
    const next = await save(service,id,'reserve',METADATA)
    h.eq(first,next,'replay is identical'); h.eq(first.lookup.canClearLocalDrafts,false,'reservation never authorizes cleanup')
    h.eq((await h.db.query('SELECT count(*)::int n FROM stories')).rows[0].n,1,'one story only')
    await denied(service,[id,'reserve',{...METADATA,title:'changed'}],'23505')
    await denied(service,[id,'lookup',null,null,OTHER],'42501')
    const story = (await h.db.query('SELECT * FROM stories WHERE id=$1',[first.lookup.intent.storyId])).rows[0]
    h.eq([story.status,story.user_id,story.storyteller_id,story.audio_url,story.audio_duration],['processing',USER,USER,null,null],'actual bootstrap row initialized correctly')
  })
  const { prepareRecordingSessionSeal } = await compileModules(h,source)
  const flow = await compileFlow(h,source)
  const applicationAdmin = { rpc(name,args) {
    h.eq(name,'recording_story_save','actual save service selects exact RPC')
    const query = { abortSignal() { return query }, retry(value) { h.eq(value,false,'save RPC disables retries'); return query },
      then(resolve,reject) { return save(service,args.p_session_id,args.p_action,args.p_metadata,args.p_manifest_sha256,args.p_actor_id,args.p_project_id)
        .then(data=>({data,error:null}),error=>({data:null,error:{code:error.code}})).then(resolve,reject) } }
    return query
  } }

  await h.scenario('service-only function and ledger deny unprivileged callers and direct ledger writes', async () => {
    const acl = (await h.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='recording_story_intents'::regclass")).rows[0]
    h.eq(acl,{relrowsecurity:true,relforcerowsecurity:true},'forced ledger RLS')
    for (const role of ['anon','authenticated','metadata_reader']) {
      const c = await h.actorClient(role,USER,'service_role')
      await denied(c,[randomUUID(),'reserve',METADATA],'42501')
      let code; try { await c.query('SELECT * FROM recording_story_intents') } catch (e) { code=e.code }
      h.eq(code,'42501','ledger is not client-readable'); await h.close(c)
    }
  })
  await h.scenario('lookup recovers lost seal hash; pending confirmation leaves story processing', async () => {
    const f = await fresh(h,service,prepareRecordingSessionSeal,false)
    const value = await save(service,f.sessionId)
    h.eq(value.lookup.intent.manifestSha256,f.manifestSha256,'lost seal hash recovered')
    await denied(service,[f.sessionId,'confirm',null,f.manifestSha256],'23505')
    h.eq((await h.db.query('SELECT status FROM stories WHERE id=$1',[f.storyId])).rows[0].status,'processing','pending did not become ready')
  })
  await h.scenario('confirmed publication replays without rewriting user edits', async () => {
    const f = await fresh(h,service,prepareRecordingSessionSeal)
    const value = await save(service,f.sessionId,'confirm',null,f.manifestSha256)
    h.eq(value.lookup.intent.confirmed,true,'confirmed ledger')
    h.eq(value.snapshot.jobs[0].state,'succeeded','raw terminal snapshot returned')
    const receipt = await flow.confirmRecordingStorySave({actorId:USER,projectId:PROJECT,sessionId:f.sessionId,manifestSha256:f.manifestSha256},{admin:applicationAdmin})
    h.eq(receipt.canClearLocalDrafts,true,'actual strict validator accepts native terminal snapshot')
    h.eq(receipt.storyId,f.storyId,'public receipt pins reserved story')
    const story = (await h.db.query('SELECT * FROM stories WHERE id=$1',[f.storyId])).rows[0]
    h.eq([story.status,story.audio_url,story.audio_duration],['ready',`/api/media/assets/${f.assetId}/play`,2],'verified audio duration stored in seconds rounded up')
    await h.db.query("UPDATE stories SET title='User edit',content='Keep me' WHERE id=$1",[f.storyId])
    await save(service,f.sessionId,'confirm',null,f.manifestSha256)
    h.eq((await h.db.query('SELECT title,content FROM stories WHERE id=$1',[f.storyId])).rows[0],{title:'User edit',content:'Keep me'},'confirmation replay preserved edited content')
    await denied(service,[f.sessionId,'confirm',null,'a'.repeat(64)],'23505')
  })
  await h.scenario('corrupt published chain never makes a story ready', async () => {
    for (const mutate of [
      f => ["UPDATE processing_attempts SET result_state='running' WHERE job_id=$1",[f.jobId]],
      f => ["UPDATE recording_output_candidates SET sha256=repeat('c',64) WHERE id=$1",[f.candidateId]],
      f => ['UPDATE media_assets SET duration_ms=duration_ms+1 WHERE id=$1',[f.assetId]],
      f => ["UPDATE processing_jobs SET result_ref=NULL WHERE id=$1",[f.jobId]],
      f => ['UPDATE recording_sessions SET confirmed_asset_id=NULL WHERE id=$1',[f.sessionId]],
      f => ["UPDATE recording_chunks SET sha256=repeat('c',64) WHERE session_id=$1",[f.sessionId]],
    ]) {
      const f = await fresh(h,service,prepareRecordingSessionSeal), [sql,args] = mutate(f)
      await h.db.query(sql,args); await denied(service,[f.sessionId,'confirm',null,f.manifestSha256],'23505')
      h.eq((await h.db.query('SELECT status FROM stories WHERE id=$1',[f.storyId])).rows[0].status,'processing','corrupt tuple not saved')
    }
  })
  await h.scenario('application rejection of corrupt immutable identities leaves story and intent untouched', async () => {
    async function rehash(f, manifest) {
      f.manifest=manifest
      f.manifestSha256=(await h.db.query("UPDATE recording_sessions SET seal_input=$2::jsonb,manifest_sha256=encode(sha256(convert_to(($2::jsonb)::text,'UTF8')),'hex') WHERE id=$1 RETURNING manifest_sha256",[f.sessionId,JSON.stringify(manifest)])).rows[0].manifest_sha256
      await h.db.query('UPDATE recording_output_candidates SET manifest_sha256=$2 WHERE id=$1',[f.candidateId,f.manifestSha256])
    }
    const mutations = [
      ['job key', f=>h.db.query("UPDATE processing_jobs SET idempotency_key='tampered-job-key' WHERE id=$1",[f.jobId])],
      ['asset key', f=>h.db.query("UPDATE media_assets SET idempotency_key='tampered-asset-key' WHERE id=$1",[f.assetId])],
      ['equal but noncanonical keys', async f=> {
        await h.db.query("UPDATE processing_jobs SET idempotency_key='shared-tampered-key' WHERE id=$1",[f.jobId])
        await h.db.query("UPDATE media_assets SET idempotency_key='shared-tampered-key' WHERE id=$1",[f.assetId])
      }],
      ['coherently rebound asset UUID', async f=> {
        const assetId=randomUUID(), key=prepareRecordingSessionSeal({jobId:f.jobId,assetId,projectId:PROJECT,sessionId:f.sessionId,actorId:USER,
          actorRole:'storyteller',actorActive:true,storyId:f.storyId,mimeType:f.manifest.mimeType,chunks:f.manifest.chunks}).task.idempotencyKey
        const objectKey=`jobs/${f.jobId}/attempts/1/${f.candidateId}`
        await h.db.query("UPDATE media_assets SET object_key=object_key||'/old' WHERE id=$1",[f.assetId])
        await h.db.query("INSERT INTO media_assets SELECT (jsonb_populate_record(NULL::media_assets,to_jsonb(a)||jsonb_build_object('id',$2::text,'idempotency_key',$3::text,'object_key',$4::text))).* FROM media_assets a WHERE id=$1",[f.assetId,assetId,key,objectKey])
        await h.db.query('UPDATE processing_jobs SET asset_id=$2::uuid,result_ref=$2::text,idempotency_key=$3 WHERE id=$1',[f.jobId,assetId,key])
        await h.db.query('UPDATE recording_output_candidates SET asset_id=$2 WHERE id=$1',[f.candidateId,assetId])
        await h.db.query('UPDATE recording_sessions SET confirmed_asset_id=$2 WHERE id=$1',[f.sessionId,assetId])
        f.assetId=assetId;await rehash(f,{...f.manifest,assetId})
      }],
      ['manifest extra field', f=>rehash(f,{...f.manifest,extra:true})],
      ['coherently changed physical chunk key', async f=> {
        const objectKey=`${USER}/projects/${PROJECT}/tampered-source`
        await h.db.query('UPDATE recording_chunks SET object_key=$2 WHERE session_id=$1',[f.sessionId,objectKey])
        await rehash(f,{...f.manifest,chunks:f.manifest.chunks.map(c=>({...c,storageObjectKey:objectKey}))})
      }],
    ]
    report.immutableRejections=[]
    for(const [name,mutate] of mutations) {
      const f=await fresh(h,service,prepareRecordingSessionSeal)
      await mutate(f)
      const saved=async()=> (await h.db.query(`SELECT jsonb_build_object('story',(SELECT to_jsonb(s) FROM stories s WHERE id=$1),
        'intent',(SELECT to_jsonb(i) FROM recording_story_intents i WHERE session_id=$2)) AS value`,[f.storyId,f.sessionId])).rows[0].value
      const before=await saved()
      let receipt,apiStatus
      try { receipt=await flow.confirmRecordingStorySave({actorId:USER,projectId:PROJECT,sessionId:f.sessionId,manifestSha256:f.manifestSha256},{admin:applicationAdmin}) }
      catch(error) { apiStatus=error.status }
      report.immutableRejections.push({name,apiStatus,receipt:receipt??null,before,after:await saved()})
    }
    for(const observed of report.immutableRejections) {
      h.eq(observed.receipt,null,`${observed.name}: no cleanup receipt`)
      h.eq(observed.after,observed.before,`${observed.name}: SQL rejects before mutating story or intent`)
      h.eq([observed.after.story.status,observed.after.story.audio_url,observed.after.intent.confirmed_at],['processing',null,null],`${observed.name}: story remains unconfirmed`)
      h.eq(observed.apiStatus,409,`${observed.name}: SQL conflict reaches actual application`)
    }
  })
  await h.scenario('revoke, ownership change and every deletion subject reject replay and confirmation', async () => {
    const f = await fresh(h,service,prepareRecordingSessionSeal)
    for (const subject of [PROJECT,f.sessionId,f.storyId,f.assetId]) {
      await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[PROJECT,subject,USER])
      await denied(service,[f.sessionId],'42501'); await denied(service,[f.sessionId,'confirm',null,f.manifestSha256],'42501')
      await h.db.query('DELETE FROM deletion_requests WHERE subject_id=$1',[subject])
    }
    await h.db.query("UPDATE project_roles SET status='inactive' WHERE user_id=$1",[USER]); await denied(service,[f.sessionId],'42501')
    await h.db.query("UPDATE project_roles SET status='active' WHERE user_id=$1",[USER])
    await h.db.query('UPDATE stories SET storyteller_id=$1 WHERE id=$2',[OTHER,f.storyId]); await denied(service,[f.sessionId],'42501')
  })
  await h.scenario('concurrent reserve converges, and a tombstone committing during the wait blocks confirmation', async () => {
    const first = await h.actorClient('service_role',USER), second = await h.actorClient('service_role',USER), id = randomUUID()
    await first.query('BEGIN'); const reserved = await save(first,id,'reserve',METADATA)
    const pending = save(second,id,'reserve',METADATA)
    await waiting(second); await first.query('COMMIT'); h.eq((await pending).lookup.intent.storyId,reserved.lookup.intent.storyId,'concurrent callers share one story')
    const f = await fresh(h,service,prepareRecordingSessionSeal)
    await h.db.query('BEGIN'); await h.db.query('INSERT INTO deletion_requests(project_id,subject_id,requested_by) VALUES($1,$2,$3)',[PROJECT,f.sessionId,USER])
    const blocked = denied(second,[f.sessionId,'confirm',null,f.manifestSha256],'42501')
    await waiting(second); await h.db.query('COMMIT'); await blocked
    await h.db.query('DELETE FROM deletion_requests WHERE subject_id=$1',[f.sessionId])
    for(const [sql,args,restore,restoreArgs] of [
      ["UPDATE project_roles SET status='inactive' WHERE user_id=$1",[USER],"UPDATE project_roles SET status='active' WHERE user_id=$1",[USER]],
      ['UPDATE stories SET storyteller_id=$1 WHERE id=$2',[OTHER,f.storyId],'UPDATE stories SET storyteller_id=$1 WHERE id=$2',[USER,f.storyId]],
    ]) {
      await first.query('BEGIN');await first.query(sql,args)
      const deniedAfterWait=denied(second,[f.sessionId,'confirm',null,f.manifestSha256],'42501')
      await waiting(second);await first.query('COMMIT');await deniedAfterWait
      await first.query(restore,restoreArgs)
    }
    await h.close(first); await h.close(second)
  })
  report.status='passed'
} catch(error) { report.status='failed';report.error={code:error.code??'ERROR',label:error.label??error.message,position:error.position,where:error.where,internalQuery:error.internalQuery};process.exitCode=1 }
finally { await h.cleanup(); if(report.status!=='passed')process.exitCode=1; await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,error:report.error,cleanup:report.cleanup},null,2)) }
