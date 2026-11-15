import { createRequire } from 'node:module'
import { posix } from 'node:path'
import { USER } from './fixture.mjs'
const require=createRequire(import.meta.url),ts=require('typescript')

// Actual seal route and dependencies; only auth/access and PostgREST transport
// are supplied for the synthetic local service-role session. Mutation calls
// deliberately throw: the tombstone must reject before registrar entry.
export async function blockedRegistration(h,source,service,f) {
  const calls=[],cache=new Map(),admin={from(table){
    h.ok(['project_roles','stories','deletion_requests'].includes(table),'registration stops before any asset/job access')
    const clauses=[],values=[];let columns='*'
    const execute=async(single=false)=>{
      calls.push({table,columns,clauses,values})
      try {const rows=(await service.query(`SELECT ${columns} FROM public.${table} WHERE ${clauses.join(' AND ')}`,values)).rows;return{data:single?rows[0]??null:rows,error:null}}
      catch(error){return{data:null,error:{code:error.code}}}
    }
    const q={select(fields){columns=fields;return q},eq(field,value){values.push(value);clauses.push(`${field}=$${values.length}`);return q},
      in(field,items){values.push(items);clauses.push(`${field}=ANY($${values.length})`);return q},
      not(field,operator,value){h.eq([operator,value],['is',null],'route checks nonnull tombstone');clauses.push(`${field} IS NOT NULL`);return q},
      maybeSingle(){return execute(true)},then(resolve,reject){return execute().then(resolve,reject)}}
    return q
  },rpc(){throw new Error('Tombstoned registration must stop before seal RPC')}}
  const overrides={
    'lib/server/auth':{getAuthenticatedUser:async()=>({ok:true,user:{id:USER},headers:new Headers()})},
    'lib/server/project-access':{requireProjectAccess:async()=>({ok:true})},
    'lib/supabase':{getSupabaseAdmin:()=>admin},
  }
  async function load(name) {
    if(overrides[name])return overrides[name]
    if(cache.has(name))return cache.get(name)
    const text=await source(`packages/web/src/${name}.ts`)
    const output=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
    const imports=new Map()
    for(const [,id] of output.matchAll(/require\(["']([^"']+)["']\)/g)) {
      imports.set(id,id.startsWith('@/')?await load(id.slice(2)):id.startsWith('.')?await load(posix.normalize(posix.join(posix.dirname(name),id))):require(id))
    }
    const module={exports:{}};new Function('require','module','exports',output)(id=>imports.get(id),module,module.exports);cache.set(name,module.exports);return module.exports
  }
  const route=await load('app/api/recordings/sessions/[sessionId]/seal/route'),{NextRequest}=require('next/server')
  const previous=process.env.MEDIA_ASSETS_ENABLED;process.env.MEDIA_ASSETS_ENABLED='true'
  try {
    const response=await route.POST(new NextRequest(`http://localhost/api/recordings/sessions/${f.sessionId}/seal`,{method:'POST',body:JSON.stringify({projectId:f.manifest.projectId,storyId:f.storyId,mimeType:f.manifest.mimeType,chunks:f.manifest.chunks.map(({storageObjectKey,...c})=>c)})}),{params:Promise.resolve({sessionId:f.sessionId})})
    return{status:response.status,body:await response.json(),queries:calls}
  } finally {if(previous===undefined)delete process.env.MEDIA_ASSETS_ENABLED;else process.env.MEDIA_ASSETS_ENABLED=previous}
}
