// apps/web/app/api/user/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * GET user settings
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (adminError: any) {
      console.error('Failed to create admin client:', adminError.message);
      return NextResponse.json(
        { error: 'Database configuration error', details: adminError.message },
        { status: 500 }
      );
    }

    const { data: settings, error } = await adminClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching settings:', { code: error.code, message: error.message, details: error.details });
      
      // If settings don't exist, create default settings
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await adminClient
          .from('user_settings')
          .insert({
            user_id: user.id,
            theme_mode: 'light',
            storage_scope: 'device_only',
            account_type: 'private',
            ai_features_enabled: true,
            encryption_enabled: true,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating settings:', { code: createError.code, message: createError.message, details: createError.details });
          return NextResponse.json(
            { error: createError.message, code: createError.code },
            { status: 500 }
          );
        }

        return NextResponse.json({ settings: newSettings });
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error in GET /api/user/settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * UPDATE user settings
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await req.json();
    const adminClient = createAdminClient();

    // Validate storage provider
    const validProviders = ['supabase', 'google_drive', 'both'];
    if (body.storage_provider && !validProviders.includes(body.storage_provider)) {
      return NextResponse.json(
        { error: 'Invalid storage provider' },
        { status: 400 }
      );
    }

    // Validate storage scope
    const validScopes = ['device_only', 'cloud_backup', 'full_cloud'];
    if (body.storage_scope && !validScopes.includes(body.storage_scope)) {
      return NextResponse.json(
        { error: 'Invalid storage scope' },
        { status: 400 }
      );
    }

    // Enforce constraint: storage_provider must be NULL when storage_scope is 'device_only'
    if (body.storage_scope === 'device_only') {
      body.storage_provider = null;
    }

    // Fetch current settings to merge with updates
    const { data: currentSettings } = await adminClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Apply the constraint to the merged data
    const effectiveScope = body.storage_scope || currentSettings?.storage_scope;
    if (effectiveScope === 'device_only') {
      body.storage_provider = null;
    }

    const updateData = {
      ...body,
      messaging_integrations: body.messaging_integrations ?? currentSettings?.messaging_integrations ?? null,
      updated_at: new Date().toISOString(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.user_id;
    delete updateData.created_at;

    const { data: settings, error } = await adminClient
      .from('user_settings')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/user/settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}