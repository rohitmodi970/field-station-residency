// apps/web/app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

/**
 * GET /api/user/profile - Get user's extended profile
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Get basic user data
    const { data: userData } = await supabase
      .from('users')
      .select('name, email, username, profile_image, bio')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      user: userData,
      profile: profile || null,
    });
  } catch (error: any) {
    console.error('Error in GET /api/user/profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile - Update user's extended profile
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await req.json();
    const {
      bio,
      personality_type,
      dob,
      languages,
      social_media,
      sleeping_habits,
      interests,
      photo_url,
      profile_visibility,
    } = body;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          bio,
          personality_type,
          dob,
          languages,
          social_media,
          sleeping_habits,
          interests,
          photo_url,
          profile_visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ profile: data });
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          bio,
          personality_type,
          dob,
          languages,
          social_media,
          sleeping_habits,
          interests,
          photo_url,
          profile_visibility: profile_visibility || 'private',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ profile: data });
    }
  } catch (error: any) {
    console.error('Error in PUT /api/user/profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
