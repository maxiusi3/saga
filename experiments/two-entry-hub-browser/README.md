# Two-entry hub browser integration

Run from the repository root after `npm run verify` builds the current web CSS:

```sh
node experiments/two-entry-hub-browser/verify.mjs
```

This harness bundles the actual `ConnectedProjectHub`, `TwoEntryProjectHub` and
browser API adapter with the installed webpack/TypeScript toolchain. Only auth,
Next Link and the Storage upload boundary are replaced. HTTP routes are local
fixtures, not the production route handlers. It does not load project credentials
or call Supabase, paid APIs or external hosts; browser requests outside the local
fixture origin are blocked and fail the run.

Chromium runs at 1440px and 375px. Checks cover layout overflow, locale navigation
targets, exact uploaded byte count, pending verification copy, search and
metadata-driven audio seek, downloaded ZIP bytes, and removal of old audio after
a failed replacement search. Audio is a generated six-second silent WAV; the ZIP
contains synthetic text. Neither is a family recording or a production export.

Each run writes a uniquely named JSON report and screenshots under
`docs/research/evidence/2026-10-29-two-entry-integration/`. Failures exit nonzero
and remain in the evidence directory. Reports include source/CSS fingerprints;
temporary bundle files, HTTP server and browser are closed after the run.

This is not Next server end-to-end testing, real Storage/Auth qualification,
decoder/Worker verification, mobile hardware testing, or evidence that the
original G1/G3 quality gates have passed. Route authorization/integrity is checked
separately by the route test suites; historical PG17 scripts remain unchanged.
