import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parseUserAgent } from '@/lib/waitlist-analytics';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { email, energy, commitment, reflection, timeSpentSeconds, userAgent, referrer, utmParams } = body;
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required and must be a string' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Extract IP address (handle various proxy headers)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipFromForwarded = forwarded?.split(',')[0]?.trim();
    const ip = ipFromForwarded || realIp || 'unknown';

    // Parse user agent
    const userAgentString = userAgent || request.headers.get('user-agent') || '';
    const parsedUA = parseUserAgent(userAgentString);

    
    const supabase = await createClient();

    // Prepare data for insertion
    const waitlistData = {
      email: email.toLowerCase().trim(),
      name: body.name || null,
      energy_level: energy || null,
      commitment: commitment || false,
      reflection: reflection || null,
      ip_address: ip,
      user_agent: {
        raw: userAgentString,
        parsed: parsedUA,
      },
      browser_type: parsedUA.browserType,
      browser_version: parsedUA.browserVersion,
      device_type: parsedUA.deviceType,
      os: parsedUA.os,
      os_version: parsedUA.osVersion,
      time_spent_seconds: timeSpentSeconds || 0,
      referrer: referrer || null,
      utm_source: utmParams?.source || null,
      utm_medium: utmParams?.medium || null,
      utm_campaign: utmParams?.campaign || null,
      utm_term: utmParams?.term || null,
      utm_content: utmParams?.content || null,
      status: 'pending',
    };

    // Insert into database
    const { error } = await supabase
      .from('waitlist_submissions')
      .insert([waitlistData]);

    if (error) {
      // Handle duplicate email
      if (error.code === '23505') {
        return NextResponse.json(
          { 
            error: 'This email is already on the waitlist',
            code: 'DUPLICATE_EMAIL'
          },
          { status: 409 }
        );
      }

      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      {
        success: true,
        message: 'Successfully joined the waitlist!',
        data: {
          email: waitlistData.email,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint for admin to check waitlist stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (optional security)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get analytics from view
    const { data, error } = await supabase
      .from('waitlist_analytics')
      .select('*')
      .single();

    if (error) {
      console.error('Analytics fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Waitlist GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
