import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {Harness,root,digest} from '../pg17-routines/runtime.mjs'
import {setup,MIGRATION,capture,snapshot,USER,OTHER,PROJECT} from './fixture.mjs'
import {save,METADATA} from '../pg17-recording-flow/fixture.mjs'
const before=process.argv.includes('--before-fix-1'),directory=join(root,'docs/research/evidence/2026-11-06-g1-deletion-capture',`snapshot-cost-${before?'red-':''}${Date.now()}-${randomUUID()}`)
const report={status:'running',assertions:0,actorConnections:[],scenarios:[],sources:{},samples:[],command:`node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs ${process.argv.slice(2).join(' ')}`.trim(),g1MilestoneSatisfied:false,physicalDeletionComplete:false}
const h=new Harness(report);await mkdir(directory,{recursive:true})
async function source(path){const actual=before&&path===MIGRATION?`.superpowers/sdd/2026-11-06-upgrade-g1-deletion-capture/task-1-fix-1-before/${path}`:path;const bytes=await readFile(join(root,actual));report.sources[actual]=digest(bytes);return bytes.toString()}
async function artifact(name,rows){const raw=Buffer.from(JSON.stringify(rows,null,2)),archive=gzipSync(raw);await writeFile(join(directory,`${name}.json.gz`),archive);return{path:`${name}.json.gz`,rawBytes:raw.length,rawSha256:digest(raw),archiveSha256:digest(archive)}}
try {
  await source('experiments/pg17-deletion-capture/fixture.mjs');await source('experiments/pg17-deletion-capture/verify-snapshot-cost.mjs')
  await h.start();await setup(h,source);const service=await h.actorClient('service_role',USER)
  await service.query("SET statement_timeout='30s'")
  const sql=await source(MIGRATION)
  const original=sql.match(/CREATE FUNCTION public\.request_media_deletion\([\s\S]*?\n\$\$;/)?.[0];h.ok(original,'exact actual capture function extracted for supplemental serializer probe')
  const probe=original.replace('FUNCTION public.request_media_deletion(', 'FUNCTION public.request_media_deletion_json_probe(').replaceAll('to_jsonb(', 'public.deletion_json_probe(')
  const wrapper=`CREATE TABLE public.deletion_json_probe_log(type_name text, serialized_bytes bigint, contains_unrelated_body boolean);
    CREATE FUNCTION public.deletion_json_probe(value anyelement) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $p$
    DECLARE result jsonb; BEGIN result := pg_catalog.to_jsonb(value);
      INSERT INTO public.deletion_json_probe_log VALUES(pg_typeof(value)::text,octet_length(result::text),coalesce(left(result->>'content',21)='UNRELATED_BODY_PROBE:',false));
      RETURN result; END; $p$;`
  await h.db.query(wrapper);await h.db.query(probe)
  await h.db.query('REVOKE ALL ON FUNCTION public.request_media_deletion_json_probe(uuid,uuid,uuid,text,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.request_media_deletion_json_probe(uuid,uuid,uuid,text,uuid) TO service_role')
  await writeFile(join(directory,'serializer-probe.sql'),wrapper+'\n'+probe)
  report.instrumentation={actualSqlSha256:digest(sql),derivedProbeSha256:digest(probe),wrapperSha256:digest(wrapper),note:'Timings below execute the unmodified actual function. A separate diagnostic copy substitutes only to_jsonb with a transparent serializer/logger to count serialized payload bytes and unrelated-body hits. It is supplemental, not the production behavior oracle.'}
  const unrelated=(await save(service,randomUUID(),'reserve',METADATA)).lookup.intent.storyId
  await h.scenario('I2 unrelated 0/8/32 MiB content is excluded from capture JSON serialization',async()=>{
    for(const mib of [0,8,32]) {
      const target=(await save(service,randomUUID(),'reserve',METADATA)).lookup.intent.storyId
      await h.db.query("UPDATE stories SET content=CASE WHEN $2::int=0 THEN '' ELSE 'UNRELATED_BODY_PROBE:'||repeat('x',$2::int-21) END WHERE id=$1",[unrelated,mib*1024*1024])
      h.eq(Number((await h.db.query('SELECT octet_length(content) AS bytes FROM stories WHERE id=$1',[unrelated])).rows[0].bytes),mib*1024*1024,'exact unrelated body byte size')
      const initial=await snapshot(h),beforeRows=await artifact(`mib-${mib}-before`,initial)
      const start=performance.now(),receipt=await capture(service,{subjectId:target,requestId:randomUUID()}),elapsedMs=performance.now()-start
      const final=await snapshot(h),afterRows=await artifact(`mib-${mib}-after`,final)
      for(const table of Object.keys(initial).filter(t=>!['deletion_requests','deletion_targets'].includes(t)))h.eq(final[table],initial[table],`${mib} MiB ${table}: full source rows unchanged`)
      h.eq(receipt.targetCount,1,'actual function captures one metadata target')
      const probeTarget=(await save(service,randomUUID(),'reserve',METADATA)).lookup.intent.storyId
      await h.db.query('TRUNCATE public.deletion_json_probe_log')
      const probeReceipt=(await service.query({text:'SELECT public.request_media_deletion_json_probe($1,$2,$3,$4,$5) AS value',values:[OTHER,PROJECT,probeTarget,'story',randomUUID()],query_timeout:30000})).rows[0].value
      const probeRows=(await h.db.query('SELECT type_name,count(*)::int AS calls,sum(serialized_bytes)::bigint::text AS serialized_bytes,count(*) FILTER (WHERE contains_unrelated_body)::int AS unrelated_body_calls FROM public.deletion_json_probe_log GROUP BY type_name ORDER BY type_name')).rows
      report.samples.push({unrelatedStoryBodyMiB:mib,elapsedMs,targetCount:receipt.targetCount,receipt,beforeRows,afterRows,probeReceipt,serializer:probeRows,totalSerializedBytes:probeRows.reduce((n,r)=>n+Number(r.serialized_bytes),0),unrelatedBodyCalls:probeRows.reduce((n,r)=>n+r.unrelated_body_calls,0)})
    }
    h.eq(report.samples.map(s=>s.unrelatedBodyCalls),[0,0,0],'no unrelated story body serialized at any size')
    const work=report.samples.map(s=>s.totalSerializedBytes)
    h.ok(Math.max(...work)-Math.min(...work)<8192,'serializer work stays scoped while unrelated content grows by 32 MiB')
  });report.status='passed'
}catch(e){report.status='failed';report.error={code:e.code??'ERROR',label:e.label??e.message,where:e.where};process.exitCode=1}
finally{await h.cleanup();if(report.status!=='passed')process.exitCode=1;await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({directory,status:report.status,assertions:report.assertions,samples:report.samples.map(({unrelatedStoryBodyMiB,elapsedMs,totalSerializedBytes,unrelatedBodyCalls})=>({unrelatedStoryBodyMiB,elapsedMs,totalSerializedBytes,unrelatedBodyCalls})),error:report.error,cleanup:report.cleanup},null,2))}
