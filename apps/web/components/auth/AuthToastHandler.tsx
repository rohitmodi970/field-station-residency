'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

export function AuthToastHandler() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double firing in StrictMode for the same render cycle
    let handled = false;

    // 1. Check sessionStorage flash message
    if (typeof window !== 'undefined') {
      try {
        const flash = sessionStorage.getItem('force_auth_toast');
        if (flash) {
          sessionStorage.removeItem('force_auth_toast');
          handled = true;
          if (flash === 'logged_in') {
            toast({
              title: 'Welcome back!',
              description: 'You have logged in successfully.',
            });
          } else if (flash === 'signed_up') {
            toast({
              title: 'Account created!',
              description: 'Welcome to FORCE. Signed up successfully.',
            });
          } else if (flash === 'signed_out') {
            toast({
              title: 'Signed out',
              description: 'You have signed out successfully.',
            });
          }
        }
      } catch {
        // Ignore sessionStorage errors
      }
    }

    // 2. Check query param (e.g. from OAuth redirect /auth/callback)
    const authToast = searchParams?.get('auth_toast');
    if (authToast && !handled) {
      if (authToast === 'oauth_login') {
        toast({
          title: 'Welcome back!',
          description: 'Logged in successfully with Google.',
        });
      } else if (authToast === 'oauth_signup') {
        toast({
          title: 'Welcome to FORCE!',
          description: 'Account created and verified with Google.',
        });
      } else if (authToast === 'signed_out') {
        toast({
          title: 'Signed out',
          description: 'You have signed out successfully.',
        });
      }

      // Clean up the URL search param without triggering page reload/navigation
      try {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('auth_toast');
        const newQuery = newParams.toString();
        const cleanUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
        window.history.replaceState(null, '', cleanUrl);
      } catch {
        // Non-fatal if history update fails
      }
    }
  }, [searchParams, pathname]);

  return null;
}
