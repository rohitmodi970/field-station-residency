// apps/web/utils/encryption/migrateLegacyEncryption.ts
/**
 * Migration utility to convert from password-based encryption to master key system
 * 
 * OLD SYSTEM: Journals encrypted directly with password-derived key
 * NEW SYSTEM: Journals encrypted with master key, master key encrypted with password
 * 
 * This migration:
 * 1. Decrypts all journals with OLD password-derived key
 * 2. Generates new master key
 * 3. Re-encrypts all journals with master key
 * 4. Encrypts master key with password
 * 5. Stores encrypted master key in database
 */

import { createClient } from '@/utils/supabase/client';
import {
  deriveKeyFromPassword,
  generateMasterKey,
  importMasterKey,
  encryptText,
  decryptText,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from './crypto';

export interface MigrationResult {
  success: boolean;
  journalsMigrated: number;
  error?: string;
}

/**
 * Migrate a user from legacy encryption to master key system
 * 
 * @param userId - User's ID
 * @param password - User's current password
 * @param salt - Encryption salt from database
 * @returns Migration result
 */
export async function migrateLegacyEncryption(
  userId: string,
  password: string,
  salt: string
): Promise<MigrationResult> {
  const supabase = createClient();

  try {
    // Step 1: Check if user already has master key (already migrated)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encrypted_master_key, master_key_iv')
      .eq('id', userId)
      .single();

    if (userError) {
      return { success: false, journalsMigrated: 0, error: userError.message };
    }

    if (userData.encrypted_master_key && userData.master_key_iv) {
      console.log('User already migrated to master key system');
      return { success: true, journalsMigrated: 0 };
    }

    // Step 2: Derive OLD password key (legacy system)
    const saltBytes = base64ToUint8Array(salt);
    const oldPasswordKey = await deriveKeyFromPassword(password, saltBytes);

    // Step 3: Fetch all encrypted journals
    const { data: journals, error: journalsError } = await supabase
      .from('journals')
      .select('journal_id, title_encrypted, title_iv, content_encrypted, content_iv, is_encrypted')
      .eq('user_id', userId)
      .eq('is_encrypted', true);

    if (journalsError) {
      return { success: false, journalsMigrated: 0, error: journalsError.message };
    }

    if (!journals || journals.length === 0) {
      console.log('No encrypted journals to migrate');
      // Still generate and store master key for future use
      await generateAndStoreMasterKey(userId, password, saltBytes);
      return { success: true, journalsMigrated: 0 };
    }

    console.log(`Migrating ${journals.length} encrypted journals...`);

    // Step 4: Decrypt all journals with OLD key
    const decryptedJournals = [];
    for (const journal of journals) {
      try {
        const title = await decryptText(
          journal.title_encrypted,
          journal.title_iv,
          oldPasswordKey
        );
        const content = await decryptText(
          journal.content_encrypted,
          journal.content_iv,
          oldPasswordKey
        );

        decryptedJournals.push({
          journal_id: journal.journal_id,
          title,
          content,
        });
      } catch (error) {
        console.error(`Failed to decrypt journal ${journal.journal_id}:`, error);
        return {
          success: false,
          journalsMigrated: 0,
          error: `Failed to decrypt journal ${journal.journal_id}. Cannot proceed with migration.`,
        };
      }
    }

    // Step 5: Generate NEW master key
    const masterKeyBytes = generateMasterKey();
    const masterKey = await importMasterKey(masterKeyBytes);

    // Step 6: Re-encrypt all journals with NEW master key
    for (const journal of decryptedJournals) {
      const encryptedTitle = await encryptText(journal.title, masterKey);
      const encryptedContent = await encryptText(journal.content, masterKey);

      const { error: updateError } = await supabase
        .from('journals')
        .update({
          title_encrypted: encryptedTitle.ciphertext,
          title_iv: encryptedTitle.iv,
          content_encrypted: encryptedContent.ciphertext,
          content_iv: encryptedContent.iv,
        })
        .eq('journal_id', journal.journal_id);

      if (updateError) {
        console.error(`Failed to update journal ${journal.journal_id}:`, updateError);
        return {
          success: false,
          journalsMigrated: 0,
          error: `Failed to update journal ${journal.journal_id}`,
        };
      }
    }

    // Step 7: Encrypt master key with password
    const encryptedMasterKeyData = await encryptText(
      uint8ArrayToBase64(masterKeyBytes),
      oldPasswordKey
    );

    // Step 8: Store encrypted master key in database
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        encrypted_master_key: encryptedMasterKeyData.ciphertext,
        master_key_iv: encryptedMasterKeyData.iv,
      })
      .eq('id', userId);

    if (updateUserError) {
      return {
        success: false,
        journalsMigrated: 0,
        error: `Failed to store master key: ${updateUserError.message}`,
      };
    }

    console.log(`✅ Successfully migrated ${journals.length} journals to master key system`);

    return {
      success: true,
      journalsMigrated: journals.length,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      journalsMigrated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate and store master key for users with no journals yet
 */
async function generateAndStoreMasterKey(
  userId: string,
  password: string,
  saltBytes: Uint8Array
): Promise<void> {
  const supabase = createClient();

  // Generate master key
  const masterKeyBytes = generateMasterKey();
  const passwordKey = await deriveKeyFromPassword(password, saltBytes);

  // Encrypt master key with password
  const encryptedMasterKeyData = await encryptText(
    uint8ArrayToBase64(masterKeyBytes),
    passwordKey
  );

  // Store in database
  await supabase
    .from('users')
    .update({
      encrypted_master_key: encryptedMasterKeyData.ciphertext,
      master_key_iv: encryptedMasterKeyData.iv,
    })
    .eq('id', userId);

  console.log('✅ Generated and stored master key for user');
}
