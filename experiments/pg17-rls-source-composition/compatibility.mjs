import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root,digest } from '../pg17-routines/runtime.mjs'

// SQL adapters affect frozen test statements only, never ledger implementation SQL.
export const adaptations = [
  ['rls_projects_columns','INSERT INTO public.projects VALUES ($1,$2,$3),($4,$5,$6)','INSERT INTO public.projects(id,name,facilitator_id) VALUES ($1,$2,$3),($4,$5,$6)'],
  ['rls_roles_columns','INSERT INTO public.project_roles VALUES ($1,$2,$3,$4,$5)','INSERT INTO public.project_roles(id,project_id,user_id,role,status) VALUES ($1,$2,$3,$4,$5)'],
  ['ledger_project_name','INSERT INTO projects(id,facilitator_id) VALUES ($1,$3),($2,$4)',"INSERT INTO projects(id,facilitator_id,name) VALUES ($1,$3,'Synthetic A'),($2,$4,'Synthetic B')"],
  ['ledger_roles_columns',`INSERT INTO project_roles VALUES
    ('40000000-0000-4000-8000-000000000001',$1,$2,'storyteller','active'),
    ('40000000-0000-4000-8000-000000000002',$3,$4,'storyteller','active')`,`INSERT INTO project_roles(id,project_id,user_id,role,status) VALUES
    ('40000000-0000-4000-8000-000000000001',$1,$2,'storyteller','active'),
    ('40000000-0000-4000-8000-000000000002',$3,$4,'storyteller','active')`],
  ['story_hash_excludes_only_updated_at','SELECT md5(row_to_json(s)::text) AS hash FROM stories s WHERE id=$1',"SELECT md5((to_jsonb(s)-'updated_at')::text) AS hash FROM stories s WHERE id=$1"],
  ['storage_partial_conflict_target',"INSERT INTO storage.objects(id,bucket_id,name,owner,metadata) VALUES ($1,$2,$3,$4,'{}') ON CONFLICT(bucket_id,name) DO UPDATE SET metadata='{}' RETURNING id",`INSERT INTO storage.objects(id,bucket_id,name,owner,metadata) VALUES ($1,$2,$3,$4,'{}') ON CONFLICT(bucket_id,name COLLATE "C") WHERE archived_at IS NULL DO UPDATE SET metadata='{}' RETURNING id`]
]
export async function validateAdaptations(h) {
  const sources=await Promise.all(['experiments/rls-rehearsal/scenarios.mjs','experiments/t02-source-ledger/scenarios.cjs'].map(f=>readFile(join(root,f),'utf8')))
  h.report.compatibility=adaptations.map(([id,from,to])=>{
    const occurrences=sources.map(s=>s.split(from).length-1).reduce((a,b)=>a+b)
    h.eq(occurrences,id==='rls_roles_columns'?2:1,'exact frozen statement occurrences '+id)
    return {id,from,to,fromSha256:digest(from),toSha256:digest(to),sourceOccurrences:occurrences,uses:0}
  })
}
export function adaptSql(h,sql) {
  const i=adaptations.findIndex(([,from])=>from===sql)
  if(i<0)return sql
  h.report.compatibility[i].uses++
  return adaptations[i][2]
}
export function adaptedClient(h,c) {
  return new Proxy(c,{get(target,key){
    if(key==='query')return (sql,...args)=>target.query(adaptSql(h,sql),...args)
    const value=Reflect.get(target,key,target)
    return typeof value==='function'?value.bind(target):value
  }})
}
export async function rlsCandidate(h) {
  const original=await readFile(join(root,'experiments/rls-rehearsal/candidate.sql'),'utf8')
  const from="current_database() <> 'saga_rls_rehearsal'",to="current_database() <> 'saga_pg17_rehearsal'"
  h.eq(original.split(from).length,2,'one exact local database name guard')
  const derived=original.replace(from,to)
  h.report.rlsCandidateDerivation={originalSha256:digest(original),derivedSha256:digest(derived),from,to,replacements:1}
  return derived
}
