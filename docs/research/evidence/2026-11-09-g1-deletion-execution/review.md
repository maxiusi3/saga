# Independent review record

Reviewer: `/root/review_deletion`, invoked under requesting-code-review. Read-only; no reviewer file edits. Final findings received 2026-11-09.

Resolved findings:

1. P1: canonical saved asset playback URLs were incorrectly treated as unknown legacy references, blocking unrelated saves. Added canonical asset resolution and actual save-after-fence regression.
2. P1: captured asset could be rebound to another story before first execution. Guards now cover capture-to-execution interval; plan also validates story/session bindings.
3. P2: concurrent deletion could shift offset inventories. Worker now rescans from zero after deletes until final empty first-page inventory.
4. Physical uncertainty: metadata deletion can precede failed backend cleanup. Sticky physical unknowns survive API404, abandoned dispatch and not_found after prior presence. The fixture independently models metadata and real disk bytes.
5. P1: selected story's uncaptured legacy media was excluded from reference checks. It now returns blocked_reference instead of empty-plan success.

Reviewer independently reproduced and rechecked competing deletion/orphan and legacy-only cases with native PG17 plus actual compiled worker; cleanup completed. Final report: no new code blocking findings; CLI/compiler boundary and offline no-network test passed. Native final 184-assertion receipt and all recorded source hashes matched at review time. Requested document wording/entry updates have been applied.

This review does not turn API namespace observations into physical-erasure proof and does not qualify hosted Supabase or whole-story text erasure.
