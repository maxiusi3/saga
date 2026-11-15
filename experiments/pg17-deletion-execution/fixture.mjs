import { setup as setupLeases } from '../pg17-deletion-leases/fixture.mjs'
import { FOUNDATION } from '../pg17-recording-worker/fixture.mjs'
export { fresh, capture, USER, OTHER, PROJECT } from '../pg17-deletion-capture/fixture.mjs'
export const MIGRATION = 'supabase/migrations/20261109000001_media_deletion_execution.sql'
export async function setup(h, source, migrate = true) {
  await setupLeases(h, source)
  const ddl = (await source(FOUNDATION)).match(/CREATE TABLE IF NOT EXISTS public\.legacy_media_references \([\s\S]*?\n\);/)[0]
  await h.db.query(ddl)
  await h.db.query("ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audio_url text, ADD COLUMN IF NOT EXISTS photo_url text, ADD COLUMN IF NOT EXISTS images jsonb; CREATE TABLE public.prompts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audio_url text); GRANT ALL ON public.legacy_media_references,public.prompts TO service_role")
  if (migrate) await h.db.query(await source(MIGRATION))
}
export async function execute(client, request, run, action, payload = {}) {
  return (await client.query('SELECT public.media_deletion_execute($1::uuid,$2::uuid,$3::text,$4::jsonb) AS value', [request,run,action,JSON.stringify(payload)])).rows[0].value
}
