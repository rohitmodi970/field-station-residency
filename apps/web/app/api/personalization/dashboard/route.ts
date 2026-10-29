import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateDashboardPersonalization } from '@/lib/personalization/generator';
import { resolveBucketState } from '@/lib/personalization/server';

function normalizeJournalSnippet(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

async function fetchRecentJournalSnippets(userId: string): Promise<string[]> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('journals')
    .select('content')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!data?.length) return [];

  return data
    .map((entry) => normalizeJournalSnippet(entry.content || ''))
    .filter((entry) => entry.length > 20)
    .slice(0, 3)
    .map((entry) => entry.slice(0, 140));
}

function buildFirstName(email: string | null | undefined): string {
  if (!email) return 'there';
  const value = email.split('@')[0] || 'there';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [state, snippets] = await Promise.all([
      resolveBucketState(user.id, user.email),
      fetchRecentJournalSnippets(user.id),
    ]);

    if (!state.bucket) {
      return NextResponse.json({
        success: true,
        requiresSelection: true,
        bucket: null,
      });
    }

    const personalization = await generateDashboardPersonalization({
      requestUrl: request.url,
      bucket: state.bucket,
      reflection: state.reflection,
      firstName: buildFirstName(user.email),
      snippets,
    });

    if (!personalization) {
      return NextResponse.json({
        success: false,
        requiresSelection: false,
        bucket: state.bucket,
        reflection: state.reflection,
        commitment: state.commitment,
        personalization: null,
        error: 'Personalization unavailable. Please retry.',
      });
    }

    return NextResponse.json({
      success: true,
      requiresSelection: false,
      bucket: state.bucket,
      reflection: state.reflection,
      commitment: state.commitment,
      personalization,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to build dashboard personalization', details: (error as Error).message },
      { status: 500 }
    );
  }
}
