// apps/web/app/api/cognition-responses/route.ts
// Store user responses from cognition engine questions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serverEncryptCognitionResponse } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';

type CognitionResponseRequest = {
  journal_id?: string;
  insight_core: string;
  insight_tension: string;
  mode: 'planning' | 'communication' | 'decision' | 'execution' | 'reset';
  life_areas?: string[];
  question_responses: Array<{ id: string; question: string; answer: string }>;
  analysis_snapshot?: Record<string, unknown>;
  generated_tasks?: Array<Record<string, unknown>>;
  output_state?: Record<string, unknown>;
  entry_text?: string;
  priority?: 'high' | 'medium' | 'low';
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = user.id;

    const body = (await request.json()) as CognitionResponseRequest;

    // Validate required fields
    if (!body.insight_core || !body.mode || !Array.isArray(body.question_responses)) {
      return NextResponse.json(
        { error: 'Missing required fields: insight_core, mode, question_responses' },
        { status: 400 }
      );
    }

    const { data: userData } = await supabase
      .from('users')
      .select('encryption_public_key')
      .eq('id', currentUserId)
      .single();
    
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

    const rawJournalId =
      body.journal_id && typeof body.journal_id === 'string' && body.journal_id.trim().length > 0
        ? body.journal_id.trim()
        : null;

    let payload: any = {
      user_id: currentUserId,
      journal_id: rawJournalId,
      mode: body.mode,
      life_areas: body.life_areas || [],
      priority: body.priority || 'medium',
    };

    if (pubKey) {
      const enc = await serverEncryptCognitionResponse({
        insight_core: body.insight_core,
        insight_tension: body.insight_tension || '',
        entry_text: body.entry_text || null,
        question_responses: body.question_responses,
        analysis_snapshot: body.analysis_snapshot || {
          insight: {
            core: body.insight_core,
            tension: body.insight_tension || '',
          },
          mode: body.mode,
          lifeAreas: body.life_areas || [],
        },
        generated_tasks: body.generated_tasks || [],
        output_state: body.output_state || {},
      }, pubKey);
      payload = { ...payload, ...enc };
    } else {
      payload = {
        ...payload,
        insight_core: body.insight_core,
        insight_tension: body.insight_tension || '',
        analysis_snapshot: body.analysis_snapshot || {
          insight: {
            core: body.insight_core,
            tension: body.insight_tension || '',
          },
          mode: body.mode,
          lifeAreas: body.life_areas || [],
        },
        question_responses: body.question_responses,
        generated_tasks: body.generated_tasks || [],
        output_state: body.output_state || {},
        entry_text: body.entry_text || null,
      };
    }

    // Helper to execute upsert/insert with automatic UUID-type fallback
    async function executeSave(targetPayload: any) {
      if (targetPayload.journal_id) {
        try {
          const { data: existing, error: findError } = await supabase
            .from('cognition_responses')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('journal_id', targetPayload.journal_id)
            .limit(1)
            .maybeSingle();

          if (findError) {
            // If column is UUID and ID is not a UUID, PG error code is 22P02
            if ((findError as any).code === '22P02') {
              console.warn('[cognition-responses] journal_id column is UUID; retrying with null journal_id');
              return executeSave({ ...targetPayload, journal_id: null });
            }
            throw findError;
          }

          if (existing && existing.id) {
            const { data: updated, error: updateError } = await supabase
              .from('cognition_responses')
              .update(targetPayload)
              .eq('id', existing.id)
              .select()
              .single();

            if (updateError) throw updateError;
            return updated;
          }
        } catch (findErr: any) {
          if (findErr?.code === '22P02') {
            console.warn('[cognition-responses] journal_id lookup 22P02 fallback to null');
            return executeSave({ ...targetPayload, journal_id: null });
          }
          throw findErr;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('cognition_responses')
        .insert(targetPayload)
        .select()
        .single();

      if (insertError) {
        if ((insertError as any).code === '22P02' && targetPayload.journal_id) {
          console.warn('[cognition-responses] journal_id insert 22P02 fallback to null');
          return executeSave({ ...targetPayload, journal_id: null });
        }
        throw insertError;
      }

      return inserted;
    }

    const stored = await executeSave(payload);

    return NextResponse.json({
      success: true,
      response_id: stored?.id,
      stored_at: stored?.created_at,
    });
  } catch (error) {
    console.error('[cognition-responses] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to store cognition responses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Retrieve recent cognition responses for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = request.nextUrl.searchParams.get('limit') || '10';
    const mode = request.nextUrl.searchParams.get('mode');
    const journalId = request.nextUrl.searchParams.get('journal_id');

    let query = supabase
      .from('cognition_responses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(Number.parseInt(limit, 10));

    if (mode) {
      query = query.eq('mode', mode);
    }

    if (journalId) {
      query = query.eq('journal_id', journalId).limit(1);
    }

    const { data: responses, error: fetchError } = await query;

    if (fetchError) {
      console.error('[cognition-responses] Fetch error:', fetchError);
      throw fetchError;
    }

    return NextResponse.json({ responses });
  } catch (error) {
    console.error('[cognition-responses] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch cognition responses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
