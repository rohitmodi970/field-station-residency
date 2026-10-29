// app/api/fetchUserData/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }
    
    // Fetch user data from users table with related data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        user_profiles(*),
        user_settings(*)
      `)
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
      return NextResponse.json({ message: 'User not found', error: userError.message }, { status: 404 });
    }

    return NextResponse.json({ user: userData }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}