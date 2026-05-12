# Saga Friend Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the docs, checklists, secret cleanup, and operational workflow needed to transfer Saga ownership to the recipient and teach her to maintain the project safely with AI.

**Architecture:** Store the handoff package under `docs/handoff/`, sanitize tracked secret examples in the repo, then use the new playbooks to execute a staged ownership transfer across GitHub, Vercel, and Supabase. Keep the current owner as collaborator, record every migration action in a handoff log, and use the same docs for both teaching and day-two maintenance.

**Tech Stack:** Markdown, Git, GitHub, Vercel, Supabase, environment variables, `rg`, `git diff`

---

## Planned File Structure

- Modify: `packages/web/.env.example` - replace live-looking values with safe placeholders
- Create: `docs/handoff/README.md` - index and recommended reading order
- Create: `docs/handoff/system-map.md` - explain what each service owns
- Create: `docs/handoff/accounts-and-permissions.md` - owner/collaborator model, 2FA, recovery code storage
- Create: `docs/handoff/secret-rotation-checklist.md` - audit and rotation tracker for every secret
- Create: `docs/handoff/ownership-migration-checklist.md` - exact GitHub/Vercel/Supabase transfer checklist
- Create: `docs/handoff/release-playbook.md` - safe path for small changes from request to production
- Create: `docs/handoff/troubleshooting-playbook.md` - fixed order for debugging and escalation
- Create: `docs/handoff/change-risk-matrix.md` - classify changes as safe alone, safe with AI, or must escalate
- Create: `docs/handoff/ai-prompt-handbook.md` - copy-paste AI prompts and red-line safety rules
- Create: `docs/handoff/training-week-plan.md` - five-session onboarding schedule with exit criteria
- Create: `docs/handoff/handoff-log.md` - running record of dry runs, migration steps, blockers, and signoff

### Task 1: Sanitize Tracked Secrets and Create Rotation Checklist

**Files:**
- Modify: `packages/web/.env.example`
- Create: `docs/handoff/secret-rotation-checklist.md`
- Reference: `packages/backend/.env.example`

- [ ] **Step 1: Inspect tracked environment examples and confirm what needs redaction**

Run:

```bash
rg -n "SUPABASE|OPENROUTER|STRIPE|GOOGLE|SENTRY" packages/web/.env.example packages/backend/.env.example
```

Expected: `packages/web/.env.example` contains all production-facing integration keys that must be converted to placeholders before handoff.

- [ ] **Step 2: Replace live-looking values in `packages/web/.env.example` with placeholders**

Update `packages/web/.env.example` so the key section looks like:

```env
# Next.js Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenRouter API Configuration
OPENROUTER_API_KEY=your-openrouter-api-key
NEXT_PUBLIC_OPENROUTER_MODEL=deepseek/deepseek-chat-v3.1:free

# Stripe (optional)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Google OAuth (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn

# Environment
NEXT_PUBLIC_ENV=development
```

- [ ] **Step 3: Create `docs/handoff/secret-rotation-checklist.md`**

Write this markdown structure:

```md
# Secret Rotation Checklist

## Rules

- Never paste real secrets into AI tools
- Replace committed examples with placeholders
- Rotate any secret that may already be exposed
- Store production values only in provider secret settings

## Secret Inventory

| Secret | Service | Where It Lives Now | Rotate Required | New Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | `packages/web/.env.example` or Vercel | Yes | Recipient | Pending | Replace example file with placeholder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | `packages/web/.env.example` or Vercel | Yes | Recipient | Pending | Re-enter in recipient Vercel project |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | `packages/web/.env.example` or Vercel | Yes | Recipient | Pending | Treat as high-risk credential |
| `OPENROUTER_API_KEY` | OpenRouter | `packages/web/.env.example` or Vercel | Yes | Recipient | Pending | Create new key under recipient billing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Vercel | If used | Recipient | Pending | Leave blank if unused |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth | Vercel | If used | Recipient | Pending | Update callback URLs after migration |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Vercel | If used | Recipient | Pending | Recreate project or invite collaborator |

## Completion Check

- [ ] Example files contain placeholders only
- [ ] Exposed secrets rotated
- [ ] Recipient owns active secrets
- [ ] Old owner access reviewed
```

- [ ] **Step 4: Verify the redaction and checklist content**

Run:

```bash
rg -n "your-|placeholder|Rotate Required|Secret Inventory" packages/web/.env.example docs/handoff/secret-rotation-checklist.md
```

Expected: placeholder values appear in the example file, and the checklist contains a complete inventory table.

- [ ] **Step 5: Commit the secret hygiene changes**

Run:

```bash
git add packages/web/.env.example docs/handoff/secret-rotation-checklist.md
git commit -m "docs: add handoff secret rotation checklist"
```

Expected: a commit containing only the example-file cleanup and the secret rotation checklist.

### Task 2: Create the Handoff Index, System Map, and Account Guide

**Files:**
- Create: `docs/handoff/README.md`
- Create: `docs/handoff/system-map.md`
- Create: `docs/handoff/accounts-and-permissions.md`
- Reference: `.github/workflows/deploy.yml`
- Reference: `docs/superpowers/specs/2026-03-29-friend-handoff-design.md`

- [ ] **Step 1: Create `docs/handoff/README.md` as the handoff entrypoint**

Write:

```md
# Saga Handoff Docs

## Read This First

1. `system-map.md`
2. `accounts-and-permissions.md`
3. `change-risk-matrix.md`
4. `ai-prompt-handbook.md`
5. `release-playbook.md`
6. `troubleshooting-playbook.md`
7. `ownership-migration-checklist.md`
8. `training-week-plan.md`
9. `handoff-log.md`

## Purpose

This folder is the operating manual for transferring Saga to its new owner and teaching her how to maintain it safely.
```

- [ ] **Step 2: Create `docs/handoff/system-map.md`**

Write:

```md
# System Map

| System | Purpose | Owner After Handoff | Collaborator | Main Risk |
| --- | --- | --- | --- | --- |
| GitHub | Source code, PRs, history | Recipient | Current owner | Accidental direct edits to main |
| Vercel | Deployments, environment variables, rollback | Recipient | Current owner | Bad production deploy or missing env vars |
| Supabase | Database, auth, storage | Recipient | Current owner | Data loss or auth misconfiguration |
| OpenRouter | AI inference billing/key management | Recipient | Optional | Leaked key or unexpected cost |
| Google OAuth | Login provider | Recipient | Current owner | Broken callback URLs |
| Stripe | Payments if enabled | Recipient | Current owner | Billing or webhook breakage |

## Rule of Thumb

- Code lives in GitHub
- Production behavior lives in Vercel plus Supabase
- Secrets live in provider settings, not in chat threads
```

- [ ] **Step 3: Create `docs/handoff/accounts-and-permissions.md`**

Write:

```md
# Accounts and Permissions

## Ownership Model

- Recipient is the owner of GitHub, Vercel, Supabase, and active AI keys
- Current owner stays as collaborator
- High-risk changes require review until later reassessment

## Required Account Setup

- [ ] GitHub account created
- [ ] Vercel account created
- [ ] Supabase account created
- [ ] 2FA enabled on all three
- [ ] Recovery codes stored in an offline password manager or printed backup

## Collaborator Policy

- Recipient performs low-risk day-to-day work
- Current owner reviews risky changes
- No shared passwords
- No disabling 2FA for convenience
```

- [ ] **Step 4: Verify the docs cover the service map and permission model**

Run:

```bash
rg -n "GitHub|Vercel|Supabase|2FA|Collaborator Policy|System Map" docs/handoff/README.md docs/handoff/system-map.md docs/handoff/accounts-and-permissions.md
```

Expected: the new docs mention all three core systems, the owner/collaborator model, and the required reading order.

- [ ] **Step 5: Commit the docs index and ownership docs**

Run:

```bash
git add docs/handoff/README.md docs/handoff/system-map.md docs/handoff/accounts-and-permissions.md
git commit -m "docs: add handoff system and ownership guides"
```

Expected: a commit containing only the index, system map, and account guide.

### Task 3: Create the Release and Troubleshooting Playbooks

**Files:**
- Create: `docs/handoff/release-playbook.md`
- Create: `docs/handoff/troubleshooting-playbook.md`
- Reference: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `docs/handoff/release-playbook.md`**

Write:

```md
# Release Playbook

## Safe Release Flow

1. Write the requested change in one sentence.
2. Classify the change using `change-risk-matrix.md`.
3. Ask AI to explain impact before asking it to edit.
4. Review changed files before committing.
5. Push the change and wait for Vercel deployment.
6. Validate the live result.
7. Record what changed in `handoff-log.md`.

## Never Skip

- Do not deploy changes you cannot explain in plain language.
- Do not change secrets during a normal content release.
- Do not bypass GitHub by editing production directly.

## Rollback

1. Open the failed deployment in Vercel.
2. Promote the last known good deployment.
3. Record the rollback reason in `handoff-log.md`.
4. Escalate if the issue involves auth, data, billing, or secrets.
```

- [ ] **Step 2: Create `docs/handoff/troubleshooting-playbook.md`**

Write:

```md
# Troubleshooting Playbook

## Fixed Debug Order

1. Read the visible error message.
2. Check Vercel deployment logs.
3. Check Supabase if the problem involves login, data, or storage.
4. Ask AI to explain the exact error message and suggest bounded next steps.
5. Escalate if the issue touches secrets, data integrity, auth, or payments.

## Common Cases

### Deploy Failed

- Check Vercel build logs
- Confirm required environment variables still exist
- Compare with the last successful deployment

### Login Broke

- Check Supabase auth provider settings
- Check callback URLs
- Confirm no recent secret rotation was applied incorrectly

### Page Looks Wrong But Deploy Succeeded

- Compare the changed files in GitHub
- Verify the expected locale/content file was actually updated
- Ask AI to explain what part of the UI should have changed
```

- [ ] **Step 3: Verify the playbooks include rollout, rollback, and escalation**

Run:

```bash
rg -n "Rollback|Escalate|Vercel|Supabase|Fixed Debug Order" docs/handoff/release-playbook.md docs/handoff/troubleshooting-playbook.md
```

Expected: both playbooks contain a stable release path, rollback path, and explicit escalation triggers.

- [ ] **Step 4: Commit the playbooks**

Run:

```bash
git add docs/handoff/release-playbook.md docs/handoff/troubleshooting-playbook.md
git commit -m "docs: add handoff release and troubleshooting playbooks"
```

Expected: a commit containing only the release and troubleshooting docs.

### Task 4: Create the Change Risk Matrix and AI Prompt Handbook

**Files:**
- Create: `docs/handoff/change-risk-matrix.md`
- Create: `docs/handoff/ai-prompt-handbook.md`

- [ ] **Step 1: Create `docs/handoff/change-risk-matrix.md`**

Write:

```md
# Change Risk Matrix

## Safe Alone

- Copy updates
- Image swaps
- Small presentational tweaks

## Safe With AI and Playbook

- Small bug fixes
- Small form changes
- Small page logic changes inside an existing flow

## Must Escalate

- Database destructive changes
- Auth and permission changes
- Secret rotation
- Payment or billing logic
- Domain or OAuth callback changes
- Production incidents with unknown blast radius
```

- [ ] **Step 2: Create `docs/handoff/ai-prompt-handbook.md` with copy-paste prompts**

Write:

````md
# AI Prompt Handbook

## Rule Zero

Never paste secrets, tokens, recovery codes, or full production config into AI.

## Prompt 1: Explain Before Editing

```text
你是这个项目的技术助手。请先不要直接改代码。先用简单中文告诉我：
1. 这个需求要改哪些文件
2. 风险在哪里
3. 我该先检查什么
4. 如果是小改动，再给我一步一步操作
```

## Prompt 2: Bounded Small Change

```text
这是一个小改动，只允许修改和这个需求直接相关的文件。
不要改认证、数据库、支付、环境变量。
请先列出你准备改哪些文件和原因，再给出修改。
最后给我验证步骤和回滚方法。
```

## Prompt 3: Error Explanation

```text
这是报错原文。请先用简单中文解释它在说什么。
然后告诉我：
1. 我应该先看哪个日志或设置
2. 哪一步是安全的
3. 哪种情况必须先停下来找协作者
```
````

- [ ] **Step 3: Verify the matrix and prompt guide contain the required safety rails**

Run:

```bash
rg -n "Safe Alone|Must Escalate|不要改认证|Never paste secrets|Error Explanation" docs/handoff/change-risk-matrix.md docs/handoff/ai-prompt-handbook.md
```

Expected: the risk categories and the exact prompt templates are present.

- [ ] **Step 4: Commit the AI usage docs**

Run:

```bash
git add docs/handoff/change-risk-matrix.md docs/handoff/ai-prompt-handbook.md
git commit -m "docs: add handoff AI safety and risk guides"
```

Expected: a commit containing only the risk matrix and prompt handbook.

### Task 5: Create the Migration Checklist, Training Plan, and Handoff Log

**Files:**
- Create: `docs/handoff/ownership-migration-checklist.md`
- Create: `docs/handoff/training-week-plan.md`
- Create: `docs/handoff/handoff-log.md`

- [ ] **Step 1: Create `docs/handoff/ownership-migration-checklist.md`**

Write:

```md
# Ownership Migration Checklist

## GitHub

- [ ] Recipient GitHub account created
- [ ] 2FA enabled
- [ ] Repository transferred or recreated under recipient ownership
- [ ] Current owner added as collaborator

## Vercel

- [ ] Recipient Vercel account created
- [ ] Project connected to recipient-owned repository
- [ ] Environment variables recreated
- [ ] Production deployment succeeds
- [ ] Rollback path verified

## Supabase

- [ ] Recipient Supabase account created
- [ ] Project created under recipient ownership
- [ ] Schema recreated or migrated
- [ ] Auth providers configured
- [ ] Storage configuration checked

## Final Validation

- [ ] Site loads in production
- [ ] Login path works
- [ ] One safe content or UI change can be deployed
- [ ] Old owner access reviewed but retained as collaborator
- [ ] Old environment kept temporarily until the new environment passes smoke tests
```

- [ ] **Step 2: Create `docs/handoff/training-week-plan.md`**

Write:

```md
# Training Week Plan

## Session 1: System Map

- Goal: understand GitHub, Vercel, Supabase, and secrets
- Exit: recipient can explain what each service does

## Session 2: Ownership Migration

- Goal: create accounts and transfer ownership
- Exit: recipient owns the core services and the current owner has collaborator access

## Session 3: First Full Release

- Goal: ship a very small change end to end
- Exit: recipient can complete a low-risk release workflow

## Session 4: Small Change With AI

- Goal: use AI to make a bounded change safely
- Exit: recipient can review the changed files and explain the result

## Session 5: Failure Drill

- Goal: practice troubleshooting and escalation
- Exit: recipient can follow the debug order without panic

## Follow-up Milestones

- 30-day goal: recipient can handle content and presentation updates safely
- 60- to 90-day goal: recipient can handle small feature work with AI and collaborator review
```

- [ ] **Step 3: Create `docs/handoff/handoff-log.md`**

Write:

```md
# Handoff Log

| Date | Step | Owner | Evidence | Status | Blocker | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-03-29 | Secret audit started | Current owner | `packages/web/.env.example` reviewed | Pending | None | Replace live-looking values |
```

- [ ] **Step 4: Verify the migration, training, and tracking docs**

Run:

```bash
rg -n "GitHub|Vercel|Supabase|Session 1|Session 5|Handoff Log|Final Validation" docs/handoff/ownership-migration-checklist.md docs/handoff/training-week-plan.md docs/handoff/handoff-log.md
```

Expected: the migration checklist covers all three services, the training plan lists five sessions, and the log contains a trackable table.

- [ ] **Step 5: Commit the migration and training docs**

Run:

```bash
git add docs/handoff/ownership-migration-checklist.md docs/handoff/training-week-plan.md docs/handoff/handoff-log.md
git commit -m "docs: add handoff migration and training plans"
```

Expected: a commit containing only the migration checklist, training plan, and handoff log.

### Task 6: Dry-Run the Playbooks and Record Gaps Before Live Transfer

**Files:**
- Modify: `docs/handoff/handoff-log.md`
- Reference: `docs/handoff/release-playbook.md`
- Reference: `docs/handoff/troubleshooting-playbook.md`
- Reference: `docs/handoff/ownership-migration-checklist.md`

- [ ] **Step 1: Perform a desk-check of the migration checklist**

Open `docs/handoff/ownership-migration-checklist.md` and manually walk each checkbox using the current setup. For every item that is unclear or missing source information, add a row to `docs/handoff/handoff-log.md` with `Status` set to `Blocked`.

Expected: every unclear handoff step is recorded before any live transfer begins.

- [ ] **Step 2: Rehearse one low-risk release using the playbook**

Use `docs/handoff/release-playbook.md` to perform a copy-only or image-only change in a safe branch or preview flow. Record the result in `docs/handoff/handoff-log.md`.

Expected: the playbook reveals any missing instructions before the recipient relies on it.

- [ ] **Step 3: Rehearse one common failure using the troubleshooting playbook**

Pick a recent or easy-to-simulate issue, such as a missing environment variable in preview or a known UI regression. Follow `docs/handoff/troubleshooting-playbook.md` and record what worked, what was confusing, and what needs clarification.

Expected: the troubleshooting guide gets real feedback before the live handoff week.

- [ ] **Step 4: Update the docs to close any gaps found in rehearsal**

Modify whichever handoff doc was unclear. Use the log entry as the source of truth for what was missing.

Expected: the written handoff package is accurate enough to use during a live session.

- [ ] **Step 5: Commit the rehearsal fixes**

Run:

```bash
git add docs/handoff
git commit -m "docs: refine handoff playbooks after rehearsal"
```

Expected: a commit containing only doc changes caused by rehearsal findings.

### Task 7: Execute the Live Ownership Transfer and Record Acceptance

**Files:**
- Modify: `docs/handoff/ownership-migration-checklist.md`
- Modify: `docs/handoff/handoff-log.md`
- Reference: `docs/handoff/accounts-and-permissions.md`

- [ ] **Step 1: Create the recipient accounts and enable 2FA**

Create GitHub, Vercel, and Supabase under the recipient's control. Confirm 2FA and recovery code storage before moving anything else. Mark the completed checkboxes in `docs/handoff/ownership-migration-checklist.md`.

Expected: the recipient owns the accounts before any project assets move.

- [ ] **Step 2: Transfer GitHub ownership and collaborator access**

Transfer the repository or recreate it under the recipient's ownership, then add the current owner as collaborator. Record the exact repository URL and access status in `docs/handoff/handoff-log.md`.

Expected: the recipient owns the repo and the current owner can still review or help.

- [ ] **Step 3: Recreate the production project in recipient-owned Vercel and Supabase**

Connect the repo to a recipient-owned Vercel project, create the recipient-owned Supabase project, re-enter rotated secrets, and update callbacks or domain settings as needed. Mark each completed item in `docs/handoff/ownership-migration-checklist.md`.

Expected: production services are owned by the recipient and configured with non-shared secrets.

- [ ] **Step 4: Run the final smoke test**

Verify:

```text
1. The site loads in production
2. Authentication works
3. A low-risk content or UI change can deploy successfully
4. The rollback path is known and reachable
```

Record results in `docs/handoff/handoff-log.md`.

Expected: the recipient has a working production system under her own ownership.

- [ ] **Step 5: Commit the completed migration records**

Run:

```bash
git add docs/handoff/ownership-migration-checklist.md docs/handoff/handoff-log.md
git commit -m "docs: record live handoff completion"
```

Expected: the repository contains a dated record of what was transferred and verified.

### Task 8: Run the Five Training Sessions and Capture Final Signoff

**Files:**
- Modify: `docs/handoff/training-week-plan.md`
- Modify: `docs/handoff/handoff-log.md`
- Reference: `docs/handoff/ai-prompt-handbook.md`
- Reference: `docs/handoff/change-risk-matrix.md`

- [ ] **Step 1: Schedule all five sessions in `docs/handoff/training-week-plan.md`**

Add actual dates, call format, and target task for each session under the existing session headings.

Expected: the week has a concrete calendar instead of a vague intention.

- [ ] **Step 2: Run Sessions 1 through 3 and log evidence**

For each session, update `docs/handoff/handoff-log.md` with:

```text
- what was practiced
- what the recipient could do alone
- what still required prompting
```

Expected: the log shows whether the recipient is actually gaining operational independence.

- [ ] **Step 3: Run Sessions 4 and 5 using the AI handbook and risk matrix**

Have the recipient use the copy-paste prompts from `docs/handoff/ai-prompt-handbook.md` and classify each task through `docs/handoff/change-risk-matrix.md`. Record where she hesitated or overreached.

Expected: the recipient practices bounded AI usage before working alone.

- [ ] **Step 4: Record final signoff criteria in `docs/handoff/handoff-log.md`**

Add a final dated entry confirming whether the recipient can:

```text
- log into and navigate GitHub, Vercel, and Supabase
- complete one low-risk production change
- use AI to explain and bound a small change
- follow the troubleshooting order
- escalate a risky request instead of guessing
- know the next 30-day and 60- to 90-day learning goals
```

Expected: the handoff ends with concrete acceptance criteria, not a vague feeling.

- [ ] **Step 5: Commit the completed training records**

Run:

```bash
git add docs/handoff/training-week-plan.md docs/handoff/handoff-log.md
git commit -m "docs: record handoff training completion"
```

Expected: the repo contains the final training and acceptance record.
