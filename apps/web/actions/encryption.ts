// apps/web/actions/encryption.ts
/**
 * Server Actions for Encryption Management
 * 
 * These functions handle server-side operations related to encryption:
 * - Storing/retrieving encryption salt
 * - Checking encryption status
 */

'use server';

import { createClient } from '@/utils/supabase/server';

/**
 * Get complete encryption data for a user (salt, encrypted master key, IV)
 * Call this after login to initialize encryption with master key system
 * 
 * @returns Object with salt, encrypted_master_key, and master_key_iv, or null if not found
 */
export async function getUserEncryptionData(): Promise<{
  salt: string;
  encrypted_master_key: string;
  master_key_iv: string;
  /** key_version = 1 → legacy 100k PBKDF2; 2 → new device-key 600k PBKDF2 */
  key_version: number;
} | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Get all encryption data from database (including key_version for correct iteration count)
  const { data, error } = await supabase
    .from('users')
    .select('encryption_salt, encrypted_master_key, master_key_iv, key_version')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching encryption data:', error);
    throw new Error('Failed to fetch encryption data');
  }

  // Check if all required fields are present
  if (data?.encryption_salt && data?.encrypted_master_key && data?.master_key_iv) {
    return {
      salt: data.encryption_salt,
      encrypted_master_key: data.encrypted_master_key,
      master_key_iv: data.master_key_iv,
      key_version: data.key_version ?? 1,
    };
  }

  // Fallback: Check user_metadata for backward compatibility
  const metadataSalt = user.user_metadata?.encryption_salt;
  const metadataMasterKey = user.user_metadata?.encrypted_master_key;
  const metadataIV = user.user_metadata?.master_key_iv;
  
  if (metadataSalt && metadataMasterKey && metadataIV) {
    console.log('[getUserEncryptionData] Found encryption data in user_metadata, migrating to users table');
    
    // Migrate to users table for future consistency
    try {
      await supabase
        .from('users')
        .update({ 
          encryption_salt: metadataSalt,
          encrypted_master_key: metadataMasterKey,
          master_key_iv: metadataIV,
        })
        .eq('id', user.id);
      
      console.log('[getUserEncryptionData] Successfully migrated encryption data to users table');
    } catch (migrationError) {
      console.error('[getUserEncryptionData] Failed to migrate encryption data:', migrationError);
    }
    
    return {
      salt: metadataSalt,
      encrypted_master_key: metadataMasterKey,
      master_key_iv: metadataIV,
      // Metadata-based legacy users always have key_version = 1
      key_version: 1,
    };
  }

  return null;
}

/**
 * Get or generate encryption salt for a user
 * Call this after login to initialize encryption
 * 
 * @returns Encryption salt (base64) or null if not found
 * @deprecated Use getUserEncryptionData() for master key system
 */
export async function getUserEncryptionSalt(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Get salt from database table first
  const { data, error } = await supabase
    .from('users')
    .select('encryption_salt')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching encryption salt:', error);
    throw new Error('Failed to fetch encryption salt');
  }

  // If found in users table, return it
  if (data?.encryption_salt) {
    return data.encryption_salt;
  }

  // Fallback: Check user_metadata for backward compatibility
  // (Email registration previously stored salt here)
  const metadataSalt = user.user_metadata?.encryption_salt;
  
  if (metadataSalt) {
    console.log('[getUserEncryptionSalt] Found salt in user_metadata, migrating to users table');
    
    // Migrate the salt to users table for future consistency
    try {
      await supabase
        .from('users')
        .update({ encryption_salt: metadataSalt })
        .eq('id', user.id);
      
      console.log('[getUserEncryptionSalt] Successfully migrated salt to users table');
    } catch (migrationError) {
      console.error('[getUserEncryptionSalt] Failed to migrate salt:', migrationError);
      // Still return the salt even if migration fails
    }
    
    return metadataSalt;
  }

  return null;
}

/**
 * Store encryption salt for a new user
 * Call this after registration or when user enables encryption
 * 
 * @param salt - Base64-encoded salt
 */
export async function storeUserEncryptionSalt(salt: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('users')
    .update({ encryption_salt: salt })
    .eq('id', user.id);

  if (error) {
    console.error('Error storing encryption salt:', error);
    throw new Error('Failed to store encryption salt');
  }
}

/**
 * Check if user has encryption enabled
 */
export async function isEncryptionEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return false;
  }

  const { data } = await supabase
    .from('user_settings')
    .select('encryption_enabled')
    .eq('user_id', user.id)
    .single();

  return data?.encryption_enabled || false;
}

/**
 * Enable or disable encryption for user
 * 
 * @param enabled - Whether encryption should be enabled
 */
export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('user_settings')
    .update({ encryption_enabled: enabled })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating encryption setting:', error);
    throw new Error('Failed to update encryption setting');
  }
}

/**
 * Get encryption statistics for user
 * 
 * @returns Object with encryption statistics
 */
export async function getEncryptionStats(): Promise<{
  totalJournals: number;
  encryptedJournals: number;
  totalMedia: number;
  encryptedMedia: number;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Count total and encrypted journals
  const { count: totalJournals } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_deleted', false);

  const { count: encryptedJournals } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_encrypted', true)
    .eq('is_deleted', false);

  // Count total and encrypted media
  const { count: totalMedia } = await supabase
    .from('journal_media')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: encryptedMedia } = await supabase
    .from('journal_media')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_encrypted', true);

  return {
    totalJournals: totalJournals || 0,
    encryptedJournals: encryptedJournals || 0,
    totalMedia: totalMedia || 0,
    encryptedMedia: encryptedMedia || 0,
  };
}
