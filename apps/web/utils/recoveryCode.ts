// apps/web/utils/recoveryCode.ts
/**
 * Recovery Code Utilities — Security Architecture v2 (Phase 2)
 *
 * Recovery codes are one-time-use backup codes that allow a user to access
 * their account and register a new trusted device when they have lost all
 * their trusted devices and have no TOTP app available.
 *
 * Security properties:
 *  - Generated entirely client-side using crypto.getRandomValues()
 *  - Plain codes are NEVER sent to or stored on the server
 *  - Only bcrypt hashes (cost 10) are stored in the recovery_codes table
 *  - Each code provides ~40 bits of entropy (two 4-char groups from a 32-char alphabet)
 *  - Codes are one-time use; consumed codes are marked with used_at timestamp
 */

import bcrypt from 'bcryptjs';

// ── Alphabet ──────────────────────────────────────────────────────────────────
// 32 characters: A-Z minus O and I, 0-9 minus 0 and 1.
// Avoids visually similar characters to prevent transcription errors.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHARSET_LEN = CHARSET.length; // 32

/**
 * Generate `count` random recovery codes in XXXX-XXXX format.
 * Uses crypto.getRandomValues for cryptographic randomness.
 *
 * @param count - Number of codes to generate (default: 8)
 * @returns Array of plain-text recovery codes
 */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    // 8 random bytes: first 4 for the first group, last 4 for the second
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const toChar = (b: number) => CHARSET[b % CHARSET_LEN]!;
    const half = (start: number) =>
      Array.from(bytes.slice(start, start + 4), toChar).join('');
    return `${half(0)}-${half(4)}`;
  });
}

/**
 * Hash a single recovery code with bcrypt (cost 10).
 *
 * @param code - Plain-text recovery code (e.g. "K8X2-A91P")
 * @returns bcrypt hash string
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase().trim(), 10);
}

/**
 * Hash all recovery codes in parallel.
 * With bcrypt cost=10 each hash takes ~100ms; 8 codes ≈ 100ms total (parallel).
 *
 * @param codes - Array of plain-text codes
 * @returns Array of bcrypt hashes (same order)
 */
export async function hashAllCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(hashRecoveryCode));
}

/**
 * Verify a plain code against a bcrypt hash (server-side use only).
 *
 * @param code - Plain code entered by user
 * @param hash - bcrypt hash from the database
 * @returns true if they match
 */
export async function verifyRecoveryCode(
  code: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(code.toUpperCase().trim(), hash);
}

/**
 * Format a raw code for display: ensure it has the dash separator.
 *
 * @param raw - e.g. "K8X2A91P" or "K8X2-A91P"
 * @returns "K8X2-A91P"
 */
export function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 8) return raw;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}
