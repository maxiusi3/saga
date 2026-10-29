# Export-observation verification evidence

Scope: local synchronous archive assembly observations, based on `a605fbf1e`. This is not production readiness, deployment coverage, client delivery or original G0-G4 acceptance.

## Final evidence

- `verification.json`: final command results, review records, documentation and evidence hashes.
- `pg-verification.json`: Task 1 run index, exact source/artifact hashes, real-role/concurrency assertions and normal/polluted environment results. Its run list preserves expected REDs and an earlier implementation GREEN separately.
- `pg-root-final.txt` and its referenced JSON: independent root replay, 12 scenarios / 464 assertions, exit 0.
- `full-verification-final.txt`: full command chain, exit 0; Web 132/1754, shared 4/16, infra 7, build 184 pages.
- `export-green.txt`: final targeted 7 suites / 159 tests; `type-check-green.txt` and `lint-green.txt`: standalone successful checks.
- `source-hashes.json`: 15 implementation/test/experiment inputs; `protected-inputs.json`: 1398 baseline historical inputs and dependencies, including next-env.
- `spec-review.md`, `quality-review.md`: independent code reviews; final consistency verdict is recorded in `verification.json`.
- `milestone-check.json`: local checkpoint only; original milestone push condition remains unmet.

## RED / GREEN provenance

`adapter-red.txt` preserves the initial missing writer/v2 failures (3 failed suites; 8 failed, 71 passed tests). `export-red.txt` preserves the real route/integrity-classification failures (2 failed suites; 15 failed, 44 passed tests). `adapter-green.txt` is an intermediate 4-suite/98-test success; `export-green.txt` is the final targeted result. `type-check-adapter.txt` is an intermediate successful type check.

`pg-missing-rpc-red.txt` and the `pg-red-without-migration-*` JSON are the expected missing-RPC failure (42883). `pg-infra-red.txt` is the expected missing-migration-list failure (6/7 passed). The first PG implementation pass is historical; final normal/polluted results each pass 12/464. No runner-development failure is hidden or relabeled as a product RED; none occurred in this batch. The final result does not overwrite earlier evidence.

## Original log bytes

`raw-log-archive.json` records each of 15 terminal logs, its gzip archive, SHA-256 and byte count. Every `.txt.gz` decompresses to original captured terminal bytes. Root readable `.txt` logs remove CR characters, trailing horizontal whitespace and extra final blank lines only; no output is truncated or reconstructed. All six existing PG gzip archives and five PG text logs remain unchanged. Staging found two whitespace-only lines in `pg-infra-red.txt`; only their trailing spaces were removed. Its original 4745 bytes remain in the unchanged gzip, and `pg-verification.json` records `originalRawLog` separately from the normalized `readableLog`. Two root `.exit` files preserve the final PG and full-chain exit status.

Hashes in `verification.json` cover every evidence file except that index itself, avoiding a self-hash cycle. Separate documentation hashes cover handoff, docs/README, result report and implementation plan. Source and protected hashes bind verification to the exact code and historical inputs.

## Proof boundaries

The PG fixture uses four exact P1 CREATE TABLE blocks, the unchanged v1 migration, synthetic prerequisite tables and the new migration; it does not replay the full production chain or test PostgREST. All recorded sockets, parent scratch directories and server PIDs were independently checked absent.

`verified` is server media verification/assembly/compression only. `windowComplete` proves 60-minute ledger age, not that old/new instances during rolling deployment all emit observations. Uninstrumented old routes, historical/other-channel requests, HTTP delivery and client CRC are outside the coverage proof.

Upload events, real alert responder/delivery and provider qualification remain unavailable; admin readiness remains 503/not_ready. No real family data, external paid API, remote migration, main merge, deployment or unqualified milestone push is involved. Existing Next configuration/service-key build warnings remain; dependency audit was not rerun.
