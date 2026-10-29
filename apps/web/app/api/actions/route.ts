// apps/web/app/api/actions/route.ts
// GET: Fetch active actions for the user
// POST: Save an accepted action from journal analysis
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

    // Get all active and recently completed actions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: actions, error } = await adminClient
      .from('user_actions')
      .select('*')
      .eq('user_id', user.id)
      .or(`status.eq.active,and(status.eq.completed,completed_at.gte.${sevenDaysAgo.toISOString()})`)
      .order('accepted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ actions: actions || [] });
  } catch (error: unknown) {
    console.error('Fetch actions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { icon, title, reason, duration, category, journal_id } = body;

    if (!title || !category) {
      return NextResponse.json({ error: 'title and category are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Avoid duplicate active actions with same title for this user
    const { data: existing } = await adminClient
      .from('user_actions')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', title)
      .eq('status', 'active')
      .single();

    if (existing) {
      return NextResponse.json({ action: existing, duplicate: true }, { status: 200 });
    }

    // Verify journal_id exists to avoid FK violation (journal may have been deleted)
    let resolvedJournalId: string | null = journal_id || null;
    if (resolvedJournalId) {
      const { data: journalExists } = await adminClient
        .from('journals')
        .select('id')
        .eq('id', resolvedJournalId)
        .single();
      if (!journalExists) resolvedJournalId = null;
    }

    const { data: action, error } = await adminClient
      .from('user_actions')
      .insert({
        user_id: user.id,
        journal_id: resolvedJournalId,
        icon: icon || '✨',
        title,
        reason: reason || '',
        duration: duration || '',
        category,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ action }, { status: 201 });
  } catch (error: unknown) {
    console.error('Save action error:', error);
    return NextResponse.json(
      { error: 'Failed to save action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
