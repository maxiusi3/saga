# G3 T10 local search evidence

Implemented current-source literal search and source-bound playback. Production does not read `search_index_entries`. It projects exact current transcript/revision/assertion records under membership, source identity, ready audio and project/story/asset/session deletion fences. Approved G2 decisions become searchable without index seeding; rejected claims and unapproved edited assertions are absent from approved results. A correction switches active source while preserving immutable approved history. Supplements and dispute alternatives retain attribution and null audio timing.

Search supports literal keyword/person/year/place filters. Results say `source_matches`, `searchMode: literal`, `semanticSearch: unavailable_unmeasured`. This is no semantic-model or historical-truth qualification. The current service bounds work at 200 active stories, 10,000 segments, 2 MB source text (4 MB including approved rendition), 50 results and 1,200 Unicode characters per excerpt; oversized archives receive an explicit work-limit error. Excerpt offsets count Unicode code points.

`POST /api/projects/[id]/search/source` accepts only the citation identity (entry, story/revision, transcript, segment, asset, source hash/fingerprint and actual times), never quote prose. The database resolves the same current projection and the route rechecks after protected media access before releasing the URL. Corrected/stale sources return 409 and revoked members return 403. Unaligned sources have no playback controls.

Validation:

- `search-red-null-timing.log`, `search-red-authority.log`, `search-red-unaligned-ui.log`, `search-red-client.log`: original fake timing and missing authority/client behavior.
- `search-native-red.log`: missing authoritative RPC.
- `search-native-debug.log`: real UTC/Taipei JSON fingerprint mismatch. The migration now fixes the G2 fingerprint function timezone to UTC for every caller.
- `search-red-session-fence.log`: legacy confirmed-session tombstone reproduced, then closed.
- `search-red-playback.log`, `search-native-red-playback.log`, `search-red-playback-client.log`: missing protected current-citation playback path.
- `search-green-focused-final.log`: 6 suites / 114 tests passed.
- `search-lint-final.log`: focused checks passed using the repository root ESLint executable. Initial direct workspace `npx eslint` loaded incompatible ESLint 10; that tooling failure is preserved in `search-lint.log`.
- `search-native-playback-green.log`: complete bootstrap plus all migrations, 191 assertions including schema checks, G2 approval/correction, forged legacy index, current asset/hash binding, Unicode literal search, bounded results, cross-story/cross-project source rejection, null timing, session tombstone, G1 erasure, playback stale-source and member revocation rejection. Disposable cluster cleanup completed.
- Native detailed evidence: `migrations-1794370303638-02ad384d-86f2-48ff-90c4-50dacd170fc5/results.json`.
- `search-source-hashes.json` records source hashes at completion. Shared client/export files may subsequently change during parent integration.

Earlier web type checking found only archive-owned `publication-source-service.ts` errors while that parallel implementation was in progress; `search-type-check.log` is a partial development result, not the final combined gate. Parent owns integrated Chrome, full verification, and final receipt. No staging, commits, push, remote migrations or deployment performed.
