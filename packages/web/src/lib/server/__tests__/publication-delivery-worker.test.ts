/** @jest-environment node */
import {randomUUID} from 'crypto'
import {mkdtemp,mkdir,stat,rm,writeFile} from 'fs/promises'
import * as disk from 'fs/promises'
import {tmpdir} from 'os'
import {join} from 'path'
import type {SupabaseClient} from '@supabase/supabase-js'
import {runPublicationDeliveryWorker,reconcilePublicationArtifacts} from '../publication-delivery-worker'
import {loadArchiveSource} from '../publication-source-service'
import {publicationOperation} from '../publication-delivery-service'
jest.mock('fs/promises',()=>{const real=jest.requireActual('fs/promises');return {...real,rm:jest.fn(real.rm)}})
jest.mock('../publication-source-service',()=>{const real=jest.requireActual('../publication-source-service');return {...real,loadArchiveSource:jest.fn()}})
jest.mock('../publication-delivery-service',()=>({publicationOperation:jest.fn()}))
const load=jest.mocked(loadArchiveSource),operation=jest.mocked(publicationOperation)
let root:string
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'publication-worker-'));process.env.ARCHIVE_SPOOL_DIR=root;jest.clearAllMocks()})
afterEach(async()=>{delete process.env.ARCHIVE_SPOOL_DIR;await rm(root,{recursive:true,force:true})})
it('cancels a stalled Storage reader at its job deadline, clears private files and records failed',async()=>{
 const job={id:randomUUID(),project_id:randomUUID(),actor_id:randomUUID(),lease_token:randomUUID(),lease_until:'2099-01-01',status:'running',attempt:1,source_sha256:'a'.repeat(64),snapshot_version:1,source_subjects:[],error_code:null,byte_size:null,zip_sha256:null,created_at:new Date().toISOString(),claimed:true} as const
 const candidate={...job,status:'queued'}
 const cancel=jest.fn(),reader=new ReadableStream<Uint8Array>({pull(){},cancel})
 const asset={id:randomUUID(),bucket:'audio-recordings',object_key:'original',byte_size:100,sha256:'a'.repeat(64),state:'ready',kind:'original_audio',mime_type:'audio/wav',version:1}
 load.mockResolvedValue({project:{id:job.project_id,name:'Test'},assets:[asset],stories:[],subjects:[],identity:{}} as never)
 operation.mockImplementation(async(_a,_b,_c,op)=>op==='claim'?job:op==='prepare'?job:{...job,status:'failed'})
 const response=(data:unknown)=>({select:()=>({limit:async()=>({data,error:null}),in:()=>({order:()=>({limit:async()=>({data,error:null})})})})})
 const admin={from:(table:string)=>response(table==='publication_artifact_cleanup'?[]:[candidate]),storage:{from:()=>({download:()=>({asStream:async()=>({data:reader,error:null})})})}} as unknown as SupabaseClient
 const started=Date.now(),result=await runPublicationDeliveryWorker({admin,timeoutMs:30})
 expect(result).toEqual({outcome:'failed',jobId:job.id});expect(Date.now()-started).toBeLessThan(2000)
 expect(cancel).toHaveBeenCalledTimes(1)
 expect(await stat(join(root,job.id,job.lease_token)).then(()=>true,()=>false)).toBe(false)
 expect(operation).toHaveBeenLastCalledWith(admin,job.actor_id,job.project_id,'fail',job.id,{token:job.lease_token,errorCode:'assembly_failed'})
})
it('rejects a public or symlinked spool before reading any private source',async()=>{
 const publicRoot=join(root,'public');await mkdir(publicRoot,{mode:0o755});process.env.ARCHIVE_SPOOL_DIR=publicRoot
 const admin={} as SupabaseClient
 await expect(runPublicationDeliveryWorker({admin})).rejects.toThrow('not configured')
 expect(load).not.toHaveBeenCalled()
})

function finishingFixture(mode:'ack-lost'|'unknown'|'cleanup-failed'|'pre-commit'|'stale'|'revoked') {
 const job={id:randomUUID(),project_id:randomUUID(),actor_id:randomUUID(),lease_token:randomUUID(),lease_until:'2099-01-01',status:'running',attempt:1,source_sha256:'a'.repeat(64),snapshot_version:1,source_subjects:[],error_code:null,byte_size:null,zip_sha256:null,created_at:new Date().toISOString(),claimed:true} as const
 let persisted:Record<string,unknown>={...job,status:'queued'}
 load.mockResolvedValue({project:{id:job.project_id,name:'Test'},assets:[],stories:[],subjects:[],identity:{}} as never)
 operation.mockImplementation(async(_a,_b,_c,op,_id,payload:any)=>{
  if(op==='claim'){persisted={...job};return job}
  if(op==='finish'){
   if(mode==='stale')persisted={...job,lease_token:randomUUID()}
   else if(mode==='revoked')persisted={...job,status:'revoked',lease_token:null}
   else if(mode!=='pre-commit')persisted={...job,status:'ready',byte_size:payload.byteSize,zip_sha256:payload.zipSha256}
   if(mode!=='cleanup-failed')throw new Error('connection lost')
   return persisted as never
  }
  if(op==='fail'){
   if(persisted.status!=='running'||persisted.lease_token!==job.lease_token)throw new Error('lease lost')
   persisted={...job,status:'failed'};return persisted as never
  }
  return job
 })
 const admin={from:(table:string)=>{
  const q:any={select:()=>q,in:()=>q,order:()=>q,limit:async()=>({data:table==='publication_artifact_cleanup'?[]:[persisted],error:null}),eq:()=>q,abortSignal:()=>q,retry:async()=>({data:persisted,error:mode==='unknown'?{code:'503'}:null}),
   maybeSingle:()=>{const r={data:persisted,error:mode==='unknown'?{code:'503'}:null};return Object.assign(Promise.resolve(r),{abortSignal:()=>q,retry:()=>Promise.resolve(r)})}}
  return q
 }} as unknown as SupabaseClient
 return {admin,job,path:join(root,job.id,job.lease_token,'archive.zip')}
}
it('reconciles a committed ready result after response loss and preserves the referenced ZIP',async()=>{
 const f=finishingFixture('ack-lost');expect(await runPublicationDeliveryWorker({admin:f.admin})).toEqual({outcome:'ready',jobId:f.job.id})
 expect((await stat(f.path)).size).toBeGreaterThan(0)
 expect(operation.mock.calls.some(c=>c[3]==='fail')).toBe(false)
})
it('keeps a committed ZIP ready when temporary-file cleanup throws',async()=>{
 const f=finishingFixture('cleanup-failed'),original=jest.requireActual('fs/promises').rm
 const spy=jest.spyOn(disk,'rm').mockImplementation(async(path,options)=>{if(String(path).endsWith('biography.pdf'))throw new Error('temporary cleanup denied');return original(path,options)})
 try{expect(await runPublicationDeliveryWorker({admin:f.admin})).toEqual({outcome:'ready',jobId:f.job.id});expect((await stat(f.path)).size).toBeGreaterThan(0);expect(operation.mock.calls.some(c=>c[3]==='fail')).toBe(false)}finally{spy.mockImplementation(original)}
})
it('preserves the ZIP for later reconciliation when both commit and status responses are unknown',async()=>{
 const f=finishingFixture('unknown');expect(await runPublicationDeliveryWorker({admin:f.admin})).toEqual({outcome:'unavailable',jobId:f.job.id});expect((await stat(f.path)).size).toBeGreaterThan(0)
 expect(operation.mock.calls.some(c=>c[3]==='fail')).toBe(false)
})
it.each(['pre-commit','stale','revoked'] as const)('removes only an attempt confirmed unreferenced after %s',async mode=>{
 const f=finishingFixture(mode);expect((await runPublicationDeliveryWorker({admin:f.admin})).outcome).toBe('failed');expect(await stat(f.path).then(()=>true,()=>false)).toBe(false)
})

it.each(['queued','running','failed','missing'] as const)('preserves a newly claimed ZIP created after a stale %s status snapshot',async previous=>{
 const id=randomUUID(),oldToken=randomUUID(),newToken=randomUUID(),dir=join(root,id),archive=join(dir,newToken,'archive.zip')
 await mkdir(join(dir,oldToken),{recursive:true,mode:0o700});await writeFile(join(dir,oldToken,'archive.zip'),'orphaned attempt')
 let current:Record<string,unknown>|null=previous==='missing'?null:{id,status:previous,lease_token:previous==='running'?oldToken:null},reads=0
 const admin={from:(table:string)=>{
  const q:any={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>q,limit:async()=>({data:[],error:null}),retry:async()=>{
   const snapshot=current
   if(reads++===0){current={id,status:'ready',lease_token:newToken};await mkdir(join(dir,newToken),{mode:0o700});await writeFile(archive,'committed new ZIP')}
   return {data:snapshot,error:null}
  }};return q
 },rpc:async()=>({data:null,error:null})} as unknown as SupabaseClient
 await reconcilePublicationArtifacts(admin)
 expect(await stat(archive).then(()=>true,()=>false)).toBe(true)
})
it.each([false,true])('cleanup queue preserves a new ready attempt after a stale %s job lookup',missing=>{
 return (async()=>{
  const id=randomUUID(),oldToken=randomUUID(),newToken=randomUUID(),dir=join(root,id),archive=join(dir,newToken,'archive.zip')
  await mkdir(join(dir,oldToken),{recursive:true,mode:0o700});await writeFile(join(dir,oldToken,'archive.zip'),'old attempt')
  let current:Record<string,unknown>|null=missing?null:{id,status:'failed',lease_token:oldToken},reads=0
  const admin={from:(table:string)=>{
   const q:any={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>q,limit:async()=>({data:table==='publication_artifact_cleanup'?[{job_id:id}]:[],error:null}),retry:async()=>{
    const snapshot=current
    if(reads++===0){current={id,status:'ready',lease_token:newToken};await mkdir(join(dir,newToken),{mode:0o700});await writeFile(archive,'committed new ZIP')}
    return {data:snapshot,error:null}
   }};return q
  },rpc:async()=>({data:null,error:null})} as unknown as SupabaseClient
  await reconcilePublicationArtifacts(admin)
  expect(await stat(archive).then(()=>true,()=>false)).toBe(true)
 })()
})
