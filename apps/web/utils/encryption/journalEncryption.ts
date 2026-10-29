// apps/web/utils/encryption/journalEncryption.ts
/**
 * Journal-Specific Encryption Utilities
 * 
 * Provides high-level functions for encrypting/decrypting journal data.
 * Handles both text content and media files.
 */

import { encryptText, decryptText, encryptFile, decryptFile } from './crypto';
import { getEncryptionKey } from './keyManager';

export interface PromptData {
  text: string;
  explanation?: string;
}

/**
 * Encrypted journal entry structure
 */
export interface EncryptedJournalEntry {
  // Encrypted fields
  title_encrypted: string | null;
  title_iv: string | null;
  content_encrypted: string | null;
  content_iv: string | null;
  prompt_encrypted?: string | null;
  prompt_iv?: string | null;
  
  // Non-encrypted metadata (can be null for privacy)
  journal_type?: string | null;
  mood?: string | null;
  tags?: string[] | null;
  location?: string | null;
  weather?: string | null;
  
  // Unencrypted system fields
  date: string;
  is_favorite: boolean;
  is_archived: boolean;
  word_count?: number;
  is_prompt_response?: boolean;
}

/**
 * Decrypted journal entry structure
 */
export interface DecryptedJournalEntry {
  title: string | null;
  content: string | null;
  prompt?: PromptData | null;
  journal_type?: string | null;
  mood?: string | null;
  tags?: string[];
  location?: string | null;
  weather?: string | null;
  date: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_prompt_response?: boolean;
}

/**
 * Encrypt a journal entry before saving to database
 * 
 * @param entry - Plain journal entry
 * @param userId - User's ID
 * @returns Encrypted entry ready for database
 */
export async function encryptJournalEntry(
  entry: DecryptedJournalEntry,
  userId: string
): Promise<EncryptedJournalEntry> {
  const key = await getEncryptionKey(userId);

  // Encrypt title if present
  let titleEncrypted = null;
  let titleIv = null;
  if (entry.title) {
    const encrypted = await encryptText(entry.title, key);
    titleEncrypted = encrypted.ciphertext;
    titleIv = encrypted.iv;
  }

  // Encrypt content if present
  let contentEncrypted = null;
  let contentIv = null;
  if (entry.content) {
    const encrypted = await encryptText(entry.content, key);
    contentEncrypted = encrypted.ciphertext;
    contentIv = encrypted.iv;
  }

  // Encrypt prompt if present
  let promptEncrypted = null;
  let promptIv = null;
  if (entry.prompt && (entry.prompt.text || typeof entry.prompt === 'string')) {
    const promptStr = typeof entry.prompt === 'string' ? entry.prompt : JSON.stringify(entry.prompt);
    const encrypted = await encryptText(promptStr, key);
    promptEncrypted = encrypted.ciphertext;
    promptIv = encrypted.iv;
  }

  const isPromptResponse = entry.is_prompt_response !== undefined
    ? entry.is_prompt_response
    : Boolean(promptEncrypted || entry.prompt?.text);

  return {
    title_encrypted: titleEncrypted,
    title_iv: titleIv,
    content_encrypted: contentEncrypted,
    content_iv: contentIv,
    prompt_encrypted: promptEncrypted,
    prompt_iv: promptIv,
    is_prompt_response: isPromptResponse,
    journal_type: entry.journal_type || null,
    mood: entry.mood || null,
    tags: entry.tags || null,
    location: entry.location || null,
    weather: entry.weather || null,
    date: entry.date,
    is_favorite: entry.is_favorite,
    is_archived: entry.is_archived,
    word_count: entry.content?.length || 0,
  };
}

/**
 * Decrypt a journal entry after fetching from database
 * 
 * @param encryptedEntry - Encrypted journal entry from database
 * @param userId - User's ID
 * @returns Decrypted entry
 */
export async function decryptJournalEntry(
  encryptedEntry: EncryptedJournalEntry,
  userId: string
): Promise<DecryptedJournalEntry> {
  const key = await getEncryptionKey(userId);

  // Decrypt title
  let title = null;
  if (encryptedEntry.title_encrypted && encryptedEntry.title_iv) {
    title = await decryptText(
      encryptedEntry.title_encrypted,
      encryptedEntry.title_iv,
      key
    );
  }

  // Decrypt content
  let content = null;
  if (encryptedEntry.content_encrypted && encryptedEntry.content_iv) {
    content = await decryptText(
      encryptedEntry.content_encrypted,
      encryptedEntry.content_iv,
      key
    );
  }

  // Decrypt prompt
  let prompt: PromptData | null = null;
  if (encryptedEntry.prompt_encrypted && encryptedEntry.prompt_iv) {
    try {
      const decrypted = await decryptText(
        encryptedEntry.prompt_encrypted,
        encryptedEntry.prompt_iv,
        key
      );
      try {
        prompt = JSON.parse(decrypted);
      } catch {
        prompt = { text: decrypted };
      }
    } catch (promptErr) {
      console.warn('[decryptJournalEntry] Failed to decrypt prompt:', promptErr);
    }
  }

  const isPromptResponse = encryptedEntry.is_prompt_response !== undefined
    ? encryptedEntry.is_prompt_response
    : Boolean(prompt || encryptedEntry.prompt_encrypted);

  return {
    title,
    content,
    prompt,
    is_prompt_response: isPromptResponse,
    journal_type: encryptedEntry.journal_type || undefined,
    mood: encryptedEntry.mood || undefined,
    tags: encryptedEntry.tags || undefined,
    location: encryptedEntry.location || undefined,
    weather: encryptedEntry.weather || undefined,
    date: encryptedEntry.date,
    is_favorite: encryptedEntry.is_favorite,
    is_archived: encryptedEntry.is_archived,
  };
}

/**
 * Encrypt multiple journal entries
 */
export async function encryptJournalEntries(
  entries: DecryptedJournalEntry[],
  userId: string
): Promise<EncryptedJournalEntry[]> {
  return Promise.all(entries.map(entry => encryptJournalEntry(entry, userId)));
}

/**
 * Decrypt multiple journal entries
 */
export async function decryptJournalEntries(
  encryptedEntries: EncryptedJournalEntry[],
  userId: string
): Promise<DecryptedJournalEntry[]> {
  return Promise.all(
    encryptedEntries.map(entry => decryptJournalEntry(entry, userId))
  );
}

/**
 * Encrypt media file before upload
 * 
 * @param file - File to encrypt
 * @param userId - User's ID
 * @returns Encrypted file and metadata
 */
export async function encryptMediaFile(
  file: File,
  userId: string
): Promise<{
  encryptedFile: File;
  iv: string;
  originalType: string;
  originalName: string;
}> {
  const key = await getEncryptionKey(userId);
  const { encryptedBlob, iv, originalType } = await encryptFile(file, key);

  return {
    encryptedFile: new File([encryptedBlob], file.name + '.enc', {
      type: 'application/octet-stream',
    }),
    iv,
    originalType,
    originalName: file.name,
  };
}

/**
 * Decrypt media file after download
 * 
 * @param encryptedBlob - Encrypted file blob
 * @param iv - Initialization vector
 * @param originalType - Original MIME type
 * @param userId - User's ID
 * @returns Decrypted blob
 */
export async function decryptMediaFile(
  encryptedBlob: Blob,
  iv: string,
  originalType: string,
  userId: string
): Promise<Blob> {
  const key = await getEncryptionKey(userId);
  return decryptFile(encryptedBlob, iv, key, originalType);
}

/**
 * Create a URL for displaying decrypted media
 * 
 * @param encryptedBlob - Encrypted file blob
 * @param iv - Initialization vector
 * @param originalType - Original MIME type
 * @param userId - User's ID
 * @returns Object URL for displaying the decrypted media
 */
export async function createDecryptedMediaURL(
  encryptedBlob: Blob,
  iv: string,
  originalType: string,
  userId: string
): Promise<string> {
  const decryptedBlob = await decryptMediaFile(encryptedBlob, iv, originalType, userId);
  return URL.createObjectURL(decryptedBlob);
}

/**
 * Revoke a decrypted media URL to free memory
 */
export function revokeDecryptedMediaURL(url: string): void {
  URL.revokeObjectURL(url);
}
