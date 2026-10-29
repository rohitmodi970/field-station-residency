// apps/web/app/api/fetch-journals/[journalId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ journalId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { journalId } = await context.params;
    const adminClient = createAdminClient();
    
    const { data: journal, error } = await adminClient
      .from('journals')
      .select('*')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (error || !journal) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    const formattedJournal = {
      id: journal.journal_id,
      title: journal.title || 'Untitled Entry',
      content: journal.content || '',
      date: journal.date || new Date(journal.created_at).toLocaleString(),
      mood: journal.mood || 'Neutral',
      moodColor: getMoodColor(journal.mood),
      tags: Array.isArray(journal.tags) ? journal.tags : [],
      media: journal.media || {
        image: [],
        audio: [],
        video: [],
        document: []
      },
      timestamp: journal.created_at
    };

    return NextResponse.json(formattedJournal);
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ journalId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { journalId } = await context.params;
    const adminClient = createAdminClient();
    
    // Soft delete
    const { error } = await adminClient
      .from('journals')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('journal_id', journalId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting journal:', error);
      return NextResponse.json({ error: 'Failed to delete journal' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Journal deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete journal' }, { status: 500 });
  }
}

function getMoodColor(mood: string | null): string {
  if (!mood) return 'gray';

  const moodMap: { [key: string]: string } = {
    Happy: 'yellow',
    Sad: 'blue',
    Angry: 'red',
    Excited: 'orange',
    Peaceful: 'blue',
    Anxious: 'purple',
    Optimistic: 'green',
    Frustrated: 'red',
    Grateful: 'green',
    Stressed: 'purple',
    Thoughtful: 'purple',
    Neutral: 'gray'
  };

  return moodMap[mood] || 'gray';
}