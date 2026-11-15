# G1 whole-story deletion implementation

1. Add failing native full-schema scenarios for purge, replay, authorization, derivative late writes and survivor preservation; add client request-contract tests.
2. Add private purge/fence tables, narrow trigger exceptions, service RPC and restrictive story reads in a new migration. Preserve original capture semantics and media worker coordinates.
3. Wire actual project page delete action and authenticated route, pending handling, truthful accepted/failure text in supported locales. Filter service-backed project reads.
4. Run actual product component in Chrome against compiled production route and native database; verify reload, denied action, no resurrection and preserved survivor.
5. Independently review implementation; fix real findings. Run project/migration/backup gates once final code stabilizes; archive evidence and update G1 status and manual follow-up list.


Completed 2026-11-09: all five steps executed. Native product Chrome241, complete
migration/backup493, Web3421, shared16, infra25,184-page build passed; independent
review has no remaining P1/P2. Initial test-fixture errors and actual cluster and
withdrawal RED runs are retained, with final source/archive verification in the
batch evidence. Human follow-ups remain waived, not marked tested.
