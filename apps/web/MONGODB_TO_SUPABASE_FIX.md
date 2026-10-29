# MongoDB → Supabase Migration Issue Fix

## The Problem

Your app is still connecting to MongoDB and getting 401 errors because:
1. Old API routes (`/api/journal-entry`, `/api/metrics/update`) still use MongoDB + next-auth
2. Frontend components call these old routes
3. next-auth was removed, so authentication fails (401)

## The Solution

I've updated the JournalEntry component to use the NEW Supabase API routes:

### Changes Made to `JournalEntry.tsx`:

1. ✅ **Load journals**: `/api/journal-entry` → `/api/journal`
2. ✅ **Create journal**: `/api/journal-entry` POST → `/api/journal` POST
3. ✅ **Update journal**: `/api/journal-entry` PUT → `/api/journal` PUT  
4. ✅ **Delete media**: `/api/journal-entry?action=remove-media` → `/api/journal/media?media_id=xxx`
5. ✅ **Get media**: `/api/journal-entry?action=get-media` → `/api/journal/media?journal_id=xxx`

## Next Steps

### Option 1: Delete Old MongoDB Routes (Recommended)

Since you're fully migrating to Supabase, **delete or rename** these old files:

```
apps/web/app/api/journal-entry/route.ts  → DELETE (replaced by /api/journal)
apps/web/app/api/metrics/update/route.ts → DELETE or migrate to Supabase
```

### Option 2: Keep Both (Migration Period)

If you want to keep both during migration:

1. **Rename old routes** to avoid conflicts:
   - `/api/journal-entry` → `/api/journal-entry-legacy`
   - `/api/metrics/update` → `/api/metrics-update-legacy`

2. **Update any remaining references** in other components

## What Will Happen Now

After my changes:
- ✅ JournalEntry component uses `/api/journal` (Supabase)
- ✅ No more MongoDB connection from JournalEntry
- ✅ Authentication works with Supabase auth
- ❌ You'll still see MongoDB warnings from OTHER components that haven't been updated yet

## To Stop MongoDB Completely

1. **Find all MongoDB references:**
```bash
grep -r "connectDB" apps/web/app/api/
grep -r "getServerSession" apps/web/app/api/
grep -r "next-auth" apps/web/app/api/
```

2. **Update or delete** each file found

3. **Remove MongoDB dependencies** from `package.json`:
```json
// Remove these:
"mongodb"
"mongoose"  
"next-auth"
```

## Testing

1. **Clear your browser cache** (old session data)
2. **Restart dev server**: `pnpm dev`
3. **Login again** with Supabase auth
4. **Create a journal entry** - should work without MongoDB!

## If You Still See Errors

Check which API route is being called in the console. If you see `/api/journal-entry` or any other old route, find where it's being called and update it to use the new `/api/journal` route.

---

**Bottom line**: Your frontend now uses Supabase APIs. The MongoDB connection is from old API routes that need to be deleted or migrated.
