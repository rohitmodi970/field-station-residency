import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_onboarding_results')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching onboarding result:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || null });
  } catch (error: any) {
    console.error('Error in GET /api/user/onboarding/result:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const journalId = String(body?.journalId || '').trim();
    const mode = String(body?.mode || '').trim();

    if (!journalId || (mode !== 'write' && mode !== 'speak')) {
      return NextResponse.json(
        { error: 'journalId and valid mode are required' },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from('user_onboarding_results')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking onboarding result:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ data: existing, alreadyCompleted: true });
    }

    const { data, error } = await supabase
      .from('user_onboarding_results')
      .insert({
        user_id: user.id,
        journal_id: journalId,
        mode,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving onboarding result:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in POST /api/user/onboarding/result:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
