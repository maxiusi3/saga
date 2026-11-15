import { setup as setupCapture, snapshot as captureSnapshot } from '../pg17-deletion-capture/fixture.mjs'
export { fresh, capture, materialize, USER, OTHER, PROJECT } from '../pg17-deletion-capture/fixture.mjs'
export const MIGRATION = 'supabase/migrations/20261106000004_media_deletion_leases.sql'
export const RPC = 'SELECT public.media_deletion_job_lease($1::uuid,$2::text,$3::text,$4::integer,$5::integer) AS value'
export async function setup(h, source, migrate = true) {
  await setupCapture(h, source)
  if (migrate) {
    await h.db.query(await source(MIGRATION))
    h.report.fixture.fullMigrations.push(MIGRATION)
  }
}
export async function lease(client, requestId, action, workerId = null, attempt = null, leaseMs = null) {
  return (await client.query(RPC, [requestId, action, workerId, attempt, leaseMs])).rows[0].value
}
export async function snapshot(h) {
  // to_jsonb(timestamptz) uses the observer session's timezone. Normalize the
  // observer, never the data, so independent connections compare exact rows.
  await h.db.query("SET timezone='UTC'")
  const result = await captureSnapshot(h)
  for (const table of ['media_deletion_jobs', 'media_deletion_attempts']) {
    result[table] = (await h.db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row)
  }
  return result
}
