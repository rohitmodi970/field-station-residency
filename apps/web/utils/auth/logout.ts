/**
 * Client-side logout utilities
 * Handles encryption key cleanup before server-side logout
 */

import { clearEncryptionKeys, isDeviceRemembered } from '@/utils/encryption/keyManager';
import { signOutUserNoRedirect } from '@/actions/auth';
import { toast } from '@/hooks/use-toast';

/**
 * Logout user with encryption cleanup.
 * Call this from client components instead of signOutUser directly.
 *
 * If the user previously checked "Remember this device for 30 days",
 * device credentials are preserved in IndexedDB so the next login can
 * skip the 2FA/device-verification gate. The master key cache is always
 * cleared regardless.
 *
 * Navigation:
 *   Uses window.location.href (hard navigation) so that all React state,
 *   Supabase Realtime channels, and in-memory encryption keys are fully
 *   wiped — no stale state can survive across the route transition.
 */
export async function logoutWithCleanup(): Promise<void> {
  // 1. Show toast immediately so it's visible before any navigation delay
  toast({
    title: 'Signed out',
    description: 'You have signed out successfully.',
  });

  // 2. Set sessionStorage flag for AuthToastHandler on the login page
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('force_auth_toast', 'signed_out');
  }

  // 3. Clear encryption keys from memory + IndexedDB
  try {
    const remembered = await isDeviceRemembered();
    await clearEncryptionKeys({ preserveDeviceCredentials: remembered });
    console.log('[logout] Encryption keys cleared', remembered ? '(device credentials preserved)' : '(full wipe)');
  } catch (error) {
    // Non-fatal — continue with logout even if key cleanup fails
    console.error('[logout] Failed to clear encryption keys (continuing):', error);
  }

  // 4. Invalidate the Supabase session server-side
  try {
    await signOutUserNoRedirect();
  } catch {
    // Non-fatal — session may already be expired; still navigate
  }

  // 5. Hard navigate to /login — tears down all React state, Realtime
  //    channels, and timers so the next session starts completely fresh.
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
