import { bucket,row,withActor } from './support.mjs'
const id='40000000-0000-4000-8000-000000000001'
const old='2000-01-01T00:00:00+00:00'

export async function timestamps(h) {
  await h.scenario('captured objects timestamp update no-op caller-old and upsert',async()=>{
    await bucket(h,'timestamp-parent')
    await h.db.query(`INSERT INTO storage.objects(id,bucket_id,name,owner,created_at,updated_at,last_accessed_at,metadata,version,owner_id,user_metadata)
      VALUES($1,'timestamp-parent','a/file','40000000-0000-4000-8000-000000000002','1999-01-01','2000-01-01','1999-02-01','{"synthetic":"original"}','synthetic-version','synthetic-owner','{"tag":"stable"}')`,[id])
    for(const variant of ['update','no-op','caller-old','upsert']) {
      const before=await row(h,id,'objects')
      await withActor(h,'ordinary',async c=>{
        await c.query('BEGIN')
        try {
          const now=(await c.query('SELECT to_jsonb(now()) AS value')).rows[0].value
          let result
          if(variant==='upsert')result=await c.query(`INSERT INTO storage.objects AS o(id,bucket_id,name,updated_at) VALUES($1,'timestamp-parent','a/file','1980-01-01') ON CONFLICT(id) DO UPDATE SET updated_at=EXCLUDED.updated_at RETURNING to_jsonb(o) AS row`,[id])
          else result=await c.query(`UPDATE storage.objects AS o SET ${variant==='update'?"metadata='{}'::jsonb":variant==='no-op'?'metadata=metadata':"updated_at='1970-01-01'"} WHERE id=$1 RETURNING to_jsonb(o) AS row`,[id])
          h.eq(result.rowCount,1,variant+' reaches row trigger')
          const actual=result.rows[0].row
          h.eq(actual.updated_at,now,variant+' captured storage trigger writes transaction now')
          h.eq(actual,{...before,...(variant==='update'?{metadata:{}}:{}),updated_at:now},variant+' all other fields unchanged')
          h.ok(actual.updated_at!==old,variant+' original old timestamp replaced')
          const again=(await c.query("UPDATE storage.objects AS o SET updated_at='1960-01-01' WHERE id=$1 RETURNING to_jsonb(o) AS row",[id])).rows[0].row
          h.eq(again,actual,'second update same transaction full row and now stable')
          await c.query('COMMIT')
          h.eq(await row(h,id,'objects'),actual,'committed timestamp and all fields preserved')
          h.report.observations.push({label:'timestamp '+variant,previousUpdatedAt:before.updated_at,transactionNow:now,actualUpdatedAt:actual.updated_at,otherFieldsPreserved:true,sameTransactionSecondUpdateEqual:true,objectBytes:'not observed; synthetic SQL metadata only'})
        } catch(e) {await c.query('ROLLBACK');throw e}
      })
    }
  })
}
