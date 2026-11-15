import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, lstatSync } from 'fs'
import { mkdir, readdir, rm, rmdir, stat } from 'fs/promises'
import { isAbsolute, join } from 'path'
import { Transform,Readable } from 'stream'
import { pipeline } from 'stream/promises'
import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildExportManifest, safeExportFilename } from '@/lib/media-assets'
import { createReadingBookletPdfStream, buildFrozenPublicationSnapshot, buildDefaultChapters, buildPublicationOfflineHtml, UnsupportedArchiveTextError } from '@/lib/server/archival-export-service'
import { loadArchiveSource, durableArchiveLimits, ArchiveSourceError } from '@/lib/server/publication-source-service'
import { publicationOperation, type PublicationJob } from '@/lib/server/publication-delivery-service'

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ZIP_BYTES=2200*1024*1024
/** Must be private persistent storage shared by the worker and download host. */
export function requireArchiveSpool():string {
 const root=process.env.ARCHIVE_SPOOL_DIR
 if(!root || !isAbsolute(root) || !existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink() || (lstatSync(root).mode & 0o077)!==0) throw new ArchiveSourceError(503,'Archive worker storage is not configured')
 return root
}
export function publicationArtifactPath(job:PublicationJob):string {
 if(!ID.test(job.id) || !job.lease_token || !ID.test(job.lease_token)) throw new ArchiveSourceError(409,'Archive artifact identity is unavailable')
 const root=requireArchiveSpool()
 for(const part of [join(root,job.id),join(root,job.id,job.lease_token),join(root,job.id,job.lease_token,'archive.zip')]) if(existsSync(part) && lstatSync(part).isSymbolicLink()) throw new ArchiveSourceError(409,'Archive artifact link rejected')
 return join(root,job.id,job.lease_token,'archive.zip')
}
async function fileDigest(path:string) { const hash=createHash('sha256');for await(const chunk of createReadStream(path)) hash.update(chunk);return hash.digest('hex') }
function byteLimiter(limit:number) { let bytes=0;return new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;callback(bytes>limit?new Error('Archive disk quota exceeded'):null,chunk)}}) }

/** A failed/late transport must never be treated as an absent database row. */
async function readPublicationJob(admin:SupabaseClient,id:string):Promise<PublicationJob|null> {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000)
 let rejectAbort:()=>void=()=>{}
 const interrupted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(new Error('Archive reconciliation timed out'));controller.signal.addEventListener('abort',rejectAbort,{once:true})})
 try {
  const query=admin.from('publication_delivery_jobs').select('*').eq('id',id).abortSignal(controller.signal).maybeSingle().retry(false)
  const result=await Promise.race([query,interrupted])
  if(result.error)throw new Error('Archive job reconciliation unavailable')
  if(result.data===null)return null
  const job=result.data as PublicationJob
  if(!job || job.id!==id || !['queued','running','ready','failed','revoked'].includes(job.status) || (job.lease_token!==null&&!ID.test(job.lease_token)))throw new Error('Archive reconciliation identity invalid')
  return job
 } finally {clearTimeout(timer);controller.signal.removeEventListener('abort',rejectAbort);controller.abort()}
}
function referenced(job:PublicationJob|null,token:string) {return job?.lease_token===token&&['ready','running'].includes(job.status)}
async function cleanTemporaryFiles(dir:string) {
 for(const file of await readdir(dir))if(file!=='archive.zip')await rm(join(dir,file),{recursive:true,force:true})
}
async function reconcileAttempts(admin:SupabaseClient,root:string,jobId:string):Promise<number> {
 const dir=join(root,jobId);let removed=0
 // Capture names before the database snapshot: a claimant persists its new
 // unique token before creating its directory. A later claim's directory must
 // never be swept against an earlier queued/failed/missing-row snapshot.
 if(existsSync(dir)&&(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink()))throw new Error('Invalid archive attempt directory')
 const attempts=await readdir(dir,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error})
 const job=await readPublicationJob(admin,jobId)
 for(const attempt of attempts) {
  if(!ID.test(attempt.name))continue
  if(job?.status==='ready'&&attempt.name===job.lease_token&&attempt.isDirectory()&&!attempt.isSymbolicLink())await cleanTemporaryFiles(join(dir,attempt.name))
  if(!referenced(job,attempt.name)){await rm(join(dir,attempt.name),{recursive:true,force:true});removed++}
 }
 // Never recursively remove the job root: a new attempt may have arrived
 // after enumeration, including after a lookup which returned no job.
 if(!job)await rmdir(dir).catch(error=>{if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code))throw error})
 return removed
}

/** Also reconciles orphan attempts after worker termination and restored DBs. */
export async function reconcilePublicationArtifacts(admin:SupabaseClient):Promise<number> {
 const root=requireArchiveSpool();let removed=0
 const cleanup=await admin.from('publication_artifact_cleanup').select('job_id').limit(500)
 if(cleanup.error || !Array.isArray(cleanup.data)) throw new Error('Archive cleanup queue unavailable')
 for(const row of cleanup.data) {
  if(!ID.test(row.job_id)) throw new Error('Invalid cleanup identity')
  // A retry may already own this job. Acknowledge the stale intent only after
  // cleaning unreferenced attempts, so it cannot starve the durable queue.
  removed+=await reconcileAttempts(admin,root,row.job_id)
  const result=await admin.rpc('complete_publication_cleanup',{p_job:row.job_id})
  if(result.error) throw new Error('Archive cleanup acknowledgement unavailable')
  removed++
 }
 // The spool is dedicated to this worker, never traverse arbitrary paths.
 for(const entry of await readdir(root,{withFileTypes:true})) {
  if(!ID.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) continue
  removed+=await reconcileAttempts(admin,root,entry.name)
 }
 return removed
}

/** One bounded job per invocation. Run continuously under an external supervisor. */
export async function runPublicationDeliveryWorker({admin,signal,timeoutMs=540000}:{admin:SupabaseClient;signal?:AbortSignal;timeoutMs?:number}):Promise<{outcome:string;jobId?:string}> {
 const root=requireArchiveSpool()
 await reconcilePublicationArtifacts(admin)
 const result=await admin.from('publication_delivery_jobs').select('*').in('status',['queued','running']).order('created_at',{ascending:true}).limit(100)
 if(result.error || !Array.isArray(result.data)) throw new Error('Archive queue unavailable')
 const candidate=(result.data as PublicationJob[]).find(job=>job.status==='queued' || new Date(job.lease_until ?? 0).getTime()<=Date.now())
 if(!candidate) return {outcome:'idle'}
 let job:PublicationJob
 try {job=await publicationOperation(admin,candidate.actor_id,candidate.project_id,'claim',candidate.id)}
 catch(error) {
  if(error instanceof ArchiveSourceError && [403,409].includes(error.status)) await admin.rpc('invalidate_publication_job',{p_job:candidate.id,p_reason:error.status===403?'revoked':'source_changed'})
  return {outcome:'unavailable',jobId:candidate.id}
 }
 if(!job.claimed || job.status!=='running' || !job.lease_token) return {outcome:'contended',jobId:job.id}
 const token=job.lease_token,dir=join(root,job.id,token)
 publicationArtifactPath(job) // Validate every existing parent before writing.
 await mkdir(dir,{recursive:true,mode:0o700})
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason)
 if(signal?.aborted) abort();else signal?.addEventListener('abort',abort,{once:true})
 const deadline=setTimeout(()=>controller.abort(new Error('Archive worker deadline exceeded')),Math.max(10,Math.min(timeoutMs,540000)))
 deadline.unref()
 let heartbeatFailure:unknown,finishing=false,commitAttempted=false
 let archiveBytes:number|undefined,archiveDigest:string|undefined
 const matchesReady=(current:PublicationJob|null)=>current?.id===job.id&&current.status==='ready'&&current.lease_token===token&&current.byte_size===archiveBytes&&current.zip_sha256===archiveDigest
 let heartbeatPending:Promise<unknown>=Promise.resolve()
 const heartbeat=setInterval(()=>{
  heartbeatPending=heartbeatPending.then(async()=>{if(finishing || controller.signal.aborted)return;await publicationOperation(admin,job.actor_id,job.project_id,'heartbeat',job.id,{token})})
   .catch(error=>{heartbeatFailure=error;controller.abort(error)})
 },30000)
 heartbeat.unref()
 const stopHeartbeat=async()=>{finishing=true;clearInterval(heartbeat);await heartbeatPending}
 const exclusiveFlags='wx'
 try {
  const source=await loadArchiveSource(admin,job.project_id,durableArchiveLimits)
  const checked=await publicationOperation(admin,job.actor_id,job.project_id,'prepare',null,{source:source.identity,subjects:source.subjects})
  if(checked.id!==job.id) throw new Error('Archive source changed')
  const zip=new JSZip(), manifest=buildExportManifest(source.assets)
  let total=0
  for(const asset of source.assets) {
   if(heartbeatFailure) throw heartbeatFailure
   const response=await admin.storage.from(asset.bucket).download(asset.object_key,{}, {signal:controller.signal}).asStream()
   if(response.error || !response.data) throw new Error('Archive source unavailable')
   const reader=response.data.getReader(),cancel=()=>{void reader.cancel().catch(()=>{})},hash=createHash('sha256');let size=0
   controller.signal.addEventListener('abort',cancel,{once:true})
   if(controller.signal.aborted)cancel()
   const file=join(dir,asset.id)
   if(!ID.test(asset.id)) throw new Error('Invalid asset identity')
   const stream=createWriteStream(file,{flags:exclusiveFlags,mode:0o600})
   const bytes=async function*() {try {while(true){if(controller.signal.aborted)throw new Error('Archive cancelled');const next=await reader.read();if(controller.signal.aborted)throw new Error('Archive cancelled');if(next.done)break;size+=next.value.byteLength;total+=next.value.byteLength;
    if(size>(asset.byte_size ?? 0) || total>durableArchiveLimits.mediaBytes) throw new Error('Archive source byte bound exceeded')
    hash.update(next.value);yield next.value
   }}finally{controller.signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}}
   await pipeline(bytes(),stream,{signal:controller.signal})
   if(size!==asset.byte_size || hash.digest('hex')!==asset.sha256) throw new Error('Archive source integrity failed')
   zip.file(`media/${asset.id}/${safeExportFilename(asset.original_filename)}`,Readable.from((async function*(){for await(const chunk of createReadStream(file)) yield chunk})()))
  }
  const chapters=buildDefaultChapters(source.stories), pdfFile=join(dir,'biography.pdf')
  const input={projectId:job.project_id,projectName:source.project.name,projectDescription:source.project.description,snapshotVersion:job.snapshot_version,exportedAt:job.created_at,stories:source.stories,chapters,manifest}
  await pipeline(createReadingBookletPdfStream(input),byteLimiter(64*1024*1024),createWriteStream(pdfFile,{flags:exclusiveFlags,mode:0o600}),{signal:controller.signal})
  const snapshot=buildFrozenPublicationSnapshot({...input,snapshotId:job.id,createdBy:job.actor_id,pdfBytes:Buffer.alloc(0)})
  snapshot.pdfSha256=await fileDigest(pdfFile)
  zip.file('biography-booklet.pdf',Readable.from((async function*(){for await(const chunk of createReadStream(pdfFile)) yield chunk})()))
  zip.file('index.html',buildPublicationOfflineHtml(input))
  zip.file('chapters.json',JSON.stringify(chapters,null,2))
  zip.file('manifest.json',JSON.stringify(manifest,null,2))
  zip.file('sources-and-revisions.json',JSON.stringify(source.stories,null,2))
  zip.file('publication-snapshot.json',JSON.stringify(snapshot,null,2))
  const target=publicationArtifactPath(job)
  await pipeline(zip.generateNodeStream({type:'nodebuffer',streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6}}),byteLimiter(MAX_ZIP_BYTES),createWriteStream(target,{flags:exclusiveFlags,mode:0o600}),{signal:controller.signal})
  if(heartbeatFailure) throw heartbeatFailure
  await stopHeartbeat()
  if(controller.signal.aborted)throw new Error('Archive deadline exceeded')
  archiveBytes=(await stat(target)).size;archiveDigest=await fileDigest(target)
  commitAttempted=true
  const finished=await publicationOperation(admin,job.actor_id,job.project_id,'finish',job.id,{token,snapshot,manifest,stories:source.stories,byteSize:archiveBytes,zipSha256:archiveDigest})
  if(!matchesReady(finished))throw new Error('Archive commit identity unavailable')
  // Cleanup is independently retried by reconciliation; a ready ZIP never rolls back.
  await cleanTemporaryFiles(dir).catch(()=>{})
  return {outcome:'ready',jobId:job.id}
 } catch (error) {
  await stopHeartbeat()
  try {
   if(commitAttempted) {
    const current=await readPublicationJob(admin,job.id)
    if(matchesReady(current)){await cleanTemporaryFiles(dir).catch(()=>{});return {outcome:'ready',jobId:job.id}}
    if(!referenced(current,token)){await rm(dir,{recursive:true,force:true});return {outcome:'failed',jobId:job.id}}
    if(current?.status==='ready')return {outcome:'unavailable',jobId:job.id}
   }
   const failed=await publicationOperation(admin,job.actor_id,job.project_id,'fail',job.id,{token,errorCode:error instanceof UnsupportedArchiveTextError?'unsupported_text':'assembly_failed'}).catch(()=>null)
   // The fail RPC serializes with finish. Its acknowledged failure proves this
   // token cannot subsequently commit; otherwise query, and preserve on doubt.
   const current=failed?.id===job.id&&failed.status==='failed'?failed:await readPublicationJob(admin,job.id)
   if(commitAttempted&&matchesReady(current)){await cleanTemporaryFiles(dir).catch(()=>{});return {outcome:'ready',jobId:job.id}}
   if(referenced(current,token))return {outcome:'unavailable',jobId:job.id}
   await rm(dir,{recursive:true,force:true})
   return {outcome:'failed',jobId:job.id}
  } catch {return {outcome:'unavailable',jobId:job.id}}
 } finally {await stopHeartbeat();clearTimeout(deadline);signal?.removeEventListener('abort',abort)}
}
