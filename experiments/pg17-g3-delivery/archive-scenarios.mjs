import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {mkdir,writeFile,readFile,stat,rename,symlink,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {databaseHttp} from '../recording-flow-browser/database-http.mjs'
import {compileModule} from '../g1-local/compile-module.mjs'
const require=createRequire(import.meta.url),JSZip=require('jszip'),{NextRequest}=require('next/server')
export async function archiveScenarios({h,source,evidence}) {
 const owner=randomUUID(),member=randomUUID(),outsider=randomUUID(),project=randomUUID(),story=randomUUID()
 const archiveEvidence=join(evidence,'archive');await mkdir(archiveEvidence,{recursive:true})
 const raw=('祖母在海邊長大。她記得每天清晨和家人一同工作，也記得那一年的春天。完整中文內容不得截斷。\n'.repeat(250))+'最後的原文句子。'
 await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$4),($2,$5),($3,$6)',[owner,member,outsider,'archive-owner@example.invalid','archive-member@example.invalid','archive-outsider@example.invalid'])
 await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[project,'祖母的家庭傳記',owner])
 await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,member])
 await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[story,project,owner,'家族記憶',raw])
 const review=async(op,version=null,payload={})=>{const r=await h.actor('service_role',owner,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) r',[owner,story,op,randomUUID(),version,JSON.stringify(payload)]);h.eq(r.sqlstate,'00000','archive '+op);return r.rows[0].r}
 let state=await review('prepare')
 for(const assertion of state.assertions) state=await review('decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:assertion.id,action:'accept'})
 state=await review('approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
 const spool=join(h.scratch,'archive-spool');await mkdir(spool,{mode:0o700})
 const oldFlag=process.env.MEDIA_ASSETS_ENABLED,oldSpool=process.env.ARCHIVE_SPOOL_DIR
 process.env.MEDIA_ASSETS_ENABLED='true';process.env.ARCHIVE_SPOOL_DIR=spool
 const db=await databaseHttp(h,{allowedFunctions:['publication_delivery','complete_publication_cleanup','invalidate_publication_job']})
 const boundary=join(h.scratch,'archive-boundary.cjs');globalThis.__g3ArchiveAdmin=db.admin
 await writeFile(boundary,`const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});exports.getSupabaseAdmin=()=>globalThis.__g3ArchiveAdmin;exports.getAuthenticatedUser=async request=>{const id=request.headers.get('authorization')?.replace('Bearer ','');return id?[{ok:true,user:{id},headers:new Headers()}][0]:{ok:false,response:NextResponse.json({error:'Unauthorized'},{status:401})}};`)
 const seams={'@/lib/supabase':boundary,'@/lib/server/auth':boundary}
 const route=await compileModule('app/api/projects/[id]/export/route.ts',join(h.scratch,'archive-api'),source,seams)
 const download=await compileModule('app/api/projects/[id]/export/jobs/[jobId]/download/route.ts',join(h.scratch,'archive-download'),source,seams)
 const statusRoute=await compileModule('app/api/projects/[id]/export/jobs/[jobId]/route.ts',join(h.scratch,'archive-status'),source,seams)
 const worker=await compileModule('lib/server/publication-delivery-worker.ts',join(h.scratch,'archive-worker'),source,seams)
 const request=(actor=owner)=>new NextRequest(`http://localhost/api/projects/${project}/export?durable=true`,{method:'POST',headers:{Authorization:`Bearer ${actor}`}})
 const get=(jobId,actor=owner)=>download.GET(new NextRequest('http://localhost/download',{headers:{Authorization:`Bearer ${actor}`}}),{params:Promise.resolve({id:project,jobId})})
 try {
  h.eq((await route.POST(request(outsider),{params:Promise.resolve({id:project})})).status,403,'family B export denied')
  let response=await route.POST(request(),{params:Promise.resolve({id:project})})
  if(response.status!==202) h.report.archiveDebug=await response.clone().text()
  h.eq(response.status,202,'durable archive accepted');const job=await response.json()
  const result=await worker.runPublicationDeliveryWorker({admin:db.admin});h.report.archiveWorker=result
  h.eq(result.outcome,'ready','external worker completes paginated Unicode archive')
  response=await get(job.jobId);h.eq(response.status,200,'protected artifact download')
  const zipBytes=Buffer.from(await response.arrayBuffer()),zip=await JSZip.loadAsync(zipBytes,{checkCRC32:true})
  const snapshot=JSON.parse(await zip.file('publication-snapshot.json').async('string'))
  h.eq(snapshot.snapshotId,job.jobId,'persisted snapshot identity');h.eq(snapshot.hostingRetention,null,'download invents no purchased hosting')
  const html=await zip.file('index.html').async('string');h.ok(html.includes('Approved rendition')&&html.includes('Original transcript')&&html.includes('最後的原文句子。'),'approved and raw are separately complete offline')
  await writeFile(join(archiveEvidence,'archive.zip'),zipBytes)
  await writeFile(join(archiveEvidence,'booklet.pdf'),await zip.file('biography-booklet.pdf').async('nodebuffer'))
  await writeFile(join(archiveEvidence,'index.html'),html)
  execFileSync('pdftotext',['-layout',join(archiveEvidence,'booklet.pdf'),join(archiveEvidence,'booklet.txt')])
  const text=await readFile(join(archiveEvidence,'booklet.txt'),'utf8');h.ok(text.includes('最後的原文句子。'),'PDF preserves final Chinese prose');h.ok(text.split('\f').length>3,'PDF contains real long-form pagination')
  execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1400','-png',join(archiveEvidence,'booklet.pdf'),join(archiveEvidence,'booklet-first')])
  const repeated=await route.POST(request(),{params:Promise.resolve({id:project})});h.eq(repeated.status,202,'repeat accepted');h.eq((await repeated.json()).jobId,job.jobId,'repeat reuses immutable identity')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE project_id=$1',[project])).rows[0].n,1,'repeat creates no bogus publication')
  h.eq((await h.actor('service_role',owner,"UPDATE publication_snapshots SET pdf_sha256=repeat('a',64) WHERE id=$1",[job.jobId])).sqlstate,'23514','snapshot cannot mutate')
  await h.db.query('INSERT INTO project_members(project_id,user_id,status) VALUES($1,$2,$3)',[project,member,'active'])
  await h.db.query("UPDATE project_roles SET status='removed' WHERE project_id=$1 AND user_id=$2",[project,member]);h.eq((await get(job.jobId,member)).status,403,'removed member download denied')
  h.eq((await get(job.jobId,outsider)).status,403,'family B download denied')
  h.eq((await h.actor('service_role',member,'SELECT publication_delivery($1,$2,$3,$4,$5::jsonb)',[member,project,'validate',job.jobId,'{}'])).sqlstate,'42501','final RPC denies revoked role despite legacy active membership')
  const snapshotRow=(await h.db.query('SELECT to_jsonb(p) row FROM publication_snapshots p WHERE id=$1',[job.jobId])).rows[0].row
  state=await review('correct_transcript',state.revision.edit_version,{revision_id:state.revision.id,text:'新的已核准正文。最後一句修改。'})
  for(const assertion of state.assertions)state=await review('decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:assertion.id,action:'accept'})
  state=await review('approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
  h.eq((await get(job.jobId)).status,409,'stale source withheld after correction')
  h.eq((await h.db.query('SELECT to_jsonb(p) row FROM publication_snapshots p WHERE id=$1',[job.jobId])).rows[0].row,snapshotRow,'correction preserves approved publication history')
  const newer=await route.POST(request(),{params:Promise.resolve({id:project})});h.eq(newer.status,202,'corrected publication queued');const next=await newer.json();h.eq(next.snapshotVersion,2,'approval creates version two')
  h.eq((await worker.runPublicationDeliveryWorker({admin:db.admin})).outcome,'ready','new publication completes')
  const deletion=randomUUID();h.eq((await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,project,story,deletion])).sqlstate,'00000','G1 deletion revokes and erases both publications')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE project_id=$1',[project])).rows[0].n,0,'all containing snapshots erased')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_delivery_jobs WHERE project_id=$1',[project])).rows[0].n,0,'job identities erased with snapshots')
  h.ok((await get(next.jobId)).status>=400,'post-deletion download blocked')
  await worker.reconcilePublicationArtifacts(db.admin)
  h.eq(await stat(join(spool,job.jobId)).then(()=>true,()=>false),false,'first spool file physically erased')
  h.eq(await stat(join(spool,next.jobId)).then(()=>true,()=>false),false,'second spool file physically erased')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_artifact_cleanup')).rows[0].n,0,'durable cleanup acknowledged')
  const status=await statusRoute.GET(new NextRequest('http://localhost/status',{headers:{Authorization:`Bearer ${owner}`}}),{params:Promise.resolve({id:project,jobId:next.jobId})});h.ok(status.status>=400,'deleted job status withholds content')
  // Actual >25 MiB WAV and >500 source rows cross both old request limits.
  const largeProject=randomUUID(),largeStory=randomUUID(),audioId=randomUUID()
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)',[largeProject,'Large durable family',owner])
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)',[largeStory,largeProject,owner,'First original','Large original transcript'])
  await h.db.query("INSERT INTO stories(project_id,user_id,title,transcript) SELECT $1,$2,'Memory '||g,'Source-only memory '||g FROM generate_series(1,500) g",[largeProject,owner])
  const audio=Buffer.alloc(27*1024*1024+44);audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(16000,24);audio.writeUInt32LE(32000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40)
  const audioHash=createHash('sha256').update(audio).digest('hex'),audioKey=`${owner}/projects/${largeProject}/long.wav`
  await h.db.query("INSERT INTO media_assets(id,project_id,story_id,kind,bucket,object_key,original_filename,mime_type,byte_size,sha256,state,version,created_by) VALUES($1,$2,$3,'original_audio','audio-recordings',$4,'long.wav','audio/wav',$5,$6,'ready',1,$7)",[audioId,largeProject,largeStory,audioKey,audio.length,audioHash,owner])
  db.objects.set('audio-recordings/'+audioKey,{bytes:Buffer.from('damaged'),type:'audio/wav'})
  const largeResponse=await route.POST(new NextRequest('http://localhost/export',{method:'POST',headers:{Authorization:`Bearer ${owner}`}}),{params:Promise.resolve({id:largeProject})})
  h.eq(largeResponse.status,202,'sync overflow automatically queues large archive');const large=await largeResponse.json()
  h.eq((await worker.runPublicationDeliveryWorker({admin:db.admin})).outcome,'failed','corrupt large original fails without partial publication')
  h.eq((await h.db.query('SELECT count(*)::int n FROM publication_snapshots WHERE project_id=$1',[largeProject])).rows[0].n,0,'failed attempt publishes nothing')
  db.objects.set('audio-recordings/'+audioKey,{bytes:audio,type:'audio/wav'})
  const largeParams={params:Promise.resolve({id:largeProject,jobId:large.jobId})}
  h.eq((await statusRoute.POST(new NextRequest('http://localhost/retry',{method:'POST',headers:{Authorization:`Bearer ${owner}`}}),largeParams)).status,200,'failed durable job can be retried')
  const claim=async()=>{const r=await h.actor('service_role',owner,'SELECT publication_delivery($1,$2,$3,$4,$5::jsonb) r',[owner,largeProject,'claim',large.jobId,'{}']);h.eq(r.sqlstate,'00000','lease claim');return r.rows[0].r}
  const firstClaim=await claim();h.eq(firstClaim.claimed,true,'worker obtains lease');h.eq((await claim()).claimed,false,'second worker cannot reuse live lease')
  await h.db.query("UPDATE publication_delivery_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[large.jobId])
  h.eq((await worker.runPublicationDeliveryWorker({admin:db.admin})).outcome,'ready','expired worker lease recovers on another process invocation')
  const largeJob=(await h.db.query('SELECT * FROM publication_delivery_jobs WHERE id=$1',[large.jobId])).rows[0]
  h.eq(largeJob.attempt,3,'corrupt, crashed and recovered attempts are durable')
  const largeDownload=()=>download.GET(new NextRequest('http://localhost/large-download',{headers:{Authorization:`Bearer ${owner}`}}),largeParams)
  const complete=await largeDownload();h.eq(complete.status,200,'large protected archive ready')
  const largeZip=await JSZip.loadAsync(Buffer.from(await complete.arrayBuffer()),{checkCRC32:true})
  h.eq(createHash('sha256').update(await largeZip.file(`media/${audioId}/long.wav`).async('nodebuffer')).digest('hex'),audioHash,'all 27 MiB original bytes preserved')
  h.eq(JSON.parse(await largeZip.file('sources-and-revisions.json').async('string')).length,501,'pagination contains every one of 501 stories')
  const archivePath=worker.publicationArtifactPath(largeJob),savedPath=archivePath+'.saved';await rename(archivePath,savedPath);await symlink(savedPath,archivePath)
  h.eq((await largeDownload()).status,409,'nested artifact symlink rejected');await unlink(archivePath);await rename(savedPath,archivePath)
  const erase=randomUUID();const erased=await h.actor('service_role',owner,'SELECT request_story_deletion($1,$2,$3,$4)',[owner,largeProject,largeStory,erase]);if(erased.sqlstate!=='00000'){try{await h.db.query('SELECT request_story_deletion($1,$2,$3,$4)',[owner,largeProject,largeStory,erase])}catch(error){h.report.archiveEraseDebug={code:error.code,message:error.message,where:error.where}}}h.eq(erased.sqlstate,'00000','G1 erasure invalidates large archive')
  await worker.reconcilePublicationArtifacts(db.admin)
  h.eq(await stat(join(spool,large.jobId)).then(()=>true,()=>false),false,'large artifact physically erased')
  h.report.archive={status:'passed',project,story,snapshotId:job.jobId,secondSnapshotId:next.jobId,pdfPages:text.split('\f').length-1,zipBytes:zipBytes.length,evidence:archiveEvidence}
 }finally{
  await writeFile(join(archiveEvidence,'transport.json'),JSON.stringify(db.requests,null,2))
  await db.close();delete globalThis.__g3ArchiveAdmin
  if(oldFlag===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=oldFlag
  if(oldSpool===undefined)delete process.env.ARCHIVE_SPOOL_DIR;else process.env.ARCHIVE_SPOOL_DIR=oldSpool
 }
}
