// apps/web/utils/encryption/index.ts
/**
 * Encryption Utilities — Main Export
 *
 * Import from here for convenience:
 *   import { encryptJournalEntry, decryptJournalEntry } from '@/utils/encryption';
 *
 * Phase 1 (Security Architecture v2):
 *   - Device-secret wrapping with 600,000 PBKDF2 iterations
 *   - Lazy migration on login for all existing users
 *   - key_version propagated from server to pick correct iteration count
 */

// ── Core crypto functions ─────────────────────────────────────
export {
  deriveKeyFromPassword,
  deriveDeviceKey,
  generateSalt,
  generateIV,
  generateDeviceSecret,
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  exportKey,
  importKey,
  uint8ArrayToBase64,
  base64ToUint8Array,
  LEGACY_PBKDF2_ITERATIONS,
  DEVICE_PBKDF2_ITERATIONS,
} from './crypto';

// ── Key management ────────────────────────────────────────────
export {
  initializeEncryption,
  initializeEncryptionForNewUser,
  getEncryptionKey,
  clearEncryptionKeys,
  isEncryptionInitialized,
  restoreEncryptionFromCache,
  restoreEncryptionFromDeviceSecret,
  storeMasterKeyAndCache,
  changePassword,
  generateAndSaveRecoveryCodes, // Phase 2
  getDeviceId,                  // Phase 1: for device-specific status checks
  markDeviceAsRemembered,       // Phase 2+: remember device across logout
  isDeviceRemembered,           // Phase 2+: check 30-day trust
  rekeyMasterKeyFromRecoveryCode, // Forgot-password vault re-keying
  setPasswordAndUpgradeKey,     // Phase 5: OAuth user sets password for first time
  autoUpgradeOAuthKey,          // Phase 5: silent Option A auto-migration
  getAutoCredential,            // Phase 5: retrieve auto-upgrade credential from IndexedDB
  // Phase 3 (AI encryption): ECDH P-256 key pair management
  generateUserKeyPair,
  loadAndCachePrivateKey,
  getPrivateKey,
} from './keyManager';

// ── Status types ──────────────────────────────────────────────
/**
 * 'ready'               — master key in memory, encryption is live
 * 'needs_unlock'         — email user must supply password to decrypt
 * 'new_device'           — V2 user on an unregistered device; must verify
 *                          via recovery code / TOTP / device approval
 * 'legacy_otp_required'  — V1 user detected; must verify via email OTP
 *                          before vault unlock (migration gate)
 * 'error'               — unexpected failure
 */
export type EncryptionReadinessStatus =
  | 'ready'
  | 'needs_unlock'
  | 'new_device'
  | 'legacy_otp_required'
  | 'error';

export interface EncryptionReadinessResult {
  ready: boolean;
  status: EncryptionReadinessStatus;
  reason?: string;
  userId?: string;
  isOAuthUser?: boolean;
  /** Whether the user has an active TOTP authenticator configured */
  hasTOTP?: boolean;
  /** Whether the user has active (unused) recovery codes */
  hasRecoveryCode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Phase 3 helper: load or lazily generate the ECDH key pair
// ─────────────────────────────────────────────────────────────

/**
 * Load the cached private key from the server data, OR lazily generate
 * a key pair if the user doesn't have one yet.
 *
 * Called non-fatally at every successful master-key restore point.
 * The master key MUST already be in memory when this is called.
 *
 * @param userId              - Current user ID
 * @param encryptedPrivateKey - users.encrypted_private_key (null if no key pair yet)
 * @param privateKeyIv        - users.private_key_iv (null if no key pair yet)
 */
async function _loadOrGenerateKeyPair(
  userId: string,
  encryptedPrivateKey: string | null | undefined,
  privateKeyIv: string | null | undefined
): Promise<void> {
  try {
    const { loadAndCachePrivateKey, generateUserKeyPair } = await import('./keyManager');

    if (encryptedPrivateKey && privateKeyIv) {
      // Key pair already exists — decrypt and cache the private key
      await loadAndCachePrivateKey(encryptedPrivateKey, privateKeyIv, userId);
      console.log('[Phase 3] ✅ Private key loaded and cached');
    } else {
      // No key pair yet — generate one lazily in the background
      // This happens for all existing users on their first login after the upgrade
      console.log('[Phase 3] No key pair found — generating lazily...');
      const keyPair = await generateUserKeyPair(userId);

      // Upload to server
      const uploadRes = await fetch('/api/encryption/key-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_key: JSON.stringify(keyPair.publicKeyJwk),
          encrypted_private_key: keyPair.encryptedPrivateKey,
          private_key_iv: keyPair.privateKeyIv,
        }),
      });

      if (uploadRes.ok) {
        // Now load the private key into cache from what we just generated
        await loadAndCachePrivateKey(keyPair.encryptedPrivateKey, keyPair.privateKeyIv, userId);
        console.log('[Phase 3] ✅ Key pair generated and private key cached (lazy generation)');
      } else {
        console.warn('[Phase 3] Key pair upload failed (non-fatal):', await uploadRes.text());
      }
    }
  } catch (err) {
    // Non-fatal: AI data will show as locked until the next login
    console.warn('[Phase 3] _loadOrGenerateKeyPair failed (non-fatal):', err);
  }
}

/**
 * Fetch the key pair from the server and load it into cache.
 * Used on page reload when the master key is restored from IndexedDB,
 * to ensure the private key is also available for AI data decryption.
 */
async function _fetchAndLoadKeyPair(userId: string): Promise<void> {
  try {
    const { getPrivateKey } = await import('./keyManager');
    if (getPrivateKey()) return; // already loaded

    const res = await fetch('/api/encryption/key-pair');
    if (res.ok) {
      const data = await res.json();
      await _loadOrGenerateKeyPair(userId, data.encrypted_private_key, data.private_key_iv);
    }
  } catch (err) {
    console.warn('[Phase 3] Background key pair fetch failed:', err);
  }
}

/**
 * Ensure the user's ECDH key pair is loaded in memory for AI decryption.
 * Can be safely called anytime; no-ops if already loaded.
 */
export async function ensureKeyPairLoaded(userId?: string): Promise<void> {
  const { getPrivateKey } = await import('./keyManager');
  if (getPrivateKey()) return;

  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const res = await fetch('/api/user/current');
      if (res.ok) {
        const data = await res.json();
        targetUserId = data?.user?.id;
      }
    } catch { /* ignore */ }
  }

  if (targetUserId) {
    await _fetchAndLoadKeyPair(targetUserId);
  }
}

// ─────────────────────────────────────────────────────────────
// OAuth auto-initialisation (legacy path)
// ─────────────────────────────────────────────────────────────

/**
 * Auto-initialize encryption for OAuth (Google) users.
 * Fetches the master key data from the server, decrypts using the
 * legacy credential (userId as password), then triggers lazy migration.
 * Phase 3: also loads/generates the ECDH key pair after master key restore.
 *
 * @param userId - User's ID
 */
export async function autoInitializeEncryptionForOAuthUser(userId: string): Promise<void> {
  console.log('[autoInit] Starting for user:', userId);

  const response = await fetch('/api/encryption/salt');
  if (!response.ok) {
    throw new Error('Failed to fetch encryption data');
  }

  const data = await response.json();
  const keyVersion: number = data.key_version ?? 1;
  const vaultMode: string = data.oauth_vault_mode ?? 'none';
  const twoFactorEnabled: boolean = Boolean(data.two_factor_enabled);

  console.log('[autoInit] Received encryption data:', {
    hasSalt: !!data.salt,
    hasEncryptedMasterKey: !!data.encrypted_master_key,
    hasMasterKeyIV: !!data.master_key_iv,
    hasKeyPair: !!data.has_key_pair,
    keyVersion,
    vaultMode,
    twoFactorEnabled,
  });

  const {
    initializeEncryption,
    initializeEncryptionForNewUser,
    getAutoCredential,
    restoreEncryptionFromDeviceSecret,
  } = await import('./keyManager');

  // ── Fast path: try device-secret restore first ───────────────────────────
  try {
    const { getDeviceId } = await import('./keyManager');
    const currentDeviceId = await getDeviceId();
    if (currentDeviceId) {
      const deviceRes = await fetch(
        `/api/encryption/device-status?device_id=${encodeURIComponent(currentDeviceId)}`
      );
      if (deviceRes.ok) {
        const deviceData = await deviceRes.json();
        if (deviceData.hasDeviceKey && deviceData.encrypted_key && deviceData.key_iv) {
          const restored = await restoreEncryptionFromDeviceSecret(
            userId,
            data.salt,
            deviceData.encrypted_key,
            deviceData.key_iv
          );
          if (restored) {
            console.log('[autoInit] ✅ Encryption restored via device secret (fast path)');
            // Phase 3: load/generate the ECDH key pair after restoring the master key
            _loadOrGenerateKeyPair(userId, data.encrypted_private_key, data.private_key_iv)
              .catch((err) => console.warn('[autoInit] Key pair load failed (non-fatal):', err));
            return;
          }
        }
      }
    }
  } catch (deviceErr) {
    console.warn('[autoInit] Device-secret fast path failed (non-fatal):', deviceErr);
  }

  // If user has NO encryption setup at all (missing salt or master key)
  if (!data.salt || !data.encrypted_master_key || !data.master_key_iv) {
    if (!twoFactorEnabled) {
      console.log('[autoInit] Master key missing for OAuth user without 2FA — generating fresh key');
      const newKeyData = await initializeEncryptionForNewUser(userId, userId);
      await fetch('/api/encryption/auto-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: newKeyData.salt,
          encrypted_master_key: newKeyData.encryptedMasterKey,
          master_key_iv: newKeyData.masterKeyIV,
          force_reset: true,
        }),
      });
      _loadOrGenerateKeyPair(userId, data.encrypted_private_key, data.private_key_iv)
        .catch((err) => console.warn('[autoInit] Key pair load failed (non-fatal):', err));
      return;
    } else {
      throw new Error('Master key not found. Please verify device or contact support.');
    }
  }

  // If password vault mode is active and user has 2FA enabled, they must provide their password
  if (keyVersion >= 2 && vaultMode === 'password' && twoFactorEnabled) {
    throw new Error('This account uses 2-Step Verification with a password. Please enter your password to unlock.');
  }

  // Attempt decryption using available credentials
  let initialized = false;

  // 1. If vault_mode === 'auto', try auto-credential if present
  if (keyVersion >= 2 && vaultMode === 'auto') {
    try {
      const autoCredential = await getAutoCredential();
      if (autoCredential) {
        await initializeEncryption(
          userId,
          autoCredential,
          data.salt,
          data.encrypted_master_key,
          data.master_key_iv,
          keyVersion
        );
        initialized = true;
        console.log('[autoInit] ✅ Initialized using auto-credential');
      }
    } catch (autoErr) {
      console.warn('[autoInit] Auto-credential decryption failed, falling back to userId:', autoErr);
    }
  }

  // 2. Try default OAuth credential (userId) with current keyVersion
  if (!initialized) {
    try {
      await initializeEncryption(
        userId,
        userId,
        data.salt,
        data.encrypted_master_key,
        data.master_key_iv,
        keyVersion
      );
      initialized = true;
    } catch {
      // 3. Fallback: try userId with legacy iterations (key_version = 1)
      if (keyVersion !== 1) {
        try {
          await initializeEncryption(
            userId,
            userId,
            data.salt,
            data.encrypted_master_key,
            data.master_key_iv,
            1
          );
          initialized = true;
        } catch {
          // Both failed
        }
      }
    }
  }

  // 4. If decryption failed but user has NO 2-step verification enabled, auto-repair
  if (!initialized) {
    if (!twoFactorEnabled) {
      console.log('[autoInit] Re-initializing fresh master key for OAuth user without 2FA');
      const newKeyData = await initializeEncryptionForNewUser(userId, userId);
      await fetch('/api/encryption/auto-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: newKeyData.salt,
          encrypted_master_key: newKeyData.encryptedMasterKey,
          master_key_iv: newKeyData.masterKeyIV,
          force_reset: true,
        }),
      });
      initialized = true;
    } else {
      throw new Error('Device verification required to unlock your journals on this new device.');
    }
  }

  console.log('[autoInit] ✅ Encryption initialized');

  // Phase 3: load/generate the ECDH key pair now that the master key is in memory
  _loadOrGenerateKeyPair(userId, data.encrypted_private_key, data.private_key_iv)
    .catch((err) => console.warn('[autoInit] Key pair load failed (non-fatal):', err));
}

// ─────────────────────────────────────────────────────────────
// ensureEncryptionReady — primary entry point on page load
// ─────────────────────────────────────────────────────────────

/**
 * Ensure encryption keys are available for the current session.
 *
 * Resolution order:
 *   1. In-memory cache (fastest)
 *   2. IndexedDB master-key cache (fast, survives tab close)
 *   3. For users WITHOUT 2-step verification: seamless silent unlock
 *   4. For users WITH 2-step verification: verify via device approval / recovery code
 */
export async function ensureEncryptionReady(
  options: { userId?: string; isOAuthUser?: boolean } = {}
): Promise<EncryptionReadinessResult> {
  const { isEncryptionInitialized, restoreEncryptionFromCache } = await import('./keyManager');

  // 1. Already in memory
  if (isEncryptionInitialized()) {
    return { ready: true, status: 'ready' };
  }

  // Resolve userId and auth provider if not provided
  let resolvedUserId = options.userId;
  let resolvedIsOAuthUser = options.isOAuthUser;

  if (!resolvedUserId || typeof resolvedIsOAuthUser !== 'boolean') {
    try {
      const res = await fetch('/api/user/current');
      if (res.ok) {
        const data = await res.json();
        resolvedUserId = resolvedUserId ?? data?.user?.id ?? undefined;
        if (typeof resolvedIsOAuthUser !== 'boolean') {
          resolvedIsOAuthUser = data?.user?.app_metadata?.provider !== 'email';
        }
      }
    } catch (error) {
      return {
        ready: false,
        status: 'error',
        reason: error instanceof Error ? error.message : 'user_fetch_failed',
      };
    }
  }

  if (!resolvedUserId) {
    return { ready: false, status: 'needs_unlock', reason: 'missing_user' };
  }

  try {
    // 2. IndexedDB master-key cache
    const restored = await restoreEncryptionFromCache(resolvedUserId);
    if (restored) {
      // Phase 3: load the private key in the background so it's ready for AI data
      _fetchAndLoadKeyPair(resolvedUserId).catch((err) =>
        console.warn('[ensureEncryptionReady] Key pair fetch failed:', err)
      );

      return {
        ready: true,
        status: 'ready',
        userId: resolvedUserId,
        isOAuthUser: resolvedIsOAuthUser,
      };
    }

    // 3. Check device & 2FA status
    try {
      const { getDeviceId } = await import('./keyManager');
      const currentDeviceId = await getDeviceId();

      const deviceStatusUrl = currentDeviceId
        ? `/api/encryption/device-status?device_id=${encodeURIComponent(currentDeviceId)}`
        : '/api/encryption/device-status';
      const deviceRes = await fetch(deviceStatusUrl);
      const deviceData = deviceRes.ok ? await deviceRes.json() : null;
      const twoFactorEnabled = Boolean(deviceData?.two_factor_enabled);

      // ── IF USER HAS NOT ENABLED 2-STEP VERIFICATION ──────────────────
      // Users without 2-step verification should NEVER be blocked by the New Device gate.
      if (!twoFactorEnabled) {
        if (resolvedIsOAuthUser) {
          try {
            await autoInitializeEncryptionForOAuthUser(resolvedUserId);
            return {
              ready: true,
              status: 'ready',
              userId: resolvedUserId,
              isOAuthUser: resolvedIsOAuthUser,
            };
          } catch (err) {
            console.warn('[ensureEncryptionReady] OAuth auto-init error (fail open):', err);
            return {
              ready: true,
              status: 'ready',
              userId: resolvedUserId,
              isOAuthUser: resolvedIsOAuthUser,
            };
          }
        } else {
          // Email user without 2FA: try device secret fast path if available
          if (deviceData?.hasDeviceKey && deviceData?.encrypted_key && deviceData?.key_iv && currentDeviceId) {
            const saltRes = await fetch('/api/encryption/salt');
            if (saltRes.ok) {
              const saltData = await saltRes.json();
              if (saltData.salt) {
                const { restoreEncryptionFromDeviceSecret } = await import('./keyManager');
                const restored = await restoreEncryptionFromDeviceSecret(
                  resolvedUserId,
                  saltData.salt,
                  deviceData.encrypted_key,
                  deviceData.key_iv
                );
                if (restored) {
                  _fetchAndLoadKeyPair(resolvedUserId).catch(() => {});
                  return { ready: true, status: 'ready', userId: resolvedUserId, isOAuthUser: false };
                }
              }
            }
          }
          // If master key is not restored, let page load and let login transitCredential / unlock modal handle it
          return { ready: false, status: 'needs_unlock', userId: resolvedUserId, isOAuthUser: false };
        }
      }

      // ── IF USER HAS ENABLED 2-STEP VERIFICATION ──────────────────────
      // Legacy V1 user without modern keys
      if (deviceData?.isLegacyUser) {
        return {
          ready: false,
          status: 'legacy_otp_required',
          reason: 'legacy_user',
          userId: resolvedUserId,
          isOAuthUser: resolvedIsOAuthUser,
        };
      }

      // Fast path: try device-secret restore
      if (currentDeviceId && deviceData?.hasDeviceKey && deviceData?.encrypted_key && deviceData?.key_iv) {
        const saltRes = await fetch('/api/encryption/salt');
        if (saltRes.ok) {
          const saltData = await saltRes.json();
          if (saltData.salt) {
            const { restoreEncryptionFromDeviceSecret } = await import('./keyManager');
            const restored = await restoreEncryptionFromDeviceSecret(
              resolvedUserId,
              saltData.salt,
              deviceData.encrypted_key,
              deviceData.key_iv
            );
            if (restored) {
              _fetchAndLoadKeyPair(resolvedUserId).catch(() => {});
              return {
                ready: true,
                status: 'ready',
                userId: resolvedUserId,
                isOAuthUser: resolvedIsOAuthUser,
              };
            }
          }
        }
      }

      // If OAuth user with 2FA, try auto-init (e.g. if device already recognized)
      if (resolvedIsOAuthUser) {
        try {
          await autoInitializeEncryptionForOAuthUser(resolvedUserId);
          return {
            ready: true,
            status: 'ready',
            userId: resolvedUserId,
            isOAuthUser: resolvedIsOAuthUser,
          };
        } catch (err: any) {
          console.log('[ensureEncryptionReady] OAuth user with 2FA requires device verification:', err?.message);
        }
      }

      // 2FA active and device not trusted → route to NewDeviceVerification gate
      return {
        ready: false,
        status: 'new_device',
        reason: 'device_verification_required',
        userId: resolvedUserId,
        isOAuthUser: resolvedIsOAuthUser,
        hasTOTP: Boolean(deviceData?.hasTOTP),
        hasRecoveryCode: Boolean(deviceData?.hasRecoveryCode),
      };
    } catch (deviceErr) {
      console.warn('[ensureEncryptionReady] Device check error:', deviceErr);
      if (resolvedIsOAuthUser) {
        try {
          await autoInitializeEncryptionForOAuthUser(resolvedUserId);
          return { ready: true, status: 'ready', userId: resolvedUserId, isOAuthUser: true };
        } catch {
          return { ready: true, status: 'ready', userId: resolvedUserId, isOAuthUser: true };
        }
      }
      return { ready: false, status: 'needs_unlock', userId: resolvedUserId, isOAuthUser: false };
    }
  } catch (error) {
    return {
      ready: false,
      status: 'needs_unlock',
      reason: error instanceof Error ? error.message : 'encryption_init_failed',
      userId: resolvedUserId,
      isOAuthUser: resolvedIsOAuthUser,
    };
  }
}

// ── Journal-specific encryption ─────────────────────────────────────────────
export {
  encryptJournalEntry,
  decryptJournalEntry,
  encryptJournalEntries,
  decryptJournalEntries,
  encryptMediaFile,
  decryptMediaFile,
  createDecryptedMediaURL,
  revokeDecryptedMediaURL,
} from './journalEncryption';

export type { EncryptedJournalEntry, DecryptedJournalEntry } from './journalEncryption';

// ── Hybrid ECIES crypto (AI data encryption — Phase 3) ─────────────────────
export {
  // Core ECIES primitives
  serverHybridEncrypt,
  serverEncryptField,
  serverEncryptFields,
  smartDecrypt,
  smartDecryptJson,
  // Key pair utilities
  generateUserKeyPair as generateKeyPair,
  loadPrivateKey,
  parsePublicKeyFromDb,
  parseECIESEnvelope,
} from './hybridCrypto';

export type { ECIESEnvelope, HybridEncryptResult, GeneratedKeyPair } from './hybridCrypto';

// ── Per-table AI data encrypt/decrypt helpers ───────────────────────────
export {
  serverEncryptAudioAnalysis,
  decryptAudioAnalysis,
  serverEncryptAiPromptCache,
  decryptAiPromptCache,
  serverEncryptAiTodo,
  decryptAiTodo,
  serverEncryptCognitionResponse,
  decryptCognitionResponse,
  serverEncryptJournalEmbedding,
  decryptJournalEmbedding,
} from './aiDataEncryption';

export type {
  AudioAnalysisEncryptedPatch,
  AudioAnalysisDecrypted,
  AiPromptCacheEncryptedPatch,
  AiTodoEncryptedPatch,
  AiTodoDecrypted,
  CognitionResponseEncryptedPatch,
  CognitionResponseDecrypted,
  JournalEmbeddingEncryptedPatch,
  JournalEmbeddingDecrypted,
} from './aiDataEncryption';
