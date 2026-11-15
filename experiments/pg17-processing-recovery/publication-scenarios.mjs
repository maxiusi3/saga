import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {mkdir,readFile,stat,chmod} from 'node:fs/promises'
import {join,dirname} from 'node:path'
import {databaseHttp,SERVICE_KEY} from '../recording-flow-browser/database-http.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
const require=createRequire(import.meta.url),{createClient}=require('@supabase/supabase-js'),JSZip=require('jszip')

export async function publicationRecoveryScenarios({h,source}) {
 const db=await databaseHttp(h,{allowedFunctions:['publication_delivery','complete_publication_cleanup','invalidate_publication_job']})
 const worker=await compileModule('lib/server/publication-delivery-worker.ts',join(h.scratch,'publication-recovery-worker'),source)
 const sources=await compileModule('lib/server/publication-source-service.ts',join(h.scratch,'publication-recovery-source'),source)
 const service=await compileModule('lib/server/publication-delivery-service.ts',join(h.scratch,'publication-recovery-service'),source)
 const spool=join(h.scratch,'publication-recovery-spool'),priorSpool=process.env.ARCHIVE_SPOOL_DIR
 await mkdir(spool,{mode:0o700});process.env.ARCHIVE_SPOOL_DIR=spool
 const owner=randomUUID();await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[owner,'publication-recovery@example.invalid'])
 let failReads=false,commitMode='',lastJob=null
 const client=createClient(db.origin,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url)
  if(url.origin!==db.origin)throw new Error('Nonlocal publication network forbidden')
  if(failReads&&url.pathname==='/rest/v1/publication_delivery_jobs')return Response.json({code:'503',message:'controlled reconciliation failure'},{status:503})
  const finish=url.pathname.endsWith('/publication_delivery')&&typeof init?.body==='string'&&JSON.parse(init.body).p_operation==='finish'
  if(finish&&commitMode==='precommit')return Response.json({code:'503',message:'controlled before commit failure'},{status:503})
  const response=await fetch(input,init)
  if(finish&&response.ok){
   lastJob=await response.clone().json()
   if(commitMode==='cleanup')await chmod(dirname(worker.publicationArtifactPath(lastJob)),0o500)
   if(['lost','unknown'].includes(commitMode)){await response.arrayBuffer();if(commitMode==='unknown')failReads=true;throw new Error('Controlled committed finish response loss')}
  }
  return response
 }}})
 const checks=[]
 try {
  for(const mode of ['lost','unknown','cleanup','precommit']) {
   commitMode=mode;lastJob=null
   const project=randomUUID(),story=randomUUID()
   await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'Synthetic publication '+mode,owner])
   await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'Recovery source','This is an exact synthetic family memory.'])
   const sourceData=await sources.loadArchiveSource(db.admin,project,sources.durableArchiveLimits)
   const prepared=await service.preparePublication(db.admin,owner,sourceData)
   const result=await worker.runPublicationDeliveryWorker({admin:client})
   const row=(await h.db.query('SELECT * FROM publication_delivery_jobs WHERE id=$1',[prepared.id])).rows[0]
   h.eq(result.outcome,mode==='unknown'?'unavailable':mode==='precommit'?'failed':'ready','publication outcome '+mode)
   h.eq(row.status,mode==='precommit'?'failed':'ready','actual committed SQL state '+mode)
   const path=worker.publicationArtifactPath(row)
   if(mode==='precommit')h.eq(await stat(path).then(()=>true,()=>false),false,'confirmed precommit failure removes only failed attempt')
   else {
    const zip=await readFile(path)
    h.eq(zip.length,Number(row.byte_size),'referenced ZIP size retained '+mode)
    h.eq(createHash('sha256').update(zip).digest('hex'),row.zip_sha256,'referenced ZIP digest retained '+mode)
    const archive=await JSZip.loadAsync(zip,{checkCRC32:true})
    h.eq(JSON.parse(await archive.file('publication-snapshot.json').async('string')).snapshotId,row.id,'actual readable ZIP retains committed snapshot '+mode)
   }
   if(mode==='cleanup'){h.eq(await stat(join(dirname(path),'biography.pdf')).then(()=>true,()=>false),true,'temporary cleanup failure did not roll back ready ZIP');await chmod(dirname(path),0o700)}
   failReads=false;commitMode=''
   if(mode==='lost')await h.db.query('INSERT INTO publication_artifact_cleanup(job_id) VALUES($1)',[row.id])
   await worker.reconcilePublicationArtifacts(db.admin)
   if(mode!=='precommit')h.eq(await stat(path).then(()=>true,()=>false),true,'later reconciliation preserves referenced ready ZIP '+mode)
   if(mode==='lost')h.eq((await h.db.query('SELECT count(*)::int n FROM publication_artifact_cleanup WHERE job_id=$1',[row.id])).rows[0].n,0,'stale cleanup intent is acknowledged without deleting the current ZIP')
   checks.push(mode)
  }
  // Capture an actual queued SQL response, then finish another production
  // worker before delivering that stale response to the cleanup process.
  const raceProject=randomUUID(),raceStory=randomUUID()
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[raceProject,'Synthetic cleanup race',owner])
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[raceStory,raceProject,owner,'Concurrent memory','A newly committed ZIP must survive another cleanup worker.'])
  const raceSource=await sources.loadArchiveSource(db.admin,raceProject,sources.durableArchiveLimits)
  const raceJob=await service.preparePublication(db.admin,owner,raceSource)
  await mkdir(join(spool,raceJob.id),{mode:0o700})
  let raced=false
  const racingClient=createClient(db.origin,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input.url)
   if(url.origin!==db.origin)throw new Error('Nonlocal publication race traffic forbidden')
   const response=await fetch(input,init)
   if(!raced&&url.pathname==='/rest/v1/publication_delivery_jobs'&&url.searchParams.get('id')==='eq.'+raceJob.id){
    raced=true
    const stale=await response.clone().json();h.eq((Array.isArray(stale)?stale[0]:stale).status,'queued','reconciliation response was read before the concurrent claim')
    h.eq((await worker.runPublicationDeliveryWorker({admin:db.admin})).outcome,'ready','concurrent real worker commits a new ZIP before cleanup receives stale queued row')
   }
   return response
  }}})
  await worker.reconcilePublicationArtifacts(racingClient)
  h.ok(raced,'cleanup interleaving was exercised')
  const raceReady=(await h.db.query('SELECT * FROM publication_delivery_jobs WHERE id=$1',[raceJob.id])).rows[0]
  const survivingZip=await readFile(worker.publicationArtifactPath(raceReady))
  h.eq(createHash('sha256').update(survivingZip).digest('hex'),raceReady.zip_sha256,'newly referenced ZIP survives stale queued cleanup snapshot')
  await JSZip.loadAsync(survivingZip,{checkCRC32:true});checks.push('stale-snapshot-concurrent-ready-preserved')
  h.report.publicationRecovery={status:'passed',checks,boundary:'Production assembly/PDF/ZIP worker and Supabase SDK against native PG17 with actual committed finish responses dropped by controlled local transport; physical filesystem cleanup failure. No remote services.'}
 } finally {
  if(lastJob)await chmod(dirname(worker.publicationArtifactPath(lastJob)),0o700).catch(()=>{})
  if(priorSpool===undefined)delete process.env.ARCHIVE_SPOOL_DIR;else process.env.ARCHIVE_SPOOL_DIR=priorSpool
  await db.close()
 }
}
