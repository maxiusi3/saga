# Comprehensive Translation Test Plan

## Pages to Test

### Public Pages
1. ✅ Landing Page (/) - Already translated
2. ✅ Auth/Signin (/auth/signin) - Already translated
3. Terms (/terms)
4. Privacy (/privacy)
5. Privacy Pledge (/privacy-pledge)

### Dashboard Pages
6. ✅ Dashboard Home (/dashboard) - VERIFIED
7. ✅ Create Project (/dashboard/projects/create) - VERIFIED
8. Projects List (/dashboard/projects)
9. ✅ Purchase (/dashboard/purchase) - VERIFIED
10. Profile (/dashboard/profile)
11. Notifications (/dashboard/notifications)
12. Resources (/dashboard/resources)
13. Settings (/dashboard/settings)
14. Settings > Notifications (/dashboard/settings/notifications)
15. Help (/dashboard/help)

### Project Pages (Requires Project ID)
16. Project Detail (/dashboard/projects/[id])
17. ✅ Project Settings (/dashboard/projects/[id]/settings) - Translated
18. ✅ Recording (/dashboard/projects/[id]/record) - Translated
19. Stories List (/dashboard/projects/[id]/stories)
20. Story Detail (/dashboard/projects/[id]/stories/[storyId])
21. Invitations (/dashboard/projects/[id]/invitations)

### Special Pages
22. Accept Invitation (/accept-invitation)
23. Invite Token (/invite/[token])

## Translation Files Status

### Complete (100%)
- ✅ auth.json
- ✅ create-project.json
- ✅ recording.json (except 1 item in fr, pt)
- ✅ project-settings.json
- ✅ errors.json
- ✅ ai.json

### Mostly Complete (90%+)
- ⚠️ common.json (1-2 items untranslated)
- ⚠️ dashboard.json (2 items - emojis)
- ⚠️ stories.json (1 item in fr)
- ⚠️ subscription.json
- ⚠️ onboarding.json
- ⚠️ resources.json
- ⚠️ notifications-page.json (3 items in fr)
- ⚠️ notifications.json (1 item in fr)
- ⚠️ profile.json (1 item - phone placeholder)

### Needs Work
- ❌ pages.json (6-10 items - names, stats)
- ❌ projects.json (6-54 items - fr needs most work)
- ❌ purchase-page.json (5-6 items - badges, names)
- ❌ purchase.json (4 items - prices, CVV)
- ❌ settings.json (1-4 items)
- ❌ invitations.json (1 item in fr)

## Test Execution Plan

### Phase 1: Dashboard Pages (All Languages)
Test each language: es, fr, ja, ko, pt, zh-CN, zh-TW

1. Dashboard Home
2. Projects List
3. Profile
4. Notifications
5. Resources
6. Settings

### Phase 2: Project Pages (Sample Languages)
Test in: es, ja, zh-CN (representative sample)

1. Project Detail
2. Project Settings
3. Recording Page
4. Stories List
5. Story Detail

### Phase 3: Remaining Pages
Test in: es, zh-CN (spot check)

1. Terms
2. Privacy
3. Help

## Items That Should NOT Be Translated
- Emojis (📚, 👥, 🎭, etc.)
- Prices ($29, $49, $99, $209, CVV)
- Technical terms (SSL, CVC, Email)
- Person names (Sarah Johnson, Michael Chen, Emma Rodriguez)
- Brand name "Saga"
- Statistics (73%, 89%, 4.9/5)

## Success Criteria
- ✅ No English text visible (except technical terms)
- ✅ All buttons and labels translated
- ✅ Form placeholders translated
- ✅ Error/success messages translated
- ✅ Navigation elements translated
- ✅ No layout issues
- ✅ Text is readable and natural
