# G3 payment completion and independent integration review

Date: 2026-11-11. Scope: T11 payment implementation, an independent review of the search implementation, and an independent review of the publication CLI/UI, project-creation integration and backup helper. All work used the existing dirty checkout. No staging, commits, push, hosted migration, live Stripe call or real charge was performed.

## Findings and closure

| Priority | Finding | Closure and evidence |
| --- | --- | --- |
| P1 | The bootstrap's authenticated direct `projects` INSERT permission and self-owner policy bypassed the new paid-order compatibility RPC. A new account could create a project with the legacy default paid status. | `payment-direct-insert-red.log` preserves the real native PG17.4 negative failure. Migration03 line 726 now revokes table and column INSERT privileges from PUBLIC/anon/authenticated and drops the permissive INSERT policy. `payment-scenarios.mjs:47` now receives SQLSTATE 42501. The final native run also verifies successful trusted allocation and its retry through the compatibility RPC. |
| P2 | The search response validator counted titles with JavaScript UTF-16 `.length`, while PostgreSQL `left(title,500)` counts Unicode characters. A valid 300-emoji title made the complete search response fail with 500. | `payment-review-search-unicode.json` preserves the actual compiled-module failure. The search author changed the validator to `Array.from(...).length` at `authoritative-search.ts:39`. `payment-review-search-unicode-green.json` records acceptance of the same source, and the two route suites pass 34/34. |
| P2 | The backup helper assumed the entire database contained exactly two entitlement sources and that the first payment right belonged to its own fixture. This is invalid when payment acceptance runs first. | `g3-backup.mjs:46–47` now filters the source assertion by the fixture intent and the rights assertion by its order. Its full-table before/after restore comparison remains intact. The helper fix was independently read; the parent agent owns final combined backup execution. |
| UX | The purchased-project status exposed a UUID and raw ISO timestamps. | `purchase-panel.tsx:66` now says “Project ready” and displays readable UTC dates. The navigation target still uses the actual project identity. The final installed-Chrome screenshots include this version. |

No additional confirmed blocking defect was found in the final read of the payment routes, SDK service, browser client, checkout, panel and complete migration. The review is scoped to the local G3 acceptance boundary below.

## Payment behavior checked

- Explicit `PAYMENTS_MODE=test`, test secret key and webhook secret gate initiation; live charging remains disabled.
- Stable server order/request identity and provider idempotency key survive retries, lost responses and page reload. Unbound orders older than the 23-hour safety window require reconciliation.
- The actual Stripe SDK verifies the raw signed body. Event mode, object type, intent/order/payer/package, amount and currency must match. Successful fulfillment requires a succeeded intent with the full amount received.
- Signed refunds are checked against the retrieved intent and current charge. Duplicate, concurrent and out-of-order events serialize. Full refund is terminal and revokes only source-bound rights; refund before first success suppresses grants. A partial refund before fulfillment enters `refund_review` without minting rights.
- Trusted invitation source, event, audit and allocation identities agree. Reserve/consume/refund/release cannot restore a refunded source, adopt legacy wallet credits or remove an unrelated purchase or preexisting project owner.
- An authenticated paid order can create a usable project or bind an existing owned active project. Exact allocation retries preserve its project and fixed test hosting dates. Downloads do not move those dates.
- The active purchase page shows US$59, one narrator, 120 minutes, 20 photos and 12 months; pending live terms and test-only status are explicit. Account-switch recovery no longer publishes an old payer's delayed status into the new account's UI.

Migration03 promotes definitions from `experiments/pg17-invitation-transactions/candidate.sql`, `experiments/pg17-entitlement-events/candidate.sql` and `experiments/pg17-invitation-management/candidate.sql`. It adapts the complete bootstrap's `invitee_role` and `removed` membership status, removes fixture-only roles/data, starts new wallets at zero, and never adopts historical wallet amounts as proof of payment. The exact source hashes are in `payment-final-receipt.json`.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Payment route/client/panel suites | 22/22, 4 suites | `payment-focused-final.log` |
| Payment production files with the repository's root ESLint 8.57.1 | Exit 0 | `payment-lint-final.log` |
| Complete schema, payment native/SDK/HTTP/Chrome and shared delivery Chrome | 383 assertions, passed, `sourceDrift=[]` | `payment-native-final-5.log`; `migrations-1794373792564-c86ef743-3b26-4984-b004-8ce5bb30ce9c/results.json` |
| Search route and source route suites after the Unicode fix | 34/34 | `payment-review-search-routes-green.log` |
| Independent search client/pure/UI tests | 81/81 at review time | `payment-review-search-tests.log` |
| Independent native search run | Passed | `payment-review-search-native.log`; `migrations-1794371763868-013c03f6-ea46-4abb-94f7-297e0a567a88` |
| Actual publication CLI `--check` with synthetic HTTPS config and a private temporary spool | Exit 0; `publication_worker_ready`; no stderr | `payment-review-publication-cli.json` |

The final native run used PostgreSQL 17.4, Stripe SDK 14.25.0, Node 22.22.2 and installed Chrome 157.0.8103.39. It includes the real payment panel, client and routes, actual SDK raw-signature verification and controlled loopback provider HTTP. Payment Chrome covers start, reload/retry, signed success, new-project allocation, reload, signed refund and 390px layout. Its report contains no browser errors. The shared delivery Chrome also passed in this run; the parent agent owns the broader final repository verification and backup result.

Preserved failed attempts are evidence, not current passes:

- `payment-red.log`, `payment-malformed-red.log`, `payment-body-red.log`, `payment-partial-red.log` and `payment-account-ui-red.log` capture the focused behavioral RED stages.
- Earlier native attempts exposed bootstrap schema integration errors and the unpaid direct INSERT path. Subsequent full-schema runs closed these cases.
- `payment-review-search-routes.log` ran during the author's Unicode RED stage: 1 failed, 33 passed. The later green route log is the closure evidence.
- `payment-native-final-4.log` passed the payment portion but failed in the newly integrated publication Chrome step because `pdftotext` was missing from PATH. Final-5 includes the bundled Poppler directory and passes.
- `payment-lint-local-binary-failed.log` records an accidental invocation of a nested ESLint 10.3.0 installation with an incompatible parser. The project script explicitly uses the root ESLint binary; the final scoped run used that binary and passed.

## Independent search and parent integration review

The search review traced current approved revision/hash/fingerprint selection, source-only labels, corrected unaligned text, current membership and deletion fences, exact source-citation matching, and revalidation around the storage wait. The only confirmed finding was the Unicode title mismatch above. The signed media URL remains a 300-second bearer URL inherited from G1; this review does not establish instantaneous revocation of a URL that was already issued.

The parent integration review read `scripts/publication-worker.cjs`, the publication loader in `scripts/recording-worker.cjs`, `PublicationDeliveryPanel.tsx`, `lib/publication-client.ts`, ConnectedProjectHub export wiring, the generic create-project page, `lib/projects.ts` and `experiments/g1-local/g3-backup.mjs`. The CLI validates explicit configuration and private persistent spool/font requirements, and its `--check` completes before constructing the network client. The client binds project/job/URLs and account identity; the UI retains status/retry/download behavior and resets on account/project change. SSR cookie authentication supports its native download navigation. The generic creation entry now uses paid source allocation rather than a legacy wallet number. No other confirmed issue was found in this reviewed scope.

## Limits and follow-up risks

- No Stripe.js card entry or real Stripe network/settlement was exercised. Test transport cannot qualify a real payment method, SCA/redirect behavior, production webhook delivery or commercial terms.
- Native SQL and controlled transport do not qualify hosted PostgREST/Auth/Storage. The invitation adapters call `.schema('invitation_candidate')`; at review time `supabase/config.toml:11` exposes only public/storage/graphql_public. Actual invitation RPC schema exposure must be configured and verified before claiming the complete browser invitation integration works on Supabase.
- Payment request bodies have actual streamed-byte limits, but this helper has no independent read deadline. Slow-body infrastructure behavior was not tested here.
- The payment browser client trusts its same-origin server JSON, unlike the stricter publication response parser. Malformed-response recovery beyond the covered cases was not qualified; no privilege escalation from that client boundary was demonstrated.
- These are synthetic accounts and media on an installed desktop browser. This work does not establish household fidelity, mobile hardware behavior, real charging, live hosting terms or production deployment readiness.
