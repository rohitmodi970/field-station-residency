import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { ingestVektoriMessages } from '@/utils/vektori/client';
import { buildVektoriJournalMessages } from '@/utils/vektori/payload.js';

const MAX_BATCH_SIZE = 50;

type BackfillJournalInput = {
  journalId: string;
  title?: string;
  content?: string;
  mood?: string;
  entryDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

async function isMemoryOptedIn(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('user_settings')
      .select('memory_opt_in')
      .eq('user_id', userId)
      .single();

    return data?.memory_opt_in !== false;
  } catch {
    return true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isMemoryOptedIn(user.id))) {
      return NextResponse.json({ error: 'Memory sync is opted out for this account' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const journals = Array.isArray(body.journals) ? body.journals as BackfillJournalInput[] : [];

    if (journals.length === 0) {
      return NextResponse.json({ error: 'No journals provided' }, { status: 400 });
    }

    if (journals.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} journals per batch` }, { status: 400 });
    }

    let ingested = 0;
    let skipped = 0;
    let failed = 0;
    const ingestedIds: string[] = [];

    for (const journal of journals) {
      const journalId = String(journal.journalId || '').trim();
      if (!journalId) {
        skipped += 1;
        continue;
      }

      const messages = buildVektoriJournalMessages({
        journalId,
        title: journal.title || '',
        content: journal.content || '',
        mood: journal.mood || '',
        entryDate: journal.entryDate || '',
        createdAt: journal.createdAt || '',
        updatedAt: journal.updatedAt || '',
        eventType: 'backfill',
      });

      if (messages.length === 0) {
        skipped += 1;
        continue;
      }

      const ok = await ingestVektoriMessages({
        userId: user.id,
        sessionId: `journal-${journalId}`,
        messages,
      });

      if (ok) {
        ingested += 1;
        ingestedIds.push(journalId);
      } else {
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      ingested,
      skipped,
      failed,
      total: journals.length,
      ingestedIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
