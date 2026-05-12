# Saga Gift Project Handoff Design

## Status

Approved in conversation. Ready for user review as a written spec.

## Context

This Saga project is a gift. The current owner built and deployed it under personal accounts, while the recipient currently has little technical experience and is closest to "web dashboard only" familiarity. The project is already online, but it has not yet acquired active users, so the migration window is flexible and can prioritize safety, clarity, and training over zero-downtime execution.

The user wants the recipient to become the primary owner of the project while keeping the current owner as a collaborator. The recipient must eventually be able to maintain the project and ship small upgrades with AI assistance. In practice, the first phase must optimize for reliable content and page-level changes, then grow into small feature work.

## Problem Statement

The current setup creates three risks:

1. Ownership risk: GitHub, Vercel, Supabase, and related secrets currently live under the current owner's accounts.
2. Capability risk: the recipient is not yet ready to safely operate a full-stack production system without guided workflows.
3. Support risk: without clear boundaries, AI may be used unsafely for production changes, and the current owner may remain the hidden operator instead of a collaborator.

The handoff must solve all three risks together.

## Goals

1. Transfer practical ownership of the project to the recipient across GitHub, Vercel, Supabase, and related credentials.
2. Preserve the current owner as a collaborator who can review risky changes and help when needed.
3. Teach the recipient a repeatable maintenance workflow that works even without prior technical background.
4. Enable the recipient to use AI safely for small upgrades and common fixes.
5. Reduce the chance of accidental production damage, secret leakage, or irreversible data changes.

## Non-Goals

1. Turn the recipient into a general software engineer during the first handoff cycle.
2. Give the recipient independent authority over high-risk changes such as auth model rewrites, payment flows, or destructive database changes.
3. Optimize the migration for perfect zero-downtime execution.

## Current System Surface

Based on the repository, the handoff touches at least these systems:

- GitHub repository and workflow configuration
- Vercel project and deployment settings
- Supabase project, auth, database, and storage configuration
- Environment variables and secret management
- AI-related credentials including OpenRouter and OpenAI usage paths
- Optional integrations such as Google OAuth, Stripe, and Sentry

This means the handoff is not a code-only transfer. It is an operations, ownership, and training transfer.

## Recommended Approach

Use a layered handoff model.

The recipient becomes the owner of the accounts and project resources, but the operational scope is split into three layers:

1. Safe to do alone
2. Safe to do with AI and the written playbook
3. Must escalate to the current owner before acting

This approach is recommended over an immediate full handoff because it matches the recipient's current skill level while still moving ownership to the right person from day one.

## Ownership Architecture

### Roles

- Recipient: primary owner of GitHub, Vercel, Supabase, and the live project
- Current owner: collaborator with review and emergency support responsibilities
- AI assistant: first-line helper for explanation, bounded edits, and troubleshooting guidance

### Responsibility Boundaries

The recipient can independently handle:

- Content changes
- Copy changes
- Image and asset swaps
- Small page layout changes
- Small presentation tweaks

The recipient can handle with AI support and the playbook:

- Small bug fixes
- Small form changes
- Small page logic changes
- Small feature adjustments within existing flows

The recipient must escalate before acting on:

- Auth and permissions changes
- Database schema changes with destructive potential
- Payment and billing logic
- Secret rotation and environment variable changes in production
- Domain, callback URL, and OAuth configuration changes
- Production incidents that could affect data integrity

## Migration Design

### Principle

Do not share the current owner's accounts long term. Move ownership to the recipient's own accounts and retain the current owner as a collaborator.

Do not dismantle the old setup immediately. Keep a temporary overlap period so the old environment can be referenced if the new one is misconfigured.

Before migration, perform a secret audit. Any real keys, tokens, or service-role credentials that exist in tracked files, screenshots, or ad hoc notes must be treated as potentially exposed, rotated, and moved into proper secret storage before final handoff.

### Migration Order

1. Create the recipient's GitHub, Vercel, and Supabase accounts.
2. Enable 2FA on all accounts and save recovery codes securely.
3. Add the current owner as collaborator where possible.
4. Transfer or recreate the GitHub repository under the recipient's ownership.
5. Reconnect the repository to a Vercel project owned by the recipient.
6. Create a new Supabase project owned by the recipient.
7. Recreate or migrate database schema, auth configuration, storage setup, and required data.
8. Recreate environment variables and secrets under the recipient's control.
9. Update callback URLs, deployment settings, and domain configuration.
10. Validate the new production path before retiring the old one.

### Why This Order

This order ensures that ownership, deployment, data, and secrets move in a controlled sequence. The most important outcome is that the recipient learns the system inside the environment she will actually own.

### Migration Prerequisite: Secret Hygiene

The handoff must include a one-time secret cleanup pass:

1. Audit the repository for real keys or tokens committed to tracked files.
2. Replace those values with placeholders in committed example files.
3. Rotate any exposed production or development secrets.
4. Re-enter the new values only in proper environment-variable stores such as Vercel and Supabase settings.
5. Teach the recipient the difference between example values, local secrets, and production secrets.

This is mandatory because ownership transfer without secret cleanup would transfer both responsibility and inherited security risk.

## Teaching Design

The teaching model is guided repetition, not lecture-heavy theory.

Every critical action should follow the same pattern:

1. The current owner demonstrates the action once.
2. The recipient performs the same action with supervision.
3. The recipient performs it again with less help.
4. The step is captured in the written playbook.

### Recommended Training Schedule

Use five sessions over roughly one week.

#### Session 1: System Map

Teach where each responsibility lives:

- GitHub for code and history
- Vercel for deployment
- Supabase for data, auth, and storage
- Secrets and environment variables for runtime configuration
- The difference between safe changes and dangerous changes

Exit criteria:

- The recipient can log into all core services.
- The recipient can explain what each service is responsible for.
- The recipient knows not to paste secrets into AI tools.

#### Session 2: Ownership Migration

Perform the account creation and migration steps together.

Exit criteria:

- Core ownership exists under the recipient's accounts.
- Collaboration access is in place for the current owner.
- The recipient can locate the settings pages needed for later maintenance.

#### Session 3: First Full Release

Ship a very small change end to end, such as copy or an image.

Exit criteria:

- The recipient completes the full cycle from request to GitHub commit to Vercel deployment to production verification.
- The recipient understands where to look when deployment fails.

#### Session 4: Bounded Small Feature or Bug Fix

Choose a safe but real change that is slightly more complex than a copy edit.

Exit criteria:

- The recipient can use AI to explain the change, identify touched files, and produce a bounded patch.
- The recipient understands that unreviewed or poorly understood diffs must not be shipped.

#### Session 5: Failure Drills

Simulate common problems such as deployment failure, missing environment variables, or a misconfiguration in Supabase.

Exit criteria:

- The recipient follows a stable troubleshooting order instead of clicking around at random.
- The recipient can decide whether to continue independently or escalate.

## AI Operating Model

### Role of AI

AI is the recipient's first-line technical assistant for:

- Explaining what a change means
- Mapping a request to likely files and systems
- Producing bounded small edits
- Translating errors into plain language
- Suggesting verification and rollback steps

AI is not the decision-maker for high-risk production changes.

### Standard Prompt Pattern

The recipient should first ask AI to explain the task before asking it to modify code. The default prompt pattern is:

1. Explain what files are likely involved.
2. Explain the risk level.
3. State what should be checked before editing.
4. Only then propose a bounded change.

When asking AI to edit, the prompt must explicitly forbid touching auth, database, billing, or production secret management unless that is the stated goal and the current owner is already involved.

### AI Safety Rules

The recipient must never:

- Paste service role keys, tokens, or recovery codes into AI
- Approve changes she does not understand at a high level
- Let AI perform destructive production actions without human review
- Treat AI confidence as proof that a change is safe

## Operational Flow After Handoff

The recipient's default workflow for small changes should be:

1. Write down the requested change in one sentence.
2. Classify it as safe alone, safe with AI, or must escalate.
3. Ask AI to explain impact and touched files.
4. Make or review the change.
5. Verify locally or in preview when possible.
6. Deploy through the normal GitHub and Vercel path.
7. Validate the live result.
8. Record what changed and any follow-up notes.

This creates a repeatable process rather than a collection of one-off lessons.

## Required Documentation

The handoff package must include at least five documents:

1. System map
2. Accounts and permissions guide
3. Release playbook
4. Troubleshooting playbook
5. AI prompt handbook

Each document should be short, example-driven, and written for a non-technical operator. The goal is usability, not completeness.

## Error Handling and Recovery

The recipient should use a fixed troubleshooting sequence:

1. Read the visible error carefully.
2. Check the Vercel deployment logs.
3. Check the relevant Supabase settings or logs if data/auth is involved.
4. Ask AI to explain the exact error and suggest bounded next steps.
5. Escalate to the current owner if the issue touches secrets, data integrity, auth, or any unknown production risk.

Recovery planning should include:

- Preserving the old environment temporarily during migration
- Knowing how to revert to a previous deployment in Vercel
- Keeping a secure record of essential configuration values and their locations

## Validation Plan

The handoff is considered successful when the recipient can do all of the following:

1. Log into and navigate GitHub, Vercel, and Supabase under her own ownership.
2. Explain what each service controls.
3. Complete one simple production change independently.
4. Complete one bounded small change with AI support.
5. Follow the troubleshooting playbook for a simulated failure.
6. Correctly escalate a high-risk request instead of attempting it alone.

## Milestones

### 30-Day Goal

The recipient can independently handle content and presentation updates safely.

### 60- to 90-Day Goal

The recipient can handle small feature work and common bug fixes with AI support and occasional review from the current owner.

### Ongoing Constraint

High-risk architectural, data, auth, payment, and secret-management changes remain reviewed collaboration work until a later reassessment.

## Risks and Mitigations

### Risk: Ownership transfer happens, but practical knowledge does not

Mitigation: require supervised repetition and a written playbook, not just account transfer.

### Risk: AI encourages unsafe changes

Mitigation: use fixed prompt templates, explicit forbidden zones, and escalation rules.

### Risk: the current owner remains the hidden operator

Mitigation: make the recipient the default actor for all low-risk work from the beginning.

### Risk: production secrets leak during teaching

Mitigation: establish a strict "never paste secrets into AI" rule and use proper secret managers and environment settings pages instead of ad hoc sharing.

## Final Recommendation

Treat the gift as a system handoff, not a code lesson.

The most effective path is:

1. Move ownership to the recipient's own accounts.
2. Keep the current owner as collaborator and reviewer.
3. Train through five guided sessions.
4. Limit independent scope at first.
5. Use AI as a bounded helper with strict safety rules.

This gives the recipient a realistic path from non-technical owner to AI-assisted maintainer without pretending she needs to become a traditional engineer first.
