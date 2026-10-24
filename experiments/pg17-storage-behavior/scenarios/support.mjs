import { digest } from '../../pg17-routines/runtime.mjs'

export const generationA='10000000-0000-4000-8000-000000000001'
export const generationB='10000000-0000-4000-8000-000000000002'
export const configA={rules:[{synthetic:'a'}]}
export const configB={rules:[{synthetic:'b'}]}
export async function state(h) {
  return (await h.db.query(`SELECT
    (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') FROM storage.buckets b) AS buckets,
    (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY id),'[]') FROM storage.objects o) AS objects`)).rows[0]
}
const functions=['protect_delete','protect_bucket_control_columns','enforce_bucket_lifecycle_service_role','enforce_bucket_name_length']
function classify(e) {
  const fn=functions.find(n=>(e.where??'').includes('function '+n+'(')||(e.where??'').includes('function storage.'+n+'('))
  // The AFTER trigger deliberately supplies a CONSTRAINT diagnostic field;
  // it does not make PST01 a table CHECK violation. Context takes precedence.
  if(fn)return {layer:'trigger',function:fn,...(e.constraint==='protect_bucket_control_update_role'?{triggerDiagnostic:e.constraint}:{})}
  if(e.constraint) return {layer:'table_constraint',constraint:e.constraint}
  if(/row-level security/i.test(e.message??''))return {layer:'rls'}
  if(e.code==='22P02')return {layer:'type_input'}
  if(e.code==='23502')return {layer:'not_null'}
  return {layer:'other'}
}
export async function withActor(h,alias,fn) {
  const c=await h.client(h.roles[alias])
  try {
    await c.query("SET timezone='UTC'")
    const r=(await c.query('SELECT current_user,session_user,rolsuper,rolbypassrls,pg_has_role(current_user,$1,\'MEMBER\') AS member FROM pg_roles WHERE rolname=current_user',[h.roles.R])).rows[0]
    h.eq([r.current_user,r.session_user],[h.roles[alias],h.roles[alias]],'actual connection identity '+alias)
    const observed={alias,superuser:r.rolsuper,bypassRls:r.rolbypassrls,memberOfR:r.member,exactR:r.current_user===h.roles.R}
    if(!h.report.actorConnections.some(x=>x.alias===alias))h.report.actorConnections.push(observed)
    await fn(c,observed)
  } finally {await h.close(c)}
}
export async function attempt(h,{label,actor='ordinary',sql,values=[],expected='00000',layer,fn,constraint,rowCount=1,guc,client}) {
  const before=await state(h)
  const observation={label,actor,expectedSqlstate:expected,expectedRowCount:expected==='00000'?rowCount:null}
  const execute=async c=>{
    if(guc!==undefined)await c.query("SELECT set_config('storage.allow_delete_query',$1,false)",[guc])
    try {
      const r=await c.query(sql,values)
      observation.sqlstate='00000';observation.rowCount=r.rowCount
    } catch(e) {
      h.check()
      observation.sqlstate=/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'QUERY_FAILED'
      Object.assign(observation,classify(e));observation.rowCount=null
    }
  }
  if(client)await execute(client);else await withActor(h,actor,execute)
  const after=await state(h)
  observation.beforeSha256=digest(JSON.stringify(before));observation.afterSha256=digest(JSON.stringify(after))
  observation.completeStateUnchanged=JSON.stringify(before)===JSON.stringify(after)
  h.report.observations.push(observation)
  h.eq(observation.sqlstate,expected,label+' SQLSTATE')
  if(expected==='00000') {
    h.eq(observation.rowCount,rowCount,label+' rowCount')
    if(rowCount===0)h.eq(after,before,label+' successful zero-row statement preserves complete state')
  }
  else {
    h.eq(after,before,label+' failed statement preserves complete buckets and objects rows')
    if(layer)h.eq(observation.layer,layer,label+' source layer')
    if(fn)h.eq(observation.function,fn,label+' source function')
    if(constraint)h.eq(observation.constraint,constraint,label+' constraint')
  }
  return observation
}
export async function bucket(h,id,{type='STANDARD',configuration=null,generation=null,name=id}={}) {
  await withActor(h,'R',async c=>{await c.query('INSERT INTO storage.buckets(id,name,type,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$2,$3,$4,$5)',[id,name,type,configuration,generation])})
}
export async function row(h,id,table='buckets') {
  return (await h.db.query(`SELECT to_jsonb(t) AS row FROM storage.${table} t WHERE id=$1`,[id])).rows[0]?.row??null
}
