import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { InteractionFeedbackPayload } from '@/types/persistence-contract';

const ALLOWED_FEEDBACK_TYPES = new Set([
  'accurate_and_helpful',
  'inaccurate',
  'too_intrusive',
  'poor_timing',
  'irrelevant',
]);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: Partial<InteractionFeedbackPayload> = await req.json();

    if (!body.feedback_type || !ALLOWED_FEEDBACK_TYPES.has(body.feedback_type)) {
      return NextResponse.json(
        { error: 'Invalid or missing feedback_type' },
        { status: 400 }
      );
    }

    // Sanitize user comment & check length limits
    let comment: string | null = null;
    if (typeof body.user_comment === 'string') {
      const trimmed = body.user_comment.trim();
      if (trimmed.length > 2000) {
        return NextResponse.json(
          { error: 'Comment exceeds maximum allowed length of 2000 characters' },
          { status: 400 }
        );
      }
      comment = trimmed.length > 0 ? trimmed : null;
    }

    // Validate rating
    let rating: number | null = null;
    if (body.rating !== undefined && body.rating !== null) {
      const r = Number(body.rating);
      if (Number.isInteger(r) && r >= 1 && r <= 5) {
        rating = r;
      } else {
        return NextResponse.json(
          { error: 'Rating must be an integer between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Validate interaction_id belongs to current user if supplied
    let verifiedEventId: string | null = null;
    if (body.interaction_id) {
      const { data: eventMatch } = await supabase
        .from('interaction_events')
        .select('id')
        .eq('id', body.interaction_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (eventMatch) {
        verifiedEventId = eventMatch.id;
      }
    }

    const { data, error } = await supabase
      .from('interaction_feedback')
      .insert({
        user_id: user.id,
        event_id: verifiedEventId,
        feedback_type: body.feedback_type,
        rating: rating,
        user_comment: comment,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('❌ [API:Agent:Feedback] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: data });
  } catch (err: any) {
    console.error('💥 [API:Agent:Feedback] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
