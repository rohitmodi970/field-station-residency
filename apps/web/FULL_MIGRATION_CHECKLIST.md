# Complete API Migration Checklist

This document tracks ALL APIs that need migration from MongoDB to Supabase.

---

## ✅ COMPLETED MIGRATIONS

### 1. fetch-journals/route.ts ✅
**Status:** Migrated to Supabase
- Replaced getServerSession → createClient().auth.getUser()
- Replaced Journal.find() → adminClient.from('journals')
- Added pagination with .range()
- Added search, filtering, sorting

### 2. fetch-journals/journal-stats/route.ts ✅
**Status:** Migrated to Supabase
- Statistics calculations working
- Streak calculation working
- All TypeScript errors resolved

### 3. prompts/personalized/route.ts ✅
**Status:** Migrated to Supabase
- Gemini AI integration working
- Fetches from journals table
- Removed decryption

### 4. auth/google/authorize/route.ts ✅
**Status:** Already using Supabase
- Generates Google OAuth URL

### 5. auth/google/callback/route.ts ✅
**Status:** Already using Supabase
- Handles OAuth callback
- Stores tokens in user_settings

### 6. user/onboarding/upload-audio/route.ts ✅
**Status:** Already using Supabase
- Multi-provider storage working
- Google Drive auth checks working

### 7. user/onboarding/upload-photo/route.ts ✅
**Status:** Already using Supabase
- Multi-provider storage working
- Image dimension extraction working

---

## ⚠️ PENDING MIGRATIONS

### Priority 1: Critical User-Facing APIs

#### 8. fetch-journals/[journalId]/route.ts ⚠️
**Current:** MongoDB (getServerSession, Journal.findOne, decryptJournalData)
**Needs:**
- GET - Fetch single journal by ID
- DELETE - Soft delete journal (set is_deleted = true)
- Supabase query: `adminClient.from('journals').select().eq('journal_id', id).eq('user_id', user.id).single()`

#### 9. journal/route.ts ⚠️
**Check:** May have POST/PUT for creating/updating journals
**Needs:**
- POST - Create new journal entry
- PUT - Update existing journal
- Migration to journals table

#### 10. journal-entry/route.ts ⚠️
**Check:** Possible duplicate of journal/route.ts
**Needs:** Analysis to determine if still used

#### 11. journal-entry/[journalid]/route.ts ⚠️
**Check:** Another journal ID endpoint
**Needs:** Analysis to determine if duplicate

### Priority 2: User Management APIs

#### 12. updateProfile/route.ts ⚠️
**Current:** MongoDB (getServerSession, User.findOne, User.updateOne)
**Needs:**
- PUT - Update user profile
- Migrate to user_profiles table
- Supabase query: `adminClient.from('user_profiles').update().eq('user_id', user.id)`

#### 13. user/onboarding/route.ts ⚠️
**Current:** MongoDB
**Needs:**
- GET - Fetch onboarding data
- POST - Initialize onboarding
- PUT - Update onboarding step
- DELETE - Reset onboarding
- Migrate to user_onboarding table

#### 14. user/settings/route.ts ⚠️
**Check:** May use MongoDB for user settings
**Needs:**
- GET - Fetch user settings
- PUT - Update user settings
- Migrate to user_settings table

#### 15. user/feedback/route.ts ⚠️
**Current:** MongoDB (getServerSession, connectDB)
**Needs:**
- POST - Submit user feedback
- Check if feedback table exists in Supabase
- Create table if needed

#### 16. user/deleteAccount/route.ts ⚠️
**Check:** Account deletion endpoint
**Needs:**
- DELETE - Soft delete user account
- Update Supabase auth + users table

#### 17. fetchUserData/route.ts ⚠️
**Check:** User data fetching
**Needs:** Analysis and migration

### Priority 3: Media & Analysis APIs

#### 18. journal/media/route.ts ⚠️
**Check:** Journal media operations
**Needs:**
- GET - List media for journal
- POST - Upload media
- Migrate to journal_media table

#### 19. media/upload/route.ts ⚠️
**Check:** General media upload
**Needs:**
- POST - Upload media files
- Multi-provider storage support

#### 20. media/delete/route.ts ⚠️
**Check:** Media deletion
**Needs:**
- DELETE - Remove media
- Handle both Supabase and Google Drive

#### 21. media/get/route.ts ⚠️
**Check:** Media retrieval
**Needs:**
- GET - Fetch media file
- Support both storage providers

#### 22. media/list-folder/route.ts ⚠️
**Check:** List media in folder
**Needs:**
- GET - List all media
- Query journal_media table

#### 23. audio-analysis/route.ts ⚠️
**Check:** Audio transcription/analysis
**Needs:** Analysis - may use external API

#### 24. audio-analysis/chunk/route.ts ⚠️
**Check:** Chunked audio upload
**Needs:** Analysis

#### 25. audio-analysis/finalize/route.ts ⚠️
**Check:** Finalize audio processing
**Needs:** Analysis

#### 26. voice-analysis/route.ts ⚠️
**Check:** Voice analysis
**Needs:** Analysis

#### 27. journal-analysis/route.ts ⚠️
**Check:** Journal entry analysis
**Needs:** May need AI insights migration

#### 28. journal/analyze/route.ts ⚠️
**Check:** Another analysis endpoint
**Needs:** Determine if duplicate

#### 29. sentiment/analyze-entry/route.ts ⚠️
**Check:** Sentiment analysis
**Needs:** Analysis - may use external API

### Priority 4: AI & Prompts

#### 30. prompts/random/route.ts ⚠️
**Check:** Random prompt generation
**Needs:** Analysis - may just return static prompts

#### 31. llm/route.ts ⚠️
**Check:** LLM integration
**Needs:** Analysis - may be for AI features

#### 32. aitopia/route.ts ⚠️
**Check:** AI features
**Needs:** Analysis

### Priority 5: Utility & Admin APIs

#### 33. metrics/update/route.ts ⚠️
**Check:** Update user metrics
**Needs:**
- POST - Update metrics
- Migrate to user_metrics table

#### 34. admin/metrics/route.ts ⚠️
**Check:** Admin analytics
**Needs:**
- GET - Admin metrics dashboard
- May need admin-only access checks

#### 35. register/route.ts ⚠️
**Check:** User registration
**Needs:**
- POST - Register new user
- **Should use Supabase Auth signup**

#### 36. check-email/route.ts ⚠️
**Check:** Email validation
**Needs:**
- GET - Check if email exists
- Query Supabase auth.users

#### 37. sync/route.ts ⚠️
**Check:** Data synchronization
**Needs:** Analysis

#### 38. wordcloud/route.ts ⚠️
**Check:** Word cloud generation
**Needs:** Analysis - may be client-side

#### 39. ocr/upload/route.ts ⚠️
**Check:** OCR image processing
**Needs:** Analysis - external API

#### 40. submit-form/route.ts ⚠️
**Check:** Form submission
**Needs:** Analysis

#### 41. get-ip/route.ts ⚠️
**Check:** Get user IP
**Needs:** Analysis - utility endpoint

#### 42. betaUsers/route.ts ⚠️
**Check:** Beta user management
**Needs:** Analysis

#### 43. user/storage-usage/route.ts ⚠️
**Check:** Storage usage stats
**Needs:**
- GET - Calculate storage used
- Query Supabase Storage API

### Priority 6: Journal Entry Fetch Data

#### 44. journal-entry/fetch-data/route.ts ⚠️
**Check:** Fetch journal entry data
**Needs:** Analysis - may be duplicate

---

## 📊 Migration Statistics

- **Total APIs Found:** 86
- **Already Migrated:** 7 ✅
- **Using Supabase:** 7 ✅
- **Pending Analysis:** ~36 ⚠️
- **Total Needing Work:** ~36

---

## 🎯 Next Steps

### Phase 1: Critical User APIs (Priority 1)
1. Migrate fetch-journals/[journalId]/route.ts
2. Migrate journal/route.ts (POST/PUT)
3. Verify journal-entry routes

### Phase 2: User Management (Priority 2)
4. Migrate updateProfile/route.ts
5. Complete user/onboarding/route.ts
6. Migrate user/settings/route.ts
7. Migrate user/feedback/route.ts
8. Verify user/deleteAccount/route.ts

### Phase 3: Media Operations (Priority 3)
9. Migrate journal/media/route.ts
10. Update media/* endpoints for multi-provider

### Phase 4: AI & Analysis (Priority 4)
11. Audit all analysis endpoints
12. Verify AI integrations
13. Update to use ai_insights table if needed

### Phase 5: Utilities & Admin (Priority 5)
14. Migrate metrics endpoints
15. Update admin endpoints
16. Verify registration flow

---

## 🔍 How to Check Each API

Run this command for each route:
```bash
grep -n "connectDB\|getServerSession\|authOptions\|User\.find\|Journal\.find\|decryptJournalData" <route-file>
```

If any matches found → Needs migration
If no matches → Already using Supabase or is standalone

---

## 📝 Migration Template

For each API, follow this pattern:

### Before (MongoDB):
```typescript
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utilities/auth';
import connectDB from '@/db/connectDB';
import Journal from '@/models/JournalModel';

const session = await getServerSession(authOptions);
await connectDB();
const journal = await Journal.findOne({ journalId });
```

### After (Supabase):
```typescript
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const adminClient = createAdminClient();
const { data: journal } = await adminClient
  .from('journals')
  .select('*')
  .eq('journal_id', journalId)
  .eq('user_id', user.id)
  .single();
```

---

## 🚨 Critical Issues to Watch

1. **Double-check authentication** - Every endpoint must verify user
2. **Update field names** - journalId → journal_id, userId → user_id
3. **Remove encryption** - No decryptJournalData calls
4. **Add RLS checks** - Ensure .eq('user_id', user.id) on all queries
5. **Handle errors** - Proper 401, 404, 500 responses
6. **Test thoroughly** - Each endpoint after migration

---

## 📌 Notes

- Some endpoints may be unused/deprecated - verify with user
- Media endpoints need multi-provider storage support
- Admin endpoints need role-based access control
- AI endpoints may use external APIs (Gemini, OpenAI)
- Registration should use Supabase Auth .signUp()
- Email checking should query Supabase auth.users

---

## ✅ Completion Criteria

- [ ] All MongoDB imports removed
- [ ] All connectDB() calls removed
- [ ] All getServerSession() calls replaced
- [ ] All Mongoose models removed
- [ ] All decryptJournalData() calls removed
- [ ] All field names updated
- [ ] All endpoints return correct data
- [ ] All TypeScript errors resolved
- [ ] All tests passing
- [ ] User confirms no 401 errors
