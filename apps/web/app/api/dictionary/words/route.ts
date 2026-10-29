import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';

type SortField = 'created_at' | 'updated_at' | 'term';
type SortOrder = 'asc' | 'desc';

interface VocabularyRow {
  id: string;
  user_id: string;
  term: string;
  pronunciation: string | null;
  definition: string;
  examples: string[];
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Internal server error';
}

async function getAuthenticatedUser(req: NextRequest) {
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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }

    return { user };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

function parseExamples(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.trim();
    const sortBy = (searchParams.get('sortBy') || 'created_at') as SortField;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as SortOrder;

    const validSortBy: SortField[] = ['created_at', 'updated_at', 'term'];
    const validSortOrder: SortOrder[] = ['asc', 'desc'];

    const safeSortBy = validSortBy.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = validSortOrder.includes(sortOrder) ? sortOrder : 'desc';

    const adminClient = createAdminClient();
    let query = adminClient
      .from('user_vocabulary')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order(safeSortBy, { ascending: safeSortOrder === 'asc' });

    if (search) {
      query = query.or(`term.ilike.%${search}%,definition.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({
      words: (data || []) as VocabularyRow[],
      total: count || 0,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await req.json();

    const term = typeof body.term === 'string' ? body.term.trim() : '';
    const definition = typeof body.definition === 'string' ? body.definition.trim() : '';
    const pronunciation =
      typeof body.pronunciation === 'string' && body.pronunciation.trim().length > 0
        ? body.pronunciation.trim()
        : null;
    const examples = parseExamples(body.examples);
    const audioUrl =
      typeof body.audio_url === 'string' && body.audio_url.trim().length > 0
        ? body.audio_url.trim()
        : null;

    if (!term || !definition) {
      return NextResponse.json(
        { error: 'term and definition are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('user_vocabulary')
      .insert({
        user_id: user.id,
        term,
        definition,
        pronunciation,
        examples,
        audio_url: audioUrl,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ word: data as VocabularyRow }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await req.json();

    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.term === 'string') {
      const value = body.term.trim();
      if (!value) return NextResponse.json({ error: 'term cannot be empty' }, { status: 400 });
      updates.term = value;
    }

    if (typeof body.definition === 'string') {
      const value = body.definition.trim();
      if (!value) {
        return NextResponse.json({ error: 'definition cannot be empty' }, { status: 400 });
      }
      updates.definition = value;
    }

    if (body.pronunciation !== undefined) {
      updates.pronunciation =
        typeof body.pronunciation === 'string' && body.pronunciation.trim().length > 0
          ? body.pronunciation.trim()
          : null;
    }

    if (body.examples !== undefined) {
      updates.examples = parseExamples(body.examples);
    }

    if (body.audio_url !== undefined) {
      updates.audio_url =
        typeof body.audio_url === 'string' && body.audio_url.trim().length > 0
          ? body.audio_url.trim()
          : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Ensure ownership before updating.
    const { data: existing, error: existingError } = await adminClient
      .from('user_vocabulary')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (existingError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('user_vocabulary')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ word: data as VocabularyRow });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Ensure ownership before deleting.
    const { data: existing, error: existingError } = await adminClient
      .from('user_vocabulary')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (existingError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    const { error } = await adminClient.from('user_vocabulary').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
