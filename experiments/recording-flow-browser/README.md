# G1 recording workflow integration

Run from the repository root after installing the existing workspace dependencies:

```sh
node experiments/recording-flow-browser/verify-server.mjs
node experiments/recording-flow-browser/verify-browser.mjs
node experiments/recording-flow-browser/verify-browser.mjs --interruptions
```

These commands create an isolated PostgreSQL 17.4 database on a private Unix socket, loopback HTTP servers and temporary compiled modules. They require the pinned local PostgreSQL runtime used by `experiments/pg17-routines/runtime.mjs`, Playwright Chromium and `/usr/local/bin/ffmpeg`. They do not use project `.env` files, cloud credentials, a physical microphone or family recordings. Each run saves source fingerprints, results and browser screenshots in a new directory under `docs/research/evidence/2026-11-05-g1-recording-flow/`, then closes the browser, servers, database connections and PostgreSQL cluster and removes its temporary files.

The browser executes the actual recording page, capture/recovery/save components, native MediaRecorder, IndexedDB, WebCrypto and Web Locks. Next route handlers, the Supabase JavaScript client, SQL migrations, production worker queue iteration and FFmpeg processing are also real. The fixture timer calls the same `runRecordingWorkerOnce` used by the worker command and passes its cursor onward. The microphone produces a synthetic Web Audio tone. Authentication, project access transport, PostgREST HTTP and Storage are explicitly local adapters; this is not cloud or physical-device qualification. The UI bundle replaces the Supabase factory for both absolute and relative imports. Production code has no test-origin exception or fixture flag.

The ordinary browser run records and completes a short tone, reloads the page, opens the durable draft and continues saving. It checks the single ready story, decodes the saved output, starts the actual saved-audio player, aborts a native IndexedDB deletion transaction, checks that all chunks remain, retries cleanup and captures desktop/mobile screenshots.

The interruption run requests a native recorder chunk and reloads while capture is still active. This checks recovery of the committed range; it does not qualify the production one-minute timeslice or mobile suspension. It then checks offline retention, account change during an auth await, loss of reserve/seal/confirm replies, reload/recovery, pending processing without cleanup and duplicate Save events. Reply loss is injected only after the actual handler completes its database work: the adapter returns truncated JSON. A socket reset before headers was insufficient because Chromium could transparently replay the POST; that earlier fixture result remains in the evidence directory.

AI/interview endpoints intentionally return unavailable in these fixtures. Saving the original recording remains independent. Browser console messages from those failures, the denied synthetic Wake Lock and expected duplicate uploads are retained in the results; they are not real-provider availability evidence. A run is successful only when all assertions pass, no undeclared external requests or uncaught page errors occur, cleanup succeeds and the source fingerprints remain unchanged.

The current delivery report and final evidence index determine which runs qualify the final source. Earlier failed fixture and product runs are retained for diagnosis and never counted as passing runs.
