// apps/web/utils/encryption/credentialTransit.ts
/**
 * Short-lived, encrypted credential transit for passing the login password
 * from LoginFormNew → EncryptionGate → NewDeviceVerification.
 *
 * Threat model — what this defends and doesn't:
 *
 *   ✅ DEFENDS: Passive storage snooping — browser extensions with storage-only
 *      permissions, devtools inspection of sessionStorage, forensic analysis of
 *      storage dumps. Attacker gets ciphertext, no key.
 *
 *   ❌ DOES NOT DEFEND: Active XSS — an injected script running in the same
 *      page context can call retrieveCredential() directly, or hook the password
 *      input's change event. The non-extractable CryptoKey prevents key
 *      exfiltration but not in-process function calls.
 *
 *   The real XSS defense is Content Security Policy (script-src restrictions).
 *   This module is a defense-in-depth layer for the passive-snooping class only.
 *
 * Design:
 *   - Random AES-256-GCM key generated once per page load (module-scoped).
 *   - Key is non-extractable CryptoKey — raw bytes can't be read by JS.
 *   - sessionStorage holds only { ciphertext, iv }.
 *   - On page refresh / tab close, module-scoped key is garbage-collected.
 *   - retrieveCredential() is single-use — clears storage after one read.
 */

const STORAGE_KEY = '__force_enc_cred';

/** Module-scoped — exists only for the lifetime of this page load. */
let transitKey: CryptoKey | null = null;

async function getOrCreateTransitKey(): Promise<CryptoKey> {
  if (!transitKey) {
    transitKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt']
    );
  }
  return transitKey;
}

/**
 * Encrypt and store a credential in sessionStorage.
 * Called by LoginFormNew after successful authentication.
 */
export async function storeCredential(plaintext: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const key = await getOrCreateTransitKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      iv: btoa(String.fromCharCode(...iv)),
    })
  );
}

/**
 * Retrieve and decrypt the stored credential. Single-use: clears storage
 * after one successful read. Returns null if no credential is stored,
 * if the transit key was lost (page refresh), or if decryption fails.
 */
export async function retrieveCredential(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw || !transitKey) return null;

  // Single-use: clear immediately before attempting decryption
  sessionStorage.removeItem(STORAGE_KEY);

  try {
    const { ct, iv } = JSON.parse(raw);
    const ciphertext = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      transitKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/** Clear the stored credential without retrieving it. */
export function clearCredential(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
