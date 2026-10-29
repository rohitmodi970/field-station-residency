import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query || query.length < 3) {
      return NextResponse.json({ users: [] });
    }

    // Search by email, username, or name, filtering by discoverability
    // Use admin client because RLS on public.users and user_settings restricts users to their own rows
    const admin = createAdminClient();
    let users: any[] | null = null;

    // Try with discoverability filter first
    const { data, error } = await admin
      .from('users')
      .select(`
        id,
        name,
        email,
        username,
        profile_image,
        user_settings!inner(discoverability)
      `)
      .neq('id', user.id)
      .eq('user_settings.discoverability', 'anyone')
      .or(`email.ilike.%${query}%,username.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      // Fallback: if user_settings join fails, search without it
      console.warn('User search with discoverability filter failed, falling back:', error.message);
      const { data: fallbackData, error: fallbackError } = await admin
        .from('users')
        .select('id, name, email, username, profile_image')
        .neq('id', user.id)
        .or(`email.ilike.%${query}%,username.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);

      if (fallbackError) {
        console.error('Error searching users (fallback):', fallbackError);
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      users = fallbackData;
    } else {
      users = data;
    }

    // Map to simple structure and remove user_settings object from output
    const formattedUsers = (users || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      profile_image: u.profile_image,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error: any) {
    console.error('Error in GET /api/users/search:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

