// apps/web/app/api/admin/init-storage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { BUCKETS } from '@/utils/supabase/storage';

/**
 * Initialize Supabase Storage buckets
 * This endpoint creates the necessary storage buckets for the application
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();

    const buckets = [
      { 
        name: BUCKETS.USERS_CLOUD, 
        public: false,
        allowedMimeTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
        fileSizeLimit: 200 * 1024 * 1024, // 200MB
        description: 'Private storage: journal, vault, documents'
      },
      { 
        name: BUCKETS.PUBLIC_CLOUD, 
        public: true,
        allowedMimeTypes: ['image/*', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        description: 'Public storage: profile images, public posts'
      },
    ];

    const results = [];

    for (const bucket of buckets) {
      // Check if bucket already exists
      const { data: existing } = await supabase.storage.getBucket(bucket.name);
      
      if (existing) {
        results.push({
          bucket: bucket.name,
          status: 'already_exists',
          message: `Bucket ${bucket.name} already exists`,
        });
        continue;
      }

      // Create the bucket
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes,
      });

      if (error) {
        console.error(`❌ Error creating bucket ${bucket.name}:`, error);
        results.push({
          bucket: bucket.name,
          status: 'error',
          error: error.message,
        });
      } else {
        console.log(`✅ Bucket created: ${bucket.name}`);
        results.push({
          bucket: bucket.name,
          status: 'created',
          data,
        });
      }
    }

    return NextResponse.json({
      message: 'Storage buckets initialization completed',
      results,
    });
  } catch (error) {
    console.error('Error initializing storage buckets:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize storage buckets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
