// apps/web/app/api/encryption/key-pair/route.ts
/**
 * Key Pair Management API
 *
 * POST /api/encryption/key-pair
 *   Store or update the user's ECDH P-256 key pair.
 *   Called by the client after generating a key pair (new users, or lazy
 *   generation for existing users on their first login after the upgrade).
 *
 *   Body:
 *   {
 *     public_key: string;          // JWK object (JSON.stringified)
 *     encrypted_private_key: string; // AES-256-GCM encrypted private key (base64)
 *     private_key_iv: string;        // IV for private key encryption (base64)
 *   }
 *
 * GET /api/encryption/key-pair
 *   Fetch the user's current public key.
 *   Used by server-side API routes to get the public key for encryption.
 *   NOTE: This is also included in GET /api/encryption/salt — prefer that
 *         endpoint to avoid an extra round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ─── POST: store or replace the user's key pair ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { public_key, encrypted_private_key, private_key_iv } = body;

    // Validate required fields
    if (!public_key || typeof public_key !== 'string') {
      return NextResponse.json({ error: 'public_key is required' }, { status: 400 });
    }
    if (!encrypted_private_key || typeof encrypted_private_key !== 'string') {
      return NextResponse.json({ error: 'encrypted_private_key is required' }, { status: 400 });
    }
    if (!private_key_iv || typeof private_key_iv !== 'string') {
      return NextResponse.json({ error: 'private_key_iv is required' }, { status: 400 });
    }

    // Validate the public key is valid JSON (basic sanity check)
    try {
      const parsed = JSON.parse(public_key);
      if (!parsed || parsed.kty !== 'EC' || parsed.crv !== 'P-256') {
        return NextResponse.json(
          { error: 'public_key must be a P-256 ECDH JWK' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'public_key is not valid JSON' }, { status: 400 });
    }

    // Use admin client to update the users table
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('users')
      .update({
        encryption_public_key: public_key,
        encrypted_private_key,
        private_key_iv,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[key-pair POST] DB update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[key-pair] ✅ Key pair stored for user:', user.id);
    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[key-pair POST] Unexpected error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET: fetch the user's public key (server-to-server use) ─────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('encryption_public_key, encrypted_private_key, private_key_iv')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      public_key: data?.encryption_public_key ?? null,
      encrypted_private_key: data?.encrypted_private_key ?? null,
      private_key_iv: data?.private_key_iv ?? null,
      has_key_pair: !!(data?.encryption_public_key),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
