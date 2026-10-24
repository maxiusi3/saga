import { readdir } from 'node:fs/promises'
// Complete direct read/import closure. Private capture paths were already named
// in the reviewed public capture manifests; only their digests are reported.
export async function inputFiles(here) {
  const files = (await readdir(here))
    .filter((x) => /\.(mjs|sql|md|json)$/.test(x) && x !== 'input-pins.json')
    .map((x) => 'experiments/pg17-invitation-transactions/' + x)
  for (const f of [
    'runtime.mjs',
    'replay.mjs',
    'fixture.sql',
    'schema-manifest.json',
    'runtime-pins.json',
    'candidate.sql'
  ])
    files.push('experiments/pg17-routines/' + f)
  files.push(
    'experiments/pg17-access-guards/input-pins.json',
    'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json',
    'docs/research/evidence/2026-10-17-routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json',
    'docs/research/evidence/2026-10-17-pg17-routines/capture-trigger-2026-10-17T16-07-31-856Z-f3cb9d16-8c1a-49c0-9ccb-537c82cf218f.json',
    'supabase/.temp/routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json',
    'supabase/.temp/routine-audit/capture-trigger-2026-10-17T16-07-31-856Z-f3cb9d16-8c1a-49c0-9ccb-537c82cf218f.json'
  )
  return files.sort()
}
