/**
 * Agent Profile Store
 *
 * Builds an AgentProfile from the authenticated user's Supabase data.
 * Base info (name, email) comes from the `users` table.
 * Bio comes from `user_profiles.bio`.
 * Agent-specific extras (linkedin, twitter, company, role, phone, website,
 * customAnswers) are stored under `user_profiles.social_media.agent_extras`
 * so no schema migration is needed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentProfile } from "./tinyfish";

export type { AgentProfile };

export interface AgentExtras {
  linkedin?: string;
  twitter?: string;
  company?: string;
  role?: string;
  phone?: string;
  website?: string;
  customAnswers?: Record<string, string>;
}

/**
 * Build an AgentProfile for the currently authenticated user.
 * Reads from Supabase — no local files involved.
 */
export async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AgentProfile> {
  const [{ data: userData }, { data: profileData }] = await Promise.all([
    supabase
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_profiles")
      .select("bio, social_media")
      .eq("user_id", userId)
      .single(),
  ]);

  const extras: AgentExtras =
    (profileData?.social_media as Record<string, any>)?.agent_extras ?? {};

  return {
    name:          userData?.name          ?? "",
    email:         userData?.email         ?? "",
    bio:           profileData?.bio        ?? "",
    linkedin:      extras.linkedin         ?? "",
    twitter:       extras.twitter          ?? "",
    company:       extras.company          ?? "",
    role:          extras.role             ?? "",
    phone:         extras.phone            ?? "",
    website:       extras.website          ?? "",
    customAnswers: extras.customAnswers    ?? {},
  };
}

/**
 * Persist agent-specific extras (linkedin, twitter, company, etc.) into
 * `user_profiles.social_media.agent_extras` for the given user.
 * Does a safe merge so other social_media keys are not overwritten.
 */
export async function saveAgentExtras(
  supabase: SupabaseClient,
  userId: string,
  extras: AgentExtras,
): Promise<AgentExtras> {
  // Load current social_media to do a safe deep-merge
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("social_media")
    .eq("user_id", userId)
    .single();

  const currentSocialMedia =
    (existing?.social_media as Record<string, any>) ?? {};
  const currentExtras: AgentExtras = currentSocialMedia.agent_extras ?? {};

  const merged: AgentExtras = {
    ...currentExtras,
    ...extras,
    customAnswers: {
      ...(currentExtras.customAnswers ?? {}),
      ...(extras.customAnswers ?? {}),
    },
  };

  const newSocialMedia = { ...currentSocialMedia, agent_extras: merged };

  await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, social_media: newSocialMedia },
      { onConflict: "user_id" },
    );

  return merged;
}
