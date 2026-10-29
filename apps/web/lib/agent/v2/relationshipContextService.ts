/**
 * Force V2 — Tri-Context Relationship Context Service
 * Enforces the strict architectural boundary between Person A's private model,
 * Person B's private model, and their mutual Relationship Context (A <-> B).
 * 
 * Invariants:
 * 1. Mutual Opt-In: Requires BOTH requester_allows_modeling AND recipient_allows_modeling.
 * 2. Privacy Isolation: The agent NEVER receives a merged view of private models.
 * 3. Atomic Purge: When dissolved or blocked, relationship memory is nullified.
 * 
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface RelationshipContextSnapshot {
  connection_id: string;
  requester_id: string;
  recipient_id: string;
  status: 'accepted' | 'pending' | 'declined' | 'blocked' | 'dissolved';
  is_modeling_permitted: boolean;
  relationship_context: Record<string, unknown>;
  shared_topics?: string[];
  last_interaction_at?: string;
}

export interface RelationshipContextResult {
  permitted: boolean;
  reason?: string;
  snapshot?: RelationshipContextSnapshot;
}

/**
 * Builds the isolated Relationship Context for a connection.
 * Strictly guarantees private models are NEVER leaked.
 */
export async function buildRelationshipContextSnapshot(
  supabase: SupabaseClient,
  connectionId: string,
  callerUserId: string
): Promise<RelationshipContextResult> {
  try {
    // 1. Fetch connection record
    const { data: conn, error } = await supabase
      .from('force_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (error || !conn) {
      return { permitted: false, reason: 'connection_not_found' };
    }

    // 2. Caller verification (must be a participant)
    if (conn.requester_id !== callerUserId && conn.recipient_id !== callerUserId) {
      return { permitted: false, reason: 'caller_not_a_participant' };
    }

    // 3. Status verification (must be accepted)
    if (conn.status !== 'accepted') {
      return { permitted: false, reason: `connection_status_is_${conn.status}` };
    }

    // 4. Dual-Key Mutual Modeling Consent Gate
    const bothOptedIn = Boolean(conn.requester_allows_modeling && conn.recipient_allows_modeling);
    if (!bothOptedIn) {
      return {
        permitted: false,
        reason: 'mutual_modeling_consent_not_granted',
        snapshot: {
          connection_id: conn.id,
          requester_id: conn.requester_id,
          recipient_id: conn.recipient_id,
          status: conn.status,
          is_modeling_permitted: false,
          relationship_context: {},
        },
      };
    }

    // 5. Assemble isolated relationship snapshot
    const relContext = (conn.relationship_context || {}) as Record<string, unknown>;

    return {
      permitted: true,
      snapshot: {
        connection_id: conn.id,
        requester_id: conn.requester_id,
        recipient_id: conn.recipient_id,
        status: conn.status,
        is_modeling_permitted: true,
        relationship_context: relContext,
        shared_topics: Array.isArray(relContext.shared_topics) ? relContext.shared_topics : [],
        last_interaction_at: (relContext.last_interaction_at as string) || conn.requested_at,
      },
    };
  } catch (err: any) {
    console.error('💥 [RelationshipContextService] Error building snapshot:', err);
    return { permitted: false, reason: err?.message || 'unexpected_error' };
  }
}

/**
 * Toggles behavioral modeling consent for a specific participant.
 * If toggled off by either participant, relationship hypotheses are suspended.
 */
export async function toggleModelingConsent(
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  allowModeling: boolean
): Promise<{ success: boolean; error?: string; both_opted_in?: boolean }> {
  try {
    const { data: conn, error: fetchErr } = await supabase
      .from('force_connections')
      .select('requester_id, recipient_id, requester_allows_modeling, recipient_allows_modeling')
      .eq('id', connectionId)
      .maybeSingle();

    if (fetchErr || !conn) {
      return { success: false, error: 'Connection not found' };
    }

    const isRequester = conn.requester_id === userId;
    const isRecipient = conn.recipient_id === userId;

    if (!isRequester && !isRecipient) {
      return { success: false, error: 'Unauthorized' };
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {};

    if (isRequester) {
      updatePayload.requester_allows_modeling = allowModeling;
      updatePayload.requester_modeling_at = now;
    } else {
      updatePayload.recipient_allows_modeling = allowModeling;
      updatePayload.recipient_modeling_at = now;
    }

    const { error: updateErr } = await supabase
      .from('force_connections')
      .update(updatePayload)
      .eq('id', connectionId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    const newRequesterModeling = isRequester ? allowModeling : conn.requester_allows_modeling;
    const newRecipientModeling = isRecipient ? allowModeling : conn.recipient_allows_modeling;
    const bothOptedIn = Boolean(newRequesterModeling && newRecipientModeling);

    // Log consent change in audit log
    await supabase.from('consent_audit_log').insert({
      actor_id: userId,
      action: allowModeling ? 'modeling_enabled' : 'modeling_disabled',
      metadata: { connection_id: connectionId, both_opted_in: bothOptedIn },
    });

    return { success: true, both_opted_in: bothOptedIn };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Server error' };
  }
}
