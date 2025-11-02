# Final Translation Fix Plan

## Current Status (After Testing)

### ✅ Completed
1. Created translation analysis tools
2. Translated create-project.json for 5 languages (es, fr, ja, ko, pt)
3. Committed translations to git
4. Tested production environment
5. Identified all translation gaps

### ❌ Critical Issues Found in Production

1. **create-project.json** - Translated locally but not deployed (FIXED - committed)
2. **purchase-page.json** - Completely untranslated (62 items × 5 languages)
3. **recording.json** - Completely untranslated (66 items × 6 languages)
4. **project-settings.json** - Completely untranslated (30 items × 5 languages)
5. **Bottom navigation** - "My Sagas", "Resources", "Profile" untranslated in ALL languages

## Immediate Action Plan

### Step 1: Deploy Existing Translations ✅
```bash
git push origin main
```
This will deploy the create-project.json translations.

### Step 2: Fix Bottom Navigation (HIGH PRIORITY)

Need to translate in common.json or pages.json:
- "My Sagas" → "Mis Sagas" (es), "Mes Sagas" (fr), "マイサガ" (ja), etc.
- "Resources" → "Recursos" (es), "Ressources" (fr), "リソース" (ja), etc.
- "Profile" → "Perfil" (es), "Profil" (fr), "プロフィール" (ja), etc.

### Step 3: Complete Critical Page Translations

#### Priority 1: purchase-page.json (REVENUE CRITICAL)
**Items to translate:** ~60 per language
**Languages:** es, fr, ja, ko, pt
**Total:** ~300 items

Key sections:
- Hero section (title, subtitle, CTA)
- Features (3 items)
- Pricing package details
- Checkout form
- Testimonials
- FAQ

#### Priority 2: recording.json (CORE FUNCTIONALITY)
**Items to translate:** ~65 per language
**Languages:** es, fr, ja, ko, pt, zh-TW
**Total:** ~390 items

Key sections:
- Page title and subtitle
- Recording controls (Start, Stop, Pause, etc.)
- Status messages
- Tips and guidance
- AI processing messages
- Error and success messages

#### Priority 3: project-settings.json (IMPORTANT)
**Items to translate:** ~30 per language
**Languages:** es, fr, ja, ko, pt
**Total:** ~150 items

Key sections:
- Page title
- Quick actions
- Project stats
- Project overview form
- Member management
- Success/error messages

## Translation Strategy

### Option A: AI-Assisted Translation (RECOMMENDED)
**Time:** 2-3 hours
**Cost:** ~$5-10 in API credits
**Quality:** Good (85-90%)

Steps:
1. Use translate-with-ai.js script
2. Batch translate all missing items
3. Manual review of critical pages
4. Native speaker spot-check

### Option B: Professional Translation
**Time:** 1-2 weeks
**Cost:** $500-1000
**Quality:** Excellent (95-100%)

### Option C: Hybrid (BEST BALANCE)
**Time:** 1 day
**Cost:** $50-100
**Quality:** Very Good (90-95%)

Steps:
1. AI translate all items (2-3 hours)
2. Professional review of purchase page only (4-6 hours)
3. Community review for other pages

## Files to Create/Update

### High Priority
1. ✅ `packages/web/public/locales/es/create-project.json` - DONE
2. ✅ `packages/web/public/locales/fr/create-project.json` - DONE
3. ✅ `packages/web/public/locales/ja/create-project.json` - DONE
4. ✅ `packages/web/public/locales/ko/create-project.json` - DONE
5. ✅ `packages/web/public/locales/pt/create-project.json` - DONE
6. ❌ `packages/web/public/locales/*/purchase-page.json` - NEEDS WORK
7. ❌ `packages/web/public/locales/*/recording.json` - NEEDS WORK
8. ❌ `packages/web/public/locales/*/project-settings.json` - NEEDS WORK
9. ❌ `packages/web/public/locales/*/common.json` - NEEDS MINOR FIXES

### Medium Priority
10. `packages/web/public/locales/*/pages.json` - Minor fixes
11. `packages/web/public/locales/*/dashboard.json` - Minor fixes
12. `packages/web/public/locales/*/projects.json` - Minor fixes

## Verification Plan

After deploying translations, test these URLs:

### Spanish (es)
- https://saga-web-livid.vercel.app/es/dashboard
- https://saga-web-livid.vercel.app/es/dashboard/projects/create
- https://saga-web-livid.vercel.app/es/dashboard/purchase
- https://saga-web-livid.vercel.app/es/dashboard/profile

### French (fr)
- https://saga-web-livid.vercel.app/fr/dashboard
- https://saga-web-livid.vercel.app/fr/dashboard/projects/create
- https://saga-web-livid.vercel.app/fr/dashboard/purchase
- https://saga-web-livid.vercel.app/fr/dashboard/profile

### Japanese (ja)
- https://saga-web-livid.vercel.app/ja/dashboard
- https://saga-web-livid.vercel.app/ja/dashboard/projects/create
- https://saga-web-livid.vercel.app/ja/dashboard/purchase
- https://saga-web-livid.vercel.app/ja/dashboard/profile

### Korean (ko)
- https://saga-web-livid.vercel.app/ko/dashboard
- https://saga-web-livid.vercel.app/ko/dashboard/projects/create
- https://saga-web-livid.vercel.app/ko/dashboard/purchase
- https://saga-web-livid.vercel.app/ko/dashboard/profile

### Portuguese (pt)
- https://saga-web-livid.vercel.app/pt/dashboard
- https://saga-web-livid.vercel.app/pt/dashboard/projects/create
- https://saga-web-livid.vercel.app/pt/dashboard/purchase
- https://saga-web-livid.vercel.app/pt/dashboard/profile

### Chinese Simplified (zh-CN) - Verify no regressions
- https://saga-web-livid.vercel.app/zh-CN/dashboard
- https://saga-web-livid.vercel.app/zh-CN/dashboard/projects/create
- https://saga-web-livid.vercel.app/zh-CN/dashboard/purchase

### Chinese Traditional (zh-TW) - Verify no regressions
- https://saga-web-livid.vercel.app/zh-TW/dashboard
- https://saga-web-livid.vercel.app/zh-TW/dashboard/projects/create
- https://saga-web-livid.vercel.app/zh-TW/dashboard/purchase

## Success Criteria

### Must Have (P0)
- ✅ create-project.json deployed and working
- ⏳ purchase-page.json 100% translated
- ⏳ Bottom navigation translated
- ⏳ No English text on critical pages (except technical terms)

### Should Have (P1)
- ⏳ recording.json 100% translated
- ⏳ project-settings.json 100% translated
- ⏳ All dashboard pages properly translated

### Nice to Have (P2)
- ⏳ Professional review completed
- ⏳ Translation CI/CD set up
- ⏳ Translation coverage > 95% for all languages

## Timeline

### Immediate (Today)
- ✅ Commit and push create-project.json translations
- ⏳ Deploy to production
- ⏳ Verify deployment

### Short-term (This Week)
- ⏳ Complete purchase-page.json translations
- ⏳ Complete recording.json translations
- ⏳ Complete project-settings.json translations
- ⏳ Fix bottom navigation
- ⏳ Deploy and verify

### Medium-term (Next Week)
- ⏳ Professional review of critical pages
- ⏳ Fix any issues found
- ⏳ Complete remaining minor translations

### Long-term (Next Month)
- ⏳ Set up translation CI/CD
- ⏳ Implement translation management system
- ⏳ Regular translation audits

## Next Actions

1. **Push to production:**
   ```bash
   git push origin main
   ```

2. **Wait for Vercel deployment** (~2-3 minutes)

3. **Verify create-project.json is working:**
   - Visit https://saga-web-livid.vercel.app/es/dashboard/projects/create
   - Check if text is in Spanish

4. **If working, proceed with remaining translations**

5. **If not working, check:**
   - Vercel deployment logs
   - File paths are correct
   - JSON syntax is valid
   - Next.js i18n configuration

## Tools Available

- ✅ `translation-report.js` - Check translation status
- ✅ `extract-untranslated.js` - Find missing translations
- ✅ `complete-translations.js` - Apply translations
- ✅ `translate-with-ai.js` - AI-powered translation
- ✅ `run-translation-tests.js` - Test plan generator
- ✅ Playwright MCP - Automated testing

## Contact for Review

After completing translations, have these people review:
- Spanish: Native Spanish speaker
- French: Native French speaker
- Japanese: Native Japanese speaker
- Korean: Native Korean speaker
- Portuguese: Native Portuguese speaker (Brazilian)

Focus review on:
1. Purchase page (revenue critical)
2. Create project page (first impression)
3. Recording page (core functionality)
