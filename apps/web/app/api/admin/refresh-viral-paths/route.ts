// apps/web/app/api/admin/refresh-viral-paths/route.ts
// Admin endpoint to manually refresh the viral_network_paths materialized view

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * POST /api/admin/refresh-viral-paths
 * Manually refresh the viral_network_paths materialized view
 * This is typically done via cron job, but can be triggered manually for testing
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    
    // Execute raw SQL to refresh the materialized view
    // Note: This requires the admin client to have appropriate permissions
    const { error } = await adminClient.rpc('exec_sql', {
      sql_query: 'REFRESH MATERIALIZED VIEW CONCURRENTLY viral_network_paths;'
    });
    
    if (error) {
      // If the RPC function doesn't exist, we need to use Supabase SQL editor or psql
      console.error('[Admin] Error refreshing materialized view via RPC:', error);
      
      return NextResponse.json({
        success: false,
        error: 'RPC function exec_sql not available. Please run the following command in Supabase SQL editor:\n\nREFRESH MATERIALIZED VIEW CONCURRENTLY viral_network_paths;',
        note: 'You can also set up a pg_cron job to refresh this automatically every hour.',
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Materialized view viral_network_paths refreshed successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('[Admin] Error refreshing viral paths:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      instructions: 'Run this in Supabase SQL editor: REFRESH MATERIALIZED VIEW CONCURRENTLY viral_network_paths;',
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/refresh-viral-paths
 * Get info about the materialized view status
 */
export async function GET() {
  try {
    const adminClient = createAdminClient();
    
    // Get row count from the materialized view
    const { data: paths, count, error } = await adminClient
      .from('viral_network_paths')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }
    
    // Get share_edges count
    const { count: edgesCount } = await adminClient
      .from('share_edges')
      .select('*', { count: 'exact', head: true });
    
    // Get visitor_nodes count  
    const { count: nodesCount } = await adminClient
      .from('visitor_nodes')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      stats: {
        viral_network_paths_count: count || 0,
        share_edges_count: edgesCount || 0,
        visitor_nodes_count: nodesCount || 0,
      },
      message: 'Use POST to this endpoint to refresh the materialized view',
    });
    
  } catch (error: any) {
    console.error('[Admin] Error getting viral paths info:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
