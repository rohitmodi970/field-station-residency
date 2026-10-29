// apps/web/app/[username]/journal/[shareId]/page.tsx
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSignedUrl } from '@/utils/supabase/storage';
import PublicJournalView from './PublicJournalView';
import type { Metadata } from 'next';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { 
  trackViewEvent, 
  getVisitorMetadata, 
  generateVisitorId,
  type VisitorTrackingData 
} from '@/lib/viral-tracking';

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
  username: string;
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
  uniqueViewsCount: number;
  totalSharesCount: number;
  includeMedia: boolean;
  includeAnalysis: boolean;
  snapshotAnalysis: any | null;
  is_anonymous?: boolean;
  anonymous_alias?: string | null;
  media: {
    images: MediaItem[];
    audio: MediaItem[];
    video: MediaItem[];
    documents: MediaItem[];
  };
}

// Define page props types
type PageProps = {
  params: Promise<{ username: string; shareId: string }>;
  searchParams: Promise<{ 
    share_platform?: string; 
    ref?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }>;
};

/**
 * Cached metadata fetch to avoid duplicate queries
 */
const getCachedMetadata = cache(async (shareId: string, username: string) => {
  const adminClient = createAdminClient();
  
  // Verify username matches the published_by user
  const { data } = await adminClient
    .from('journal_publics')
    .select(`
      snapshot_title, 
      snapshot_content, 
      published_by_name,
      published_by_profile_image,
      users:published_by (username)
    `)
    .eq('share_id', shareId)
    .eq('is_active', true)
    .single();
  
  if (!data || (data.users as any)?.username !== username) {
    return null;
  }
  
  return data;
});

/**
 * Generate metadata for SEO and social sharing
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { username, shareId } = await props.params;
  const published = await getCachedMetadata(shareId, username);

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
  const authorImage = published.published_by_profile_image || '/default-avatar.png';
  const displayName = `@${username}`;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://yourapp.com'}/${username}/journal/${shareId}`;

  return {
    title: `${title} by ${displayName}`,
    description,
    authors: [{ name: author }],
    openGraph: {
      title: `${title} by ${displayName}`,
      description,
      type: 'article',
      url,
      siteName: 'Force Journal',
      locale: 'en_US',
      images: [
        {
          url: authorImage,
          width: 1200,
          height: 630,
          alt: `${title} by ${author}`,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} by ${displayName}`,
      description,
      creator: `@${username}`,
      images: [authorImage],
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: false,
      follow: true,
      nocache: true,
    },
  };
}

/**
 * Cached server-side fetch published journal data
 */
const getPublishedJournal = cache(async (
  shareId: string, 
  username: string,
  trackingData: VisitorTrackingData
): Promise<PublicJournalData | null> => {
  const adminClient = createAdminClient();

  // 1. Fetch journal_publics record with username validation
  const { data: published, error } = await adminClient
    .from('journal_publics')
    .select(`
      *,
      journals:journal_id (id, journal_id),
      users:published_by (username, name, email, profile_image)
    `)
    .eq('share_id', shareId)
    .eq('is_active', true)
    .single();

  if (error || !published) {
    return null;
  }

  // Verify username matches
  const publishedUser = published.users as any;
  if (!publishedUser || publishedUser.username !== username) {
    return null;
  }

  // 2. Check if expired
  if (published.expires_at && new Date(published.expires_at) < new Date()) {
    return null;
  }

  // 3. Track view event (async, don't block page render)
  const metadata = await getVisitorMetadata();
  trackViewEvent(trackingData, metadata)
    .then(result => {
      console.log('[Tracking] View tracked:', result);
    })
    .catch(err => console.error('[Tracking] Error tracking view:', err));

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
              url = `/api/${username}/journal/${shareId}/media/${item.id}`;
            }
          } else if (published.media_mode === 'proxy') {
            // Use proxy endpoint
            url = `/api/${username}/journal/${shareId}/media/${item.id}`;
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
    username: publishedUser.username,
    title: published.snapshot_title || 'Untitled Entry',
    content: published.snapshot_content || '',
    tags: published.snapshot_tags || [],
    mood: published.snapshot_mood,
    location: published.snapshot_location,
    weather: published.snapshot_weather,
    date: published.snapshot_date,
    author: {
      name: publishedUser.name || published.published_by_name,
      email: publishedUser.email || published.published_by_email,
      profileImage: publishedUser.profile_image || published.published_by_profile_image,
    },
    publishedAt: published.created_at,
    accessCount: published.access_count || 0,
    uniqueViewsCount: published.unique_views_count || 0,
    totalSharesCount: published.total_shares_count || 0,
    includeMedia: published.include_media,
    includeAnalysis: published.include_analysis || false,
    snapshotAnalysis: published.snapshot_analysis || null,
    is_anonymous: published.is_anonymous || false,
    anonymous_alias: published.anonymous_alias || null,
    media,
  };
});

/**
 * Public Journal View Page (Server Component)
 */
export default async function PublicJournalPage(props: PageProps) {
  const { username, shareId } = await props.params;
  const urlParams = await props.searchParams;
  
  // Get or create visitor ID from cookie
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('visitor_id')?.value || '';
  
  if (!visitorId) {
    visitorId = generateVisitorId();
    // Cookie will be set by middleware or API route
  } else {
    // Sanitize visitorId - extract only the UUID part
    // Remove any query parameters, array brackets, or extra quotes
   
    const sanitized = (visitorId
      .replace(/[\[\]"]/g, '') // Remove brackets and quotes
      .split('?')[0] ?? '') // Remove query parameters
      .split(',')[0] ?? '' // Take first if it's a comma-separated list
      .trim();
    
    // Validate it's a proper UUID format, if not generate new one
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(sanitized)) {
      visitorId = sanitized;
    } else {
      console.warn('[Tracking] Invalid visitorId format:', visitorId, '- generating new one');
      visitorId = generateVisitorId();
    }
  }
  
  // Prepare tracking data
  const trackingData: VisitorTrackingData = {
    visitorId,
    shareId,
    username,
    referrerVisitorId: urlParams.ref || null,
    sharePlatform: urlParams.share_platform || null,
    utmParams: {
      source: urlParams.utm_source,
      medium: urlParams.utm_medium,
      campaign: urlParams.utm_campaign,
      content: urlParams.utm_content,
      term: urlParams.utm_term,
    },
  };
  
  // Fetch journal data with tracking
  const journal = await getPublishedJournal(shareId, username, trackingData);

  if (!journal) {
    notFound();
  }

  return <PublicJournalView journal={journal} visitorId={visitorId} />;
}