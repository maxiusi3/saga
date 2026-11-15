# Local recording finalization verification

Run `node experiments/pg17-recording-finalization/verify.mjs --without-migration`
for the expected missing-RPC RED, then run without the flag for native SQL checks.
Each run writes new UUID evidence, compressed source snapshots and PostgreSQL
logs under `docs/research/evidence/2026-11-04-g1-recording-finalization/`.

The existing pinned PostgreSQL 17.4 Harness and worker/candidate fixture are
imported directly. Prerequisite identity tables and Storage schemas are synthetic;
the seal, lease, candidate and finalization migrations are applied intact. This
does not represent a complete migration replay, cloud or PostgREST qualification,
audio-worker wiring, local cleanup authority, or G1 completion.
