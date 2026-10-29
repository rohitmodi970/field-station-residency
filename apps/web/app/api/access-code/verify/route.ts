import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

type VerifyPayload = {
  username?: string;
  code?: string;
};

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyPayload;
    const username = (body.username || '').trim().toLowerCase();
    const code = (body.code || '').trim();

    if (!username || !code) {
      return NextResponse.json(
        { success: false, error: 'Username and code are required.' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: 'Code must be a 6-digit number.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: codes, error: codeError } = await admin
      .from('waitlist_access_codes')
      .select('id, waitlist_submission_id, email, code_hash, status')
      .eq('username_slug', username)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeError) {
      console.error('Access code lookup failed:', codeError);
      return NextResponse.json(
        { success: false, error: 'Unable to verify code right now. Please try again.' },
        { status: 500 }
      );
    }

    if (!codes || codes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active access found for this username.' },
        { status: 404 }
      );
    }

    const record = codes[0];
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'No active access found for this username.' },
        { status: 404 }
      );
    }

    if (record.code_hash !== hashCode(code)) {
      return NextResponse.json(
        { success: false, error: 'Invalid access code.' },
        { status: 401 }
      );
    }

    const { data: waitlistEntry, error: waitlistError } = await admin
      .from('waitlist_submissions')
      .select('name, email, status')
      .eq('id', record.waitlist_submission_id)
      .single();

    if (waitlistError || !waitlistEntry || waitlistEntry.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Access is not approved yet for this user.' },
        { status: 403 }
      );
    }

    await admin
      .from('waitlist_access_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', record.id);

    return NextResponse.json({
      success: true,
      message: 'Code verified successfully.',
      user: {
        username,
        name: waitlistEntry.name || waitlistEntry.email.split('@')[0],
        email: waitlistEntry.email,
      },
      nextUrl: `/register?verifiedUsername=${encodeURIComponent(username)}&verifiedEmail=${encodeURIComponent(waitlistEntry.email)}`,
    });
  } catch (error) {
    console.error('Access code verify API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
