# Task 1 follow-up independent review

Reviewed `review-fixes.patch`, the corresponding current source/tests, and the installed Supabase SDK's `info()` result contract and `asStream()` implementation. Scope is the three findings in `task-1-review.md` and effects introduced by their fixes. No implementation edits, Git operations, external requests, subagents, or test-suite reruns.

## Verdict

**Spec: pass for the reviewed delta. Quality: approved; no new actionable blocking findings.** All three original findings are closed. This is code-review approval; final Task 1 acceptance still requires the controller's successful post-fix full verify and delivery-record updates.

1. **P1 download bound — resolved.** `packages/web/src/app/api/ai/transcribe/route.ts:89` calls `info(reference.path)` only after shared authorization and rejects a reported oversized object before download. Line 98 uses the installed SDK's `download(reference.path).asStream()`, which exposes `Response.body` rather than invoking `blob()`. Lines 114–124 count actual bytes, cancel on the first chunk that exceeds 100 MiB, avoid retaining that chunk, return 413 before provider work, and release the reader lock. Missing/underreported size cannot bypass the streaming limit. Both metadata lookup and download retain the same bucket/key, and the object's basename and SDK-normalized metadata `contentType` feed the existing MIME selection.

2. **P2 inherited MIME lookup — resolved.** `packages/web/src/lib/media-reference.ts:50` now checks an own property before returning a mapping; `constructor`/`__proto__` and other unknown extensions therefore use `application/octet-stream`. Existing provided MIME and supported extension mappings remain intact.

3. **P3 C1 controls — resolved.** `packages/web/src/lib/media-reference.ts:17` rejects U+007F–U+009F as well as C0. The existing ordinary Unicode/space filename regression is retained, while the new U+0085 route regression requires 400 with no Storage call.

## Verification reviewed

- `review-red.log`: **6 failed / 46 passed**. Failures directly reproduce both invalid MIME values, the accepted C1 key, the absent/low size stream bypasses, and download beginning despite oversized metadata. They are behavioral failures, not setup failures.
- `focused-final.log`: **3 suites / 75 tests passed**. New stream cases use real `ReadableStream`s, assert cancellation exactly once after the first over-limit chunk, and assert no provider call. The oversized metadata case asserts no download.
- At final inspection, `verify-final.log` records type-check/lint, **58 suites / 488 tests passed**, successful compilation/TypeScript, and 174/174 generated pages followed by the final route table. The controller must still record the command's terminal exit/result separately; this reviewer did not launch or poll that process.

The revised path bounds accumulated media bytes; it is not a constant-memory upload pipeline or an exact 100 MiB process-memory ceiling, because accepted chunks are subsequently assembled into a contiguous buffer and provider Blob. That is a bounded implementation of this batch's requirement and does not reopen the original unbounded-download finding. The initial report's statement that SDK Blob buffering remains must be updated in the final delivery record.

All earlier scope limits remain: this review does not certify direct Storage RLS, asset identity/history mapping, revocation during signed-URL TTL, cleanup/deletion, provider qualification, real-device/online behavior, or G0/G1 completion.
