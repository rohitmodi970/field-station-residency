import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Use the anon (publishable) key on the browser. The env in .env is
    // named NEXT_PUBLIC_SUPABASE_ANON_KEY, so prefer that name.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}