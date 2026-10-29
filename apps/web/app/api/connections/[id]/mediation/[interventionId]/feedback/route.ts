import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { recordMediationFeedback } from '@/lib/agent/v2/mediationContextService';
import { MediationFeedbackRating } from '@/types/mediation-schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; interventionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const interventionId = resolvedParams.interventionId;

    const body = await req.json();
    const rating = body?.rating as MediationFeedbackRating;
    const comment = body?.comment as string | undefined;

    const validRatings: MediationFeedbackRating[] = ['helpful', 'unhelpful', 'awkward', 'intrusive'];
    if (!rating || !validRatings.includes(rating)) {
      return NextResponse.json(
        { error: `Invalid rating. Must be one of: ${validRatings.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await recordMediationFeedback(
      supabase,
      interventionId,
      user.id,
      rating,
      comment
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to record feedback' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('💥 [API:Connections:Mediation:Feedback] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
