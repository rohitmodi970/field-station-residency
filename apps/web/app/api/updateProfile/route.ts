// apps/web/app/api/updateProfile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

interface UpdateProfileBody {
  name?: string;
  phone?: string;
  password?: string;
  profile?: {
    bio?: string;
    personality_type?: string;
    dob?: string;
    languages?: string[];
    social_media?: { [key: string]: string };
    sleeping_habits?: string;
    interests?: string[];
    photo_url?: string;
  };
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ message: 'You must be logged in to update your profile' }, { status: 401 });
    }
    const { user } = authResult;
    
    // Parse request body
    let body: UpdateProfileBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }
    
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ message: 'No fields to update were provided' }, { status: 400 });
    }
    
    const { name, phone, password, profile } = body;
    const adminClient = createAdminClient();
    
    // Update users table
    const userUpdates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
      }
      userUpdates.name = name.trim();
    }
    
    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return NextResponse.json({ message: 'Phone must be a string' }, { status: 400 });
      }
      userUpdates.phone = phone.trim();
    }

    // Update users table if there are changes
    if (Object.keys(userUpdates).length > 1) {
      const { error: userError } = await adminClient
        .from('users')
        .update(userUpdates)
        .eq('id', user.id);

      if (userError) {
        console.error('Error updating user:', userError);
        return NextResponse.json({ message: 'Error updating user profile' }, { status: 500 });
      }
    }
    
    // Handle password update via Supabase Auth
    if (password !== undefined && password.trim() !== '') {
      if (password.trim().length < 8) {
        return NextResponse.json({ message: 'Password must be at least 8 characters long' }, { status: 400 });
      }
      
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { password: password.trim() }
      );

      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return NextResponse.json({ message: 'Error updating password' }, { status: 500 });
      }
    }
    
    // Update user_profiles table
    if (profile) {
      const profileUpdates: any = {
        updated_at: new Date().toISOString()
      };

      if (profile.bio !== undefined) {
        profileUpdates.bio = profile.bio;
      }
      
      if (profile.personality_type !== undefined) {
        profileUpdates.personality_type = profile.personality_type;
      }
      
      if (profile.dob !== undefined) {
        if (profile.dob) {
          const date = new Date(profile.dob);
          if (isNaN(date.getTime())) {
            return NextResponse.json({ message: 'Invalid date format for date of birth' }, { status: 400 });
          }
          profileUpdates.date_of_birth = date.toISOString();
        } else {
          profileUpdates.date_of_birth = null;
        }
      }
      
      if (profile.languages !== undefined) {
        if (!Array.isArray(profile.languages)) {
          return NextResponse.json({ message: 'Languages must be an array' }, { status: 400 });
        }
        profileUpdates.languages = profile.languages.filter(lang => typeof lang === 'string' && lang.trim() !== '');
      }
      
      if (profile.social_media !== undefined) {
        if (typeof profile.social_media !== 'object' || profile.social_media === null) {
          return NextResponse.json({ message: 'Social media must be an object' }, { status: 400 });
        }
        
        const sanitizedSocialMedia: { [key: string]: string } = {};
        for (const [platform, url] of Object.entries(profile.social_media)) {
          if (typeof url === 'string' && url.trim() !== '') {
            sanitizedSocialMedia[platform.toLowerCase()] = url.trim();
          }
        }
        profileUpdates.social_media = sanitizedSocialMedia;
      }
      
      if (profile.sleeping_habits !== undefined) {
        profileUpdates.sleeping_habits = profile.sleeping_habits;
      }
      
      if (profile.interests !== undefined) {
        if (!Array.isArray(profile.interests)) {
          return NextResponse.json({ message: 'Interests must be an array' }, { status: 400 });
        }
        profileUpdates.interests = profile.interests.filter(interest => typeof interest === 'string' && interest.trim() !== '');
      }
      
      if (profile.photo_url !== undefined) {
        profileUpdates.photo_url = profile.photo_url;
      }

      // Upsert user_profiles
      const { error: profileError } = await adminClient
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          ...profileUpdates
        });

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return NextResponse.json({ message: 'Error updating profile' }, { status: 500 });
      }
    }
    
    // Fetch updated data
    const { data: userData } = await adminClient
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: profileData } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        name: userData?.name,
        email: user.email,
        phone: userData?.phone,
        profile: profileData || {}
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ 
      message: 'An unexpected error occurred while updating your profile',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}
