import { attempt,bucket,row,state,withActor } from './support.mjs'
const objectId=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0')

export async function deletion(h) {
  await bucket(h,'delete-objects-parent')
  let counter=0
  await h.scenario('DELETE statement GUC exact text both tables zero and nonzero rows',async()=>{
    for(const table of ['buckets','objects'])for(const value of [undefined,'','on','1','TRUE','true'])for(const matching of [false,true]) {
      const id=table==='objects'?objectId(++counter):'guc-bucket-'+(++counter)
      if(table==='buckets')await bucket(h,id)
      else await h.db.query('INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,$2,$3)',[id,'delete-objects-parent','guc-object-'+counter])
      await withActor(h,'ordinary',async c=>{
        h.eq((await c.query("SELECT current_setting('storage.allow_delete_query',true) AS value")).rows[0].value,null,'fresh connection GUC genuinely missing')
        if(value!==undefined)await c.query("SELECT set_config('storage.allow_delete_query',$1,false)",[value])
        const setting=(await c.query("SELECT current_setting('storage.allow_delete_query',true) AS value")).rows[0].value
        h.eq(setting,value??null,'no boolean coercion of GUC text')
        const label=table+' GUC '+(value===undefined?'missing':JSON.stringify(value))+' '+(matching?'matching':'zero')
        const result=await attempt(h,{label,client:c,sql:`DELETE FROM storage.${table} WHERE id=$1 ${matching?'':'AND false'}`,values:[id],expected:value==='true'?'00000':'42501',layer:'trigger',fn:'protect_delete',rowCount:matching?1:0})
        result.gucValue=setting;result.matchingRowsBefore=matching?1:0
      })
    }
  })
  await h.scenario('transaction SET LOCAL true resets after COMMIT and ROLLBACK',async()=>{
    for(const table of ['buckets','objects'])for(const finish of ['COMMIT','ROLLBACK']) {
      const id=table==='objects'?objectId(++counter):'local-'+finish
      if(table==='buckets')await bucket(h,id)
      else await h.db.query('INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,$2,$3)',[id,'delete-objects-parent','local-object-'+counter])
      const before=await state(h)
      await withActor(h,'ordinary',async c=>{
        await c.query('BEGIN')
        try {
          await c.query("SELECT set_config('storage.allow_delete_query','true',true)")
          const r=await c.query(`DELETE FROM storage.${table} WHERE id=$1 RETURNING id`,[id])
          h.eq(r.rowCount,1,'local GUC permits actual transactional metadata deletion')
          h.eq((await c.query(`SELECT id FROM storage.${table} WHERE id=$1`,[id])).rowCount,0,'deleted row absent within transaction')
          await c.query(finish)
        } catch(e) {await c.query('ROLLBACK');throw e}
        const reset=(await c.query("SELECT current_setting('storage.allow_delete_query',true) AS value")).rows[0].value
        h.eq(reset,'','custom GUC placeholder empty after '+finish)
        if(finish==='ROLLBACK')h.eq(await state(h),before,'rollback restores complete metadata state')
        else h.eq(await row(h,id,table),null,'commit persisted metadata deletion')
        h.report.observations.push({label:table+' SET LOCAL '+finish,insideValue:'true',afterValue:reset,deletedRowCountInside:1,committed:finish==='COMMIT',rollbackRestoredCompleteState:finish==='ROLLBACK'})
        await attempt(h,{label:table+' delete guard restored after '+finish,client:c,sql:`DELETE FROM storage.${table} WHERE id=$1 AND false`,values:[id],expected:'42501',layer:'trigger',fn:'protect_delete'})
      })
    }
  })
  await h.scenario('controlled true exposes separate synthetic family and revocation RLS',async()=>{
    await h.db.query(`CREATE SCHEMA synthetic_authority;
      CREATE TABLE synthetic_authority.members(actor name PRIMARY KEY,family text NOT NULL,active boolean NOT NULL);
      GRANT USAGE ON SCHEMA synthetic_authority TO PUBLIC;
      GRANT SELECT ON synthetic_authority.members TO PUBLIC`)
    for(const [alias,family] of [['familyA','family_a'],['familyB','family_b'],['removed','family_a']])await h.db.query('INSERT INTO synthetic_authority.members VALUES($1,$2,true)',[h.roles[alias],family])
    for(const table of ['buckets','objects']) {
      await h.db.query(`DROP POLICY synthetic_exercise ON storage.${table};
        CREATE POLICY synthetic_family_select ON storage.${table} FOR SELECT TO PUBLIC USING (EXISTS (SELECT 1 FROM synthetic_authority.members m WHERE m.actor=current_user AND m.active AND m.family=owner_id));
        CREATE POLICY synthetic_family_delete ON storage.${table} FOR DELETE TO PUBLIC USING (EXISTS (SELECT 1 FROM synthetic_authority.members m WHERE m.actor=current_user AND m.active AND m.family=owner_id))`)
    }
    const policies=(await h.db.query("SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='storage' ORDER BY tablename,policyname")).rows
    h.eq(policies,[{tablename:'buckets',policyname:'synthetic_family_delete',cmd:'DELETE'},{tablename:'buckets',policyname:'synthetic_family_select',cmd:'SELECT'},{tablename:'objects',policyname:'synthetic_family_delete',cmd:'DELETE'},{tablename:'objects',policyname:'synthetic_family_select',cmd:'SELECT'}],'only disclosed test SELECT and DELETE policies')
    h.report.syntheticRls={scope:'Focused synthetic family membership fixture; not the previous application RLS composition, Auth/JWT, HTTP or production authorization.',authority:'synthetic_authority.members keyed by actual current_user',rowFamilyField:'owner_id holds synthetic family labels',policies}
    await h.db.query("INSERT INTO storage.buckets(id,name,owner_id) VALUES('rls-bucket','rls-bucket','family_a'),('rls-parent','rls-parent','family_a')")
    const oid=objectId(++counter)
    await h.db.query("INSERT INTO storage.objects(id,bucket_id,name,owner_id) VALUES($1,'rls-parent','rls-object','family_a')",[oid])
    // Establish that removed was once allowed; then revoke the same actor.
    for(const [table,id] of [['buckets','rls-bucket'],['objects',oid]])await withActor(h,'removed',async c=>h.eq((await c.query(`SELECT id FROM storage.${table} WHERE id=$1`,[id])).rowCount,1,'member visible before actual local revocation'))
    await h.db.query('UPDATE synthetic_authority.members SET active=false WHERE actor=$1',[h.roles.removed])
    for(const [table,id] of [['buckets','rls-bucket'],['objects',oid]]) {
      for(const actor of ['familyB','removed','familyA']) {
        await withActor(h,actor,async c=>{
          h.eq((await c.query(`SELECT id FROM storage.${table} WHERE id=$1`,[id])).rowCount,actor==='familyA'?1:0,actor+' visible rows through RLS')
          await attempt(h,{label:table+' '+actor+' guard before RLS attribution',actor,client:c,sql:`DELETE FROM storage.${table} WHERE id=$1`,values:[id],expected:'42501',layer:'trigger',fn:'protect_delete'})
          const r=await attempt(h,{label:table+' '+actor+' controlled true RLS outcome',actor,client:c,guc:'true',sql:`DELETE FROM storage.${table} WHERE id=$1`,values:[id],rowCount:actor==='familyA'?1:0})
          r.authorizationOutcome=actor==='familyA'?'allowed_synthetic_member':'successful_statement_zero_visible_rows'
        })
      }
      h.eq(await row(h,id,table),null,'only allowed actor removed synthetic target')
    }
  })
}
