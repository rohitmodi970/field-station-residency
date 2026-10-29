# Supabase Migration Progress Report

## ✅ Completed Tasks

### 1. Next.js Configuration Updates
**File:** `apps/web/next.config.mjs`

- ✅ Added Supabase storage domain to `images.domains`:
  - `vefhdxvamzusfsaphdyo.supabase.co`

- ✅ Updated Content Security Policy headers:
  - `img-src`: Added `https://*.supabase.co`
  - `media-src`: Added `https://*.supabase.co`
  - `connect-src`: Added `https://*.supabase.co`

### 2. Google Drive Integration
**Files Created:**
- `apps/web/utils/google-drive/client.ts` (330 lines)

**Features:**
- OAuth2 client creation
- Authorization URL generation
- Token exchange and refresh
- File upload/download/delete
- Folder management
- File listing
- Authorization status checking

**Key Functions:**
- `generateAuthUrl()` - Get Google OAuth consent URL
- `getTokensFromCode()` - Exchange auth code for tokens
- `refreshAccessToken()` - Refresh expired tokens
- `uploadToGoogleDrive()` - Upload files
- `deleteFromGoogleDrive()` - Delete files
- `getFileMetadata()` - Get file info
- `downloadFromGoogleDrive()` - Download files
- `getOrCreateAppFolder()` - App folder management
- `listFilesInFolder()` - List files
- `isAuthorized()` - Check auth status

### 3. Multi-Provider Storage Utility
**File:** `apps/web/utils/storage/multi-provider.ts` (350+ lines)

**Features:**
- Unified API for Supabase + Google Drive
- Automatic provider selection
- Dual-storage support (upload to both)
- File validation
- Media metadata extraction (dimensions, duration)
- Signed URL generation

**Key Functions:**
- `uploadToStorage()` - Upload to selected provider(s)
- `deleteFromStorage()` - Delete from provider(s)
- `getPublicUrl()` - Get accessible URL
- `validateFile()` - Validate file type/size

**Supported Storage Options:**
- `supabase` - Supabase Storage only (fast, integrated)
- `google_drive` - Google Drive only (15GB free)
- `both` - Both providers (redundancy)

### 4. Onboarding APIs with Google Drive Auth
**Files Created:**

#### Upload Audio
`apps/web/app/api/user/onboarding/upload-audio/route.ts`
- POST endpoint for onboarding audio upload
- Storage provider selection
- Google Drive auth check
- Auto-prompt for Google login if needed
- Saves audio metadata to `user_onboarding` table

#### Upload Photo
`apps/web/app/api/user/onboarding/upload-photo/route.ts`
- POST endpoint for onboarding photo upload
- Image dimension extraction
- Storage provider selection
- Google Drive auth check
- Saves photo metadata to `user_onboarding` table

#### Google OAuth Flow
`apps/web/app/api/auth/google/authorize/route.ts`
- GET endpoint to initiate Google OAuth
- Redirects to Google consent screen
- State parameter with user ID

`apps/web/app/api/auth/google/callback/route.ts`
- GET endpoint for OAuth callback
- Exchanges authorization code for tokens
- Stores tokens in `user_settings.google_drive_auth`
- Redirects to settings page with success/error

### 5. Supabase Storage Export Fix
**File:** `apps/web/utils/supabase/storage.ts`
- ✅ Exported `BUCKETS` constant for use in other files
- Removed duplicate export statement

---

## 🚧 Remaining Tasks

### 1. Update Journal Media API
**File to update:** `apps/web/app/api/journal/media/route.ts` (if exists)

**Required Changes:**
- Add Google Drive support to media upload
- Check user's storage provider preference
- Implement Google Drive auth prompt
- Handle dual-storage uploads
- Update delete endpoint for both providers

### 2. Create User Profile API
**New file:** `apps/web/app/api/user/profile/route.ts`

**Required Endpoints:**
- GET - Fetch user profile
- PUT - Update user profile
- DELETE - Delete profile (with cascade to journals)

**Features:**
- Fetch from `user_profiles` table
- Update bio, interests, personality_type, etc.
- Handle profile photo uploads

### 3. Migrate Metrics API
**File to update:** `apps/web/app/api/metrics/update/route.ts`

**Current:** Uses MongoDB + next-auth
**New:** Use Supabase `user_metrics` table

**Changes:**
- Replace `getServerSession` with Supabase auth
- Update `user_metrics` instead of MongoDB
- Track: total_characters_written, total_time_spent_seconds, journal_count

### 4. Update Middleware
**File:** `apps/web/middleware.ts`

**Required Changes:**
- Keep existing Supabase auth logic ✅
- Add onboarding redirect logic:
  - Check `users.onboarding_complete` field
  - Redirect to `/user/onboarding` if false
  - Allow onboarding routes through
  - Redirect completed users away from onboarding

**Example:**
```typescript
export async function middleware(request: NextRequest) {
  const { supabase, response } = await updateSession(request);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single();
    
    const pathname = request.nextUrl.pathname;
    
    // Redirect to onboarding if not complete
    if (!userData?.onboarding_complete && !pathname.startsWith('/user/onboarding')) {
      return NextResponse.redirect(new URL('/user/onboarding', request.url));
    }
    
    // Redirect away from onboarding if already complete
    if (userData?.onboarding_complete && pathname.startsWith('/user/onboarding')) {
      return NextResponse.redirect(new URL('/user/dashboard', request.url));
    }
  }
  
  return response;
}
```

### 5. Create Onboarding Page
**New file:** `apps/web/app/user/onboarding/page.tsx`

**Features:**
- Multi-step wizard (5 steps)
- Step 1: Welcome + Goal setting
- Step 2: Audio recording (feeling audio)
- Step 3: Photo upload (pretty photo)
- Step 4: Preferences (writing time, reminders, notifications)
- Step 5: AI features consent
- Progress indicator
- Skip button for optional steps
- Storage provider selection

**State Management:**
- Use `useOnboarding` hook (needs creation)
- Track current step
- Save progress on each step
- Handle media uploads

### 6. Create useOnboarding Hook
**New file:** `apps/web/hooks/useOnboarding.ts`

**Features:**
- Fetch onboarding data
- Update onboarding steps
- Upload audio/photo
- Complete onboarding
- Handle errors

**API Calls:**
- GET `/api/user/onboarding`
- POST `/api/user/onboarding` (initialize)
- PUT `/api/user/onboarding` (update step)
- POST `/api/user/onboarding/upload-audio`
- POST `/api/user/onboarding/upload-photo`

---

## 🗄️ Database Schema Requirements

### Tables Already Created
✅ `users` - User accounts
✅ `user_settings` - User preferences
✅ `journals` - Journal entries
✅ `journal_media` - Media files
✅ `user_profiles` - Extended user profile
✅ `user_metrics` - Usage statistics

### New Table Needed: user_onboarding

```sql
CREATE TABLE user_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress
  step_completed INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 5,
  
  -- Step 1: Goal
  goal TEXT,
  preferred_journal_types TEXT[],
  
  -- Step 2: Audio
  feeling_audio JSONB, -- AudioMetadata type
  feeling_audio_transcription TEXT,
  feeling_audio_sentiment DECIMAL(3,2), -- -1.00 to 1.00
  
  -- Step 3: Photo
  pretty_photo JSONB, -- PhotoMetadata type
  
  -- Step 4: Preferences
  preferred_writing_time TEXT, -- 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime'
  reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_time TIME,
  notification_preferences JSONB,
  
  -- Step 5: AI Features
  ai_features_accepted BOOLEAN DEFAULT FALSE,
  ai_sentiment_analysis BOOLEAN DEFAULT TRUE,
  ai_topic_detection BOOLEAN DEFAULT TRUE,
  ai_writing_suggestions BOOLEAN DEFAULT FALSE,
  
  -- Additional
  interests TEXT[],
  personality_traits TEXT[],
  mood_tracking_enabled BOOLEAN DEFAULT TRUE,
  
  -- Completion
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Meta
  time_spent_seconds INTEGER DEFAULT 0,
  skipped_steps TEXT[],
  device_type TEXT,
  platform TEXT,
  version TEXT DEFAULT '1.0',
  referral_source TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding"
  ON user_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON user_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding"
  ON user_onboarding FOR DELETE
  USING (auth.uid() = user_id);
```

### Update user_settings Table

Add Google Drive auth column:

```sql
ALTER TABLE user_settings
ADD COLUMN google_drive_auth JSONB;

-- Example structure:
-- {
--   "access_token": "ya29...",
--   "refresh_token": "1//...",
--   "expiry_date": 1234567890
-- }
```

---

## 🔑 Environment Variables

All required variables already present in `.env`:

✅ `NEXT_PUBLIC_SUPABASE_URL`
✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
✅ `SUPABASE_SERVICE_ROLE_KEY`
✅ `GOOGLE_CLIENT_ID`
✅ `GOOGLE_CLIENT_SECRET`
✅ `NEXT_PUBLIC_API_URL`

---

## 📦 Required Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "googleapis": "^140.0.0"
  }
}
```

Install:
```bash
pnpm add googleapis
```

---

## 🧪 Testing Checklist

### Google Drive Integration
- [ ] Visit `/api/auth/google/authorize`
- [ ] Complete Google OAuth consent
- [ ] Verify tokens saved in `user_settings`
- [ ] Upload file with `storage_provider=google_drive`
- [ ] Verify file appears in Google Drive
- [ ] Delete file and verify removal

### Onboarding Flow
- [ ] Create new user account
- [ ] Verify redirect to `/user/onboarding`
- [ ] Complete step 1 (goal)
- [ ] Upload audio in step 2
- [ ] Upload photo in step 3
- [ ] Set preferences in step 4
- [ ] Accept AI features in step 5
- [ ] Verify `users.onboarding_complete = true`
- [ ] Verify redirect to dashboard

### Multi-Storage
- [ ] Upload with `storage_provider=supabase`
- [ ] Upload with `storage_provider=google_drive`
- [ ] Upload with `storage_provider=both`
- [ ] Verify both providers have the file
- [ ] Delete file and verify both removed

---

## 📝 Next Steps

1. **Install Dependencies:**
   ```bash
   pnpm add googleapis
   ```

2. **Create Database Table:**
   - Run `user_onboarding` table SQL in Supabase
   - Add `google_drive_auth` column to `user_settings`

3. **Update Middleware:**
   - Add onboarding redirect logic

4. **Create Onboarding Hook:**
   - `apps/web/hooks/useOnboarding.ts`

5. **Create Onboarding Page:**
   - `apps/web/app/user/onboarding/page.tsx`

6. **Update Journal Media API:**
   - Add Google Drive support to existing media endpoints

7. **Migrate Metrics API:**
   - Replace MongoDB with Supabase in `metrics/update`

8. **Create User Profile API:**
   - CRUD endpoints for `user_profiles` table

9. **Test Everything:**
   - Follow testing checklist above

---

## 🎯 Migration Summary

### What's Done ✅
- Next.js config updated with Supabase domains
- Google Drive OAuth flow complete
- Multi-provider storage utility ready
- Onboarding media upload APIs created
- Type definitions complete
- Documentation created

### What's Left 🚧
- Database table creation
- Middleware onboarding logic
- Onboarding page UI
- useOnboarding hook
- Journal media API update
- Metrics API migration
- User profile API
- Testing and validation

### Estimated Time Remaining
- Database setup: 30 min
- Middleware: 1 hour
- Onboarding hook: 1 hour
- Onboarding page: 3-4 hours
- API updates: 2 hours
- Testing: 2 hours

**Total: ~10-12 hours**

---

## 📚 Documentation

All code includes:
- ✅ JSDoc comments
- ✅ TypeScript types
- ✅ Error handling
- ✅ Console logging
- ✅ Proper auth checks
- ✅ RLS bypass where needed

---

## 🔒 Security Considerations

- ✅ All sensitive operations use admin client
- ✅ User ID verification in all endpoints
- ✅ File type and size validation
- ✅ Google tokens stored securely in database
- ✅ RLS policies on all tables
- ✅ Signed URLs for private media
- ✅ State parameter in OAuth to prevent CSRF

---

Ready to continue with the remaining tasks! 🚀
