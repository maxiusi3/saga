# Native recording status verification

Run `node experiments/pg17-recording-status/verify.mjs --without-migration`
for the expected missing-function RED. Run without arguments for SQL evidence,
or with `--http` for the actual production reader through installed Supabase JS,
native loopback HTTP and isolated PostgreSQL 17.4.

Every run writes a new timestamp/UUID directory under
`docs/research/evidence/2026-11-05-g1-recording-status/`; failures are retained.
Earlier fixture modules are imported; earlier evidence writers never execute.
No remote database, cloud service, paid API or family data is used. PostgreSQL
prerequisites and candidate audio metadata are synthetic; this slice does not
repeat earlier native FFmpeg qualification. The HTTP peer is a PostgREST-shaped
substitute, not managed PostgREST/Storage. A status result describes a statement
snapshot; later revocation/deletion remains possible. No receipt permits cleanup.
