// Temporary fix endpoint to enable encryption for existing users with salts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has encryption_salt
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encryption_salt')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user has salt but encryption is disabled, enable it
    if (userData.encryption_salt) {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ encryption_enabled: true })
        .eq('user_id', user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Encryption enabled successfully',
        encryption_salt: userData.encryption_salt 
      });
    }

    return NextResponse.json({ 
      success: false, 
      message: 'No encryption salt found' 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
