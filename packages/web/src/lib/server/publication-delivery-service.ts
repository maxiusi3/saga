import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicationDeliveryStatus } from '@saga/shared/types/export'
import { ArchiveSourceError, type ArchiveSource } from '@/lib/server/publication-source-service'

export interface PublicationJob {
 claimed?:boolean;id:string;project_id:string;actor_id:string;source_sha256:string;snapshot_version:number;
 status:PublicationDeliveryStatus['status'];attempt:number;lease_token:string|null;lease_until:string|null;
 source_subjects:string[];error_code:string|null;byte_size:number|null;zip_sha256:string|null;created_at:string
}
export async function publicationOperation(admin:SupabaseClient,actor:string,project:string,operation:string,job:string|null=null,payload:unknown={}):Promise<PublicationJob> {
 const {data,error}=await admin.rpc('publication_delivery',{p_actor:actor,p_project:project,p_operation:operation,p_job:job,p_payload:payload})
 if(error || !data || typeof data.id!=='string') throw new ArchiveSourceError(error?.code==='42501'?403:error?.code==='P0002'?404:error?.code==='23505'?409:503,'Publication delivery is unavailable or its source changed')
 return data as PublicationJob
}
export function preparePublication(admin:SupabaseClient,actor:string,source:ArchiveSource) {
 return publicationOperation(admin,actor,source.project.id,'prepare',null,{source:source.identity,subjects:source.subjects})
}
export function publicationStatus(job:PublicationJob):PublicationDeliveryStatus {
 const base=`/api/projects/${job.project_id}/export/jobs/${job.id}`
 return {jobId:job.id,snapshotId:job.id,snapshotVersion:job.snapshot_version,status:job.status,attempt:job.attempt,errorCode:job.error_code,statusUrl:base,downloadUrl:`${base}/download`}
}
