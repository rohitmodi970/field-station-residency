import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await req.json();
    const { event_type, event_data, source = 'external_api' } = body;

    if (!event_type || !event_data) {
      return NextResponse.json({ error: 'event_type and event_data are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('interaction_events')
      .insert({
        user_id: user.id,
        event_type,
        event_data,
        source,
        processed: false,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('❌ [API:Agent:Events] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
