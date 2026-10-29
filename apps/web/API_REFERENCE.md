# API Endpoints Reference

Complete reference for all migrated and existing APIs.

---

## 📚 Journal APIs

### GET /api/fetch-journals
Fetch paginated journal entries with filtering and search.

**Query Parameters:**
- `limit` (number, default: 10) - Entries per page
- `page` (number, default: 1) - Page number
- `mood` (string, optional) - Filter by mood
- `tag` (string, optional) - Filter by tag
- `sortBy` (string, default: "created_at") - Sort field
- `sortOrder` ("asc" | "desc", default: "desc") - Sort direction
- `search` (string, optional) - Search in title/content

**Example:**
```
GET /api/fetch-journals?limit=6&page=1&sortBy=created_at&sortOrder=desc&search=gratitude
```

**Response:**
```json
{
  "journals": [
    {
      "journal_id": "uuid",
      "user_id": "uuid",
      "title": "My Gratitude Journal",
      "content": "Today I'm grateful for...",
      "mood": "Happy",
      "tags": ["gratitude", "mindfulness"],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "is_deleted": false
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 6,
    "totalPages": 7
  }
}
```

---

### GET /api/fetch-journals/journal-stats
Get comprehensive statistics about user's journaling habits.

**No Parameters Required** - Uses authenticated user

**Response:**
```json
{
  "totalEntries": 42,
  "streakCount": 7,
  "lastEntryDate": "2024-01-15T10:30:00Z",
  "weeklyEntries": 5,
  "averageMood": "Positive",
  "mostProductiveDay": "Wednesday",
  "topTopics": [
    { "name": "gratitude", "count": 15 },
    { "name": "productivity", "count": 12 },
    { "name": "mindfulness", "count": 10 },
    { "name": "work", "count": 8 },
    { "name": "family", "count": 7 }
  ]
}
```

**Statistics Explained:**
- `totalEntries` - Total number of journal entries
- `streakCount` - Current daily writing streak
- `lastEntryDate` - Timestamp of most recent entry
- `weeklyEntries` - Entries in the last 7 days
- `averageMood` - Dominant mood: "Positive", "Neutral", or "Negative"
- `mostProductiveDay` - Day of week with most entries
- `topTopics` - Top 5 most used tags

---

## 🤖 AI APIs

### GET /api/prompts/personalized
Generate personalized writing prompts using AI based on recent journal entries.

**No Parameters Required** - Uses authenticated user

**How It Works:**
1. Fetches user's 3 most recent journal entries
2. Analyzes content with Google Gemini 2.0-flash
3. Identifies mood trends, patterns, themes
4. Generates personalized prompt and suggestions

**Response:**
```json
{
  "prompt": {
    "text": "What made you feel grateful this week?",
    "explanation": "Based on your recent entries showing positivity and appreciation, exploring gratitude can deepen this positive trend."
  },
  "suggestions": {
    "moodTrends": {
      "primaryMood": "grateful",
      "trend": "increasing",
      "intensity": 0.8
    },
    "aiNudge": {
      "theme": "Gratitude Practice",
      "suggestion": "Your entries show a growing sense of appreciation for daily moments. This is a wonderful pattern to nurture.",
      "action": "Try writing 3 things you're grateful for each morning before starting your day."
    },
    "patternInsight": {
      "pattern": "Morning writing habit",
      "exploration": "You tend to write most productively in the morning. Consider establishing a consistent morning journaling routine to strengthen this natural rhythm."
    }
  }
}
```

**For New Users (no entries):**
```json
{
  "prompt": {
    "text": "What's on your mind today?",
    "explanation": "Start your journaling journey by sharing your thoughts and feelings."
  },
  "suggestions": {
    "moodTrends": {
      "primaryMood": "neutral",
      "trend": "starting",
      "intensity": 0.5
    },
    "aiNudge": {
      "theme": "Getting Started",
      "suggestion": "Begin your journaling journey by writing about your day.",
      "action": "Try writing for 5 minutes about what made you smile today."
    },
    "patternInsight": {
      "pattern": "New to journaling",
      "exploration": "Explore different writing styles and find what works best for you."
    }
  }
}
```

---

## 📤 Onboarding APIs

### POST /api/user/onboarding/upload-audio
Upload audio file during onboarding.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` (File) - Audio file
  - `storageProvider` ("supabase" | "google_drive" | "both")

**Validation:**
- Max size: 5MB
- Allowed types: audio/*, .mp3, .wav, .m4a, .ogg

**Response (Success):**
```json
{
  "success": true,
  "metadata": {
    "url": "https://...",
    "provider": "supabase",
    "duration": 45.2,
    "size": 2048576,
    "mimeType": "audio/mpeg"
  }
}
```

**Response (Requires Auth):**
```json
{
  "requiresAuth": true,
  "authUrl": "/api/auth/google/authorize",
  "message": "Google Drive authorization required"
}
```

**Error Response:**
```json
{
  "error": "File too large. Maximum size is 5MB"
}
```

---

### POST /api/user/onboarding/upload-photo
Upload photo during onboarding.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` (File) - Image file
  - `storageProvider` ("supabase" | "google_drive" | "both")

**Validation:**
- Max size: 5MB
- Allowed types: image/*, .jpg, .jpeg, .png, .gif, .webp

**Response (Success):**
```json
{
  "success": true,
  "metadata": {
    "url": "https://...",
    "provider": "google_drive",
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "size": 3145728,
    "mimeType": "image/jpeg"
  }
}
```

---

## 🔐 Authentication APIs

### GET /api/auth/google/authorize
Initiate Google OAuth flow for Google Drive access.

**Query Parameters:**
- None - Uses authenticated user's ID for state

**Response:**
- Redirects to Google OAuth consent screen
- Scope: `https://www.googleapis.com/auth/drive.file`
- State: User ID (for security validation)

**After Authorization:**
- User redirects to `/api/auth/google/callback`

---

### GET /api/auth/google/callback
Handle Google OAuth callback and store tokens.

**Query Parameters:**
- `code` (string, required) - OAuth authorization code
- `state` (string, required) - User ID for validation
- `error` (string, optional) - Error if user denied

**Success Response:**
- Stores tokens in `user_settings.google_drive_auth`
- Redirects to `/user/settings?success=google_drive_connected`

**Error Response:**
- Redirects to `/user/settings?error=<error_type>`
- Error types:
  - `google_auth_denied` - User denied authorization
  - `invalid_callback` - Missing code/state
  - `invalid_state` - State parameter mismatch
  - `token_exchange_failed` - Failed to get tokens
  - `storage_failed` - Failed to save tokens
  - `callback_error` - General error

---

## 🔄 Migration Notes

### Changes from MongoDB to Supabase

**Field Name Mapping:**
- `journalId` → `journal_id`
- `userId` → `user_id`
- `timestamp` → `created_at`
- `updatedAt` → `updated_at`

**Removed Fields:**
- Encrypted content fields (now use Supabase RLS)
- `decryptJournalData()` calls removed

**Authentication:**
- `getServerSession(authOptions)` → `createClient().auth.getUser()`
- `User.findOne({ email })` → Direct user ID from Supabase auth

**Database Queries:**
- `Journal.find({ userId })` → `adminClient.from('journals').select().eq('user_id', user.id)`
- MongoDB aggregation → Supabase queries with filters

---

## 🔒 Security

All APIs require authentication via Supabase Auth:

```typescript
const supabase = await createClient();
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Row Level Security (RLS):**
- All journal data protected by Supabase RLS policies
- Users can only access their own data
- No encryption needed - database handles security

---

## 📊 Error Handling

All APIs follow consistent error format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (not authenticated)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🧪 Testing

### Test Journal Stats
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/fetch-journals/journal-stats
```

### Test Fetch Journals with Filters
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/fetch-journals?limit=5&mood=happy&search=gratitude"
```

### Test Personalized Prompts
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/prompts/personalized
```

### Test Audio Upload
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@audio.mp3" \
  -F "storageProvider=supabase" \
  http://localhost:3000/api/user/onboarding/upload-audio
```

---

## 🎯 Next Steps

1. **Install googleapis:**
   ```bash
   pnpm add googleapis
   ```

2. **Update Settings Page:**
   - Add storage provider selection
   - Add Google Drive connection status
   - Add connect/disconnect button

3. **Test Complete Flow:**
   - Create test journal entries
   - Verify statistics calculations
   - Test AI prompt generation
   - Test onboarding flow
   - Test Google Drive integration

---

## 📝 Notes

- All APIs use Supabase Admin Client for database operations
- Google Drive operations require valid OAuth tokens
- AI prompts use Google Gemini 2.0-flash model
- Media files support both Supabase Storage and Google Drive
- Onboarding is tracked in `user_onboarding` table
- User preferences stored in `user_settings` table
