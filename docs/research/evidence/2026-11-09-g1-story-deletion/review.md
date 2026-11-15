# Independent review

Reviewer: `/root/review_deletion`, per requesting-code-review. Final result: approved; no remaining P1/P2 in this increment.

Findings fixed and verified:

1. Wiki runs/artifacts did not use story_id: follow actual contribution IDs in input/source_refs/payload and cluster output; preserve private identity fences after removing rows.
2. A late Wiki task could INSERT a new cluster before its links were rejected: require first-write source_contribution_ids, check active/live sources under the deletion lock, reject missing provenance.
3. Answer/parent links could be repointed to deleted stories: reject new links, clear the old answer and notification while preserving the survivor's question.
4. A snapshot containing only assetId escaped story/revision lookup: include captured asset identities in content provenance without deleting the media records.
5. Active-only cluster provenance validation broke withdrawal invalidation: permit only status/updated_at invalidation without any text/provenance change, still honoring deletion fences. Exact empty-content cleanup remains available. Full withdrawal sequence and a text-smuggling negative case pass.

Independent actual PG17 complete migration + story suite: 205 assertions; extra probes: 93 assertions (including base schema checks). Extra probes cover asset-only snapshot erasure/late rejection while retaining the asset, interview run predating its eventual save intent, and actor-conflict rejection. Three focused Jest suites/32 tests passed. Both native reports have no source drift and confirm closed clients, stopped PG and removed temporary socket directories. Original withdrawal RED is retained as review-withdraw-red.json. Reports were copied from the reviewer's /tmp runs without altering them.

Historical interviews that never recorded a story/recording association cannot be safely inferred from project/account alone; retained as explicit manual mapping, not claimed erased. New recording intervention requests carry the local session ID, and purge scopes it through same-project/same-actor save intents.
