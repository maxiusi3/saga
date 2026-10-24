# Task 4 legacy deletion — independent quality review

Result: **Approved**. No actionable correctness, privacy, or regression findings in the scoped change.

Reviewed on 2026-10-23 against the legacy-deletion requirements and dead-handler clarification in `docs/superpowers/specs/2026-10-23-storage-definition-capture.md:27–37`. All eight SHA-256 values in `legacy-deletion-files.json` matched the reviewed files. The scope is the five named production files and three named tests; unrelated dirty changes were not evaluated.

- **Endpoint:** `packages/web/src/app/api/media/delete-image/route.ts:5–16` authenticates first, returns the original rejection response with `no-store`, and returns a generic authenticated 503 with `MEDIA_DELETION_UNAVAILABLE`. The request body is neither parsed nor reflected, no admin client is obtained, and no deletion operation remains. The route tests execute the real header-merging helper and verify both authentication branches, all refreshed cookies (including a comma-bearing Expires value), response identity for rejections, and zero body/admin/Storage calls. The authentication provider itself is mocked.
- **Services:** `packages/web/src/lib/stories.ts:191–193` and `packages/web/src/lib/storage.ts:177–179` preserve their asynchronous boolean interfaces and return false before any database or Storage method can run. The exported helper at `storage.ts:302–303` delegates to the same closed method. The stateful regression fixture models the former ignored-Storage-error deletion and verifies that both audio-bearing and audio-free stories remain, with zero database/Storage calls. The storage upload changes are outside this task's deletion scope.
- **Image state:** `packages/web/src/components/interactions/story-interactions.tsx:363–397` leaves uploaded references and persistence untouched for Remove and Clear images. The Clear guard precedes every state update, object-URL revocation and file-input reset. Neither uploaded-image handler sends a request or retains an asynchronous deletion continuation. Existing local-preview removal and clearing still update their file queues. Rendered-component tests cover settled fresh uploads and restored references without object paths, check persistence and absent requests, and verify local queue behavior through subsequent submit attempts.
- **Project page:** `packages/web/src/app/[locale]/dashboard/projects/[id]/page.tsx:169–187` changes only the existing failure messages. The handler has no call site in the page; no rendered deletion control or permanent banner was added. This is source inspection, not evidence of a user-facing story deletion interaction.

Independent verification used the exact scoped command recorded in `legacy-deletion-green.log`:

```text
npm test --workspace=packages/web -- --runInBand --runTestsByPath src/app/api/media/__tests__/delete-image-unavailable.test.ts src/lib/__tests__/legacy-deletion-unavailable.test.ts src/components/interactions/__tests__/story-images-deletion-unavailable.test.tsx
```

Exit 0: **3 suites, 18 tests passed**, Jest time 2.989 seconds. The assertions exercise observable outcomes rather than only checking implementation text. The service mocks and mocked upload responses make this local regression evidence, not integration evidence against Supabase.

Limits: the UI tests use settled mocked uploads and do not establish cancellation behavior for in-flight uploads; the pre-existing upload completion/submit scheduling is unchanged. This approval covers the local deletion closure only. It does not establish production Public URL revocation, direct SQL/Storage policy enforcement, physical deletion, a formal deletion adapter, or P0 completion. No implementation edits, remote access, credentials access, or full verification were performed. Parent full verify/shared/infra remains required.
