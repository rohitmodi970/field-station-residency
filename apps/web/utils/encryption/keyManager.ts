// apps/web/utils/encryption/keyManager.ts
/**
 * Encryption Key Manager — Security Architecture v2 (Phase 1 + Phase 2)
 *
 * Manages:
 *  1. Master key — derived from password/device-secret; cached in memory and IndexedDB.
 *  2. Device secret — random 32 bytes; stored only in IndexedDB; NEVER sent to server.
 *  3. Device ID — stable UUID that identifies this browser instance.
 *  4. Lazy migration — on first login after the upgrade, silently creates a `device_keys`
 *     row so future logins can use the faster device-secret path.
 *
 * Key-version semantics:
 *   key_version = 1 → legacy, PBKDF2 100k iterations (email: password; OAuth: userId)
 *   key_version = 2 → device-key wrapping, PBKDF2 600k iterations
 */

import {
  deriveKeyFromPassword,
  deriveDeviceKey,
  generateSalt,
  generateMasterKey,
  generateDeviceSecret,
  importMasterKey,
  exportKey,
  importKey,
  encryptText,
  decryptText,
  uint8ArrayToBase64,
  base64ToUint8Array,
  LEGACY_PBKDF2_ITERATIONS,
} from './crypto';
import {
  generateUserKeyPair as _generateUserKeyPair,
  loadPrivateKey as _loadPrivateKey,
  type GeneratedKeyPair,
} from './hybridCrypto';

// ─────────────────────────────────────────────────────────────
// In-memory session cache
// ─────────────────────────────────────────────────────────────
let cachedMasterKey: CryptoKey | null = null;
let cachedUserId: string | null = null;
/** ECDH P-256 private key — decrypted from DB on login, never transmitted */
let cachedPrivateKey: CryptoKey | null = null;

// ─────────────────────────────────────────────────────────────
// IndexedDB configuration
// ─────────────────────────────────────────────────────────────
export const DB_NAME = 'force-encryption';
const DB_VERSION = 3; // v2→3: add 'collab' RSA private-key store (Phase 2 collab)

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialize encryption for a NEW user (signup/registration).
 * Generates a master key and creates both:
 *   - An account-level wrapped key (stored in users.encrypted_master_key)
 *   - A device-level wrapped key  (stored in device_keys table)
 */
export async function initializeEncryptionForNewUser(
  userId: string,
  password: string
): Promise<{
  salt: string;
  encryptedMasterKey: string;
  masterKeyIV: string;
  recoveryCodes: string[];  // Phase 2: plain codes for one-time display
}> {
  const salt = generateSalt();
  const masterKeyBytes = generateMasterKey();
  const masterKey = await importMasterKey(masterKeyBytes);

  // Account-level wrap (legacy-compatible, 100k iterations)
  const passwordKey = await deriveKeyFromPassword(password, salt, LEGACY_PBKDF2_ITERATIONS);
  const encryptedMasterKeyData = await encryptText(uint8ArrayToBase64(masterKeyBytes), passwordKey);

  // Cache in memory
  cachedMasterKey = masterKey;
  cachedUserId = userId;

  // Persist master key in IndexedDB
  await storeMasterKeyInIndexedDB(userId, masterKey);

  // We do NOT call _ensureDeviceKeyRegistered here because the user isn't authenticated yet (and userId might be temporary).
  // Device registration will happen during the subsequent initializeEncryption call after signup or on first login.
  // Phase 2: generate 8 recovery codes, hash them, save hashes to server
  // Returns plain codes for one-time display to the user
  const recoveryCodes = await generateAndSaveRecoveryCodes();

  return {
    salt: uint8ArrayToBase64(salt),
    encryptedMasterKey: encryptedMasterKeyData.ciphertext,
    masterKeyIV: encryptedMasterKeyData.iv,
    recoveryCodes,
  };
}

/**
 * Initialize encryption for an EXISTING user (login).
 * Decrypts the master key using the legacy credential, then triggers
 * the lazy device-key migration in the background.
 *
 * @param userId           - User's ID
 * @param password         - Password or OAuth userId (legacy credential)
 * @param salt             - encryption_salt from DB (base64)
 * @param encryptedMasterKey - encrypted_master_key from DB (base64)
 * @param masterKeyIV      - master_key_iv from DB (base64)
 * @param keyVersion       - users.key_version (1 = legacy, 2 = device-key)
 * @param userSaltRaw      - raw salt Uint8Array (if already parsed, avoids double decode)
 */
export async function initializeEncryption(
  userId: string,
  password: string,
  salt: string,
  encryptedMasterKey: string,
  masterKeyIV: string,
  keyVersion: number = 1,
  userSaltRaw?: Uint8Array
): Promise<void> {
  if (!salt?.trim()) throw new Error('Encryption salt is missing. Please contact support.');
  if (!encryptedMasterKey?.trim()) {
    throw new Error(
      'Master key not found. If you signed up with Google, please log out and log in again.'
    );
  }
  if (!masterKeyIV?.trim()) throw new Error('Master key IV is missing. Please contact support.');

  const saltBytes = userSaltRaw ?? base64ToUint8Array(salt);

  // Choose iteration count based on key_version
  const iterations = keyVersion === 1 ? LEGACY_PBKDF2_ITERATIONS : 600_000;
  const passwordKey = await deriveKeyFromPassword(password, saltBytes, iterations);

  // Decrypt master key
  const masterKeyBase64 = await decryptText(encryptedMasterKey, masterKeyIV, passwordKey);
  const masterKeyBytes = base64ToUint8Array(masterKeyBase64);
  const masterKey = await importMasterKey(masterKeyBytes);

  // Cache in memory
  cachedMasterKey = masterKey;
  cachedUserId = userId;

  // Persist to IndexedDB
  await storeMasterKeyInIndexedDB(userId, masterKey);

  // ── Lazy migration ──────────────────────────────────────────
  // If this device is not yet registered in device_keys, do so silently now.
  _ensureDeviceKeyRegistered(userId, masterKeyBytes, saltBytes).catch((err) =>
    console.warn('[keyManager] Lazy device-key migration failed (non-fatal):', err)
  );

  // Bootstrap collaboration RSA key pair
  import('./collaborationCrypto').then(({ ensureCollabKeyPair }) => {
    ensureCollabKeyPair(userId).catch((err) =>
      console.warn('[keyManager] Collab key bootstrap failed (non-fatal):', err)
    );
  });
}

/**
 * Get the current user's master encryption key.
 * Checks memory cache → IndexedDB → throws if not found.
 */
export async function getEncryptionKey(userId?: string): Promise<CryptoKey> {
  if (cachedMasterKey && (!userId || !cachedUserId || cachedUserId === userId)) return cachedMasterKey;

  const stored = await retrieveMasterKeyFromIndexedDB(userId);
  if (stored) {
    cachedMasterKey = stored;
    if (userId) cachedUserId = userId;
    return stored;
  }

  throw new Error('Encryption key not available. Please log in again.');
}

/**
 * Cache a master CryptoKey in memory and persist it to IndexedDB.
 * Used by the device-approval flow after receiving the master key via ECDH.
 * Does NOT touch the account-level wrapped key — only the local session state.
 */
export async function storeMasterKeyAndCache(userId: string, masterKey: CryptoKey): Promise<void> {
  cachedMasterKey = masterKey;
  cachedUserId = userId;
  await storeMasterKeyInIndexedDB(userId, masterKey);
}

/**
 * Try to restore encryption from cached device secret (fastest path on reload).
 * Falls back to IndexedDB master key cache.
 *
 * Returns true if encryption was successfully restored.
 */
export async function restoreEncryptionFromCache(userId: string): Promise<boolean> {
  try {
    // Fastest path: master key is already cached in IndexedDB
    const masterKey = await retrieveMasterKeyFromIndexedDB(userId);
    if (masterKey) {
      cachedMasterKey = masterKey;
      cachedUserId = userId;
      console.log('[keyManager] ✅ Encryption restored from IndexedDB master-key cache');
      return true;
    }
    console.log('[keyManager] No cached master key found in IndexedDB');
    return false;
  } catch (error) {
    console.error('[keyManager] Error restoring from IndexedDB:', error);
    return false;
  }
}

/**
 * Try to unlock via device secret (Phase 1 fast path).
 * Requires the device to have completed lazy migration so it has a
 * device_keys row and a local deviceSecret.
 *
 * @param userId - User's ID
 * @param saltBase64 - encryption_salt from server (base64)
 * @param wrappedKeyBase64 - encrypted_key from device_keys row (base64)
 * @param wrappedKeyIV - key_iv from device_keys row (base64)
 * @returns true if unlock succeeded
 */
export async function restoreEncryptionFromDeviceSecret(
  userId: string,
  saltBase64: string,
  wrappedKeyBase64: string,
  wrappedKeyIV: string
): Promise<boolean> {
  try {
    const { deviceSecret } = await getDeviceCredentials();
    if (!deviceSecret) return false;

    const saltBytes = base64ToUint8Array(saltBase64);
    const deviceKey = await deriveDeviceKey(deviceSecret, saltBytes);
    const masterKeyBase64 = await decryptText(wrappedKeyBase64, wrappedKeyIV, deviceKey);
    const masterKeyBytes = base64ToUint8Array(masterKeyBase64);
    const masterKey = await importMasterKey(masterKeyBytes);

    cachedMasterKey = masterKey;
    cachedUserId = userId;
    await storeMasterKeyInIndexedDB(userId, masterKey);

    console.log('[keyManager] ✅ Encryption restored from device secret (v2 path)');
    return true;
  } catch (err) {
    console.warn('[keyManager] Device-secret restore failed:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Cleanup callback registry
// Allows collaborationCrypto.ts to register its in-memory
// Map clear without creating a circular import.
// ─────────────────────────────────────────────────────────────
const _clearCallbacks: Array<() => void> = [];

/**
 * Register a callback that fires during clearEncryptionKeys().
 * Used by collaborationCrypto.ts to clear activeJournalKeys.
 */
export function registerClearCallback(cb: () => void): void {
  _clearCallbacks.push(cb);
}

/**
 * Clear all encryption keys from memory and storage. Call on logout.
 *
 * @param options.preserveDeviceCredentials - When true, the 'device' IndexedDB
 *   store is left intact so a "remembered" device can skip re-verification on
 *   the next login. Only the master-key cache ('keys' store) is cleared.
 *   The master key itself is always removed from memory regardless.
 */
export async function clearEncryptionKeys(
  options?: { preserveDeviceCredentials?: boolean }
): Promise<void> {
  cachedMasterKey = null;
  cachedUserId = null;
  cachedPrivateKey = null;

  // Notify registered modules (e.g. collaborationCrypto in-memory cache)
  for (const cb of _clearCallbacks) {
    try {
      cb();
    } catch {
      /* non-fatal */
    }
  }

  const db = await openEncryptionDB();

  if (options?.preserveDeviceCredentials) {
    // Only wipe keys and collab — leave device credentials + trust record intact
    const storeNames = ['keys'];
    if (db.objectStoreNames.contains('collab')) {
      storeNames.push('collab');
    }
    const tx = db.transaction(storeNames, 'readwrite');
    await idbRequest(tx.objectStore('keys').clear());
    if (db.objectStoreNames.contains('collab')) {
      await idbRequest(tx.objectStore('collab').clear());
    }
  } else {
    // Full wipe: master key, device credentials, and collab
    const storeNames = ['keys', 'device'];
    if (db.objectStoreNames.contains('collab')) {
      storeNames.push('collab');
    }
    const tx = db.transaction(storeNames, 'readwrite');
    await idbRequest(tx.objectStore('keys').clear());
    await idbRequest(tx.objectStore('device').clear());
    if (db.objectStoreNames.contains('collab')) {
      await idbRequest(tx.objectStore('collab').clear());
    }
  }

  db.close();
}

/** Returns true if the master key is currently in memory. */
export function isEncryptionInitialized(): boolean {
  return cachedMasterKey !== null;
}

// ─────────────────────────────────────────────────────────────
// Device trust (Phase 2+: "Remember this device")
// ─────────────────────────────────────────────────────────────

/**
 * Mark the current device as trusted for `durationDays` days.
 * Stored alongside device credentials in IndexedDB.
 * clearEncryptionKeys({ preserveDeviceCredentials: true }) must be used
 * on logout so the trust record survives across sessions.
 */
export async function markDeviceAsRemembered(durationDays = 30): Promise<void> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('device', 'readwrite');
    await idbRequest(
      tx.objectStore('device').put({
        id: 'trust-expiry',
        trusted_until: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      })
    );
    db.close();
    console.log(`[keyManager] Device marked as trusted for ${durationDays} days`);
  } catch (err) {
    console.warn('[keyManager] markDeviceAsRemembered failed (non-fatal):', err);
  }
}

/**
 * Returns true if this device has a valid, non-expired trust record.
 * If the record has expired, silently removes it and returns false.
 */
export async function isDeviceRemembered(): Promise<boolean> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('device', 'readonly');
    const record = await idbRequest<{ id: string; trusted_until: number } | undefined>(
      tx.objectStore('device').get('trust-expiry')
    );
    if (!record?.trusted_until) return false;

    if (Date.now() > record.trusted_until) {
      // Expired — wipe credentials so the gate appears on next login
      console.log('[keyManager] Device trust expired — clearing credentials');
      await clearEncryptionKeys({ preserveDeviceCredentials: false });
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the trust flag from IndexedDB. If called, the device will be treated
 * as a new, untrusted device on the next login (or immediate verification).
 * This does NOT delete the master key or ECDH keys from memory.
 */
export async function clearRememberedDevice(): Promise<void> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('device', 'readwrite');
    await idbRequest(tx.objectStore('device').delete('trust-expiry'));
    db.close();
    console.log('[keyManager] Device trust flag cleared');
  } catch (err) {
    console.warn('[keyManager] clearRememberedDevice failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Key pair management (ECDH P-256 for AI data encryption)
// ─────────────────────────────────────────────────────────────

/**
 * Generate an ECDH P-256 key pair for the current user.
 * The private key is encrypted with the master key before returning.
 * Called during signup (for new users) OR on first login (lazy generation
 * for existing users who don't have a key pair yet).
 *
 * @param userId - The current user's ID (must match cachedUserId)
 * @returns GeneratedKeyPair ready to be POSTed to /api/encryption/key-pair
 */
export async function generateUserKeyPair(userId: string): Promise<GeneratedKeyPair> {
  const masterKey = await getEncryptionKey(userId);
  const keyPair = await _generateUserKeyPair(masterKey);
  console.log('[keyManager] ✅ ECDH P-256 key pair generated for user:', userId);
  return keyPair;
}

/**
 * Load and cache the user's ECDH P-256 private key.
 * Called after the master key is loaded (initializeEncryption / restoreEncryption*).
 * Non-fatal: if loading fails, AI data will show as locked.
 *
 * @param encryptedPrivateKey - users.encrypted_private_key (base64)
 * @param privateKeyIv        - users.private_key_iv (base64)
 * @param userId              - Must match cachedUserId
 */
export async function loadAndCachePrivateKey(
  encryptedPrivateKey: string,
  privateKeyIv: string,
  userId: string
): Promise<void> {
  try {
    const masterKey = await getEncryptionKey(userId);
    cachedPrivateKey = await _loadPrivateKey(encryptedPrivateKey, privateKeyIv, masterKey);
    console.log('[keyManager] ✅ ECDH private key loaded and cached');
  } catch (err) {
    console.warn('[keyManager] Failed to load ECDH private key (non-fatal):', err);
    cachedPrivateKey = null;
  }
}

/**
 * Get the cached ECDH P-256 private key.
 * Returns null if the user has no key pair yet or it hasn't been loaded.
 * Callers should gracefully handle null by showing a locked state.
 */
export function getPrivateKey(): CryptoKey | null {
  return cachedPrivateKey;
}

/**
 * Get the stable device ID for this browser from IndexedDB.
 * Returns null if no device credentials have been generated yet
 * (i.e. lazy migration has not completed on this device).
 *
 * This is used by ensureEncryptionReady() to check whether the
 * CURRENT device has a device_keys row, rather than any device.
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    const { deviceId } = await getDeviceCredentials();
    return deviceId;
  } catch {
    return null;
  }
}

/**
 * Re-wrap the master key with a new password.
 * The master key itself is unchanged — only the wrapping changes.
 */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
  salt: string,
  encryptedMasterKey: string,
  masterKeyIV: string
): Promise<{ encryptedMasterKey: string; masterKeyIV: string }> {
  const saltBytes = base64ToUint8Array(salt);

  const oldKey = await deriveKeyFromPassword(oldPassword, saltBytes, LEGACY_PBKDF2_ITERATIONS);
  const masterKeyBase64 = await decryptText(encryptedMasterKey, masterKeyIV, oldKey);
  const masterKeyBytes = base64ToUint8Array(masterKeyBase64);

  const newKey = await deriveKeyFromPassword(newPassword, saltBytes, LEGACY_PBKDF2_ITERATIONS);
  const newEncrypted = await encryptText(masterKeyBase64, newKey);

  const masterKey = await importMasterKey(masterKeyBytes);
  cachedMasterKey = masterKey;
  cachedUserId = userId;
  await storeMasterKeyInIndexedDB(userId, masterKey);

  return {
    encryptedMasterKey: newEncrypted.ciphertext,
    masterKeyIV: newEncrypted.iv,
  };
}

// ─────────────────────────────────────────────────────────────
// Device credentials (deviceId + deviceSecret) — private
// ─────────────────────────────────────────────────────────────

interface DeviceCredentials {
  deviceId: string;
  deviceSecret: string; // base64-encoded 32 bytes
}

/** Retrieve the device credentials from IndexedDB. Returns nulls if not yet set. */
async function getDeviceCredentials(): Promise<{ deviceId: string | null; deviceSecret: string | null }> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('device', 'readonly');
    const req = tx.objectStore('device').get('credentials');
    const result = await idbRequest<DeviceCredentials | undefined>(req);
    db.close();
    return { deviceId: result?.deviceId ?? null, deviceSecret: result?.deviceSecret ?? null };
  } catch {
    return { deviceId: null, deviceSecret: null };
  }
}

/** Persist device credentials to IndexedDB. Idempotent — safe to call multiple times. */
export async function storeDeviceCredentials(creds: DeviceCredentials): Promise<void> {
  const db = await openEncryptionDB();
  const tx = db.transaction('device', 'readwrite');
  await idbRequest(tx.objectStore('device').put({ id: 'credentials', ...creds }));
  db.close();
}

// ─────────────────────────────────────────────────────────────
// Lazy migration helper
// ─────────────────────────────────────────────────────────────

/**
 * Ensure a device_keys row exists for this device.
 * If not, generate a device secret, wrap the master key, and POST to the API.
 * This is idempotent — if the row already exists, the API returns 200 without changes.
 */
async function _ensureDeviceKeyRegistered(
  userId: string,
  masterKeyBytes: Uint8Array,
  saltBytes: Uint8Array
): Promise<void> {
  // 1. Get or create device credentials
  let { deviceId, deviceSecret } = await getDeviceCredentials();

  if (!deviceId || !deviceSecret) {
    const newSecret = generateDeviceSecret();
    deviceId = crypto.randomUUID();
    deviceSecret = uint8ArrayToBase64(newSecret);
    await storeDeviceCredentials({ deviceId, deviceSecret });
    console.log('[keyManager] Generated new device credentials, deviceId:', deviceId);
  }

  // 2. Derive device key and wrap master key
  const deviceKey = await deriveDeviceKey(deviceSecret, saltBytes);
  const { ciphertext: encryptedKey, iv: keyIv } = await encryptText(
    uint8ArrayToBase64(masterKeyBytes),
    deviceKey
  );

  // 3. Detect device metadata (best-effort)
  const deviceName = _detectDeviceName();
  const deviceType = 'web';
  const browser = _detectBrowser();

  // 4. POST to the device registration API
  const res = await fetch('/api/encryption/device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      device_name: deviceName,
      device_type: deviceType,
      browser,
      encrypted_key: encryptedKey,
      key_iv: keyIv,
      salt: uint8ArrayToBase64(saltBytes),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Device registration failed (${res.status}): ${body}`);
  }

  console.log('[keyManager] ✅ Device key registered / confirmed for deviceId:', deviceId);
}

/** Best-effort browser name detection */
function _detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Browser';
}

/** Best-effort device name (OS + browser) */
function _detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  return `${os} — ${_detectBrowser()}`;
}

// ─────────────────────────────────────────────────────────────
// IndexedDB storage helpers (private)
// ─────────────────────────────────────────────────────────────

async function openEncryptionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'userId' });
      }
      // Added in v2: store for deviceId + deviceSecret
      if (!db.objectStoreNames.contains('device')) {
        db.createObjectStore('device', { keyPath: 'id' });
      }
      // Added in v3: RSA private key for collaboration (Phase 2)
      // Stored as a non-extractable CryptoKey object (browser handles serialisation)
      if (!db.objectStoreNames.contains('collab')) {
        db.createObjectStore('collab', { keyPath: 'id' });
      }
    };
  });
}

/** Promisify an IDBRequest */
function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeMasterKeyInIndexedDB(userId: string, masterKey: CryptoKey): Promise<void> {
  const db = await openEncryptionDB();
  const exported = await exportKey(masterKey);
  const tx = db.transaction('keys', 'readwrite');
  await idbRequest(
    tx.objectStore('keys').put({ userId, masterKey: exported, timestamp: Date.now() })
  );
  db.close();
}

async function retrieveMasterKeyFromIndexedDB(userId?: string): Promise<CryptoKey | null> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('keys', 'readonly');
    let stored: any = null;
    if (userId) {
      stored = await idbRequest<any>(tx.objectStore('keys').get(userId));
    } else {
      const allKeys = await idbRequest<any[]>(tx.objectStore('keys').getAll());
      stored = allKeys?.[0] ?? null;
    }
    db.close();
    if (!stored?.masterKey) return null;
    return await importKey(stored.masterKey);
  } catch (error) {
    console.error('[keyManager] Failed to retrieve master key from IndexedDB:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Phase 2: Recovery code generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate 8 recovery codes, hash them client-side, and POST the hashes
 * to /api/encryption/recovery-codes. Returns the plain codes for one-time
 * display to the user. The server NEVER receives plaintext codes.
 *
 * Also creates a dual-wrapping of the master key — one AES-GCM ciphertext
 * per code, each independently unlocking the vault during forgot-password
 * re-keying. Stored in users.recovery_key_wrappings (JSONB array).
 *
 * @returns Array of 8 plain-text recovery codes (XXXX-XXXX format)
 */
export async function generateAndSaveRecoveryCodes(): Promise<string[]> {
  try {
    const { generateRecoveryCodes, hashAllCodes } = await import('../recoveryCode');
    const codes = generateRecoveryCodes(8);
    const hashes = await hashAllCodes(codes);

    // ── Dual-wrap: encrypt master key independently with each recovery code ──
    // Each wrapping uses PBKDF2(code_N, encryption_salt, 600k) → AES-GCM.
    // Any single code can later independently decrypt the master key,
    // matching the user expectation that all 8 codes are interchangeable.
    let recoveryKeyWrappings: { code_index: number; encrypted_key: string; iv: string }[] = [];

    if (cachedMasterKey && cachedUserId) {
      try {
        const masterKeyBase64 = await exportKey(cachedMasterKey);
        const saltRes = await fetch('/api/encryption/salt');
        if (saltRes.ok) {
          const saltData = await saltRes.json();
          const saltBytes = base64ToUint8Array(saltData.salt);

          // Parallel — ~400ms per code but all 8 run concurrently
          recoveryKeyWrappings = await Promise.all(
            codes.map(async (code, index) => {
              const recoveryKey = await deriveKeyFromPassword(
                code.toUpperCase().trim(),
                saltBytes,
                600_000
              );
              const wrapped = await encryptText(masterKeyBase64, recoveryKey);
              return {
                code_index: index,
                encrypted_key: wrapped.ciphertext,
                iv: wrapped.iv,
              };
            })
          );
        }
      } catch (wrapErr) {
        // Non-fatal: codes still work for identity verification;
        // forgot-password rekey will show "regenerate codes" error instead.
        console.warn('[keyManager] Recovery key wrapping failed (non-fatal):', wrapErr);
      }
    }

    const res = await fetch('/api/encryption/recovery-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code_hashes: hashes,
        recovery_key_wrappings: recoveryKeyWrappings.length > 0 ? recoveryKeyWrappings : null,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to save recovery codes (${res.status}): ${body}`);
    }

    console.log('[keyManager] ✅ Recovery codes generated and saved (hashes + dual-wrappings)');
    return codes; // plain codes shown once to the user
  } catch (err) {
    console.warn('[keyManager] Recovery code generation failed (non-fatal):', err);
    return []; // non-fatal: user can generate from Security Center later
  }
}

/**
 * Decrypt the master key using ANY recovery code, then re-wrap it with a
 * new password. Used in the forgot-password flow from a device with no
 * cached master key.
 *
 * Two-phase consume:
 *   Phase 1 — dry-run: verify code identity, receive wrappings. Code NOT consumed.
 *   Phase 2 — consume: called only AFTER rekey-vault succeeds. If rekey fails,
 *             the code remains valid and the user can retry safely.
 *
 * Optimistic concurrency: rekey-vault checks that key_version hasn't changed
 * since we read it. Concurrent rekeys are detected server-side and rejected.
 *
 * @returns { newRecoveryCodes } — freshly generated codes to display to user
 */
export async function rekeyMasterKeyFromRecoveryCode(
  userId: string,
  recoveryCode: string,
  newPassword: string
): Promise<{ newRecoveryCodes: string[] }> {
  const normalizedCode = recoveryCode.toUpperCase().trim();

  // ── Phase 1: dry-run — verify code, get wrappings, do NOT consume ────
  const dryRunRes = await fetch('/api/encryption/verify-recovery-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalizedCode, action: 'dry-run' }),
  });

  if (!dryRunRes.ok) {
    const errData = await dryRunRes.json().catch(() => ({}));
    throw new Error(errData.error ?? 'Invalid recovery code');
  }

  const data = await dryRunRes.json();

  const wrappings: { code_index: number; encrypted_key: string; iv: string }[] =
    data.recovery_key_wrappings ?? [];

  if (wrappings.length === 0) {
    throw new Error(
      'Your recovery codes were generated before vault re-keying was added. ' +
        'Please regenerate your recovery codes from a device where your journals are accessible.'
    );
  }

  const saltBytes = base64ToUint8Array(data.encryption_salt);

  // ── Derive recovery key ONCE (outside loop — PBKDF2 is expensive) ────
  // All 8 wrappings use the same code as the PBKDF2 password; only the
  // ciphertext/IV differ per wrapping. We try each until one decrypts.
  const recoveryKey = await deriveKeyFromPassword(normalizedCode, saltBytes, 600_000);

  let masterKeyBase64: string | null = null;
  for (const wrapping of wrappings) {
    try {
      masterKeyBase64 = await decryptText(
        wrapping.encrypted_key,
        wrapping.iv,
        recoveryKey
      );
      break; // found the wrapping that matches this code
    } catch {
      continue;
    }
  }

  if (!masterKeyBase64) {
    throw new Error(
      'Recovery code verified but vault decryption failed. ' +
        'This may indicate corrupted recovery wrappings. Please contact support.'
    );
  }

  const masterKeyBytes = base64ToUint8Array(masterKeyBase64);

  // ── Re-wrap master key with the new password ──────────────────────────
  const newPasswordKey = await deriveKeyFromPassword(newPassword, saltBytes, 600_000);
  const { ciphertext: newEncryptedKey, iv: newKeyIV } = await encryptText(
    masterKeyBase64,
    newPasswordKey
  );

  // ── Upload new wrapping + revoke other devices (optimistic concurrency) ──
  // We pass the key_version we read so the server can reject a concurrent rekey
  // that already bumped the version. If it returns 409, user can retry.
  const currentDeviceId = await getDeviceId();
  const expectedKeyVersion = data.key_version ?? 1;

  const rekeyRes = await fetch('/api/encryption/rekey-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encrypted_master_key: newEncryptedKey,
      master_key_iv: newKeyIV,
      new_key_version: 2,
      expected_key_version: expectedKeyVersion,  // optimistic concurrency check
      revoke_other_devices: true,
      current_device_id: currentDeviceId,
      invalidate_recovery_wrappings: true,        // codes will be regenerated below
    }),
  });

  if (!rekeyRes.ok) {
    // Recovery code was NOT consumed — user can retry.
    const errData = await rekeyRes.json().catch(() => ({}));
    if (rekeyRes.status === 409) {
      throw new Error(
        'Another device just updated your vault at the same time. Please try again.'
      );
    }
    throw new Error(errData.error ?? 'Failed to update vault. Please try again.');
  }

  // ── Phase 2: consume the code NOW that rekey succeeded ────────────────
  // Fire-and-forget: intentional. If this request is lost (tab closed,
  // network blip), the code remains unconsumed — a minor security cost
  // vs. the alternative of burning a code with no successful rekey.
  fetch('/api/encryption/verify-recovery-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalizedCode, action: 'consume' }),
  }).catch(() => {
    console.warn('[rekeyMasterKey] Code consumption failed (non-fatal — rekey already succeeded)');
  });

  // ── Cache master key locally ──────────────────────────────────────────
  const masterKey = await importMasterKey(masterKeyBytes);
  cachedMasterKey = masterKey;
  cachedUserId = userId;
  await storeMasterKeyInIndexedDB(userId, masterKey);

  // ── Register this device with the new master key ──────────────────────
  await _ensureDeviceKeyRegistered(userId, masterKeyBytes, saltBytes);

  // ── Force-regenerate recovery codes with fresh dual-wrapping ──────────
  // Old codes are invalidated server-side (recovery_key_wrappings = NULL).
  // New codes are wrapped with the current (new-password) master key state.
  const newRecoveryCodes = await generateAndSaveRecoveryCodes();

  console.log('[keyManager] ✅ Vault re-keyed via recovery code. New codes generated.');
  return { newRecoveryCodes };
}

// ─────────────────────────────────────────────────────────────
// Phase 5: OAuth Security Upgrade
// ─────────────────────────────────────────────────────────────

/**
 * Re-wrap the master key with a user-chosen password and set it
 * as their Supabase auth password.
 *
 * Called when an OAuth user sets a password for the first time from
 * the Security Center. The master key is obtained from cache or decrypted
 * using the correct credential (auto-credential if auto-upgrade already ran,
 * otherwise the legacy userId credential). The key is then re-wrapped with
 * the new password and stored via /api/encryption/upgrade-oauth.
 * Finally, /api/user/set-password updates Supabase auth.
 *
 * @param userId           - User's UUID (used as legacy OAuth credential)
 * @param newPassword      - Password chosen by the user (≥8 chars)
 * @param saltBase64       - encryption_salt from DB (base64)
 * @param encryptedMasterKey - current encrypted_master_key from DB (base64)
 * @param masterKeyIV      - current master_key_iv from DB (base64)
 * @param keyVersion       - current key_version (1 = legacy, 2 = auto/password upgraded)
 */
export async function setPasswordAndUpgradeKey(
  userId: string,
  newPassword: string,
  saltBase64: string,
  encryptedMasterKey: string,
  masterKeyIV: string,
  keyVersion: number
): Promise<void> {
  const saltBytes = base64ToUint8Array(saltBase64);

  // Step 1: Obtain the raw master key bytes.
  //
  // Priority order:
  //   A) In-memory cache (fastest; always correct regardless of vault state)
  //   B) Auto-credential from IndexedDB (if auto-upgrade already ran: key_version=2, vault_mode=auto)
  //   C) Legacy userId credential (original OAuth path, key_version=1)
  //
  // This handles the race where autoUpgradeOAuthKey() ran silently in the
  // background and re-wrapped the account-level key with a random credential
  // before the user clicked "Set password".
  let masterKeyBytes: Uint8Array;

  // Path A: master key is already in memory — no decryption needed.
  if (cachedMasterKey && cachedUserId === userId) {
    console.log('[setPasswordAndUpgradeKey] Using cached master key (path A)');
    const masterKeyBase64Cached = await exportKey(cachedMasterKey);
    masterKeyBytes = base64ToUint8Array(masterKeyBase64Cached);
  } else {
    // Path B: auto-upgrade already ran → key is wrapped with random auto-credential.
    let decryptedBase64: string | null = null;

    if (keyVersion >= 2) {
      try {
        const autoCredential = await getAutoCredential();
        if (autoCredential) {
          console.log('[setPasswordAndUpgradeKey] Trying auto-credential (path B, keyVersion=2)');
          const autoKey = await deriveDeviceKey(autoCredential, saltBytes);
          decryptedBase64 = await decryptText(encryptedMasterKey, masterKeyIV, autoKey);
        }
      } catch {
        // Auto-credential either not present or wrong — fall through to path C.
        console.warn('[setPasswordAndUpgradeKey] Auto-credential decrypt failed, falling back to userId');
      }
    }

    // Path C: original legacy credential (userId as password, key_version=1).
    if (decryptedBase64 === null) {
      const legacyIterations = keyVersion === 1 ? LEGACY_PBKDF2_ITERATIONS : 600_000;
      const oldKey = await deriveKeyFromPassword(userId, saltBytes, legacyIterations);
      decryptedBase64 = await decryptText(encryptedMasterKey, masterKeyIV, oldKey);
    }

    masterKeyBytes = base64ToUint8Array(decryptedBase64);
  }

  const masterKeyBase64 = uint8ArrayToBase64(masterKeyBytes);

  // Step 2: Re-wrap master key with the new password (600k iterations)
  const newPasswordKey = await deriveKeyFromPassword(newPassword, saltBytes, 600_000);
  const { ciphertext: newEncryptedKey, iv: newKeyIV } = await encryptText(
    masterKeyBase64,
    newPasswordKey
  );

  // Step 3: Store re-wrapped key on server via upgrade-oauth
  const upgradeRes = await fetch('/api/encryption/upgrade-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encrypted_master_key: newEncryptedKey,
      master_key_iv: newKeyIV,
      vault_mode: 'password',
    }),
  });

  if (!upgradeRes.ok) {
    const body = await upgradeRes.text();
    throw new Error(`Failed to upgrade OAuth key (${upgradeRes.status}): ${body}`);
  }

  // Step 4: Set the password in Supabase auth
  const setPasswordRes = await fetch('/api/user/set-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });

  if (!setPasswordRes.ok) {
    const body = await setPasswordRes.text();
    throw new Error(`Failed to set Supabase auth password (${setPasswordRes.status}): ${body}`);
  }

  // Step 5: Update in-memory master key cache (key itself unchanged)
  const masterKey = await importMasterKey(masterKeyBytes);
  cachedMasterKey = masterKey;
  cachedUserId = userId;
  await storeMasterKeyInIndexedDB(userId, masterKey);

  console.log('[keyManager] ✅ Phase 5: OAuth master key upgraded with user password');
}

/**
 * Phase 5 Option A: Silently re-wrap the account-level master key with a
 * secure random 32-byte credential instead of the insecure userId.
 *
 * Only runs if:
 *   - key_version is still 1 (not yet upgraded)
 *   - The device has already completed lazy migration (device_keys row exists)
 *   - The master key is available in memory or IndexedDB
 *
 * The random credential is stored in IndexedDB. If the user later sets a
 * real password, setPasswordAndUpgradeKey() replaces this wrapping.
 *
 * @param userId           - User's UUID (old credential to decrypt with)
 * @param saltBase64       - encryption_salt from DB (base64)
 * @param encryptedMasterKey - current encrypted_master_key from DB (base64)
 * @param masterKeyIV      - current master_key_iv from DB (base64)
 */
export async function autoUpgradeOAuthKey(
  userId: string,
  saltBase64: string,
  encryptedMasterKey: string,
  masterKeyIV: string
): Promise<void> {
  try {
    const saltBytes = base64ToUint8Array(saltBase64);

    // Decrypt with old userId credential (100k iterations, key_version=1)
    const oldKey = await deriveKeyFromPassword(userId, saltBytes, LEGACY_PBKDF2_ITERATIONS);
    const masterKeyBase64 = await decryptText(encryptedMasterKey, masterKeyIV, oldKey);

    // Generate a secure random 32-byte credential
    const randomCredential = generateDeviceSecret(); // reuse the same generator
    const credentialBase64 = uint8ArrayToBase64(randomCredential);

    // Store the random credential in IndexedDB for future reference
    await storeAutoCredential(credentialBase64);

    // Re-wrap master key with the random credential (600k iterations)
    const newKey = await deriveDeviceKey(credentialBase64, saltBytes);
    const { ciphertext: newEncryptedKey, iv: newKeyIV } = await encryptText(
      masterKeyBase64,
      newKey
    );

    // Store on server
    const res = await fetch('/api/encryption/upgrade-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_master_key: newEncryptedKey,
        master_key_iv: newKeyIV,
        vault_mode: 'auto',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`autoUpgrade failed (${res.status}): ${body}`);
    }

    console.log('[keyManager] ✅ Phase 5 Option A: OAuth master key auto-upgraded silently');
  } catch (err) {
    // Non-fatal: device key is already secure; account-level key will be upgraded
    // on next successful opportunity.
    console.warn('[keyManager] autoUpgradeOAuthKey failed (non-fatal):', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Phase 5 IndexedDB: auto-credential storage
// ─────────────────────────────────────────────────────────────

async function storeAutoCredential(credentialBase64: string): Promise<void> {
  const db = await openEncryptionDB();
  const tx = db.transaction('device', 'readwrite');
  await idbRequest(tx.objectStore('device').put({ id: 'auto-credential', value: credentialBase64 }));
  db.close();
}

export async function getAutoCredential(): Promise<string | null> {
  try {
    const db = await openEncryptionDB();
    const tx = db.transaction('device', 'readonly');
    const result = await idbRequest<{ id: string; value: string } | undefined>(
      tx.objectStore('device').get('auto-credential')
    );
    db.close();
    return result?.value ?? null;
  } catch {
    return null;
  }
}

