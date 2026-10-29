import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if Supabase environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Supabase environment variables are not set')
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Use anon key in middleware to avoid permission issues
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
        global: {
          fetch: (url, options = {}) => {
            // Add timeout to fetch requests
            return Promise.race([
              fetch(url, options),
              new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 3000)
              ),
            ]);
          },
        },
      }
    )

    const pathname = request.nextUrl.pathname

    // IMPORTANT: DO NOT REMOVE auth.getUser() but add timeout
    const authTimeout = new Promise<{ data: { user: null }, error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    });

    const authResult = await Promise.race([
      supabase.auth.getUser(),
      authTimeout
    ]).catch((error) => {
      console.error('Auth request failed:', error.message);
      return { data: { user: null }, error };
    });

    const { data: { user }, error: authError } = authResult;

    // If there's an auth error or timeout, redirect protected routes to login
    if (authError) {
      console.error('Auth error in middleware:', authError.message);
      // For any non-public route, redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Redirect unauthenticated users for any route (handled by main middleware for public paths)
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // For authenticated users, skip onboarding check if Supabase is having issues
    // This prevents middleware timeout
    if (user && pathname.startsWith('/user')) {
      // Skip database check during middleware to prevent timeouts
      // Let the page components handle onboarding checks
    }

    // Redirect authenticated users from homepage to dashboard
    if (user && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    const pathname = request.nextUrl.pathname
    // On error, redirect to landing for protected routes
    if (pathname.startsWith('/user')) {
      const url = request.nextUrl.clone()
      url.pathname = '/landing'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }
}