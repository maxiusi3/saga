import {randomUUID} from 'node:crypto'
import {fresh,capture,execute,USER,PROJECT} from './fixture.mjs'
async function code(task){try{await task();return '00000'}catch(e){return e.code}}
export async function guardScenarios(h,service,prepare) {
  await h.scenario('capture immediately fences reparenting before first execution and rejects unsafe discovery',async()=>{
    const f=await fresh(h,service,prepare),other=await fresh(h,service,prepare),id=randomUUID(),run=randomUUID()
    await capture(service,{subjectId:f.storyId,requestId:id})
    h.eq(await code(()=>service.query('UPDATE media_assets SET story_id=$2 WHERE id=$1',[f.assetId,other.storyId])),'23505','captured asset cannot move to another story')
    const sessionMutation=await code(()=>service.query('UPDATE recording_sessions SET user_id=$2 WHERE id=$1',[f.sessionId,'22222222-2222-4222-8222-222222222222']))
    h.report.sessionMutation=sessionMutation
    h.eq(sessionMutation,'42501','service cannot bypass sealed-session mutation ACL')
    h.eq(await code(()=>h.db.query('UPDATE public.recording_sessions SET user_id=$2 WHERE id=$1',[f.sessionId,'22222222-2222-4222-8222-222222222222'])),'23505','captured session trigger blocks privileged namespace mutation')
    await execute(service,id,run,'begin')
    h.eq(await code(()=>execute(service,id,randomUUID(),'observe',{bucket:'saga',objectKey:'not/owned',state:'present'})),'23505','different worker cannot observe')
    const prefix=`${USER}/projects/${PROJECT}/sessions/${f.sessionId}`
    for(const objectKey of [prefix+'/../other',prefix+'/00',prefix+'/sub/file',`${USER}/projects/${PROJECT}/sessions/${other.sessionId}/0`]) {
      h.eq(await code(()=>execute(service,id,run,'discover',{bucket:'audio-recordings',objectKey})),'23505','discovery cannot expand scope')
    }
    h.eq(await code(()=>service.query("INSERT INTO storage.objects(bucket_id,name) VALUES('audio-recordings',$1)",[prefix+'/55'])),'23505','permanent prefix guard rejects new metadata even without a captured chunk')
    await execute(service,id,run,'finish',{interrupted:true})
    await execute(service,id,randomUUID(),'begin')
    h.eq(await code(()=>execute(service,id,run,'finish',{interrupted:true})),'23505','stale run cannot commit')
  })
  await h.scenario('roles cannot forge physical receipts or read private execution evidence',async()=>{
    for(const role of ['anon','authenticated']) {
      h.eq((await h.actor(role,USER,'SELECT * FROM public.media_deletion_objects')).sqlstate,'42501','private object coordinates denied')
      h.eq((await h.actor(role,USER,`SELECT public.media_deletion_execute('${randomUUID()}','${randomUUID()}','begin','{}')`)).sqlstate,'42501','client execution denied')
    }
    for(const table of ['media_deletion_executions','media_deletion_fences','media_deletion_objects','media_deletion_events']) {
      h.eq(await code(()=>service.query(`DELETE FROM public.${table}`)),'42501','service direct mutation denied '+table)
    }
  })
  await h.scenario('concurrent begin has exactly one executable owner',async()=>{
    const f=await fresh(h,service,prepare),id=randomUUID(),a=randomUUID(),b=randomUUID()
    await capture(service,{subjectId:f.storyId,requestId:id})
    const second=await h.actorClient('service_role',USER)
    try {
      const results=await Promise.allSettled([execute(service,id,a,'begin'),execute(second,id,b,'begin')])
      h.eq(results.filter(r=>r.status==='fulfilled').length,1,'one run owns delete authority')
      h.eq(results.filter(r=>r.status==='rejected').map(r=>r.reason.code),['23505'],'other run rejected')
    }finally{await h.close(second)}
  })
  await h.scenario('tampered capture never authorizes deletion and old metadata remains unchanged',async()=>{
    const f=await fresh(h,service,prepare),id=randomUUID();await capture(service,{subjectId:f.storyId,requestId:id})
    const row=(await h.db.query('SELECT id FROM deletion_targets WHERE deletion_request_id=$1 ORDER BY target_id LIMIT 1',[id])).rows[0]
    await h.db.query("UPDATE deletion_targets SET error_code='synthetic-tamper' WHERE id=$1",[row.id])
    h.eq(await code(()=>execute(service,id,randomUUID(),'begin')),'23505','full capture digest checked')
    await h.db.query('UPDATE deletion_targets SET error_code=NULL WHERE id=$1',[row.id])
  })
}

// Seed a historical raw reference after the other scenarios. Trigger suspension
// is fixture setup only; actual capture/planning run with all guards enabled.
export async function legacyOnlyScenario(h,service) {
  const story=randomUUID(),id=randomUUID(),run=randomUUID()
  await h.db.query('ALTER TABLE public.stories DISABLE TRIGGER media_deletion_reference_guard')
  try { await h.db.query("INSERT INTO public.stories(id,project_id,audio_url) VALUES($1,$2,'https://legacy.invalid/audio-recordings/uncaptured')",[story,PROJECT]) }
  finally { await h.db.query('ALTER TABLE public.stories ENABLE TRIGGER media_deletion_reference_guard') }
  await capture(service,{subjectId:story,requestId:id})
  const result=await execute(service,id,run,'begin')
  h.eq(result.state,'blocked_reference','selected story with uncaptured legacy media is never completed with an empty plan')
}
