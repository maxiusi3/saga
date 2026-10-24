import { attempt,bucket,row,configA,configB,generationA,generationB,withActor } from './scenarios/support.mjs'
export { lifecycle } from './scenarios/lifecycle.mjs'
export { deletion } from './scenarios/deletion.mjs'
export { timestamps } from './scenarios/timestamps.mjs'

// Literal expected arrays are hand-derived path semantics, never an oracle
// calculated with storage.foldername or its implementation.
export async function foldername(h) {
  await h.scenario('foldername literal independent boundary oracle',async()=>{
    // An empty input has no array dimension: its terminal array bound is NULL.
    // A nonempty single segment instead has an empty directory slice.
    for(const [input,expected] of [[null,null],['',null],['file',[]],['a/b/file',['a','b']],['/file',['']],['a/',['a']],['a//file',['a','']],['//',['','']],['a/%2F/file',['a','%2F']],['a%2Fb/file',['a%2Fb']]]) {
      const actual=(await h.db.query('SELECT storage.foldername($1) AS folders',[input])).rows[0].folders
      h.report.observations.push({label:'foldername',input,expected,actual})
      h.eq(actual,expected,'foldername literal '+JSON.stringify(input))
    }
    const reference=(await h.db.query('SELECT array_length(ARRAY[]::text[],1) AS empty_dimension,(ARRAY[]::text[])[1:NULL] AS null_bound,(ARRAY[\'file\']::text[])[1:0] AS zero_directory_slice')).rows[0]
    h.eq(reference,{empty_dimension:null,null_bound:null,zero_directory_slice:[]},'independent PostgreSQL array-bound reference, no foldername call')
    h.report.observations.push({label:'independent array-bound semantics supporting literal oracle',...reference})
  })
}
export async function names(h) {
  await h.scenario('bucket name INSERT and UPDATE character limits',async()=>{
    for(const [kind,char] of [['ascii','a'],['multibyte','界']]) {
      const id='name-'+kind,valid=char.repeat(100),invalid=char.repeat(101)
      const sizes=(await h.db.query('SELECT length($1::text) AS chars,octet_length($1::text) AS bytes',[valid])).rows[0]
      h.eq(sizes,{chars:100,bytes:kind==='ascii'?100:300},kind+' characters versus bytes')
      await attempt(h,{label:kind+' INSERT 100',sql:'INSERT INTO storage.buckets(id,name) VALUES($1,$2)',values:[id,valid]})
      await attempt(h,{label:kind+' INSERT 101',sql:'INSERT INTO storage.buckets(id,name) VALUES($1,$2)',values:[id+'-101',invalid],expected:'P0001',layer:'trigger',fn:'enforce_bucket_name_length'})
      await attempt(h,{label:kind+' UPDATE OF name 101',sql:'UPDATE storage.buckets SET name=$2 WHERE id=$1',values:[id,invalid],expected:'P0001',layer:'trigger',fn:'enforce_bucket_name_length'})
      await attempt(h,{label:kind+' UPDATE OF name 100 unchanged',sql:'UPDATE storage.buckets SET name=$2 WHERE id=$1',values:[id,valid]})
      await attempt(h,{label:kind+' UPDATE not listing name',sql:'UPDATE storage.buckets SET public=true WHERE id=$1',values:[id]})
      h.eq((await row(h,id)).name,valid,'name remains complete after unrelated update')
    }
    await attempt(h,{label:'NULL name table NOT NULL',sql:'INSERT INTO storage.buckets(id,name) VALUES($1,NULL)',values:['null-name'],expected:'23502',layer:'not_null'})
    await withActor(h,'ordinary',async c=>{
      for(const [assignment,expected] of [['public=public',[]],['name=name',['enforce_bucket_name_length_trigger']]]) {
        const plan=(await c.query(`EXPLAIN (ANALYZE,FORMAT JSON) UPDATE storage.buckets SET ${assignment} WHERE id='name-ascii'`)).rows[0]['QUERY PLAN'][0]
        const calls=(plan.Triggers??[]).map(t=>({name:t['Trigger Name'],calls:t.Calls})).sort((a,b)=>a.name.localeCompare(b.name))
        h.eq(calls,expected.map(name=>({name,calls:1})),'name UPDATE OF actual invocation '+assignment)
        h.report.observations.push({label:'name UPDATE OF actual invocation',assignment,calls})
      }
    })
  })
}
export async function missingTriggerRed(h) {
  await h.scenario('RED missing seven triggers with full enum',async()=>{
    const count=(await h.db.query("SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND NOT t.tgisinternal")).rows[0].n
    h.eq(count,0,'deliberate old trigger omission')
    const labels=(await h.db.query("SELECT enumlabel FROM pg_enum WHERE enumtypid='storage.buckettype'::regtype ORDER BY enumsortorder")).rows.map(x=>x.enumlabel)
    h.eq(labels,['STANDARD','ANALYTICS','VECTOR'],'trigger RED does not also omit enum values')
    await attempt(h,{label:'RED unprotected 101 character name accepted',sql:'INSERT INTO storage.buckets(id,name) VALUES($1,$2)',values:['red-long','x'.repeat(101)]})
    await attempt(h,{label:'RED ordinary nonempty lifecycle accepted',sql:'INSERT INTO storage.buckets(id,name,lifecycle_configuration,lifecycle_configuration_generation) VALUES($1,$1,$2,$3)',values:['red-life',configA,generationA]})
    await attempt(h,{label:'RED ordinary lifecycle change accepted',sql:'UPDATE storage.buckets SET lifecycle_configuration=$2,lifecycle_configuration_generation=$3 WHERE id=$1',values:['red-life',configB,generationB]})
    await attempt(h,{label:'RED unguarded zero-row bucket DELETE',sql:"DELETE FROM storage.buckets WHERE id='absent'",rowCount:0})
    await attempt(h,{label:'RED unguarded nonzero bucket DELETE',sql:"DELETE FROM storage.buckets WHERE id='red-long'"})
    await h.db.query("INSERT INTO storage.objects(id,bucket_id,name,updated_at) VALUES('20000000-0000-4000-8000-000000000001','red-life','red-object','2000-01-01')")
    await attempt(h,{label:'RED object UPDATE keeps caller old timestamp',sql:"UPDATE storage.objects SET updated_at='2001-01-01' WHERE name='red-object'"})
    h.eq((await row(h,'20000000-0000-4000-8000-000000000001','objects')).updated_at,'2001-01-01T00:00:00+00:00','omitted timestamp trigger permits old time')
    await attempt(h,{label:'RED unguarded zero-row object DELETE',sql:"DELETE FROM storage.objects WHERE name='absent'",rowCount:0})
    await attempt(h,{label:'RED unguarded nonzero object DELETE',sql:"DELETE FROM storage.objects WHERE name='red-object'"})
    h.report.redGaps.push({gap:'missing_seven_triggers',observedIncompatibility:true,completeEnum:true,expectedWithCapturedTriggers:{name101:'P0001',ordinaryNonemptyInsert:'42501',ordinaryLifecycleUpdate:'PST01',deleteWithoutGuc:'42501',timestamp:'transaction now()'}})
  })
}
export async function oldEnumRed(h) {
  await h.scenario('RED old STANDARD-only enum with exact seven triggers',async()=>{
    for(const type of ['ANALYTICS','VECTOR'])await attempt(h,{label:'RED enum cannot represent '+type,sql:'INSERT INTO storage.buckets(id,name,type) VALUES($1,$1,$2)',values:['red-'+type,type],expected:'22P02',layer:'type_input'})
    h.report.redGaps.push({gap:'STANDARD_only_enum',observedIncompatibility:true,capturedTriggers:7,missingLabels:['ANALYTICS','VECTOR'],expectedWithFullEnum:'00000'})
  })
}
