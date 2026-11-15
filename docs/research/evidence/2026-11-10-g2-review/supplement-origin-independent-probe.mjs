// Run from repository root. Replay the cross-actor attribution regression using
// the complete native migration harness, without altering product/fixture code.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = process.cwd()
let code = await readFile(resolve(root, 'experiments/g1-local/verify-migrations.mjs'), 'utf8')
for (const [relative, absolute] of [
  ['../pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime.mjs'],
  ['../pg17-story-deletion/scenarios.mjs', 'experiments/pg17-story-deletion/scenarios.mjs'],
  ['../pg17-g2-review/scenarios.mjs', 'experiments/pg17-g2-review/scenarios.mjs'],
]) code = code.replaceAll(`'${relative}'`, JSON.stringify(pathToFileURL(resolve(root, absolute)).href))
const probe = String.raw`
 const owner=randomUUID(),author=randomUUID(),reviewer=randomUUID(),project=randomUUID(),story=randomUUID()
 report.independentSupplementOrigin=[]
 for(const [id,name] of [[owner,'owner'],[author,'author'],[reviewer,'reviewer']])await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,name+'-supplement@example.invalid'])
 await h.db.query("INSERT INTO projects(id,name,facilitator_id) VALUES($1,'Cross-actor supplement',$2)",[project,owner])
 for(const id of [author,reviewer])await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'storyteller','active')",[project,id])
 await h.db.query("INSERT INTO stories(id,project_id,user_id,transcript) VALUES($1,$2,$3,'John planted the tree.')",[story,project,owner])
 const call=async(actor,operation,version=null,payload={})=>{
   const result=await h.actor('service_role',actor,'SELECT story_review($1,$2,$3,$4,$5,$6::jsonb) AS r',[actor,story,operation,randomUUID(),version,JSON.stringify(payload)])
   h.eq(result.sqlstate,'00000','independent attributed '+operation);return result.rows[0].r
 }
 let state=await call(owner,'prepare')
 const decide=async(actor,action,text)=>{state=await call(actor,'decide_assertion',state.revision.edit_version,{revision_id:state.revision.id,assertion_id:state.assertions[0].id,action,...(text===undefined?{}:{text})})}
 await decide(author,'modify','John planted an oak tree, as I remember.')
 await decide(reviewer,'dispute','I remember an apple tree.')
 h.eq(state.assertions[0].memory_attribution,'family_supplement','dispute preserves primary supplement source')
 h.eq(state.assertions[0].reviewed_by,reviewer,'dispute records actual latest reviewer')
 h.ok(state.revision.body.includes('[Family supplement: '+author+']'),'dispute retains original supplement author')
 h.ok(state.revision.body.includes('[Alternative: '+reviewer+']'),'alternative has its own author')
 await decide(owner,'accept')
 h.eq(state.assertions[0].reviewed_by,owner,'accept records latest reviewer independently')
 state=await call(owner,'approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
 h.ok(state.revision.body.includes('[Family supplement: '+author+']'),'approved supplement still names original author')
 h.ok(!state.revision.body.includes('[Family supplement: '+owner+']'),'approver does not become author')
 report.independentSupplementOrigin.push({case:'modify_dispute_accept_approve',author,reviewer,approver:owner,body:state.revision.body,status:state.revision.status})
 const approvedId=state.revision.id,approvedBody=state.revision.body
 state=await call(author,'correct_transcript',state.revision.edit_version,{revision_id:state.revision.id,text:'I checked my album: John planted an oak tree.'})
 await decide(reviewer,'dispute','My album shows an apple tree.')
 h.eq(state.assertions[0].memory_attribution,'family_supplement','human corrected primary remains attributed supplement')
 h.eq(state.assertions[0].reviewed_by,reviewer,'corrected draft stores latest reviewer')
 state=await call(owner,'approve_revision',state.revision.edit_version,{revision_id:state.revision.id})
 h.ok(state.revision.body.includes('[Family supplement: '+author+']'),'corrected transcript preserves correcting author')
 h.ok(state.revision.body.includes('[Alternative: '+reviewer+']'),'corrected alternative retains separate author')
 h.eq((await h.db.query('SELECT body FROM story_revisions WHERE id=$1',[approvedId])).rows[0].body,approvedBody,'original approved rendition untouched')
 report.independentSupplementOrigin.push({case:'correction_dispute_approve',author,reviewer,approver:owner,body:state.revision.body,status:state.revision.status})
 h.eq((await h.db.query('SELECT count(*)::int n FROM story_review_context')).rows[0].n,0,'independent source capability cleaned up')
`
code = code.replace("  report.status = 'passed'", probe + "\n  report.status = 'passed'")
await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
