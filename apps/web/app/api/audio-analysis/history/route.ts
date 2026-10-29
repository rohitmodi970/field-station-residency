import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { serverEncryptAudioAnalysis } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';

// GET /api/audio-analysis/history?limit=20
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '20', 10),
      100
    );

    const { data, error } = await supabase
      .from('audio_analysis_history')
      .select('id, entry_id, filename, date, summary, results, created_at, summary_encrypted, summary_iv, results_encrypted, results_iv, is_encrypted')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[audio-analysis/history GET]', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Map DB rows → AnalysisHistoryEntry shape expected by the client,
    // plus the new encrypted fields for client-side decryption (Phase 5).
    const history = (data || []).map((row) => ({
      id: row.entry_id || row.id,
      date: row.date,
      filename: row.filename,
      summary: row.summary || '',
      analysis: row.results,
      summary_encrypted: row.summary_encrypted,
      summary_iv: row.summary_iv,
      results_encrypted: row.results_encrypted,
      results_iv: row.results_iv,
      is_encrypted: row.is_encrypted,
    }));

    return NextResponse.json({ history }, { status: 200 });
  } catch (err) {
    console.error('[audio-analysis/history GET] unexpected', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/audio-analysis/history  — save a new entry
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await request.json();
    const { entry_id, filename, date, summary, results } = body;

    if (!filename || !date || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, date, results' },
        { status: 400 }
      );
    }

    // Prevent duplicate inserts for repeated save attempts of the same client entry
    if (entry_id) {
      const { data: existing } = await supabase
        .from('audio_analysis_history')
        .select('id, entry_id, filename, date, summary, results, created_at, summary_encrypted, summary_iv, results_encrypted, results_iv, is_encrypted')
        .eq('user_id', user.id)
        .eq('entry_id', entry_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          {
            entry: {
              id: existing.entry_id || existing.id,
              date: existing.date,
              filename: existing.filename,
              summary: existing.summary || '',
              analysis: existing.results,
              summary_encrypted: existing.summary_encrypted,
              summary_iv: existing.summary_iv,
              results_encrypted: existing.results_encrypted,
              results_iv: existing.results_iv,
              is_encrypted: existing.is_encrypted,
            },
          },
          { status: 200 }
        );
      }
    }

    const { data: userData } = await supabase
      .from('users')
      .select('encryption_public_key')
      .eq('id', user.id)
      .single();
    
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

    let insertRow: any = {
      user_id: user.id,
      entry_id: entry_id || null,
      filename,
      date,
    };

    if (pubKey) {
      const enc = await serverEncryptAudioAnalysis(summary || null, results, pubKey);
      insertRow = { ...insertRow, ...enc };
    } else {
      insertRow.summary = summary || null;
      insertRow.results = results;
    }

    const { data, error } = await supabase
      .from('audio_analysis_history')
      .insert(insertRow)
      .select('id, entry_id, filename, date, summary, results, created_at, summary_encrypted, summary_iv, results_encrypted, results_iv, is_encrypted')
      .single();

    if (error) {
      console.error('[audio-analysis/history POST]', error);
      return NextResponse.json({ error: 'Failed to save history entry' }, { status: 500 });
    }

    return NextResponse.json(
      {
        entry: {
          id: data.entry_id || data.id,
          date: data.date,
          filename: data.filename,
          summary: data.summary || '',
          analysis: data.results,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[audio-analysis/history POST] unexpected', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/audio-analysis/history?entry_id=<entryId>
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const entryId = request.nextUrl.searchParams.get('entry_id');
    if (!entryId) {
      return NextResponse.json({ error: 'Missing entry_id query parameter' }, { status: 400 });
    }

    const { error } = await supabase
      .from('audio_analysis_history')
      .delete()
      .eq('user_id', user.id)
      .eq('entry_id', entryId);

    if (error) {
      console.error('[audio-analysis/history DELETE]', error);
      return NextResponse.json({ error: 'Failed to delete history entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[audio-analysis/history DELETE] unexpected', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
