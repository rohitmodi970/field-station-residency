// apps/web/app/api/auth/google/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateAuthUrl, getDefaultConfig } from '@/utils/google-drive/client';

/**
 * GET - Redirect user to Google OAuth consent screen
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate Google OAuth URL
    const config = getDefaultConfig();
    const authUrl = generateAuthUrl(config);

    // Store user ID in session state (you can use a different state management approach)
    const url = new URL(authUrl);
    url.searchParams.set('state', Buffer.from(JSON.stringify({ userId: user.id })).toString('base64'));

    // Redirect to Google OAuth
    return NextResponse.redirect(url.toString());
  } catch (error: any) {
    console.error('Error in GET /api/auth/google/authorize:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
