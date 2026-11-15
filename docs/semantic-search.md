# Current-source semantic search

The project hub preserves literal search and adds an explicit **Search by meaning** action. Semantic retrieval uses Voyage embeddings and reranking; it never generates family prose. Source quotes, revision/version/segment/asset identities and any timing all come from the same current-authority projection used by literal search and protected playback.

## Configuration and consent

Server-only configuration:

- `MEDIA_ASSETS_ENABLED=true` and `SEMANTIC_SEARCH_ENABLED=true`.
- `VOYAGE_API_KEY`: provider key; never returned to the browser.
- `VOYAGE_EMBEDDING_MODEL=voyage-4-large`, `VOYAGE_RERANK_MODEL=rerank-2.5` (current supported models).
- `VOYAGE_BASE_URL=https://api.voyageai.com/v1` (the only admitted provider origin; arbitrary proxies are rejected).
- `VOYAGE_REGION=us` or `eu`, matching the verified account/endpoint residency evidence. Selecting a string is not proof of regional processing; qualification must independently confirm it before enabling the feature.
- `PROVIDER_POLICY_EVIDENCE_JSON`: separate current evidence records for both models, with provider `voyage`, the same `accountOrOrgId`, the selected region in `allowedRegions`, verified training opt-out and accepted retention terms. Evidence expires after 90 days under the shared policy verifier. No synthetic evidence is suitable for production.

Authenticated `GET /api/projects/:id/search?mode=semantic&readiness=1` returns availability and a policy fingerprint without reading the source corpus or sending content. The checkbox shows the provider, region and privacy-policy link. The explicit action sends `POST /api/projects/:id/search` with `{query, mode:"semantic", consent:true, policyVersion, person?, date?, place?}`. GET never initiates semantic transmission.

The service checks the displayed policy fingerprint before any transmission. `semantic_source_snapshot` records project-scoped `cloud_ai` consent for the requesting member only on the initial explicit request. Subsequent snapshots require the same active grant and reread membership, deletion ledgers, current transcript and approved revision provenance, and media identity. Consent withdrawal during a provider wait blocks subsequent transmission and results. A fresh user action can grant consent again. A changed policy requires reloading the control and consenting to the new terms.

## Bounded current corpus

The forward migration `20261113000003_semantic_sources.sql` installs a shared projection with literal and whole-corpus branches. Its service-only wrappers preserve literal citation identity and historical migration files. The whole-corpus branch has no lexical preselection and never reads `search_index_entries`.

The authorized current corpus must fit **256 entries**, **1,200 Unicode characters per entry** and **65,536 UTF-8 bytes of source text in total**. Exceeding any bound returns HTTP 422 before provider calls, rather than returning a partial corpus. Existing authority-work bounds also apply: up to 200 current stories, 2,000 segments per transcript, 10,000 total segments and bounded transcript/assertion text. Large archives can continue to use literal search. People/year/place are explicit literal filters applied to the already bounded current snapshot; the semantic query itself never excludes sources by keyword.

For eligible sources the service performs three bounded HTTPS requests:

1. Query embedding using `input_type:"query"`, dimension 1,024, `truncation:false`.
2. Every eligible current source's embedding using `input_type:"document"` and the same dimension, without truncation.
3. Local cosine similarity ranks the vectors. Up to 50 candidates from that actual vector ranking go to `rerank-2.5`, with `return_documents:false`, `truncation:false`; up to 12 results are shown.

Provider responses are bounded to 4 MiB, parsed strictly, and checked for model, complete unique indexes, finite nonzero vectors with exact dimension, and valid finite relevance scores. The entire operation, including SQL and body reads, is bounded to 30 seconds and is cancellable. Each provider boundary and the final return recheck the complete authorized snapshot and exact consent identity. Any correction, revoked access, changed asset, tombstone, new/removed source, changed approval, withdrawn consent or policy change invalidates the in-flight result.

Source text and vectors exist only in request memory; this slice creates no durable vector corpus or duplicated text store. Deletion and correction therefore need no asynchronous vector cleanup. An approved AI paragraph remains discoverable through its exact original `source_quote`, linked to the approved assertion/revision; its rewritten prose is never labelled as verbatim original audio. Unapproved AI paragraphs cannot inherit approval. An excerpt gets playback only when its authoritative source is an aligned original transcript. Family supplements, corrections and disputed alternatives retain their labels and no fabricated timing. The existing protected source endpoint revalidates identities before and after audio signing.

## Verification boundaries

Tests include a query `relocation` and source `Grandmother moved overseas.` with zero literal overlap, actual cosine computation, reranking, policy disabled, unauthorized scope, source mutation/deletion, withdrawn consent, malformed provider data and transport/body timeouts. `experiments/pg17-semantic-search/scenarios.mjs` exercises full native PG17 schema, actual Supabase SDK over controlled HTTP, actual route handlers and controlled Voyage-shaped HTTP. `chrome.mjs` mounts the actual connected project hub and uses installed Chrome for literal vs semantic action, consent, source quote and protected playback.

Controlled vectors and responses prove computation and integration. They do not establish live Voyage model availability, cross-language recall, family-history accuracy, regional residency or production retention. Those provider and human-quality checks remain required before production enablement. No paid live provider calls or remote migrations are part of this repair.

API shapes checked against official documentation via Context7 on 2026-11-13:

- [Voyage embeddings REST reference](https://docs.voyageai.com/reference/embeddings-api)
- [Voyage rerank REST reference](https://docs.voyageai.com/reference/reranker-api)
- [Voyage reranker guide](https://docs.voyageai.com/docs/reranker)

Evidence and focused logs: `docs/research/evidence/2026-11-13-audit-repair/semantic/`.
