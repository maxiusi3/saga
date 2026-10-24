# Storage definition capture and legacy deletion — final independent review

Result: **PASS / Approved**. No actionable findings in the scoped batch.

Reviewed on 2026-10-23 against the Storage definition capture specification, implementation plan, repository conventions, and the original main-plan sections 7/7.1 and T00/T01. Scope is the 16 source files named in `verification.json`, their integration and retained evidence, the new P0 research record, and the latest handoff/main-plan/preparation-plan/docs-index paragraphs. The rest of the large pre-existing dirty branch is not re-reviewed here.

## Implementation and specification

- The collector pins the original snapshot digest, accepts exactly six function and seven trigger identities, rejects CLI overrides and broader/duplicate target sets, and sends only exact identities in parameterized catalog queries. Both groups share the existing verified, bounded, read-only transaction and rollback. The collector does not call captured routines or read business rows or objects. Missing, malformed, unexpected and changed results cannot become a successful capture.
- Trigger validation covers the previous metadata attributes, recomputed definition MD5, argument byte encoding/NUL termination/count, and condition presence. Full trigger definitions retain readable WHEN syntax while private `tgqual::text` retains the node representation. The PG17 fixture and preserved SQLSTATE 22023 evidence justify this change from `pg_get_expr`; the fixture is explicitly synthetic and does not execute the captured functions.
- Public capture fields remain allowlisted. Private bodies, argument bytes and conditions use the existing exclusive 0700/0600 writer; safe errors do not reflect database messages or credentials. The successful live report is scoped to the fixed thirteen identities and records verified TLS, the read-only session and connection closure.
- The authenticated image-delete route returns the required generic 503/code/no-store response and preserves auth cookies and headers through the actual shared helper. Authentication rejection is retained with no-store. Neither branch reads request JSON, creates an admin client or calls Storage deletion. Both legacy service methods unconditionally return false without database/Storage operations; the exported file helper delegates to the closed method.
- Uploaded-image Remove and Clear leave references, persistence, previews and queued files untouched and show the unavailable message; they send no deletion request. Purely local removal/clearing remains supported. The project-page handler has no rendered deletion call site, and the change does not add one. The other story-delete facade still targets the absent DELETE handler and cannot become a successful compatibility bypass.
- The three new regression suites test response/header behavior, state retention and zero deletion I/O. Their stated limits are accurate: authentication/uploads are mocked, uploads are settled, and the tests do not qualify in-flight cancellation or live Storage behavior. No unrelated refactor or newly enabled destructive path was found.

## Evidence and integrity

Independent read-only recomputation found no mismatch in the final manifests: **16/16** source hashes in `verification.json`, **810/810** in `project-verification.json`, **8/8** in `legacy-deletion-files.json`, **7/7** in the final PG17 report and **3/3** in the live capture report. These sets overlap; they are not separate counts of unique files. The 805-file starting manifest differs only in the five expected application files, and `next-env.d.ts` matches its starting bytes.

The fixed snapshot, CA and both catalog-query hashes match. The private capture's aggregate hash matches; all **13 definition SHA-256/MD5 pairs**, **7 argument hashes** and **7 condition representations/hashes** agree with the public report. Current private permissions are 0600/0700 and Git ignores the private path. This integrity check parsed private data without printing bodies, arguments or credentials.

The three pinned PostgreSQL binaries, Node executable, pg entry file, both SDK source hashes cited by the semantic audit, and the two cited prior-composition fixture hashes match. The final PG17 scratch directory is absent. The previous experiments remain historical evidence; their omitted triggers, enum/role differences and shim limits are not silently upgraded to full compatibility.

Retained logs agree with the summaries: collector **53 passed**; final local PG17 **34 assertions / 4 scenarios**, successful cleanup; valid deletion RED **16 failed / 2 passed**, then GREEN **3 suites / 18 passed**. The initial fixture failure remains separate from valid behavioral RED. The four component reviews apply to the same frozen source bytes and report PASS/Approved.

The new project report records three successful commands between **18:52:57 and 18:56:11 Asia/Taipei**. Logs confirm Web **108 suites / 1438 tests**, shared **4 / 16**, infra **7**, and **180** static pages. The unchanged 810 input hashes support using that completed run for this review. I did not rerun tests, the PG17 fixture or the remote collector.

Representative frozen evidence SHA-256 values:

| Evidence | SHA-256 |
| --- | --- |
| Live capture report | `eb5e76b7d39a8eeff4b1fc59ee37704b4278dd531ee0b287673f38ad8ea024a1` |
| Final local PG17 report | `4d6e492f20e0a9e796b24b27d84ebd63cbfea38dfb59a8d8a760b5c9130cf78a` |
| Semantic audit | `887b2c40ab5ebea346649a9cf56d1e20d4fb8e09cd48e0db66a389bb972ce354` |
| Project verification report | `06ed1103a01f1ce1499a9b5f6e4f5d4a789c085ab2e164cd905662f023f4202d` |
| Project verify log | `2202f733dc7e056b11cbb11b327961976379e1e4f598a7ccbe95de2400e4a99f` |
| Shared log | `54ee808bb1994bb4e13a536b16ef8fc5ed4c3c181ef806b44f5b9b21a90f1b3c` |
| Infra log | `8be0ca93f1d4e6561a9146f46ed192bc7648fcb2a0be558d3d25b378262a4c33` |
| Collector GREEN log | `228c7d474f0ef56aca3958b62dc8d9e796149a8150fceead7db3e5ffb8595583` |
| Deletion GREEN log | `1528c0d158f88344c65e12baf0f5e12680e4f9c4ea5deb1eb4f00579d2ff0ac2` |

## Documentation and milestone decision

Independently checked **468 local links across 13 scoped documents**: all targets exist. The newest entry paragraphs distinguish this batch from older frozen history and agree on counts, dates, scope and remaining work. The semantic audit distinguishes SQL DELETE/GUC protection from SDK HTTP deletion, member checks from effective-role checks, and static definitions from behavioral qualification. Its public metadata and cited source fingerprints are consistent with the capture and inspected integration.

The original G0 definition is preserved. Decisions/measurement definitions and a reviewable prototype have evidence; actual private-access boundaries, feasible migration/recovery and qualified provider account/data conditions remain incomplete. T01 observation remains **0 of 6–8 households**. Full adapters and deferred-by-user device testing are correctly listed under subsequent P1/G1 work, not added as new G0 prerequisites. `milestone-check.json` correctly keeps P0 and G0–G4 false and the push condition unmet.

Known limitations remain explicit: Public buckets and deployed old code are unchanged; real Auth/JWT/PostgREST/Storage HTTP, production role/service behavior, migration/backups/recovery and provider accounts are unqualified. Local deletion closure is not physical deletion or a finished deletion adapter. Existing Next configuration and missing `SUPABASE_SERVICE_ROLE_KEY` diagnostics remain in the successful build log. The historical 42 dependency findings were not rerun or resolved by this batch.

At review time, `verification.json` intentionally remains `validated_pending_final_review` and the plan's final-review checkbox remains open for the parent to finalize after this result. Those pending bookkeeping fields are not implementation findings. This approval establishes completion of the scoped local batch only; it does not authorize a milestone push or deployment. No source or other document was edited during this review; no remote operation, commit or push was performed.
