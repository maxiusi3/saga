# Offline publication worker

The project page prepares a durable job and exposes its status/retry action. Run this worker on a long-lived Node 20.9+ host with the same code, dependencies and private persistent volume as the authenticated archive download route. A page request does not execute large export work. Deploying the web app alone does not start the worker.

```sh
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='YOUR_SERVICE_ROLE_KEY'
export ARCHIVE_SPOOL_DIR='/absolute/private/publication-spool'
mkdir -p "$ARCHIVE_SPOOL_DIR"
chmod 700 "$ARCHIVE_SPOOL_DIR"
npm run worker:publications -- --check
npm run worker:publications -- --once
npm run worker:publications
```

Use a process supervisor for the final command. Configuration is explicit; the command does not read `.env` files. `--check` compiles the actual production worker graph, validates the existing private spool and parses the bundled Unicode font without opening a network connection. The service key is server-only. The worker emits fixed outcome names, never family text, object paths or credentials.

`PUBLICATION_WORKER_POLL_MS` defaults to 2000 and accepts 250–60000. `ARCHIVE_FONT_PATH` can supply an absolute path to the bundled font; the CLI normally resolves the repository asset independently of the working directory. The web host must also ship `packages/web/assets/fonts/` (or configure its own absolute font path). The font and SIL license/source hashes are stored there. Unsupported glyphs fail preparation explicitly.

Each invocation selects at most one queued or expired job. A ten-minute lease, thirty-second heartbeat and nine-minute job deadline bound execution. Media and ZIP output stream through private disk files; one archive supports at most 2,000 stories, 5,000 media assets, 10,000 transcript/revision records, 16 MiB metadata and 2 GiB original media. An expired lease can be recovered; failed jobs can be retried through the project page up to five total attempts. SIGINT/SIGTERM cancels current streaming work and drains it before exiting. RPC requests have a fifteen-second transport limit; active media streams use the job deadline. Continuous mode reports a failed iteration and keeps polling; `--once` exits nonzero on failure/unavailability.

Downloads authenticate the browser session, verify ZIP length/hash and recheck current project membership, sources and tombstones after I/O. The web host and worker must share the same `ARCHIVE_SPOOL_DIR`; ephemeral or independent serverless disks do not satisfy this requirement. No signed public link or browser-memory ZIP buffer is used for durable downloads.

Deletion records enqueue artifact cleanup in the same database transaction. Every worker iteration reconciles that queue and stale attempts. Back up this dedicated private volume with a path/size/SHA-256 manifest alongside the complete database. During restore, keep application access and writers disabled; restore the volume, replay post-freeze tombstones, run content purge and worker reconciliation, then verify surviving ZIP hashes. A deleted story invalidates its complete family publication. Keep the service key and the private volume out of public hosting directories.

If the finish response is lost, the worker confirms the database job/lease and ZIP byte identity before reporting ready. An unavailable confirmation leaves the file for the next reconciliation. Temporary cleanup failure after ready does not delete or fail the ZIP. See [processing recovery](processing-recovery.md) for the exact retry and cleanup rules.

Local acceptance exercises the actual worker and protected handlers on disposable PostgreSQL with a declared synthetic Storage transport. Hosted process supervision, shared-volume availability and provider backups require deployment verification. See the G3 report for the exact tested boundary.
