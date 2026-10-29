// apps/web/app/p/[shareId]/page.tsx
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSignedUrl } from '@/utils/supabase/storage';
import PublicJournalView from './PublicJournalView';
import type { Metadata } from 'next';
import { cache } from 'react';

// Enable ISR with 60 second revalidation
export const revalidate = 60;

interface MediaItem {
  id: any;
  fileName: any;
  mimeType: any;
  fileSize: any;
  thumbnailUrl: any;
  url: any;
  width: any;
  height: any;
  duration: any;
  createdAt: any;
}

interface PublicJournalData {
  shareId: string;
  title: string;
  content: string;
  tags: string[];
  mood: string | null;
  location: string | null;
  weather: string | null;
  date: string | null;
  author: {
    name: string | null;
    email: string | null;
    profileImage: string | null;
  };
  publishedAt: string;
  accessCount: number;
  includeMedia: boolean;
  media: {
    images: MediaItem[];
    audio: MediaItem[];
    video: MediaItem[];
    documents: MediaItem[];
  };
}

/**
 * Cached metadata fetch to avoid duplicate queries
 */
const getCachedMetadata = cache(async (shareId: string) => {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('journal_publics')
    .select('snapshot_title, snapshot_content, published_by_name')
    .eq('share_id', shareId)
    .eq('is_active', true)
    .single();
  return data;
});

/**
 * Generate metadata for SEO and social sharing
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const published = await getCachedMetadata(shareId);

  if (!published) {
    return {
      title: 'Journal Not Found',
      robots: 'noindex, nofollow',
    };
  }

  const title = published.snapshot_title || 'Shared Journal Entry';
  const description = published.snapshot_content
    ? published.snapshot_content.substring(0, 160) + '...'
    : 'A personal journal entry shared publicly';
  const author = published.published_by_name || 'Anonymous';

  return {
    title: `${title} - Shared by ${author}`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      authors: [author],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: 'noindex, nofollow', // Default: don't index (user can opt-in later)
  };
}

/**
 * Cached server-side fetch published journal data
 */
const getPublishedJournal = cache(async (shareId: string): Promise<PublicJournalData | null> => {
  const adminClient = createAdminClient();

  // 1. Fetch journal_publics record
  const { data: published, error } = await adminClient
    .from('journal_publics')
    .select(`
      *,
      journals:journal_id (
        id,
        journal_id
      )
    `)
    .eq('share_id', shareId)
    .eq('is_active', true)
    .single();

  if (error || !published) {
    return null;
  }

  // 2. Check if expired
  if (published.expires_at && new Date(published.expires_at) < new Date()) {
    return null;
  }

  // 3. Increment view count (async, don't await)
  adminClient
    .rpc('increment_view_count', { p_share_id: shareId })
    .then(() => {}, (err: Error) => console.error('Error incrementing view count:', err));

  // 4. Fetch media if included
  let media: {
    images: MediaItem[];
    audio: MediaItem[];
    video: MediaItem[];
    documents: MediaItem[];
  } = {
    images: [],
    audio: [],
    video: [],
    documents: [],
  };

  if (published.include_media && published.journals?.id) {
    const { data: mediaRecords } = await adminClient
      .from('journal_media')
      .select('*')
      .eq('journal_id', published.journals.id)
      .order('display_order', { ascending: true });

    if (mediaRecords) {
      // Batch generate signed URLs for better performance
      const mediaWithUrls = await Promise.allSettled(
        mediaRecords.map(async (item: any) => {
          let url = null;

          if (published.media_mode === 'signed' && item.bucket && item.path) {
            // Generate 1-hour signed URL
            try {
              url = await getSignedUrl(item.bucket, item.path, 3600);
            } catch (err) {
              console.error(`[Cache] Error generating signed URL for ${item.id}:`, err);
              // Fallback to proxy mode on error
              url = `/api/p/${shareId}/media/${item.id}`;
            }
          } else if (published.media_mode === 'proxy') {
            // Use proxy endpoint
            url = `/api/p/${shareId}/media/${item.id}`;
          } else if (item.public_url) {
            // Use public URL if available
            url = item.public_url;
          }

          return {
            id: item.id,
            fileName: item.file_name,
            mimeType: item.mime_type,
            fileSize: item.file_size,
            thumbnailUrl: item.thumbnail_url,
            url,
            width: item.width,
            height: item.height,
            duration: item.duration,
            createdAt: item.created_at,
          };
        })
      ).then(results => 
        results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value)
      );

      // Group by media type
      media = {
        images: mediaWithUrls.filter((m: any) => m.mimeType?.startsWith('image/')),
        audio: mediaWithUrls.filter((m: any) => m.mimeType?.startsWith('audio/')),
        video: mediaWithUrls.filter((m: any) => m.mimeType?.startsWith('video/')),
        documents: mediaWithUrls.filter((m: any) => 
          m.mimeType?.includes('pdf') || 
          m.mimeType?.includes('document') ||
          m.mimeType?.includes('text/')
        ),
      };
    }
  }

  // 5. Return formatted data
  return {
    shareId: published.share_id,
    title: published.snapshot_title || 'Untitled Entry',
    content: published.snapshot_content || '',
    tags: published.snapshot_tags || [],
    mood: published.snapshot_mood,
    location: published.snapshot_location,
    weather: published.snapshot_weather,
    date: published.snapshot_date,
    author: {
      name: published.published_by_name,
      email: published.published_by_email,
      profileImage: published.published_by_profile_image,
    },
    publishedAt: published.created_at,
    accessCount: published.access_count || 0,
    includeMedia: published.include_media,
    media,
  };
});

/**
 * Public Journal View Page (Server Component)
 * 
 * LEGACY ROUTE - Redirects to new /[username]/journal/[shareId] format
 * Kept for backwards compatibility with old shared links
 */
export default async function PublicJournalPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const adminClient = createAdminClient();
  
  // Get username for redirect to new URL format
  const { data: published } = await adminClient
    .from('journal_publics')
    .select('users:published_by (username)')
    .eq('share_id', shareId)
    .eq('is_active', true)
    .single();
  
  if (!published || !(published.users as any)?.username) {
    notFound();
  }
  
  const username = (published.users as any).username;
  
  // Redirect to new URL format
  const { redirect } = await import('next/navigation');
  redirect(`/${username}/journal/${shareId}`);
}
