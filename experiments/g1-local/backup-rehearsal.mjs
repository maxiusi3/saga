import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { root, digest } from '../pg17-routines/runtime.mjs'
import { databaseHttp, SERVICE_KEY } from '../recording-flow-browser/database-http.mjs'
import { compileServer } from '../recording-flow-browser/compile-server.mjs'
import { compileModule } from './compile-module.mjs'
import { prepareG3Backup, restoreG3Backup, verifyG3Replay } from './g3-backup.mjs'
import { prepareDurableRecordsBackup, captureDurableProjectTombstone, verifyDurableRecordsRestore, verifyDurableRecordsReplay } from './durable-records-backup.mjs'

const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test')
const USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',PROJECT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/** Offline maintenance rehearsal against a full migrated local database.
 * Storage is a local byte store. This does not implement/qualify the online GC
 * worker, late-writer reconciliation or hosted Supabase recovery.
 */
export async function rehearseBackup({h,evidence,source}){
  const result={status:'running',checks:[],boundary:'Real PG17 custom dump/restored database, real captured Chrome audio bytes, local object backup/restore and post-freeze durable tombstones. Quiesced local writers. Offline maintenance replay, not the production physical deletion executor or hosted Storage.'}
  h.report.backup=result
  const previous=process.env.MEDIA_ASSETS_ENABLED
  const previousSpool=process.env.ARCHIVE_SPOOL_DIR
  let db,compiled,restoredDb,restoredCompiled,server,browser
  try{
    process.env.MEDIA_ASSETS_ENABLED='true'
    const inputDir=join(root,'docs/research/evidence/2026-11-07-g1-chrome/integrated-browser-1794059710258-2f76707e-5601-44f0-9829-05ded2ec89fb')
    const input=JSON.parse(await readFile(join(inputDir,'results.json'))),object=input.savedObjects.find(o=>o.key.startsWith('recording-candidates/'))
    h.eq(input.status,'passed','source Chrome accepted');const audio=await readFile(join(inputDir,object.filename));h.eq(digest(audio),object.sha256,'source Chrome original hash')
    result.input={path:inputDir,sha256:object.sha256,bytes:audio.length}
    await h.db.query(`INSERT INTO auth.users(id,email) VALUES('${OTHER}','owner@example.invalid');
      INSERT INTO projects(id,name,facilitator_id) VALUES('${PROJECT}','Backup family','${OTHER}');
      INSERT INTO project_roles(project_id,user_id,role,status) VALUES('${PROJECT}','${USER}','storyteller','active'),('${PROJECT}','${OTHER}','facilitator','active');`)
    const publicationFunctions=['publication_delivery','complete_publication_cleanup','invalidate_publication_job']
    db=await databaseHttp(h,{allowedFunctions:publicationFunctions});compiled=await compileServer(h.scratch,source,db.admin)
    const recordings=[]
    for(const title of ['Delete after freeze','Keep after restore']){
      const sessionId=randomUUID()
      const call=async(name,body)=>{
        const response=await compiled.routes[name].POST(new compiled.NextRequest('http://fixture.invalid/'+name,{method:'POST',headers:{authorization:'Bearer synthetic-flow-session','content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({sessionId})})
        const value=await response.json();result.recordingResponses??=[];result.recordingResponses.push({name,action:body.action,status:response.status,value});h.ok(response.ok,'actual full-schema '+name+' '+(body.action??'')+' succeeds');return value
      }
      const metadata={title,content:'Synthetic backup test',transcript:'Synthetic caption',happenedAt:'2000-01-01T00:00:00.000Z',recordingMode:'chat',isPublic:false}
      const reserve=await call('save',{action:'reserve',projectId:PROJECT,metadata})
      const key=`projects/${PROJECT}/sessions/${sessionId}/0`
      db.objects.set(`audio-recordings/${USER}/${key}`,{bytes:audio,type:object.mimeType})
      const seal=await call('seal',{projectId:PROJECT,storyId:reserve.intent.storyId,mimeType:object.mimeType,chunks:[{index:0,chunkId:sessionId+'-0',bucket:'audio-recordings',objectKey:key,byteSize:audio.length,sha256:digest(audio)}]})
      const work=await compiled.host.runRecordingWorkerOnce({admin:db.admin,storageUrl:'https://storage.invalid',serviceRoleKey:SERVICE_KEY,fetch:db.transport,workerId:'backup-worker',ffmpeg:{executable:'/usr/local/bin/ffmpeg',timeoutMs:60000,maxDurationMs:1810000}})
      h.eq(work.outcome,'succeeded','full migration worker publishes captured original')
      const saved=await call('save',{action:'confirm',projectId:PROJECT,manifestSha256:seal.manifestSha256})
      recordings.push({sessionId,storyId:reserve.intent.storyId,assetId:seal.assetId??saved.assetId,saved})
    }
    // Include an unrelated legacy object alongside both chunks and candidates.
    db.objects.set(`saga/${USER}/projects/${PROJECT}/legacy/sample.txt`,{bytes:Buffer.from('Synthetic retained legacy object'),type:'text/plain'})
    const backupDir=join(evidence,'backup-objects'),restoreDir=join(evidence,'restored-objects')
    await mkdir(backupDir);await mkdir(restoreDir)
    const objects=[]
    for(const [address,entry]of db.objects){
      const slash=address.indexOf('/'),bucket=address.slice(0,slash),key=address.slice(slash+1),id=randomUUID()
      await h.db.query('INSERT INTO storage.buckets(id,name) VALUES($1,$1) ON CONFLICT DO NOTHING',[bucket])
      await h.db.query('INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES($1,$2,$3,$4)',[id,bucket,key,{size:entry.bytes.length,sha256:digest(entry.bytes)}])
      await writeFile(join(backupDir,id),entry.bytes,{flag:'wx'})
      objects.push({id,bucket,key,byteSize:entry.bytes.length,sha256:digest(entry.bytes)})
    }
    await source('experiments/g1-local/durable-records-backup.mjs')
    const durable=await prepareDurableRecordsBackup({h,owner:OTHER,stories:recordings.map(r=>r.storyId),evidence})
    await source('experiments/g1-local/g3-backup.mjs')
    const g3=await prepareG3Backup({h,db,source,evidence,owner:OTHER,project:PROJECT})
    const pilotId=randomUUID()
    await h.db.query('SELECT record_pilot_observation($1)',[JSON.stringify({action:'record',requestId:randomUUID(),expectedRevision:0,householdId:pilotId,householdKey:randomUUID(),projectId:PROJECT,cohortKey:'g4-backup',cohortType:'longitudinal_pilot',observationKind:'synthetic',recordedBy:'backup-fixture',reason:'initial_observation',values:{pricingTier:'free',enrolledAt:'2026-01-01T00:00:00Z'},evidence:{enrollment:{source:'synthetic_fixture',reference:'fixture:backup'}}})])
    const frozen=(await h.db.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString()
    const preFreezeDeletionCount=(await h.db.query('SELECT count(*)::int AS n FROM deletion_requests')).rows[0].n
    const dumpPath=join(evidence,'database.dump')
    h.command('pg_dump',['-h',h.config.host,'-U','rehearsal_admin','-Fc','-f',dumpPath,'saga_pg17_rehearsal'],60000)
    const dump=await readFile(dumpPath),backup=await compileModule('lib/server/scheme-b-backup.ts',join(h.scratch,'backup-lib'),source)
    const manifest={freezeTimestamp:frozen,dumpSha256:digest(dump),dumpSizeBytes:dump.length,objects}
    backup.verifyPgDumpCustomArchive(dump);backup.verifyStorageManifest(manifest,manifest.dumpSha256)
    const toc=h.command('pg_restore',['--list',dumpPath]);await writeFile(join(evidence,'dump-toc.txt'),toc)
    await writeFile(join(evidence,'storage-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
    const selected=recordings[0],retained=recordings[1]
    // Deletion occurs AFTER the dump, in the original live database.
    const captured=(await h.db.query('SELECT request_story_deletion($1,$2,$3,$4) AS value',[OTHER,PROJECT,selected.storyId,randomUUID()])).rows[0].value
    const request=(await h.db.query('SELECT to_jsonb(r) AS row FROM deletion_requests r WHERE id=$1',[captured.id])).rows[0].row
    const targets=(await h.db.query('SELECT to_jsonb(t) AS row FROM deletion_targets t WHERE deletion_request_id=$1 ORDER BY target_id',[captured.id])).rows.map(r=>r.row)
    const tombstones=targets.filter(t=>t.kind==='storage_object').map(t=>({targetType:'storage_object',targetId:t.target_id,bucket:t.bucket,key:t.object_key,tombstonedAt:new Date(request.tombstone_at).toISOString(),reason:'actual_post_freeze_deletion_capture'}))
    h.ok(Date.parse(tombstones[0].tombstonedAt)>=Date.parse(frozen),'post-freeze tombstone order')
    await writeFile(join(evidence,'post-freeze-tombstones.json'),JSON.stringify({request,targets,tombstones},null,2)+'\n')
    const survivors=backup.replayTombstonesAndComputeSurvivingSet(manifest,tombstones)
    h.eq(survivors.purgedCount,2,'selected original chunk and candidate excluded')
    const projectTombstone=await captureDurableProjectTombstone({h,fixture:durable,frozen,evidence})
    await db.close();db=null;compiled.clear();compiled=null

    const admin=await h.client('rehearsal_admin','postgres');await admin.query('CREATE DATABASE saga_g1_restored');await h.close(admin)
    h.command('pg_restore',['-h',h.config.host,'-U','rehearsal_admin','--exit-on-error','-d','saga_g1_restored',dumpPath],60000)
    const restored=await h.client('rehearsal_admin','saga_g1_restored')
    h.eq((await restored.query('SELECT jsonb_array_length(read_pilot_history($1)) n',[pilotId])).rows[0].n,1,'backup restores pilot evidence before tombstone replay')
    const restoredSpool=await restoreG3Backup({h,restored,evidence,fixture:g3})
    await verifyDurableRecordsRestore({h,restored,fixture:durable})
    h.eq((await restored.query('SELECT count(*)::int AS n FROM deletion_requests')).rows[0].n,preFreezeDeletionCount,'dump predates new deletion and preserves prior independent requests')
    for(const entry of objects){
      const bytes=await readFile(join(backupDir,entry.id));h.eq(digest(bytes),entry.sha256,'backup actual object hash');h.eq(bytes.length,entry.byteSize,'backup actual object size')
      await copyFile(join(backupDir,entry.id),join(restoreDir,entry.id))
    }
    // Replay the exact durable capture before allowing access to the restored DB.
    await restored.query('BEGIN')
    await restored.query('INSERT INTO deletion_requests SELECT * FROM jsonb_populate_record(NULL::deletion_requests,$1::jsonb)',[request])
    await restored.query('INSERT INTO deletion_targets SELECT * FROM jsonb_populate_recordset(NULL::deletion_targets,$1::jsonb)',[JSON.stringify(targets)])
    for(const t of targets){
      if(t.kind==='media_asset')await restored.query("UPDATE media_assets SET state='deleting' WHERE id=$1",[t.target_id.slice(6)])
      if(t.kind==='storage_object')await restored.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[t.bucket,t.object_key])
    }
    await restored.query('SELECT purge_story_content($1)',[request.id])
    await restored.query('COMMIT')
    await verifyDurableRecordsReplay({h,restored,fixture:durable,projectTombstone,result})
    h.eq((await restored.query('SELECT read_pilot_history($1) r',[pilotId])).rows[0].r,[],'post-freeze story tombstone replay erases restored pilot evidence')
    h.eq((await restored.query("SELECT read_pilot_cohort('g4-backup','synthetic')->'batch'->>'erasedHouseholds' n")).rows[0].n,'1','restored report discloses erased pilot sample')
    h.eq((await restored.query('SELECT content,transcript,status FROM stories WHERE id=$1',[selected.storyId])).rows[0],{content:null,transcript:null,status:'deleted'},'post-freeze replay purges restored story text')
    h.eq((await restored.query('SELECT metadata FROM recording_story_intents WHERE story_id=$1',[selected.storyId])).rows[0].metadata,{},'post-freeze replay clears restored save intent prose')
    const survivingIds=new Set(survivors.survivingObjects.map(o=>o.id))
    for(const entry of objects)if(!survivingIds.has(entry.id))await rm(join(restoreDir,entry.id))
    for(const entry of survivors.survivingObjects)h.eq(digest(await readFile(join(restoreDir,entry.id))),entry.sha256,'restored survivor bytes exact')
    h.eq((await restored.query('SELECT to_jsonb(r) AS row FROM deletion_requests r WHERE id=$1',[request.id])).rows[0].row,request,'exact durable request replayed')
    h.eq((await restored.query('SELECT to_jsonb(t) AS row FROM deletion_targets t WHERE deletion_request_id=$1 ORDER BY target_id',[request.id])).rows.map(r=>r.row),targets,'exact immutable target rows replayed')
    h.eq((await restored.query('SELECT count(*)::int AS n FROM storage.objects')).rows[0].n,survivors.survivingObjects.length,'restored Storage metadata matches survivors')

    const restoredHarness=Object.create(h);restoredHarness.db=restored;restoredHarness.scratch=join(h.scratch,'restored-runtime');await mkdir(restoredHarness.scratch)
    restoredHarness.client=(role='rehearsal_admin')=>h.client(role,'saga_g1_restored')
    restoredDb=await databaseHttp(restoredHarness,{allowedFunctions:publicationFunctions})
    await verifyG3Replay({h,restored,restoredDb,fixture:g3,spool:restoredSpool,result})
    for(const entry of survivors.survivingObjects)restoredDb.objects.set(entry.bucket+'/'+entry.key,{bytes:await readFile(join(restoreDir,entry.id)),type:entry.bucket==='saga'?'text/plain':object.mimeType})
    restoredCompiled=await compileServer(restoredHarness.scratch,source,restoredDb.admin)
    const assetFor=async story=>(await restored.query('SELECT id FROM media_assets WHERE story_id=$1',[story.storyId])).rows[0].id
    const selectedAsset=await assetFor(selected),retainedAsset=await assetFor(retained)
    const playback=async assetId=>restoredCompiled.routes.play.GET(new restoredCompiled.NextRequest('http://fixture.invalid/play',{headers:{authorization:'Bearer synthetic-flow-session'}}),{params:Promise.resolve({assetId})})
    const denied=await playback(selectedAsset);h.eq(denied.status,409,'restored deleting asset denies actual playback handler')
    // The new permanent reference guard rejects resurrection even by this
    // maintenance connection. Earlier evidence separately tested ready+tombstone
    // access; the current schema prevents creating that invalid state.
    let resurrectCode
    try { await restored.query("UPDATE media_assets SET state='ready' WHERE id=$1",[selectedAsset]) }
    catch (error) { resurrectCode=error.code }
    h.eq(resurrectCode,'23505','restored capture guard prevents ready resurrection')
    const tombstoneDenied=await playback(selectedAsset);h.eq(tombstoneDenied.status,409,'rejected resurrection leaves playback blocked')
    h.eq(await tombstoneDenied.json(),{error:'Asset is not ready for access'},'exact tombstone rejection')
    const allowed=await playback(retainedAsset);h.eq(allowed.status,307,'unrelated restored original gets protected playback redirect')
    const signed=allowed.headers.get('location');h.eq(new URL(signed).origin,restoredDb.origin,'redirect stays in local restored object service')
    const download=await fetch(signed);h.eq(download.status,200,'restored signed download succeeds')
    h.eq(digest(Buffer.from(await download.arrayBuffer())),object.sha256,'play handler resolves restored original bytes')
    server=createServer(async(req,res)=>{
      if(req.url==='/audio'){
        const response=await playback(retainedAsset);response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));return
      }
      res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><title>G1 restored original</title><body><h1>Restored original recording</h1><audio aria-label="Restored original" controls src="/audio"></audio></body></html>')
    })
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`
    browser=await chromium.launch({headless:true,channel:'chrome'});result.browser=browser.version()
    const page=await browser.newPage();await page.route('**/*',route=>[origin,restoredDb.origin].includes(new URL(route.request().url()).origin)?route.continue():route.abort());await page.goto(origin)
    const player=page.getByLabel('Restored original');await player.evaluate(audio=>audio.play());await expect.poll(()=>player.evaluate(audio=>audio.currentTime)).toBeGreaterThan(0)
    await page.screenshot({path:join(evidence,'restored-chrome.png')});await player.evaluate(audio=>audio.pause())
    result.checks=['full migrated schema serves two actual recordings','real pg_dump custom archive','real pg_restore to separate database','all object bytes restored and hashed','post-freeze capture and targets replayed exactly','restored story and intent prose purged','AI and reminder durable states restored with source and lease fences','post-freeze story/project tombstones erase AI drafts and reminder receipts','selected chunk/candidate omitted from restored store','deleted playback denied by actual route','unrelated restored audio plays in Chrome']
    result.dump={sha256:manifest.dumpSha256,bytes:dump.length};result.manifest=manifest;result.survivors=survivors;result.capture=captured;result.status='passed'
    return result
  }catch(error){result.status='failed';result.error={message:error.message,code:error.code,label:error.label};throw error}
  finally{
    await browser?.close();if(server){server.closeAllConnections();await new Promise(done=>server.close(done))}
    await restoredDb?.close();restoredCompiled?.clear();await db?.close();compiled?.clear()
    if(previous===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=previous
    if(previousSpool===undefined)delete process.env.ARCHIVE_SPOOL_DIR;else process.env.ARCHIVE_SPOOL_DIR=previousSpool
  }
}
