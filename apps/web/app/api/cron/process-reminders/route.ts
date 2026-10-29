// apps/web/app/api/cron/process-reminders/route.ts
// Vercel Cron job: process due scheduled reminders and run daily push prioritization.

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/utils/notifications/notificationService';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      // In development, allow without secret
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const reminders = await notificationService.processScheduledReminders();
    const sweep = await notificationService.runDailyPriorityPushSweep();

    return NextResponse.json({
      success: true,
      reminders,
      ...sweep,
      message: 'Reminder processing and daily push sweep completed',
    });
  } catch (err) {
    console.error('[ProcessReminders] Critical error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
