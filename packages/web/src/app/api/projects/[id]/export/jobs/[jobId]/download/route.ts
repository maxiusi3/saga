import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { publicationOperation } from '@/lib/server/publication-delivery-service'
import { publicationArtifactPath } from '@/lib/server/publication-delivery-worker'
import { ArchiveSourceError } from '@/lib/server/publication-source-service'
export const runtime='nodejs'
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;jobId:string}>}) {
 const auth=await getAuthenticatedUser(request)
 if(!auth.ok) {auth.response.headers.set('Cache-Control','no-store');return auth.response}
 const headers=new Headers(auth.headers);headers.set('Cache-Control','no-store')
 const {id,jobId}=await params
 const access=await requireProjectAccess(id,auth.user)
 if(!access.ok)return NextResponse.json({error:'Publication access denied'},{status:access.response.status,headers})
 try {
  const admin=getSupabaseAdmin(),job=await publicationOperation(admin,auth.user.id,id,'status',jobId)
  if(job.status!=='ready') throw new ArchiveSourceError(409,'Archive is not ready')
  const path=publicationArtifactPath(job),file=await stat(path)
  if(!file.isFile() || file.size!==job.byte_size) throw new ArchiveSourceError(409,'Archive integrity failed')
  const hash=createHash('sha256')
  for await(const chunk of createReadStream(path)){if(request.signal.aborted)throw new Error('Download cancelled');hash.update(chunk)}
  if(hash.digest('hex')!==job.zip_sha256)throw new ArchiveSourceError(409,'Archive integrity failed')
  // Membership, authoritative source identity and tombstones checked after IO.
  await publicationOperation(admin,auth.user.id,id,'validate',jobId)
  if(request.signal.aborted)throw new Error('Download cancelled')
  headers.set('Content-Type','application/zip');headers.set('Content-Length',String(file.size))
  headers.set('Content-Disposition',`attachment; filename="family-publication-v${job.snapshot_version}.zip"`)
  return new NextResponse(Readable.toWeb(createReadStream(path,{signal:request.signal})) as ReadableStream<Uint8Array>,{headers})
 }catch(error){return NextResponse.json({error:'Publication download unavailable'},{status:error instanceof ArchiveSourceError?error.status:503,headers})}
}
