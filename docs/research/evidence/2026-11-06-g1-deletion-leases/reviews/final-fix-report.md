# M1 final correction — DONE, source FROZEN

Only the adapter and its adjacent test changed. The parser now rejects failed attempts 1/2 and retry_wait attempt 3 with the existing generic error. The corrected positive fixture and explicit controls retain retry_wait 1/2, failed 3, and outcome_unknown 1/2/3. All receipt capability flags remain false; G1 remains 0/9. Parent owns the full gate and scoped re-review; no unresolved implementation concerns.

| Evidence (under `docs/research/evidence/2026-11-06-g1-deletion-leases/`) | Result |
| --- | --- |
| `final-fix-jest-red-01.json` / `.log.gz` | Expected exit 1: exactly the three impossible recoveries resolved instead of rejecting; 82 skipped. |
| `final-fix-jest-final-01.json` / `.log.gz` | Exit 0: 85/85 tests. |
| `final-fix-native-adapter-01.json` / `.log.gz` | Exit 0: actual existing SQL/adapter runner, 3 groups / 281 assertions. |
| `adapter-1793985490922-059af2d5-4041-4b95-b02d-28033c060bee/results.json` | Corrected adapter hash; all 29 source hashes match; cluster stopped, temp directory removed, zero clients/errors. |
| `final-fix-eslint-01.json` / `.log.gz` | Exit 0: canonical root ESLint, only the two changed files. |
| `final-fix-patch-check-01.json` / `.log.gz` | Exit 0: reverse patch check. |

All command records have zero source drift; archives and decompressed hashes were verified. Native result SHA256: `de9c80394a61be1dbe6d5576607bc12fffa335507f834069e6e9439ae633fac9`. Compiled adapter SHA256: `5fd7ee62f2e4ee3420b3ab0096a341569d43debc72fab0f4bdc9170bde762e77`. Native transport remains local pg, not live PostgREST; existing whole-review qualification limits remain unchanged.

| File | Exact before SHA256 | Exact frozen after SHA256 |
| --- | --- | --- |
| `packages/web/src/lib/server/media-deletion-lease.ts` | `03db82114edcc0aa3cfc903977c482993385862d210c42a6d452cfd42e90e844` | `9d38b746b82142b5d085b12e82b1b426ae8f071d58a3dda0703c0ecc2154e4a5` |
| `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts` | `347cc570f87bf365e9990263f40bd98910c964136ea9b88d928eb5e82d461614` | `54ccef1ad269ee3f70f6d904d4cda6d93beb1c5bf1a1ae37be1d73c23101620a` |

`final-fix.patch` is based on the exact `final-fix-before/` copies, never Git HEAD. Patch SHA256: `9ae9f4921770c29c594fe9b0a89522d66d6f17d7782878a08bba5cdae2042b95`. A reverse apply in an isolated temporary directory reconstructed both saved before hashes exactly and was cleaned up. `git diff --check` passed; HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`, index empty.

All **72/72** paths in `pre-final-fix-evidence.json` retain their exact hashes; no earlier report, review, manifest, patch or log was edited. No SQL, fixture, runner, other adapter or inherited source was edited. Only unique command/native evidence and this final-fix package were added. No stage, commit, push, remote operation, real data or destructive capability was used. Exact references and checks are in `final-fix-hashes.json`.
