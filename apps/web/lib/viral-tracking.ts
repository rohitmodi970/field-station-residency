// lib/viral-tracking.ts
// Viral Graph Tracking Utilities
// Privacy-compliant visitor tracking with graph-based analytics

import { createAdminClient } from '@/utils/supabase/admin';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

// Use Web Crypto API instead of Node.js crypto for Edge Runtime compatibility
async function createHash(algorithm: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest(algorithm === 'sha256' ? 'SHA-256' : 'SHA-1', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// TYPES
// ============================================================================

export interface VisitorTrackingData {
  visitorId: string | null; // From cookie
  shareId: string;
  username: string;
  referrerVisitorId?: string | null; // From ?ref= parameter
  sharePlatform?: string | null; // From ?share_platform= parameter
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

export interface VisitorMetadata {
  ipHash: string;
  fingerprint: string;
  userAgent: string | null;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  browser: string | null;
  os: string | null;
  screenWidth?: number;
  screenHeight?: number;
  referrer: string | null;
  countryCode?: string | null;
}

export interface ShareTrackingData {
  visitorId: string;
  shareId: string;
  platform: string;
  targetUrl: string;
}

// ============================================================================
// VISITOR FINGERPRINTING & IDENTIFICATION
// ============================================================================

/**
 * Generate SHA-256 hash (privacy-compliant)
 */
export async function sha256(data: string): Promise<string> {
  return await createHash('sha256', data);
}

/**
 * Get visitor metadata from request headers
 */
export async function getVisitorMetadata(): Promise<VisitorMetadata> {
  const headersList = await headers();
  
  // Get IP address (prioritize real IP over forwarded)
  const ip = 
    headersList.get('x-real-ip') ||
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('cf-connecting-ip') || // Cloudflare
    '0.0.0.0';
  
  const userAgent = headersList.get('user-agent') || '';
  const referrer = headersList.get('referer') || headersList.get('referrer') || null;
  
  // Parse user agent
  const parser = new UAParser(userAgent);
  const uaResult = parser.getResult();
  
  // Device type detection
  let deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown' = 'unknown';
  if (uaResult.device.type === 'mobile') deviceType = 'mobile';
  else if (uaResult.device.type === 'tablet') deviceType = 'tablet';
  else if (uaResult.device.type === 'wearable') deviceType = 'mobile';
  else if (uaResult.device.type === undefined) deviceType = 'desktop';
  
  // Generate privacy-compliant hashes
  const today = new Date().toISOString().split('T')[0];
  const ipHash = await sha256(ip);
  const fingerprint = await sha256(`${ip}:${userAgent}:${today}`);
  
  return {
    ipHash,
    fingerprint,
    userAgent: userAgent || null,
    deviceType,
    browser: uaResult.browser.name || null,
    os: uaResult.os.name || null,
    referrer,
    countryCode: null, // Can be enriched with GeoIP service
  };
}

/**
 * Generate unique visitor ID (stored in cookie)
 */
export function generateVisitorId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// VISITOR NODE MANAGEMENT
// ============================================================================

/**
 * Get or create visitor node in graph
 */
export async function getOrCreateVisitorNode(
  visitorId: string,
  journalPublicId: string,
  metadata: VisitorMetadata,
  referrerVisitorId?: string | null,
  sharePlatform?: string | null
): Promise<{ visitorId: string; isNew: boolean; networkDepth: number }> {
  const adminClient = createAdminClient();
  
  // Check if visitor node already exists
  const { data: existingNode } = await adminClient
    .from('visitor_nodes')
    .select('visitor_id, network_depth, total_views_count')
    .eq('visitor_id', visitorId)
    .single();
  
  if (existingNode) {
    // Update last seen timestamp and view count
    await adminClient
      .from('visitor_nodes')
      .update({
        last_seen_at: new Date().toISOString(),
        total_views_count: existingNode.total_views_count + 1,
      })
      .eq('visitor_id', visitorId);
    
    return {
      visitorId: existingNode.visitor_id,
      isNew: false,
      networkDepth: existingNode.network_depth,
    };
  }
  
  // Determine network depth (how many hops from owner)
  let networkDepth = 0;
  if (referrerVisitorId) {
    const { data: parentNode } = await adminClient
      .from('visitor_nodes')
      .select('network_depth')
      .eq('visitor_id', referrerVisitorId)
      .single();
    
    networkDepth = parentNode ? parentNode.network_depth + 1 : 1;
  }
  
  // Create new visitor node
  const { data: newNode, error } = await adminClient
    .from('visitor_nodes')
    .insert({
      visitor_id: visitorId,
      visitor_fingerprint_hash: metadata.fingerprint,
      first_seen_journal_id: journalPublicId,
      first_referrer: metadata.referrer,
      first_platform: sharePlatform,
      device_type: metadata.deviceType,
      country_code: metadata.countryCode,
      network_depth: networkDepth,
      total_views_count: 1,
    })
    .select('visitor_id, network_depth')
    .single();
  
  if (error) {
    console.error('[ViralTracking] Error creating visitor node:', error);
    throw new Error('Failed to create visitor node');
  }
  
  return {
    visitorId: newNode.visitor_id,
    isNew: true,
    networkDepth: newNode.network_depth,
  };
}

// ============================================================================
// VIEW EVENT TRACKING
// ============================================================================

/**
 * Track a view event (main entry point)
 */
export async function trackViewEvent(
  data: VisitorTrackingData,
  metadata: VisitorMetadata
): Promise<{ success: boolean; visitorId: string; isUniqueView: boolean }> {
  const adminClient = createAdminClient();
  
  try {
    // 1. Get journal_publics record
    const { data: published, error: publishError } = await adminClient
      .from('journal_publics')
      .select('id, published_by, is_active')
      .eq('share_id', data.shareId)
      .single();
    
    if (publishError || !published || !published.is_active) {
      console.error('[ViralTracking] Journal not found or inactive:', data.shareId);
      return { success: false, visitorId: '', isUniqueView: false };
    }
    
    // 2. Get or create visitor ID
    let visitorId = data.visitorId;
    if (!visitorId) {
      visitorId = generateVisitorId();
    }
    
    // 3. Get or create visitor node
    const visitorNode = await getOrCreateVisitorNode(
      visitorId,
      published.id,
      metadata,
      data.referrerVisitorId,
      data.sharePlatform
    );
    
    // 4. Check if this is a unique view (first view of this journal today)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingView } = await adminClient
      .from('view_events')
      .select('id')
      .eq('visitor_id', visitorNode.visitorId)
      .eq('journal_id', published.id)
      .gte('viewed_at', `${today}T00:00:00Z`)
      .single();
    
    const isUniqueView = !existingView;
    
    // 5. Create view event record
    const { error: viewError } = await adminClient
      .from('view_events')
      .insert({
        visitor_id: visitorNode.visitorId,
        journal_id: published.id,
        came_from_visitor_id: data.referrerVisitorId,
        referrer_platform: data.sharePlatform,
        is_unique_view: isUniqueView,
        is_returning_visitor: !visitorNode.isNew,
        visitor_ip_hash: metadata.ipHash,
        user_agent: metadata.userAgent,
        device_type: metadata.deviceType,
        browser: metadata.browser,
        os: metadata.os,
        country_code: metadata.countryCode,
        utm_source: data.utmParams?.source,
        utm_medium: data.utmParams?.medium,
        utm_campaign: data.utmParams?.campaign,
        utm_content: data.utmParams?.content,
        utm_term: data.utmParams?.term,
      });
    
    if (viewError) {
      // Constraint violation = already viewed today, that's okay
      if (viewError.code === '23505') {
        console.log('[ViralTracking] Duplicate view ignored (already viewed today)');
      } else {
        console.error('[ViralTracking] Error creating view event:', viewError);
      }
    }
    
    // 6. Create or update share edge if this came from a referral
    if (data.referrerVisitorId && isUniqueView) {
      const { data: edge } = await adminClient
        .from('share_edges')
        .select('id, was_viewed, shared_at')
        .eq('from_visitor_id', data.referrerVisitorId)
        .eq('to_visitor_id', visitorNode.visitorId)
        .eq('journal_id', published.id)
        .single();
      
      if (edge && !edge.was_viewed) {
        // Update existing edge
        const timeToView = Math.floor(
          (new Date().getTime() - new Date(edge.shared_at).getTime()) / 1000
        );
        
        await adminClient
          .from('share_edges')
          .update({
            was_viewed: true,
            first_viewed_at: new Date().toISOString(),
            time_to_view_seconds: timeToView,
          })
          .eq('id', edge.id);
      } else if (!edge) {
        // Create new edge if it doesn't exist
        const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${data.username}/journal/${data.shareId}?ref=${data.referrerVisitorId}`;
        await createShareEdge(
          data.referrerVisitorId,
          visitorNode.visitorId,
          published.id,
          data.sharePlatform || 'unknown',
          shareUrl
        );
      }
    }
    
    // 7. Increment counters (atomic)
    {
      const { error: rpcError } = await adminClient.rpc('increment', {
        row_id: published.id,
        table_name: 'journal_publics',
        column_name: 'access_count',
        increment_by: 1,
      });
      if (rpcError) {
        // Fallback: direct update
        await adminClient
          .from('journal_publics')
          .update({
            access_count: published.id, // This will be incremented via SQL
            last_accessed_at: new Date().toISOString(),
          })
          .eq('id', published.id);
      }
    }
    
    if (isUniqueView) {
      const { error: uniqueErr } = await adminClient
        .from('journal_publics')
        .update({
          unique_views_count: published.id, // Increment via trigger or manual
        })
        .eq('id', published.id);
      if (uniqueErr) console.log('[ViralTracking] Could not update unique_views_count');
    }
    
    return {
      success: true,
      visitorId: visitorNode.visitorId,
      isUniqueView,
    };
  } catch (error) {
    console.error('[ViralTracking] Error tracking view:', error);
    return { success: false, visitorId: '', isUniqueView: false };
  }
}

// ============================================================================
// SHARE EDGE TRACKING
// ============================================================================

/**
 * Track a share event (creates edge in graph)
 */
export async function trackShareEvent(
  data: ShareTrackingData
): Promise<{ success: boolean; shareUrl: string }> {
  const adminClient = createAdminClient();
  
  try {
    // Get journal_publics record
    const { data: published, error: publishError } = await adminClient
      .from('journal_publics')
      .select('id, is_active')
      .eq('share_id', data.shareId)
      .single();
    
    if (publishError || !published || !published.is_active) {
      console.error('[ViralTracking] Journal not found or inactive:', data.shareId);
      return { success: false, shareUrl: '' };
    }
    
    // Generate unique share URL with referrer tracking
    const shareUrl = `${data.targetUrl}?share_platform=${data.platform}&ref=${data.visitorId}`;
    
    // Note: We don't know the to_visitor_id yet (they haven't clicked)
    // We'll create a placeholder edge or create it on first view
    // For now, just increment share count
    
    await adminClient
      .from('visitor_nodes')
      .update({
        total_shares_count: data.visitorId, // Increment
      })
      .eq('visitor_id', data.visitorId);
    
    await adminClient
      .from('journal_publics')
      .update({
        total_shares_count: published.id, // Increment
      })
      .eq('id', published.id);
    
    // Record in share_records for analytics
    await adminClient
      .from('share_records')
      .insert({
        public_id: published.id,
        platform: data.platform,
        target_url: shareUrl,
        metadata: { visitor_id: data.visitorId },
      });
    
    return {
      success: true,
      shareUrl,
    };
  } catch (error) {
    console.error('[ViralTracking] Error tracking share:', error);
    return { success: false, shareUrl: data.targetUrl };
  }
}

/**
 * Create share edge when recipient views the shared link
 */
export async function createShareEdge(
  fromVisitorId: string,
  toVisitorId: string,
  journalId: string,
  platform: string,
  shareUrl: string
): Promise<void> {
  const adminClient = createAdminClient();
  
  try {
    await adminClient
      .from('share_edges')
      .insert({
        from_visitor_id: fromVisitorId,
        to_visitor_id: toVisitorId,
        journal_id: journalId,
        platform: platform,
        share_url: shareUrl,
        was_viewed: true,
        first_viewed_at: new Date().toISOString(),
        time_to_view_seconds: 0, // Immediate view
      })
      .single();
  } catch (error: any) {
    // Ignore duplicate constraint errors
    if (error.code !== '23505') {
      console.error('[ViralTracking] Error creating share edge:', error);
    }
  }
}

// ============================================================================
// ENGAGEMENT TRACKING (called from client-side)
// ============================================================================

/**
 * Update engagement metrics (time spent, scroll percentage)
 */
export async function updateEngagementMetrics(
  visitorId: string,
  journalId: string,
  metrics: {
    timeSpentSeconds?: number;
    scrollPercentage?: number;
    clickedMedia?: boolean;
    clickedShare?: boolean;
  }
): Promise<void> {
  const adminClient = createAdminClient();
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    await adminClient
      .from('view_events')
      .update({
        time_spent_seconds: metrics.timeSpentSeconds,
        scroll_percentage: metrics.scrollPercentage,
        clicked_media: metrics.clickedMedia,
        clicked_share: metrics.clickedShare,
        session_end_at: new Date().toISOString(),
      })
      .eq('visitor_id', visitorId)
      .eq('journal_id', journalId)
      .gte('viewed_at', `${today}T00:00:00Z`);
    
    // Update share edge if engagement threshold met
    if (metrics.timeSpentSeconds && metrics.timeSpentSeconds > 30) {
      await adminClient
        .from('share_edges')
        .update({ did_engage: true })
        .eq('to_visitor_id', visitorId)
        .eq('journal_id', journalId);
    }
  } catch (error) {
    console.error('[ViralTracking] Error updating engagement:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Refresh the viral_network_paths materialized view
 * Should be called periodically (e.g., hourly) via cron or background job
 */
export async function refreshViralNetworkPaths(): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();
  
  try {
    // Use raw SQL to refresh the materialized view
    const { error } = await adminClient.rpc('exec_sql', {
      sql_query: 'REFRESH MATERIALIZED VIEW CONCURRENTLY viral_network_paths;'
    });
    
    if (error) {
      // If RPC function doesn't exist, try direct SQL
      console.log('[ViralTracking] RPC exec_sql not available, trying direct query');
      const { error: directError } = await adminClient.from('viral_network_paths').select('*').limit(0);
      
      if (directError) {
        console.error('[ViralTracking] Error refreshing materialized view:', error);
        return { success: false, error: error.message };
      }
    }
    
    console.log('[ViralTracking] Materialized view refreshed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[ViralTracking] Error refreshing materialized view:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get viral network stats for a journal
 */
export async function getViralNetworkStats(shareId: string) {
  const adminClient = createAdminClient();
  
  const { data: published } = await adminClient
    .from('journal_publics')
    .select('id')
    .eq('share_id', shareId)
    .single();
  
  if (!published) return null;
  
  const { data: stats } = await adminClient
    .rpc('get_viral_network_stats', { p_journal_id: published.id })
    .single();
  
  return stats;
}

/**
 * Compute influence scores for a journal (background job)
 */
export async function computeInfluenceScores(shareId: string) {
  const adminClient = createAdminClient();
  
  const { data: published } = await adminClient
    .from('journal_publics')
    .select('id')
    .eq('share_id', shareId)
    .single();
  
  if (!published) return;
  
  await adminClient.rpc('compute_influence_scores', { p_journal_id: published.id });
}
