import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return { error: 'Server misconfigured', status: 500 };
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { error: 'Unauthorized', status: 401 };
    return { user };
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };
  return { user };
}

/**
 * PATCH /api/knowledge/manage
 * Manage knowledge: forget, update, or supersede items.
 * 
 * Body formats:
 * - { action: "forget", knowledgeId: string, reason?: string }
 * - { action: "update", knowledgeId: string, content?: string, confidence?: number }
 * - { action: "supersede", knowledgeId: string, newContent: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;
    const body = await request.json();
    const { action, knowledgeId } = body;

    if (!action || !knowledgeId) {
      return NextResponse.json({ error: 'Missing action or knowledgeId' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify ownership
    const { data: existing } = await adminClient
      .from('user_knowledge')
      .select('id, user_id, content, is_active, knowledge_type, category, source_entry_ids')
      .eq('id', knowledgeId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Knowledge item not found' }, { status: 404 });
    }

    switch (action) {
      case 'forget': {
        // Soft-delete: mark inactive with reason
        await adminClient
          .from('user_knowledge')
          .update({
            is_active: false,
            forget_reason: body.reason || 'User requested removal',
          })
          .eq('id', knowledgeId);
        return NextResponse.json({ success: true, action: 'forgotten' });
      }

      case 'update': {
        // Update content or confidence
        const updates: Record<string, string | number> = {};
        if (body.content) updates.content = body.content;
        if (body.confidence !== undefined) {
          updates.confidence = Math.min(1.0, Math.max(0.1, body.confidence));
        }
        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }
        await adminClient
          .from('user_knowledge')
          .update(updates)
          .eq('id', knowledgeId);
        return NextResponse.json({ success: true, action: 'updated' });
      }

      case 'supersede': {
        // Replace an old knowledge item with a new one
        if (!body.newContent) {
          return NextResponse.json({ error: 'Missing newContent for supersede' }, { status: 400 });
        }
        // Deactivate old
        await adminClient
          .from('user_knowledge')
          .update({
            is_active: false,
            forget_reason: 'Superseded by updated knowledge',
          })
          .eq('id', knowledgeId);
        
        // Create new with reference to old
        const { data: newItem } = await adminClient
          .from('user_knowledge')
          .insert({
            user_id: user.id,
            knowledge_type: existing.knowledge_type || 'memory',
            category: existing.category || 'preference',
            content: body.newContent,
            confidence: body.confidence || 0.8,
            source_entry_ids: existing.source_entry_ids || [],
            superseded_by: null,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        
        // Update old item's superseded_by reference
        if (newItem) {
          await adminClient
            .from('user_knowledge')
            .update({ superseded_by: newItem.id })
            .eq('id', knowledgeId);
        }

        return NextResponse.json({ success: true, action: 'superseded', newId: newItem?.id });
      }

      default:
        return NextResponse.json({ error: 'Unknown action. Use: forget, update, supersede' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Knowledge Manage] Error:', error);
    return NextResponse.json({ error: 'Failed to manage knowledge' }, { status: 500 });
  }
}
