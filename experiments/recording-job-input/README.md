# Local read-only recording input integration

Run from the repository root with an externally supplied native FFmpeg executable:

```sh
SAGA_FFMPEG_PATH=/usr/local/bin/ffmpeg node scripts/verify-recording-job-input.cjs
```

The script does not load environment files or connect to remote services. It binds
an ephemeral port on `127.0.0.1`, creates synthetic audio, and uses the installed
Supabase JS client with native Node `fetch` against HTTP fixture rows. The real
loader, verifier, merge executor, and full-stream FFmpeg decoder run unchanged.
An alias-aware temporary TypeScript compilation loads only the required modules.

The production verifier requires an HTTPS origin. Its injected fetch adapter maps
exactly `https://fixture.invalid` to the local HTTP server. This is not a test of
TLS, real authentication, RLS, PostgreSQL transactions, or the Storage service.
Fixture manifest hashes use the closed ASCII/integer PostgreSQL `jsonb::text`
representation, not `JSON.stringify`; database behavior itself remains simulated.

A transparent `child_process.spawn` observer calls the original native spawn,
observes real PCM and process-close events, and triggers test-only database
changes/cancellation during decoding. It never replaces the decoder or its
output, and is restored in `finally`. FFmpeg must still be independently deployed,
version-qualified, and isolated for production use.

Coverage includes 13-part WebM/Opus, Ogg/Opus, fragmented MP4/AAC, same-size byte
corruption, missing objects, hash-consistent invalid audio, partial/redirected or
incorrect-length HTTP responses, overlong/truncated chunked bodies,
role/ownership/tombstone changes during fetch,
state/tombstone changes during real decode, stalled response bodies, caller
cancellation, and stream/child/temp-directory cleanup. All HTTP requests must be
GET. Successful results retain `canClearLocalDrafts: false` and never return an
artifact path. No claim, lease, write, upload, publication, ready transition,
local recording-draft cleanup, or cloud call is performed.

Evidence is written only to a unique `run-<timestamp>-<pid>/` subdirectory in the new
`docs/research/evidence/2026-11-03-g1-worker-input/` directory, using exclusive writes:

- `input-results.json`: assertions, cases, timings, formats, hashes, PID/cleanup observations,
  and source hashes before/after execution (source drift fails the run).
- `input-http-requests.json`: actual local HTTP request/response observations without credentials.
- `input-ffmpeg-events.json`: native generation commands and observed decoder PCM/close events.

Re-running preserves all previous results, including failures and the initial
top-level three-file run. It never invokes or rewrites older evidence harnesses.
Local passing results do not close
G1 or establish atomic revocation, recording-tail completeness, real-device
behavior, durable cloud confirmation, or deployment readiness.
