# AI editing repair evidence

- `red-unit.log`, `red-ui.log`: missing feature regressions.
- `red-stale-pending.log`, `red-stale-readiness.log`: behavioral native failures before source-CAS invalidation/readiness repairs.
- `targeted.log`: 6 Jest suites, 59 tests passed (route, model, UI, policy).
- `native-chrome/results.json`: 41 full migrations, 827 assertions, existing G2 + AI native/Chrome accepted; no source drift. Controlled provider HTTP only. Screenshots in same folder.
- `final-stale-readiness.json`: final AI source/CAS readiness repair native run; latest report supersedes SQL scenario bytes in previous Chrome run. The final small readiness patch has native coverage but Chrome screenshot run precedes it.
- `typecheck.log`: web TypeScript check after AI integration.
- `source-hashes.json`: owned source list and final SHA256.

All runs use local synthetic families, real PG17.4 complete migration graph, service-role connections, and loopback model transports. No real paid model call, remote migration, commit, push or deployment. Model quality and contractual qualification remain external gates.

## Independent-review fixwave

- `red-attribution.log`: all three added scenarios fail before fixes: corrected transcript loses family source kind; individually corrected segment loses family source kind; same-text modify incorrectly retains AI support.
- `fixwave-native-chrome/results.json`: final 41 migration chain, **1203 assertions passed**, sourceDrift empty. Runs `--ai-edit --semantic-search --g2-review --chrome` after both fixes. Includes native positive checks for literal and semantic retrieval of family claims, correction author distinct from AI requester, no original audio timing, and same-text modification dropping AI source support.
- New Chrome screenshots: `chrome-ai-corrected-source.png`, `chrome-ai-same-text-modification.png`; both production UI workflows approve and reload with family attribution intact. Existing AI, G2 and semantic controlled-HTTP/browser scenarios pass in the same run.
- Production edits are limited to AI assertion insertion/support in `20261113000002_story_ai_edit.sql` and supplement-first claim projection in `20261113000003_semantic_sources.sql`. No historical migration edited.
- `git diff --check` passed. No new TypeScript change in this fixwave; prior 59 targeted Jest tests remain separate evidence rather than being relabelled as rerun.
