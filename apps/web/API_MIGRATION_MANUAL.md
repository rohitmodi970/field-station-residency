# API Migration Guide - Copy & Paste Instructions

## ⚠️ Important: Manual File Creation Required

Due to file system conflicts, please create these files manually by copying the code below.

---

## 1. Journal Stats API

**File:** `apps/web/app/api/fetch-journals/journal-stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: journals, error } = await adminClient
      .from('journals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const total = journals?.length || 0;
    const thisWeek = journals?.filter(j => 
      new Date(j.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length || 0;

    return NextResponse.json({
      totalEntries: total,
      weeklyEntries: thisWeek,
      lastEntryDate: journals?.[0]?.created_at || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 2. Fetch Journals API

**File:** `apps/web/app/api/fetch-journals/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const adminClient = createAdminClient();
    const { data: journals, error } = await adminClient
      .from('journals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 });
    }

    const formatted = (journals || []).map(j => ({
      id: j.journal_id,
      title: j.title || 'Untitled',
      preview: j.content?.substring(0, 150) || '',
      date: j.date || j.created_at,
      mood: j.mood || 'Neutral',
      tags: j.tags || [],
    }));

    return NextResponse.json({ journals: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 3. Personalized Prompts API

**File:** `apps/web/app/api/prompts/personalized/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const DEFAULT_PROMPTS = [
  "What made you smile today?",
  "Describe a challenge you overcame recently.",
  "What are you grateful for right now?",
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: journals } = await adminClient
      .from('journals')
      .select('mood, tags')
      .eq('user_id', user.id)
      .limit(10);

    // Generate personalized prompts based on user's history
    const prompts = [...DEFAULT_PROMPTS];
    
    if (journals && journals.length > 0) {
      const moods = journals.map(j => j.mood).filter(Boolean);
      const tags = journals.flatMap(j => j.tags || []);
      
      if (moods.length > 0) {
        prompts.push(`Reflect on your ${moods[0]} mood today.`);
      }
      if (tags.length > 0) {
        prompts.push(`Write about ${tags[0]}.`);
      }
    }

    return NextResponse.json({ prompts: prompts.slice(0, 5) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 4. Install googleapis Dependency

Run this command:

```bash
pnpm add googleapis
```

---

## 5. Database Table - user_onboarding

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE user_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_completed INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 5,
  goal TEXT,
  preferred_journal_types TEXT[],
  feeling_audio JSONB,
  feeling_audio_transcription TEXT,
  pretty_photo JSONB,
  preferred_writing_time TEXT,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_time TIME,
  notification_preferences JSONB,
  ai_features_accepted BOOLEAN DEFAULT FALSE,
  interests TEXT[],
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  device_type TEXT,
  platform TEXT,
  version TEXT DEFAULT '1.0',
  referral_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

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
```

---

## 6. Add google_drive_auth to user_settings

```sql
ALTER TABLE user_settings
ADD COLUMN google_drive_auth JSONB;
```

---

## Next Steps

1. Copy the 3 API route files above
2. Install googleapis: `pnpm add googleapis`
3. Run the SQL in Supabase
4. Test the APIs
5. I'll continue with middleware and UI pages

