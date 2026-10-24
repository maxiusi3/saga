# Task 1 independent review

Reviewed the supplied `task-1-diff.patch` against `task-1-brief.md` and the implementation report, with relevant unchanged authorization, storage-client, SDK, and repository guidance code. This review records the original snapshot, before controller follow-up fixes. No Git operations, implementation edits, subagents, external requests, or test-suite reruns were performed. Two small in-memory probes exercised the actual transpiled pure parser/MIME module.

## Spec compliance — changes required

The principal authorization changes match the contract: project/story membership takes precedence over uploader ownership; story access resolves the actual `stories.project_id`; private objects require the exact owner; storage uses the requested bucket/key without fallback; authentication and authorization precede media effects; named files and original image bytes are preserved. Signing/image responses preserve cookie chunks and use `no-store`. Scope exclusions remain explicit.

Three actionable gaps prevent approval of the original snapshot:

1. **[P1] Bound the download before fully buffering it** — `packages/web/src/app/api/ai/transcribe/route.ts:88` (size check at line 98). Brief line 31 requires the 100 MiB boundary to “避免无限读入”. Awaiting `download()` has already read the entire response: the installed SDK calls `await result.blob()` in `node_modules/@supabase/storage-js/src/packages/BlobDownloadBuilder.ts:47`. An oversized authorized legacy/directly uploaded object therefore consumes its full memory/network budget before the 413 check, potentially exhausting the route. The test at `packages/web/src/app/api/media/__tests__/access.test.ts:210` only avoids a *second* `arrayBuffer()` read of an already materialized Blob. After authorization, preflight available object metadata and use a bounded stream with cancellation when actual bytes exceed the limit; test absent/underreported metadata and assert no provider call.

2. **[P2] Make MIME fallback ignore object prototype properties** — `packages/web/src/lib/media-reference.ts:50`. Brief line 30 requires unknown extensions to remain `application/octet-stream`. The ordinary object lookup returns inherited properties for accepted filenames such as `voice.constructor` and `voice.__proto__`. An in-memory probe against this module produced outgoing Blob types `function object() { [native code] }` and `[object object]`, respectively. Use `Map`, a null-prototype table, or an own-property check, and regress these unknown names alongside a known audio extension.

3. **[P3] Reject C1 control characters in raw keys** — `packages/web/src/lib/media-reference.ts:17`. Brief line 7 rejects control characters, but the regex only covers C0 and DEL. The actual parser accepts `alice/projects/family-a/voice\u0085.mp3`; U+0085 is a Unicode control character. Such input reaches authorization/Storage instead of the specified 400/no-I/O path. Include U+0080–U+009F (or the agreed complete control category), preserving ordinary Unicode/space filenames, and add a route regression.

## Standards and quality

No separate documented-standard violation or justified architectural-smell finding was identified. The shared pure locator/server guard split fits `CLAUDE.md`; the boundary doubles retain production parser and project checks. Quality verdict: **request changes for the three concrete findings above**. The buffering limitation is candidly reported but is still an unmet requirement of this batch, rather than a deferred asset/Worker feature.

The controller's question about empty `signedUrl` objects is **not a blocking finding**: the installed SDK constructs `{ signedUrl: string }` for its success result, while the route handles error/null results. An empty-field check could be defensive hardening, but no reachable empty-field failure was established with this SDK. Existing malformed provider-response behavior would need stronger validation than a truthiness check. Image signing/upload failure coverage could be broadened without treating a fabricated SDK shape as a demonstrated production bug.

## Verification evidence and limits

- Read the saved red logs: media 43 failed / 3 passed, client 3 failed / 12 passed, cookie chunks 1 failed / 46 passed. The sampled failures are behavioral assertions (including unauthorized 200s and lost cookies), not environment setup failures.
- Read `focused.log`: 3 suites / 70 tests passed. Read `type-check.log` and `verify.log`; the latter records 58 suites / 483 tests and successful compilation/static generation. The controller separately confirmed full `npm run verify` exited 0 after this snapshot, including type-check/lint/build.
- Passing suites do not cover the three findings. No suites were rerun in this review.
- Direct Storage RLS, historic mappings, issued-URL revocation during TTL, orphan cleanup, deletion, provider qualification, real-device/online validation, and G0/G1 completion remain outside this review's approval claim.

The controller has acknowledged all three findings and is preparing fixes. A follow-up review must assess that delta and its new verification evidence before Task 1 is declared accepted.
