// apps/web/app/api/journal/[journalId]/analysis/route.ts
// CRUD for encrypted per-journal analysis results
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';

const SINGLE_ENTRY_ANALYSIS_LIMIT = 10;

async function getAuthenticatedUser(req: NextRequest) {
  // Support Bearer token auth (mobile app)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }
    return { user };
  }

  // Fallback to cookie-based auth (web app)
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };
  return { user };
}

/**
 * GET /api/journal/[journalId]/analysis
 * Fetch saved encrypted analysis for a journal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journalId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { journalId } = await params;
    const adminClient = createAdminClient();

    // Look up journal internal ID from journal_id string
    const { data: journal, error: jErr } = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (jErr || !journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const { data: analysis, error } = await adminClient
      .from('journal_analyses')
      .select('*')
      .eq('journal_id', journal.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ analyses: analysis || [] });
  } catch (error) {
    console.error('GET analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/journal/[journalId]/analysis
 * Save (upsert) encrypted analysis result
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ journalId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { journalId } = await params;
    const body = await request.json();
    const {
      result_encrypted,
      result_iv,
      analysis_type = 'combined',
      model_used,
      word_count,
    } = body;

    if (!result_encrypted || !result_iv) {
      return NextResponse.json(
        { error: 'result_encrypted and result_iv are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Look up journal internal ID
    const { data: journal, error: jErr } = await adminClient
      .from('journals')
      .select('id, analysis_count')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (jErr || !journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    // Upsert: replace existing analysis of same type for this journal
    const { data: existing } = await adminClient
      .from('journal_analyses')
      .select('id')
      .eq('journal_id', journal.id)
      .eq('user_id', user.id)
      .eq('analysis_type', analysis_type)
      .single();

    let result;
    const isNewAnalysis = !existing;

    if (isNewAnalysis && (journal.analysis_count || 0) >= SINGLE_ENTRY_ANALYSIS_LIMIT) {
      return NextResponse.json(
        {
          error: 'Analysis limit reached',
          message: `You have reached the ${SINGLE_ENTRY_ANALYSIS_LIMIT} analysis limit for this journal entry.`,
          analysis_count: journal.analysis_count || 0,
        },
        { status: 403 }
      );
    }
    
    if (existing) {
      const { data, error } = await adminClient
        .from('journal_analyses')
        .update({
          result_encrypted,
          result_iv,
          is_encrypted: true,
          model_used,
          word_count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await adminClient
        .from('journal_analyses')
        .insert({
          journal_id: journal.id,
          user_id: user.id,
          analysis_type,
          result_encrypted,
          result_iv,
          is_encrypted: true,
          model_used,
          word_count,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
      
      // Increment analysis count in journals table for first successful analysis
      const currentCount = journal.analysis_count || 0;
      await adminClient
        .from('journals')
        .update({ analysis_count: Math.min(currentCount + 1, SINGLE_ENTRY_ANALYSIS_LIMIT), is_analyzed: true })
        .eq('id', journal.id);
    }

    return NextResponse.json({ analysis: result }, { status: 200 });
  } catch (error) {
    console.error('PUT analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to save analysis', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journal/[journalId]/analysis
 * Delete analysis for a journal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ journalId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { journalId } = await params;
    const adminClient = createAdminClient();

    const { data: journal, error: jErr } = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (jErr || !journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    // Optional: filter by analysis_type from query params
    const url = new URL(request.url);
    const analysisType = url.searchParams.get('analysis_type');

    let query = adminClient
      .from('journal_analyses')
      .delete()
      .eq('journal_id', journal.id)
      .eq('user_id', user.id);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to delete analysis', details: (error as Error).message },
      { status: 500 }
    );
  }
}
