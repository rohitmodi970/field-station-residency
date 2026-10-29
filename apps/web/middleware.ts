// middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware';
import { generateVisitorId } from './lib/viral-tracking';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const reservedSingleSegmentRoutes = new Set([
    'auth',
    'login',
    'signup',
    'register',
    'api',
    'confirmation-page',
    'forgot-password',
    'reset-password',
    'residency',
    'field-station-residency',
    'waitlist',
    'pending-approval',
    'access-denied',
    'terms-and-conditions',
    'fun-masking',
    'fun-maxxing',
    'fun-maxxxxxing',
    'funmaxxing',
    'p',
    'landing',
    'about',
    'contact',
    'privacy-policy',
    'newlanding',
    'error',
    'test',
    'dashboard',
    'dashboard-personalized',
    'journal',
    'analysis',
    'settings',
    'profile',
    'security',
    'notifications',
    'todo',
    'vault',
    'new',
    'ocr',
    'onboarding',
    'no-onairos',
    'onairos-only',
    'verify-email',
    'feedback',
    'refresh-google-token',
    'account',
    'fonts',
    'images',
    'mind_scroll',
    'Mountain',
    'lander',
    'logo',
    'file',
    'icons',
    'videos',
    'audio',
  ]);

  // Handle visitor ID cookie for public journal pages (matches /[username]/journal/[shareId])
  // Exclude paths where first segment is "journal" (that's the user's journal route, not a username)
  const publicJournalMatch = pathname.match(/^\/([^/]+)\/journal\/[^/]+$/);
  if (publicJournalMatch && publicJournalMatch[1] !== 'journal') {
    const response = NextResponse.next();
    
    // Check if visitor_id cookie exists
    if (!request.cookies.get('visitor_id')) {
      const visitorId = generateVisitorId();
      response.cookies.set('visitor_id', visitorId, {
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: '/',
        httpOnly: false, // Allow client-side access
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    
    return response;
  }

  if (isAuthPage) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const url = request.nextUrl.clone();
        url.pathname = '/journal';
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('Auth page redirect check failed:', error);
    }
  }

  // Public paths that don't require authentication
  const publicPaths = [
    '/auth',
    '/login',
    '/signup',
    '/register',
    '/api',
    '/confirmation-page',
    '/forgot-password',
    '/reset-password',
    '/waitlist',
    '/pending-approval',
    '/access-denied',
    '/terms-and-conditions',
    '/connect',
    '/fun-masking',
    '/fun-maxxing',
    '/fun-maxxxxxing',
    '/funmaxxing',
    '/p', // Public shared journal URLs (legacy /p/[shareId] format)
    '/onboarding', // [TEMPORARY: Onairos testing] Public onboarding access
    '/',
    '/residency',
    '/field-station-residency',
  ];

  // Static asset paths - all files in public folder should be accessible
  const staticAssetPaths = [
    '/art',
    '/landing',
    '/fonts',
    '/images',
    '/mind_scroll',
    '/Mountain',
    '/lander',
    '/logo',
    '/file',
    '/icons',
    '/videos',
    '/audio',
  ];

  const isPublicPath = pathname === '/' || pathname === '/waitlist' || publicPaths.some(path => pathname.startsWith(path));
  const isStaticAsset = staticAssetPaths.some(path => pathname.startsWith(path));

  // Allow unauthenticated access for valid /[username] code-entry routes.
  const singleSegmentMatch = pathname.match(/^\/([^/]+)$/);
  if (singleSegmentMatch) {
    const rawUsernameSlug = singleSegmentMatch[1];
    if (!rawUsernameSlug) {
      return NextResponse.next();
    }
    const usernameSlug = decodeURIComponent(rawUsernameSlug).toLowerCase();
    if (usernameSlug && !reservedSingleSegmentRoutes.has(usernameSlug)) {
      return NextResponse.next();
    }
  }

  // For public paths and static assets, just return without any auth checks or redirects to ensure they are accessible to everyone, including unauthenticated users and web crawlers
  if (isPublicPath || isStaticAsset) {
    return NextResponse.next();
  }

  // For protected routes (everything else), check auth and waitlist approval
  try {
    // Create Supabase client for middleware
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
        global: {
          fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
            Promise.race([
              fetch(url, options),
              new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error('Supabase fetch timeout')), 4000)
              ),
            ]),
        },
      }
    );

    // Check if user is authenticated (with timeout guard)
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 4000)
      ),
    ]).catch((err) => {
      console.error('Auth check timed out or failed:', err.message);
      return { data: { user: null }, error: err };
    });
    const { data: { user }, error: authError } = authResult;

    if (authError || !user) {
      // Not authenticated, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // User is authenticated, now check waitlist approval status
    // We must use an admin client here because RLS on waitlist_submissions prevents normal authenticated users from reading
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {}
        }
      }
    );

    const { data: waitlistEntries, error: waitlistError } = await adminClient
      .from('waitlist_submissions')
      .select('status, email, converted_at')
      .eq('email', user.email)
      .order('created_at', { ascending: false });

    if (waitlistError) {
      // Database error, log and allow access (fail open for better UX)
      console.error('Waitlist check error:', waitlistError);
      return await updateSession(request);
    }

    // Get the most recent entry
    const waitlistEntry = waitlistEntries && waitlistEntries.length > 0 ? waitlistEntries[0] : null;

    // Check waitlist status
    if (!waitlistEntry) {
      // User not in waitlist, redirect to waitlist form
      const url = request.nextUrl.clone();
      url.pathname = '/waitlist';
      return NextResponse.redirect(url);
    }

    // If already converted to user (has converted_at timestamp) or approved, check onboarding
    if (waitlistEntry.converted_at || waitlistEntry.status === 'approved') {
      // Check if user has completed onboarding (skip check if already on onboarding page)
      const isOnboardingPath = pathname.startsWith('/onboarding');
      
      if (!isOnboardingPath) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();
        
        // If user exists and hasn't completed onboarding, redirect to onboarding
        if (!userError && userData && userData.onboarding_complete === false) {
          console.log('[Middleware] User has not completed onboarding, redirecting...');
          const url = request.nextUrl.clone();
          url.pathname = '/onboarding';
          return NextResponse.redirect(url);
        }
      }
      
      return await updateSession(request);
    }

    if (waitlistEntry.status === 'pending') {
      // User in waitlist but pending approval
      const url = request.nextUrl.clone();
      url.pathname = '/pending-approval';
      url.searchParams.set('reason', 'pending');
      return NextResponse.redirect(url);
    }

    if (waitlistEntry.status === 'rejected') {
      // User rejected from waitlist
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      url.searchParams.set('reason', 'rejected');
      return NextResponse.redirect(url);
    }

    // Default: redirect to waitlist form (shouldn't reach here)
    {
      const url = request.nextUrl.clone();
      url.pathname = '/waitlist';
      return NextResponse.redirect(url);
    }

  } catch (error) {
    console.error('Middleware error:', error);
    // On error, redirect to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
}

// export default withAuth(
//   async function middleware(req) {
//     console.log("Middleware called for path:", req.nextUrl.pathname);
    
//     // Check if token exists and is valid
//     const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
//     console.log("Token:", token);
    
//     // Redirect authenticated users from homepage to dashboard
//     if (token && req.nextUrl.pathname === '/') {
//       console.log("✅ Authenticated user visiting homepage, redirecting to dashboard");
//       return NextResponse.redirect(new URL('/user/dashboard', req.url));
//     }
    
//     // Check for expired access tokens and redirect to login if needed
//     if (token?.error === "RefreshAccessTokenError") {
//       console.log("❌ Token refresh error, redirecting to login");
//       return NextResponse.redirect(new URL('/login', req.url));
//     }
    
//     // Remaining middleware logic stays the same...
//     // Check Google token status for protected routes that require Google integration
//     if (token && 
//         token.onboardingComplete === true && 
//         (req.nextUrl.pathname.startsWith('/user/google') || 
//          req.nextUrl.pathname.startsWith('/user/drive'))) {
      
//       try {
//         // Check token status via our API
//         const tokenCheckResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/refresh`, {
//           headers: {
//             'Cookie': req.headers.get('cookie') || '',
//             'Content-Type': 'application/json',
//           },
//         });
        
//         const tokenData = await tokenCheckResponse.json();
        
//         // If token check fails or token is expired
//         if (!tokenData.success || 
//             (tokenData.tokenInfo.isExpired || tokenData.tokenInfo.expiresIn < 60)) {
//           console.log("🔄 Google token expired or missing, redirecting to token refresh page");
//           return NextResponse.redirect(new URL('/user/refresh-google-token', req.url));
//         }
//       } catch (error) {
//         console.error("Error checking token status:", error);
//         // On error, we'll just continue and let the specific API handle the error
//       }
//     }
    
//     // For new users or users without completed onboarding, redirect to onboarding
//     if (token && 
//         (token.onboardingComplete === false) && 
//         !req.nextUrl.pathname.startsWith('/auth/register') && 
//         !req.nextUrl.pathname.startsWith('/user/onboarding')) {
//       console.log("🆕 User needs onboarding, redirecting to onboarding flow");
//       return NextResponse.redirect(new URL('/user/onboarding', req.url));
//     }
    
//     // For authenticated users with completed onboarding trying to visit onboarding page
//     if (token && 
//         token.onboardingComplete === true && 
//         req.nextUrl.pathname.startsWith('/user/onboarding')) {
//       console.log("✅ User already completed onboarding, redirecting to dashboard");
//       return NextResponse.redirect(new URL('/user/dashboard', req.url));
//     }
    
//     return NextResponse.next();
//   },
  
//   {
//     callbacks: {
//       authorized: ({ token, req }) => {
//         const pathname = req.nextUrl.pathname;
        
//         const publicPaths = [
//           '/auth',
//           '/about',
//           '/contact',
//           '/api/public',
//           '/api/auth',
//           '/user/refresh-google-token', // Add token refresh page to public paths
//         ];
        
//         // Handle '/' separately to avoid false matches
//         const isPublicPath = 
//           pathname === '/' || publicPaths.some(path => pathname.startsWith(path));
        
//         if (isPublicPath) {
//           console.log("✅ Public path allowed:", pathname);
//           return true;
//         }
        
//         // Make onboarding accessible for new users and users who haven't completed onboarding
//         if (pathname.startsWith('/user/onboarding') && 
//             ( token?.onboardingComplete === false)) {
//           console.log("✅ User accessing onboarding, allowed");
//           return true;
//         }
        
//         // Protect other /user/* routes
//         const isProtected = pathname.startsWith('/user');
//         const isAuthorized = !!token;
        
//         if (isProtected) {
//           console.log(`🔒 Protected path: ${pathname}, Authenticated: ${isAuthorized}`);
//           return isAuthorized;
//         }
        
//         return true;
//       },
//     },
//     pages: {
//       signIn: '/login',
//       error: '/auth/error',
//     },
//   }
// );

// Update matcher to exclude API routes and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, videos, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2|ttf|eot|mp4|webm|ogg|mp3|wav|flac|aac|otf)$).*)',
  ],
};