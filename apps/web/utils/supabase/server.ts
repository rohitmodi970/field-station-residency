import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function createClient() {
  const cookieStore = await cookies()

  // Always use the anon/publishable key here so RLS applies to user requests.
  // Use createAdminClient for privileged server-only workflows.
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Universal User Authentication Helper
 *
 * Supports BOTH:
 * 1. Mobile & external clients via Authorization: Bearer <jwt_access_token> header
 * 2. Web browser clients via Supabase SSR session cookies
 */
export async function getAuthenticatedUser(req?: Request | { headers: Headers } | null) {
  if (req && 'headers' in req) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return { error: 'Server misconfigured', status: 500 };
      }

      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return { error: 'Unauthorized', status: 401 };
      }
      return { user, supabase };
    }
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }

    return { user, supabase };
  } catch {
    return { error: 'Unauthorized', status: 401 };
  }
}