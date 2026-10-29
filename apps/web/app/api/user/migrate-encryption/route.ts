// apps/web/app/api/user/migrate-encryption/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { migrateLegacyEncryption } from '@/utils/encryption/migrateLegacyEncryption';

/**
 * API Route: Migrate User to Master Key Encryption System
 * 
 * This migrates users from the legacy password-based encryption
 * to the new master key system where password changes are safe.
 * 
 * Steps:
 * 1. Decrypt all journals with old password-derived key
 * 2. Generate new master key
 * 3. Re-encrypt journals with master key
 * 4. Encrypt master key with password
 * 5. Store encrypted master key in database
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required for migration' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Password is incorrect' },
        { status: 401 }
      );
    }

    // Get user's encryption salt
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.encryption_salt) {
      return NextResponse.json(
        { error: 'User encryption data not found' },
        { status: 404 }
      );
    }

    // Check if already migrated
    if (userData.encrypted_master_key && userData.master_key_iv) {
      return NextResponse.json({
        success: true,
        alreadyMigrated: true,
        message: 'Your account is already using the master key system.',
      });
    }

    // Perform migration
    console.log(`Starting migration for user ${user.id}...`);
    
    const result = await migrateLegacyEncryption(
      user.id,
      password,
      userData.encryption_salt
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Migration failed',
          details: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${result.journalsMigrated} journals to master key system. You can now safely change your password.`,
      journalsMigrated: result.journalsMigrated,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check migration status
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encrypted_master_key, master_key_iv')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    const isMigrated = !!(userData.encrypted_master_key && userData.master_key_iv);

    return NextResponse.json({
      isMigrated,
      message: isMigrated
        ? 'Your account is using the master key system'
        : 'Your account needs to be migrated to enable password changes',
    });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
