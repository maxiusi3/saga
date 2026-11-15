import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {compileModule} from '../g1-local/compile-module.mjs'
import {databaseHttp,SERVICE_KEY} from '../recording-flow-browser/database-http.mjs'
import {fresh,capture,execute,USER,PROJECT} from './fixture.mjs'
import {storageHttp} from './storage-http.mjs'

export async function workerScenarios(h,service,prepare,source,directory) {
  const db=await databaseHttp(h),storage=await storageHttp(join(h.scratch,'physical'))
  const worker=await compileModule('lib/server/media-deletion-worker.ts',join(h.scratch,'deletion-worker'),source)
  const options={admin:db.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,fetch:storage.fetch}
  const objects=async f=>(await h.db.query('SELECT bucket,object_key AS "objectKey" FROM media_assets WHERE id=$1 UNION SELECT bucket,object_key FROM recording_chunks WHERE session_id=$2',[f.assetId,f.sessionId])).rows
  const seed=async()=>{const f=await fresh(h,service,prepare);f.objects=await objects(f);for(const o of f.objects)await storage.put(o);return f}
  try {
    const kept=await seed()
    await h.scenario('existing outside child blocks deletion but may remove its reference',async()=>{
      const f=await seed(),id=randomUUID(),child=randomUUID()
      await service.query(`INSERT INTO media_assets(id,project_id,created_by,bucket,object_key,kind,mime_type,state,parent_asset_id)
        VALUES($1,$2,$3,'saga',$4,'derived_audio','audio/webm','ready',$5)`,[child,PROJECT,USER,`${USER}/projects/${PROJECT}/child-${child}`,f.assetId])
      await capture(service,{subjectId:f.storyId,requestId:id})
      h.eq((await worker.runMediaDeletion(id,options)).state,'blocked_reference','outside child is preserved')
      await service.query('UPDATE media_assets SET parent_asset_id=NULL WHERE id=$1',[child])
      h.eq((await worker.runMediaDeletion(id,options)).state,'observed_absent','reference removal unblocks target')
      await service.query('DELETE FROM media_assets WHERE id=$1',[child])
    })
    await h.scenario('actual SQL and HTTP worker deletes disk bytes and preserves unrelated files',async()=>{
      const f=await seed(),id=randomUUID()
      await capture(service,{subjectId:f.storyId,requestId:id})
      const result=await worker.runMediaDeletion(id,options)
      h.eq(result.state,'observed_absent','complete visible namespace cleanup')
      for(const o of f.objects)h.eq(await storage.rawExists(o),false,'actual physical file deleted')
      for(const o of kept.objects)h.eq(await storage.rawExists(o),true,'unrelated file retained')
      const late={bucket:'audio-recordings',objectKey:`${USER}/projects/${PROJECT}/sessions/${f.sessionId}/44`}
      await storage.put(late)
      const again=await worker.runMediaDeletion(id,options)
      h.eq(again.state,'observed_absent','next run discovers API-visible late chunk')
      h.eq(await storage.rawExists(late),false,'late disk bytes removed')
      h.eq((await h.db.query("SELECT count(*)::int AS n FROM media_deletion_events WHERE request_id=$1 AND event='deleted'",[id])).rows[0].n,3,'all physical acknowledgments persisted')
      h.report.workerSuccess={requestId:id,result,again}
    })
    await h.scenario('metadata loss does not launder unknown backend cleanup into physical success',async()=>{
      const f=await seed(),id=randomUUID();await capture(service,{subjectId:f.storyId,requestId:id})
      storage.failNextDelete()
      const first=await worker.runMediaDeletion(id,options)
      h.eq(first.state,'reconcile','backend failure awaits reconciliation')
      h.eq(first.unresolvedPhysicalCount,1,'unknown physical outcome durable')
      const orphan=(await h.db.query('SELECT bucket,object_key AS "objectKey" FROM media_deletion_objects WHERE request_id=$1 AND physical_uncertain',[id])).rows[0]
      h.eq(await storage.rawExists(orphan),true,'backend bytes deliberately survived metadata removal')
      h.eq(storage.metadata.has(orphan.bucket+'/'+orphan.objectKey),false,'Storage API metadata already gone')
      const second=await worker.runMediaDeletion(id,options)
      h.eq(second.state,'reconcile','API 404 does not clear backend uncertainty')
      h.eq(second.unresolvedPhysicalCount,1,'unknown outcome stays sticky after restart')
      h.eq(await storage.rawExists(orphan),true,'test does not pretend invisible orphan was deleted')
      h.report.backendUnknown={requestId:id,first,second,orphanBytesRemain:true}
    })
    await h.scenario('competing metadata delete cannot launder an orphan through not_found',async()=>{
      const f=await seed(),id=randomUUID();await capture(service,{subjectId:f.storyId,requestId:id})
      let raced=false
      const racingFetch=async(input,init)=>{
        if(init.method==='DELETE'&&!raced){raced=true;storage.failNextDelete();const failed=await storage.fetch(input,init);await failed.arrayBuffer()}
        return storage.fetch(input,init)
      }
      const result=await worker.runMediaDeletion(id,{...options,fetch:racingFetch})
      h.eq(result.state,'reconcile','competing cleanup failure is not a successful absence')
      h.eq(result.unresolvedPhysicalCount,1,'post-presence not_found remains uncertain')
      const orphan=(await h.db.query('SELECT bucket,object_key AS "objectKey" FROM media_deletion_objects WHERE request_id=$1 AND physical_uncertain',[id])).rows[0]
      h.eq(await storage.rawExists(orphan),true,'race fixture retains actual orphan bytes')
    })
    await h.scenario('crash after dispatch is reconciled before another delete',async()=>{
      const f=await seed(),id=randomUUID(),run=randomUUID();await capture(service,{subjectId:f.storyId,requestId:id})
      const plan=await execute(service,id,run,'begin'),o=plan.objects[0]
      await execute(service,id,run,'observe',{...o,state:'present'})
      await execute(service,id,run,'dispatch',o)
      await execute(service,id,run,'finish',{interrupted:true})
      const outcome=await worker.runMediaDeletion(id,options)
      h.eq(outcome.state,'reconcile','unacknowledged old dispatch remains a physical unknown')
      h.eq(outcome.unresolvedPhysicalCount,1,'crash outcome is durable despite later successful cleanup')
      h.eq(await storage.rawExists(o),false,'new observed-present operation cleaned the actual object')
    })
    return {db,storage,worker,options,kept,close:async()=>{await storage.close();await db.close()}}
  }catch(e){await storage.close();await db.close();throw e}
}
