/**
 * Force V2 — Phase 5 Mediation Context Service
 * Assembles scoped, privacy-preserved context for pair mediation reasoning.
 *
 * Invariants:
 * 1. Strictly enforces Dual-Key consent (both users must allow modeling).
 * 2. Raw private journals and personal context models are strictly omitted.
 * 3. Rate-limiting & cognitive overload protection (max 2 active interventions).
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  MediationContextSnapshot,
  MediationDecision,
  MediationInterventionEntity,
  MediationFeedbackRating,
  MIN_MEDIATION_CONFIDENCE_THRESHOLD,
} from '@/types/mediation-schemas';
import { buildRelationshipContextSnapshot } from './relationshipContextService';

export interface MediationContextResult {
  permitted: boolean;
  reason?: string;
  snapshot?: MediationContextSnapshot;
}

/**
 * Builds the strictly scoped MediationContextSnapshot for a connection.
 */
export async function buildMediationContextSnapshot(
  supabase: SupabaseClient,
  connectionId: string,
  callerUserId: string
): Promise<MediationContextResult> {
  try {
    // 1. Verify Tri-Context relationship boundary & dual-key consent
    const relResult = await buildRelationshipContextSnapshot(supabase, connectionId, callerUserId);
    if (!relResult.permitted || !relResult.snapshot) {
      return {
        permitted: false,
        reason: relResult.reason || 'mutual_modeling_not_permitted',
      };
    }

    const relSnapshot = relResult.snapshot;
    if (!relSnapshot.is_modeling_permitted) {
      return {
        permitted: false,
        reason: 'mutual_modeling_consent_not_granted',
      };
    }

    // 2. Fetch consented shared snapshots (active grants)
    const { data: grants } = await supabase
      .from('consent_grants')
      .select('id, grantor_id, grant_type, is_sensitive, granted_at, selected_sections')
      .eq('connection_id', connectionId)
      .eq('status', 'active');

    const formattedGrants = (grants || []).map((g: any) => ({
      grant_id: g.id,
      grantor_id: g.grantor_id,
      grant_type: g.grant_type,
      title_summary: g.selected_sections?.title || 'Shared reflection',
      shared_at: g.granted_at,
      is_sensitive: Boolean(g.is_sensitive),
    }));

    // 3. Count currently active mediation interventions
    const { data: activeInterventions } = await supabase
      .from('mediation_interventions')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('status', 'active');

    const activeCount = activeInterventions?.length || 0;

    // 4. Fetch recent relationship audit events (last 10 events)
    const { data: auditEvents } = await supabase
      .from('consent_audit_log')
      .select('action, actor_id, created_at, metadata')
      .contains('metadata', { connection_id: connectionId })
      .order('created_at', { ascending: false })
      .limit(10);

    const recentEvents = (auditEvents || []).map((ev: any) => ({
      event_type: ev.action,
      actor_id: ev.actor_id,
      created_at: ev.created_at,
      summary: ev.metadata?.summary || undefined,
    }));

    // 5. Calculate relationship timing and reciprocity balance
    const callerRole = relSnapshot.requester_id === callerUserId ? 'requester' : 'recipient';
    const relContext = relSnapshot.relationship_context || {};
    const sharedTopics: string[] = Array.isArray(relSnapshot.shared_topics)
      ? relSnapshot.shared_topics
      : [];

    const firstConnectedDate = (relContext.relationship_created_at as string) || new Date().toISOString();
    const daysSinceFirstConnected = Math.max(
      1,
      Math.round((Date.now() - new Date(firstConnectedDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    const snapshot: MediationContextSnapshot = {
      connection_id: connectionId,
      requester_id: relSnapshot.requester_id,
      recipient_id: relSnapshot.recipient_id,
      caller_user_id: callerUserId,
      caller_role: callerRole,
      status: relSnapshot.status,
      is_modeling_permitted: true,
      relationship_rhythms: {
        shared_topics: sharedTopics,
        interaction_count: recentEvents.length,
        last_interaction_at: relSnapshot.last_interaction_at,
        reciprocity_balance: 0.5, // Default balanced baseline
        days_since_first_connected: daysSinceFirstConnected,
      },
      consented_shared_snapshots: formattedGrants,
      recent_relationship_events: recentEvents,
      active_intervention_count: activeCount,
    };

    return { permitted: true, snapshot };
  } catch (error: any) {
    console.error('💥 [MediationContextService] Error building snapshot:', error);
    return { permitted: false, reason: error?.message || 'unexpected_error' };
  }
}

/**
 * Persists an agent mediation intervention to the database.
 * Enforces confidence floor (0.55) and logs an audit trail.
 */
export async function persistMediationIntervention(
  supabase: SupabaseClient,
  connectionId: string,
  decision: MediationDecision,
  initiatorId?: string
): Promise<{ success: boolean; intervention?: MediationInterventionEntity; error?: string }> {
  try {
    // 1. Guard against below-threshold or silence actions
    if (decision.action === 'silence' || decision.confidence < MIN_MEDIATION_CONFIDENCE_THRESHOLD) {
      return { success: false, error: 'Cannot persist silence or sub-threshold decision.' };
    }

    // 2. Insert into mediation_interventions
    const insertPayload = {
      connection_id: connectionId,
      initiator_id: initiatorId || null,
      target_user_id: decision.target_user_id || null,
      visibility: decision.visibility,
      intervention_type: decision.action,
      content: decision.content || null,
      bridging_question: decision.bridging_question || null,
      confidence: decision.confidence,
      reasoning_trace: decision.reasoning_trace,
      context_used: decision.context_used || [],
      status: 'active',
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('mediation_interventions')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr || !inserted) {
      console.error('❌ [MediationContextService] Insert error:', insertErr);
      return { success: false, error: insertErr?.message || 'Failed to persist intervention' };
    }

    // 3. Log to consent_audit_log
    if (initiatorId) {
      await supabase.from('consent_audit_log').insert({
        actor_id: initiatorId,
        action: 'insight_surfaced',
        metadata: {
          connection_id: connectionId,
          intervention_id: inserted.id,
          intervention_type: decision.action,
          visibility: decision.visibility,
          confidence: decision.confidence,
        },
      });
    }

    return { success: true, intervention: inserted as MediationInterventionEntity };
  } catch (err: any) {
    console.error('💥 [MediationContextService] Error persisting intervention:', err);
    return { success: false, error: err?.message || 'Server error' };
  }
}

/**
 * Fetches mediation interventions visible to a specific user on a connection.
 */
export async function getMediationInterventionsForUser(
  supabase: SupabaseClient,
  connectionId: string,
  callerUserId: string
): Promise<MediationInterventionEntity[]> {
  try {
    const { data, error } = await supabase
      .from('mediation_interventions')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      console.error('❌ [MediationContextService] Fetch interventions error:', error);
      return [];
    }

    // Filter by visibility rules
    const filtered = data.filter((item: MediationInterventionEntity) => {
      if (item.visibility === 'shared') return true;
      if (item.visibility === 'private_to_initiator') return item.initiator_id === callerUserId;
      if (item.visibility === 'private_to_target') return item.target_user_id === callerUserId;
      return false;
    });

    return filtered;
  } catch (err) {
    console.error('💥 [MediationContextService] Unexpected error getting interventions:', err);
    return [];
  }
}

/**
 * Updates the status of a mediation intervention (acted_upon or dismissed).
 */
export async function updateMediationInterventionStatus(
  supabase: SupabaseClient,
  interventionId: string,
  callerUserId: string,
  newStatus: 'acted_upon' | 'dismissed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === 'acted_upon') {
      updatePayload.acted_at = now;
    } else if (newStatus === 'dismissed') {
      updatePayload.dismissed_at = now;
    }

    const { error } = await supabase
      .from('mediation_interventions')
      .update(updatePayload)
      .eq('id', interventionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Server error' };
  }
}

/**
 * Records user feedback on an intervention (helpful, unhelpful, awkward, intrusive).
 */
export async function recordMediationFeedback(
  supabase: SupabaseClient,
  interventionId: string,
  userId: string,
  rating: MediationFeedbackRating,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: insertErr } = await supabase
      .from('mediation_feedback')
      .insert({
        intervention_id: interventionId,
        user_id: userId,
        rating,
        comment: comment?.trim() || null,
      });

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    // Log feedback action in audit log
    const auditAction = rating === 'helpful' ? 'signal_feedback_helpful' : 'signal_feedback_not_helpful';
    await supabase.from('consent_audit_log').insert({
      actor_id: userId,
      action: auditAction,
      metadata: {
        intervention_id: interventionId,
        rating,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Server error' };
  }
}
