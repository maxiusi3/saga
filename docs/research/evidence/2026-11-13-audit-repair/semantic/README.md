# S2 semantic retrieval evidence

Verified 2026-11-13 against the current uncommitted repair worktree. No remote migrations, live paid model calls, commit, push or deployment.

- `red.log`: original literal implementation fails the explicit semantic/no-overlap regression (`searchMode` remains `literal`).
- `native-ai-red.log`: before the approved-AI projection fix, native regression fails `approved AI source is discoverable`.
- `focused.log`: 6 suites, 122 tests passed. Covers actual cosine ranking, 60-source corpus before top-50 selection, consent/config/authorization, changed sources and assets, deletion, withdrawal, final rerank revalidation, malformed vectors/indexes and stalled provider/body reads, real route parsing and UI consent action.
- `lint.log`: no ESLint findings in owned production modules.
- `types.log`: last web type check had no S2 errors; concurrent parent Zod migration still had waitlist/pilot-ledger compile errors at that snapshot. Parent owns the final all-workspace gate.
- `native.log`, `native-results.json`: complete native PG17.4 migration chain, 41 migration/bootstrap files, 219 assertions, no source drift, clean cluster/client teardown. Includes actual Supabase SDK HTTP and actual route handlers against synthetic PostgREST/Storage with a controlled Voyage-shaped HTTP server. Full source hashes are in `native-results.json`.
- `semantic.json`: provider request count/shape and SDK request evidence. No vector/text persistence.
- `chrome.json`, `semantic-chrome.png`: installed Chrome 157.0.8103.78, production ConnectedProjectHub, semantic consent control, real search client/routes, literal zero-result baseline, explicit semantic result, protected source audio retrieval and configured-off disclosure. Screenshot visually inspected; content and controls fit without clipping.
- `literal-native.log`: regression of the existing authoritative literal search projection through full native schema.

Commands:

```sh
npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/semantic-search.test.ts 'src/app/api/projects/\[id\]/search/__tests__/' src/lib/__tests__/project-hub-client.test.ts src/components/projects/__tests__/semantic-search-control.test.tsx src/components/projects/__tests__/two-entry-project-hub.test.tsx
node experiments/g1-local/verify-migrations.mjs --semantic-search --chrome
node experiments/g1-local/verify-migrations.mjs --g3-search
npm run type-check --workspace=packages/web
```

The first native invocation required unsandboxed local shared-memory access. The first complete attempt was blocked by an unfinished sibling AI migration; that migration was fixed before the recorded passing run. The original run folder is named in `native.log`; this folder contains copies of its semantic evidence, without modifying historical evidence.

Native positives include complete 256-entry collection, rejection at 257 entries, per-source character and total UTF-8 byte bounds, source correction invalidating playback, approved AI assertions discoverable only as exact source quotes, and real approval/revision/timing linkage. Negatives include SQL role spoofing, other-family requests, missing consent, revoked member during embedding, asset mutation during embedding, withdrawn consent, deletion while awaiting provider, severe AI evidence rejected and pending AI never claiming approval.

Controlled vectors prove computation and application integration. They are not evidence of Voyage live availability, retrieval quality, data residency, account retention terms or household accuracy. Those remain external qualification requirements before enabling production configuration.
