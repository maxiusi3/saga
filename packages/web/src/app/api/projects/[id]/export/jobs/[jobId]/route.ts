import { NextRequest,NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireProjectAccess } from '@/lib/server/project-access'
import { getSupabaseAdmin } from '@/lib/supabase'
import { publicationOperation,publicationStatus } from '@/lib/server/publication-delivery-service'
import { ArchiveSourceError } from '@/lib/server/publication-source-service'
export const runtime='nodejs'
async function handle(request:NextRequest,params:Promise<{id:string;jobId:string}>,operation:string) {
 const auth=await getAuthenticatedUser(request)
 if(!auth.ok) {auth.response.headers.set('Cache-Control','no-store');return auth.response}
 const headers=new Headers(auth.headers);headers.set('Cache-Control','no-store')
 const {id,jobId}=await params
 const access=await requireProjectAccess(id,auth.user)
 if(!access.ok) return NextResponse.json({error:'Publication access denied'},{status:access.response.status,headers})
 try {return NextResponse.json(publicationStatus(await publicationOperation(getSupabaseAdmin(),auth.user.id,id,operation,jobId)),{headers})}
 catch(error) {return NextResponse.json({error:'Publication delivery unavailable'},{status:error instanceof ArchiveSourceError?error.status:503,headers})}
}
export function GET(request:NextRequest,{params}:{params:Promise<{id:string;jobId:string}>}) {return handle(request,params,'status')}
export function POST(request:NextRequest,{params}:{params:Promise<{id:string;jobId:string}>}) {return handle(request,params,'retry')}
