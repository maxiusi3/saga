# G2 configured transcription adapter

The adapter uses the server-approved ElevenLabs `scribe_v2` model and US region. The route never accepts an alternate provider, model, URL, asset ID or actor ID. It resolves the saved story's protected audio URL, reads same-story/project ready media metadata, downloads from configured Supabase Storage, and checks the entire bounded audio stream against the stored byte count and SHA-256 before sending it. Maximum audio is 100 MiB, maximum declared duration is two hours, maximum provider response is 4 MiB, and the whole adapter operation is bounded to 120 seconds. Fetch redirects and implicit database retries are disabled.

Configuration is separate from general media availability:

- `MEDIA_ASSETS_ENABLED=true`
- `G2_TRANSCRIPTION_ENABLED=true`
- `ELEVENLABS_API_KEY`
- `G2_ASR_POLICY_EVIDENCE`: one JSON object accepted by `verifyProviderPolicyEvidence`, for the approved provider/model/region with current policy evidence.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Policy verification validates the configured evidence. This does not inspect a live ElevenLabs account or certify account settings. The policy version is a SHA-256 fingerprint of normalized evidence including the configured account, model, region, date and policy reference. HTTP Storage is allowed only for loopback development hosts; production Storage must be HTTPS.

`GET /api/stories/{storyId}/transcribe` authenticates and authorizes current story access, then returns `{transcription:{ready,provider,model,region,policyVersion,requiresConsent:true,pendingRequestId}}`. It never exposes keys or the account evidence document. `POST` accepts `{requestId,revisionId?,expectedVersion?,consent,policyVersion}`. Initial `expectedVersion` defaults to zero. An explicit `consent:true` and matching displayed policy version are required before the durable reservation may grant consent and before outbound I/O. The SQL reservation records the exact consenting actor, story, provider, region, policy and pinned source/asset identity.

A new reservation authorizes only one outbound attempt. Pending requests, including unknown outcomes, are never renewed or automatically sent again. A different request ID also cannot bypass a pending request for the same story. Completed same-request replays read current durable review state. A process failure before provider invocation can therefore leave a reservation pending even when no cloud call occurred. There is no automatic pending-request recovery or operator resolution UI in this slice; resolving an unknown provider outcome is follow-up work. Error responses do not contain raw provider diagnostics.

The adapter preserves all timed tokens including audio events, checks text coverage against the response's full text, validates nonnegative ordered finite timestamps against the saved duration, groups adjacent same-speaker tokens into bounded paragraphs, and persists full text using the same paragraph join as SQL. Confidence remains `null`; model log probabilities are not treated as calibrated confidence. Unsupported multichannel responses, overlapping/non-monotonic timed tokens, empty/malformed output, known placeholder markers and silent truncation are rejected. Actual speaker correctness, transcription quality and semantic audio alignment still require live-provider/household evaluation.

Membership, source identity, asset metadata, consent and deletion guards are re-read after external waits; SQL rechecks the final ingestion atomically. No application can make a database revocation and already-started external network transfer one atomic transaction. This implementation does not claim retroactive revocation of bytes already delivered to a provider.

Evidence includes intentional failing parser/route/I/O tests and final green receipts. The Chrome module uses production UI, routes and Supabase SDK with complete native PG17. Only authentication, HTTP transports, audio and provider output are declared controlled substitutes. The provider endpoint is intercepted through a strict local allowlist before any request, and the local service receives/validates the actual multipart body. Generated tone WAV playback proves source seeking and byte integrity, not speech semantics. No paid/live provider request or remote deployment was performed.
