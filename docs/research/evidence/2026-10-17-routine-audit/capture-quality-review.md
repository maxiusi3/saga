# Task 1 collector quality review

**CHANGES REQUESTED — one P2 finding in the local fixture.** Reviewed on 2026-10-17 after the Fix 1 spec pass. No material production-collector or shared-runtime defect found within this scope.

- **[P2] Complete cleanup when PostgreSQL startup fails before a server exists.** [The fixture sets `started = true` before `pg_ctl start`](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L99). If startup returns nonzero without leaving a running server, [cleanup unconditionally requires `pg_ctl stop` to succeed](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L86). Its ordinary “no server running” failure throws before the stopped-state check and temporary-directory removal; [listener removal is skipped too](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L144). This leaves the initialized cluster behind on a failed test run. Keep cleanup bounded, distinguish an already stopped server from a failed stop of a live server, and remove the temporary tree once absence is verified. Add a synthetic startup-failure regression; do not merely move the flag after startup, since startup can time out while leaving a server running.

Independent targeted reproduction evaluated the **current test source** in a VM, selecting only its real-catalog test callback and replacing filesystem/process/subprocess operations with synthetic fakes. `initdb` returned 0; both `pg_ctl start` and `stop` returned 1 with no server. No PostgreSQL process, credentials or network was used. Result:

```json
{"error":"LOCAL_PG_CTL_FAILED","commands":["initdb","start","stop"],"scratchRemoved":false}
```

Reviewed target/attribute/hash validation, malformed and missing results, public serialization, private permissions/exclusive creation/symlink checks, rollback and connection-close failures, and asynchronous deadline handling. The shared helper preserves the original lifecycle with parameter forwarding added. Independent comparisons confirm all **16 metadata SQL strings**, export keys and the credential/configuration/error-code/section helpers equal the saved baseline; the 23 original regression assertions have only VM wiring changes. The pinned snapshot resolves to exactly 12 targets. The precise ignore rule is active. The supplied hostile-environment TAP reports **45/45**; it was inspected, not rerun. Fix 1 environment isolation remains intact.

No broad tests, remote capture, business-routine execution, implementation edits, dependency changes, commits or subagents were used. This report is the only file written. Production semantics and PG17 behavior remain outside this review.

## Reviewed source SHA-256

| File | SHA-256 |
|---|---|
| `scripts/inspect-supabase-routines.cjs` | `f838b8762324302073bdfc657551069666357b9a2bd66299a3fe2f6ec4d4f928` |
| `scripts/supabase-capture-runtime.cjs` | `6b6e2ed78758076af37cb6fa2383d61f0e07090b32d44288b3abe46c6e15353a` |
| `scripts/inspect-supabase-metadata.cjs` | `be8f08d62a6ac3fcae20911f8b6569dab8f6a52bb2e099a233855ac63f8e27d2` |
| `scripts/__tests__/inspect-supabase-routines.test.cjs` | `0bd3c95ca57d60566ca0bf3df46d33866f03f03d005d81b0d42b9ad0b6adbdc8` |
| `scripts/__tests__/inspect-supabase-routines-local.test.cjs` | `36380df711bcbe86ebc793d79c02326d5f0564769b73d00488b8ea421fefcf29` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `772cf50cb7fa3d5cfbc9c07400a842b5dbe9039db37f83504a64d0e00406686a` |
| `.gitignore` | `d32441029111fe11e841724d2cc515f05029d6d46160336239acd0c034d1ef67` |

Reviewed anchors: pinned snapshot `8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e`; saved metadata baseline `df6493a88f861f720ba105efdf38aef34cb4e01a0cb3732cdd447f3f95670615`; `capture-review.diff` `2767269e7495618ce4cade4b503df78b23f5a520d4984ef71565293bc5550047`; `capture-fix1-green-hostile.tap` `eaf8d5a074ebcdca70136fb67ea96ff59996dcf2eebaa601cc67fa5a25033815`.
