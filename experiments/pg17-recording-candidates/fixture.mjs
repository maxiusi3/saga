import { setup as setupWorker, LEASE } from '../pg17-recording-worker/fixture.mjs'

export const CANDIDATE = 'supabase/migrations/20261103000002_recording_output_candidates.sql'
export const CANDIDATE_SIGNATURE = 'public.recording_output_candidate(uuid,text,text,integer,text,uuid,jsonb)'
export const CANDIDATE_RPC = 'SELECT public.recording_output_candidate($1::uuid,$2::text,$3::text,$4::integer,$5::text,$6::uuid,$7::jsonb) AS receipt'

export async function setup(h, source) {
  await setupWorker(h, source)
  await h.db.query(await source(LEASE))
  h.report.fixture.fullMigrations.push(LEASE)
  // Only the columns used by the migration are simulated. No Storage API or
  // Supabase-managed schema ownership is represented by these SQL fixtures.
  await h.db.query(`
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL REFERENCES storage.buckets(id),
      name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name)
    );
    ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.buckets,storage.objects TO anon,authenticated,service_role;
    CREATE POLICY deliberately_broad_buckets ON storage.buckets FOR ALL TO anon,authenticated,service_role USING(true) WITH CHECK(true);
    CREATE POLICY deliberately_broad_objects ON storage.objects FOR ALL TO anon,authenticated,service_role USING(true) WITH CHECK(true);
    INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('control-public','control-public',true,104857600);
    INSERT INTO storage.objects(bucket_id,name) VALUES('control-public','visible-control');
  `)
  h.report.fixture.syntheticPrerequisites.push('storage.buckets', 'storage.objects', 'broad permissive storage RLS/grants')
}

export async function candidateRpc(client, args) {
  return (await client.query(CANDIDATE_RPC, args)).rows[0].receipt
}

export async function candidateOutcome(client, args) {
  try { return { code: '00000', receipt: await candidateRpc(client, args) } }
  catch (error) { return { code: error.code ?? 'QUERY_FAILED' } }
}

export async function candidateState(h, jobId) {
  return (await h.db.query(`SELECT jsonb_build_object(
    'job',(SELECT to_jsonb(j) FROM public.processing_jobs j WHERE j.id=$1),
    'attempts',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attempt_no),'[]') FROM public.processing_attempts a WHERE a.job_id=$1),
    'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.recording_output_candidates c WHERE c.job_id=$1)
  ) AS state`, [jobId])).rows[0].state
}
