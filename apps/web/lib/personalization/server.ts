import { createAdminClient } from '@/utils/supabase/admin';
import type { BucketState } from './state-types';
import { mapEnergyLevelToBucket } from './bucket';

export async function resolveBucketState(userId: string, email: string | null | undefined): Promise<BucketState> {
  const adminClient = createAdminClient();

  const { data: onboarding } = await adminClient
    .from('user_onboarding')
    .select('energy_level, reflection, commitment')
    .eq('user_id', userId)
    .maybeSingle();

  let bucket = mapEnergyLevelToBucket(onboarding?.energy_level);
  let reflection: string | null = onboarding?.reflection ?? null;
  let commitment = Boolean(onboarding?.commitment);

  if (!bucket && email) {
    const { data: waitlist } = await adminClient
      .from('waitlist_submissions')
      .select('energy_level, reflection, commitment')
      .eq('email', email.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    bucket = mapEnergyLevelToBucket(waitlist?.energy_level);
    if (!reflection && waitlist?.reflection) reflection = waitlist.reflection;
    if (!commitment && typeof waitlist?.commitment === 'boolean') commitment = waitlist.commitment;

    if (bucket) {
      await adminClient
        .from('user_onboarding')
        .upsert(
          {
            user_id: userId,
            energy_level: bucket,
            reflection,
            commitment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }
  }

  return {
    bucket,
    reflection,
    commitment,
    requiresSelection: !bucket,
  };
}
