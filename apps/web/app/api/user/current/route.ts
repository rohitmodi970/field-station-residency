import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/user/current - Get current authenticated user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || null,
        // Phase 5: expose auth provider so client can detect OAuth users
        provider: user.app_metadata?.provider || 'email',
        app_metadata: { provider: user.app_metadata?.provider || 'email' },
      }
    });
  } catch (error) {
    console.error('Error in GET /api/user/current:', error);
    return NextResponse.json(
      { error: 'Internal server error', user: null },
      { status: 500 }
    );
  }
}
