# 🚀 Quick Reference Guide - Supabase Journal Components

## One-Line Imports

```tsx
// Components
import StorageProviderSelector from '@/components/Journal/StorageProviderSelector';
import MediaUploadProgress from '@/components/Journal/MediaUploadProgress';
import StorageUsageIndicator from '@/components/Journal/StorageUsageIndicator';
import JournalSettingsPanel from '@/components/Journal/JournalSettingsPanel';
import MediaGallery from '@/components/Journal/MediaGallery';
import ModernJournalCard from '@/components/Journal/ModernJournalCard';
import JournalListView from '@/components/Journal/JournalListView';

// Hooks
import { useJournals } from '@/hooks/useJournals';
import { useSettings } from '@/hooks/useSettings';

// Types
import { Journal, JournalWithMedia, MediaType, StorageProvider } from '@/types/database';
```

## Drop-in Examples

### 1. Add Journal List to Any Page (1 line!)
```tsx
<JournalListView />
```

### 2. Add Settings Panel (3 lines!)
```tsx
const [showSettings, setShowSettings] = useState(false);
<button onClick={() => setShowSettings(true)}>Settings</button>
<JournalSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
```

### 3. Add Storage Usage (1 line!)
```tsx
<StorageUsageIndicator />
```

### 4. Create/Update Journal (5 lines!)
```tsx
const { create, update } = useJournals();

// Create
const journal = await create({ title: 'My Day', content: 'Great day!' });

// Update
await update(journal.journal_id, { title: 'Updated Title' });
```

### 5. Show Media Gallery (1 line!)
```tsx
<MediaGallery media={journalMedia} onDelete={deleteMedia} />
```

## API Endpoints Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/journal` | POST | Create journal |
| `/api/journal` | GET | Get all journals |
| `/api/journal?journal_id=xxx` | GET | Get single journal |
| `/api/journal` | PUT | Update journal |
| `/api/journal?journal_id=xxx` | DELETE | Delete journal |
| `/api/journal/media` | POST | Upload media |
| `/api/journal/media?journal_id=xxx` | GET | Get media |
| `/api/journal/media?media_id=xxx` | DELETE | Delete media |
| `/api/user/settings` | GET | Get settings |
| `/api/user/settings` | PUT | Update settings |
| `/api/user/storage-usage` | GET | Get storage usage |

## Common Patterns

### Pattern 1: Journal Page with Everything
```tsx
export default function JournalsPage() {
  return <JournalListView showCreateButton={true} />;
}
```

### Pattern 2: Journal Editor
```tsx
export default function EditorPage() {
  const { create, update } = useJournals(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [journalId, setJournalId] = useState<string | null>(null);

  const handleSave = async () => {
    if (journalId) {
      await update(journalId, { title, content });
    } else {
      const journal = await create({ title, content });
      setJournalId(journal.journal_id);
    }
  };

  return (
    <div>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      <textarea value={content} onChange={e => setContent(e.target.value)} />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

### Pattern 3: Settings Page
```tsx
export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div>
      <StorageProviderSelector
        currentProvider={settings?.storage_provider || 'supabase'}
        onProviderChange={(provider) => update({ storage_provider: provider })}
      />
      <StorageUsageIndicator />
    </div>
  );
}
```

## Cheat Sheet

### Create Journal
```tsx
const journal = await create({
  title: 'My Day',
  content: 'Content here...',
  tags: ['gratitude', 'daily'],
  mood: 'happy',
  journal_type: 'personal'
});
```

### Update Journal
```tsx
await update(journalId, {
  title: 'New Title',
  is_favorite: true,
  is_archived: false
});
```

### Delete Journal
```tsx
await remove(journalId);          // Soft delete
await remove(journalId, true);    // Permanent delete
```

### Get Single Journal
```tsx
const journal = await getById(journalId, true);  // with media
```

### Update Settings
```tsx
await update({
  storage_provider: 'both',
  ai_features_enabled: true,
  storage_scope: 'cloud',
  theme_mode: 'dark'
});
```

### Filter Journals (Manual)
```tsx
const favoriteJournals = journals.filter(j => j.is_favorite);
const recentJournals = journals.filter(j => 
  new Date(j.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
);
const taggedJournals = journals.filter(j => j.tags?.includes('work'));
```

## Props Quick Reference

### StorageProviderSelector
```tsx
<StorageProviderSelector
  currentProvider="supabase"
  onProviderChange={async (provider) => {}}
  disabled={false}
/>
```

### MediaUploadProgress
```tsx
<MediaUploadProgress
  uploads={uploadProgress}
  onRemove={(index) => {}}
/>
```

### StorageUsageIndicator
```tsx
<StorageUsageIndicator
  journalId="optional"
  onStorageUpdate={(usage) => {}}
/>
```

### JournalSettingsPanel
```tsx
<JournalSettingsPanel
  isOpen={true}
  onClose={() => {}}
/>
```

### MediaGallery
```tsx
<MediaGallery
  media={journalMedia}
  onDelete={async (mediaId) => {}}
  readOnly={false}
/>
```

### ModernJournalCard
```tsx
<ModernJournalCard
  journal={journal}
  onFavorite={async (id, fav) => {}}
  onArchive={async (id, arch) => {}}
/>
```

### JournalListView
```tsx
<JournalListView
  showCreateButton={true}
  emptyMessage="No journals yet!"
/>
```

## Type Definitions

```typescript
interface Journal {
  id: string;
  user_id: string;
  journal_id: string;
  title: string | null;
  content: string | null;
  tags: string[];
  mood: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  word_count: number;
  reading_time_minutes: number;
  date: string;
  created_at: string;
  updated_at: string;
}

interface JournalWithMedia extends Journal {
  media?: JournalMedia[];
}

interface CreateJournalRequest {
  title?: string;
  content?: string;
  journal_type?: string;
  tags?: string[];
  mood?: string;
  date?: string;
  is_favorite?: boolean;
}

interface UserSettings {
  user_id: string;
  theme_mode: 'light' | 'dark';
  storage_scope: 'device_only' | 'cloud' | 'both';
  storage_provider: 'supabase' | 'google_drive' | 'both' | null;
  account_type: 'private' | 'public';
  ai_features_enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Error Handling

```tsx
try {
  await create({ title: 'Test' });
} catch (error) {
  console.error('Error:', error);
  // Show toast or error message
}
```

## Loading States

```tsx
const { journals, loading, error } = useJournals();

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
return <div>{/* Render journals */}</div>;
```

---

**That's it!** You now have everything you need to build a modern journal app with Supabase. 🚀
