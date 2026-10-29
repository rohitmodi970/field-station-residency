// apps/web/actions/auth.ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js"; // Import UAParser for user-agent parsing , for device info

type SignUpData = {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  username?: string;
  encryptionSalt?: string; // Add encryption salt
  encryptedMasterKey?: string; // Add encrypted master key
  masterKeyIV?: string; // Add master key IV
};

type SignInData = {
  email: string;
  password: string;
};

/**
 * Get client IP address and device info from headers
 */
async function getClientInfo() {
  const headersList = await headers();
  
  const ip = 
    headersList.get("x-forwarded-for")?.split(",")[0] ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    "0.0.0.0";

  const userAgent = headersList.get("user-agent") || "";
  const parser = new UAParser(userAgent);
  const uaResult = parser.getResult();

  return {
    ip_address: ip,
    user_agent: userAgent,
    device_type: uaResult.device.type || "desktop",
    device_name: `${uaResult.browser.name || "Unknown"} on ${uaResult.os.name || "Unknown"}`,
    browser: `${uaResult.browser.name || "Unknown"} ${uaResult.browser.version || ""}`.trim(),
    os: `${uaResult.os.name || "Unknown"} ${uaResult.os.version || ""}`.trim(),
  };
}

/**
 * Ensure user profile exists in users table
 */
async function ensureUserProfile(userId: string, userData?: { email: string; name?: string; phone?: string; username?: string; avatar_url?: string; encryption_salt?: string }) {
  const supabase = await createClient();

  // Check if user profile exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingUser && userData) {
    // Create user profile
    const username =
      userData.username ||
      ((userData.email?.split("@")[0]?.toLowerCase() || "user") + "_" + userId.substring(0, 4));

    let { error: insertError } = await supabase.from("users").insert({
      id: userId,
      email: userData.email,
      name: userData.name || null,
      username: username,
      phone: userData.phone || null,
      profile_image: userData.avatar_url || null,
      encryption_salt: userData.encryption_salt || null,
      last_login: new Date().toISOString(),
    });

    if (insertError) {
      console.warn("Initial profile insert failed, retrying with fallback username:", insertError);
      const emailPrefix = userData.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
      const fallbackUsername = `${emailPrefix}_${userId.replace(/-/g, '').substring(0, 8)}_${Math.floor(1000 + Math.random() * 9000)}`;
      const retryResult = await supabase.from("users").insert({
        id: userId,
        email: userData.email,
        name: userData.name || null,
        username: fallbackUsername,
        phone: userData.phone || null,
        profile_image: userData.avatar_url || null,
        encryption_salt: userData.encryption_salt || null,
        last_login: new Date().toISOString(),
      });
      insertError = retryResult.error;
    }

    if (insertError) {
      console.error("Error creating user profile after retry:", insertError);
      throw new Error("Failed to create user profile");
    }
  } else if (existingUser) {
    // Update last login and encryption salt if provided
    const updateData: any = { last_login: new Date().toISOString() };
    if (userData?.encryption_salt && !existingUser.encryption_salt) {
      updateData.encryption_salt = userData.encryption_salt;
    }
    
    await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);
  }
}

/**
 * Create a session record in user_sessions table
 */
async function createSessionRecord(userId: string) {
  const adminClient = createAdminClient();
  const clientInfo = await getClientInfo();

  const { error } = await adminClient.from("user_sessions").insert({
    user_id: userId,
    ip_address: clientInfo.ip_address,
    user_agent: clientInfo.user_agent,
    device_type: clientInfo.device_type,
    device_name: clientInfo.device_name,
    browser: clientInfo.browser,
    os: clientInfo.os,
    is_active: true,
    last_activity: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating session record:", error);
  }
}

/**
 * Sign up a user with email/password
 */
export async function signUpWithEmail(payload: SignUpData) {
  const supabase = await createClient();

  const username = payload.username || payload.email.split("@")[0]?.toLowerCase() || "user";

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name || null,
        phone: payload.phone || null,
        username: username,
        encryption_salt: payload.encryptionSalt || null, // Store encryption salt
        encrypted_master_key: payload.encryptedMasterKey || null, // Store encrypted master key
        master_key_iv: payload.masterKeyIV || null, // Store master key IV
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/confirm`,
    },
  });

  if (error) {
    console.error("Sign up error:", error);
    return { data: null, error };
  }

  // DON'T create session or user profile here - wait until email is verified
  // The confirm route will handle that

  // NOTE: We no longer auto-add to waitlist here since users must be approved
  // in the waitlist BEFORE they can sign up (checked in handleEmailSubmit)

  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("Revalidate path error:", e);
  }

  return { data, error: null };
}

/**
 * Sign in a user with email/password
 */
export async function signInWithEmail(payload: SignInData & { encryptionSalt?: string }) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error) {
      console.error("Sign in error:", error);
      const isInvalidCredentials =
        error.code === "invalid_credentials" ||
        error.message?.toLowerCase().includes("invalid login credentials");

      return {
        data: null,
        error: {
          message: isInvalidCredentials ? "Invalid email or password." : error.message,
          code: error.code,
          status: error.status,
        },
      };
    }

    if (!data.user) {
      return { data: null, error: { message: "No user returned" } };
    }

    try {
      // FIRST: Ensure user profile exists
      await ensureUserProfile(data.user.id, {
        email: data.user.email!,
        name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
        phone: data.user.user_metadata?.phone,
        username: data.user.user_metadata?.username,
        avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
        encryption_salt: payload.encryptionSalt || data.user.user_metadata?.encryption_salt,
      });

      // THEN: Create session record (this will now work because user exists)
      await createSessionRecord(data.user.id);
    } catch (err) {
      console.error("Error in post-signin setup:", err);
      // Continue even if session creation fails - user is still logged in
    }

    try {
      revalidatePath("/", "layout");
    } catch (e) {
      console.error("Revalidate path error:", e);
    }

    return { data, error: null };
  } catch (err: unknown) {
    console.error("Sign in unexpected error:", err);
    const maybeAuthError = err as {
      message?: string;
      code?: string;
      status?: number;
    };
    const rawMessage = maybeAuthError.message || "Authentication failed";
    const normalizedMessage =
      maybeAuthError.code === "invalid_credentials" ||
      rawMessage.toLowerCase().includes("invalid login credentials")
        ? "Invalid email or password."
        : rawMessage;

    return {
      data: null,
      error: {
        message: normalizedMessage,
        code: maybeAuthError.code,
        status: maybeAuthError.status,
      },
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const clientInfo = await getClientInfo();
    const adminClient = createAdminClient();
    
    await adminClient
      .from("user_sessions")
      .update({
        is_active: false,
        logout_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("ip_address", clientInfo.ip_address)
      .eq("is_active", true);
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    return { error };
  }

  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("Revalidate path error:", e);
  }

  redirect("/");
}

/**
 * Sign out the current user without performing a server-side redirect.
 * Useful when client wants to control navigation (keep UI visible during cleanup).
 */
export async function signOutUserNoRedirect() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const clientInfo = await getClientInfo();
    const adminClient = createAdminClient();
    
    await adminClient
      .from("user_sessions")
      .update({
        is_active: false,
        logout_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("ip_address", clientInfo.ip_address)
      .eq("is_active", true);
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    return { error };
  }

  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("Revalidate path error:", e);
  }

  return { error: null };
}

/**
 * Get the current user
 */
export async function getUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Error getting user:", error);
    return { user: null, error };
  }

  return { user, error: null };
}

/**
 * Get user's recent IP addresses (last 4)
 */
export async function getUserRecentIPs() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ips: [], error: new Error("No user found") };
  }

  const { data, error } = await supabase.rpc("get_user_recent_ips", {
    p_user_id: user.id,
    p_limit: 4,
  });

  if (error) {
    console.error("Error getting recent IPs:", error);
    return { ips: [], error };
  }

  return { ips: data || [], error: null };
}

/**
 * Get user's active sessions
 */
export async function getUserActiveSessions() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sessions: [], error: new Error("No user found") };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("user_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("last_activity", { ascending: false });

  if (error) {
    console.error("Error getting active sessions:", error);
    return { sessions: [], error };
  }

  return { sessions: data || [], error: null };
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string) {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: new Error("No user found") };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("user_sessions")
    .update({
      is_active: false,
      logout_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error revoking session:", error);
    return { success: false, error };
  }

  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("Revalidate path error:", e);
  }

  return { success: true, error: null };
}

/**
 * Revoke all other sessions (except current)
 */
export async function revokeAllOtherSessions() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: new Error("No user found") };
  }

  const clientInfo = await getClientInfo();
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("user_sessions")
    .update({
      is_active: false,
      logout_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("ip_address", clientInfo.ip_address);

  if (error) {
    console.error("Error revoking sessions:", error);
    return { success: false, error };
  }

  try {
    revalidatePath("/", "layout");
  } catch (e) {
    console.error("Revalidate path error:", e);
  }

  return { success: true, error: null };
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("Google sign-in error:", error);
    return { error };
  }

  return;
}