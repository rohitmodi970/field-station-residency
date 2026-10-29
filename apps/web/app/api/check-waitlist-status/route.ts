import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Check if an email is in the waitlist and its approval status
 * GET /api/check-waitlist-status?email=user@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    const normalizedEmail = email.toLowerCase().trim();

    // Check if the email is already registered (admin client bypasses RLS)
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        inWaitlist: true,
        status: 'registered',
        canSignup: false,
        message: 'An account with this email already exists. Please sign in instead.',
        action: 'already_registered'
      });
    }

    // Check if email exists in waitlist (admin client bypasses RLS)
    const { data: waitlistEntry, error } = await adminClient
      .from('waitlist_submissions')
      .select('id, email, status, created_at')
      .eq('email', normalizedEmail)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Database error (not "not found")
      console.error('Waitlist check error:', error);
      return NextResponse.json(
        { error: 'Failed to check waitlist status' },
        { status: 500 }
      );
    }

    if (!waitlistEntry) {
      // Email not in waitlist
      return NextResponse.json({
        inWaitlist: false,
        status: null,
        canSignup: false,
        message: 'Please join our waitlist first to create an account.',
        action: 'join_waitlist'
      });
    }

    // Email exists in waitlist - check status
    const { status } = waitlistEntry;

    switch (status) {
      case 'approved':
      case 'converted':
        return NextResponse.json({
          inWaitlist: true,
          status,
          canSignup: true,
          message: 'Great! Your email is approved. You can proceed with registration.',
          action: 'allow_signup'
        });

      case 'pending':
        return NextResponse.json({
          inWaitlist: true,
          status,
          canSignup: false,
          message: 'Your application is still under review. We\'ll notify you once approved.',
          action: 'wait_for_approval'
        });

      case 'rejected':
        return NextResponse.json({
          inWaitlist: true,
          status,
          canSignup: false,
          message: 'Unfortunately, we\'re unable to grant access at this time.',
          action: 'access_denied'
        });

      default:
        return NextResponse.json({
          inWaitlist: true,
          status,
          canSignup: false,
          message: 'Unable to determine your waitlist status. Please contact support.',
          action: 'contact_support'
        });
    }

  } catch (error) {
    console.error('Check waitlist status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
