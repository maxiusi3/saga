# Task 4 resumed: notification UI P2 repair

Status: completed for the assigned NotificationItem visibility/positioning scope. Existing reminder delivery, dependency changes and other dirty baseline edits were preserved. No staging, commits, pushes, deployment or real provider calls.

## Exact changes

- `packages/web/src/components/notifications/NotificationItem.tsx:50`: add `relative` to the notification row so its absolute unread dot is positioned inside that row.
- `NotificationItem.tsx:114,125`: remove `opacity-0 group-hover:opacity-100 transition-opacity` from the read/delete buttons. They are visible by default for mouse, keyboard and touch, retaining existing icon/button design and delete hover color.
- `NotificationItem.tsx:75,108`: allow the text column to shrink (`min-w-0`) and prevent the action group from shrinking. The new real mobile containment check caught both actions extending outside the notification row before this fix.
- `experiments/pg17-hosting-reminders/http.mjs:88–173`: keep the existing production page, Hook, API, SDK and native PG fixture; compile the actual app stylesheet with notification sources; add an opacity-zero probe to verify the stylesheet is active. Hash the two imported app CSS source files too. Test effective opacity through ancestors, button size, viewport and row containment, hit target, actual Tab focus rings, and unread dot offset parent/bounds. Run default/hover/keyboard desktop plus no-hover/coarse-pointer 360px and 390px touch contexts. Save desktop and viewport-sized mobile screenshots. Exercise the actual single-row read endpoint and retain bulk read, delete, navigation and durable-dismissal assertions.

The component's prior callback-prop wiring was already dirty before this task and was retained. Shared build/migration harness, manifests, other components and documentation were not edited by this task; the existing harness generated the evidence listed below.

## Verification evidence

Command for each browser run:

```sh
node experiments/g1-local/verify-migrations.mjs --hosting-reminders --chrome
```

The default sandbox blocked native PG shared memory (`shmget: Operation not permitted`). The same command was retried with approved escalation against an isolated Unix socket, local HTTP endpoints and synthetic identities.

1. Red before the visibility fix: `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794637502485-fd639ce3-c88f-4ee0-a0c6-9053a7764743/results.json`. Exact failure: Mark as read computed opacity expected `1`, received `0`. The Tailwind probe passed first, proving this was actual applied CSS rather than an unstyled fixture.
2. Red before local flex containment fix: `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794638481095-fa8c1114-ef20-419b-9526-0e99f053b30f/results.json`. Exact failure label: `touch 360 action has unobscured web target inside row: Mark as read`.
3. Final green: `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794638890086-aeff217c-cc20-4989-8732-c7df971c1bda/results.json`. **Passed, 228 assertions, 41 bootstrap/migration files, Chrome 157.0.8103.78, sourceDrift=[] and browserErrors=[].** Twelve recorded action observations across desktop default/hover/two keyboard focus states and two touch widths all have effective opacity 1, 36×40.5 CSS px targets, inViewport=true, insideRow=true and hitTarget=true. Both keyboard actions matched `:focus-visible` and had nonempty focus box shadows; all dot containment assertions passed.

Final screenshots and detailed browser JSON are in that run's `hosting-reminder-http/` directory: `notifications-desktop.png`, `notifications-touch-360.png`, `notifications-touch-390.png`, `results.json`. The 360px screenshot was visually inspected after the final fix. All runs stopped their temporary PG cluster, removed temporary data, closed clients, and reported no cleanup errors.

Also passed: `node --check experiments/pg17-hosting-reminders/http.mjs` and `git diff --check -- packages/web/src/components/notifications/NotificationItem.tsx`.

## Boundaries and remaining observation

- Browser fixture uses the real app CSS, notification page/components/Hook/client/API and SDK with local PG roles; Auth/Realtime and navigation destination remain declared synthetic boundaries. No hosted service qualification, real email sending or inbox delivery is claimed.
- Touch verification proves rendered no-hover visibility, geometry and unobscured hit targets; read/delete persistence is exercised by desktop Chrome clicks. Physical mobile-device or screen-reader testing is not claimed.
- The notification page's pre-existing header and filter bar overflow horizontally at narrow mobile widths (`packages/web/src/app/[locale]/dashboard/notifications/page.tsx:90,135`). The final screenshot shows this clearly. This task fixes the notification row only; it is not a whole-page responsive acceptance. The constrained title wraps to several lines while the original row layout is retained. Viewport checks deliberately use Playwright's configured viewport width, not `window.innerWidth`, which can be inflated by page overflow.
- No full repository test/build was run for this CSS-only scope; the parent owns integrated verification. No global test fixture or manifest edits are needed for these changes.
