// apps/web/app/api/user/encryption-status/route.ts
/**
 * User Encryption Status
 *
 * GET /api/user/encryption-status
 *
 * Returns lightweight encryption-related user settings needed by the
 * RecoveryCodesBanner and other UI to detect post-migration state.
 *
 * Response: { recovery_codes_count: number }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [settingsResult, onboardingResult, userResult] = await Promise.all([
      supabase
        .from('user_settings')
        .select('recovery_codes_count')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_onboarding')
        .select('completed, completed_at')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('users')
        .select('recovery_key_wrappings')
        .eq('id', user.id)
        .single()
    ]);

    const { data, error } = settingsResult;
    const { data: onboardingData, error: onboardingError } = onboardingResult;
    const { data: userData } = userResult;

    if (error && error.code !== 'PGRST116') {
      console.error('[encryption-status] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    let show_recovery_banner = true;
    if (!onboardingError && onboardingData?.completed && onboardingData?.completed_at) {
      const completedAt = new Date(onboardingData.completed_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (completedAt > oneHourAgo) {
        show_recovery_banner = false; // still in grace period (within 1 hour of completing onboarding)
      }
    } else if (onboardingError && onboardingError.code === 'PGRST116') {
      // No onboarding record found, we assume they are either not onboarded or an old user. 
      // If we don't want to notify during onboarding at all:
      show_recovery_banner = false;
    } else if (onboardingData && !onboardingData.completed) {
      // Incomplete onboarding
      show_recovery_banner = false;
    }

    const recovery_codes_count = data?.recovery_codes_count ?? 0;
    const has_wrappings = userData?.recovery_key_wrappings != null;
    const needs_upgrade = recovery_codes_count > 0 && !has_wrappings;

    return NextResponse.json({
      recovery_codes_count,
      show_recovery_banner,
      needs_upgrade
    });
  } catch (err) {
    console.error('[encryption-status] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
