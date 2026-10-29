import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      countryCode,
      thought,
      contribution,
      source,
      referralCode,
      referredBy,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    } = body;

    // ── Validate required fields ──────────────────────────────────────
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required.' },
        { status: 400 }
      );
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number (7–15 digits).' },
        { status: 400 }
      );
    }

    // ── Extract metadata ──────────────────────────────────────────────
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || null;
    const userAgent = request.headers.get('user-agent') || null;

    // ── Insert into Supabase ──────────────────────────────────────────
    const supabase = createAdminClient();

    const normalizedSource = typeof source === 'string' && source.trim()
      ? source.trim()
      : (typeof utmSource === 'string' && utmSource.trim() ? utmSource.trim() : null);

    const { data, error } = await supabase
      .from('fun_masking_submissions')
      .insert([
        {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          country_code: countryCode || null,
          thinking_about: typeof thought === 'string' && thought.trim() ? thought.trim() : null,
          community_contribution: typeof contribution === 'string' && contribution.trim() ? contribution.trim() : null,
          source: normalizedSource,
          referral_code: typeof referralCode === 'string' && referralCode.trim() ? referralCode.trim() : null,
          referred_by: typeof referredBy === 'string' && referredBy.trim() ? referredBy.trim() : null,
          utm_source: typeof utmSource === 'string' && utmSource.trim() ? utmSource.trim() : normalizedSource,
          utm_medium: typeof utmMedium === 'string' && utmMedium.trim() ? utmMedium.trim() : null,
          utm_campaign: typeof utmCampaign === 'string' && utmCampaign.trim() ? utmCampaign.trim() : null,
          utm_content: typeof utmContent === 'string' && utmContent.trim() ? utmContent.trim() : null,
          utm_term: typeof utmTerm === 'string' && utmTerm.trim() ? utmTerm.trim() : null,
          ip_address: ip,
          user_agent: userAgent,
        },
      ])
      .select('id, created_at')
      .single();

    if (error) {
      // Duplicate email (unique constraint violation)
      if (error.code === '23505') {
        return NextResponse.json(
          {
            error: 'This email is already in our community pool.',
            code: 'DUPLICATE_EMAIL',
          },
          { status: 409 }
        );
      }

      console.error('[fun-masking] Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Your invitation request has been received.',
        data: { id: data.id, createdAt: data.created_at },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[fun-masking] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
