# Task 1 collector spec review — Fix 1

**SCOPED PASS — P2 closed; no introduced spec regression found.** Re-reviewed on 2026-10-17. This supersedes the open environment-isolation finding in [the initial review](capture-spec-review.md); its remaining scope and limitations still apply. Real capture and routine semantics remain outside this review.

The [local harness](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L13) filters case-insensitive `PG*` and `DATABASE_URL` keys before accessing their values. Its [async wrapper](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L20) installs the filtered environment before loading `pg`, retains it through client connection, catalog queries and teardown, then restores the original environment object in `finally`. [Subprocesses](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L82) also receive the filtered environment explicitly. The [client](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L102) sets `ssl:false` and a nonempty inert password, avoiding ambient TLS/password and passfile fallback. Existing fixed Unix socket, disabled TCP listener, synthetic definitions and bounded cleanup remain intact.

Independent targeted verification:

```sh
SAGA_ROUTINE_LOCAL_PG=0 node --test --test-name-pattern='local environment|local worker environment' scripts/__tests__/inspect-supabase-routines-local.test.cjs
```

Result: **2/2 passed**, exit 0. These tests prove discarded values are not read, the environment remains filtered across an asynchronous boundary, and restoration occurs after failure. No database was started or contacted by this review.

Inspected [hostile-environment RED](capture-fix1-red-hostile.tap), [scrub RED](capture-fix1-red-scrub.tap), [hostile-environment GREEN](capture-fix1-green-hostile.tap), and [verification record](capture-fix1-verification.json): the original fixture failed with unsupported SSL; new helper expectations first failed; the final supplied run passed **45/45**, including the local SQL fixture. That full run was not repeated here.

Recomputed fingerprints confirm that only the local test changed among the seven previously reviewed source/ignore files. Production target selection, privacy, persistence, role/TLS checks, async deadline and the 16 metadata SQL strings therefore retain their prior reviewed bytes. No credentials, remote connections, business routines, dependencies, commits or implementation edits were used in this review.

## Reviewed source SHA-256

| File | SHA-256 |
|---|---|
| `scripts/__tests__/inspect-supabase-routines-local.test.cjs` | `36380df711bcbe86ebc793d79c02326d5f0564769b73d00488b8ea421fefcf29` |
| `scripts/inspect-supabase-routines.cjs` | `f838b8762324302073bdfc657551069666357b9a2bd66299a3fe2f6ec4d4f928` |
| `scripts/supabase-capture-runtime.cjs` | `6b6e2ed78758076af37cb6fa2383d61f0e07090b32d44288b3abe46c6e15353a` |
| `scripts/inspect-supabase-metadata.cjs` | `be8f08d62a6ac3fcae20911f8b6569dab8f6a52bb2e099a233855ac63f8e27d2` |
| `scripts/__tests__/inspect-supabase-routines.test.cjs` | `0bd3c95ca57d60566ca0bf3df46d33866f03f03d005d81b0d42b9ad0b6adbdc8` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `772cf50cb7fa3d5cfbc9c07400a842b5dbe9039db37f83504a64d0e00406686a` |
| `.gitignore` | `d32441029111fe11e841724d2cc515f05029d6d46160336239acd0c034d1ef67` |

## Reviewed evidence SHA-256

| File | SHA-256 |
|---|---|
| `capture-fix1-red-hostile.tap` | `5c895f3a44ce6c2df0f1d792468ddfa8d00a21927f68b69a0867e9482c7b0c6b` |
| `capture-fix1-red-scrub.tap` | `82019f26811c8ddb32e2d30baae00895f1919e470d8bcb0832cd350a75086965` |
| `capture-fix1-green-hostile.tap` | `eaf8d5a074ebcdca70136fb67ea96ff59996dcf2eebaa601cc67fa5a25033815` |
| `capture-fix1-verification.json` | `a0e57a20b7afa1614190d2ed063b364a6964855bab701f387a81de68a170c352` |
