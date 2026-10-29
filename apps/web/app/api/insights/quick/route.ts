// apps/web/app/api/insights/quick/route.ts
// NOTE: This route returns raw encrypted analyses for the client to decrypt.
// Decryption requires the master key from IndexedDB (browser-only), so it
// must happen on the client side — never on the server.
import { NextResponse } from 'next/server';
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

    // Get recent journal entries (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: journals, error: journalsError } = await adminClient
      .from('journals')
      .select('id, date, created_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('date', sevenDaysAgo.toISOString())
      .order('date', { ascending: false })
      .limit(10);

    if (journalsError || !journals || journals.length === 0) {
      return NextResponse.json({ analyses: [], journalCount: 0 });
    }

    const journalIds = journals.map(j => j.id);

    // Return encrypted analyses — the client will decrypt using the master key
    const { data: analyses, error: analysesError } = await adminClient
      .from('journal_analyses')
      .select('id, journal_id, result_encrypted, result_iv, updated_at')
      .eq('user_id', user.id)
      .in('journal_id', journalIds)
      .order('updated_at', { ascending: false });

    if (analysesError || !analyses) {
      return NextResponse.json({ analyses: [], journalCount: journals.length });
    }

    return NextResponse.json({
      analyses,
      journalCount: journals.length,
    });
  } catch (error: unknown) {
    console.error('Quick insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
