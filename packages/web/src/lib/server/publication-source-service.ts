import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArchivalStoryInput } from '@/lib/server/archival-export-service'
import { planLegacyStoryMedia } from '@/lib/legacy-story-media'
import type { ExportableMediaAsset } from '@/lib/server/media-export'
import { recordingAssetDeletionSubjects } from '@/lib/server/recording-asset-lineage'

type ArchiveStoryRow = Record<string, unknown> & ArchivalStoryInput & {tombstone_at?:string|null}
interface ArchiveAssetRow extends ExportableMediaAsset {project_id:string;tombstone_at?:string|null}
interface TombstoneRow {subject_id:string}
interface TranscriptSourceRow {id:string;project_id:string;story_id:string;asset_id:string|null;provider?:string;model?:string;alignment_status?:string;full_text?:string}
export class ArchiveSourceError extends Error { constructor(public status:number,message:string){super(message)} }
export const synchronousArchiveLimits={stories:200,assets:100,versions:1000,mediaBytes:25*1024*1024,metadataBytes:2*1024*1024}
export const durableArchiveLimits={stories:2000,assets:5000,versions:10000,mediaBytes:2*1024*1024*1024,metadataBytes:16*1024*1024}
async function allRows(factory:()=>ReturnType<ReturnType<SupabaseClient['from']>['select']>,cap:number) {
 const rows: NonNullable<Awaited<ReturnType<typeof factory>>['data']>=[];let count:number|null=null
 for(let offset=0;offset<=cap;offset+=500) {
  const result=await factory().range(offset,Math.min(offset+499,cap))
  if(result.error || !Array.isArray(result.data) || result.count==null) return result
  if(count!=null && count!==result.count) return {data:null,error:new Error('Archive changed during pagination'),count:null}
  count=result.count;rows.push(...result.data)
  if(new Set(rows.map(row=>(row as Record<string,unknown>).id)).size!==rows.length) return {data:null,error:new Error('Duplicate archive source page'),count:null}
  if(rows.length>=count || rows.length>cap || result.data.length===0) break
 }
 return {data:rows,error:null,count}
}
export async function loadArchiveSource(admin:SupabaseClient,projectId:string,limits=synchronousArchiveLimits) {
    const { data: project, error: projectError } = await admin.from('projects')
      .select('id, name, description, facilitator_id').eq('id', projectId).maybeSingle()
    if (projectError) throw new ArchiveSourceError(500, 'Failed to load project')
    if (!project) throw new ArchiveSourceError(404, 'Project not found')

    const storyResult = await allRows(()=>admin.from('stories').select('*', { count: 'exact' })
      .eq('project_id', projectId).order('created_at', { ascending: true }).order('id'),limits.stories)
    const assetResult = await allRows(()=>admin.from('media_assets').select('*', { count: 'exact' })
      .eq('project_id', projectId).order('created_at', { ascending: true }).order('id'),limits.assets)
    const deletionResult = await admin.from('deletion_requests')
      .select('subject_id, tombstone_at', { count: 'exact' }).eq('project_id', projectId).not('tombstone_at', 'is', null)
    if (storyResult.error || assetResult.error || deletionResult.error ||
        !Array.isArray(storyResult.data) || !Array.isArray(assetResult.data) || !Array.isArray(deletionResult.data) ||
        deletionResult.count == null || deletionResult.count !== deletionResult.data.length) {
      throw new ArchiveSourceError(500, 'Failed to load complete archive and deletion evidence')
    }
    if ((storyResult.count ?? storyResult.data.length) > limits.stories || storyResult.data.length > limits.stories ||
        (assetResult.count ?? assetResult.data.length) > limits.assets || assetResult.data.length > limits.assets ||
        Buffer.byteLength(JSON.stringify([project, storyResult.data, assetResult.data])) > limits.metadataBytes) {
      throw new ArchiveSourceError(413, 'Archive exceeds synchronous limits; larger exports are not available yet')
    }
    if (storyResult.count == null || storyResult.count !== storyResult.data.length ||
        assetResult.count == null || assetResult.count !== assetResult.data.length) {
      throw new ArchiveSourceError(500, 'Failed to load the complete archive')
    }

    const storyRows = storyResult.data as ArchiveStoryRow[]
    const assetRows = assetResult.data as ArchiveAssetRow[]
    const tombstones = new Set<string>((deletionResult.data as TombstoneRow[]).map(row => row.subject_id))
    if (tombstones.has(projectId)) throw new ArchiveSourceError(409, 'Archive changed during export; please retry')
    const sessionsByAsset = new Map<string, readonly string[]>()
    // Resolve even removed pointers: corrupt provenance must not become an unrelated omission.
    for (const asset of assetRows) sessionsByAsset.set(asset.id, await recordingAssetDeletionSubjects(admin, asset))
    for (const story of storyRows) if (story.tombstone_at != null) tombstones.add(story.id)
    const stories = storyRows.filter(story => !tombstones.has(story.id) && story.status!=='deleted')
    const removed = (asset: ArchiveAssetRow) => asset.tombstone_at != null || ['deleted', 'deleting'].includes(asset.state) ||
      tombstones.has(asset.id) || (!!asset.story_id && tombstones.has(asset.story_id)) ||
      (sessionsByAsset.get(asset.id) ?? []).some(session => tombstones.has(session))
    const assets = assetRows.filter(asset => !removed(asset))
    if (assets.some(asset => asset.state !== 'ready' || typeof asset.byte_size !== 'number' || !Number.isSafeInteger(asset.byte_size) || asset.byte_size < 0 ||
        typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.sha256))) {
      throw new ArchiveSourceError(409, 'Media assets are incomplete and cannot be exported')
    }
    if (assets.reduce((total, asset) => total + (asset.byte_size ?? 0), 0) > limits.mediaBytes) {
      throw new ArchiveSourceError(413, 'Archive exceeds synchronous limits; larger exports are not available yet')
    }

    const storyIds = stories.map(story => story.id)
    const sources = storyIds.length ? await allRows(()=>{const query=admin.from('transcript_versions')
      .select('*', { count: 'exact' }).eq('project_id', projectId).order('id')
      return storyIds.length<=100 ? query.in('story_id',storyIds) : query
    },limits.versions)
      : { data: [], error: null, count: 0 }
    if (sources.error || !Array.isArray(sources.data) || sources.count == null || sources.count !== sources.data.length) {
      throw new ArchiveSourceError(500, 'Failed to verify complete transcript lineage')
    }
    if (sources.count > limits.versions || Buffer.byteLength(JSON.stringify(sources.data)) > limits.metadataBytes) {
      throw new ArchiveSourceError(413, 'Archive lineage exceeds synchronous limits')
    }
    if((sources.data as TranscriptSourceRow[]).some(source=>source.project_id!==projectId || !storyRows.some(story=>story.id===source.story_id))) throw new ArchiveSourceError(409,'Transcript source scope is invalid')
    sources.data=(sources.data as TranscriptSourceRow[]).filter((source:TranscriptSourceRow)=>storyIds.includes(source.story_id))
    // stories.transcript/summary do not identify which revision supplied their
    // text. Fail closed if any established audio source is removed/unresolved;
    // deleting an unrelated photo must not remove independently sourced text.
    const unsafeLineage = (sources.data as TranscriptSourceRow[]).some(source => {
      if(source.asset_id == null && ((source.provider==='legacy' && source.model==='imported-text' && source.alignment_status==='legacy_unaligned') || (source.provider==='human' && source.model==='family-correction' && source.alignment_status==='human_corrected'))) return false
      const original = assetRows.find(asset => asset.id === source.asset_id)
      return source.project_id !== projectId || !storyIds.includes(source.story_id) ||
        !original || original.project_id !== projectId || original.kind !== 'original_audio' ||
        (!!original.story_id && original.story_id !== source.story_id) || removed(original)
    })
    const removedLegacyAudio = assetRows.some(asset => asset.kind === 'original_audio' &&
      !!asset.story_id && storyIds.includes(asset.story_id) && removed(asset))
    if (unsafeLineage || removedLegacyAudio) {
      throw new ArchiveSourceError(409, 'Story sources were removed or could not be verified; export is blocked')
    }

    let verifiedStorageHost: string | undefined
    try { verifiedStorageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch { /* Exact local keys can still be matched. */ }
    for (const story of stories) {
      const plan = planLegacyStoryMedia(story, {
        verifiedStorageHost,
        verifiedBucketsByField: { audio_url: 'audio-recordings', mastered_audio_url: 'audio-recordings', photo_url: 'saga', photo_urls: 'saga', images: 'saga' },
      })
      for (const reference of plan.references) {
        if (reference.rawValue == null || reference.rawValue === '') continue
        // Recording confirmation stores a same-origin playback route. Resolve
        // that exact identity against the already checked asset/lineage rows;
        // never fetch the route or interpret it as a Storage object key.
        const playbackMatches = reference.sourceField === 'audio_url' ? assetRows.filter(asset =>
          reference.rawValue === `/api/media/assets/${asset.id}/play` &&
          asset.project_id === projectId && asset.story_id === story.id && asset.kind === 'original_audio',
        ) : []
        const matches = playbackMatches.length ? playbackMatches : reference.locator.status === 'mapped' ? assetRows.filter(asset =>
          asset.story_id === story.id && asset.bucket === reference.locator.bucket &&
          asset.object_key === reference.locator.objectKey && asset.kind === reference.kind,
        ) : []
        // A basename, unrelated story asset, or signed URL on another host is
        // not proof of representation. Deleted references are intentionally omitted.
        if (matches.length !== 1 || (!removed(matches[0]) && !assets.includes(matches[0]))) {
          throw new ArchiveSourceError(409, 'Legacy media must be reconciled before a complete export')
        }
      }
    }


    const revisionsResult = await allRows(()=>admin.from('story_revisions').select('*',{count:'exact'}).eq('project_id',projectId).order('revision_number',{ascending:true}).order('id'),limits.versions)
    if(revisionsResult.error || !Array.isArray(revisionsResult.data) || revisionsResult.count!==revisionsResult.data.length) throw new ArchiveSourceError(500,'Failed to load complete revision history')
    if(revisionsResult.data.length>limits.versions || Buffer.byteLength(JSON.stringify(revisionsResult.data))>limits.metadataBytes) throw new ArchiveSourceError(413,'Archive revision history exceeds limits')
    const revisions = revisionsResult.data as Array<{id:string;story_id:string;status:string;approved_at:string|null;source_hash:string|null;transcript_version_id:string;title:string;summary:string;body:string;revision_number:number;provenance_snapshot:{assertions?:unknown[]}}>
    const rendition:ArchivalStoryInput[] = stories.map(story=>{
      const history=revisions.filter(revision=>revision.story_id===story.id)
      const approved=history.filter(revision=>revision.status==='approved' && revision.approved_at && revision.source_hash).at(-1)
      if(history.length && !approved) throw new ArchiveSourceError(409,'Reviewed story has no approved rendition')
      if(approved && !(sources.data as TranscriptSourceRow[]).some(source=>source.id===approved.transcript_version_id && source.story_id===story.id)) throw new ArchiveSourceError(409,'Approved source cannot be resolved')
      return {id:story.id,title:approved?.title ?? story.title,summary:approved?.summary ?? null,
        transcript:approved?.body ?? story.transcript,rawTranscript:approved ? (sources.data as TranscriptSourceRow[]).find(source=>source.id===approved.transcript_version_id)?.full_text ?? story.transcript : story.transcript,
        rendition:approved?'approved':'source_only',revisionId:approved?.id ?? null,revisionVersion:approved?.revision_number ?? null,
        sourceTranscriptId:approved?.transcript_version_id ?? null,created_at:story.created_at,
        assertions:approved?.provenance_snapshot?.assertions ?? [],
        sourceTranscripts:(sources.data as TranscriptSourceRow[]).filter(source=>source.story_id===story.id),
        provenanceNotes:approved ? [`Approved source transcript: ${approved.transcript_version_id}`] : ['Imported source only; no approved biography']}
    })
    const subjects=[...new Set([projectId,...stories.map(story=>story.id),...assets.map(asset=>asset.id),...assets.flatMap(asset=>[...sessionsByAsset.get(asset.id) ?? []])])]
    const identity={project,stories:storyRows,assets:assetRows,transcripts:sources.data,revisions,tombstones:deletionResult.data}
    if(Buffer.byteLength(JSON.stringify(identity))>limits.metadataBytes) throw new ArchiveSourceError(413,'Archive metadata exceeds limits')
    return {project,stories:rendition,assets,subjects,identity}
}
export type ArchiveSource = Awaited<ReturnType<typeof loadArchiveSource>>
