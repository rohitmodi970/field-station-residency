// apps/web/utils/encryption/hybridCrypto.ts
/**
 * Hybrid Asymmetric + Symmetric Encryption — ECIES-like scheme
 *
 * Implements the "packed JSON envelope" approach (Option A):
 *   - Data IV is stored in the *_iv column (same pattern as journals)
 *   - The *_encrypted column stores either:
 *       v1  → plain AES-256-GCM ciphertext (client-side writes, existing pattern)
 *       v2  → packed JSON ECIES envelope (server-side writes by the server using
 *              the user's ECDH P-256 public key)
 *
 * Envelope format (v2):
 * ┌──────────────────────────────────────────────────────────┐
 * │ {                                                        │
 * │   "v": 2,                                               │
 * │   "epk": "<base64 ECDH P-256 ephemeral public key JWK>",│
 * │   "wk":  "<base64 AES-wrapped ephemeral AES key>",      │
 * │   "wiv": "<base64 12-byte IV for key wrapping>",        │
 * │   "ct":  "<base64 AES-256-GCM ciphertext of plaintext>" │
 * │ }                                                        │
 * └──────────────────────────────────────────────────────────┘
 *
 * The *_iv column stores the 12-byte data IV (base64) — same as v1.
 *
 * SERVER-SIDE (Node.js):
 *   Uses Node.js `crypto` module (WebCrypto subset available in modern Node).
 *   Called from API route handlers. Public key is fetched from DB once per
 *   request and passed in as a JWK string.
 *
 * CLIENT-SIDE (browser):
 *   Uses Web Crypto API (window.crypto.subtle).
 *   Private key is decrypted from DB using the master key, then cached in memory.
 *
 * ZERO-KNOWLEDGE GUARANTEE:
 *   The server only ever holds the PUBLIC key. The private key is encrypted
 *   with the user's master key and only decryptable by the client.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** ECIES packed envelope stored in the *_encrypted column when v === 2 */
export interface ECIESEnvelope {
  v: 2;
  /** Ephemeral ECDH P-256 public key — JWK format, base64-encoded JSON string */
  epk: string;
  /** AES-256-GCM encrypted ephemeral AES key (base64) */
  wk: string;
  /** 12-byte IV used to wrap the ephemeral AES key (base64) */
  wiv: string;
  /** AES-256-GCM ciphertext of the original plaintext (base64) */
  ct: string;
}

/** Unified encrypted field — what is stored in the *_encrypted column */
export type EncryptedField = string; // base64 string (v1) OR JSON string (v2 ECIESEnvelope)

/** Result of an encrypt operation — maps 1:1 with DB columns */
export interface HybridEncryptResult {
  /** Content of *_encrypted column */
  encrypted: string;
  /** Content of *_iv column — 12-byte AES data IV, base64 */
  iv: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (work in both Node.js and browser via Web Crypto)
// ─────────────────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  // Works in both Node 18+ (global btoa) and browser
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelope detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try to parse an encrypted field value as an ECIES v2 envelope.
 * Returns null if the field is a plain v1 AES ciphertext string.
 */
export function parseECIESEnvelope(encryptedField: string): ECIESEnvelope | null {
  // ECIES envelopes start with '{' (JSON object)
  if (!encryptedField || !encryptedField.trim().startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(encryptedField);
    if (
      parsed &&
      parsed.v === 2 &&
      typeof parsed.epk === 'string' &&
      typeof parsed.wk === 'string' &&
      typeof parsed.wiv === 'string' &&
      typeof parsed.ct === 'string'
    ) {
      return parsed as ECIESEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE: Encrypt using user's ECDH P-256 public key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using the user's ECDH P-256 public key.
 * Produces a packed ECIES JSON envelope stored in *_encrypted column.
 *
 * Flow:
 *   1. Import user's P-256 public key from JWK
 *   2. Generate an ephemeral ECDH P-256 key pair
 *   3. Derive a 32-byte shared secret via ECDH(ephemeral_priv, user_pub)
 *   4. Import the 32-byte shared secret as an AES-256-GCM wrapping key
 *   5. Generate a random 32-byte ephemeral AES data key
 *   6. Encrypt plaintext with the ephemeral AES key → { ct, iv }
 *   7. Encrypt the ephemeral AES key with the shared secret → { wk, wiv }
 *   8. Export ephemeral public key as JWK, base64-encode
 *   9. Pack all into ECIESEnvelope JSON → store in *_encrypted
 *
 * @param plaintext - The string to encrypt
 * @param userPublicKeyJwk - The user's ECDH P-256 public key in JWK format
 *                           (as fetched from users.encryption_public_key)
 * @returns { encrypted: string (JSON envelope), iv: string (base64 data IV) }
 */
export async function serverHybridEncrypt(
  plaintext: string,
  userPublicKeyJwk: JsonWebKey
): Promise<HybridEncryptResult> {
  const subtle = crypto.subtle;

  // Step 1: Import user's P-256 public key
  const userPublicKey = await subtle.importKey(
    'jwk',
    userPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,         // not extractable on server side
    []             // public keys have no usages in ECDH
  );

  // Step 2: Generate ephemeral ECDH P-256 key pair
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,          // must be extractable to export public key
    ['deriveKey', 'deriveBits']
  );

  // Step 3: Derive 32-byte shared secret via ECDH
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: userPublicKey },
    ephemeralKeyPair.privateKey,
    256            // 256 bits = 32 bytes
  );

  // Step 4: Import shared secret as AES-256-GCM key for key wrapping
  const sharedSecretKey = await subtle.importKey(
    'raw',
    sharedSecretBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Step 5: Generate a random 32-byte ephemeral AES data key
  const ephemeralAESKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,          // must be extractable to wrap it
    ['encrypt', 'decrypt']
  );
  const ephemeralAESKeyRaw = await subtle.exportKey('raw', ephemeralAESKey);

  // Step 6: Encrypt plaintext with the ephemeral AES key
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  const dataIv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: dataIv },
    ephemeralAESKey,
    plaintextBytes
  );

  // Step 7: Wrap (encrypt) the ephemeral AES key with the shared secret
  const keyWrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await subtle.encrypt(
    { name: 'AES-GCM', iv: keyWrapIv },
    sharedSecretKey,
    ephemeralAESKeyRaw
  );

  // Step 8: Export ephemeral public key as JWK and serialize to base64 JSON
  const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);
  const ephemeralPublicKeyB64 = btoa(JSON.stringify(ephemeralPublicKeyJwk));

  // Step 9: Build the packed ECIES envelope
  const envelope: ECIESEnvelope = {
    v: 2,
    epk: ephemeralPublicKeyB64,
    wk: bufferToBase64(wrappedKey),
    wiv: bufferToBase64(keyWrapIv.buffer as ArrayBuffer),
    ct: bufferToBase64(ciphertext),
  };

  return {
    encrypted: JSON.stringify(envelope),
    iv: bufferToBase64(dataIv.buffer as ArrayBuffer),
  };
}

/**
 * Encrypt a nullable field. Returns { encrypted: null, iv: null } for null/empty input.
 * Convenience wrapper over serverHybridEncrypt for safe use in API routes.
 */
export async function serverEncryptField(
  plaintext: string | null | undefined,
  userPublicKeyJwk: JsonWebKey | null | undefined
): Promise<{ encrypted: string | null; iv: string | null }> {
  if (plaintext == null || plaintext === '') {
    return { encrypted: null, iv: null };
  }
  if (!userPublicKeyJwk) {
    // User has no key pair yet (old account, lazy generation pending)
    // Return null to skip encryption; the plaintext column will remain
    return { encrypted: null, iv: null };
  }
  const result = await serverHybridEncrypt(plaintext, userPublicKeyJwk);
  return { encrypted: result.encrypted, iv: result.iv };
}

/**
 * Encrypt multiple fields at once using the same user public key.
 * Returns a Record of fieldName → { encrypted, iv }.
 *
 * @example
 * const enc = await serverEncryptFields(
 *   { title: "Buy milk", description: "2% only", ai_reasoning: "..." },
 *   user.encryption_public_key_jwk
 * );
 * // → { title: { encrypted: '...', iv: '...' }, ... }
 */
export async function serverEncryptFields(
  fields: Record<string, string | null | undefined>,
  userPublicKeyJwk: JsonWebKey | null | undefined
): Promise<Record<string, { encrypted: string | null; iv: string | null }>> {
  const entries = Object.entries(fields);
  const results = await Promise.all(
    entries.map(async ([key, value]) => {
      const enc = await serverEncryptField(value, userPublicKeyJwk);
      return [key, enc] as [string, { encrypted: string | null; iv: string | null }];
    })
  );
  return Object.fromEntries(results);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE: Decrypt ECIES envelope using user's private key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decrypt an ECIES v2 envelope using the user's ECDH P-256 private key.
 *
 * Flow (reverse of encrypt):
 *   1. Parse the packed JSON envelope
 *   2. Import the ephemeral public key from the envelope
 *   3. ECDH(user_priv, ephemeral_pub) → shared secret
 *   4. Import shared secret as AES-256-GCM key
 *   5. Decrypt the wrapped key → ephemeral AES key bytes
 *   6. Import ephemeral AES key
 *   7. Decrypt ciphertext → plaintext
 *
 * @param envelope - The parsed ECIES envelope
 * @param userPrivateKey - The user's ECDH P-256 private key (from loadPrivateKey())
 * @returns Decrypted plaintext string
 */
export async function clientHybridDecrypt(
  envelope: ECIESEnvelope,
  userPrivateKey: CryptoKey
): Promise<string> {
  const subtle = crypto.subtle;

  // Step 2: Import ephemeral public key from the envelope
  const ephemeralPublicKeyJwk = JSON.parse(atob(envelope.epk)) as JsonWebKey;
  const ephemeralPublicKey = await subtle.importKey(
    'jwk',
    ephemeralPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []             // public keys have no usages in ECDH
  );

  // Step 3: ECDH to get the same shared secret
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    userPrivateKey,
    256
  );

  // Step 4: Import shared secret as AES-256-GCM key
  const sharedSecretKey = await subtle.importKey(
    'raw',
    sharedSecretBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Step 5: Decrypt the wrapped ephemeral AES key
  const wrappedKeyBytes = base64ToBuffer(envelope.wk);
  const wrapIvBytes = base64ToBuffer(envelope.wiv);
  const ephemeralAESKeyRaw = await subtle.decrypt(
    { name: 'AES-GCM', iv: wrapIvBytes },
    sharedSecretKey,
    wrappedKeyBytes
  );

  // Step 6: Import the ephemeral AES key
  const ephemeralAESKey = await subtle.importKey(
    'raw',
    ephemeralAESKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Step 7: Decrypt the actual ciphertext
  // Note: the data IV is stored in the *_iv column, but we only need the
  // ciphertext here (the caller passes envelope and the ciphertext is inside it)
  const ciphertextBytes = base64ToBuffer(envelope.ct);
  // We need the data IV — it was stored in *_iv column by the caller.
  // The caller should call smartDecrypt() which handles the IV passing.
  // This function only decrypts using the ct inside the envelope.
  // The ct inside the envelope WAS encrypted with the ephemeral AES key
  // and the data IV that also lives in *_iv. We stored it separately for
  // schema consistency, so it's passed via the parent smartDecrypt.
  // However, we need to handle both paths:
  //   - dataIv is passed externally (preferred, from *_iv column)
  //   - fall through: this should not happen in normal flow
  throw new Error(
    '[hybridCrypto] clientHybridDecrypt: use smartDecrypt() instead — it handles the data IV.'
  );
}

/**
 * Decrypt an ECIES v2 envelope with an explicitly provided data IV.
 * This is the internal implementation called by smartDecrypt().
 */
async function _clientHybridDecryptWithIv(
  envelope: ECIESEnvelope,
  dataIv: string,
  userPrivateKey: CryptoKey
): Promise<string> {
  const subtle = crypto.subtle;

  // Import ephemeral public key
  const ephemeralPublicKeyJwk = JSON.parse(atob(envelope.epk)) as JsonWebKey;
  const ephemeralPublicKey = await subtle.importKey(
    'jwk',
    ephemeralPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    userPrivateKey,
    256
  );
  const sharedSecretKey = await subtle.importKey(
    'raw',
    sharedSecretBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Unwrap the ephemeral AES key
  const ephemeralAESKeyRaw = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(envelope.wiv) },
    sharedSecretKey,
    base64ToBuffer(envelope.wk)
  );
  const ephemeralAESKey = await subtle.importKey(
    'raw',
    ephemeralAESKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the ciphertext using the data IV from the *_iv column
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(dataIv) },
    ephemeralAESKey,
    base64ToBuffer(envelope.ct)
  );

  return new TextDecoder().decode(decryptedBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// smartDecrypt — the main entry point for all AI data decryption
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatically detect the envelope version and decrypt accordingly.
 *
 * | encryptedField format | version | decryption path          |
 * |-----------------------|---------|--------------------------|
 * | plain base64 string   | v1      | AES-256-GCM + masterKey  |
 * | JSON {v:2, epk, ...}  | v2      | ECIES + privateKey       |
 * | null / empty          | —       | returns null             |
 *
 * @param encryptedField - Content of the *_encrypted column
 * @param iv             - Content of the *_iv column (base64 data IV)
 * @param masterKey      - User's AES-256 master key (for v1 decryption)
 * @param privateKey     - User's ECDH P-256 private key (for v2 decryption), or null
 * @returns Decrypted plaintext string, or null if field is null/empty
 */
export async function smartDecrypt(
  encryptedField: string | null | undefined,
  iv: string | null | undefined,
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<string | null> {
  if (!encryptedField || !iv) return null;

  // Detect envelope version
  const envelope = parseECIESEnvelope(encryptedField);

  if (envelope) {
    // v2 — ECIES decryption with private key
    if (!privateKey) {
      console.warn('[smartDecrypt] v2 ECIES field found but no private key available — field locked');
      return null;
    }
    return _clientHybridDecryptWithIv(envelope, iv, privateKey);
  } else {
    // v1 — direct AES-256-GCM decryption with master key
    const subtle = crypto.subtle;
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(iv) },
      masterKey,
      base64ToBuffer(encryptedField)
    );
    return new TextDecoder().decode(decryptedBuffer);
  }
}

/**
 * Like smartDecrypt but accepts a nullable JSON object stored field.
 * Decrypts the field and JSON.parses the result.
 * Returns null if field is null/empty or if JSON parsing fails.
 */
export async function smartDecryptJson<T = unknown>(
  encryptedField: string | null | undefined,
  iv: string | null | undefined,
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<T | null> {
  const plaintext = await smartDecrypt(encryptedField, iv, masterKey, privateKey);
  if (!plaintext) return null;
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    console.error('[smartDecryptJson] Failed to parse decrypted JSON:', plaintext.slice(0, 100));
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Key pair generation (CLIENT-SIDE, called during signup / lazy generation)
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedKeyPair {
  /** Public key in JWK format (plain JSON object) — safe to store in DB */
  publicKeyJwk: JsonWebKey;
  /** Private key encrypted with the master key (AES-256-GCM, base64) */
  encryptedPrivateKey: string;
  /** IV for the private key encryption (base64, 12 bytes) */
  privateKeyIv: string;
}

/**
 * Generate an ECDH P-256 key pair for the user.
 * The private key is immediately encrypted with the user's master key
 * before being returned — it should NEVER be stored or transmitted in plaintext.
 *
 * The public key is safe to store in plaintext on the server.
 *
 * @param masterKey - The user's AES-256 master key (from getEncryptionKey())
 * @returns GeneratedKeyPair ready to be uploaded to the server
 */
export async function generateUserKeyPair(masterKey: CryptoKey): Promise<GeneratedKeyPair> {
  const subtle = crypto.subtle;

  // Generate ECDH P-256 key pair
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,   // both keys must be extractable
    ['deriveKey', 'deriveBits']
  );

  // Export public key as JWK (safe to store plaintext)
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);

  // Export private key as raw JWK, then encrypt with master key
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);
  const privateKeyJson = JSON.stringify(privateKeyJwk);
  const encoder = new TextEncoder();
  const privateKeyBytes = encoder.encode(privateKeyJson);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivateKeyBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    masterKey,
    privateKeyBytes
  );

  return {
    publicKeyJwk,
    encryptedPrivateKey: bufferToBase64(encryptedPrivateKeyBuffer),
    privateKeyIv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Load (decrypt) the user's ECDH P-256 private key from the encrypted DB value.
 * Called once on login after the master key is in memory. The result
 * should be cached in memory alongside the master key.
 *
 * @param encryptedPrivateKey - users.encrypted_private_key (base64)
 * @param privateKeyIv        - users.private_key_iv (base64)
 * @param masterKey           - User's AES-256 master key
 * @returns ECDH P-256 CryptoKey ready for ECDH deriveBits operations
 */
export async function loadPrivateKey(
  encryptedPrivateKey: string,
  privateKeyIv: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const subtle = crypto.subtle;

  // Decrypt the private key bytes
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(privateKeyIv) },
    masterKey,
    base64ToBuffer(encryptedPrivateKey)
  );

  // Decode JSON and import as CryptoKey
  const privateKeyJson = new TextDecoder().decode(decryptedBuffer);
  const privateKeyJwk = JSON.parse(privateKeyJson) as JsonWebKey;

  return subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,   // private key should NOT be extractable after loading
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Parse the user's public key from the DB string into a JsonWebKey object.
 * The DB stores it as a JSON string (since JWK is a JSON object).
 *
 * @param publicKeyDbValue - users.encryption_public_key (stringified JWK)
 * @returns Parsed JsonWebKey ready to pass to serverHybridEncrypt()
 */
export function parsePublicKeyFromDb(publicKeyDbValue: string): JsonWebKey {
  try {
    return JSON.parse(publicKeyDbValue) as JsonWebKey;
  } catch {
    throw new Error('[hybridCrypto] Failed to parse user public key from DB — invalid JSON');
  }
}
