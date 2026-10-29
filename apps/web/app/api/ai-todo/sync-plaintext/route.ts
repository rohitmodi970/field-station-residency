import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    if (tasks.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const adminClient = createAdminClient();
    let updated = 0;

    await Promise.allSettled(
      tasks.map(async (t: any) => {
        const id = t?.id;
        const title = (t?.title || '').trim();
        if (!id || !title || title.toLowerCase() === 'personal' || title.toLowerCase() === 'task') {
          return;
        }

        const patch: Record<string, string | null> = { title };
        if (t.description && typeof t.description === 'string') {
          patch.description = t.description.trim();
        }
        if (t.category && typeof t.category === 'string') {
          patch.category = t.category.trim();
        }
        if (t.ai_reasoning && typeof t.ai_reasoning === 'string') {
          patch.ai_reasoning = t.ai_reasoning.trim();
        }

        const { error } = await adminClient
          .from('ai_todos')
          .update(patch)
          .eq('id', id)
          .eq('user_id', user.id);

        if (!error) {
          updated += 1;
        }
      })
    );

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('[POST /api/ai-todo/sync-plaintext] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
