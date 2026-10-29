import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSignedUrl } from '@/utils/supabase/storage';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let bucket: string, path: string, expiresIn: number;
    try {
      ({ bucket, path, expiresIn } = await request.json());
    } catch {
      return NextResponse.json(
        { error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'Missing bucket or path' },
        { status: 400 }
      );
    }

    const signedUrl = await getSignedUrl(bucket, path, expiresIn || 3600);

    return NextResponse.json({ signedUrl }, { status: 200 });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to create signed URL' },
      { status: 500 }
    );
  }
}
