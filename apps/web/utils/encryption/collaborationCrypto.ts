// apps/web/utils/encryption/collaborationCrypto.ts
/**
 * Collaboration Crypto — Phase 2
 *
 * Client-side cryptographic layer for journal collaboration:
 *   1. RSA-OAEP-4096 key pair — generated once per user per browser, stored in
 *      the 'collab' IndexedDB store (same DB as keyManager, version 3).
 *   2. AES key wrapping — each collaborator gets their own RSA-encrypted copy of
 *      the journal AES-GCM key (stored in journal_shared_keys on the server).
 *   3. Solo → collab conversion — re-encrypts the journal with a NEW per-journal
 *      AES key so the master key is never shared with collaborators.
 *   4. In-memory journal key cache — holds decrypted journal AES keys for the
 *      session. Clears on logout (via registerClearCallback) and after 30 minutes
 *      of the tab being hidden (visibilitychange TTL).
 *
 * SECURITY INVARIANTS:
 *   - The user's master key is NEVER accessed directly here. Only getEncryptionKey().
 *   - RSA private key is stored as non-extractable in IDB — the browser manages
 *     serialisation; the raw bytes are never accessible to JS.
 *   - AES journal keys only ever live in memory (activeJournalKeys Map). They are
 *     never written to IDB or sent to the server in plaintext.
 *   - The server stores RSA-wrapped AES keys only (journal_shared_keys table).
 */

import { getEncryptionKey, registerClearCallback, DB_NAME } from './keyManager';
import { encryptText, decryptText, importMasterKey, uint8ArrayToBase64, base64ToUint8Array } from './crypto';

// ─────────────────────────────────────────────────────────────
// IDB helpers — same 'force-encryption' DB, 'collab' store (v3)
// ─────────────────────────────────────────────────────────────

const COLLAB_DB_VERSION = 3;

async function openCollabStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, COLLAB_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains('device')) {
        db.createObjectStore('device', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('collab')) {
        db.createObjectStore('collab', { keyPath: 'id' });
      }
    };
  });
}

function idbCollabRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────
// RSA-OAEP-4096 Key Pair
// ─────────────────────────────────────────────────────────────

/**
 * Generate an RSA-OAEP-4096 key pair.
 * ~500 ms on modern hardware. Called once per user, ever (or after key reset).
 *
 * - publicKey:  extractable (SPKI → base64 → uploaded to server)
 * - privateKey: extractable=true required by Web Crypto for RSA-OAEP generation,
 *               but we never call exportKey on it — it is treated as opaque.
 */
export async function generateCollabKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable needed for SPKI export of public key
    ['encrypt', 'decrypt']
  );
}

/** Export a public key as base64 SPKI — safe to send to the server. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return uint8ArrayToBase64(new Uint8Array(spki));
}

/**
 * Import another user's public key from base64 SPKI.
 * Returned by GET /api/user/public-key?userId=<id>.
 */
export async function importPublicKey(base64Spki: string): Promise<CryptoKey> {
  const bytes = base64ToUint8Array(base64Spki);
  return crypto.subtle.importKey(
    'spki',
    bytes.buffer as ArrayBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,       // no need to re-export
    ['encrypt']
  );
}

// ─────────────────────────────────────────────────────────────
// Private Key IDB Persistence
// ─────────────────────────────────────────────────────────────

const _collabKeyId = (userId: string) => `rsa-private-${userId}`;

/**
 * Persist the RSA private key to the IDB 'collab' store.
 * The browser serialises CryptoKey objects natively.
 */
export async function storeCollabPrivateKey(key: CryptoKey, userId: string): Promise<void> {
  const db = await openCollabStore();
  const tx = db.transaction('collab', 'readwrite');
  await idbCollabRequest(
    tx.objectStore('collab').put({
      id: _collabKeyId(userId),
      key,
      storedAt: Date.now(),
    })
  );
  db.close();
}

/**
 * Load RSA private key from IDB.
 * Returns null if the user has never generated a key on this device
 * or if they cleared their browser storage.
 */
export async function loadCollabPrivateKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openCollabStore();
    const tx = db.transaction('collab', 'readonly');
    const record = await idbCollabRequest<
      { id: string; key: CryptoKey; storedAt: number } | undefined
    >(tx.objectStore('collab').get(_collabKeyId(userId)));
    db.close();
    return record?.key ?? null;
  } catch (err) {
    console.warn('[collaborationCrypto] Failed to load RSA private key from IDB:', err);
    return null;
  }
}

/** Returns true if an RSA private key exists in IDB for this userId. */
export async function hasCollabPrivateKey(userId: string): Promise<boolean> {
  const key = await loadCollabPrivateKey(userId);
  return key !== null;
}

/** Delete the RSA private key from IDB (called before issuing a key reset). */
export async function clearCollabPrivateKey(userId: string): Promise<void> {
  try {
    const db = await openCollabStore();
    const tx = db.transaction('collab', 'readwrite');
    await idbCollabRequest(tx.objectStore('collab').delete(_collabKeyId(userId)));
    db.close();
  } catch (err) {
    console.warn('[collaborationCrypto] Failed to clear RSA private key from IDB:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Bootstrap — ensureCollabKeyPair
// ─────────────────────────────────────────────────────────────

/**
 * Main entry point before any collab operation.
 *
 * Flow:
 *   A) Private key found in IDB → fetch public key from server → return pair.
 *   B) Private key missing → generate new RSA-4096 pair (~500ms) → store
 *      private key in IDB → POST public key to /api/user/public-key → return pair.
 *
 * Callers should disable action buttons (not show a spinner overlay) while
 * this promise is pending. The Accept invitation button and Invite dialog
 * button should both use this pattern.
 */
export async function ensureCollabKeyPair(
  userId: string
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const existingPrivate = await loadCollabPrivateKey(userId);

  if (existingPrivate) {
    // Try to fetch matching public key from server
    try {
      const res = await fetch(`/api/user/public-key?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.collaboration_public_key) {
          const publicKey = await importPublicKey(data.collaboration_public_key);
          return { publicKey, privateKey: existingPrivate };
        }
      }
    } catch {
      // Network error — fall through to regenerate
    }
    // Public key missing from server despite local private key existing.
    // This can happen if the server was reset. Regenerate and re-upload.
    console.warn('[collaborationCrypto] Public key missing on server; regenerating pair…');
  }

  // ── Generate new pair ──────────────────────────────────────
  console.log('[collaborationCrypto] Generating RSA-4096 key pair…');
  const pair = await generateCollabKeyPair();
  const pubKeyB64 = await exportPublicKey(pair.publicKey);

  // Store private key in IDB first (so a failed upload doesn't orphan the key)
  await storeCollabPrivateKey(pair.privateKey, userId);

  // Upload public key to server
  const uploadRes = await fetch('/api/user/public-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: pubKeyB64 }),
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`[collaborationCrypto] Failed to upload RSA public key (${uploadRes.status}): ${body}`);
  }

  console.log('[collaborationCrypto] ✅ RSA-4096 key pair generated and uploaded');
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

// ─────────────────────────────────────────────────────────────
// AES Key Wrapping / Unwrapping
// ─────────────────────────────────────────────────────────────

/**
 * RSA-OAEP encrypt the 32-byte journal AES key for a recipient.
 *
 * @param journalAesBytes    - Raw 32-byte AES key (Uint8Array)
 * @param recipientPublicKey - Recipient's RSA-4096 public key
 * @returns base64 ciphertext stored in journal_shared_keys.encrypted_journal_key
 */
export async function wrapAesKeyForUser(
  journalAesBytes: Uint8Array,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    journalAesBytes.buffer as ArrayBuffer
  );
  return uint8ArrayToBase64(new Uint8Array(wrapped));
}

/**
 * RSA-OAEP decrypt a wrapped journal key using the caller's private key.
 *
 * @param encryptedKeyBase64 - base64 from journal_shared_keys.encrypted_journal_key
 * @param myPrivateKey       - This user's RSA private key (from IDB)
 * @returns AES-GCM CryptoKey ready for journal encrypt/decrypt
 */
export async function unwrapAesKey(
  encryptedKeyBase64: string,
  myPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrapped = base64ToUint8Array(encryptedKeyBase64);
  const aesBytes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    myPrivateKey,
    wrapped.buffer as ArrayBuffer
  );
  return importMasterKey(new Uint8Array(aesBytes));
}

// ─────────────────────────────────────────────────────────────
// In-Memory Journal Key Cache
// ─────────────────────────────────────────────────────────────

/**
 * Session-scoped in-memory map: journalId → decrypted AES CryptoKey.
 * Never persisted to IDB or the network.
 *
 * Cleared by two mechanisms:
 *   1. On logout — via registerClearCallback below (no circular import).
 *   2. After 30 minutes of tab hidden — visibilitychange TTL below.
 */
const activeJournalKeys = new Map<string, CryptoKey>();

// Hook into keyManager's logout sequence (avoids circular import)
registerClearCallback(() => {
  activeJournalKeys.clear();
  console.log('[collaborationCrypto] Journal key cache cleared on logout');
});

// 30-minute visibilitychange TTL
if (typeof document !== 'undefined') {
  let _hiddenSince: number | null = null;
  const HIDDEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _hiddenSince = Date.now();
    } else {
      if (_hiddenSince !== null && Date.now() - _hiddenSince >= HIDDEN_TTL_MS) {
        activeJournalKeys.clear();
        console.log('[collaborationCrypto] Journal key cache cleared (30min hidden TTL)');
      }
      _hiddenSince = null;
    }
  });
}

export function cacheJournalKey(journalId: string, key: CryptoKey): void {
  activeJournalKeys.set(journalId, key);
}

export function getCachedJournalKey(journalId: string): CryptoKey | undefined {
  return activeJournalKeys.get(journalId);
}

/** Manually evict all cached journal AES keys (e.g. on vault lock). */
export function clearAllJournalKeys(): void {
  activeJournalKeys.clear();
}

// ─────────────────────────────────────────────────────────────
// Solo → Collaborative Journal Conversion
// ─────────────────────────────────────────────────────────────

export interface CollabConvertResult {
  /** Re-encrypted journal content (new per-journal AES key) */
  newCipher: string;
  newIv: string;
  /** Raw 32-byte journal AES key — keep in memory; do NOT store */
  journalAesBytes: Uint8Array;
  /** RSA-wrapped AES key for the journal owner */
  ownerWrappedKey: string;
  /**
   * RSA-wrapped AES key for the invitee.
   * null when invitee has no public key yet (key_pending flow).
   */
  inviteeWrappedKey: string | null;
}

/**
 * Convert a solo journal to collaborative mode.
 *
 * Steps:
 *   1. Decrypt existing ciphertext with the owner's master key.
 *   2. Generate a fresh 32-byte per-journal AES key.
 *   3. Re-encrypt with the new key (new IV).
 *   4. RSA-wrap the new key for both owner and invitee.
 *   5. Return everything for the caller to POST to /api/journals/:id/invite.
 *
 * The caller is responsible for caching the journal AES key after a
 * successful API response:
 *   cacheJournalKey(journalId, await importMasterKey(result.journalAesBytes))
 */
export async function convertSoloJournalForCollab(params: {
  userId: string;
  currentCiphertext: string;
  currentIv: string;
  ownerPublicKey: CryptoKey;
  inviteePublicKey: CryptoKey | null;
}): Promise<CollabConvertResult> {
  const { userId, currentCiphertext, currentIv, ownerPublicKey, inviteePublicKey } = params;

  // 1 — Decrypt with master key (owner's personal key, unchanged)
  const masterKey = await getEncryptionKey(userId);
  const plaintext = await decryptText(currentCiphertext, currentIv, masterKey);

  // 2 — Fresh per-journal AES key (never derived from master key)
  const journalAesBytes = crypto.getRandomValues(new Uint8Array(32));
  const journalAesKey = await importMasterKey(journalAesBytes);

  // 3 — Re-encrypt with per-journal key
  const { ciphertext: newCipher, iv: newIv } = await encryptText(plaintext, journalAesKey);

  // 4 — Wrap for owner
  const ownerWrappedKey = await wrapAesKeyForUser(journalAesBytes, ownerPublicKey);

  // 5 — Wrap for invitee (null = key_pending)
  const inviteeWrappedKey = inviteePublicKey
    ? await wrapAesKeyForUser(journalAesBytes, inviteePublicKey)
    : null;

  return { newCipher, newIv, journalAesBytes, ownerWrappedKey, inviteeWrappedKey };
}
