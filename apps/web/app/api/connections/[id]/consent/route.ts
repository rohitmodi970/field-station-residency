import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { toggleModelingConsent } from '@/lib/agent/v2/relationshipContextService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectionId } = await params;
    const body = await req.json();
    const allowModeling = Boolean(body?.allow_modeling);

    const result = await toggleModelingConsent(supabase, connectionId, user.id, allowModeling);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update consent' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      both_opted_in: result.both_opted_in,
    });
  } catch (err: any) {
    console.error('💥 [API:Connections:Consent] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
