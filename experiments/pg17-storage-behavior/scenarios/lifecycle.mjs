import { qid } from '../../pg17-rls-source-composition/fixture.mjs'
import { attempt,bucket,row,configA,configB,generationA,generationB,withActor } from './support.mjs'
const actors=[['ordinary',false,false,false],['member',true,false,false],['R',true,false,false],['superuser',true,true,true],['bypass',false,false,true]]
const control='protect_bucket_control_columns',after='enforce_bucket_lifecycle_service_role'
const pairSql='UPDATE storage.buckets SET lifecycle_configuration=$2,lifecycle_configuration_generation=$3 WHERE id=$1'

export async function lifecycle(h) {
  await h.scenario('actual synthetic role attributes and MEMBER versus exact current_user',async()=>{
    for(const [alias,member,superuser,bypass] of actors)await withActor(h,alias,async(_c,id)=>h.eq(id,{alias,superuser,bypassRls:bypass,memberOfR:member,exactR:alias==='R'},'role graph '+alias))
    const members=(await h.db.query('SELECT pg_get_userbyid(roleid) AS parent,pg_get_userbyid(member) AS child,inherit_option,set_option,admin_option FROM pg_auth_members')).rows
    const edge=members.filter(x=>Object.values(h.roles).includes(x.parent)||Object.values(h.roles).includes(x.child))
    h.eq(edge,[{parent:h.roles.R,child:h.roles.member,inherit_option:true,set_option:true,admin_option:false}],'only explicitly granted synthetic R membership')
  })
  for(const [actor,member] of actors)await h.scenario('lifecycle INSERT role matrix '+actor,async()=>{
    for(const type of ['STANDARD','ANALYTICS','VECTOR']) {
      await attempt(h,{label:actor+' empty insert '+type,actor,sql:'INSERT INTO storage.buckets(id,name,type) VALUES($1,$1,$2)',values:['insert-empty-'+actor+'-'+type,type]})
      const expected=!member?'42501':type==='STANDARD'?'00000':'23514'
      await attempt(h,{label:actor+' nonempty insert '+type,actor,sql:'INSERT INTO storage.buckets(id,name,type,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2,$3,$4)',values:['insert-full-'+actor+'-'+type,type,configA,generationA],expected,layer:!member?'trigger':'table_constraint',fn:!member?control:undefined,constraint:member&&type!=='STANDARD'?'buckets_lifecycle_configuration_standard_only_check':undefined})
    }
  })
  await h.scenario('lifecycle INSERT shape pair UUID and versioning constraints',async()=>{
    const shapeCases=[['array',[]],['json-null','null'],['scalar',42],['missing-rules',{}],['rules-object',{rules:{}}],['rules-null',{rules:null}],['rules-empty',{rules:[]}],['rules-1001',{rules:Array(1001).fill(null)}]]
    for(const [label,configuration] of shapeCases)await attempt(h,{label:'shape '+label,actor:'R',sql:'INSERT INTO storage.buckets(id,name,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2::jsonb,$3)',values:['shape-'+label,typeof configuration==='string'?configuration:JSON.stringify(configuration),generationA],expected:'23514',layer:'table_constraint',constraint:'buckets_lifecycle_configuration_shape_check'})
    for(const [label,configuration,generation] of [['config-only',configA,null],['generation-only',null,generationA]])await attempt(h,{label:'pair '+label,actor:'R',sql:'INSERT INTO storage.buckets(id,name,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2,$3)',values:['pair-'+label,configuration,generation],expected:'23514',layer:'table_constraint',constraint:'buckets_lifecycle_configuration_pair_check'})
    for(const n of [1,1000])await attempt(h,{label:'shape accepts '+n+' rules without service semantics',actor:'R',sql:'INSERT INTO storage.buckets(id,name,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2,$3)',values:['shape-valid-'+n,{rules:Array(n).fill(null)},generationA]})
    await attempt(h,{label:'generation is UUID input',actor:'R',sql:'INSERT INTO storage.buckets(id,name,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2,$3)',values:['bad-generation',configA,'not-a-uuid'],expected:'22P02',layer:'type_input'})
    for(const value of ['ENABLED','SUSPENDED','OTHER'])await attempt(h,{label:'versioning remains disabled '+value,actor:'R',sql:'INSERT INTO storage.buckets(id,name,versioning_status) VALUES($1,$1,$2)',values:['version-'+value,value],expected:'23514',layer:'table_constraint'})
  })
  for(const [actor] of actors)await h.scenario('lifecycle UPDATE branches '+actor,async()=>{
    const id='update-'+actor
    await bucket(h,id,{configuration:configA,generation:generationA})
    await attempt(h,{label:actor+' UPDATE OF both unchanged',actor,sql:pairSql,values:[id,configA,generationA]})
    await attempt(h,{label:actor+' UPDATE OF config unchanged',actor,sql:'UPDATE storage.buckets SET lifecycle_configuration=$2 WHERE id=$1',values:[id,configA]})
    await attempt(h,{label:actor+' UPDATE OF generation unchanged',actor,sql:'UPDATE storage.buckets SET lifecycle_configuration_generation=$2 WHERE id=$1',values:[id,generationA]})
    await attempt(h,{label:actor+' UPDATE unrelated column',actor,sql:'UPDATE storage.buckets SET public=true WHERE id=$1',values:[id]})
    for(const [label,sql,values] of [
      ['only config changes','UPDATE storage.buckets SET lifecycle_configuration=$2 WHERE id=$1',[id,configB]],
      ['only generation changes','UPDATE storage.buckets SET lifecycle_configuration_generation=$2 WHERE id=$1',[id,generationB]],
      ['both listed but config unchanged',pairSql,[id,configA,generationB]],
      ['both listed but generation unchanged',pairSql,[id,configB,generationA]],
      ['only config clears',pairSql,[id,null,generationA]],
      ['only generation clears',pairSql,[id,configA,null]]
    ])await attempt(h,{label:actor+' '+label,actor,sql,values,expected:'22023',layer:'trigger',fn:control})
    await attempt(h,{label:actor+' both actually change AFTER gate',actor,sql:pairSql,values:[id,configB,generationB],expected:actor==='R'?'00000':'PST01',layer:'trigger',fn:after})
    if(actor==='R') {const actual=await row(h,id);h.eq([actual.lifecycle_configuration,actual.lifecycle_configuration_generation],[configB,generationB],'exact R persisted both changed fields')}
    await attempt(h,{label:actor+' both clear AFTER gate',actor,sql:pairSql,values:[id,null,null],expected:actor==='R'?'00000':'PST01',layer:'trigger',fn:after})
    if(actor==='R') {const actual=await row(h,id);h.eq([actual.lifecycle_configuration,actual.lifecycle_configuration_generation],[null,null],'exact R persisted both cleared fields')}
    for(const type of ['ANALYTICS','VECTOR']) {
      const non='update-'+actor+'-'+type
      await bucket(h,non,{type})
      await attempt(h,{label:actor+' '+type+' unchanged NULL lifecycle',actor,sql:pairSql,values:[non,null,null]})
      await attempt(h,{label:actor+' '+type+' changed lifecycle BEFORE type gate',actor,sql:pairSql,values:[non,configA,generationA],expected:'0A000',layer:'trigger',fn:control})
    }
  })
  await h.scenario('UPDATE OF column matching and AFTER whole-statement rollback',async()=>{
    await bucket(h,'type-with-config',{configuration:configA,generation:generationA})
    await bucket(h,'type-empty')
    await withActor(h,'ordinary',async c=>{
      for(const [assignment,expected] of [['public=public',[]],['lifecycle_configuration=lifecycle_configuration',['protect_bucket_control_update','protect_bucket_control_update_role']],['lifecycle_configuration_generation=lifecycle_configuration_generation',['protect_bucket_control_update','protect_bucket_control_update_role']]]) {
        const plan=(await c.query(`EXPLAIN (ANALYZE,FORMAT JSON) UPDATE storage.buckets SET ${assignment} WHERE id='type-with-config'`)).rows[0]['QUERY PLAN'][0]
        const calls=(plan.Triggers??[]).map(t=>({name:t['Trigger Name'],calls:t.Calls})).sort((a,b)=>a.name.localeCompare(b.name))
        h.eq(calls,expected.map(name=>({name,calls:1})),'lifecycle UPDATE OF actual invocation '+assignment)
        h.report.observations.push({label:'lifecycle UPDATE OF actual invocation',assignment,calls})
      }
    })
    for(const type of ['ANALYTICS','VECTOR']) {
      await attempt(h,{label:'type-only UPDATE with config '+type,sql:'UPDATE storage.buckets SET type=$2 WHERE id=$1',values:['type-with-config',type],expected:'23514',layer:'table_constraint',constraint:'buckets_lifecycle_configuration_standard_only_check'})
      await attempt(h,{label:'type-only UPDATE empty '+type,sql:'UPDATE storage.buckets SET type=$2 WHERE id=$1',values:['type-empty',type]})
    }
    await attempt(h,{label:'invalid UUID before trigger',actor:'R',sql:'UPDATE storage.buckets SET lifecycle_configuration_generation=$2 WHERE id=$1',values:['type-with-config','invalid'],expected:'22P02',layer:'type_input'})
    await attempt(h,{label:'changed pair fails shape before AFTER role',actor:'ordinary',sql:pairSql,values:['type-with-config',{rules:[]},generationB],expected:'23514',layer:'table_constraint',constraint:'buckets_lifecycle_configuration_shape_check'})
    await bucket(h,'after-first');await bucket(h,'after-second',{configuration:configA,generation:generationA})
    await attempt(h,{label:'AFTER failure rolls back every row and unrelated field',sql:`UPDATE storage.buckets SET public=true,
      lifecycle_configuration=CASE WHEN id='after-second' THEN $1::jsonb ELSE lifecycle_configuration END,
      lifecycle_configuration_generation=CASE WHEN id='after-second' THEN $2::uuid ELSE lifecycle_configuration_generation END
      WHERE id IN ('after-first','after-second')`,values:[configB,generationB],expected:'PST01',layer:'trigger',fn:after})
  })
  await h.scenario('member SET ROLE becomes exact R then RESET ROLE restores member gate',async()=>{
    await bucket(h,'role-switch',{configuration:configA,generation:generationA})
    await withActor(h,'member',async c=>{
      await c.query(`SET ROLE ${qid(h.roles.R)}`)
      const id=(await c.query("SELECT current_user,session_user,pg_has_role(current_user,$1,'MEMBER') AS member",[h.roles.R])).rows[0]
      h.eq(id,{current_user:h.roles.R,session_user:h.roles.member,member:true},'SET ROLE changes effective role only')
      h.report.observations.push({label:'member SET ROLE R',sessionAlias:'member',currentAlias:'R',memberOfR:true})
      await attempt(h,{label:'exact R after SET ROLE changes both',actor:'member SET ROLE R',client:c,sql:pairSql,values:['role-switch',configB,generationB]})
      await c.query('RESET ROLE')
      await attempt(h,{label:'member after RESET ROLE cannot clear',actor:'member',client:c,sql:pairSql,values:['role-switch',null,null],expected:'PST01',layer:'trigger',fn:after})
      h.eq((await row(h,'role-switch')).lifecycle_configuration,configB,'allowed update persists; failed clearing did not')
    })
  })
}
