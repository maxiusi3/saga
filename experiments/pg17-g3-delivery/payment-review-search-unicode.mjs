import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {compileModule} from '../g1-local/compile-module.mjs'
import {root,digest} from '../pg17-routines/runtime.mjs'
const dir=await mkdtemp('/tmp/saga-search-review-'),sources={}
try{
 const seam=join(dir,'db.cjs'),id='11111111-1111-4111-8111-111111111111'
 const row={entryId:'segment:'+id,projectId:id,storyId:id,storyTitle:'😀'.repeat(300),quotedText:'A source',transcriptVersionId:id,storyRevisionId:null,segmentId:id,mediaAssetId:null,attributedTo:null,sourceKind:'original_transcript',reviewStatus:'source_only',sourceHash:'a'.repeat(64),sourceFingerprint:'b'.repeat(64),excerptStart:0,excerptEnd:8,startMs:null,endMs:null}
 await writeFile(seam,'exports.getSupabaseAdmin=()=>({rpc:async()=>({data:{entries:['+JSON.stringify(row)+'],hasMore:false},error:null})});')
 const source=async p=>{const b=await readFile(join(root,p));sources[p]=digest(b);return b.toString()}
 const mod=await compileModule('lib/server/authoritative-search.ts',dir,source,{'@/lib/supabase':seam})
 let observed;try{await mod.searchAuthoritativeSources(id,id,{query:'source'});observed='accepted'}catch(e){observed={status:e.status,message:e.message}}
 console.log(JSON.stringify({case:'SQL left(title,500) admits 300 Unicode scalar characters but response validator counts 600 UTF-16 code units',characters:Array.from(row.storyTitle).length,codeUnits:row.storyTitle.length,observed,sources},null,2))
}finally{await rm(dir,{recursive:true,force:true})}
