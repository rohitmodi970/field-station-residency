// apps/web/utils/encryption/crypto.ts
/**
 * Client-Side Encryption Utilities
 *
 * Implements AES-256-GCM encryption for journal content and media.
 * Key derivation uses PBKDF2-SHA256.
 *
 * Phase 1 (Security Architecture v2):
 *   - Legacy key wrapping: 100,000 iterations (key_version = 1)
 *   - New device-key wrapping: 600,000 iterations (key_version = 2, OWASP 2023)
 *
 * IMPORTANT: The server/database never sees the decrypted content or the encryption key.
 */

/**
 * Generate a cryptographic key from a password using PBKDF2
 * @param password - User's password or passphrase
 * @param salt - Unique salt (stored per user)
 * @returns CryptoKey for encryption/decryption
 */
/**
 * LEGACY_ITERATIONS: Used for unwrapping keys created before Security Architecture v2.
 * DO NOT use this for new key wrappings.
 */
export const LEGACY_PBKDF2_ITERATIONS = 100_000;

/**
 * DEVICE_ITERATIONS: Used for all new device-key wrappings (Phase 1+).
 * Compliant with OWASP 2023 recommendation.
 */
export const DEVICE_PBKDF2_ITERATIONS = 600_000;

/**
 * Generate a cryptographic key from a password/secret using PBKDF2-SHA256
 *
 * @param password   - User's password, device secret, or OAuth credential
 * @param salt       - Unique salt (stored per user / per device)
 * @param iterations - PBKDF2 iteration count. Default = LEGACY_PBKDF2_ITERATIONS (100k).
 *                     Use DEVICE_PBKDF2_ITERATIONS (600k) for new device-key wrappings.
 * @returns CryptoKey for AES-256-GCM encryption/decryption
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = LEGACY_PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // NOTE: extractable = true so we can export and cache the raw key in IndexedDB.
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a device-level wrapping key from the device secret.
 * Always uses 600,000 PBKDF2 iterations (Security Architecture v2).
 *
 * @param deviceSecret - 32-byte random secret stored only on this device (base64-encoded)
 * @param salt         - User's encryption_salt (base64-encoded, retrieved from server)
 * @returns CryptoKey suitable for wrapping/unwrapping the master key
 */
export async function deriveDeviceKey(
  deviceSecret: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  return deriveKeyFromPassword(deviceSecret, salt, DEVICE_PBKDF2_ITERATIONS);
}

/**
 * Generate a random salt for key derivation
 * @returns 16-byte salt as Uint8Array
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a random initialization vector (IV) for AES-GCM
 * @returns 12-byte IV as Uint8Array
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Encrypt text using AES-GCM
 * @param plaintext - Text to encrypt
 * @param key - CryptoKey for encryption
 * @returns Object containing encrypted data and IV
 */
export async function encryptText(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = generateIV();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    data
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt text using AES-GCM
 * @param ciphertext - Base64-encoded encrypted text
 * @param iv - Base64-encoded initialization vector
 * @param key - CryptoKey for decryption
 * @returns Decrypted plaintext
 */
export async function decryptText(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer,
    },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt a file/blob (for media encryption)
 * @param file - File or Blob to encrypt
 * @param key - CryptoKey for encryption
 * @returns Object containing encrypted blob and IV
 */
export async function encryptFile(
  file: File | Blob,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: string; originalType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const iv = generateIV();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    arrayBuffer
  );

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
    originalType: file.type,
  };
}

/**
 * Decrypt a file/blob
 * @param encryptedBlob - Encrypted blob
 * @param iv - Base64-encoded initialization vector
 * @param key - CryptoKey for decryption
 * @param originalType - Original MIME type
 * @returns Decrypted blob
 */
export async function decryptFile(
  encryptedBlob: Blob,
  iv: string,
  key: CryptoKey,
  originalType: string
): Promise<Blob> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  const ivBuffer = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer,
    },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer], { type: originalType });
}

/**
 * Export a CryptoKey to store in secure storage
 * @param key - CryptoKey to export
 * @returns Base64-encoded key
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

/**
 * Import a CryptoKey from secure storage
 * @param keyData - Base64-encoded key
 * @returns CryptoKey
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToBuffer(keyData);
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random master key (32 bytes for AES-256).
 * Generated once per user at account creation; never changes.
 * @returns 32-byte master key as Uint8Array
 */
export function generateMasterKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Generate a random device secret (32 bytes = 256 bits).
 * Generated once per device; stored ONLY in local storage (IndexedDB / SecureStore);
 * never transmitted to the server.
 * @returns 32-byte device secret as Uint8Array
 */
export function generateDeviceSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert master key (Uint8Array) to CryptoKey for encryption operations
 * @param masterKeyBytes - Master key as Uint8Array
 * @returns CryptoKey for encryption/decryption
 */
export async function importMasterKey(masterKeyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    masterKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const b: number = bytes[i] ?? 0;
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to Base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return bufferToBase64(array.buffer as ArrayBuffer);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToBuffer(base64));
}
